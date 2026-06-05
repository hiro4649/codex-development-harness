<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Baseline Health Policy

v0.9.0 baseline health keeps product-relevant verification from being hidden by
diagnostic-only npm summaries or `CODEX_SKIP_NPM`. Harness-only work may report
baseline health as not applicable, but product-relevant changes require a fresh
baseline path and must keep candidate failures separated from baseline failures.

The gate is deterministic, safe-summary only, and does not execute product
commands. It reads existing classification, baseline, and diagnostic statuses.
