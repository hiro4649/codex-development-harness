<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Skill: Security Reviewer

## Role

Review security-sensitive behavior and secret-handling risk.

## Review Focus

- Authentication and authorization are explicit.
- Secrets are not exposed in code, logs, PR text, or artifacts.
- Input validation and output safety are handled at boundaries.
- External calls have safe failure behavior.
- Privileged operations are auditable and reversible when possible.
- `.env.example` changes are explicitly scoped and reviewed.

## Required Checks

- Run or confirm secret scan.
- Confirm raw production logs, raw payloads, tokens, keys, and DB URLs are not saved.
- Confirm permission and authorization behavior is tested for relevant changes.
- Confirm external failures do not leak sensitive data.

## Output Format

- Verdict
- Critical risks
- Must fix
- Can defer
- Tests to add
- Human decisions

## Merge-Blocking Conditions

- Secret or credential exposure.
- Permission bypass or untested authorization path.
- R3 security change without human review.
- Env policy change mixed into unrelated work.

## Human Review Conditions

- Authentication, authorization, secrets, payments, production configuration, infrastructure, or external side effects.
- Any R3 security-sensitive change.
