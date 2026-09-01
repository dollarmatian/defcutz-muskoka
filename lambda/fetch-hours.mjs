/**
 * AWS Lambda: Fetch business hours from Google Places API (New) and write to S3.
 *
 * Uses the same Places API (New) as the reviews and photos Lambdas.
 *
 * Environment variables (set in Lambda console):
 *   GOOGLE_CREDENTIALS     – Full service account JSON key
 *   GOOGLE_PLACE_ID        – Google Place ID for DEF CUTZ MUSKOKA
 *   S3_BUCKET              – Target S3 bucket name (your site bucket)
 *   S3_KEY                 – Object key for the JSON file (default: data/hours.json)
 *
 * Trigger: EventBridge (CloudWatch Events) schedule – rate(1 day)
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
          CallerReference: `fetch-hours-${Date.now()}`,
          Paths: { Quantity: paths.length, Items: paths },
        },
      })
    );
    console.log(`CloudFront invalidation created for ${paths.join(", ")}`);
  } catch (err) {
    console.warn(`CloudFront invalidation failed (non-fatal): ${err.message}`);
  }
}

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
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

export function formatTime(hour, minute) {
  if (hour === undefined || hour === null) return "";
  const h = Number(hour);
  const m = String(minute || 0).padStart(2, "0");
  if (h === 0) return `12:${m} AM`;
  if (h < 12) return `${h}:${m} AM`;
  if (h === 12) return `12:${m} PM`;
  return `${h - 12}:${m} PM`;
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
  const key = process.env.S3_KEY || "data/hours.json";

  if (!process.env.GOOGLE_CREDENTIALS) {
    return { statusCode: 500, body: "Missing GOOGLE_CREDENTIALS env var" };
  }
  if (!placeId || !bucket) {
    return { statusCode: 500, body: "Missing GOOGLE_PLACE_ID or S3_BUCKET" };
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

    console.log("Step 1: Getting access token...");
    const accessToken = await getAccessToken(credentials);
    console.log("Step 1: SUCCESS");

    console.log("Step 2: Fetching hours from Google Places API...");
    const url = `https://places.googleapis.com/v1/places/${placeId}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Goog-FieldMask": "regularOpeningHours,businessStatus,displayName",
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Google API FAILED:", res.status, errBody);
      return {
        statusCode: 500,
        body: JSON.stringify({ step: "google_api", httpStatus: res.status, error: errBody }),
      };
    }

    const data = await res.json();
    console.log("Step 2: SUCCESS");
    console.log("Business:", data.displayName?.text);
    console.log("Status:", data.businessStatus);

    // --- Extract and format hours ---
    const hoursMap = {};
    for (const day of DAY_NAMES) {
      hoursMap[day] = { day, open: "", close: "" };
    }

    const regularHours = data.regularOpeningHours;
    if (regularHours?.periods) {
      for (const period of regularHours.periods) {
        // Places API (New) uses numeric day: 0=Sunday, 1=Monday, ...
        const dayIndex = period.open?.day;
        if (dayIndex !== undefined && dayIndex >= 0 && dayIndex <= 6) {
          const dayName = DAY_NAMES[dayIndex];
          hoursMap[dayName] = {
            day: dayName,
            open: formatTime(period.open?.hour, period.open?.minute),
            close: formatTime(period.close?.hour, period.close?.minute),
          };
        }
      }
    }

    const hours = DAY_NAMES.map((d) => hoursMap[d]);

    const payload = {
      hours,
      businessStatus: data.businessStatus || "OPERATIONAL",
      isOpenNow: regularHours?.openNow ?? null,
      weekdayText: regularHours?.weekdayDescriptions || hours
        .filter((h) => h.open && h.close)
        .map((h) => `${h.day}: ${h.open} - ${h.close}`),
      fetchedAt: new Date().toISOString(),
    };

    console.log("Step 3: Writing to S3...");
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

    console.log(`SUCCESS: Wrote hours to s3://${bucket}/${key}`);
    console.log("Hours:", JSON.stringify(hours, null, 2));
    return { statusCode: 200, body: "Hours updated" };
  } catch (err) {
    console.error("Error:", err.message, err.stack);
    return { statusCode: 500, body: JSON.stringify({ step: "unhandled", error: err.message }) };
  }
};
