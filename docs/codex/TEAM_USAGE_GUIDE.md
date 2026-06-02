<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# Team Usage Guide

## First Read

1. `AGENTS.md`
2. `docs/codex/AUTHORITY_POLICY.md`
3. `docs/codex/AI_DRIVEN_DEVELOPMENT_WORKFLOW.md`
4. `docs/codex/PR_ACCEPTANCE_CHECKLIST.md`

## Before Asking Codex

Provide:

- Target project
- Goal
- Files likely involved
- Things that must not change
- Known past failures
- Expected done state
- Human-review concerns

Use `docs/codex/CODEX_REQUEST_BRIEF_TEMPLATE.md` for the short brief.

## Before Implementation

Codex should produce a short plan, a change plan or spec, a test plan, and initial AI review. Project-specific source changes require the project authority listed in `docs/process/CODEX_PROJECT_AUTHORITY_REGISTRY.json`.

## Reviews

Use at least three AI review perspectives: spec alignment, test coverage, and implementation boundary. R3 adds security review, boundary review, and human review.

## PR Before Merge

Confirm the PR checklist, verify results, quality gate, preview / smoke evidence, `.env.example` status, remote checks, and human review status.

## Do Not

- Do not ask Codex to change source and env policy in the same PR.
- Do not copy authority docs from other clones.
- Do not skip or weaken tests to pass.
- Do not activate archive candidates without explicit scope.
- Do not merge R3 work without human review.
