<!-- CODEX_QUALITY_HARNESS_FILE v0.7.2 -->

# Codex Manual Confirmation Policy

Human confirmation may come from `.codex/manual-confirmation.json`, the evidence
pack `humanConfirmation` object, PR body evidence, PR comments, or a configured
review approval source.

Required structured fields for required confirmation:

- `target`
- `repository`
- `prNumber`
- `headSha`
- `riskLevel`
- `confirmedByRole`
- `confirmedAt`
- `reviewedItems[]`
- `residualRisks[]`
- `qualityGateNotWeakened`
- `riskLevelNotLowered`
- `nonOverridableFailuresAcknowledged`

Head SHA mismatch is failure. Quality gate weakening, risk-level lowering, and
non-overridable failures remain blocking. Manual confirmation cannot override
secret scan failures, blocked paths, high-confidence secrets, implementation
and harness mixing, profile-required failures, OpenAI method failures, stale
evidence, or unsafe output.
