<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Target Hotfix Regression Policy

Requires target patch manifest entries and target-specific workflow safeguards to survive later harness rollouts unless explicit migration evidence is present.

This policy is a source harness gate contract only. It adds no external dependency, no product command execution, no browser requirement for all PRs, no target rollout, and no runtime readiness claim. Evidence must stay compact and safe-summary-only.
