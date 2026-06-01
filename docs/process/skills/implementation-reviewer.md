<!-- CODEX_QUALITY_HARNESS_FILE v1.0.3 -->
# Skill: Implementation Reviewer

## Role

Review the implementation for minimality, correctness, maintainability, and fit with existing project patterns.

## Review Focus

- The diff is limited to the stated scope.
- No unrelated refactor, rename, or dependency change is mixed in.
- Errors are handled without hiding failures.
- Data validation is close to the boundary.
- The code follows existing project patterns.
- Source, docs, env, eval, and harness changes are not mixed unless explicitly scoped.

## Required Checks

- Confirm no source changes are present for docs-only work.
- Confirm no `.env.example` or package changes are present unless explicitly scoped.
- Confirm no quality-gate policy weakening.
- Confirm no archive candidates are activated without explicit scope.
- Confirm failures are surfaced rather than swallowed.

## Output Format

- Verdict
- Critical risks
- Must fix
- Can defer
- Tests to add
- Human decisions

## Merge-Blocking Conditions

- Diff includes unrelated files or hidden behavior changes.
- Boundary validation is moved to the wrong layer.
- Failure handling hides errors.
- Quality gate, verify, or test policy is weakened.

## Human Review Conditions

- R3 source change.
- Large refactor or file movement.
- Public contract, adapter handoff, or runtime normalization changes.
