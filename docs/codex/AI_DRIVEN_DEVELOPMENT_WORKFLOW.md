<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->
# AI-Driven Development Workflow

## Scope

This workflow standardizes Codex work across HARNESS, IRIS, FUNKY, and IRIS-live2d-renderer while preserving existing quality gates, verify commands, docs, evals, registries, and final acceptance records.

Before changing project-specific behavior or source, check that project's authority under `docs/codex/AUTHORITY_POLICY.md`. HARNESS workflow docs do not require `IRIS_SPEC_AUTHORITY.md`.

## Standard Flow

1. Plan in Codex.
2. Write a specification or change plan.
3. Run AI review from three perspectives: spec alignment, test coverage, and implementation boundary.
4. Reflect required review feedback.
5. Write unit test and e2e test plans.
6. Review test coverage with AI.
7. Let Codex implement the smallest scoped change.
8. Use TDD until the relevant tests pass.
9. Run post-implementation AI review from the three perspectives.
10. Reflect required review feedback.
11. Re-run verify and the local quality gate.
12. Run preview or smoke confirmation.
13. Create the GitHub PR.
14. Check remote quality-gate results.
15. Request human review when required.
16. Re-run verify after merge.
17. Add failures and recurrence risks to `FAILURES.md` and regression cases.

## Required Artifacts

- Short plan with goal, non-goal, acceptance criteria, tests, and risks.
- Test plan before implementation.
- AI review outputs before and after implementation.
- Verify and quality-gate evidence.
- Preview or smoke evidence.
- PR checklist with `.env.example` status and human review status.

## Do Not Mix

Do not mix source, docs, eval, harness, env policy, dependency, or broad refactor work unless the PR is explicitly scoped for that combination and receives the required review.

## Project Notes

- IRIS: repo-local `IRIS_SPEC_AUTHORITY.md` is authoritative only inside the active IRIS repo. HARNESS must not contain it.
- FUNKY: use `scripts/verify-funky.sh` as the standard entry and keep backend, frontend, contracts, and NFT checks.
- IRIS-live2d-renderer: keep R3. Large changes and renderer boundary topics require human review.
