# Codex HARNESS v1.2.8 Spec

<!-- CODEX_QUALITY_HARNESS_BEGIN -->
CODEX_QUALITY_HARNESS_FILE v1.2.8

## Name

Source HARNESS v1.2.8: Deterministic Decision Projection and Token-Minimal Loop
Closure.

## Supersedes

This file is the only normative v1.2.8 candidate specification. Any earlier
draft that redefined `codex-decision-capsule.safe.json` as a Projection is
non-authority archive material. v1.2.8 candidate readers must hard-fail if the
active surface contains the phrase `Decision Capsule is Projection`.

## Scope

v1.2.8 is a Source HARNESS body candidate release. In this PR it is a Source
Shadow Candidate, not Source Activation. Active authority remains v1.2.7 /
v127 until a separate activation PR proves the required shadow/canary evidence.
It is a compression and loop-closure release, not an authority expansion. It
preserves:

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

The authority model is unchanged. v1.2.8 candidate tooling must not replace the
active v1.2.7 writer, active v127 self-test suite, or Final Decision exit
behavior:

- `codex-decision-capsule.safe.json`: domain decision authority
- `codex-evidence-capsule.safe.json`: same-head and freshness authority
- `codex-final-decision.safe.json`: final pass/block/mergeAllowed/exit-code
  authority
- `codex-quality-gate-safe-summary.json`: non-authoritative stored Projection

The stored Projection never creates merge authority, owner authority, permission
authority, provider closure, or Final Decision input authority. Source
Activation requires observed projection bytes, replayed state matrix fixtures,
and active v1.2.7 gate impact of zero.

## P0 Internal Blocks

v1.2.8 adds only candidate internal fields inside the existing v1.1.9 P0
artifacts.

### 1. Deterministic Decision Projection

The Safe Summary may carry a small stored Projection for routine reading. It
must remain non-authoritative and must be derived from existing authoritative
artifacts. Placeholder bytes are not valid measurements: unobserved projection
size must be `null` with `projectionMeasurementSource=not_observed`.

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

Routine mode is one small read surface. A cold artifact read means the flow is
diagnostic or repair, not routine:

```text
routine selected skill <= 1
mandatory safety typed trigger selected skill <= 2
routine managed safe artifact read = 1
routine cold artifact read = 0
diagnostic cold artifact read <= 3
routine Projection <= 1600 bytes
stress Projection <= 2048 bytes
routine bounded Projection reader surface <= 1600 bytes
routine bounded Projection reader stdout <= 1600 bytes
routine bounded Projection reader rejects duplicate JSON keys
per-transition managed context <= 4096 bytes
routine final report <= 8 lines
routine owner interrupt = 0
repeated safety text = 0
```

The 4096 byte budget is per decision transition, not the cumulative task total.
The cumulative task bytes, repeated context bytes, and transitions-per-task are
telemetry. In Source Shadow Candidate mode, `scripts/codex-v128-managed-context-emitter.mjs`
measures a deterministic source managed-context capsule containing AGENTS,
profile, provider summary, attested view, and source digests. Projection bytes
must not be reused as managed context bytes. Source Activation remains blocked
until the remaining activation replay and target canary requirements are proven.

`scripts/codex-v128-projection-reader.mjs` is the Source Shadow Candidate
bounded reader for the stored Projection. It may parse the Safe Summary artifact
as machine input, but its model-facing output is limited to the
`routineDecisionProjection` surface and must stay within the routine Projection
reader budget. This proves the small routine read surface without using the
managed context bytes as a substitute. The reader CLI emits compact
canonical JSON, not pretty JSON, and fails closed if the actual emitted UTF-8
stdout would exceed the same routine reader budget. The reader uses strict JSON
parsing with duplicate-key rejection.

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

Validation execution is represented inside the existing
`codex-orchestration-capsule.safe.json`; v1.2.8 does not add a
`token-validation-state.safe.json` or any other new P0 artifact. The execution
contract is an observed profile DAG with an aggregate-only finalizer. A missing
runtime execution packet is `observationState=not_exercised` and may only pass
as partial Source Shadow Candidate evidence; it is not Activation evidence:

```text
validation node:
  executed at most once per run from executor registry observation
  executionCountSource=executor_registry
  dependency edges declared by dependsOn
  graph cycle / missing dependency / duplicate edge fail closed
  resultDigest binds the actual canonical typed payload, not node metadata

downstream gate:
  reads typed result
  must not respawn the upstream command

missing or stale upstream evidence:
  upstream_evidence_missing
  do not silently rerun outside the declared plan

required skipped node:
  blocking

optional skipped node:
  advisory only
```

Validation reuse must be content-addressed by at least:

```text
headSha
sourceHeadOid
baseOid
testedCommitOid
testedTreeKind
validationContextDigest
planDigest
scriptDigest
lockfileDigest
runnerImageDigest
runnerClassDigest
runtimeVersion
taskProfile
environmentClass
```

`unknown`, `required`, empty, null, undefined, or placeholder values make the
reuse key invalid. `not_available` is also invalid. A genuinely not-required
field must be a typed state with a reason, for example
`state=not_required_with_reason` and `reasonCode=PROFILE_HAS_NO_LOCKFILE`.
`runnerImageDigest` must be a real observed runner image identity. If only a
provider/OS class is available, it is recorded as `runnerClassDigest`;
`runnerImageDigest` remains `missing`, and validation reuse is forbidden rather
than guessed. Reuse reports must say both what was reused and what was not
rerun, and reused nodes must carry a source run reference, result digest,
source head, cache key, and result schema version. The reuse decision must be
consistent with node states:

```text
hit:
  all nodes reused, no executed nodes

partial_hit:
  at least one reused node and at least one executed node

miss:
  no reused nodes
```

For any reused node, provenance is load-bearing before cache hit or partial hit
can become an active performance feature:

```text
node.cacheKeyDigest:
  must be observed on the reused node and must match the node-scoped
  validationReuseDecision.nodeCacheKeyDigests entry when present, otherwise
  validationReuseDecision.cacheKeyDigest. The harness must not backfill this
  value from the current computed cache key for a reused node.

node.sourceResultDigest:
  must match the node result digest currently bound under #/typedResults/{nodeRef}

sourceRunRef:
  required for every reused node as a structured object, not a display string.
  It must bind provider, run id, provider artifact name, artifact content
  digest, source head, tested commit, and result schema version.

sourceHeadSha / resultSchemaVersion:
  required for every reused node and must match the structured sourceRunRef.
```

For pull request merge-ref validation, cache reuse must bind the source head,
base commit, tested commit/tree kind, and validation context digest. A source
head match alone is insufficient because the tested merge tree can change when
the base branch advances. Missing `baseOid` on a pull request merge-ref prevents
cache hit or partial hit. A branch-head validation may mark `baseOid` as
`not_required_with_reason`.

The `scriptDigest` is not a label hash. It is a source-closure digest over the
declared validation entrypoint, aggregate finalizer, local quality-gate adapter,
orchestration consumer, node implementations, schema, profile/spec, and
canonicalizer surface. At minimum this includes the projection reader, managed
context emitter, state matrix executor, and projection integrity library.
The source-closure digest must include transitive relative imports reachable
from that declared seed surface. Unresolved relative imports or closure
truncation are activation blockers, not Shadow Candidate merge authority. A
consumer, node implementation, or relative helper change that can alter node
result construction invalidates the reuse key.

Each validation node has a deterministic invocation adapter. The adapter is
part of the node-scoped source closure, so a cache key changes when the wrapper
that constructs the node payload changes. The Source Shadow Candidate adapters
are:

```text
projection_reader:
  scripts/codex-v128-projection-reader-adapter.mjs

managed_context_emitter:
  scripts/codex-v128-managed-context-adapter.mjs

state_matrix_executor:
  scripts/codex-v128-state-matrix-adapter.mjs

aggregate_finalizer:
  scripts/codex-v128-aggregate-finalizer-adapter.mjs
```

Unsupported dynamic import expressions are also reuse blockers. A literal
dynamic import may be scanned like a static dependency, but a computed import
expression disables hit and partial-hit reuse until a later implementation can
prove the reachable source closure without widening the routine read surface.

The expanded source closure is cold diagnostic evidence. It must not enlarge the
routine model-facing Projection read surface.

To avoid turning the transitive closure into a permanent performance penalty,
v1.2.8 also emits node-scoped source-closure digests. A node cache key may use
the node-scoped digest for its implementation surface while the aggregate plan
keeps the whole closure for cold audit and Activation review. This is a Shadow
Candidate performance-preparation feature, not a claim that cache hit or
partial-hit speedup has already been proven.

Decision-stable fields, cache-stable fields, environment diagnostics, owner
inputs, and forbidden values are separate classes. Environment diagnostics such
as runner/build metadata may be displayed or used for troubleshooting, but they
must not enter the merge decision digest. The decision input manifest must
sanitize diagnostic paths before digest generation, and must emit a sanitized
decision input digest when any diagnostic path is present. Raw logs, secrets,
and local absolute paths are forbidden in remote safe artifacts.

The aggregate finalizer is a typed-result reader only. Its source surface must
not import child_process, execute shell commands, or open network clients. A
missing upstream result is `upstream_evidence_missing`; it must not be repaired
by the finalizer rerunning the command.

The validation plan also records a run-wide invocation ledger inside the
existing orchestration capsule surface. This ledger is non-authoritative and
does not create owner permission, but it is load-bearing for Shadow Candidate
performance evidence:

```text
nodeRef
commandOrFunctionDigest
invocationSequence
completionSequence
resultDigest
executionSource
adapterId
```

For an observed execution, every executed node must have a matching ledger
entry and duplicate execution of a required node fails the validation plan.
Reused nodes are represented by sourceRunRef/cache provenance instead of a
local invocation entry.

`commandOrFunctionDigest` is the node-scoped source closure digest, not a
metadata hash of the node name or adapter id. The validator recomputes ledger
counts, duplicate node executions, sequence uniqueness, and command digest
bindings from the ledger and node source closures. Reported count/status fields
are diagnostic only and cannot make a bad ledger pass.

Each node cache key also carries a node input digest. The Source Shadow
Candidate bindings are:

```text
projection_reader:
  routineDecisionProjection.sourceBinding.projectionPayloadDigest

managed_context_emitter:
  activeInstructionSourceSetDigest

state_matrix_executor:
  stateMatrixContentDigest

aggregate_finalizer:
  orderedUpstreamResultSetDigest
```

A cache hit or partial hit is invalid when nodeInputDigest changes. Reused
nodes have no local invocation ledger entry; their proof comes from
sourceRunRef/cache provenance and the node cache key.

The routine Projection may derive `safeNextAction` from provider PR topology
without embedding a full topology object in the routine read surface. This
keeps the bounded Projection reader below budget while preventing the routine
surface from saying `owner_merge_decision_only` when the current PR is still
stacked on another open/non-main base.

```text
stacked branch:
  owner_handle_base_pr

default-branch draft with technical checks closed:
  owner_draft_decision

technical checks not closed:
  wait_for_same_head_remote_gate

default-branch ready with checks closed:
  owner_merge_decision_only
```

This topology-derived next action is non-authoritative and cannot create merge
authority.

The finalizer payload must be semantically checked:

```text
upstreamNodeRefs:
  exactly match aggregate_finalizer.dependsOn

upstreamResultDigests:
  exactly match each upstream node result digest

failed upstream:
  requires finalizer status=fail and failedNodeRefs entry
```

The decision input manifest must be actually scanned before
`decisionInputManifestScanned=true` is emitted. A builder cannot set this field
only because an observed plan exists. The manifest separates decision-stable
payload digests from environment diagnostics, recursively scans input paths, and
fails if a forbidden path enters the decision input manifest. Diagnostic paths
must be detected, excluded from decision digests, and represented only by safe
counts/digests.

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
receipt is already hydrated. A missing receipt is `not_available`, not valid.
Placeholder receipt or checkpoint digests are invalid. Cross-session or
another-thread resume is a diagnostic profile and must revalidate receipt and
Orchestration Capsule.

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

Workspace identity is part of the resume surface. It records repository key,
remote digest, branch, source branch, checkout ref, tested tree kind, head,
active harness version, a worktree identity digest, an observation digest, and
a canonicality state. Pull-request merge refs and source branches are separate
fields. Raw workspace paths stay local diagnostic only and must not be
uploaded. `canonicalityState=canonical` is valid only when
`observationState=observed`; unobserved workspaces are `unknown`.

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
State Matrix coverage is now `full_shadow_candidate` for the declared
three-axis shadow matrix: the finite enum product is executed by
`scripts/codex-v128-state-matrix.mjs`, all valid transition cells are unique,
and all other declared-axis cells fail closed as hard-invalid transition inputs.
Post-merge replay coverage remains `partial_shadow_candidate`; that
partial status blocks Source Activation until sentinel, recovery, and verify
lanes are executed against a real merged main.

The bounded Projection reader verifies the extracted Projection schema, head,
and Projection payload digest without reading additional cold artifacts. The
source binding is generated from the v128 Projection/state-matrix contract
files, reader scripts, and the active local quality-gate Projection generator.
The quality gate additionally recomputes the Projection input digest from the
final saved `codex-final-decision.safe.json`, `codex-evidence-capsule.safe.json`,
and `codex-decision-capsule.safe.json` shapes before marking
`projectionInputBindingState=verified`. It is not merge authority and does not
replace the Final Decision or Evidence Capsule.

Provider-observed heads (`prHeadSha`, `workflowHeadSha`, `artifactHeadSha`)
must remain provider observations. Local git HEAD may populate top-level
artifact metadata, but it must not substitute for missing provider-observed
same-head values.

Activation remains NO-GO unless all of the following are proven by machine
tests, not static defaults:

```text
v1.2.7 Preservation Matrix exact-match
routine cold artifact read = 0
routine total managed artifact read = 1
Projection <= 1600 measured canonical UTF-8 bytes
stress Projection <= 2048 measured canonical UTF-8 bytes
bounded Projection reader extracts only routineDecisionProjection
bounded Projection reader model-facing surface <= 1600 measured canonical UTF-8 bytes
bounded Projection reader actual stdout <= 1600 measured UTF-8 bytes
bounded Projection reader duplicate-key rejection pass
bounded Projection reader schema/head/source digest binding pass
harnessManagedContextBytesEmitted <= 4096
source and target deterministic replay pass
PR body display-only replay pass
receipt provenance and expiry replay pass
required-check failure non-owner-overridable
validation reuse regression 0
post-merge lanes replay pass
false PASS 0
false technical blocker 0
unresolved divergence 0
active v1.2.7 gate impact 0
```

<!-- CODEX_QUALITY_HARNESS_END -->
