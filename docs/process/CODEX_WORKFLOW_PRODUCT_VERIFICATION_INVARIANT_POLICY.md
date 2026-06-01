<!-- CODEX_QUALITY_HARNESS_FILE v1.0.3 -->
# Workflow Product Verification Invariant Policy

Locks target workflow product verification context, remote product baseline, npm diagnostic evidence, and safe artifact upload paths so rollout sync cannot silently remove them.

This policy is a source harness gate contract only. It adds no external dependency, no product command execution, no browser requirement for all PRs, no target rollout, and no runtime readiness claim. Evidence must stay compact and safe-summary-only.
