variable "aws_region" {
  description = "Region for every resource in this stack."
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefix on every resource name, so demo resources are obvious in the console."
  type        = string
  default     = "defcutz-demo"
}

variable "live_bucket_name" {
  description = <<-EOT
    The bucket serving the LIVE site. Nothing here writes to it. It is named
    only so that both IAM policies can carry an explicit Deny against it, which
    turns "the demo is separate" from a naming convention into something the
    account enforces.
  EOT
  type        = string
  default     = "defcutzmuskoka.com"
}

variable "github_repo" {
  description = "owner/name of the repository allowed to assume the deploy role."
  type        = string
  default     = "dollarmatian/defcutz-muskoka"
}

variable "create_github_oidc_provider" {
  description = "False if the account already has the GitHub OIDC provider; an account may only have one."
  type        = bool
  default     = true
}

variable "secrets_prefix" {
  description = <<-EOT
    SSM Parameter Store path holding the Google credentials. Terraform grants
    read access to this path and never sees the values, so no secret is written
    into Terraform state. Create them once, out of band:

      aws ssm put-parameter --type SecureString \
        --name /defcutz-demo/google-credentials \
        --value file://service-account.json
  EOT
  type        = string
  default     = null
}

variable "google_place_id" {
  description = "Google Place ID to fetch hours, reviews and photos for."
  type        = string
  default     = ""
}

variable "schedule_expression" {
  description = "How often the demo functions run. Daily matches production."
  type        = string
  default     = "rate(1 day)"
}
