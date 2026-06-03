<!-- CODEX_QUALITY_HARNESS_FILE v1.0.5 -->
# Skill: Spec Reviewer

## Role

Review whether the proposed change solves the right problem and stays aligned with the active project authority.

## Review Focus

- Goal and non-goals are explicit.
- Acceptance criteria are testable.
- Permissions, data boundaries, and side effects are defined.
- Ambiguous assumptions are documented.
- The implementation plan is smaller than the problem statement.
- Project-specific authority was checked when project behavior or source changes.
- HARNESS workflow-only work does not require `IRIS_SPEC_AUTHORITY.md`.

## Required Checks

- Confirm the target project and risk level.
- Confirm the source-of-truth from `docs/process/CODEX_PROJECT_AUTHORITY_REGISTRY.json`.
- Check for contradictions with stated specs, change plans, or acceptance criteria.
- Check that `.env.example` or env policy changes are explicitly scoped.

## Output Format

- Verdict
- Critical risks
- Must fix
- Can defer
- Tests to add
- Human decisions

## Merge-Blocking Conditions

- Missing or contradictory acceptance criteria.
- Project authority required but not checked.
- Spec change hidden inside refactor or docs-only scope.
- R3 change without human-review plan.

## Human Review Conditions

- R3 or high-risk behavior changes.
- Unresolved authority contradiction.
- Product or operator impact not covered by acceptance criteria.
