<!-- CODEX_QUALITY_HARNESS_FILE v1.0.5 -->
# Codex Production Readiness Policy

Production Evidence and Hermes Gate does not make a project production ready. It makes production, release, merge-ready, go/no-go, and similar claims require verifiable evidence.

## Required Evidence

- command name, result, exit code or pass/fail status
- date or timestamp
- evidence source: local, CI, GitHub Actions, or manual
- current head SHA when the work is PR-scoped
- remote quality-gate evidence when release, production, security, or R3 language is used
- rollback plan, stop condition, or merge-after verify for release-like changes
- residual risks and human review decision
- skipped checks with a reason
- completed human confirmation evidence when `Human confirmation needed: yes` or `required` is declared:
  `confirmedByRole`, `reviewedItems`, current head SHA, residual risks accepted,
  `qualityGateNotWeakened`, and `riskLevelNotLowered`
- human confirmation requirement must be read from explicit `Human confirmation` or
  `Manual confirmation` fields only. Other sections that say `not required with reason`
  do not make human confirmation optional.

## Decision Rules

- `pass`: required evidence is present, current, safe, and not contradicted by known risk labels.
- `manual_confirmation_required`: remote evidence cannot be fetched but the gap is human-reviewable and not non-overridable.
- `manual_confirmation_required`: human confirmation is declared as required but the confirmation evidence is incomplete.
- `not_applicable`: non-PR local execution with no production or release claim.
- `fail`: production-ready claim without evidence, stale head SHA, unsafe output, missing rollback for release-like work, R3 without human review, confirmation head SHA mismatch, quality gate weakening, risk level lowering, or manual override of a non-overridable failure.

## Non-Overridable Failures

Manual confirmation cannot override secret scan failure, blocked paths, high-confidence secret findings, implementation/harness mixing, profile required check failure, OpenAI method gate failure, stale evidence used as current, unsafe output, or missing production evidence for a production-ready claim.

## Safe Output

Reports must be safe summaries only. They must not include raw diffs, raw logs, secret values, endpoint values, private paths, payloads, production data, or personal data. Findings must use safe labels.
