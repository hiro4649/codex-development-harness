# Codex Source Target Manifest Boundary Policy

CODEX_QUALITY_HARNESS_FILE v1.0.6

Keep the source manifest and target manifest separate. Target rollout must not
copy CODEX_SOURCE_HARNESS_MANIFEST.json into target repositories, and target
local gates must not fail merely because the source-only manifest is absent.
