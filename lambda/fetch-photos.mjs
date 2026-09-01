/**
 * AWS Lambda: Fetch Google photos, download binaries to S3, and write manifest.
 *
 * Strategy (tiered):
 *   1. Business Profile API (mybusiness v4 media), returns ALL photos on the
 *      profile (merchant-posted and customer-posted), paginated, no cap.
 *      Requires the project to be approved for the API AND an identity with
 *      access to the profile: either a user OAuth refresh token (any Manager
 *      account, see get-refresh-token.mjs) or the service account added as
 *      Manager. Same setup as fetch-reviews.
 *   2. Fallback: Places API (New), returns at most ~10 photos, chosen by
 *      Google's relevance ranking (not necessarily the newest).
 *
 * Each run builds a fresh manifest from whatever source succeeds. Photos are
 * named by a hash of their content, so the same image is never stored twice
 * and photos already on S3 are not re-uploaded.
 *
 * Environment variables (set in Lambda console):
 *   GOOGLE_CREDENTIALS         – Full service account JSON key
 *   GOOGLE_PLACE_ID            – Google Place ID (ChIJ... format)
 *   GOOGLE_OAUTH_CLIENT_ID     – (Optional) OAuth client for tier 1 as a user
 *   GOOGLE_OAUTH_CLIENT_SECRET – (Optional) OAuth client secret
 *   GOOGLE_OAUTH_REFRESH_TOKEN – (Optional) Refresh token from get-refresh-token.mjs
 *   CLOUDFRONT_DISTRIBUTION_ID – (Optional) Distribution to invalidate after writing
 *   S3_BUCKET                  – Target S3 bucket name
 *   EXCLUDE_PHOTOS             – Comma-separated filenames to exclude (e.g. "abc123.jpg,def456.jpg")
 *
 * Trigger: EventBridge (CloudWatch Events) schedule – rate(1 day)
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { createSign, createHash } from "crypto";

const s3 = new S3Client({});

const SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/cloud-platform",
].join(" ");

/**
 * CloudFront caches /data/* files, so a write to S3 isn't visible on the
 * site until the cache expires. Invalidate right after writing so updates
 * go live immediately. Non-fatal: worst case the cache expires on its own.
 * Gallery images are content-hashed (new image = new filename) so only the
 * manifest needs invalidating.
 */
async function invalidateCloudFront(paths) {
  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
  if (!distributionId) {
    console.log("CLOUDFRONT_DISTRIBUTION_ID not set, skipping invalidation");
    return;
  }
  try {
    const cf = new CloudFrontClient({});
    await cf.send(
      new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
          CallerReference: `fetch-photos-${Date.now()}`,
          Paths: { Quantity: paths.length, Items: paths },
        },
      })
    );
    console.log(`CloudFront invalidation created for ${paths.join(", ")}`);
  } catch (err) {
    console.warn(`CloudFront invalidation failed (non-fatal): ${err.message}`);
  }
}

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: credentials.client_email,
    scope: SCOPES,
    aud: credentials.token_uri,
    iat: now,
    exp: now + 3600,
  })).toString("base64url");

  const signatureInput = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signatureInput);
  const signature = sign.sign(credentials.private_key, "base64url");

  const jwt = `${signatureInput}.${signature}`;

  const res = await fetch(credentials.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${body}`);
  }

  return JSON.parse(body).access_token;
}

/**
 * Exchange a user OAuth refresh token for an access token. This acts as the
 * human Manager account, so it works even though only Owners can add the
 * service account to the Business Profile.
 */
async function getOAuthAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`OAuth refresh failed: ${res.status} ${body}`);
  }

  return JSON.parse(body).access_token;
}

function hasOAuthConfig() {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  );
}

// ---------- Tier 1: Business Profile API (all photos) ----------

async function discoverLocation(accessToken) {
  console.log("  Discovering accounts...");
  const acctRes = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!acctRes.ok) {
    const errBody = await acctRes.text();
    throw new Error(`List accounts failed: ${acctRes.status} ${errBody}`);
  }

  const acctData = await acctRes.json();
  const accounts = acctData.accounts || [];

  if (accounts.length === 0) {
    throw new Error("No Business Profile accounts found. Is the account a Manager on the profile?");
  }

  for (const account of accounts) {
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!locRes.ok) {
      console.warn(`  Failed for ${account.name}: ${locRes.status}`);
      continue;
    }

    const locData = await locRes.json();
    const locations = locData.locations || [];

    if (locations.length > 0) {
      const location = locations[0];
      console.log(`  Using: "${location.title}" (${location.name})`);
      return { accountName: account.name, locationName: location.name };
    }
  }

  throw new Error("No locations found for any account.");
}

async function listMedia(accessToken, accountName, locationName, suffix) {
  const items = [];
  let pageToken = null;

  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (pageToken) params.set("pageToken", pageToken);

    const url = `https://mybusiness.googleapis.com/v4/${accountName}/${locationName}/${suffix}?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Media API (${suffix}) failed: ${res.status} ${errBody}`);
    }

    const data = await res.json();
    items.push(...(data.mediaItems || []));
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return items;
}

/**
 * Returns ALL photos on the Business Profile: merchant-posted and
 * customer-posted. Each entry is { url, ref } where url is a directly
 * downloadable googleusercontent link.
 */
async function fetchBusinessProfilePhotos(accessToken) {
  const { accountName, locationName } = await discoverLocation(accessToken);

  const merchant = await listMedia(accessToken, accountName, locationName, "media");
  console.log(`  ${merchant.length} merchant media items`);

  let customer = [];
  try {
    customer = await listMedia(accessToken, accountName, locationName, "media/customers");
    console.log(`  ${customer.length} customer media items`);
  } catch (err) {
    console.warn(`  Customer media unavailable (${err.message})`);
  }

  const photos = [];
  for (const item of [...merchant, ...customer]) {
    if (item.mediaFormat && item.mediaFormat !== "PHOTO") continue;
    let url = item.googleUrl || item.sourceUrl;
    if (!url) continue;
    // googleusercontent links accept a size suffix; cap width for the site
    if (url.includes("googleusercontent.com") && !url.includes("=")) {
      url += "=s1200";
    }
    photos.push({ url, ref: item.name || url });
  }
  return photos;
}

// ---------- Tier 2 fallback: Places API (~10 photos) ----------

async function fetchPlacesPhotos(accessToken, placeId) {
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Goog-FieldMask": "photos",
    },
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Places API failed: ${res.status} ${errBody}`);
  }

  const data = await res.json();
  const googlePhotos = data.photos ?? [];
  console.log(`  ${googlePhotos.length} photo references from Places API`);

  const photos = [];
  for (const photo of googlePhotos) {
    const photoRef = photo.name;
    if (!photoRef) continue;

    const mediaUrl =
      `https://places.googleapis.com/v1/${photoRef}/media` +
      `?maxWidthPx=1200&skipHttpRedirect=true`;

    const mediaRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!mediaRes.ok) {
      console.warn(`  Failed to get media URL for ${photoRef}: ${mediaRes.status}`);
      continue;
    }

    const mediaData = await mediaRes.json();
    if (!mediaData.photoUri) {
      console.warn(`  No photoUri for ${photoRef}`);
      continue;
    }
    photos.push({ url: mediaData.photoUri, ref: photoRef });
  }
  return photos;
}

// ---------- Shared download/upload ----------

async function existsOnS3(bucket, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ---------- Secrets ----------
//
// Secrets are read from SSM Parameter Store when SECRETS_PREFIX is set, and
// from plain environment variables when it is not. Loading them INTO
// process.env means nothing else in this file has to change, and the same file
// runs under both deployment styles.
//
// Why not just use Lambda environment variables? They are stored with the
// function and returned in plaintext by GetFunctionConfiguration, so anyone who
// can read the function can read the key. Worse, putting the value in Terraform
// means the value lands in Terraform state, and state is a file that gets
// copied around. SSM keeps the value in one place, encrypted, with its own
// audit trail, and Terraform only ever grants read access to a path.
//
// This helper is duplicated across the three functions deliberately: each one
// is a single file so it can be pasted into the console. It becomes a shared
// module when production is deployed by Terraform the way the demo stack is.
const SECRET_ENV_VARS = [
  "GOOGLE_CREDENTIALS",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REFRESH_TOKEN",
  "GOOGLE_MAPS_API_KEY",
];

const parameterName = (prefix, envVar) =>
  `${prefix}/${envVar.toLowerCase().replaceAll("_", "-")}`;

export async function loadSecrets(env = process.env) {
  const prefix = env.SECRETS_PREFIX;
  if (!prefix) return;

  const { SSMClient, GetParametersCommand } = await import("@aws-sdk/client-ssm");
  const ssm = new SSMClient({});
  const names = SECRET_ENV_VARS.map((v) => parameterName(prefix, v));

  // Parameters that do not exist come back under InvalidParameters rather than
  // throwing, so the optional OAuth and Maps keys can simply be absent.
  const res = await ssm.send(
    new GetParametersCommand({ Names: names, WithDecryption: true })
  );

  for (const param of res.Parameters ?? []) {
    const envVar = SECRET_ENV_VARS.find(
      (v) => parameterName(prefix, v) === param.Name
    );
    if (envVar && param.Value) env[envVar] = param.Value;
  }
}

export const handler = async () => {
  await loadSecrets();

  const placeId = process.env.GOOGLE_PLACE_ID;
  const bucket = process.env.S3_BUCKET;

  if (!process.env.GOOGLE_CREDENTIALS) {
    return { statusCode: 500, body: "Missing GOOGLE_CREDENTIALS env var" };
  }
  if (!placeId || !bucket) {
    return { statusCode: 500, body: "Missing GOOGLE_PLACE_ID or S3_BUCKET" };
  }

  // Parse excluded filenames
  const excludeSet = new Set(
    (process.env.EXCLUDE_PHOTOS || "").split(",").map((s) => s.trim()).filter(Boolean)
  );
  if (excludeSet.size > 0) {
    console.log(`Excluding ${excludeSet.size} photos: ${[...excludeSet].join(", ")}`);
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

    console.log("Step 1: Getting access token...");
    const accessToken = await getAccessToken(credentials);
    console.log("Step 1: SUCCESS");

    let photoList = [];
    let source = "";

    console.log("Step 2: Trying Business Profile API (all photos)...");
    try {
      let bpToken = accessToken;
      if (hasOAuthConfig()) {
        console.log("  Using user OAuth refresh token (Manager account)");
        bpToken = await getOAuthAccessToken();
      } else {
        console.log("  Using service account token");
      }
      photoList = await fetchBusinessProfilePhotos(bpToken);
      source = "business-profile";
      console.log(`Step 2: SUCCESS, ${photoList.length} photos via Business Profile API`);
    } catch (err) {
      console.warn(`Step 2: Business Profile API unavailable (${err.message})`);
      console.log("Step 2b: Falling back to Places API (~10 photos)...");
      photoList = await fetchPlacesPhotos(accessToken, placeId);
      source = "places";
      console.log(`Step 2b: ${photoList.length} photos via Places API`);
    }

    console.log("Step 3: Processing photos...");
    const photos = [];
    const seenKeys = new Set();
    let downloaded = 0;
    let skipped = 0;
    let excluded = 0;

    for (const { url: imageUrl, ref } of photoList) {
      // Exclusions can name the permanent Google media ID (the last path
      // segment of photoReference), unlike the content hash, it never
      // changes when Google re-encodes the image.
      const refId = ref.split("/").pop();
      if (excludeSet.has(ref) || (refId && excludeSet.has(refId))) {
        excluded++;
        console.log(`Excluded by reference: ${ref}`);
        continue;
      }

      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) {
        console.warn(`Failed to download image: ${imageRes.status}`);
        continue;
      }

      const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

      // Hash the image CONTENT for a stable filename (same image = same name always)
      const contentHash = createHash("md5").update(imageBuffer).digest("hex").slice(0, 12);
      const filename = `${contentHash}.jpg`;
      const s3Key = `data/gallery/${filename}`;

      // Skip excluded photos. Log the media ID so hash-based exclusions can
      // be upgraded to permanent ID-based ones straight from the log.
      if (excludeSet.has(filename)) {
        excluded++;
        console.log(`Excluded: ${filename} (media ID: ${refId})`);
        continue;
      }

      // Same image can appear in both merchant and customer lists
      if (seenKeys.has(s3Key)) continue;
      seenKeys.add(s3Key);

      // Only upload if not already on S3
      if (!(await existsOnS3(bucket, s3Key))) {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Body: imageBuffer,
            ContentType: "image/jpeg",
            CacheControl: "public, max-age=86400",
          })
        );
        downloaded++;
        console.log(`Downloaded ${filename} (${imageBuffer.length} bytes)`);
      } else {
        skipped++;
      }

      // Add to manifest
      photos.push({
        url: `/${s3Key}`,
        photoReference: ref,
        fetchedAt: new Date().toISOString(),
      });
    }

    console.log(`Step 3: ${photos.length} photos kept, ${downloaded} downloaded, ${skipped} already on S3, ${excluded} excluded`);

    console.log("Step 4: Writing manifest to S3...");
    const manifest = {
      photos,
      totalPhotos: photos.length,
      source,
      fetchedAt: new Date().toISOString(),
    };

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "data/photos.json",
        Body: JSON.stringify(manifest, null, 2),
        ContentType: "application/json",
        CacheControl: "public, max-age=3600",
      })
    );

    await invalidateCloudFront(["/data/photos.json"]);

    console.log(`SUCCESS: ${photos.length} photos in manifest (source: ${source})`);
    return {
      statusCode: 200,
      body: `Photos updated: ${photos.length} total, ${downloaded} new, ${excluded} excluded (source: ${source})`,
    };
  } catch (err) {
    console.error("Error:", err.message, err.stack);
    return { statusCode: 500, body: JSON.stringify({ step: "unhandled", error: err.message }) };
  }
};
