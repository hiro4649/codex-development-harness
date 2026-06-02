CODEX_QUALITY_HARNESS_FILE v1.0.4

# Codex Classification Registry Policy

Changed files must be classified by a registry-backed rule before a pull request
can be considered safe. Unknown paths do not pass silently in PR context.

The registry distinguishes harness-managed scripts from product runtime
entrypoints. `scripts/codex-*` is harness-managed. Runtime or dev server
entrypoints under `scripts/` must be listed explicitly.
