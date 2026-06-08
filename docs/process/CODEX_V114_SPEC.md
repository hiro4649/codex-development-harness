# Codex Harness v1.1.4 Spec

CODEX_QUALITY_HARNESS_FILE v1.1.4

## Theme

Loop Kernel and Deterministic Guardrails.

## Goals

- Add a compact loop kernel for preflight, implementation, validation, triage, repair scope, and closeout loops.
- Add deterministic guardrail registry entries for forbidden operations.
- Require loop exit criteria before merge readiness can be claimed.
- Emit safe loop budget, handoff, no-speculative-repair, and terminal closeout artifacts.
- Preserve the v1.1.3 safety and token economy profile by reference.

## Non-Goals

- No target rollout or target repo mutation.
- No product, runtime, package, lockfile, workflow, deployment, or readiness work.
- No v1.1.5, 8-session default, dynamic multi-agent default, raw logs, self approval, or GitHub approval review.

## Loop Types

- `preflight_loop`
- `implementation_loop`
- `local_validation_loop`
- `remote_validation_loop`
- `failure_triage_loop`
- `repair_scope_loop`
- `closeout_loop`

## Required Loop Artifacts

- `.codex/loop-state.safe.json`
- `.codex/loop-exit.safe.json`
- `.codex/loop-budget.safe.json`
- `.codex/loop-guardrail.safe.json`
- `.codex/loop-next-action.safe.json`
- `.codex/loop-handoff.safe.json`
- `.codex/no-speculative-repair.safe.json`
- `.codex/loop-terminal-closeout.safe.json`

Artifacts are safe JSON only and must not include raw logs, raw command transcripts, secret values, private paths, or expanded full gate JSON.

## Hook Guardrail Registry

The registry blocks raw log commands, secret reads, wallet/RPC/deploy access, package or workflow scope violations, runtime scope violations, 8-session operation, broad delete, unscoped rerun, self approval, self merge, and GitHub approval review.

## Token Budget

Operator-visible statuses stay at or below 10. Top reason codes stay at or below 3. Pass statuses are count-only. Completed target details are not reprinted. Long forbidden lists are referenced by profile ID.

## No Speculative Repair

Unknown failure, timeout, safe-detail-unavailable, or same-head required-check failure forbids product repair. Quality-gate pass alone does not allow merge. Merge requires same-head required checks and owner merge instruction.

## Self-Test Requirements

`scripts/codex-v114-self-test.mjs` must prove loop state, exit criteria, no speculative repair, guardrails, token budget, handoff, terminal closeout, and source-only non-goals. `scripts/codex-v113-self-test.mjs` remains a compatibility check.

## Target Rollout

Target rollout is forbidden until a separate owner instruction authorizes a target-specific v1.1.4 rollout.
