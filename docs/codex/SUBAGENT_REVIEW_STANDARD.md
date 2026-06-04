<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Subagent Review Standard

## Minimum Reviews

AI review must be split into at least three perspectives:

- Spec alignment review
- Test coverage review
- Implementation boundary review

Use separate reviewer prompts or skill files so each review can disagree independently. Do not collapse the three reviews into one generic approval.

## R3 Additions

For R3 changes, add:

- Security review
- Boundary review
- Human review

R3 approval is not complete until the human review is recorded.

## Output Format

Each review must output:

- Verdict
- Critical risks
- Must fix
- Can defer
- Tests to add
- Human decisions

## Merge-Blocking Rules

Block merge when a review finds a spec contradiction, missing required test plan, boundary violation, unreviewed R3 risk, `.env.example` change without explicit scope, secret exposure risk, or a failed verify / quality gate not accepted by a human owner.
