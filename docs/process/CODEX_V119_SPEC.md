# Codex Harness v1.1.9 Spec

<!-- CODEX_QUALITY_HARNESS_FILE v1.1.9 -->

## Purpose

v1.1.9 introduces Maintainer Orchestration Lite and Worker Proof Contract.
It adds the smallest useful orchestration layer above v1.1.8 for permission
clarity, local repo readiness, worker scope, proof/review readiness, owner
decision readiness, and token-thin reporting.

v1.1.9 is preparatory evidence only. v1.1.8 Final Decision remains the final
pass/block/mergeAllowed/process-exit authority.

## Hard Scope

- Source HARNESS body only.
- No target rollout.
- No target repo changes.
- No product/runtime/package/lockfile changes.
- No deploy, release, wallet, RPC, BscScan, funded transaction, governance
  transaction, production visibility, secret access, runtime readiness, or
  production readiness claim.

## P0 Contract

P0 is closed and consists of exactly three safe artifacts:

1. `codex-orchestration-capsule.safe.json`
2. `codex-worker-proof.safe.json`
3. `codex-owner-decision-brief.safe.json`

Do not add a fourth P0 artifact. Do not split permission, local readiness,
worker contract, live proof, review chain, heartbeat, triage card, restricted
asset profile, memory, self-harness proposal, or public model identifier gate
into separate P0 producers.

"New safe artifact producer" means a new dedicated script whose primary
purpose is generating one of the three v1.1.9 P0 safe artifacts. Existing gate,
reader, and summary scripts may route, expose, or reference v1.1.9 artifacts
but must not become additional independent v1.1.9 producers.

## Final Authority

Operator display/read order:

1. `codex-orchestration-capsule.safe.json`
2. `codex-worker-proof.safe.json`
3. `codex-owner-decision-brief.safe.json`
4. pointer to `codex-final-decision.safe.json`

Exit-code authority: `codex-final-decision.safe.json` only.

A v1.1.9 pass cannot override a v1.1.8 block. Owner Decision Brief is not owner
approval. Worker Proof is not runtime readiness. Review Chain is not GitHub
approval review. Permission Grant cannot create release, wallet, RPC, deploy,
publish, BscScan, transaction, secret, or merge permission.

## Permission Model

Harness policy is a blocking and classification source, not mutation authority.
Repository policy may allow only read-only audit, triage, monitor, and safe
classification. It must not authorize commit, push, PR creation, CI rerun, CI
fix, merge, release, publish, wallet/RPC/deploy, secret access, funded
transaction, governance transaction, or BscScan verification.

`owner_prior_scope` may authorize only explicitly scoped commit, push, createPr,
rerunCi, and fixCi. It must include `scopeId`, `repo`, `allowedActions`,
`expiresAt`, `sourceInstructionRef`, and `headSha` or `branchConstraint`.

`owner_explicit_current_only` is required for merge, release, publish,
wallet/RPC/deploy access, secret access, funded transaction, governance
transaction, and BscScan verification.

Permission booleans must match their authority fields. For example, `merge:
true` with `mergePermissionAuthority: none` is invalid.

## Orchestration Capsule

`codex-orchestration-capsule.safe.json` contains:

- `permissionGrant`
- `localRepoReadiness`
- `workerContract`
- `lightHeartbeat`
- `orchestrationMode`
- `stateDelta`
- `evidenceBundle`
- `preserveExitCondition`
- `safeNextAction`

Local repo readiness blocks implementation, commit, push, PR creation, CI fix,
merge, and release when the worktree is dirty without preservation, the repo is
wrong, the branch is wrong for the task, pull `--ff-only` fails, the frozen IRIS
dirty-cascade branch is used, untracked/staged changes are unaccounted for, a
cross-repo mutation is attempted, or destructive recovery is attempted without
explicit owner scope.

Frozen IRIS branch rule:

```text
Do not use branch codex/iris-harness-validation-compat-preservation-20260612.
That branch is frozen unresolved dirty-cascade work.
Start from clean origin/main or a clean worktree.
```

Worker contracts must use minimal context, no full conversation history by
default, no unrelated repo history, no secrets, no raw logs, no raw diffs unless
explicitly required and safe, and no delegation by default. `contextBudgetTokens`
must not exceed 3000.

## Worker Proof

`codex-worker-proof.safe.json` contains:

- `proofRequirement`
- `testEvidence`
- `liveProof`
- `reviewChain`
- `missingProofReason`
- `waiverStatus`
- `safeNextAction`

Runtime-affecting work requires live proof before landing. Docs-only and
harness-metadata work do not require live proof. External providers require
live proof or explicit owner-scoped waiver. Wallet/RPC/deploy/token
transaction/BscScan/release live proof attempts require separate owner scope.
Mock, fixture, docs, route existence, CI, browser smoke, or remote pass are
supporting evidence only and must not be upgraded to runtime or production
readiness.

Self-review is advisory. Same-worker self-review cannot pass the review chain
alone. Implementation tasks require spec-compliance and code-quality review.
Reviewer comments do not grant owner approval. ChatGPT Pro technical review is
not GitHub approval review.

## Owner Decision Brief

`codex-owner-decision-brief.safe.json` contains owner-decision readiness only:

- what changed
- who benefits
- why owner decision is needed now
- proof completed
- proof missing
- residual risks
- recommendation
- exact choices
- next implementable slice
- safe next action

Limits:

- `proofCompleted`: max 8
- `proofMissing`: max 8
- `residualRisks`: max 5
- `exactChoices`: max 3
- `recommendation`: max 1

Owner may be asked only after permission check, local repo readiness, worker
contract, safe classification, validation status or reason-not-required, CI
status or needs-run classification, live proof status or missing reason, review
chain status, and exact safe choices are recorded.

## Token And Surface Limits

- `maxOperatorStatuses: 8`
- `maxOwnerChoices: 3`
- `maxChangedFilesListed: 50`
- `maxRisksListed: 5`
- `maxProofItemsListed: 8`
- `maxWorkerContextTokens: 3000`
- `passStatusDetail: count_only`
- `routineHeartbeatOutput: silent`

Default final reports must be delta-only. Routine polling is silent. Repeated
forbidden text is replaced with profile IDs and artifact pointers.

## P1 And P2 Constraints

P1 allowed implementation:

- Orchestrator State as machine-only field inside Orchestration Capsule.
- Heartbeat Ledger as machine-only field inside Orchestration Capsule.
- Token Delta Ledger as small machine-only field in the safe summary.

P1 fixture/spec only:

- Triage Card
- Public Model Identifier Gate
- Preserve/Resume Capsule
- Restricted Asset Repo Profile Adapter

`restricted_asset_repo_profile_adapter` is spec-only in v1.1.9: no runtime
reader, no gate status, no artifact generation, and no top-level operator
status. VGC-FUNKY-TOKEN may appear only as fixture/example.

P2 fixture/spec only:

- Self-Harness Proposal
- External Verifier Adapter
- Cross-Repo Portfolio Queue
- Release Gate Integration
- Memory Consultation
- External Tool Consent
- Full Multi-Worker Scheduler

P2 must not add scripts, artifacts, exit-code behavior, workflow changes,
target rollout behavior, self-application, or release automation.

## Operator Status Surface

v1.1.9 top-level operator statuses are fixed:

- `orchestrationModeStatus`
- `permissionGrantStatus`
- `localRepoReadinessStatus`
- `workerContractStatus`
- `workerProofStatus`
- `reviewChainStatus`
- `ownerDecisionBriefStatus`
- `finalDecisionPointerStatus`

Do not add top-level heartbeat, triage, public model identifier,
self-harness proposal, memory consultation, release gate, cross-repo portfolio,
or restricted asset repo profile statuses.

v1.1.8 compatibility statuses are not duplicated in the v1.1.9 operator
summary. Use `finalDecisionPointerStatus`.

Allowed v1.1.8 compatibility values are `pass`,
`not_required_with_reason`, `pointer_available`, and
`blocked_with_safe_reason`. `unknown` is not acceptable for load-bearing
compatibility fields.

## Validation

Source validation requires:

- syntax checks for changed `.mjs` files
- v113 through v119 self-tests
- local quality gate with safe summary
- `qualityScore: 100`
- exactly three v1.1.9 P0 safe artifacts
- v1.1.8 Final Decision pointer present
- target rollout remains `not_started`

No target rollout starts inside the v1.1.9 Source body scope.
