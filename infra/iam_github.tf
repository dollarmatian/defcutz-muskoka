# GitHub Actions authenticates by OIDC and assumes this role. No access keys are
# created, so there is no long-lived credential to leak or rotate, and the trust
# policy names the one repository allowed to assume it.
resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_github_oidc_provider ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

locals {
  oidc_provider_arn = var.create_github_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # GitHub's subject claim carries the numeric owner and repository ids, so
    # the trust policy survives a rename. The names stay pinned; only the ids
    # are wild.
    #
    #   repo:owner@56766185/repo@1353519346:ref:refs/heads/main
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${split("/", var.github_repo)[0]}@*/${split("/", var.github_repo)[1]}@*:*"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "${var.name_prefix}-github-deploy"
  description        = "Assumed by GitHub Actions to deploy the demo site. Cannot reach the live site."
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid     = "SyncTheDemoSite"
    actions = ["s3:ListBucket", "s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = [
      aws_s3_bucket.site.arn,
      "${aws_s3_bucket.site.arn}/*",
    ]
  }

  statement {
    sid       = "InvalidateTheDemoDistribution"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.site.arn]
  }

  # The same explicit Deny as the Lambda role. The deploy credential is
  # incapable of writing to the live bucket, whatever the workflow tells it
  # to do, so a wrong bucket name in CI is a failed job rather than an incident.
  statement {
    sid     = "NeverTouchTheLiveSite"
    effect  = "Deny"
    actions = ["s3:*", "cloudfront:CreateInvalidation"]
    resources = [
      "arn:aws:s3:::${var.live_bucket_name}",
      "arn:aws:s3:::${var.live_bucket_name}/*",
    ]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "${var.name_prefix}-github-deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
