# HARNESS v1.3.2 Evidence-Converged Lean Core

## Status

This document specifies a local Source-only candidate based provisionally on `35fbdd0e7075701516de3b2de722b3b7014f1dbf`.

- `requiresRebaseAfterV131Merge=true`
- `activationAllowed=false`
- `targetRolloutAllowed=false`
- `remoteValidationState=not_observed`

It does not activate a target profile or create merge authority.

## Purpose

v1.3.2 converges evidence into a small truthful result, reuses deterministic validation work, bounds routine context and output, and plans future CI cost before a remote action. It adds no product capability, autonomous target mutation, agent-team runtime, or performance superiority claim.

## Evidence Truth Kernel

Remote state, required checks, same-head binding, artifact integrity, and Final Decision are derived only from durable verification paths. The production GitHub collector accepts only repository/run identity and performs the GitHub API observation itself; caller-fed check, artifact, head, conclusion, or timestamp data is rejected. A serialized GitHub receipt must be re-observed before use. A serialized Final Decision receipt must pass Ed25519 signature verification. Fixture constructors are separate and forbidden outside explicit test mode. Check-set, artifact, payload, repository, local HEAD, run, and attempt bindings are validated. Boolean claims such as `remoteChecksPass`, `sameHead`, or `artifactUploaded` are rejected. A PR body is display text, not evidence. Missing observation remains `not_observed`; an account billing lock becomes `unavailable_billing`, not a code failure.

Canonical state fields are:

1. `localValidationState`
2. `remoteValidationState`
3. `technicalMergeEligibility`
4. `finalDecisionState`
5. `mergeAllowed`

`mergeAllowed` is the only canonical merge projection. `deprecatedLocalTechnicalReady` is a non-authoritative compatibility alias and cannot override it. Local-only success therefore remains technically blocked and never becomes merge permission.

## Manifest And Registry

`docs/process/CODEX_V132_POLICY.json` is the normative policy. The strict compiler rejects exact, Unicode-escaped-equivalent, and case-folded duplicate keys. Source manifest, docs manifest, active policy, and compact effective policy share one compiled tuple. Valid fixtures must have equivalent meaning under Node, PowerShell, and Python parsers.

Registry v2 separates immutable owner classification from expiring GitHub observation. All eight registered repositories have a static profile. Dynamic head, pending PR, and observed version fields never enter the static registry. An unknown repository is `unclassified_blocking` for rollout only; it does not block ordinary local product work.

The Source candidate display is `HARNESS v1.3.2 Evidence-Converged Lean Core`. Installed target state is `per_repository_dynamic_observation`; no global target harness version is inferred. `targetRolloutState=not_started` remains distinct from Source candidate display.

## Incremental Validation

The deterministic executor runs concrete handlers for workspace identity, manifest compilation, registry observation, change classification, dependency closure, selected checks, compatibility checks, evidence projection, compact rendering, and CI cost planning. Unknown paths fail closed into the full local gate.

A resumable receipt binds repository, base/head SHA, content-addressed workspace state, policy, registry, graph, toolchain, environment, node input, executor version, output digest, and completion time. Workspace state covers the committed base-to-head binary patch, staged patch, unstaged tracked patch, untracked paths and contents, file modes, and symlink targets; only Git-ignored files are excluded. A same-head same-path content edit or new untracked file invalidates reuse. Unexecuted or forged nodes cannot be stored or reused. Any mismatch or expiry invalidates reuse. Evidence, compact output, and CI planning always rerun.

## Operational Bounds

The advisory compiled context order is immutable core, compiled repository policy, task delta, then evidence capsule. Limits are 1536, 1536, 2048, and 2048 bytes. It is `compiled_advisory_contract` until connected to an executable AI context compiler; it does not claim runtime enforcement.

Default compact JSON is at most 8192 bytes and 64 top-level fields. Decision Capsule v3 is at most 2048 bytes, Safe Summary 3584 bytes, Orchestration Receipt 24576 bytes, and opt-in full diagnostics 131072 bytes. Paths and reason codes are bounded; exact counters and incremental digests preserve cardinality without retaining unbounded arrays. `qualityScore` is not canonical authority; the compatibility projection is `legacyLocalQualityScore` with `authority=false`.

Long runs stop or checkpoint at 120 minutes, 300 direct subprocess executions, 100 harness file writes, one retry per node, and one parallel runtime. Accounting records actual direct subprocesses, writes, retries, and persisted checkpoints; a validation node is not counted as a tool call merely because it exists. A compact heartbeat is limited to 512 bytes every three completed nodes.

## Target And CI Planning

Target install planning is `dry_run_only`, allowlist-based, and never mutates a repository. Absolute, traversal, control-character, symlink-escape, Source manifest, nested package/lockfile, runtime, contract, deployment, environment, wallet, RPC, secret, and unclassified paths fail closed.

The CI planner parses actual workflow files and expands job and matrix counts. Heavy PR validation listens only to `opened`, `synchronize`, and `reopened`; `edited` is excluded. Current Source Core topology is two workflows and four jobs, the hard maximum. Duplicate evidence refresh plans zero.

## Compatibility And Authority

Rollback order is v1.3.1 immediate, v1.3.0 secondary, v1.2.9 emergency legacy, v1.2.8 blocking compatibility, and v1.2.7 readable compatibility. Each compatibility lane distinguishes historical source presence, role projection validity, and bounded behavioral invariants executed under the v1.3.2 active tuple. Old active-tuple assertions are not authoritative for v1.3.2. Compatibility debt due in v1.3.2 must be resolved, reclassified with a reason, or extended once with an owner reason. The preserved target-gate aliases are reclassified as a non-authoritative adapter obligation until targets consume canonical fields.

Benchmark coverage is derived from executed or attested node output digests. Output-size reduction may be reported independently, but relative performance and superiority remain `not_proven` when the baseline lacks equivalent executed-output-digest coverage or exact remote evidence.

Final Decision remains `v1.1.8_final_decision_kernel`. Decision Capsule v3 is a non-authoritative bounded projection. Models, agents, Skills, tools, plugins, receipts, summaries, and compatibility aliases create no authority.

## Non-Goals

No target rollout, target mutation, product/runtime/package/lockfile change, deploy/wallet/RPC/secret access, Performance Track activation, Fable comparison, SDK benchmark, Skill runtime, DAG runtime, agent-team runtime, or successor-version work is part of this candidate.
