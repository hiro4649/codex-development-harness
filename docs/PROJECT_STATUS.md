# Project Status

## Current Branch

`codex/v132-evidence-converged-lean-core-local`

## Current Commit SHA

Accepted-Main Trust Closure implementation parent: `a73a95aa4eb5b0fbf3055c5c013a622982288359`. The exact final SHA is the branch/PR head and is intentionally read from Git rather than embedded in its own commit. Provisional base: `35fbdd0e7075701516de3b2de722b3b7014f1dbf`.

## Open PRs

Draft PR #165 is open from this v1.3.2 branch. PR #164 remains its provisional v1.3.1 base.

## Completed Work

- Added typed declared/observed/validation/decision/projection state and one canonical `mergeAllowed` projection.
- Removed workspace-repository fallback and bound identity to top-level, origin, repository, base/head, AGENTS, and Source manifest markers.
- Added accepted-main Ed25519 trust-root loading with key ID, fingerprint, rotation, revocation, and candidate self-authorization rejection.
- Anchored accepted-main identity to the GitHub-observed protected Source default-branch HEAD.
- Added one shared classic-protection/Ruleset snapshot for multi-run evidence aggregation.
- Bound GitHub evidence to PR/event/base/head/workflow ID/path/content/runs/required checks/artifact values/observation time, with distinct billing and unknown pre-runner states.
- Added strict manifest compilation, eight-repository Registry v2, and a 1585-byte routine effective policy.
- Added deterministic incremental validation, digest-bound optimization receipts, bounded output, target dry-run, CI cost, debt, and long-run controls.
- Added a GitHub API collector and workflow adapter that reject repository/head mismatch and contradictory pass reports.
- Added executable bounded v1.3.1/v1.3.0/v1.2.9/v1.2.8/v1.2.7 behavior contracts without reactivating historical self-tests.
- Added a v1.3.2 lean Source workflow path and an eight-line Step Summary; pinned all used workflow actions.
- Verified workflow syntax with actionlint 1.7.12 and its official checksum.
- Marked `activeHarnessVersion` as a non-authoritative deprecated execution alias across generated projections.
- Made generated benchmark JSON `verificationMetrics` the single metric source.

## Remaining Work

- Review the Accepted-Main Trust Closure on Draft PR #165.
- Rebase onto accepted v1.3.1 main later and rerun exact local and remote checks.
- Bootstrap the accepted-main trust root through owner-governed accepted-main policy; the candidate cannot bootstrap itself.
- Target installation remains a later, separately authorized project.

## Active Blockers

- v1.3.1 is not yet accepted on main.
- Remote evidence is `not_observed`; Final Decision is not authorized; activation and target rollout are forbidden.

## Risks

- Rebase may change policy or workflow inputs and invalidate all optimization receipts.
- Branch protection/ruleset observation may expose a different required-check set; remote confirmation is pending.
- GitHub workflow-content and artifact-value bindings require runner-step evidence before release acceptance.
- The accepted-main trust-root bootstrap must not be performed from the candidate branch.

## Test Status

Local v1.3.2 self-test passes 29/29, including candidate-owned trust, detached-main, classic protection, Ruleset-only, two-run aggregation, workflow-content tamper, and artifact-value tamper fixtures. Compact/full Source gates, workspace identity negatives, workflow adapter negatives, parser equivalence, behavioral compatibility lanes, and actionlint are required before push. Exact output sizes and timings come only from generated benchmark JSON `verificationMetrics`; superiority remains not proven.

## CI Status

Draft PR #165 exists. The last inspected automatic runs on predecessor head `a73a95aa4eb5b0fbf3055c5c013a622982288359` failed with zero steps and an account-billing-lock annotation. No manual rerun or `workflow_dispatch` was performed. Exact-head runner evidence for this closure remains `not_observed`; the prior failure is not code execution evidence.
