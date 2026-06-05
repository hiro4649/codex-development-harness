<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Active Self-Test Registry Policy

Keeps the active harness version mapped to exactly one blocking self-test status, with legacy self-tests advisory unless their own execution fails.

This policy is a source harness gate contract only. It adds no external dependency, no product command execution, no browser requirement for all PRs, no target rollout, and no runtime readiness claim. Evidence must stay compact and safe-summary-only.
