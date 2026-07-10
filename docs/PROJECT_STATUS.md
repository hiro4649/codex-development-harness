# Project Status

## Current Branch

`codex/v132-evidence-converged-lean-core-local`

## Current Commit SHA

The exact candidate SHA is read from the local branch and current PR rather than embedded in its own commit. The provisional v1.3.1 base is also resolved from Git before validation.

## Open PRs

Draft PR #165 is open from this v1.3.2 branch. PR #164 remains its provisional v1.3.1 base.

## Completed Work

- Added typed declared/observed/validation/decision/projection state and one canonical `mergeAllowed` projection.
- Removed workspace-repository fallback and bound identity to top-level, origin, repository, base/head, AGENTS, and Source manifest markers.
- Added a SHA-free accepted-main Ed25519 trust document plus a GitHub-observed repository/default-branch/HEAD/blob/path envelope; Final Decision binds its effective digest.
- Added a real-git bootstrap fixture and rejection of candidate head, alternate path/repository, and non-default branch substitution.
- Added one shared classic-protection/Ruleset snapshot for multi-run evidence aggregation.
- Bound GitHub evidence to the exact accepted-main required-workflow set, latest attempts, check app identities, Ruleset path/ref/SHA/repository identity, artifact values, and observation time.
- Added strict manifest compilation, eight-repository Registry v2, and a generated routine effective policy within its byte limit. Exact size comes only from the latest benchmark `verificationMetrics`.
- Added deterministic incremental validation, digest-bound optimization receipts, bounded output, target dry-run, CI cost, debt, and long-run controls.
- Added an owner-credential production collector CLI and bounded ZIP parser; serialized receipts remain non-authoritative.
- Bound the collector to the GitHub-observed current PR and exact head, with authoritative latest-run discovery independent of CLI hint order.
- Persisted passed, billing-unavailable, pre-runner-unavailable, queued, in-progress, canceled, and failed observations while keeping all non-passed states non-authoritative and merge-blocking.
- Added deterministic mock GitHub API integration coverage from default-branch trust observation through receipt re-observation.
- Added executable bounded v1.3.1/v1.3.0/v1.2.9/v1.2.8/v1.2.7 behavior contracts without reactivating historical self-tests.
- Added a v1.3.2 lean Source workflow path and an eight-line Step Summary; pinned all used workflow actions.
- Verified workflow syntax with actionlint 1.7.12 and its official checksum.
- Marked `activeHarnessVersion` as a non-authoritative deprecated execution alias across generated projections.
- Made generated benchmark JSON `verificationMetrics` the single metric source.
- Bound all four automatic Source jobs to the exact PR head, disabled persisted checkout credentials, and added an immediate checkout assertion. Only the two Source harness workflows changed; no target or product workflow changed.

## Remaining Work

- Review the Exact-Head Workflow Closure on Draft PR #165.
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

The required local closure suite covers exact-head workflow semantics, synthetic-merge rejection, report/artifact head binding, real-git trust bootstrap, production collector mock E2E, latest-run selection, queued/in-progress/canceled truth, unavailable receipts, parser equivalence, compatibility lanes, actionlint, and the bounded benchmark. Exact sizes and timings come only from generated benchmark JSON `verificationMetrics`; coverage remains non-comparable and superiority remains not proven.

## CI Status

Draft PR #165 exists. Exact current PR head and automatic run state are read dynamically from GitHub and are not embedded here. The most recent observation ended all four jobs before runner steps because of the account billing lock. No manual rerun or `workflow_dispatch` was performed; runner evidence remains unavailable, not code execution evidence.
