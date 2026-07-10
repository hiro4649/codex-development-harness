# Next Task

## Highest-Priority Next Task

After v1.3.1 is accepted on main, rebase the local v1.3.2 candidate and repeat exact local verification. Do not activate or roll out targets during rebase.

## Required Files

- `docs/process/CODEX_V132_POLICY.json`
- `docs/process/CODEX_V132_SPEC.md`
- `CODEX_SOURCE_HARNESS_MANIFEST.json`
- `docs/process/CODEX_HARNESS_MANIFEST.json`
- `docs/process/CODEX_ACTIVE_POLICY_INDEX.json`
- `scripts/codex-v132-*.mjs`
- `.github/workflows/quality-gate.yml`

## Implementation Strategy

1. Fetch accepted main read-only and rebase the local four-commit series.
2. Recompute compiled policy digests only if the normative policy changes.
3. Run strict projections, self-test, compact gate, one opt-in diagnostic gate, and one warm-up plus five measured runs.
4. Confirm local pass still yields remote `not_observed` and `mergeAllowed=false`.
5. Report CI cost before any owner-authorized remote action.

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
