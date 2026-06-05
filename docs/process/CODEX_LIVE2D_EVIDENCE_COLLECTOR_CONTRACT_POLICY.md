<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Live2D Evidence Collector Contract Policy

Requires Live2D evidence collectors to emit same-head safe summaries without raw cue, raw motion command, raw model path, or fixture-as-real readiness claims.

This policy is a source harness gate contract only. It adds no external dependency, no product command execution, no browser requirement for all PRs, no target rollout, and no runtime readiness claim. Evidence must stay compact and safe-summary-only.
