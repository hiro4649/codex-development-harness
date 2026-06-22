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
per-transition managed context <= 2300 bytes
compiled active instruction context <= 1400 bytes
resident context <= 2048 bytes
delta packet <= 768 bytes
full context resend count <= 1 per task
stored Safe Summary <= 5600 bytes soft cap
routine Safe Summary read surface <= 2500 bytes
Orchestration Capsule <= 48000 bytes soft cap
routine final report <= 8 lines
routine owner interrupt = 0
repeated safety text = 0
```

The 2300 byte budget is per decision transition, not the cumulative task total.
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

`scripts/codex-v128-token-compression.mjs` is the Source Shadow Candidate
compressor for stored safe read surfaces. It keeps the v1.2.7 authority
artifacts load-bearing, but stores routine-facing summaries as compact
Projection, digest, status, and next-action surfaces. Full trust closure,
validation execution topology, cold evidence, reviewer packets, legacy context,
and foreign repo profile detail remain diagnostic or cold surfaces. Compression
must not remove or weaken Final Decision, Decision Capsule, same-head, receipt,
Stop Circuit, post-merge verification, required-check failure, or PR body
display-only contracts.

Marker-delimited active blocks from applicable AGENTS files and the active
profile are compiled into one deterministic model-facing instruction capsule.
The compiler reads `CODEX_ACTIVE_BLOCK_BEGIN` / `CODEX_ACTIVE_BLOCK_END`
content exactly, must not use LLM summarization, and must fail if required
v1.2.7 preservation `machineBindingId` values are missing. Historical guidance
outside active blocks is not part of the routine model-facing surface.

Long-running work must not resend stable policy/profile material on every
iteration. v1.2.8 emits a resident-context digest set and a small delta packet:

```text
resident context:
  activeInstructionDigest
  activeProfileDigest
  scopeContractDigest
  standingPolicyDigest
  verifierProfileDigest

delta packet:
  failedReasonRefs
  failedNodeRefs
  newEvidenceRefs
  lastAttemptDigest
  nextActionCode
```

The full compiled context may be sent once per task. Continuation uses delta
packets unless head, scope, profile, policy, or trust digest changes.

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

All four adapter entrypoints record through the shared non-authoritative
process ledger module:

```text
scripts/codex-v128-invocation-ledger.mjs
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

Failure repair is directed by the validation graph. A repair loop may execute
only failed nodes, downstream nodes whose input digest changed, or nodes with
invalidated cache evidence. Unchanged, already-passing nodes must not be rerun.
Repeating the same failed node with the same node input digest and same failure
class produces `no_progress_same_failure` instead of another model attempt.

Loop admission is a v1.2.8 shadow decision surface, not authority. It selects
the smallest safe execution mode:

```text
one_shot:
  normal default when all current nodes pass and no protected lifecycle is requested

bounded_goal:
  repairable failure observed
  objectiveContractDigest observed
  capabilityProfileDigest observed
  economicsObservationDigest observed
  repairableFailureEvidenceDigest observed
  budgetState=observed_within_budget
  maxIterations=3

protected_routine:
  repeated safe routine work
  protected executor available
  task recurrence observed
  taskRecurrenceDigest observed
  objectiveContractDigest observed
  capabilityProfileDigest observed
  economicsObservationDigest observed
  budgetState=observed_within_budget
```

The router emits `executionMode`, `admissionStatus`, `budgetState`,
`failedNodeCount`, `stopReason`, `loopTransitionCode`,
`operatorNextActionCode`, and `authorityBoundaryAction`. It must never create
owner authority, Source Activation, target rollout, or a new P0 artifact.
`protected_routine` is invalid without a protected executor. A successful
normal pass emits `executionMode=one_shot` and
`loopTransitionCode=LOOP_NOT_REQUIRED`; `bounded_goal` is not admitted unless
the observed failure and loop economy evidence above are present. Individual PR
human judgment is not required for eligible standing-policy work; deterministic
verification and protected execution decide pass/reject.

Admission observation is digest-based. Boolean fields such as
`objectiveCompletionContractObserved`, `agentEndToEndCapabilityObserved`, and
`economicBenefitObserved` are not allowed to default to true. They are derived
only from `objectiveContractDigest`, `capabilityProfileDigest`,
`economicsObservationDigest`, and, for repair loops,
`repairableFailureEvidenceDigest`. Missing digests remain false.

`budgetState` is tri-state:

```text
observed_within_budget:
  model transport and deterministic validation budgets are measured and within budget

observed_over_budget:
  model transport or deterministic validation budgets are measured and over budget

incomplete_observation:
  deterministic validation may have run, but model transport cost is not observed
```

`one_shot` may proceed with `incomplete_observation` when all nodes pass.
`bounded_goal` and `protected_routine` require `observed_within_budget`.
Model invocation counts are measured at the model transport boundary only; they
must not be inferred from validation node executions.

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

Loop economy metrics are observed separately from declared budgets:

```text
managedInputBytes
validationNodeInvocationCount
modelInvocationObserved
modelInvocationCount
fullContextResendCount
deltaContextBytes
executedNodeCount
reusedNodeCount
residentAndDeltaBytesPerValidatedPass
managedInputBytesPerAcceptedChange
acceptedChangeState
acceptedChangeRate
```

Budgets are `maxIterations=3`, `maxModelInvocations=4`,
`sameBlockerMax=1`, `noProgressWindow=1`, and `flipFlopMax=1`. Unobserved
values remain unobserved; if model transport is not observed then
`modelInvocationObserved=false` and `modelInvocationCount=null`. Validation
node executions are reported separately and must not be counted as model
invocations. `residentAndDeltaBytesPerValidatedPass` measures a deterministic
validation pass; `managedInputBytesPerAcceptedChange` is reserved for an
observed merge or protected-executor accepted result.

Real cache canary is required in Source Shadow Candidate without adding a new
P0 artifact. It uses serialized cache records to exercise:

The same-run node result reuse check is not load-bearing. It remains only as
`cacheReuseSimulation` with `observationClass=simulation` and
`status=partial_shadow_candidate`; it can never satisfy real cache acceptance.

```text
cold_miss:
  fresh invocation ledger
  empty temporary serialized cache
  all eligible nodes execute once
  serialized cache records are written

real_hit:
  fresh invocation ledger
  serialized cache records are read
  eligible node execution count is 0
  every eligible node is reused
  commandSuppressionObserved=true

real_partial_hit:
  fresh invocation ledger
  exactly projection_reader input digest changes
  projection_reader and aggregate_finalizer execute
  managed_context_emitter and state_matrix_executor reuse serialized records
  unaffectedNodeRerunCount=0
  commandSuppressionObserved=true
```

Each cache record binds `repositoryId`, `sourceHead`, `baseHead`,
`testedCommit`, `testedTreeKind`, `validationContextDigest`, `nodeRef`,
`nodeInputDigest`, `nodeSourceClosureDigest`, `typedResultSchema`,
`typedResultPayload`, `typedResultDigest`, `runnerEnvironmentDigest`, and
`cacheRecordDigest`. `typedResultDigest` must equal the digest of
`typedResultPayload`; digest-only records are not real cache hits. Missing or
mismatched fields are misses and cannot become implicit pass. The runner
environment digest binds Node version, platform, architecture, GitHub Actions
state, and provider image metadata when available. If provider image metadata
is incomplete, proof scope is `same_environment_serialized_cache`, not
cross-provider cache portability.

The actual v1.2.8 validation executor must use the same cache protocol before
calling each real adapter. On a valid hit, it restores `typedResultPayload`,
emits `executionState=reused`, does not call that node adapter, and does not add
an execution invocation ledger entry. On a miss, it calls the actual adapter,
captures the actual typed result payload, and writes the serialized record.
Routine cache records are content-addressed per node by the cache binding, node
input digest, node source closure digest, result schema, and runner environment
digest. The routine cache root must be stable across projection-only input
changes inside the same repository/environment/head scope; it must not include a
single whole-plan digest that hides reusable unaffected node records. Writes use
a temporary file plus atomic rename, readback digest verification, and bounded
cleanup. Changing only `projection_reader` input must allow
`managed_context_emitter` and `state_matrix_executor` to hit while
`projection_reader` and `aggregate_finalizer` execute.

GitHub Actions cache restore/save is lifecycle-scoped, not branch-scoped. The
primary key is run-scoped and head-bound:

```text
v128-validation-v2-${runner.os}-${repositoryId}-${headSha}-${runId}
```

The restore prefix is same-head only:

```text
v128-validation-v2-${runner.os}-${repositoryId}-${headSha}-
```

Routine evidence records only `cacheRestoreState`, `cacheSaveState`, and
`matchedCacheKeyDigest`; it must not expose the raw cache key.

If a content-addressed record path already contains different bytes, the cache
must emit `CACHE_RECORD_NONDETERMINISM`, quarantine the conflicting record, and
treat the node as a miss in shadow mode. Activation mode must block on the same
condition. The cache must not turn a conflicting record into a synthetic
mismatch digest that can look like a successful hit.

Cleanup is two-level. Node directories keep at most 256 records and 8 MiB each.
The cache root keeps at most 8 head/environment directories and 32 MiB total,
using deterministic oldest-first cleanup. Stage timing is cold evidence only,
safe-summary only, and must not include raw logs.

Black-box cache proof runs three separate Node child processes against one
temporary non-P0 cache directory:

```text
Child A:
  cold_miss
  calls real adapters
  writes actual typedResultPayload records

Child B:
  real_hit
  fresh process
  restores actual typedResultPayload records
  eligible adapter invocation count = 0
  aggregate result digest equals Child A

Child C:
  real_partial_hit
  fresh process
  changes projection_reader input
  executes projection_reader and aggregate_finalizer
  reuses managed_context_emitter and state_matrix_executor
  aggregate reflects the changed projection input
```

The 20-sample black-box proof is not a routine quality-gate cost. It runs only
when Activation/nightly verification explicitly enables it, for example with
`CODEX_V128_CACHE_BENCHMARK=1` or the Activation gate. Routine quality-gate runs
must keep `actualCacheSampleCount=0`, emit `cacheProofStatus=partial_shadow_candidate`,
and rely on the actual executor's observed node reuse state for routine
evidence. Activation acceptance requires the proof to run at least 20 samples,
real-hit adapter invocations = 0, partial-hit unaffected adapter invocations =
0, aggregate result equivalence pass, p50 improvement >=25 percent, and p95
improvement >=20 percent. Only compact proof fields enter routine artifacts:
`cacheProofStatus`, `sampleCount`, `p50Pct`, `p95Pct`, `hitAdapterCalls`,
`partialUnaffectedAdapterCalls`, `resultEquivalenceState`, and
`cacheProofDigest`. `proofScope`, child-run details, and raw duration samples
remain diagnostic-only.

The canary is shadow-only until Activation, but its digest, read/write counts,
and command suppression counts are included in the compact validation plan so
repeated validation work is reduced without weakening v1.2.7 authority.

The routine Projection separates authority and operator actions without
embedding a full topology object in the routine read surface:

```text
authorityBoundaryAction:
  Final Decision / Decision Capsule boundary action

automationDisposition:
  provider topology and standing policy derived automation hint
```

This keeps the bounded Projection reader below budget while preventing the
operator hint from being confused with Final Decision authority.

```text
stacked branch:
  auto_process_base_pr

default-branch draft with technical checks closed:
  auto_ready

technical checks not closed:
  auto_wait

default-branch ready with checks closed:
  auto_merge

post-merge main workflow_dispatch:
  post_merge_verify
```

The topology-derived automation disposition is non-authoritative and cannot
create merge authority.

### 5. Standing Autonomy Policy Receipt

v1.2.8 may remove per-PR human merge decisions only through a trusted,
owner-defined repository standing autonomy policy. AI reviewer output remains
advisory; the load-bearing decision is deterministic verifier evidence plus a
base-pinned policy digest. The PR head may contain a candidate policy, but a PR
must not define the authority used to approve itself. The candidate policy is
stored at:

```text
docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json
```

The trusted policy source must be one of:

```text
protected default-branch policy
owner-signed immutable policy bundle
protected repository variable
```

If the trusted policy digest, trusted evaluator digest, trusted verifier bundle
digest, trusted provider adapter digest, trusted scope classifier digest, or
trusted merge executor digest is absent or does not match, the PR is
`not_eligible`. The authority epoch and revocation nonce must also match the
protected trusted values; mere presence is not sufficient. A PR that changes the
standing policy, evaluator, Final Decision authority, same-head semantics,
provider adapter, verifier bundle, scope classifier, or merge executor cannot
authorize itself.

The Source Shadow Candidate trust closure is implemented by:

```text
scripts/codex-v128-trust-closure.mjs
```

It emits digest-only bindings for role-specific transitive closures:

```text
verifier bundle
provider adapter
scope classifier
merge executor
canonicalizer
Final Decision authority
```

Each role closure is calculated from its own seed set and transitive imports,
not from a fixed seed subset. The closure uses deterministic UTF-8 byte path
ordering; static imports, re-exports, literal dynamic imports, and literal
executable config/policy reads are included. These bindings are diagnostic in
Source Shadow Candidate mode and become load-bearing only after a protected
default-branch or owner-signed policy source supplies the matching expected
digests.

The policy can authorize automatic merge execution only when all of these are
true:

```text
harness-only scope
no product/runtime/package/lockfile/workflow/deploy/wallet/RPC changes
main/default-branch PR
not draft
not stacked
same-head required checks pass
same-head is derived from PR head, workflow head, artifact head, required-check set digest, and required-check policy digest
merge-boundary Final Decision is recomputed with terminalAction=merge_current_pr
Final Decision has decision=allowed, mergeAllowed=true, exitCode=0
v127 Preservation Matrix pass
deterministic verifier pass
scope digest match from a base-pinned scope classifier, not a PR-head boolean
zero unresolved findings
expected-head CAS succeeds
protected automation executor is available
trusted verifier/provider/classifier/executor digests match protected values
authority epoch and revocation nonce match protected values
```

Authority-surface changes such as Source/Harness manifests, active policy index,
Preservation Matrix, Reason Registry, State Matrix, standing policy, verifier,
provider adapter, scope classifier, or merge executor changes force
`auto_quarantine`. This is how v1.2.8 removes per-PR human decisions without
allowing a PR to approve the authority it changes.

Provider changed-file evidence distinguishes path-set observation from exact
tuple observation. A path-set match must not be reported as
`exactTupleDigestMatch`. Exact matching requires the canonical tuple digest for
`status`, `oldPath`, `newPath`, `oldMode`, `newMode`, `oldContentDigest`, and
`newContentDigest`.

Every v1.2.8 shadow result that can appear near the active v1.2.7 gate must
carry typed routing metadata:

```text
authorityLayer=v128_shadow_candidate
decisionInfluence=shadow_only
loadBearingForActiveV127=false
evidenceEpoch=pre_closure|final_closure
```

The active v1.2.7 gate must route by these typed fields, not by a hardcoded list
of stale reason names.

v1.2.8 Shadow Candidate evidence nodes are computed once per unique input epoch.
Artifact writers serialize already-computed results only; duplicate required node
execution in one epoch is a validation failure. The invocation ledger is
append-only at process level: changing the input creates a new epoch and retains
the previous epoch summary instead of erasing prior evidence.

The policy cannot authorize Source Activation, target rollout, product/runtime
work, workflow changes, package/lockfile changes, deploy, wallet/RPC access,
self-approval, or GitHub approval review. If a PR is stacked, draft, missing
provider evidence, or outside the policy scope, the routine Projection may show
`humanPerPrDecisionRequired=false` while still keeping
`automatedMergeExecutionAllowed=false` and an automation disposition such as
`auto_process_base_pr`, `auto_rebase`, `auto_wait`, `auto_repair`, or
`auto_revalidate`, `auto_reject`, or `auto_quarantine`.

Routine Projection may expose only the compact policy result:

```text
policyAuthorizationState
automationDisposition
humanPerPrDecisionRequired
automatedMergeExecutionAllowed
automationExecutorAvailable
automationActionStarted
automationActionCompleted
automationResultDigest
```

The full policy and its digest remain diagnostic/cold evidence. The stored
Projection and AI review must never create owner authority.

Standing autonomy requires a protected trust root outside PR-head code. The
trusted inputs are the policy digest, evaluator bundle digest, scope classifier
digest, merge executor digest, repository identity, authority epoch, and
revocation nonce. A PR-head policy or evaluator may be candidate data only.

Policy/evaluator/Final Decision/same-head/scope-classifier/merge-executor
changes are self-authorizing changes. They cannot use their own new policy to
authorize themselves. A stricter policy rotation may be accepted only by the old
trusted policy; semantic loosening is automatically rejected or quarantined.

The finalizer payload must be semantically checked:

```text
upstreamNodeRefs:
  exactly match aggregate_finalizer.dependsOn

upstreamResultDigests:
  exactly match each upstream node nodeRef/status/resultDigest tuple

orderedUpstreamResultSetDigest:
  must be produced by the same buildV128OrderedUpstreamResultSetDigest helper
  used by aggregate_finalizer; compact storage must not reuse the field name
  with status-stripped or otherwise changed digest semantics.

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
managedContextEnvelope <= 2300 measured UTF-8 bytes
Safe Summary <= 5600 stored UTF-8 bytes
Orchestration Capsule <= 48000 stored UTF-8 bytes
routine Projection <= 1536 preferred, 1600 hard max
routine model-facing surface <= 2500 stored UTF-8 bytes
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
