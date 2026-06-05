<!-- CODEX_QUALITY_HARNESS_FILE v1.0.7 -->
# Codex Development Harness

This document defines the default AI-assisted development flow.

For the full cross-project AI-driven workflow, use `docs/codex/AI_DRIVEN_DEVELOPMENT_WORKFLOW.md`. For authority rules, use `docs/codex/AUTHORITY_POLICY.md`.

## Flow

1. Write or confirm the short specification or change plan.
2. Write acceptance criteria and non-goals.
3. Run the required AI reviews before implementation.
4. Write the test plan before implementation.
5. Implement the smallest safe change with TDD.
6. Review with the relevant skill files under docs/process/skills.
7. Run verify, preview or smoke checks, and the local quality gate.
8. Open a PR with risk level, commands, evidence, and rollback plan.
9. Convert escaped bugs into regression tests and update failure records when needed.

## Required spec fields

- Goal
- Non-goals
- Acceptance criteria
- User or operator impact
- Data, permission, and side-effect boundaries
- Test plan
- Rollback plan
- Known risks

## High-risk rule

R3 changes require human approval even if AI review and tests pass.
