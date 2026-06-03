<!-- CODEX_QUALITY_HARNESS_FILE v1.0.5 -->
# Release Gate

Before merge or deploy, confirm:

- The risk level is correct.
- Required checks passed or failures are explicitly documented.
- The PR has a rollback plan.
- R3 changes have human approval.
- Secret scan passed.
- The change does not include unrelated refactoring.
- Known risks are acceptable.

After release, monitor the critical user or operator flow touched by the PR.
