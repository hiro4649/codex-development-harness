# Next Task

## Highest-Priority Next Task

Review the HARNESS v1.3.2 P0 Integration Closure on Draft PR #165. After v1.3.1 is accepted on main, rebase and repeat exact validation. Do not activate or roll out targets.

## Required Files

- `docs/process/CODEX_V132_POLICY.json`
- `docs/process/CODEX_V132_SPEC.md`
- `CODEX_SOURCE_HARNESS_MANIFEST.json`
- `docs/process/CODEX_HARNESS_MANIFEST.json`
- `docs/process/CODEX_ACTIVE_POLICY_INDEX.json`
- `scripts/codex-v132-*.mjs`
- `.github/workflows/quality-gate.yml`
- `.github/workflows/v132-compatibility-gate.yml`
- `scripts/codex-workflow-quality-runner.mjs`

## Implementation Strategy

1. Review execution attestations, trusted collector boundary, compact workflow adapter, and compatibility projection in PR #165.
2. Keep remote state `not_observed` while jobs cannot start; do not rerun blindly.
3. After v1.3.1 main acceptance, rebase and recompute policy digests if inputs change.
4. Run strict projections, compact/full gates, workflow adapter, compatibility lanes, parser equivalence, and comparable benchmark.
5. Confirm local pass still yields `mergeAllowed=false` until trusted exact-head remote evidence and Final Decision exist.

## Expected Risks

- Rebase conflicts in active tuple, workflow, or project-memory files.
- New v1.3.1 main changes can invalidate benchmark comparison and receipt digests.
- Remote checks may remain unavailable.

## Validation Steps

- `git diff --check`
- `node scripts/codex-v132-self-test.mjs --stage=all`
- `CODEX_HARNESS_SOURCE_REPO=1 CODEX_HARNESS_MODE=core CODEX_PROFILE_COMPAT_MODE=optional CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs`
- Repeat with `CODEX_V132_DIAGNOSTICS=1` once after compact pass.

## Stop Conditions

Stop on target/product/sensitive mutation, authority weakening, output-limit breach, unobserved remote pass, or merge permission without exact typed remote evidence and Final Decision.

## Estimated Complexity

Medium. The architecture is complete locally; the remaining work is rebase-sensitive verification, not feature expansion.
