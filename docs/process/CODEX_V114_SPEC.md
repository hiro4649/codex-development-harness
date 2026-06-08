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

## Pro Final Specification Absorption

v1.1.4 finalizes these compact contracts without expanding normal operator output:

- Decision Core: one authoritative safe decision object carries `decision`, `loop`, `primaryClass`, `mergeAllowed`, `repairAllowedInCurrentScope`, `ownerDecisionRequired`, `safeNextAction`, and `artifactPointer`. Supporting artifacts cannot override it.
- Minimal Blockers Single Entry: `codex-minimal-blockers.safe.json` is the first-read failure artifact and contains only primary blocker, blocking gate, reason code, scope, minimal fix, commit/body-only flags, and artifact pointer.
- Status Surface Tiering: statuses are `critical_now`, `evidence_critical`, or `compatibility_shadow`; compatibility shadow and pass statuses are count-only by default.
- Rendered Output Boundary: PR body is rendered output only, not source of truth, and cannot override safe artifacts. PR body failures are rendered-output failures, not product failures.
- Remote Evidence State Machine: remote npm evidence records required/executed/artifact-present/result/normalized plus one blocking reason: not required, execution missing, artifact missing, normalization mismatch, npm failed, or npm timeout.
- Verification Dependency Graph: changed-file-aware tiers avoid redundant full replay; safe validation cache is allowed by head/input hash but never as merge authority.
- Forbidden Scope Set IDs: long forbidden lists are referenced by profile IDs such as `CRIPTO_TIP_CORE_BOUNDARY_V1`, `VGC_SAFE_NO_DEPLOY_CONTRACT_V1`, `FUNKY_D8_SAFE_DB_EXPORT_BOUNDARY_V1`, `LIVE2D_SAFE_BOUNDARY_V1`, `IRIS_PRIORITY1_NO_PRODUCTION_GO_V1`, and `VOXWEAVE_NO_RUNTIME_TTS_READINESS_V1`.
- Readiness Claim Classifier: affirmative readiness claims are forbidden; negative boundary, owner pending, test reason vocabulary, and manual review items are allowed.
- Manual Gate Typed Receipt: owner values are not deploy approval. Deploy approval requires a typed receipt.
- Real Evidence Boundary: fixture, local, remote, or merge pass cannot clear priority1 or production go. Real resident evidence plus owner scope is required.
- Target Process Guard: target harness must not mutate caller branch. External workspace process, orphan child process, and unclassified timeout are hard failures.
- Inventory Closeout Loop: inventory is classified as active blocker, close candidate, freeze candidate, preserve reference, fresh rebuild candidate, or separate owner scope. Duplicate target/blocker/evidence/next-action blocks a new PR.
- Token Cost Ledger: token economy is quality. Track visible lines, safe summary bytes, artifacts read, duplicate reason/boundary text, PR body bytes, repeated validation commands, tool output bytes, read tokens, and avoidable waste.
- Final Report Compact Contract: default final report is 12 lines; release terminal report max is 25 lines. `safeNextAction` and `primaryClass` are exactly one, secondary reasons max two, artifact pointers max five, completed target details are not reprinted, and full JSON stdout is forbidden.

Explicit invariants: quality-gate pass alone does not imply merge-ready; same-head required check failure blocks merge; unknown failure, timeout, and safe-detail-unavailable forbid product repair; formal same-head evidence overrides stale temporary diagnostics; missing safe artifact remains a hard blocker.
