# Next Task

## Highest-Priority Next Task

Review the exact pushed HARNESS v1.3.2 Trust Bootstrap Closure on Draft PR #165. Confirm the SHA-free trust document/envelope, exact workflow/check/ruleset bindings, collector credential isolation, and artifact resource limits. Inspect one automatic required-check attempt without rerunning it. Do not activate or roll out targets.

## Required Files

- `docs/process/CODEX_V132_POLICY.json`
- `docs/process/CODEX_V132_SPEC.md`
- `docs/process/CODEX_EFFECTIVE_POLICY.compact.json`
- `CODEX_SOURCE_HARNESS_MANIFEST.json`
- `docs/process/CODEX_HARNESS_MANIFEST.json`
- `docs/process/CODEX_ACTIVE_POLICY_INDEX.json`
- `scripts/codex-v132-*.mjs`
- `scripts/codex-workflow-quality-runner.mjs`
- `scripts/codex-v132-evidence-truth.mjs`
- `scripts/codex-v132-collect-remote-evidence.mjs`
- `scripts/codex-v132-compatibility-invariants.mjs`
- `.github/workflows/quality-gate.yml`
- `.github/workflows/v132-compatibility-gate.yml`

## Implementation Strategy

1. Review the non-self-referential trust envelope, exact required-workflow set, app-bound checks, Ruleset identity, bounded artifact parser, Final Decision digest, and compatibility in PR #165.
2. Keep remote state `not_observed` while jobs cannot start; do not rerun blindly.
3. Treat owner-key trust-document bootstrap and owner-managed collector credential setup as separate owner-governed actions; never authorize either from the candidate branch.
4. After v1.3.1 main acceptance, rebase and recompute policy, workspace, and receipt digests if inputs change.
5. Run strict projections, compact/full gates, workflow adapter negatives, two-run/ruleset/tamper fixtures, compatibility lanes, parser equivalence, actionlint, and the bounded benchmark.
6. Confirm local pass still yields `mergeAllowed=false` until trusted exact-head remote evidence and Final Decision exist.

## Expected Risks

- Rebase conflicts in active tuple, workflow, or project-memory files.
- New v1.3.1 main changes can invalidate benchmark comparison and receipt digests.
- Remote checks may remain unavailable.
- A trust-root or required-check contract placed only on the candidate branch must remain non-authoritative; the collector must observe accepted main.

## Validation Steps

- `git diff --check`
- `node scripts/codex-v132-self-test.mjs --stage=all`
- `CODEX_HARNESS_SOURCE_REPO=1 CODEX_HARNESS_MODE=core CODEX_PROFILE_COMPAT_MODE=optional CODEX_QUALITY_REPORT=json node scripts/codex-local-quality-gate.mjs`
- Repeat with `CODEX_V132_DIAGNOSTICS=1` once after compact pass.
- Run actionlint over all workflow files.
- Run `node scripts/codex-v132-benchmark.mjs` with one warm-up and five measured runs per side.
- Treat its `verificationMetrics` object as the only machine metric source.

## Stop Conditions

Stop on target/product/sensitive mutation, authority weakening, candidate-controlled trust, output-limit breach, unobserved remote pass, or merge permission without exact typed remote evidence and Final Decision.

## Estimated Complexity

Medium. The Source body is locally complete; remaining work is independent review, owner-key bootstrap, rebase-sensitive verification, and exact-head remote validation, not feature expansion.
