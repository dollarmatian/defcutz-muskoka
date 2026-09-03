# infra

Terraform for a **demo** copy of the site: its own bucket, its own CloudFront
distribution, its own Lambdas on their own schedule, and its own deploy role.

It shares nothing with the live site.

## How is it kept away from the live site?

Naming is not the answer, because a typo defeats naming. Both IAM policies carry
an explicit Deny on the live bucket:

```hcl
statement {
  sid       = "NeverTouchTheLiveSite"
  effect    = "Deny"
  actions   = ["s3:*"]
  resources = ["arn:aws:s3:::${var.live_bucket_name}", "arn:aws:s3:::${var.live_bucket_name}/*"]
}
```

An explicit Deny cannot be overridden by any Allow. A wrong bucket name in an
environment variable or in CI is a failed job, not an incident.

## Where do the secrets live?

Not in Terraform, and not in `terraform.tfvars`. The Google credentials sit in SSM Parameter Store
as `SecureString` values, created once with the CLI:

```
aws ssm put-parameter --type SecureString \
  --name /defcutz-demo/google-credentials \
  --value file://service-account.json
```

Terraform grants the Lambda role read access to that path and never sees the value, so **no secret
is written into Terraform state**. The functions load them at start into `process.env`, which means
the same file still runs with plain environment variables where a parameter is absent.

A Lambda environment variable set by Terraform would fail twice over: `GetFunctionConfiguration`
returns environment variables in plaintext, and the value would live in the state file.

## What does it create?

- A private S3 bucket, versioned, reachable only through CloudFront by Origin
  Access Control. No public bucket policy and no website endpoint.
- A CloudFront distribution with three cache behaviours: hashed assets cached
  hard, HTML revalidated, and `/data/*` uncached so the daily writes appear.
- Three Node 22 Lambdas zipped straight from `../lambda`, with the production
  timeouts and memory, on EventBridge schedules.
- A role for GitHub Actions, assumed by OIDC. **No access keys are created.**

## Where does the state live?

In S3, versioned and encrypted. **The bucket name is not in this repository**: it identifies an AWS
account, and backend settings are environment-specific anyway, so they are supplied at init time
from a gitignored `backend.hcl`. Copy `backend.hcl.example`, fill it in, then:

```
terraform init -reconfigure -backend-config=backend.hcl
```

**The bucket is created once, by hand, and that is not laziness.** Terraform needs its backend
before it can create anything, so a backend bucket cannot be created by the configuration that uses
it. Every project has this ordering problem; the honest options are a one-off command or a separate
bootstrap configuration with its own local state, and for one bucket that never changes the command
is the smaller thing to maintain.

```
B=your-tfstate-bucket-name
aws s3api create-bucket --bucket $B --region us-east-1
aws s3api put-public-access-block --bucket $B --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-versioning --bucket $B --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket $B --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

**The bucket is private.** State is not a build artefact, it is closer to a credential: it records
every resource and, for many providers, secrets in plaintext. Versioning is there so a bad apply is
recoverable, and `use_lockfile` stops two applies running at once. That is S3-native locking, which
replaced the DynamoDB table that older examples still show.

## How do I run it?

```
cp terraform.tfvars.example terraform.tfvars   # only google_place_id is needed
terraform init
terraform plan                                  # read this before applying
terraform apply
```

`terraform output` then prints the demo URL and the three values to set as
repository variables in GitHub: `AWS_ROLE_ARN`, `AWS_S3_BUCKET`,
`AWS_CLOUDFRONT_DISTRIBUTION_ID`. Until those are set the deploy workflow skips
itself rather than failing.

## What does it not do?

- No custom domain. The distribution serves its `cloudfront.net` name, which is
  all a demo needs and avoids a hosted zone and a certificate.
- The demo Lambdas read the same Google profile as production. That is a
  read-only call; they write only to the demo bucket.
- The SSM helper is duplicated in all three functions rather than shared,
  because each one must stay a single file that can be pasted into the console
  while production is still deployed that way.
- `terraform destroy` leaves the CloudWatch log groups' retained logs until they
  age out.

## Roughly what does it cost?

Pennies a month. Three Lambda runs a day is well inside the free tier, scheduled EventBridge rules
are free, S3 storage is negligible, and CloudFront covers 1 TB a month free for the first year. The
one thing to watch is that a distribution takes several minutes to create, and the same to destroy.
