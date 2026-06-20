# Codex HARNESS v1.2.8 Spec

<!-- CODEX_QUALITY_HARNESS_BEGIN -->
CODEX_QUALITY_HARNESS_FILE v1.2.8

## Name

Source HARNESS v1.2.8: Deterministic Decision Projection and Token-Minimal Loop
Closure.

## Supersedes

This file is the only active v1.2.8 specification. Any earlier draft that
redefined `codex-decision-capsule.safe.json` as a Projection is non-authority
archive material. Active v1.2.8 readers must hard-fail if the active surface
contains the phrase `Decision Capsule is Projection`.

## Scope

v1.2.8 is a Source HARNESS body release. It is a compression and loop-closure
release, not an authority expansion. It preserves:

- v1.1.8 Final Decision as final pass/block/mergeAllowed/exit-code authority
- v1.1.9 three P0 safe artifacts and operator-visible status surface
- v1.2.0 through v1.2.7 routing, calibration, context, closure, autonomy,
  worktree, observed-state, receipt continuation, same-head, validation reuse,
  and token-budget contracts

v1.2.8 must not add new P0 artifacts, top-level statuses, new Skills, target
rollout, product/package/runtime/workflow changes, raw-log or raw-transcript
mining, bridge/tunnel default-on behavior, AI owner authority, AI-only merge,
self approval, GitHub approval review, deploy/wallet/RPC/secret automation,
same-head remote gate bypass, or readiness/legal/YouTube compliance claims.

## Authority Model

The authority model is unchanged:

- `codex-decision-capsule.safe.json`: domain decision authority
- `codex-evidence-capsule.safe.json`: same-head and freshness authority
- `codex-final-decision.safe.json`: final pass/block/mergeAllowed/exit-code
  authority
- `codex-quality-gate-safe-summary.json`: non-authoritative stored Projection

The stored Projection never creates merge authority, owner authority, permission
authority, provider closure, or Final Decision input authority.

## P0 Internal Blocks

v1.2.8 adds only internal fields inside the existing v1.1.9 P0 artifacts.

### 1. Deterministic Decision Projection

The Safe Summary may carry a small stored Projection for routine reading. It
must remain non-authoritative and must be derived from existing authoritative
artifacts.

The flow is three-stage:

1. stored Projection: small, persisted, non-authoritative, provider-closure
   facts only when already observed.
2. ephemeral attested view: pure deterministic derivation from stored
   Projection, current provider snapshot, current receipt, and current policy.
3. merge-boundary Final Decision: authoritative recompute from current
   provider state, receipt, head, scope, and required checks.

The Artifact Dependency DAG must stay acyclic:

```text
Decision Capsule / Evidence Capsule / Orchestration Capsule /
Artifact Consistency core / required checks / owner receipt
  -> Final Decision
  -> stored Projection
  -> ephemeral attested view
```

Final Decision must not read the stored Projection as an authority input.

### 2. Orthogonal Reason Model

Reason `state` is an observed fact. Reason `effect` is phase-derived.

```json
{
  "reasonCode": "required_check_pending",
  "state": "pending",
  "evidenceRef": "provider.requiredChecks"
}
```

For example:

```text
pushed_waiting_remote -> effect=awaiting
merge_boundary        -> effect=blocking
```

`awaiting` and `blocking` must not be used as reason states. Unknown reason
codes fail closed.

### 3. Token-Minimal Read and Compatibility Router

Routine mode is one small read surface:

```text
routine selected skill <= 1
mandatory safety typed trigger selected skill <= 2
routine managed safe artifact read = 1
routine cold artifact read = 0
diagnostic cold artifact read <= 3
routine Projection <= 1600 bytes
stress Projection <= 2048 bytes
per-transition managed context <= 4096 bytes
routine final report <= 8 lines
routine owner interrupt = 0
repeated safety text = 0
```

The 4096 byte budget is per decision transition, not the cumulative task total.
The cumulative task bytes, repeated context bytes, and transitions-per-task are
telemetry.

Root AGENTS, applicable nested AGENTS, and the active profile are compiled into
one deterministic model-facing instruction capsule. The compilation must not
use LLM summarization. All source fragment digests are retained, conflicts hard
fail, and forbidden boundaries cannot be removed or weakened.

Profile preservation uses inheritance:

```text
v127_common_safety_floor
  -> v127_source_baseline
  -> v127_full_target_baseline
  -> v127_restricted_token_target_baseline
  -> repo-specific delta
```

### 4. Resumable Loop and Permission Projection

Projection cannot create permission. Permission view is derived from the
current hydrated receipt.

```json
{
  "receiptHydrationState": "valid",
  "receiptDigest": "sha256:...",
  "taskId": "...",
  "repositoryKey": "...",
  "branchConstraint": "...",
  "scopeContractDigest": "sha256:...",
  "ownerInstructionDigest": "sha256:..."
}
```

The receipt expires on new owner instruction, scope delta, repository change,
branch violation, receipt revoke, or taskId change.

Same-session routine may read one managed safe artifact only when the current
receipt is already hydrated. Cross-session or another-thread resume is a
diagnostic profile and must revalidate receipt and Orchestration Capsule.

Checkpoint is non-authoritative resume assistance. It must bind at least:

```text
headOid
scopeContractDigest
processReceiptDigest
lastVerifiedEvidenceDigest
workerId
worktreeId
checkpointSequence
previousCheckpointDigest
```

Checkpoint write requires per-worktree exclusive lock, current checkpoint
reread, sequence/digest recheck, atomic replacement, previous checkpoint
preservation, gitignore coverage, and upload prohibition. Network-filesystem
automatic resume is forbidden.

## Canonical JSON

Machine contracts use strict JSON parsing, duplicate-key rejection, RFC 8785
canonicalization, SHA-256 digests, UTF-8 byte measurement, digest verification
before default materialization, and fail-closed unknown reason handling.

## Migration

Reader-before-writer migration is mandatory:

```text
candidate:
  v127 writer
  v127 reader authoritative
  v128 reader shadow

activation preparation:
  v127 / v128 dual-reader first

activation:
  switch writer to v128

rollback:
  switch writer back to v127
  keep dual-reader
```

## Activation Boundary

Specification PR is allowed. Source Shadow Candidate is conditional on the
v128 self-test, Preservation Matrix, replay corpus, and active v1.2.7 gate
impact remaining clean. Source Activation, active target canary, and portfolio
rollout are not part of this Source body PR unless separately instructed.

<!-- CODEX_QUALITY_HARNESS_END -->
