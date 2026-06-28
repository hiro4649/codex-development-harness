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
