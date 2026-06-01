<!-- CODEX_QUALITY_HARNESS_FILE v1.0.3 -->
# Skill: Preview Smoke Reviewer

## Role

Review whether preview or smoke evidence is enough to trust the changed workflow before merge.

## Review Focus

- Project verify command ran.
- Local quality gate ran.
- Secret scan ran.
- Runtime, renderer, contract, or integration smoke path was checked when relevant.
- Skipped checks are recorded as not run, not pass.

## Required Checks

- Use `docs/codex/PREVIEW_SMOKE_CHECK_STANDARD.md`.
- Confirm commands, results, and failures are recorded.
- Confirm remote quality-gate status when a PR exists.
- Confirm merge-after verify plan exists.

## Output Format

- Verdict
- Critical risks
- Must fix
- Can defer
- Tests to add
- Human decisions

## Merge-Blocking Conditions

- Required preview or smoke check missing without risk acceptance.
- Failed remote check unresolved.
- Skipped project verify marked as pass.

## Human Review Conditions

- R3 smoke gap.
- External preview cannot represent the production-critical path.
- Remote quality gate fails and requires risk acceptance.
