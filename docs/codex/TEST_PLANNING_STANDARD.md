<!-- CODEX_QUALITY_HARNESS_FILE v1.0.3 -->
# Test Planning Standard

## Rule

Write the test plan before implementation. The plan must state what will be tested, what existing tests already cover, and what remains unverified.

## Required Coverage Areas

- Happy path
- Error path
- Boundary values
- Permissions
- State transitions
- Regression
- External failure
- Smoke / integration

## Required Fields

- Contracts most likely to break in this change
- Tests to add
- Existing tests that cover the change
- Unverified risks
- Conditions to add to `regression_cases.yaml`

## Review

Run test coverage review before implementation and again after implementation when the final diff changes the risk profile.

## Stop Conditions

Do not implement until the test plan covers the acceptance criteria, project authority requirements, external failure behavior, and smoke / integration path. If coverage is intentionally omitted, record why in the PR risk section.
