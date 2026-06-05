<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Change Classification Policy

Every PR should be classified before product verification is interpreted.

Classifications:
- harness-only
- docs-only
- product source
- tests
- specs or authority
- package or lockfile
- workflow or config
- runtime assets
- runtime readiness claim
- performance claim
- unknown risk

In PR context, unknown risk blocks merge readiness until justified. In local non-PR context, no PR diff may be `not_applicable` with reason `no_pr_context`.
