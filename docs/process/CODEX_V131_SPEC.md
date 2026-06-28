# HARNESS v1.3.1 Operational Convergence Core

`CODEX_QUALITY_HARNESS_FILE v1.3.1`

HARNESS v1.3.1 is an operational convergence release. It does not add model capability, product authority, runtime authority, target rollout authority, or merge authority. Its purpose is to make HARNESS v1.3.0 safer to operate across many repositories by preventing premise mistakes before they become PR, CI, or target-state confusion.

## Purpose

HARNESS v1.3.1 prevents:

- wrong repository or stale worktree use
- target profile drift or repo-name mixing
- manifest / AGENTS / active policy tuple divergence
- local pass being presented as remote pass
- GitHub Actions quota or billing lock being treated as code failure
- compatibility evidence being hidden as ordinary pass
- unreadably large operator output
- manual target install mistakes

## Non-Goals

v1.3.1 does not start:

- Performance Track
- Fable comparison
- SDK benchmark or 60-task benchmark
- Skill runtime
- DAG agent-team runtime
- automatic target mutation
- target rollout waves
- product/runtime/package/lockfile/deploy/wallet/RPC/secret changes
- v1.3.2 planning

## Activation Tuple

The Source harness tuple is:

```json
{
  "activeHarnessVersion": "1.3.1",
  "activeSelfTestSuite": "v131",
  "activeSelfTestStatusKey": "v131SelfTestStatus",
  "currentVersion": "1.3.1",
  "previousVersion": "1.3.0",
  "candidateActivationState": "active",
  "sourceActivation": "active",
  "targetRollout": "not_started",
  "finalAuthority": "v1.1.8_final_decision_kernel",
  "authorityCreated": false
}
```

Version authority:

- `v131=blocking_current_active_authority`
- `v130=immediate_rollback`
- `v129=immediate_rollback`
- `v128=blocking_compatibility`
- `v127=compatibility_readable`

## Backlog Order

v1.3.1 is intentionally ordered. The order is load-bearing:

1. Workspace Identity Gate
2. Manifest Strict Validator
3. Validation State Machine
4. Target Profile Drift Linter
5. Remote CI Cost Gate
6. Decision Capsule v2
7. Compatibility Debt Ledger
8. Target Profile Installer Dry Run
9. Product Value Return Gate advisory

Validation State Machine comes before Remote CI Cost Gate so `local_ready`, `remote_pending`, `blocked_ci_quota`, `merge_blocked`, and `merge_ready` have a stable place before cost control classifies remote evidence.

## Workspace Identity Gate

Workspace Identity Gate runs before quality-gate interpretation. It verifies that the current checkout is the expected repository and not a stale local copy. It checks remote URL, `AGENTS.md` marker, Source manifest tuple, docs manifest tuple, and self-test suite.

Mismatch is a hard stop before the quality gate can produce a misleading pass.

## Manifest Strict Validator

Manifest Strict Validator rejects duplicate JSON keys and tuple divergence across:

- `CODEX_SOURCE_HARNESS_MANIFEST.json`
- `docs/process/CODEX_HARNESS_MANIFEST.json`
- `docs/process/CODEX_ACTIVE_POLICY_INDEX.json`

It keeps `activeHarnessVersion`, `activeSelfTestSuite`, `activeSelfTestStatusKey`, `authorityCreated`, `PerformanceTrack`, and `superiorityClaimState` aligned.

## Validation State Machine

Validation State Machine separates local and remote evidence:

```json
{
  "localReadiness": "ready",
  "remoteValidation": "blocked_ci_quota",
  "mergeReadiness": "merge_blocked"
}
```

Local pass must never be promoted to remote pass. Remote pending or billing lock must never be promoted to pass.

## Target Profile Drift Linter

Target Profile Drift Linter detects wrong repository/profile combinations before target rollout or metadata repair work:

- `hiro4649/VGC-FUNKY-TOKEN` must remain `thin_target`.
- `hiro4649/VOXWEAVE` must remain `full_quality_gate_target`.
- `hiro4649/CRIPTO-TIP` must remain `product_heavy_target`.
- `hiro4649/disco-funky-repair`, `hiro4649/iris-live2d-renderer`, and `hiro4649/iris` remain `metadata_gate_target` unless a later explicit profile change is approved.

The linter does not mutate target repositories.

## Remote CI Cost Gate

When remote CI is unavailable:

```text
CODEX_REMOTE_CI_ALLOWED=false
```

Allowed:

- local checks
- commit
- push
- PR creation

Forbidden:

- workflow_dispatch
- Actions rerun
- treating unexecuted remote checks as pass
- setting merge readiness to true

The correct state is `remoteValidation=blocked_ci_quota` and `mergeReadiness=merge_blocked`.

## Decision Capsule v2

Decision Capsule v2 is the operator-readable summary. It is not a new authority. It is bounded to 50 display lines and includes only:

- active harness
- branch/head
- changed files summary
- local checks
- remote validation state
- merge readiness
- top blockers
- next safe action

Detailed JSON remains safe artifact data.

## Compatibility Debt Ledger

Compatibility debt must not be hidden as ordinary pass. Debt entries live under the Compatibility Adapter and require a review deadline:

```json
{
  "state": "pass_with_compatibility_debt",
  "reason": "legacy target gate shape preserved",
  "introducedIn": "1.3.0",
  "mustReviewBefore": "1.3.2",
  "affectsAuthority": false,
  "blocking": false
}
```

The first v1.3.1 implementation is visibility-focused. Debt is non-blocking unless a later scoped policy makes a specific expired debt blocking.

## Target Profile Installer Dry Run

The installer is dry-run only in v1.3.1. It may propose a target-safe file list, profile classification, and sensitive-scope warning, but it must not write target repositories.

It must fail the dry run if it would touch:

- product/runtime files
- package or lockfiles
- deploy workflow
- wallet/RPC/secret files
- contracts or token deployment files
- `CODEX_SOURCE_HARNESS_MANIFEST.json`

Its operator report must stay bounded. Changed file paths, reason codes, and Source manifest copy paths are display-truncated while exact counts and omitted counts remain available for safe diagnosis.

## Product Value Return Gate

Product Value Return Gate starts as advisory only:

```text
state=advisory
blocking=false
```

If harness/docs PRs continue for too long, it recommends returning to a product-value task. It must not block ordinary development.

## Acceptance Criteria

- `node scripts/codex-v131-self-test.mjs --stage=all` passes.
- Local quality gate recognizes `v131SelfTestStatus=pass`.
- `authorityCreated=false`.
- `targetMutationCount=0`.
- `PerformanceTrack=deferred`.
- `superiorityClaimState=not_proven`.
- No target repository changes.
- No product/runtime/package/lockfile/deploy/wallet/RPC/secret changes.
- No workflow dispatch or remote CI rerun is required for local evaluation.
