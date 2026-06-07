<!-- CODEX_QUALITY_HARNESS_FILE v1.1.2 -->

# Codex Harness v1.1.2 Spec

## Theme

Conversation Surface Minimization and Evidence Fidelity.

## Contract

Full evidence stays in files and safe artifacts. Machine decisions use compact
JSON. Human conversation receives Pro Summary Compact only unless explicit
detail mode is requested.

## Required Behaviors

- Quality gate full JSON is file-only by default.
- Large JSON is not printed to stdout and is not piped through tee.
- Safe summaries include status, quality score, required check status, top
  blocking/manual reason codes, readiness flags, and artifact pointer.
- Pass statuses are counted, not listed.
- Fail, warning, manual, unknown, and missing statuses are listed only up to the
  top-N cap.
- Target rollout state is represented by a compact capsule.
- Safety profiles are referenced by shortcode in conversation and expanded only
  in docs or artifacts.

## Non-Goals

- No product implementation.
- No target rollout during source body development.
- No runtime readiness claim.
- No production readiness claim.
- No wallet, RPC, deploy, raw logs, or 8-session operation.
