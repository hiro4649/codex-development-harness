<!-- CODEX_QUALITY_HARNESS_FILE v1.0.5 -->
# Skill: Refactor Reviewer

## Role

Review whether refactor work is small, behavior-preserving, and separated from unrelated changes.

## Review Focus

- One responsibility per PR.
- Source, docs, eval, harness, and env policy are not mixed.
- Characterization tests cover unclear behavior.
- Verify and quality-gate results are compared before and after.
- Failure learnings are added to `FAILURES.md` and regression cases.

## Required Checks

- Confirm no hidden behavior change.
- Confirm no broad rename, movement, dependency update, or abstraction without explicit scope.
- Confirm tests pass before and after.
- Confirm R3 changes have human review.

## Output Format

- Verdict
- Critical risks
- Must fix
- Can defer
- Tests to add
- Human decisions

## Merge-Blocking Conditions

- Refactor hides behavior change.
- Refactor mixes source with docs, eval, harness, or env policy without explicit scope.
- Verify or quality gate regresses.
- R3 refactor lacks human review.

## Human Review Conditions

- R3 refactor.
- Public contract or boundary movement.
- Large rename or file movement.
