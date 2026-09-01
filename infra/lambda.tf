# Each function is a single file. The Node 20 runtime provides the AWS SDK, so
# there is nothing to bundle and the zip is the source file renamed.
data "archive_file" "function" {
  for_each = local.functions

  type        = "zip"
  output_path = "${path.module}/.build/${each.key}.zip"

  source {
    content  = file("${path.module}/../lambda/${each.value.source}")
    filename = "index.mjs"
  }
}

resource "aws_lambda_function" "function" {
  for_each = local.functions

  function_name    = "${var.name_prefix}-${each.key}"
  description      = each.value.description
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  timeout          = each.value.timeout
  memory_size      = each.value.memory
  filename         = data.archive_file.function[each.key].output_path
  source_code_hash = data.archive_file.function[each.key].output_base64sha256

  environment {
    variables = {
      SECRETS_PREFIX             = local.secrets_prefix
      GOOGLE_PLACE_ID            = var.google_place_id
      S3_BUCKET                  = aws_s3_bucket.site.bucket
      S3_KEY                     = each.value.data_key
      CLOUDFRONT_DISTRIBUTION_ID = aws_cloudfront_distribution.site.id
    }
  }
}

resource "aws_cloudwatch_log_group" "function" {
  for_each = local.functions

  name              = "/aws/lambda/${var.name_prefix}-${each.key}"
  retention_in_days = 14 # a demo does not need logs kept forever
}
