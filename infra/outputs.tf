output "demo_url" {
  description = "The demo site. Open this once the first deploy has run."
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "bucket_name" {
  description = "Set as the AWS_S3_BUCKET repository variable in GitHub."
  value       = aws_s3_bucket.site.bucket
}

output "cloudfront_distribution_id" {
  description = "Set as the AWS_CLOUDFRONT_DISTRIBUTION_ID repository variable in GitHub."
  value       = aws_cloudfront_distribution.site.id
}

output "github_deploy_role_arn" {
  description = "Set as the AWS_ROLE_ARN repository variable in GitHub."
  value       = aws_iam_role.github_deploy.arn
}

output "lambda_function_names" {
  description = "Invoke one manually with: aws lambda invoke --function-name <name> /dev/stdout"
  value       = [for f in aws_lambda_function.function : f.function_name]
}
