# Project Specification

## Current Architecture

HARNESS v1.3.2 Evidence-Converged Lean Core is a Source-only candidate on provisional v1.3.1 PR head `35fbdd0e7075701516de3b2de722b3b7014f1dbf`. Accepted main remains v1.3.0 at `be06232adbe9072456bc9a36a1b298f5ba900470`. The candidate uses one declared-observed-validation-decision-projection model, a GitHub-observed default-branch trust root, a shared protection/ruleset snapshot, exact workflow and artifact bindings, a strict manifest compiler, Registry v2, an executable validation graph, content-addressed resumability, bounded output, and pure compatibility behavior contracts.

## Functional Specifications

- Remote, same-head, check-set, artifact, and Final Decision states require GitHub API observation. Structurally valid caller data is untrusted.
- Final Decision verification requires an accepted-main trust root, allowed Ed25519 key ID and fingerprint, non-revoked rotation state, repository, exact head, decision ID, observation time, receipt digest, and signature. A candidate-supplied key cannot authorize itself.
- The trust-root file is accepted only from the GitHub-observed Source `main` HEAD when that HEAD equals the recorded accepted-main SHA and authoritative protection or Rulesets are observable.
- Remote evidence binds repository, pull request, `pull_request` event, base/head SHAs, workflow ID/path/content digest, optional reusable workflow ref, run IDs/attempts, shared protection/ruleset snapshot, artifact contract/schema/values/digest, and observation time.
- Required checks and required workflows come from one observed classic-protection/Ruleset snapshot, never only from candidate policy.
- Canonical state is `localValidationState`, `remoteValidationState`, `technicalMergeEligibility`, `finalDecisionState`, and `mergeAllowed`.
- Local-only pass leaves remote `not_observed`, technical eligibility blocked, and `mergeAllowed=false`.
- Candidate lifecycle is `draft -> local_validated -> remote_unavailable|remote_validated -> activation_eligible -> active`, with `superseded` as a terminal replacement state.
- Exact digest-bound validation may reuse only schema-valid, output-digest-valid results from the current executor. Committed, staged, unstaged, untracked-content, file-mode, or symlink-target changes invalidate reuse.
- Routine reads are `AGENTS.md`, the generated compact effective policy, and the task delta. Full manifests are deferred to architecture audit, conflict, compatibility failure, or release review.
- Compact output is limited to 8192 bytes and 64 top-level fields; full diagnostics are opt-in.
- Target planning is allowlist-based, fail-closed, dry-run only, and has no mutation authority.
- CI cost is conservatively inferred from workflow files; current automatic Source topology is two workflows and four jobs, with no matrix expansion.
- The v1.3.2 Source path skips legacy cache, target product evidence, and legacy multi-status summaries. Its Step Summary is eight lines and omits `mergeReady` and `qualityScore`.
- Compatibility lanes require source presence, projection validity, and executed bounded behavior invariants under the v1.3.2 tuple. Historical self-tests are not reactivated as current authority.
- Long-run accounting measures direct subprocesses, harness writes, retries, and persisted checkpoints instead of treating each node as one tool call.

## Data Models

The normative model is `docs/process/CODEX_V132_POLICY.json`; generated manifests and `docs/process/CODEX_EFFECTIVE_POLICY.compact.json` are checked projections. Declared policy, observed workspace/GitHub facts, validation results, decision, and output projections remain separate. Resumable receipts bind repository, base/head, workspace content, policy, registry, graph, command, toolchain, and environment digests and are optimization-only, not merge authority. Generated `codex-v132-benchmark` JSON `verificationMetrics` is the single machine source for output sizes and benchmark timing.

## APIs

Source harness APIs are exported from `scripts/codex-v132-*.mjs`. No product or runtime API changes.

## Design Decisions

- `mergeAllowed` is the only canonical merge projection. Legacy `mergeReady` and quality-score views are non-authoritative compatibility data and are absent from the v1.3.2 Source summary.
- Strict JSON rejects exact, escaped-equivalent, and case-fold key collisions before native parsing.
- Missing, malformed, unsupported-host, lookalike, or mismatched origins fail closed. Workspace identity binds git top-level, origin, repository, base/head, AGENTS marker, and Source manifest marker.
- Unknown pre-runner failures are `unavailable_pre_runner`; only an observed authoritative billing annotation yields `unavailable_billing`.
- `activeHarnessVersion` is a deprecated execution-compatibility alias with no published authority. `acceptedMainVersion` is published authority and `candidateVersion` is unmerged.
- Unknown paths run the full local gate; unknown target paths are rejected.
- Bounded samples retain exact counts and digests instead of unbounded arrays.
- v1.3.1, v1.3.0, and v1.2.9 remain immediate, secondary, and emergency rollback respectively.
- Compatibility debt due now is reclassified with a reason, not silently extended.
- `acceptedMainVersion`, `developmentParentVersion`, `candidateVersion`, `executionHarnessVersion`, and `candidateLifecycleState` are distinct. Source candidate display is separate from target-installed state; rollout remains not started.
- Benchmark coverage comes from node output digests. Output reduction is separate from unproven relative performance.

## Constraints

No activation, target rollout, target mutation, product/runtime/package/lockfile/deploy/wallet/RPC/secret change, Performance Track, Fable comparison, SDK benchmark, Skill runtime, DAG runtime, agent-team runtime, merge, manual Actions rerun, or workflow dispatch is allowed in this candidate.

## Known Limitations

- The candidate must be rebased after v1.3.1 is accepted on main.
- The accepted-main trust-root file is not yet available on accepted main. This deliberately prevents candidate self-authorization and requires owner-governed bootstrap after merge sequencing is resolved.
- Remote CI is not observed; no remote approval, activation, or merge readiness is claimed.
- Remote runner-step behavior remains unverified because current automatic jobs fail before steps.
- Workflow topology parsing is conservative static analysis, not a full YAML semantic proof.
- Dynamic repository observations are intentionally absent from static Source manifests.
