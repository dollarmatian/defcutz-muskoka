terraform {
  required_version = ">= 1.6"

  required_providers {
    aws     = { source = "hashicorp/aws", version = "~> 5.0" }
    archive = { source = "hashicorp/archive", version = "~> 2.4" }
    random  = { source = "hashicorp/random", version = "~> 3.6" }
  }

  # State lives in S3, versioned and encrypted, with locking.
  #
  # The bucket cannot be created by this configuration, because Terraform needs
  # the backend before it can create anything. That ordering problem is real and
  # every project has it: the bucket is made once, by hand, and infra/README.md
  # has the four commands.
  #
  # use_lockfile is S3-native locking, which replaced the separate DynamoDB
  # table that older examples still show.
  # Partial configuration: the bucket and key are supplied at init time from
  # backend.hcl, which is gitignored. Backend settings are environment-specific,
  # and a bucket name that embeds an account id has no business in a repository
  # that may be public. See backend.hcl.example.
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "defcutz-muskoka"
      Environment = "demo"
      ManagedBy   = "terraform"
    }
  }
}
