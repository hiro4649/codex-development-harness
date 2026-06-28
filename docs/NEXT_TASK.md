# Next Task

## Highest-Priority Next Task

Prepare HARNESS v1.3.1 Operational Convergence Core for review as a Source harness-only PR after GitHub Actions usage is available.

## Required Files

- `CODEX_SOURCE_HARNESS_MANIFEST.json`
- `docs/process/CODEX_HARNESS_MANIFEST.json`
- `docs/process/CODEX_ACTIVE_POLICY_INDEX.json`
- `docs/process/CODEX_V131_POLICY.json`
- `docs/process/CODEX_V131_SPEC.md`
- `scripts/codex-v131-operational-convergence.mjs`
- `scripts/codex-v131-self-test.mjs`
- `scripts/codex-local-quality-gate.mjs`
- `scripts/codex-orchestration-capsule.mjs`
- `docs/PROJECT_SPEC.md`
- `docs/PROJECT_STATUS.md`
- `docs/NEXT_TASK.md`
- `docs/CHANGELOG.md`

## Implementation Strategy

1. Review local diff for Source-only scope.
2. Commit v1.3.1 Source body locally.
3. After Actions are available, push one branch and open one Source harness-only PR.
4. Run normal required checks once.
5. If CI fails after steps start, inspect logs once and propose the smallest fix.

## Expected Risks

- Remote Actions may still be blocked.
- v1.3.1 is load-bearing Source harness policy, so review should focus on authority boundaries and report classification.
- Target rollout must not be started from this PR.

## Validation Steps

- `git diff --check`
- `node scripts/codex-v131-self-test.mjs --stage=all`
- `CODEX_HARNESS_SOURCE_REPO=1 CODEX_HARNESS_MODE=core CODEX_PROFILE_COMPAT_MODE=optional CODEX_REQUIRE_NPM=1 CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs`

## Stop Conditions

- Product/runtime/package/lockfile/deploy/wallet/RPC/secret mutation appears.
- Target repository mutation appears.
- Performance Track, Fable comparison, SDK benchmark, Skill runtime, DAG runtime, target rollout, or v1.3.2 appears.
- Remote CI would be required while Actions remain blocked.

## Estimated Complexity

Medium-high. The feature is operational rather than product-facing, but it updates load-bearing Source quality and policy paths.
