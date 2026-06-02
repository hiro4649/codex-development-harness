<!-- CODEX_QUALITY_HARNESS_FILE v1.0.4 -->

# Codex Manual Confirmation Policy

Human confirmation may come from `.codex/manual-confirmation.json`,
`CODEX_MANUAL_CONFIRMATION_PATH`, the evidence pack `humanConfirmation` object,
or a PR body/comment structured JSON block containing `codexManualConfirmation`.
Natural-language PR body, PR comment, or review approval evidence may be used
for legacy/non-strict classification, but source-harness pull requests and
`CODEX_HUMAN_CONFIRMATION_STRICT=1` must not score 100 from prose fallback
alone.

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

Example PR body or comment structured JSON source:

BEGIN_CODEX_MANUAL_CONFIRMATION_JSON
{
  "codexManualConfirmation": {
    "target": "pull_request",
    "repository": "owner/repo",
    "prNumber": 1,
    "headSha": "current head SHA",
    "riskLevel": "R3",
    "confirmedByRole": "project-owner",
    "confirmedAt": "ISO-8601 timestamp",
    "reviewedItems": ["safe summary only"],
    "residualRisks": ["downstream propagation separate"],
    "qualityGateNotWeakened": true,
    "riskLevelNotLowered": true,
    "nonOverridableFailuresAcknowledged": true
  }
}
END_CODEX_MANUAL_CONFIRMATION_JSON
