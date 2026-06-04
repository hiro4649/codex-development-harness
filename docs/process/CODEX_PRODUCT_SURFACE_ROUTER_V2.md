# Product Surface Router v2

CODEX_QUALITY_HARNESS_FILE v1.0.6

Status: productSurfaceRouterV2Status

Routing:

- contracts/** -> cwd contracts, commandClass contracts_npm_test
- apps/backend/** -> cwd apps/backend, commandClass backend_npm_test
- apps/frontend/** -> cwd apps/frontend, commandClass frontend_test_or_build
- apps/api/** -> cwd apps/api, commandClass api_npm_test
- apps/web/** -> cwd apps/web, commandClass web_build_or_test
- root product files -> cwd ., commandClass root_npm_test
- no package at target cwd -> command_scope_mismatch

Every route records commandClass, cwd, and packageScope metadata.
