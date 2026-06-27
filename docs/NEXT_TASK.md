# Next Task

## Highest-Priority Next Task

Finalize local-only HARNESS v1.3.0 Core Final Freeze Candidate and request owner approval before any remote action.

## Required Files

- `.github/workflows/quality-gate.yml`
- `.github/workflows/weekly-health-check.yml`
- `CODEX_SOURCE_HARNESS_MANIFEST.json`
- `docs/process/CODEX_HARNESS_MANIFEST.json`
- `docs/process/CODEX_ACTIVE_POLICY_INDEX.json`
- `scripts/codex-v130-self-test.mjs`
- `docs/PROJECT_SPEC.md`
- `docs/PROJECT_STATUS.md`
- `docs/NEXT_TASK.md`
- `docs/CHANGELOG.md`

## Implementation Strategy

1. Inspect the local commit and verify it is Source harness-only.
2. Confirm no target repository or product/runtime/package/lockfile files are changed.
3. Request owner approval before any push, PR creation, or remote workflow dispatch.
4. If approved, push the branch and run only the required remote checks once.

## Expected Risks

- Remote Actions may still be blocked by billing/quota state.
- Remote validation remains `Needs verification.`
- Consumers of the old `target_rollout` active policy profile may need compatibility review.

## Validation Steps

- `git diff --check`
- `node scripts/codex-v130-self-test.mjs --stage=all`
- Source core local quality gate with `CODEX_HARNESS_SOURCE_REPO=1`, `CODEX_HARNESS_MODE=core`, `CODEX_PROFILE_COMPAT_MODE=optional`, `CODEX_REQUIRE_NPM=1`, and `CODEX_QUALITY_REPORT=json`
- Remote `quality-gate` and `v130-shadow-gate` only after owner approval
- Extra grep checks for accidental v1.3.1, Performance Track activation, Fable superiority, target rollout, self-approval, or GitHub approval review wording

## Stop Conditions

- Project memory and machine policy disagree.
- A new status family, new artifact family, required check, Skill, SDK benchmark, Fable comparator, DAG runtime, subagent runtime, v1.3.1, or target rollout appears.
- Product/runtime/package/lockfile/deploy/wallet/RPC/secret mutation appears.
- Remote CI would be required before owner approval.

## Remote CI Rule

No remote CI without owner approval. Estimated GitHub Actions impact must be reported before any future remote run.

## Estimated Complexity

Medium. The code change is metadata-focused, but policy/profile naming and workflow pinning affect load-bearing harness paths.
