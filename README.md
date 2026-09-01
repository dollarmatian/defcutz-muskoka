# Def Cutz Muskoka

A barber shop's website that keeps itself current. Next.js on S3 and CloudFront, with three
scheduled Lambdas that pull the business's hours, reviews and photos from Google every day.

No server, no CMS, and nobody logs in to update anything.

## What does it do?

Three functions run once a day on an EventBridge schedule and write JSON into the site's bucket,
which the front end reads at request time:

| Lambda | Writes | From |
|---|---|---|
| `fetch-hours` | `data/hours.json` | Google Places |
| `fetch-reviews` | `data/reviews.json` | Google Business Profile, falling back to Places |
| `fetch-photos` | `data/photos.json`, plus the images themselves | the same two, then copies the bytes into S3 |

Reviews merge into what is already stored rather than replacing it, deduplicated by id **and** by
content, because the two sources issue different ids for the same review. The stored collection only
ever grows, so a degraded run can never shrink the site.

## Why not call the Google API from the browser?

Three reasons, and the first is the one a visitor would feel. A browser-side call makes every page
load wait on a round trip to Google before the hours or the gallery can render, with a further
request per photo. A file from a CloudFront edge is not a round trip to anywhere.

Second, it cannot be done safely anyway: the Business Profile API authenticates with a service
account private key, which has no business in a browser. Third, Google serves photo bytes from hosts
that fail CORS.

The cost is data up to a day old, which for opening hours and reviews is fine.

## How do I run the tests?

```
npm test        # vitest
npm run typecheck
```

Fifty tests over the logic with no I/O in it: the review merge, the content fingerprint, the three
API mappers, the opening-hours grouping and 12-hour clock conversion, and the rule that holds
one-star reviews for 60 days so a disputed one can be reported to Google first. Plus a component
test that the hours render from the file the Lambda writes, and stay quiet when it is missing.

The mapper tests are the ones that matter most: they assert that a review arriving from either
Google API ends up in the same shape and fingerprints identically, which is what the deduplication
depends on.

## How is it deployed?

`infra/` provisions a demo stack in Terraform: its own bucket, distribution, functions and schedules,
and a deploy role that GitHub Actions assumes by OIDC, so no AWS key exists anywhere.

It cannot touch the production site, and not by naming convention: both IAM policies carry an
explicit `Deny` on the production bucket, and an explicit Deny cannot be overridden by an Allow.
`infra/README.md` has the details.

## What does it not do?

- The data is at most 24 hours old. There is no webhook, because Google does not offer one here.
- Photos are stored under a hash of their contents, so a re-encode by Google stores the image again.
- The Business Profile tier needs a one-off human step: an owner grants access, and a service
  account cannot click an invitation email.
- Nothing paginates. At this size nothing needs to.

## What is in here?

```
app/          pages, Next.js app router
components/   the gallery, hours and testimonials that read the JSON
lambda/       the three functions, and their setup notes
lib/          business-hours parsing, review visibility rules
tests/        the pure logic
infra/        Terraform for the demo stack
```

## A note on this copy

A public reference copy of a private production repository. Production environment values are not
included, the committed review sample is trimmed and de-identified, and an unfinished storefront was
removed pending a rewrite. Everything else is the code that runs the site.
