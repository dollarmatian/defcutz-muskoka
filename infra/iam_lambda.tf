data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.name_prefix}-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "lambda" {
  # Write only the data prefix of the demo bucket. Nothing else.
  statement {
    sid       = "DemoBucketDataObjects"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.site.arn}/data/*"]
  }

  # ListBucket is required even though nothing lists. Without it S3 answers a
  # request for a missing object with AccessDenied instead of 404, and the
  # "no file yet, start fresh" path fails on the very first run with an error
  # that looks like a permissions problem but is not one.
  statement {
    sid       = "DemoBucketListForMissingObjects"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.site.arn]
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["data/*"]
    }
  }

  statement {
    sid       = "InvalidateOwnDistribution"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.site.arn]
  }

  # Read only this stack's own secrets, and only read them.
  statement {
    sid       = "ReadOwnSecrets"
    actions   = ["ssm:GetParameter", "ssm:GetParameters"]
    resources = ["arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${local.secrets_prefix}/*"]
  }

  # SecureString parameters are encrypted with the account's default SSM key,
  # so reading them needs Decrypt on that key as well as GetParameter.
  statement {
    sid       = "DecryptOwnSecrets"
    actions   = ["kms:Decrypt"]
    resources = ["arn:aws:kms:${var.aws_region}:${data.aws_caller_identity.current.account_id}:alias/aws/ssm"]
  }

  # The guarantee, made explicit rather than implied by naming. An explicit Deny
  # cannot be overridden by any Allow, so even a wrong bucket name in an
  # environment variable cannot reach the live site.
  statement {
    sid     = "NeverTouchTheLiveSite"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      "arn:aws:s3:::${var.live_bucket_name}",
      "arn:aws:s3:::${var.live_bucket_name}/*",
    ]
  }
}

resource "aws_iam_role_policy" "lambda" {
  name   = "${var.name_prefix}-lambda"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda.json
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
