# Codex v085 Checkout Diff Isolation Policy

CODEX_QUALITY_HARNESS_FILE v1.0.7

v085 self-test fixtures must consume fixture diff metadata only. Active checkout
product diff must remain visible to top-level product gates but must not leak
into harness-only fixture classification. Pending-after-push is not remote pass,
and targetMergeReady must remain false without same-head remote pass.
