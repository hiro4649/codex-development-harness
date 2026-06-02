<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# Motion Allowlist Sync Policy

Prevents future or unsupported motion labels from being treated as runtime executable, and requires runtime allowlist mismatch to safe-reject.

This policy is a source harness gate contract only. It adds no external dependency, no product command execution, no browser requirement for all PRs, no target rollout, and no runtime readiness claim. Evidence must stay compact and safe-summary-only.
