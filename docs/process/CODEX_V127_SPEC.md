# Codex HARNESS v1.2.7 Spec

<!-- CODEX_QUALITY_HARNESS_BEGIN -->
CODEX_QUALITY_HARNESS_FILE v1.2.7

## Name

Source HARNESS v1.2.7: Receipt-Carried Continuation and Evidence Compression.

## Scope

v1.2.7 is a Source HARNESS body release only. It preserves:

- v1.1.8 Final Decision as final pass/block/mergeAllowed/exit-code authority
- v1.1.9 three P0 safe artifacts and operator-visible status surface
- v1.2.0 adaptive routing and review pool
- v1.2.1 calibration guard
- v1.2.2 skill/context routing budget
- v1.2.3 observed skill evidence and final decision closure
- v1.2.4 delegated autonomy and evidence semantics
- v1.2.5 goal-sharded control plane
- v1.2.6 observed-state loop runtime

v1.2.7 must not add new P0 artifacts, top-level statuses, new Skills, target
rollout, product/package/runtime/workflow changes, raw-log or raw-transcript
mining, TUI socket injection, cron automation, self approval, GitHub approval
review, deploy, wallet/RPC, secret access, release, funded transaction,
governance transaction, BscScan verification, or readiness/legal/YouTube
compliance claims.

## Problem

v1.2.6 made observed state and receipts stronger, but it could still stop at
avoidable owner boundaries. In particular, an owner instruction such as
"develop the Source HARNESS body and upload it to GitHub" must carry enough
process authority for scoped edit, check, commit, push, and PR creation. It
must not cause repeated owner questions for commit, push, or PR creation when
the work remains inside the original scope.

At the same time, merge, runtime operation, release/deploy, wallet/RPC,
secrets, package/runtime/product changes, and readiness claims remain separate
owner-only or dangerous-capability boundaries.

## Theme

Receipt-Carried Continuation and Evidence Compression.

The harness should:

- continue autonomously inside an explicit process receipt
- stop only at true owner, scope, dangerous capability, or load-bearing gate
  boundaries
- compress decision evidence to a small same-head envelope
- reuse validations only when content-addressed keys match
- reduce markdown, skill, final report, and owner-interrupt token cost

## P0 Internal Blocks

v1.2.7 adds only internal fields inside the existing v1.1.9 artifacts.

### 1. Typed Owner Process Receipt and Continuation Kernel

Owner intent must be normalized into typed receipts, not a single boolean.

An `ownerProcessReceipt` is valid only when it carries owner provenance:
`receiptId`, `taskId`, and either `ownerInstructionHash` or
`sourceInstructionRef`. Missing provenance cannot default to valid and cannot
authorize commit, push, PR creation, CI rerun, or CI repair.

Receipt classes:

- `ownerProcessReceipt`: allows edit/check/commit/push/create PR/CI rerun
  inside the scoped task. It survives in-scope commit HEAD changes and expires
  on scope delta.
- `ownerConditionalMergeReceipt`: allows merge only when same-head required
  checks pass, scope digest is unchanged, Final Decision allows merge, and no
  forbidden delta exists.
- `ownerProductScopeReceipt`: required for product code, package, lockfile,
  runtime, or workflow scope expansion.
- `ownerDangerousCapabilityReceipt`: required for release, deploy, wallet/RPC,
  secrets, funded transaction, governance transaction, BscScan verification, or
  readiness claim.

Normalized owner intents:

- `harness_source_develop_and_publish`
- `harness_target_rollout_complete`
- `merge_specific_current_pr`
- `product_development_only`
- `runtime_operation`
- `release_or_deploy`

`harness_target_rollout_complete` may include conditional target PR merge when
owner scope permits and same-head required checks pass. It does not authorize
runtime operation, deploy, release, readiness claim, wallet/RPC, or secret
access.

Continuation state:

```json
{
  "continuationDecision": {
    "state": "continue",
    "avoidableOwnerStopDetected": false,
    "receiptValid": true,
    "scopeDeltaDetected": false,
    "oneSafeNextAction": "continue_commit_push_create_pr"
  }
}
```

Allowed states are `continue`, `justified_owner_boundary`, `blocked`, and
`clarify_once`.

### 2. Decision Evidence Envelope and Same-Head Binder

Machine decision evidence is a small envelope, not the PR body.

```json
{
  "decisionEvidenceEnvelope": {
    "lane": "local_pre_pr",
    "repo": "owner/repo",
    "branch": "codex/branch",
    "baseSha": "sha",
    "localHead": "sha",
    "prHead": "sha",
    "workflowHead": "sha",
    "artifactHead": "sha",
    "ownerReceiptBinding": "valid",
    "sameHead": true,
    "localGate": "pass",
    "remoteGate": "pass",
    "allowedNextAction": "merge_current_pr",
    "oneBlockingReason": null
  }
}
```

`sameHead` must be derived from non-null matching `localHead`, `prHead`,
`workflowHead`, and `artifactHead`. A default `sameHead: true`, a null head, or
a mismatch is a blocker for `same_head_remote_qg` and `merge_boundary`. The PR
body is display-only; machine judgment uses the safe envelope.

During GitHub Actions pull-request runs, the remote gate must inject the PR
head and `GITHUB_RUN_ID` into the safe artifacts. Because GitHub assigns the
numeric artifact ID only after upload, the artifact itself records a stable
artifact pointer of `runId + artifactName`; external metadata may later bind
that pointer to the numeric artifact ID and digest.

`owner_merge_decision_only` is a valid next action for
`same_head_remote_qg`: technical evidence is closed, but AI has not created
merge authority. `merge_current_pr` remains valid only in `merge_boundary`
with a current-head owner merge receipt.

Lanes are:

- `local_pre_pr`
- `pushed_pr_waiting_qg`
- `same_head_remote_qg`
- `merge_boundary`
- `post_merge_sentinel`
- `blocked_recovery`

Merge boundary requires valid owner merge receipt, same-head required checks
pass, Final Decision mergeAllowed, unchanged scope digest, no forbidden delta,
and no self approval.

After remote closure, validation must be internally consistent. If any machine
blocking reason remains, the gate must not emit `status=pass`,
`qualityScore=100`, or owner-only finality. It must demote to one harness
repair blocker and one safe next action. `mergeReady` is preserved as
compatibility wording for technical checks; v1.2.7 also emits
`technicalChecksReady` so technical pass is not confused with owner merge
authority.

### 3. Validation DAG and Content-Addressed Evidence Reuse

Validation reuse is allowed only when this key matches:

- `headSha`
- `validationPlanVersion`
- `scriptDigest`
- `lockfileDigest`
- `runnerImage`
- `nodeOrRuntimeVersion`
- `taskProfile`
- `environmentClass`

Cache invalidates on validation script, workflow, lockfile, runtime, runner,
task profile, changed category, or required check policy changes.

Placeholder cache values such as `unknown`, `required`, empty strings, or
missing run pointers are not reusable evidence. A cache hit requires a prior
safe artifact pointer and a complete content-addressed key.

Nightly/full gates can supplement evidence but cannot replace pre-merge
required checks.

### 4. Context / Output / Owner-Interrupt Token Budget

v1.2.7 treats owner questions as a cost. With a valid process receipt, the
harness should not ask the owner to confirm commit, push, or PR creation.

```json
{
  "tokenEconomyMetrics": {
    "authorityMarkdownReads": 2,
    "safeArtifactReads": 3,
    "selectedSkills": 1,
    "extraReads": 0,
    "operatorOutputLines": 8,
    "ownerInterruptCount": 0,
    "repeatedSafetyTextCount": 0,
    "reusedValidationResults": 6,
    "newValidationExecutions": 3,
    "observed": true,
    "metricsSource": "quality_gate_runtime_generated_artifact_sizes",
    "countsSource": "declared_budget",
    "observedCounts": false,
    "routineArtifactBytes": 4096
  }
}
```

Routine progress output should be delta-only. Repeated safety text should be
profile-ID compressed. Routine token metrics must be observed rather than
self-filled defaults. `observed` defaults to false unless the quality gate
injects a `metricsSource`, output line count, safe artifact byte count, and
routine artifact byte count. Fixed read/output ceilings are declared budget
values unless an execution trace explicitly marks `countsSource=observed_trace`;
declared-budget counts must not claim `observedCounts=true`. The default final
report budget is 8 lines, selected skills max is 1, safe artifact reads max is
3, and routine artifact bytes are bounded by the task profile.

### 5. Blocker Closure and Product Value Pressure

Each blocker has one primary class, one recovery class, and one safe next
action.

```json
{
  "blocker": "stale_evidence",
  "severity": "merge_blocking",
  "recovery": "refresh_current_head_evidence_only",
  "allowedActions": ["refresh-evidence"],
  "forbiddenActions": ["code-change", "merge"]
}
```

Product value pressure is advisory only. It can recommend returning to a
product slice but cannot authorize product code, package/lockfile, runtime,
workflow, merge, release, deploy, wallet/RPC, secret access, or readiness
claims.

Portfolio rollout counts as one harness cycle, not one cycle per repository.

## P1 Optional Surfaces

These may be measured inside existing artifacts but must not become new P0
artifacts or top-level statuses:

- Skill ROI optimization
- Checker Independence Lite
- runtime/readiness vocabulary polish
- source/target naming polish
- extended product value analytics

Mandatory safety skills cannot be ROI-disabled. Neutral skills are not disabled
after two samples.

## Self-Test Requirements

`scripts/codex-v127-self-test.mjs` must prove:

- process receipt survives in-scope commit HEAD changes
- exact-head merge receipt expires on head change
- conditional merge receipt requires new same-head pass
- scope delta invalidates continuation
- out-of-scope files invalidate continuation
- target install/rollout does not authorize runtime operation
- required check failure is not owner-overridable
- avoidable owner stop is detected
- justified owner boundary is not penalized
- ambiguous initial scope allows one clarification
- decision evidence envelope rejects head mismatch
- CI cache invalidates on script, lockfile, or runner change
- nightly full gate does not replace pre-merge required checks
- portfolio rollout counts as one harness cycle
- neutral skill is not disabled after two samples
- mandatory safety skill cannot be ROI-disabled
- final report line budget is enforced
- repeated safety text is suppressed

## Final Boundary

v1.2.7 improves autonomous continuation inside explicit owner scope. It does
not make AI the owner, does not self-approve, does not submit GitHub approval
reviews, does not merge without a valid merge receipt and same-head required
checks, and does not create runtime, production, legal, or YouTube policy
readiness.

<!-- CODEX_QUALITY_HARNESS_END -->
