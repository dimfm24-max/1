locals {
  name_prefix               = "${var.project_slug}-prod"
  migration_secret_bindings = var.migration_secret_bindings
}

resource "yandex_serverless_container" "migration" {
  folder_id          = var.folder_id
  name               = "${local.name_prefix}-migration"
  memory             = var.api_memory_mb
  cores              = 1
  core_fraction      = 100
  execution_timeout  = "900s"
  service_account_id = var.migration_service_account

  runtime { type = "task" }
  connectivity { network_id = var.network_id }

  image {
    url         = "cr.yandex/${var.registry_id}/${var.backend_image_name}@${var.migration_image_digest}"
    command     = ["bun"]
    args        = ["scripts/deploy-database.ts"]
    environment = var.migration_environment
  }

  dynamic "secrets" {
    for_each = local.migration_secret_bindings
    content {
      environment_variable = secrets.key
      id                   = secrets.value.secret_id
      version_id           = secrets.value.version_id
      key                  = secrets.value.key
    }
  }

  log_options {
    log_group_id = var.logging_group_id
    min_level    = "INFO"
  }

  metadata_options {
    gce_http_endpoint    = 2
    aws_v1_http_endpoint = 2
  }
}
