<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Codex Fast Path Policy

Fast path is allowed only for classified harness-only or docs-only changes with no product relevance, package or lockfile change, runtime readiness claim, performance claim, unsafe output, stale evidence, unknown files, or source/target coupling violation.

Fast path still requires secret scan, safe output scan, AGENTS context, change classification, evidence integrity, current-head evidence when PR context requires it, human confirmation when R3 requires it, self-tests, and the appropriate source or target score.

Product, package, release, security, runtime readiness, performance, or unknown-risk work must use full verification.
