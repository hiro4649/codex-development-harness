# Project Specification

## Current Architecture

HARNESS v1.3.2 Evidence-Converged Lean Core is a Draft Source-only candidate on provisional v1.3.1 PR head `35fbdd0e7075701516de3b2de722b3b7014f1dbf`. It comprises a durable Evidence Truth Kernel, strict manifest compiler, Registry v2, executable incremental validation graph, content-addressed resumable receipts, bounded output, advisory compiled context envelope, allowlist target dry-run planner, workflow-parsed CI cost planner, and bounded compatibility invariant runner.

## Functional Specifications

- Remote, same-head, check-set, artifact, and Final Decision states require GitHub API re-observation or an Ed25519-verified Final Decision receipt; structurally valid JSON alone is untrusted.
- Canonical state is `localValidationState`, `remoteValidationState`, `technicalMergeEligibility`, `finalDecisionState`, and `mergeAllowed`.
- Local-only pass leaves remote `not_observed`, technical eligibility blocked, and `mergeAllowed=false`.
- Exact digest-bound validation may reuse only schema-valid, output-digest-valid results from the current executor. Committed, staged, unstaged, untracked-content, file-mode, or symlink-target changes invalidate reuse.
- The compiled context proposal is limited to 7168 bytes and classified `compiled_advisory_contract`, not runtime enforcement.
- Compact output is limited to 8192 bytes and 64 top-level fields; full diagnostics are opt-in.
- Target planning is allowlist-based, fail-closed, dry-run only, and has no mutation authority.
- CI cost is parsed from actual workflow files; current Source PR topology is two workflows and four jobs, with no matrix expansion.
- Compatibility lanes require source presence, projection validity, and bounded behavior invariants under the v1.3.2 tuple.
- Long-run accounting measures direct subprocesses, harness writes, retries, and persisted checkpoints instead of treating each node as one tool call.

## Data Models

The normative model is `docs/process/CODEX_V132_POLICY.json`. Re-observed remote and signature-verified Final Decision receipts feed the canonical state contract. Static repository classification is immutable owner input; dynamic GitHub and target-installed observations are expiring evidence. Resumable receipts bind repository, base/head, workspace content, policy, registry, graph, toolchain, and environment digests.

## APIs

Source harness APIs are exported from `scripts/codex-v132-*.mjs`. No product or runtime API changes.

## Design Decisions

- `mergeAllowed` is the only canonical merge projection; the local-ready alias is explicitly non-authoritative.
- Strict JSON rejects exact, escaped-equivalent, and case-fold key collisions before native parsing.
- Unknown paths run the full local gate; unknown target paths are rejected.
- Bounded samples retain exact counts and digests instead of unbounded arrays.
- v1.3.1, v1.3.0, and v1.2.9 remain immediate, secondary, and emergency rollback respectively.
- Compatibility debt due now is reclassified with a reason, not silently extended.
- Source candidate display is separate from per-repository target-installed state; rollout remains not started.
- Benchmark coverage comes from node output digests. Output reduction is separate from unproven relative performance.

## Constraints

No activation, target rollout, target mutation, product/runtime/package/lockfile/deploy/wallet/RPC/secret change, Performance Track, Fable comparison, SDK benchmark, Skill runtime, DAG runtime, agent-team runtime, merge, manual Actions rerun, or workflow dispatch is allowed in this candidate.

## Known Limitations

- The candidate must be rebased after v1.3.1 is accepted on main.
- Remote CI is not observed; no remote approval is claimed.
- Remote runner-step behavior remains unverified because current automatic jobs fail before steps.
- Dynamic repository observations are intentionally absent from the static Source manifest.
