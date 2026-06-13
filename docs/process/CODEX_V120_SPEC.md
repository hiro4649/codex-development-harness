# Codex Harness v1.2.0

Theme: Adaptive Intelligence Escalation and Review Pool.

v1.2.0 adds token-aware intelligence tier routing, adaptive reviewer pool
selection, typed blockers, escalation/de-escalation rules, escalation
hysteresis, and bounded high-tier repair planning on top of v1.1.9 Maintainer
Orchestration Lite.

v1.2.0 is adaptive routing policy only. It does not replace v1.1.8 Final
Decision Kernel, does not replace v1.1.9 orchestration, and does not create a
second final authority.

## Authority Hierarchy

1. v1.1.8 Final Decision Kernel remains final pass/block/mergeAllowed/exitCode
   authority.
2. v1.1.9 remains orchestration and worker proof authority.
3. v1.2.0 is adaptive intelligence routing and review-pool policy only.

Conflict precedence:

- If v1.2.0 adaptive routing conflicts with v1.1.9 orchestration, v1.1.9 wins.
- If v1.1.9 orchestration conflicts with v1.1.8 Final Decision, v1.1.8 wins.
- If any reviewer output conflicts with an owner-only boundary, the owner-only
  boundary wins.

## P0 Artifacts

v1.2.0 must extend only the existing v1.1.9 P0 artifacts:

1. `codex-orchestration-capsule.safe.json`
2. `codex-worker-proof.safe.json`
3. `codex-owner-decision-brief.safe.json`

v1.2.0 must not create a new P0 artifact such as
`codex-intelligence-router.safe.json`, `codex-review-pool.safe.json`, or
`codex-model-tier-ledger.safe.json`.

## Operator Status Compatibility

v1.2.0 preserves the v1.1.9 top-level operator-visible statuses:

- `orchestrationModeStatus`
- `permissionGrantStatus`
- `localRepoReadinessStatus`
- `workerContractStatus`
- `reviewChainStatus`
- `workerProofStatus`
- `ownerDecisionBriefStatus`
- `finalDecisionPointerStatus`

Do not replace `reviewChainStatus` with `adaptiveRoutingStatus`. Adaptive
routing must remain an internal field inside the existing v1.1.9 artifacts.

## Typed Blockers

Allowed `typedBlocker` values:

- `none`
- `repeated_failure`
- `unclear_root_cause`
- `reviewer_disagreement`
- `scope_boundary`
- `authority_boundary`
- `evidence_contradiction`
- `token_budget_exceeded`
- `validation_unavailable`
- `security_sensitive_ambiguity`
- `restricted_asset_ambiguity`
- `runtime_readiness_boundary`

Typed blockers connect worker proof, review chain, escalation reason, owner
decision brief, and safe next action without repeating long policy text.

## Model Tiers

Use generic tier names only:

- `low_cost_worker`
- `standard_worker`
- `specialist_reviewer`
- `highest_reasoning_reviewer`

Do not hardcode vendor names, public model names, preview aliases, leaked model
identifiers, private model identifiers, or synthetic names that look public.

Default to `low_cost_worker`. Escalate only on typed blockers. De-escalate when
the root cause, repair plan, allowed files, validation path, and next action are
bounded.

## Escalation Hysteresis

After `highest_reasoning_reviewer` is used, require one bounded successful
validation before de-escalation.

Do not re-escalate for the same `typedBlocker` unless new evidence appears.

If the same `typedBlocker` repeats after highest-tier review, stop and create
an owner decision brief.

If a high-tier repair plan was already produced, the low-cost worker should
execute it instead of asking the high-tier reviewer again.

## High-Tier Repair Plan

The highest reasoning reviewer diagnoses and produces a bounded repair plan. It
does not directly authorize merge, release, deploy, wallet/RPC, secret access,
production readiness, GitHub approval review, or owner approval.

`highTierRepairPlan` contains:

- `rootCauseClass`
- `typedBlocker`
- `allowedFiles`
- `exactRepairSteps` max 5
- `validationCommand`
- `stopCondition`
- `deEscalationTarget`

## Review Pool

Default reviewer count is 1. Default max is 2. Hard max is 3.

Reviewer independence rules:

- same worker output cannot satisfy independent review
- same repair loop cannot self-accept
- same agent self-review is advisory only
- reviewer receives bounded context packet, not full worker scratchpad
- reviewer uses safe artifacts and relevant changed-file excerpts only
- reviewer finding must include `primaryClass` or explicit `cannot_classify`
- reviewer cannot become GitHub approval review
- reviewer cannot become owner approval
- reviewer cannot claim readiness

## Merge Boundary

v1.2.0 may record `merge_current_pr` eligibility.

v1.2.0 must not execute merge unless an existing
`owner_delegated_current_only` contract explicitly permits execution in the
current task and v1.1.8 Final Decision permits it.

High-tier review, review-pool consensus, and adaptive routing cannot create
merge permission.

## Token Budget

- `maxWorkerContextTokens: 3000`
- `maxSpecialistContextTokens: 5000`
- `maxHighestReviewerContextTokens: 8000`
- `passStatusDetail: count_only`
- `routineProgressOutput: silent`

High-tier context must exclude full conversation history by default, raw logs,
raw secrets, raw endpoint values, raw private paths, unrelated repo history,
wallet/RPC values, owner values, long forbidden lists, and all prior PR history.

## Non-Goals

v1.2.0 does not add broad auto-merge, always-on scheduler behavior, memory
routing, external verifier adapter, release gate integration, full multi-worker
scheduler, self-harness auto-improvement, target rollout behavior, or release
automation.

## Domain Boundaries

Restricted asset repositories remain restricted. Adaptive escalation cannot
authorize deploy, funded transactions, governance transactions, BscScan
verification, release, readiness claims, wallet/RPC, secrets, or owner values
exposure.

IRIS and Live2D fixture, browser smoke, local test, remote gate, synthetic
evidence, and reviewer acceptance cannot become production readiness.

CRIPTO-TIP boundaries remain separated. Adaptive escalation cannot authorize
custody, exchange, token sale behavior, legal compliance, or YouTube policy
compliance.
