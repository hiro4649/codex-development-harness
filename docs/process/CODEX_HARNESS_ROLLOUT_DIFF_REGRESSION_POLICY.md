<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Harness Rollout Diff Regression Policy

Classifies rollout diffs that remove product verification steps, artifact uploads, active self-test mapping, or target patch manifest content as blocking.

This policy is a source harness gate contract only. It adds no external dependency, no product command execution, no browser requirement for all PRs, no target rollout, and no runtime readiness claim. Evidence must stay compact and safe-summary-only.
