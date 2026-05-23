<!-- CODEX_QUALITY_HARNESS_FILE v0.7.2 -->

# Codex Evidence Pack Policy

The structured evidence pack is the preferred source of machine-checkable PR
evidence. Use `.codex/evidence-pack.json` or set `CODEX_EVIDENCE_PACK_PATH`.

Required fields:

- `schemaVersion`
- `harnessVersion`
- `repository`
- `prNumber`
- `headSha`
- `baseSha`
- `changeType`
- `riskLevel`
- `scope.changedFiles`
- `scope.allowedPaths`
- `scope.forbiddenPaths`
- `commands[]`
- `remoteRuns[]`
- `residualRisks[]`
- `productionClaims`
- `rollbackOrStopCondition`
- `humanConfirmation`
- `safeOutput`

The pack must use safe summary only. It must not contain raw diff, raw logs,
raw payloads, endpoint values, secret values, private paths, production data, or
personal data.

If the pack is absent, v0.7.2 gates may fall back to PR body evidence for legacy
or downstream non-strict PRs. In source-harness pull request context, or when
`CODEX_EVIDENCE_PACK_STRICT=1` is set, PR body fallback is reported as
`legacy_fallback` and must not be counted as score 100 evidence. Missing
structured evidence in strict mode returns `manual_confirmation_required` with
safe reason code `evidence_pack_missing`.
