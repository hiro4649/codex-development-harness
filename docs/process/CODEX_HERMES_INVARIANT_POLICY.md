<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->
# Codex Hermes Invariant Policy

Hermes invariant means the harness prefers external evidence over self-assertion, preserves boundaries, emits safe summaries only, exposes where human judgment is required, and refuses to hide failed evidence behind manual confirmation.

## Invariants

- external evidence beats self-assertion
- boundaries and scope are explicit
- safe summary only
- human judgment is visible for R3, security, release, dependency, migration, and multi-file work
- manual confirmation cannot override non-overridable failures
- production-ready and go/no-go claims require evidence
- rollback or stop condition is visible for high-risk or non-reversible work
- plan-first and review evidence are required for R3, security, release, dependency, migration, and multi-file work

## Decision Rules

- `pass`: all relevant invariants are satisfied by safe evidence.
- `manual_confirmation_required`: evidence source cannot be fetched but the gap is reviewable and not non-overridable.
- `not_applicable`: non-PR local execution with no risk or readiness claim.
- `fail`: self-assertion only, unsafe production claim, safe-summary violation, hidden residual risks, missing human review, missing plan-first evidence, missing review evidence, or production data exposure risk.
