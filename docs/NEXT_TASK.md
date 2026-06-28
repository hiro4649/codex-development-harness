# Next Task

## Highest-Priority Next Task

Review HARNESS v1.3.1 PR #164 after Source harness-only Target Profile Installer Dry Run source-manifest path guard hardening.

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

1. Keep PR #164 Source harness-only.
2. Confirm git worktree identity, exact remote slug matching, metadata target profile drift, sensitive target diff dry-run detection, source manifest path rejection, blocked-CI merge action, explicit `remoteRequiredChecksPassed=false`, and `mergeAllowed=false` fixtures remain covered by v131 self-test.
3. Treat PR #164 as stacked after the v1.3.0 Final Freeze lineage, not as a replacement for it.
4. Do not merge PR #164 until the v1.3.0 relationship is resolved.
5. Run normal required checks once after Actions are available.
6. If CI fails after steps start, inspect logs once and propose the smallest fix.

## Expected Risks

- Remote Actions may still be blocked.
- v1.3.1 is load-bearing Source harness policy, so review should focus on authority boundaries and report classification.
- Target rollout must not be started from this PR.
- PR #164 can be misread as superseding v1.3.0 unless the stacked relationship remains explicit.

## Validation Steps

- `git diff --check`
- `node scripts/codex-v131-self-test.mjs --stage=all`
- `CODEX_HARNESS_SOURCE_REPO=1 CODEX_HARNESS_MODE=core CODEX_PROFILE_COMPAT_MODE=optional CODEX_REQUIRE_NPM=1 CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs`

## Stop Conditions

- Product/runtime/package/lockfile/deploy/wallet/RPC/secret mutation appears.
- Target repository mutation appears.
- Performance Track, Fable comparison, SDK benchmark, Skill runtime, DAG runtime, target rollout, or v1.3.2 appears.
- Remote CI would be required while Actions remain blocked.
- PR #164 is proposed for merge before the v1.3.0 final-freeze relationship is resolved.

## Estimated Complexity

Medium-high. The feature is operational rather than product-facing, but it updates load-bearing Source quality and policy paths.
