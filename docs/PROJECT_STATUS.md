# Project Status

## Current Branch

`codex/v132-evidence-converged-lean-core-local`

## Current Commit SHA

Implementation checkpoint before this project-memory synchronization: `caba097ad52cdd3c5b07eccff888599e513a36d2`. The exact final SHA is the branch/PR head; it is not embedded in its own commit to avoid a self-referential stale value. Provisional base: `35fbdd0e7075701516de3b2de722b3b7014f1dbf`.

## Open PRs

Draft PR #165 is open from this v1.3.2 branch. PR #164 remains its provisional v1.3.1 base.

## Completed Work

- Added typed declared/observed/validation/decision/projection state and one canonical `mergeAllowed` projection.
- Removed workspace-repository fallback and bound identity to top-level, origin, repository, base/head, AGENTS, and Source manifest markers.
- Added accepted-main Ed25519 trust-root loading with key ID, fingerprint, rotation, revocation, and candidate self-authorization rejection.
- Bound GitHub evidence to PR/event/base/head/workflow/runs/required checks/artifact contract/observation time, with distinct billing and unknown pre-runner states.
- Added strict manifest compilation, eight-repository Registry v2, and a 1585-byte routine effective policy.
- Added deterministic incremental validation, digest-bound optimization receipts, bounded output, target dry-run, CI cost, debt, and long-run controls.
- Added a GitHub API collector and workflow adapter that reject repository/head mismatch and contradictory pass reports.
- Added executable bounded v1.3.1/v1.3.0/v1.2.9/v1.2.8/v1.2.7 behavior contracts without reactivating historical self-tests.
- Added a v1.3.2 lean Source workflow path and an eight-line Step Summary; pinned all used workflow actions.
- Verified workflow syntax with actionlint 1.7.12 and its official checksum.

## Remaining Work

- Review the Trust Root and Parity Closure on Draft PR #165.
- Rebase onto accepted v1.3.1 main later and rerun exact local and remote checks.
- Bootstrap the accepted-main trust root through owner-governed accepted-main policy; the candidate cannot bootstrap itself.
- Target installation remains a later, separately authorized project.

## Active Blockers

- v1.3.1 is not yet accepted on main.
- Remote evidence is `not_observed`; Final Decision is not authorized; activation and target rollout are forbidden.

## Risks

- Rebase may change policy or workflow inputs and invalidate all optimization receipts.
- Branch protection/ruleset observation may expose a different required-check set; remote confirmation is pending.
- GitHub artifact archive/content digests require runner-step evidence before release acceptance.
- The accepted-main trust-root bootstrap must not be performed from the candidate branch.

## Test Status

Local v1.3.2 self-test passes 24/24. Compact Source gate passes with `mergeAllowed=false`, zero blockers, zero observed product mutation, and no authority creation. Full diagnostics, workspace identity negatives, untrusted-key negative, GitHub binding fixtures, workflow adapter negatives, parser equivalence, behavioral compatibility lanes, and actionlint pass. The most recent pre-documentation benchmark used one warm-up and five measured runs per side: v1.3.1 p50 16758.12 ms, v1.3.2 p50 13596.39 ms, compact output 6788 bytes, and 98.6394% output reduction. Coverage remains `not_comparable`; superiority is not proven.

## CI Status

Draft PR #165 exists. Its last pushed head predates the current local closure commits. Existing automatic jobs failed before runner steps. No manual rerun or `workflow_dispatch` was performed. Remote evidence remains `not_observed`; the failure is not code execution evidence.
