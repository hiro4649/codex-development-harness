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
PRs. Strict source-harness mode may require the pack by setting
`CODEX_EVIDENCE_PACK_STRICT=1`.
