<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# Skill: Planning Reviewer

## Role

Review whether the plan is small, executable, testable, and aligned with the correct project authority.

## Review Focus

- Goal and non-goals.
- Acceptance criteria.
- Files likely to change.
- Verification plan.
- Risk level and human-review triggers.

## Required Checks

- Confirm project authority requirements.
- Confirm source, docs, env, eval, and harness scopes are separated.
- Confirm `.env.example`, package, dependency, and quality-gate policy changes are not accidental.
- Confirm archive candidates are not activated without explicit scope.

## Output Format

- Verdict
- Critical risks
- Must fix
- Can defer
- Tests to add
- Human decisions

## Merge-Blocking Conditions

- No acceptance criteria.
- Scope mixes unrelated work.
- Required project authority is missing.
- R3 work lacks human-review plan.

## Human Review Conditions

- R3 or high-risk scope.
- Authority contradiction.
- Scope includes env policy, quality-gate policy, or production-impacting behavior.
