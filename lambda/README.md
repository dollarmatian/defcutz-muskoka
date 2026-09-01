# Lambda Functions for the business

All three Lambdas use a **Google service account** for authentication. No tokens to expire -- the service account key handles everything.

## Shared Setup

### Google Service Account
All Lambdas need the same `GOOGLE_CREDENTIALS` env var containing the full service account JSON key.

Service account: `<service-account>@<project>.iam.gserviceaccount.com`

| Variable | Description |
|---|---|
| `GOOGLE_CREDENTIALS` | Full service account JSON key (paste the entire `{ "type": "service_account", ... }` JSON) |
| `GOOGLE_PLACE_ID` | Google Places API Place ID for the business (`<GOOGLE_PLACE_ID>`) |
| `S3_BUCKET` | Your site's S3 bucket name (`<your-bucket>`) |
| `CLOUDFRONT_DISTRIBUTION_ID` | ID of the CloudFront distribution serving `<your-bucket>` (CloudFront console > the distribution with that alternate domain name). Each Lambda invalidates the `/data/*.json` file it writes so updates go live immediately instead of waiting out the CloudFront cache. If unset, invalidation is skipped (data can be stale up to the cache TTL). |

### How it works
Each Lambda creates a JWT signed with the service account's private key, exchanges it for a short-lived access token, then uses that token as `Bearer` auth on Google API requests. Service account keys don't expire, so this works reliably for daily scheduled runs.

### Lambda inline editor
All code uses ESM (`import`/`export`). When pasting into the Lambda console inline editor, make sure the file is `index.mjs` (not `index.js`). The handler should be set to `index.handler`.

### IAM permissions
All three Lambdas share a single IAM policy (`<lambda-s3-access-policy>`) attached to each Lambda's execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::<your-bucket>/data/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::<your-bucket>",
      "Condition": { "StringLike": { "s3:prefix": ["data/*"] } }
    },
    {
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "*"
    }
  ]
}
```

`s3:ListBucket` matters even though the Lambdas never list files: without it, S3 reports a **missing** object as *AccessDenied* instead of *404 Not Found*, which breaks the "no existing file yet, start fresh" path on first run.

To attach: Lambda console > your function > **Configuration > Permissions** > click the execution role name (opens IAM) > **Add permissions > Attach policies** > select `<lambda-s3-access-policy>`.

### Seed data
Before the Lambdas are running, upload seed files to S3 so the site has data:

```bash
aws s3 cp public/data/hours.json s3://<your-bucket>/data/hours.json --content-type "application/json" --cache-control "public, max-age=3600"
aws s3 cp public/data/reviews.json s3://<your-bucket>/data/reviews.json --content-type "application/json" --cache-control "public, max-age=3600"
aws s3 cp public/data/photos.json s3://<your-bucket>/data/photos.json --content-type "application/json" --cache-control "public, max-age=3600"
```

---

# fetch-hours

Fetches business hours from the Google Places API (New) and writes `hours.json` to S3.

### Create the Lambda function
- Runtime: **Node.js 20.x**
- Handler: `index.handler`
- Timeout: 30 seconds
- Memory: 128 MB

### Environment variables
| Variable | Description |
|---|---|
| `GOOGLE_CREDENTIALS` | Service account JSON key |
| `GOOGLE_PLACE_ID` | `<GOOGLE_PLACE_ID>` |
| `S3_BUCKET` | `<your-bucket>` |
| `S3_KEY` | Path in bucket (default: `data/hours.json`) |

### Status
**Working.** Uses `places.googleapis.com/v1` with `regularOpeningHours` field mask.

### Schedule
EventBridge rule: `rate(1 day)`

---

# fetch-reviews

Fetches Google reviews using a **tiered strategy**, it tries the best source first and falls back automatically:

1. **Business Profile API** (preferred): returns **ALL** reviews, newest included, with owner replies. Requires the Cloud project to be approved for the API (check: the [Google My Business API quota](https://console.cloud.google.com/apis/api/mybusiness.googleapis.com/quotas) must be > 0 requests/min, this project is approved at 60/min) **and** the service account to have Manager access on the profile (see Prerequisites below).
2. **Places API (New)** (fallback): up to ~5 "most relevant" public reviews, same auth as the hours/photos Lambdas, always works. If `GOOGLE_MAPS_API_KEY` is set, also calls the **legacy** Place Details API with `reviews_sort=newest` for the 5 most recent reviews (legacy API only works for Cloud projects that had it enabled before March 2025; skipped gracefully otherwise).

Whichever source succeeds, results are merged with the existing reviews on S3 (deduplicating by ID **and** by content, since sources use different ID formats), so the collection only ever grows. All reviews are kept (no star rating filter). The Lambda's log and the JSON's `source` field show which tier ran.

### Prerequisites (for the Business Profile tier)
The API needs an identity with access to the Business Profile. Two options, **either one works**:

**Option A, user OAuth (works for a Manager, no Owner needed):**
1. In Cloud Console > APIs & Services > OAuth consent screen: configure (External), then **Publish app** to production (otherwise refresh tokens expire in 7 days)
2. Credentials > Create Credentials > OAuth client ID > **Desktop app**; copy the client ID + secret
3. Run locally: `node lambda/get-refresh-token.mjs <CLIENT_ID> <CLIENT_SECRET>` and sign in with the Google account that is a Manager on the profile
4. Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` on the Lambda

**Option B, service account as Manager (requires the profile OWNER):**
1. The **Owner** goes to [business.google.com](https://business.google.com) > Business Profile settings > People and access > Add
2. Adds `<service-account>@<project>.iam.gserviceaccount.com` as **Manager** (Managers cannot add users, Owner only)
3. The invitation must be **accepted via API** (service accounts have no inbox), run the `accept-invitation` Lambda once (see below)

**Until one of these is done**, the Lambda automatically uses the Places API fallback tier.

### Create the Lambda function
- Runtime: **Node.js 20.x**
- Handler: `index.handler`
- Timeout: 30 seconds
- Memory: 128 MB

### Environment variables
| Variable | Description |
|---|---|
| `GOOGLE_CREDENTIALS` | Service account JSON key |
| `GOOGLE_PLACE_ID` | `<GOOGLE_PLACE_ID>` |
| `GOOGLE_MAPS_API_KEY` | (Optional) API key with the legacy **Places API** enabled, adds a "5 newest reviews" fetch |
| `S3_BUCKET` | `<your-bucket>` |
| `S3_KEY` | Path in bucket (default: `data/reviews.json`) |

### Schedule
EventBridge rule: `rate(1 day)`

---

# accept-invitation (one-time)

Accepts a pending Business Profile Manager invitation on behalf of the service account (service accounts can't click the email link). Create it like the other Lambdas (Node.js 20.x, `index.handler`, only `GOOGLE_CREDENTIALS` needed), run **Test** once after sending the Manager invite from business.google.com, confirm the log shows the account, then delete the Lambda.

---

# fetch-photos

Fetches Google photos, downloads binaries to S3 (solving CORS issues), and maintains a `photos.json` manifest. Uses the same **tiered strategy** as fetch-reviews:

1. **Business Profile API** (preferred): returns **ALL** photos on the profile, merchant-posted and customer-posted, no cap. Requires the same profile access as fetch-reviews (user OAuth refresh token or service account as Manager, see the fetch-reviews Prerequisites). Reuse the same `GOOGLE_OAUTH_*` values.
2. **Places API (New)** (fallback): at most ~10 photos, chosen by Google's relevance ranking, new photos may lag or never appear.

The manifest's `source` field and the log show which tier ran. Photos are named by a hash of their content, so the same image is never stored twice.

### Create the Lambda function
- Runtime: **Node.js 20.x**
- Handler: `index.handler`
- Timeout: **300 seconds** (the Business Profile tier can download the full photo library on first run)
- Memory: **512 MB** (handles image buffers)

### Environment variables
| Variable | Description |
|---|---|
| `GOOGLE_CREDENTIALS` | Service account JSON key |
| `GOOGLE_PLACE_ID` | `<GOOGLE_PLACE_ID>` |
| `GOOGLE_OAUTH_CLIENT_ID` | (Optional) Same value as on fetch-reviews, enables the all-photos tier |
| `GOOGLE_OAUTH_CLIENT_SECRET` | (Optional) Same value as on fetch-reviews |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | (Optional) Same value as on fetch-reviews |
| `CLOUDFRONT_DISTRIBUTION_ID` | (Optional) Invalidate the manifest after writing |
| `S3_BUCKET` | `<your-bucket>` |
| `EXCLUDE_PHOTOS` | Comma-separated exclusions. Accepts gallery filenames (`abc123.jpg`, easy to grab via right-click > Copy image address, but the hash changes if Google re-encodes the image) and/or Google media IDs (the last path segment of `photoReference` in `photos.json`, permanent, survives re-encodes). Prefer the media ID for anything you want gone forever. |

### Schedule
EventBridge rule: `rate(1 day)`
