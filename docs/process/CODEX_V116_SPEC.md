# Codex Harness v1.1.6 Spec

<!-- CODEX_QUALITY_HARNESS_FILE v1.1.6 -->

## Theme

Decision Capsule, Evidence Precedence Kernel, and Token Hard Budget.

## Purpose

v1.1.6 makes `codex-decision-capsule.safe.json` the first machine decision
source. Decision Core v2, Minimal Blockers, Safe Artifact Index, remote state,
diagnostic summaries, env JSON, and PR bodies are supporting evidence only.

## Operator-Visible Statuses

- `decisionCapsuleStatus`
- `sameHeadStatus`
- `safeArtifactStatus`
- `scopeBoundaryStatus`
- `tokenBudgetStatus`
- `validationTierStatus`
- `continuationStatus`

Pass, legacy, shadow, and not-applicable details are count-only in normal
operator output.

## Evidence Precedence

Evidence precedence is fixed:

1. current-head path detail artifact
2. current-head safe artifact index
3. decision capsule
4. remote evidence state
5. diagnostic consolidated safe summary
6. env JSON summary
7. PR body

PR body is human-rendered summary only and cannot satisfy machine evidence,
remote checks, run IDs, artifact IDs, product verification, or merge readiness.
Stale path artifacts fail. Missing load-bearing safe artifacts fail. Local
evidence does not satisfy remote evidence. Raw logs and raw artifacts are never
read.

## Remote Evidence State v2

Remote evidence states are compact and safe:
`not_required`, `required_pending`, `executed_artifact_missing`,
`executed_diagnostic_missing`, `executed_failed`, `executed_pass_normalized`,
`stale_head`, `normalization_mismatch`, `safe_summary_missing`,
`decision_capsule_missing`, `artifact_index_missing`,
`artifact_upload_contract_failed`, `summary_picker_incompatible`,
`remote_metadata_only_blocked`, and `safe_detail_unavailable_terminal`.

`safe_detail_unavailable` must be subclassified when safe metadata allows it.

## Token Hard Budget

Default hard budgets:

- normal final <= 10 lines
- failure final <= 14 lines
- rollout final <= 20 lines
- PR body <= 6 KB
- safe artifact reads default 1, max 3
- operator-visible statuses max 7
- reason codes max 3
- repeated forbidden text count = 0
- pass status list printed = 0
- full JSON stdout = 0

Avoidable violations block with `token_budget_blocked`; harmless borderline
cases may warn.

## Failure Contract

Repair types are exactly one of: `body_only`, `artifact_index_refresh`,
`safe_summary_refresh`, `source_harness_repair`,
`target_workflow_artifact_contract`, `target_harness_refresh`,
`product_scope_required`, `external_confirmation_required`, `no_safe_route`,
or `terminal_block`.

The contract carries allowed files, forbidden files, commit/rerun requirements,
owner-scope requirement, and exactly one safe next action. The same failure
after one repair stops unless the owner authorizes a new scope.

## Boundaries

v1.1.6 preserves same-head required checks, raw-log prohibition, 8-session
prohibition, product/harness separation, wallet/RPC/deploy prohibition, and all
readiness/compliance non-claims. Quality-gate pass alone is not merge-ready.

Token-only unmanaged repositories do not require AGENTS, manifests, or local
harness files. VGC-FUNKY-TOKEN remains unmanaged unless the owner explicitly
authorizes onboarding.

## Non-Goals

No target rollout, product implementation, runtime integration, package or
lockfile change, workflow change, raw-log access, 8-session operation, or
readiness/compliance claim is introduced by the v1.1.6 source body.
