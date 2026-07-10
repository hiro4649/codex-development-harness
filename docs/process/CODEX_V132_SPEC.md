# HARNESS v1.3.2 Evidence-Converged Lean Core

## Status

This document specifies a local Source-only candidate based provisionally on `35fbdd0e7075701516de3b2de722b3b7014f1dbf`.

The accepted public main remains HARNESS v1.3.0 Core at `be06232adbe9072456bc9a36a1b298f5ba900470`. The development parent is the v1.3.1 candidate, while the executing candidate is v1.3.2. `activeHarnessVersion` is a deprecated execution-compatibility alias with no published authority. `acceptedMainVersion` is the published authority version and `candidateVersion` is the unmerged candidate version.

- `requiresRebaseAfterV131Merge=true`
- `activationAllowed=false`
- `targetRolloutAllowed=false`
- `remoteValidationState=not_observed`
- `candidateLifecycleState=local_validated`

It does not activate a target profile or create merge authority.

## Purpose

v1.3.2 converges evidence into a small truthful result, reuses deterministic validation work, bounds routine context and output, and plans future CI cost before a remote action. It adds no product capability, autonomous target mutation, agent-team runtime, or performance superiority claim.

## Evidence Truth Kernel

Remote state, required checks, same-head binding, base freshness, artifact integrity, and Final Decision are derived only from durable verification paths. The production CLI `scripts/codex-v132-collect-remote-evidence.mjs` accepts repository and PR number as locators; optional run IDs are non-authoritative hints. It observes the current PR base and exact current head through the Pull Request API, proves that base is an ancestor of head through the Compare API, lists all pull-request runs for that head, selects the highest run number and latest attempt for each contracted workflow, fetches selected run details, and repeats PR, ancestry, and run discovery after artifact collection. A stale successful hint cannot hide a newer failure, cancellation, head change, or advanced base. Queued, in-progress, canceled, failed, billing-unavailable, and pre-runner-unavailable observations remain distinct. Caller-fed check, artifact, base, head, conclusion, or timestamp data is rejected. One stable required-check snapshot is shared across required workflows. A serialized receipt is non-authoritative and must be re-observed before decision use.

Every automatic v1.3.2 Source job checks out `${{ github.event.pull_request.head.sha || github.sha }}`, disables persisted checkout credentials, immediately compares `git rev-parse HEAD` with the expected SHA, and requires `git merge-base --is-ancestor "$CODEX_PR_BASE_SHA" HEAD` for pull requests. `workflow_dispatch` records base applicability as `not_applicable`. This prevents synthetic pull-request merge commits and heads stale against the current base from becoming validation or artifact evidence. The quality runner independently requires compact-report `headSha`, `observedBaseSha`, and `baseAncestryState` to match the workflow context, and contracted artifact values bind the same head. The observed required-workflow set must exactly equal the accepted-main required contract; unrelated workflow runs are outside the required set and create no authority.

A serialized Final Decision receipt must pass Ed25519 verification against a key ID and public-key fingerprint loaded through an accepted-main GitHub API trust envelope. The committed document contains no commit SHA. The collector observes the Source repository, `main`, exact default-branch HEAD, fixed-path Git blob SHA, protection digest, and time, then computes an effective digest over the document plus repository/default branch/HEAD/blob/path. A separate `mergeContextDigest` binds repository, pull request number, current base SHA, exact head SHA, and that accepted-main trust-root digest. Final Decision signs the pull request number, base, head, and merge-context digest, so a later base movement invalidates authorization. Candidate or detached heads, alternate paths or repositories, non-default branches, candidate-selected keys, cloned envelopes, and self-referential `acceptedMainSha` document fields are rejected. The policy `acceptedMainSha` remains candidate-lineage metadata only and creates no trust authority.

Workflow contracts bind ID, path, exact content digest, optional reusable-workflow reference, and any Ruleset path/ref/SHA/repository ID. v1.3.2 supports SHA-pinned Ruleset workflows only; missing SHA fails with `github_ruleset_workflow_not_sha_pinned_unsupported`, while `ref` is optional. Classic required checks bind name plus GitHub App ID when protection specifies an app; missing app observation fails closed. Artifact archives are content-digested and limited to 8 MiB, 64 entries, and a 256 KiB contracted JSON payload. Duplicate contracted entries, ZIP64, unsupported compression, schema/value/head/status mismatch, and decompression overflow are rejected. Fixture constructors are separate and forbidden outside explicit test mode. Passed, `unavailable_billing`, `unavailable_pre_runner`, `queued`, `in_progress`, `canceled`, and failed observations are serialized truthfully with no authority; only passed evidence can become `remoteValidationState=passed`.

The production collector credential is an owner-managed GitHub App or fine-grained PAT supplied only as `CODEX_V132_COLLECTOR_TOKEN`. Required permissions are Metadata read, Contents read, Actions read, Pull requests read, Administration read, and Checks read. The credential is never exposed to ordinary product workflows. The collector writes an atomic owner-readable receipt envelope with `authority=none`, `mergeAllowed=false`, `createsAuthority=false`, and no Final Decision capability.

Canonical state fields are:

1. `localValidationState`
2. `remoteValidationState`
3. `observedBaseSha`
4. `baseAncestryState`
5. `mergeContextDigest`
6. `technicalMergeEligibility`
7. `finalDecisionState`
8. `mergeAllowed`

`mergeAllowed` is the only canonical merge projection. Local-only success remains technically blocked and never becomes merge permission. The compact report separates declared policy, observed Git/worktree facts, validation results, decision, and projections; observed product mutation is derived from the actual change set rather than a manifest assertion.

## Manifest And Registry

`docs/process/CODEX_V132_POLICY.json` is the normative policy. The strict compiler rejects exact, Unicode-escaped-equivalent, and case-folded duplicate keys. Source manifest, docs manifest, active policy, and `docs/process/CODEX_EFFECTIVE_POLICY.compact.json` share one compiled tuple. The compact policy is generated atomically and limited to 2048 UTF-8 bytes. Valid fixtures must have equivalent meaning under Node, PowerShell, and Python parsers.

Routine reads are `AGENTS.md`, the compact effective policy, and the task delta capsule. The full historical manifest is deferred to architect audit, manifest conflict, compatibility failure, or release review.

Registry v2 separates immutable owner classification from expiring GitHub observation. All eight registered repositories have a static profile. Dynamic head, pending PR, and observed version fields never enter the static registry. An unknown repository is `unclassified_blocking` for rollout only; it does not block ordinary local product work.

The Source candidate display is `HARNESS v1.3.2 Evidence-Converged Lean Core`. Installed target state is `per_repository_dynamic_observation`; no global target harness version is inferred. `targetRolloutState=not_started` remains distinct from Source candidate display.

## Incremental Validation

The deterministic executor runs concrete handlers for workspace identity, manifest compilation, registry observation, change classification, dependency closure, selected checks, compatibility checks, evidence projection, compact rendering, and CI cost planning. Unknown paths fail closed into the full local gate.

A resumable receipt binds repository, base/head SHA, content-addressed workspace state, policy, registry, graph, toolchain, environment, node input, executor version, output digest, and completion time. Workspace state covers the committed base-to-head binary patch, staged patch, unstaged tracked patch, untracked paths and contents, file modes, and symlink targets; only Git-ignored files are excluded. A same-head same-path content edit or new untracked file invalidates reuse. Unexecuted or forged nodes cannot be stored or reused. Any mismatch or expiry invalidates reuse. Evidence, compact output, and CI planning always rerun.

Missing, malformed, unsupported-host, lookalike, or mismatched `origin` fails closed. Workspace identity also binds the real Git top-level, repository slug, exact HEAD, provisional base commit, AGENTS marker, and Source manifest marker. A dirty index/worktree/untracked set cannot be locally ready outside explicit test fixtures.

## Operational Bounds

The advisory compiled context order is immutable core, compiled repository policy, task delta, then evidence capsule. Limits are 1536, 1536, 2048, and 2048 bytes. It is `compiled_advisory_contract` until connected to an executable AI context compiler; it does not claim runtime enforcement.

Default compact JSON is at most 8192 bytes and 64 top-level fields. Decision Capsule v3 is at most 2048 bytes, Safe Summary 3584 bytes, Orchestration Receipt 24576 bytes, and opt-in full diagnostics 131072 bytes. Paths and reason codes are bounded; exact counters and incremental digests preserve cardinality without retaining unbounded arrays. Neither `qualityScore` nor `mergeReady` is emitted as v1.3.2 Source authority. The generated `codex-v132-benchmark` JSON `verificationMetrics` object is the single machine source for compact/policy/capsule/summary/receipt byte sizes and benchmark timings; project memory does not maintain hand-written copies.

Long runs stop or checkpoint at 120 minutes, 300 direct subprocess executions, 100 harness file writes, one retry per node, and one parallel runtime. Accounting records actual direct subprocesses, writes, retries, and persisted checkpoints; a validation node is not counted as a tool call merely because it exists. A compact heartbeat is limited to 512 bytes every three completed nodes.

## Target And CI Planning

Target install planning is `dry_run_only`, allowlist-based, and never mutates a repository. Absolute, traversal, control-character, symlink-escape, Source manifest, nested package/lockfile, runtime, contract, deployment, environment, wallet, RPC, secret, and unclassified paths fail closed.

The CI planner performs constrained static analysis of checked-in workflow files and expands the supported job and matrix forms without claiming full YAML-parser confidence. Heavy PR validation listens only to `opened`, `synchronize`, and `reopened`; `edited` is excluded. Both Source workflows apply to every pull request without path filters. `v132-compatibility-gate` is one lightweight aggregate job for source-core and docs-only changes. Current Source Core topology is two workflows and two jobs, below the unchanged four-job hard maximum. Duplicate evidence refresh plans zero.

The v1.3.2 Source path skips the legacy v1.2.8 cache, target product-evidence preparation, dependency installation, and legacy multi-status summary. Its Step Summary is exactly eight bounded decision lines and contains neither `mergeReady` nor `qualityScore`. The single compatibility aggregate executes all bounded compatibility lanes without restoring the old topology.

## Compatibility And Authority

Rollback order is v1.3.1 immediate, v1.3.0 secondary, v1.2.9 emergency legacy, v1.2.8 blocking compatibility, and v1.2.7 readable compatibility. Each compatibility lane requires historical source presence, projection validity, and actual bounded pure behavior invariants. The behavior contracts execute v1.3.1 state/profile/CI boundaries, v1.3.0 authority/mutation/performance boundaries, v1.2.9 routing/rollback, v1.2.8 blocking/canary behavior, and v1.2.7 receipt/same-head/token behavior. Old self-tests are never executed as active tuples. Compatibility debt due in v1.3.2 must be resolved, reclassified with a reason, or extended once with an owner reason.

Candidate lifecycle is `draft -> local_validated -> remote_unavailable|remote_validated -> activation_eligible -> active`, with `superseded` as an explicit terminal path. Invalid skips fail. Because activation is forbidden for this draft, even an activation-eligible fixture cannot transition to active.

Benchmark coverage is derived from executed or attested node output digests. Output-size reduction may be reported independently, but relative performance and superiority remain `not_proven` when the baseline lacks equivalent executed-output-digest coverage or exact remote evidence.

Final Decision remains `v1.1.8_final_decision_kernel`. Decision Capsule v3 is a non-authoritative bounded projection. Models, agents, Skills, tools, plugins, receipts, summaries, and compatibility aliases create no authority.

## Non-Goals

No target rollout, target mutation, product/runtime/package/lockfile change, deploy/wallet/RPC/secret access, Performance Track activation, Fable comparison, SDK benchmark, Skill runtime, DAG runtime, agent-team runtime, or successor-version work is part of this candidate.
