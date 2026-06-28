# Project Status

## Current Branch

`codex/v131-operational-convergence-core-local`

## Current Commit SHA

Base local HEAD before this work: `24437a08791ae2508e9b4d2e5f32b1e337a0bda8`

Current branch is pushed to GitHub as PR #164. The exact current commit SHA is recorded in git and PR metadata rather than embedded here.

## Open PRs

- `hiro4649/codex-development-harness` PR #164: `[codex] Add HARNESS v1.3.1 Operational Convergence Core`
- PR #164 is stacked after the v1.3.0 Final Freeze branch/PR lineage. It must not merge before the v1.3.0 final-freeze relationship is resolved.

## Completed Work

- Implemented HARNESS v1.3.1 Operational Convergence Core as Source body only.
- Added v131 policy/spec documents.
- Added v131 operational convergence module and self-test.
- Updated Source manifests, active policy index, README, AGENTS, harness version script, local quality gate, orchestration capsule, and Source workflow markers to v1.3.1.
- Preserved Final Decision authority.
- Preserved Compatibility Adapter as internal-only evidence.
- Kept Performance Track deferred and superiority not proven.
- Kept target rollout out of scope.
- Pushed the v1.3.1 Source branch and opened PR #164 for external review.
- Removed BOM from load-bearing scripts/workflows and preserved both v1.3.0 and v1.3.1 markers in workspace identity compatibility.
- Re-scoped the v1.3.1 `harness_source_body` profile so v1.3.0 spec is a compatibility reference, not a hot required read.
- Hardened v1.3.1 edge cases for git worktree identity, metadata target profile drift, and merge attempts while remote CI is blocked.
- Added explicit `mergeAllowed=false` projection to Remote CI Cost Gate and Decision Capsule v2 so blocked or pending remote validation cannot appear merge-ready.
- Added explicit `remoteRequiredChecksPassed=false`, `requiredCheckBypassAllowed=false`, and `localPassPromotedToRemotePass=false` projection to prevent remote evidence ambiguity.
- Replaced Workspace Identity remote substring matching with exact GitHub `owner/repo` slug matching, including a misleading-remote regression fixture.
- Hardened Target Profile Installer Dry Run sensitive diff detection for nested package/lockfile, runtime, contract, env, and product source paths.

## Remaining Work

- Review PR #164 after the latest Target Profile Installer Dry Run sensitive-scope hardening commit is pushed.
- Resolve whether PR #164 remains stacked after the v1.3.0 Final Freeze PR/branch or is intentionally superseding it. Current policy: stacked after v1.3.0, not superseding.
- Run normal required checks once after GitHub Actions is available.
- Do not install v1.3.1 into target repositories until a separate rollout task is authorized.

## Active Blockers

- GitHub Actions billing/account lock prevents trusted remote CI.
- Remote v1.3.1 PR evaluation is blocked before runner steps while billing/account lock remains.
- PR #164 must not merge until the v1.3.0 final-freeze relationship is resolved and remote checks can run.

## Risks

- v1.3.1 touches load-bearing Source harness policy and quality gate paths.
- Remote checks may expose workflow-only issues not visible locally.
- Target rollout must remain separate to avoid mixing Source body changes with target installation.

## Test Status

- `git diff --check`: pass
- `node scripts/codex-v131-self-test.mjs --stage=all`: pass
- Source core local quality gate JSON: pass, `mergeReady=true`, `v131SelfTestStatus=pass`, `qualityScore=100`, `blockingCount=0`

## CI Status

Remote CI has not produced trusted runner-step evidence. GitHub Actions remain unavailable due billing/account lock; do not rerun blindly.
