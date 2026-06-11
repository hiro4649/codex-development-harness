# Codex Harness v1.1.8 Spec

<!-- CODEX_QUALITY_HARNESS_FILE v1.1.8 -->

## Purpose

v1.1.8 introduces the Final Decision Kernel and Mode-Aware Evidence Contract.
It resolves the v1.1.7 ambiguity where PR creation, owner-decision merge,
main verification, and preserve-only audit paths could share artifacts but need
different terminal semantics.

The goal is not more surface area. The goal is a smaller final decision:
one terminal action, one authoritative evidence mode, one exit-code result, and
one safe next action.

## P0 Contract

### Final Decision Kernel

`codex-final-decision.safe.json` is the first machine-readable final decision
source for v1.1.8. It reconciles:

- execution mode
- terminal action
- Decision Capsule result
- Evidence Capsule freshness
- required check state
- artifact consistency state
- owner decision receipt state
- forbidden safety signals

The kernel must reject contradictions:

- `allowed` with `mergeAllowed: false`
- `mergeAllowed: true` while a true blocker remains
- same-head required checks missing for `merge_current_pr`
- PR body text attempting to satisfy remote evidence
- runtime, production, legal, deployment, raw-log, or 8-session claims without
  explicit scoped evidence

### Terminal Actions

`terminalAction` is required and must be one of:

- `create_pr_only`
- `merge_current_pr`
- `preserve_only`
- `investigate_only`
- `stop`

`create_pr_only` may pass with remote evidence marked `needs_run` and
`mergeAllowed: false`.

`merge_current_pr` requires same-head required checks, fresh evidence, owner
merge instruction, and no true blocker.

`preserve_only`, `investigate_only`, and `stop` must not imply merge readiness.

### Evidence Capsule

`codex-evidence-capsule.safe.json` records compact, mode-aware evidence
freshness:

- current head
- quality-gate run
- required check summary
- safe artifact id
- optional CI run id
- PR body evidence rejection

Evidence may be `needs_run` for create-PR-only paths, but not for merge paths.
If a CI run is not a separate required check, its state may be
`not_required_with_reason`.

### Artifact Contract

v1.1.8 load-bearing artifacts are:

- `codex-final-decision.safe.json`
- `codex-decision-capsule.safe.json`
- `codex-evidence-capsule.safe.json`
- `codex-artifact-consistency.safe.json`
- `codex-minimal-blockers.safe.json`
- `codex-quality-gate-safe-summary.json`

Local source-body gates may classify upload and download observation as
`not_required_with_reason`. Remote same-head closeout must observe uploaded and
downloaded load-bearing artifacts when the remote artifact package exists.

### Exit-Code Convergence

The workflow runner must derive process success from the final authoritative
safe decision. It must not fail after the final safe artifacts say pass, and it
must not pass if the final decision is blocked.

## Operator-Visible Status Budget

v1.1.8 keeps the operator-visible status surface to eight statuses:

- `finalDecisionStatus`
- `decisionCapsuleStatus`
- `evidenceCapsuleStatus`
- `artifactConsistencyStatus`
- `convergenceGateStatus`
- `safeFailureReaderStatus`
- `tokenBudgetStatus`
- `scopeBoundaryStatus`

Supporting diagnostics may exist inside safe artifacts, but must not expand the
default final report surface.

## Non-Goals

- No target rollout in the Source body task.
- No target repo edits.
- No product code edits.
- No package or lockfile edits.
- No broad workflow change.
- No runtime or production readiness claim.
- No raw logs.
- No 8-session operation.

## Validation

Source validation requires:

- syntax checks for changed `.mjs` files
- v113 through v118 self-tests
- local quality gate with safe summary
- `qualityScore: 100`
- v1.1.8 statuses pass
- target rollout remains `not_started`
