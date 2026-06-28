# Changelog

## 2026-06-28

- Implemented HARNESS v1.3.1 Operational Convergence Core locally as Source body only.
- Added Workspace Identity Gate, Manifest Strict Validator, Validation State Machine, Target Profile Drift Linter, Remote CI Cost Gate, Decision Capsule v2, Compatibility Debt Ledger, Target Profile Installer Dry Run, and Product Value Return Gate advisory surfaces.
- Added v131 policy, spec, module, and self-test.
- Updated Source manifests and active policy metadata to `activeHarnessVersion=1.3.1` and `activeSelfTestSuite=v131`.
- Kept Compatibility Adapter internal-only and non-authoritative.
- Kept Performance Track deferred and superiority not proven.
- Did not start target rollout.
- Did not mutate target repositories.
- Did not change product/runtime/package/lockfile/deploy/wallet/RPC/secret files.
- Did not run GitHub Actions.
- Opened Source PR #164 for external review.
- Repaired PR #164 review blockers: removed BOM from load-bearing files, restored v1.3.0 marker compatibility beside v1.3.1, clarified project memory, and removed v1.3.0 spec from the v1.3.1 source-body hot required reads.
- Hardened v1.3.1 convergence edge cases: git worktree identity resolution, metadata target profile drift detection, and explicit merge failure while remote CI is blocked.
- Added explicit non-authoritative merge-readiness projection: Remote CI Cost Gate and Decision Capsule v2 now report `mergeAllowed=false` until remote validation is truly passed.
- Added remote evidence ambiguity hardening: Remote CI Cost Gate and Decision Capsule v2 now expose `remoteRequiredChecksPassed=false`, `requiredCheckBypassAllowed=false`, and `localPassPromotedToRemotePass=false` when remote checks have not actually passed.
- Hardened Workspace Identity remote matching by parsing GitHub remote URLs to exact `owner/repo` slugs and rejecting misleading substring matches.
- Hardened Target Profile Installer Dry Run sensitive diff detection for nested package/lockfile, runtime, contract, env, and product source paths without enabling target mutation.
- Hardened Target Profile Installer Dry Run to detect `CODEX_SOURCE_HARNESS_MANIFEST.json` anywhere in changed file paths as a forbidden source manifest copy.
- Added safe source manifest copy path/count reporting to Target Profile Installer Dry Run.
- Bounded Target Profile Installer Dry Run report arrays for changed files, reason codes, and Source manifest copy paths while preserving exact counts and omitted counts.
