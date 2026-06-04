<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Game Tool Adapter Fixture Readiness Policy

Game Tool Adapter readiness is fixture-only in v0.9.9. It does not implement runtime handoff.

Fail fixtures:
- candidate direct Adapter handoff
- missing approved action evidence
- raw world command exposure
- endpoint or token exposure
- stale observation candidate
- fixture pass treated as real ready
