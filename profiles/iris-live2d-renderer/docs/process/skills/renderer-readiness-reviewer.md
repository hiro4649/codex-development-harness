<!-- CODEX_QUALITY_HARNESS_FILE v0.6.8 -->
# Skill: Renderer Readiness Reviewer

Use for Live2D renderer readiness, status, health, cue, and model changes.

Check:

- renderer_ready=true is not allowed from mock health, fixture, cue-only, or local bridge evidence.
- Real SDK load and model3 load are required.
- model_id and scene_id match the expected runtime context.
- Browser heartbeat freshness is checked.
- Last cue application succeeded.
- Raw cue payload, endpoint values, raw model paths, and secrets are not emitted.
