/**
 * AWS Lambda: Fetch Google reviews, preferring the Business Profile API.
 *
 * Strategy (tiered):
 *   1. Business Profile API (mybusiness v4), returns ALL reviews, newest
 *      included, with owner replies. Requires the project to be approved for
 *      the API (quota > 0) AND an identity with access to the profile:
 *      either a user OAuth refresh token (any Manager account, see
 *      get-refresh-token.mjs) or the service account added as Manager
 *      (owner-only action, see accept-invitation.mjs).
 *   2. Fallback: Places API (New), up to ~5 "most relevant" public reviews.
 *      If GOOGLE_MAPS_API_KEY is set, also queries the legacy Place Details
 *      API with reviews_sort=newest for the 5 most recent reviews.
 *
 * Whichever source succeeds, results are merged with the existing reviews on
 * S3 (deduplicating by ID and by content), so the collection only ever grows.
 *
 * Environment variables (set in Lambda console):
 *   GOOGLE_CREDENTIALS         – Full service account JSON key
 *   GOOGLE_PLACE_ID            – Google Place ID for DEF CUTZ MUSKOKA
 *   GOOGLE_OAUTH_CLIENT_ID     – (Optional) OAuth client for tier 1 as a user
 *   GOOGLE_OAUTH_CLIENT_SECRET – (Optional) OAuth client secret
 *   GOOGLE_OAUTH_REFRESH_TOKEN – (Optional) Refresh token from get-refresh-token.mjs
 *   GOOGLE_MAPS_API_KEY        – (Optional) API key for the legacy Places API,
 *                                enables the "newest reviews" fallback fetch
 *   S3_BUCKET                  – Target S3 bucket name
 *   S3_KEY                     – Object key for the JSON file (default: data/reviews.json)
 *
 * Trigger: EventBridge (CloudWatch Events) schedule – rate(1 day)
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { createSign } from "crypto";

const s3 = new S3Client({});

/**
 * CloudFront caches /data/* files, so a write to S3 isn't visible on the
 * site until the cache expires. Invalidate right after writing so updates
 * go live immediately. Non-fatal: worst case the cache expires on its own.
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
          CallerReference: `fetch-reviews-${Date.now()}`,
          Paths: { Quantity: paths.length, Items: paths },
        },
      })
    );
    console.log(`CloudFront invalidation created for ${paths.join(", ")}`);
  } catch (err) {
    console.warn(`CloudFront invalidation failed (non-fatal): ${err.message}`);
  }
}

const SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/cloud-platform",
].join(" ");

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

async function readExistingReviews(bucket, key) {
  try {
    const response = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    const body = await response.Body.transformToString();
    const data = JSON.parse(body);
    return data.reviews ?? [];
  } catch (err) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      console.log("No existing reviews file found, starting fresh");
      return [];
    }
    if (err.name === "AccessDenied" || err.$metadata?.httpStatusCode === 403) {
      throw new Error(
        `S3 read denied, attach the defcutz-lambda-s3-access policy (including s3:ListBucket on the bucket) to this Lambda's execution role. Original: ${err.message}`
      );
    }
    throw err;
  }
}

// ---------- Tier 1: Business Profile API (all reviews) ----------

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
    throw new Error("No Business Profile accounts found. Is the service account added as Manager (and the invitation accepted)?");
  }

  console.log(`  Found ${accounts.length} account(s)`);

  for (const account of accounts) {
    console.log(`  Listing locations for ${account.name}...`);
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

async function fetchAllBusinessProfileReviews(accessToken) {
  const { accountName, locationName } = await discoverLocation(accessToken);

  const allReviews = [];
  let pageToken = null;

  do {
    const params = new URLSearchParams({ pageSize: "50" });
    if (pageToken) params.set("pageToken", pageToken);

    const url = `https://mybusiness.googleapis.com/v4/${accountName}/${locationName}/reviews?${params}`;
    console.log(`  Fetching reviews page...`);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Reviews API failed: ${res.status} ${errBody}`);
    }

    const data = await res.json();
    const reviews = data.reviews || [];
    allReviews.push(...reviews);
    pageToken = data.nextPageToken || null;
    console.log(`  Got ${reviews.length} reviews (${allReviews.length} total so far)`);
  } while (pageToken);

  return allReviews;
}

export function mapBusinessProfileReview(review) {
  const ratingMap = { FIVE: 5, FOUR: 4, THREE: 3, TWO: 2, ONE: 1 };
  return {
    id: review.name || "",
    author: review.reviewer?.displayName ?? "Anonymous",
    profilePhotoUrl: review.reviewer?.profilePhotoUrl ?? "",
    rating: ratingMap[review.starRating] ?? 0,
    text: review.comment ?? "",
    date: review.createTime ?? new Date().toISOString(),
    reply: review.reviewReply?.comment ?? undefined,
  };
}

// ---------- Tier 2 fallback: Places API (New) + legacy newest ----------

async function fetchPlaceReviews(accessToken, placeId) {
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Goog-FieldMask": "reviews,rating,userRatingCount,displayName",
    },
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Places API failed: ${res.status} ${errBody}`);
  }

  const data = await res.json();
  console.log(`  Business: ${data.displayName?.text}`);
  console.log(`  Overall rating: ${data.rating} (${data.userRatingCount} ratings)`);
  return {
    reviews: data.reviews || [],
    overallRating: data.rating ?? null,
    userRatingCount: data.userRatingCount ?? null,
  };
}

/**
 * Legacy Place Details API supports reviews_sort=newest, which the new API
 * does not. Only works for Cloud projects with the legacy Places API enabled.
 */
async function fetchNewestReviewsLegacy(apiKey, placeId) {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: "reviews",
    reviews_sort: "newest",
    key: apiKey,
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);

  if (!res.ok) {
    throw new Error(`Legacy Places API failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data.status !== "OK") {
    throw new Error(`Legacy Places API failed: ${data.status} ${data.error_message || ""}`);
  }

  return data.result?.reviews || [];
}

export function mapPlacesReview(review) {
  return {
    id: review.name || "",
    author: review.authorAttribution?.displayName ?? "Anonymous",
    profilePhotoUrl: review.authorAttribution?.photoUri ?? "",
    rating: review.rating ?? 0,
    text: review.text?.text ?? "",
    date: review.publishTime ?? new Date().toISOString(),
  };
}

// Legacy reviews have no stable ID, so synthesize one from timestamp+author.
// The content-based dedupe below catches overlap with other sources.
export function mapLegacyReview(review) {
  const authorSlug = (review.author_name ?? "anonymous").toLowerCase().replace(/\s+/g, "-");
  return {
    id: `legacy-${review.time ?? 0}-${authorSlug}`,
    author: review.author_name ?? "Anonymous",
    profilePhotoUrl: review.profile_photo_url ?? "",
    rating: review.rating ?? 0,
    text: review.text ?? "",
    date: review.time
      ? new Date(review.time * 1000).toISOString()
      : new Date().toISOString(),
  };
}

// ---------- Merge helpers ----------

// Different sources use different ID formats for the same review, so also
// fingerprint by content to avoid duplicates.
export function contentKey(review) {
  const text = (review.text ?? "").trim().toLowerCase().slice(0, 60);
  return `${(review.author ?? "").trim().toLowerCase()}|${review.rating}|${text}`;
}

/**
 * Merge freshly fetched reviews into the stored collection.
 *
 * The collection only ever grows: a degraded run that returns five reviews must
 * never shrink a stored set of eighty. Deduplication is by id AND by content
 * because the Business Profile and Places APIs issue different ids for the same
 * review, so an id-only check lets duplicates through when the source changes.
 *
 * Returns a new array sorted newest first; the inputs are not mutated.
 */
export function mergeReviews(existing, incoming) {
  const reviews = [...existing];
  const ids = new Set(reviews.map((r) => r.id));
  const contents = new Set(reviews.map(contentKey));
  let newCount = 0;

  for (const review of incoming) {
    if (ids.has(review.id) || contents.has(contentKey(review))) continue;
    reviews.push(review);
    ids.add(review.id);
    contents.add(contentKey(review));
    newCount++;
  }

  reviews.sort(
    (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  );

  return { reviews, newCount };
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
  const key = process.env.S3_KEY || "data/reviews.json";

  if (!process.env.GOOGLE_CREDENTIALS) {
    return { statusCode: 500, body: "Missing GOOGLE_CREDENTIALS env var" };
  }
  if (!placeId || !bucket) {
    return { statusCode: 500, body: "Missing GOOGLE_PLACE_ID or S3_BUCKET env var" };
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

    console.log("Step 1: Getting access token...");
    const accessToken = await getAccessToken(credentials);
    console.log("Step 1: SUCCESS");

    console.log("Step 2: Reading existing reviews from S3...");
    const existingReviews = await readExistingReviews(bucket, key);
    console.log(`Step 2: ${existingReviews.length} existing reviews`);

    let mapped = [];
    let source = "";
    let overallRating = null;
    let userRatingCount = null;

    console.log("Step 3: Trying Business Profile API (all reviews)...");
    try {
      let bpToken = accessToken;
      if (hasOAuthConfig()) {
        console.log("  Using user OAuth refresh token (Manager account)");
        bpToken = await getOAuthAccessToken();
      } else {
        console.log("  Using service account token");
      }
      const bpReviews = await fetchAllBusinessProfileReviews(bpToken);
      mapped = bpReviews.map(mapBusinessProfileReview);
      source = "business-profile";
      console.log(`Step 3: SUCCESS, ${mapped.length} reviews via Business Profile API`);
    } catch (err) {
      console.warn(`Step 3: Business Profile API unavailable (${err.message})`);
      console.log("Step 3b: Falling back to Places API (New)...");
      const placeResult = await fetchPlaceReviews(accessToken, placeId);
      mapped = placeResult.reviews.map(mapPlacesReview);
      overallRating = placeResult.overallRating;
      userRatingCount = placeResult.userRatingCount;
      source = "places";
      console.log(`Step 3b: Fetched ${mapped.length} most-relevant reviews`);

      if (process.env.GOOGLE_MAPS_API_KEY) {
        console.log("Step 3c: Fetching newest reviews via legacy Places API...");
        try {
          const newest = await fetchNewestReviewsLegacy(
            process.env.GOOGLE_MAPS_API_KEY,
            placeId
          );
          console.log(`Step 3c: Fetched ${newest.length} newest reviews`);
          mapped.push(...newest.map(mapLegacyReview));
        } catch (legacyErr) {
          console.warn(`Step 3c: SKIPPED (${legacyErr.message})`);
        }
      } else {
        console.log("Step 3c: GOOGLE_MAPS_API_KEY not set, skipping newest-reviews fetch");
      }
    }

    const merged = mergeReviews(existingReviews, mapped);
    const newCount = merged.newCount;
    existingReviews.length = 0;
    existingReviews.push(...merged.reviews);

    console.log(`Fetched ${mapped.length} reviews from "${source}", ${newCount} are new`);

    console.log("Step 4: Writing to S3...");
    const payload = {
      success: true,
      totalReviews: existingReviews.length,
      source,
      overallRating,
      userRatingCount,
      fetchedAt: new Date().toISOString(),
      reviews: existingReviews,
    };

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(payload, null, 2),
        ContentType: "application/json",
        CacheControl: "public, max-age=3600",
      })
    );

    await invalidateCloudFront([`/${key}`]);

    console.log(`SUCCESS: ${existingReviews.length} total reviews, ${newCount} new (source: ${source})`);
    return {
      statusCode: 200,
      body: `Reviews updated: ${existingReviews.length} total, ${newCount} new (source: ${source})`,
    };
  } catch (err) {
    console.error("Error:", err.message, err.stack);
    return { statusCode: 500, body: JSON.stringify({ step: "unhandled", error: err.message }) };
  }
};
