# Codex Handover Snapshot Policy

CODEX_QUALITY_HARNESS_FILE v1.0.5

Handover snapshots let a future Codex resume safely after context loss. They
must include source version, main heads, remote gates, target repos, open and
blocked PRs, protected state, readiness claims, raw log/diff read status, next
safe action, forbidden scopes, and policy state.
