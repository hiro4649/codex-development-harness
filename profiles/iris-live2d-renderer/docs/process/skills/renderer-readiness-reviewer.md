<!-- CODEX_QUALITY_HARNESS_FILE v0.6.9 -->
# Skill: Renderer Readiness Reviewer

## title
Renderer Readiness Reviewer

## purpose
Prevent mock or partial Live2D renderer evidence from being treated as real renderer readiness.

## whenToUse
Use for Live2D renderer readiness, status, health, cue, and model changes.

## procedure

- renderer_ready=true is not allowed from mock health, fixture, cue-only, or local bridge evidence.
- Real SDK load and model3 load are required.
- model_id and scene_id match the expected runtime context.
- Browser heartbeat freshness is checked.
- Last cue application succeeded.

## pitfalls

- Mock health, fixture health, cue-only success, and local bridge success are not renderer_ready=true evidence.
- Raw cue payload, endpoint values, raw model paths, and secrets are not emitted.

## verification
Require safe summary evidence for Cubism SDK load, model3 load, model_id / scene_id match, cue capability, fresh browser heartbeat, and last cue applied success.

## safeOutput
Return only safe summaries, file names, check names, PASS/FAIL, and residual risks. Do not output raw cue payloads, endpoint values, raw model paths, secrets, or private paths.
