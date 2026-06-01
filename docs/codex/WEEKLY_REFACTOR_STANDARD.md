<!-- CODEX_QUALITY_HARNESS_FILE v1.0.3 -->
# Weekly Refactor Standard

## Rule

Weekly or periodic refactors must be split into small PRs. Each PR must have one responsibility and must preserve behavior unless explicitly scoped otherwise.

## Separation

Do not mix:

- Source
- Docs
- Eval
- Harness
- Env policy

Dependency changes, renames, file moves, and broad abstractions require explicit scope.

## Required Checks

- Confirm tests pass before starting.
- Compare verify results before and after the refactor.
- Compare quality-gate results before and after the refactor.
- Run AI review for implementation boundary and regression risk.
- Require human review for R3 changes.

## Failure Handling

If a refactor exposes or causes a failure, record it in `FAILURES.md` and add regression cases before continuing. Do not hide the failure by skipping tests, deleting checks, or weakening policy.
