<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Game Tool Adapter Contract Fixture Policy

Game/Tool Adapter fixtures must reject candidate direct handoff, raw world commands, endpoint or token leaks, stale observations, and fixture-as-real readiness.

This policy is a source harness gate contract only. It adds no external dependency, no product command execution, no browser requirement for all PRs, no target rollout, and no runtime readiness claim. Evidence must stay compact and safe-summary-only.
