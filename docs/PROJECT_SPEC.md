# Project Specification

## Current Architecture

HARNESS v1.3.2 Evidence-Converged Lean Core is a Source-only candidate on provisional v1.3.1 PR head `35fbdd0e7075701516de3b2de722b3b7014f1dbf`. Accepted main remains v1.3.0 at `be06232adbe9072456bc9a36a1b298f5ba900470`. The candidate uses one declared-observed-validation-decision-projection model, a non-self-referential GitHub-observed default-branch trust envelope, exact workflow/check/artifact and PR-base closure, a strict manifest compiler, Registry v2, an executable validation graph, content-addressed resumability, bounded output, and pure compatibility behavior contracts.

## Functional Specifications

- Remote, same-head, check-set, artifact, and Final Decision states require GitHub API observation. Structurally valid caller data is untrusted.
- Final Decision verification requires an accepted-main trust root, allowed Ed25519 key ID and fingerprint, non-revoked rotation state, repository, exact head, decision ID, observation time, receipt digest, and signature. A candidate-supplied key cannot authorize itself.
- The committed trust-root document contains no commit SHA. GitHub API observation adds repository, default branch, exact HEAD, Git blob SHA, fixed path, and observation time; their effective digest is the Final Decision trust binding.
- Remote evidence observes the current PR's repository, number, base/head SHAs, proves current-base ancestry through GitHub Compare API, then discovers exact-head runs. PR, ancestry, and run discovery are repeated after artifact collection. Per contracted workflow, the highest run number and latest attempt are authoritative; run IDs supplied to the CLI are hints only.
- Every automatic v1.3.2 Source job checks out `${{ github.event.pull_request.head.sha || github.sha }}` with persisted credentials disabled, asserts `git rev-parse HEAD`, and proves the current PR base is an ancestor before checks. Compact reports and uploaded artifacts bind that same merge context.
- `mergeContextDigest` binds repository, pull request number, current base, exact head, and accepted-main trust-root digest. Final Decision signs the same PR/base/head/context tuple.
- Passed, billing-unavailable, pre-runner-unavailable, queued, in-progress, canceled, and failed observations are persisted without authority. Only a passed observation can project `remoteValidationState=passed`; every other state keeps `mergeAllowed=false`.
- Required checks and workflows come from one observed classic-protection/Ruleset snapshot. The observed required-workflow set must exactly equal the accepted-main required contract; omission fails closed, while unrelated workflows create no authority and are outside that required set.
- Artifact ZIP input is bounded to 8 MiB, 64 entries, and a 256 KiB contracted payload. Duplicate contracted entries and ZIP64 are rejected.
- Canonical state is `localValidationState`, `remoteValidationState`, `technicalMergeEligibility`, `finalDecisionState`, and `mergeAllowed`.
- Local-only pass leaves remote `not_observed`, technical eligibility blocked, and `mergeAllowed=false`.
- Candidate lifecycle is `draft -> local_validated -> remote_unavailable|remote_validated -> activation_eligible -> active`, with `superseded` as a terminal replacement state.
- Exact digest-bound validation may reuse only schema-valid, output-digest-valid results from the current executor. Committed, staged, unstaged, untracked-content, file-mode, or symlink-target changes invalidate reuse.
- Routine reads are `AGENTS.md`, the generated compact effective policy, and the task delta. Full manifests are deferred to architecture audit, conflict, compatibility failure, or release review.
- The compact effective policy keeps full-manifest detail behind digests and targets 1800 bytes while retaining a 2048-byte hard limit.
- Compact output is limited to 8192 bytes and 64 top-level fields; full diagnostics are opt-in.
- Target planning is allowlist-based, fail-closed, dry-run only, and has no mutation authority.
- CI cost is conservatively inferred from workflow files; current automatic Source topology is two workflows and two jobs, with no matrix expansion and a four-job hard maximum.
- Both Source workflows are required for every pull request. Compatibility has no path filter and runs all bounded lanes in one lightweight aggregate job, including docs-only changes.
- The v1.3.2 Source path skips legacy cache, target product evidence, and legacy multi-status summaries. Its Step Summary is eight lines and omits `mergeReady` and `qualityScore`.
- Compatibility lanes require source presence, projection validity, and executed bounded behavior invariants under the v1.3.2 tuple. Historical self-tests are not reactivated as current authority.
- Long-run accounting measures direct subprocesses, harness writes, retries, and persisted checkpoints instead of treating each node as one tool call.

## Data Models

The normative model is `docs/process/CODEX_V132_POLICY.json`; generated manifests and `docs/process/CODEX_EFFECTIVE_POLICY.compact.json` are checked projections. Declared policy, observed workspace/GitHub facts, validation results, decision, and output projections remain separate. Canonical state includes `observedBaseSha`, `baseAncestryState`, and `mergeContextDigest`. The trust-root document and observed envelope are separate data models; the policy `acceptedMainSha` is lineage-only and never trust authority. Resumable receipts bind repository, base/head, workspace content, policy, registry, graph, command, toolchain, and environment digests and are optimization-only. Generated `codex-v132-benchmark` JSON `verificationMetrics` is the single machine source for output sizes and benchmark timing.

## APIs

Source harness APIs are exported from `scripts/codex-v132-*.mjs`. `scripts/codex-v132-collect-remote-evidence.mjs` is the supported production collector CLI; it re-observes Pull Request and Compare API state, and its serialized receipt remains non-authoritative until re-observed. No product or runtime API changes.

## Design Decisions

- `mergeAllowed` is the only canonical merge projection. Legacy `mergeReady` and quality-score views are non-authoritative compatibility data and are absent from the v1.3.2 Source summary.
- Strict JSON rejects exact, escaped-equivalent, and case-fold key collisions before native parsing.
- Missing, malformed, unsupported-host, lookalike, or mismatched origins fail closed. Workspace identity binds git top-level, origin, repository, base/head, AGENTS marker, and Source manifest marker.
- Unknown pre-runner failures are `unavailable_pre_runner`; only an observed authoritative billing annotation yields `unavailable_billing`.
- A current base that is not an ancestor of the exact head is stale evidence, never remote pass. `workflow_dispatch` has explicit `not_applicable` base applicability.
- `activeHarnessVersion` is a deprecated execution-compatibility alias with no published authority. `acceptedMainVersion` is published authority and `candidateVersion` is unmerged.
- Unknown paths run the full local gate; unknown target paths are rejected.
- Bounded samples retain exact counts and digests instead of unbounded arrays.
- v1.3.1, v1.3.0, and v1.2.9 remain immediate, secondary, and emergency rollback respectively.
- Compatibility debt due now is reclassified with a reason, not silently extended.
- `acceptedMainVersion`, `developmentParentVersion`, `candidateVersion`, `executionHarnessVersion`, and `candidateLifecycleState` are distinct. Source candidate display is separate from target-installed state; rollout remains not started.
- Benchmark coverage comes from node output digests. Output reduction is separate from unproven relative performance.
- Remote collection uses only `CODEX_V132_COLLECTOR_TOKEN`, backed by an owner-managed GitHub App or fine-grained PAT with Metadata, Contents, Actions, Pull requests, Administration, and Checks read. It is never exposed to ordinary product workflows and cannot create Final Decision authority.
- Ruleset workflow support is explicitly SHA-pinned-only in v1.3.2. Missing SHA is an unsupported fail-closed state, not an implicit malformed-ruleset claim.

## Constraints

No activation, target rollout, target mutation, product/runtime/package/lockfile/deploy/wallet/RPC/secret change, Performance Track, Fable comparison, SDK benchmark, Skill runtime, DAG runtime, agent-team runtime, merge, manual Actions rerun, or workflow dispatch is allowed in this candidate.

## Known Limitations

- The candidate must be rebased after v1.3.1 is accepted on main.
- The accepted-main trust-root document is not yet available on accepted main. Its SHA-free document can be committed normally; only a later GitHub observation of the accepted default-branch HEAD and blob can make an envelope trusted.
- Remote CI is not observed; no remote approval, activation, or merge readiness is claimed.
- Remote runner-step behavior remains unverified because current automatic jobs fail before steps.
- Accepted-main trust bootstrap and exact current-base remote evidence remain unavailable, so `mergeAllowed=false`.
- Workflow topology parsing is conservative static analysis, not a full YAML semantic proof.
- Dynamic repository observations are intentionally absent from static Source manifests.
