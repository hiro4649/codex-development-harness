# Project Specification

## Current Architecture

HARNESS v1.3.2 Evidence-Converged Lean Core is a Draft Source-only candidate on provisional v1.3.1 PR head `35fbdd0e7075701516de3b2de722b3b7014f1dbf`. It comprises a trusted Evidence Truth Kernel, strict manifest compiler, Registry v2, executable incremental validation graph, attested resumable receipts, bounded output, advisory compiled context envelope, allowlist target dry-run planner, and workflow-parsed CI cost planner.

## Functional Specifications

- Remote, same-head, check-set, artifact, and Final Decision states require verified collector receipts; structurally valid JSON alone is untrusted.
- Canonical state is `localValidationState`, `remoteValidationState`, `technicalMergeEligibility`, `finalDecisionState`, and `mergeAllowed`.
- Local-only pass leaves remote `not_observed`, technical eligibility blocked, and `mergeAllowed=false`.
- Exact digest-bound validation may reuse only schema-valid, output-digest-valid results from the current executor; changed, forged, expired, or unexecuted inputs invalidate reuse.
- The compiled context proposal is limited to 7168 bytes and classified `compiled_advisory_contract`, not runtime enforcement.
- Compact output is limited to 8192 bytes and 64 top-level fields; full diagnostics are opt-in.
- Target planning is allowlist-based, fail-closed, dry-run only, and has no mutation authority.
- CI cost is parsed from actual workflow files; current Source PR topology is two workflows and four jobs, with no matrix expansion.

## Data Models

The normative model is `docs/process/CODEX_V132_POLICY.json`. Typed remote and Final Decision receipts feed the canonical state contract. Static repository classification is immutable owner input; dynamic GitHub observation is expiring evidence. Resumable receipts bind repository, base/head, diff, policy, registry, graph, toolchain, and environment digests.

## APIs

Source harness APIs are exported from `scripts/codex-v132-*.mjs`. No product or runtime API changes.

## Design Decisions

- `mergeAllowed` is the only canonical merge projection; the local-ready alias is explicitly non-authoritative.
- Strict JSON rejects exact, escaped-equivalent, and case-fold key collisions before native parsing.
- Unknown paths run the full local gate; unknown target paths are rejected.
- Bounded samples retain exact counts and digests instead of unbounded arrays.
- v1.3.1, v1.3.0, and v1.2.9 remain immediate, secondary, and emergency rollback respectively.
- Compatibility debt due now is reclassified with a reason, not silently extended.

## Constraints

No activation, target rollout, target mutation, product/runtime/package/lockfile/deploy/wallet/RPC/secret change, Performance Track, Fable comparison, SDK benchmark, Skill runtime, DAG runtime, agent-team runtime, or remote action is allowed in this local candidate.

## Known Limitations

- The candidate must be rebased after v1.3.1 is accepted on main.
- Remote CI is not observed; no remote approval is claimed.
- Remote runner-step behavior remains unverified because current automatic jobs fail before steps.
- Dynamic repository observations are intentionally absent from the static Source manifest.
