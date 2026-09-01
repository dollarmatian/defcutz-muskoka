# A suffix, because S3 bucket names are globally unique and a demo stack should
# be creatable more than once without a naming argument.
resource "random_id" "suffix" {
  byte_length = 3
}

locals {
  secrets_prefix = coalesce(var.secrets_prefix, "/${var.name_prefix}")

  bucket_name = "${var.name_prefix}-site-${random_id.suffix.hex}"

  functions = {
    "fetch-hours" = {
      source      = "fetch-hours.mjs"
      timeout     = 30
      memory      = 128
      data_key    = "data/hours.json"
      description = "Writes opening hours to the demo bucket, once a day."
    }
    "fetch-reviews" = {
      source      = "fetch-reviews.mjs"
      timeout     = 30
      memory      = 128
      data_key    = "data/reviews.json"
      description = "Merges reviews into the demo bucket, once a day."
    }
    "fetch-photos" = {
      source      = "fetch-photos.mjs"
      timeout     = 300 # downloads image binaries on first run
      memory      = 512
      data_key    = "data/photos.json"
      description = "Writes the photo manifest and images to the demo bucket, once a day."
    }
  }
}

data "aws_caller_identity" "current" {}
