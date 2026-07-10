# Project Status

## Current Branch

`codex/v132-evidence-converged-lean-core-local`

## Current Commit SHA

Trust Bootstrap Closure implementation parent: `fbaa12cdacd58fe0cb9fd159f0ffc4f87734e414`. The exact final SHA is the branch/PR head and is intentionally read from Git rather than embedded in its own commit. Provisional base: `35fbdd0e7075701516de3b2de722b3b7014f1dbf`.

## Open PRs

Draft PR #165 is open from this v1.3.2 branch. PR #164 remains its provisional v1.3.1 base.

## Completed Work

- Added typed declared/observed/validation/decision/projection state and one canonical `mergeAllowed` projection.
- Removed workspace-repository fallback and bound identity to top-level, origin, repository, base/head, AGENTS, and Source manifest markers.
- Added a SHA-free accepted-main Ed25519 trust document plus a GitHub-observed repository/default-branch/HEAD/blob/path envelope; Final Decision binds its effective digest.
- Added a real-git bootstrap fixture and rejection of candidate head, alternate path/repository, and non-default branch substitution.
- Added one shared classic-protection/Ruleset snapshot for multi-run evidence aggregation.
- Bound GitHub evidence to an exact required-workflow set, latest attempts, check app identities, Ruleset path/ref/SHA/repository identity, artifact values, and observation time.
- Added strict manifest compilation, eight-repository Registry v2, and a 1585-byte routine effective policy.
- Added deterministic incremental validation, digest-bound optimization receipts, bounded output, target dry-run, CI cost, debt, and long-run controls.
- Added an owner-credential production collector CLI and bounded ZIP parser; serialized receipts remain non-authoritative.
- Added executable bounded v1.3.1/v1.3.0/v1.2.9/v1.2.8/v1.2.7 behavior contracts without reactivating historical self-tests.
- Added a v1.3.2 lean Source workflow path and an eight-line Step Summary; pinned all used workflow actions.
- Verified workflow syntax with actionlint 1.7.12 and its official checksum.
- Marked `activeHarnessVersion` as a non-authoritative deprecated execution alias across generated projections.
- Made generated benchmark JSON `verificationMetrics` the single metric source.

## Remaining Work

- Review the Accepted-Main Trust Closure on Draft PR #165.
- Rebase onto accepted v1.3.1 main later and rerun exact local and remote checks.
- Bootstrap the owner-key trust document on accepted main, then observe it through the production collector; the candidate cannot bootstrap itself.
- Target installation remains a later, separately authorized project.

## Active Blockers

- v1.3.1 is not yet accepted on main.
- Remote evidence is `not_observed`; Final Decision is not authorized; activation and target rollout are forbidden.

## Risks

- Rebase may change policy or workflow inputs and invalidate all optimization receipts.
- Branch protection/ruleset observation may expose a different exact check/workflow/app identity set; remote confirmation is pending.
- GitHub workflow-content and artifact-value bindings require runner-step evidence before release acceptance.
- The accepted-main trust-root bootstrap must not be performed from the candidate branch.

## Test Status

Local v1.3.2 self-test passes 33/33, including real-git trust bootstrap, exact workflow omission/latest-attempt handling, app identity mismatch, Ruleset ref/SHA/repository mismatch, workflow/artifact tamper, and bounded ZIP fixtures. Compact/full Source gates, workflow adapter negatives, parser equivalence, behavioral compatibility lanes, actionlint, and the bounded benchmark remain required before push. Exact sizes and timings come only from generated benchmark JSON `verificationMetrics`; superiority remains not proven.

## CI Status

Draft PR #165 exists. The last inspected automatic runs on head `fbaa12cdacd58fe0cb9fd159f0ffc4f87734e414` were quality run `29082485454` and compatibility run `29082485358`; all four jobs stopped at zero steps with an account-billing-lock annotation. No manual rerun or `workflow_dispatch` was performed. Runner evidence for this closure remains `not_observed`; the failure is not code execution evidence.
