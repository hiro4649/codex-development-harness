<!-- CODEX_QUALITY_HARNESS_FILE v1.0.6 -->

# Codex Evidence Pack Policy

The structured evidence pack is the preferred source of machine-checkable PR
evidence. Use `.codex/evidence-pack.json`, set `CODEX_EVIDENCE_PACK_PATH`, or
include a safe structured object in the PR body or PR comments.

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

If the pack is absent, legacy-compatible non-strict gates may fall back to PR
body evidence for downstream or older PRs. In source-harness pull request context, or when
`CODEX_EVIDENCE_PACK_STRICT=1` is set, PR body fallback is reported as
`legacy_fallback` and must not be counted as score 100 evidence. Missing
structured evidence in strict mode returns `manual_confirmation_required` with
safe reason code `evidence_pack_missing`.

PR body or comment object format:

BEGIN_CODEX_EVIDENCE_PACK_JSON
{
  "codexEvidencePack": {
    "schemaVersion": "0.8.2",
    "harnessVersion": "0.8.2",
    "repository": "owner/repo",
    "prNumber": 1,
    "headSha": "current head SHA",
    "baseSha": "current base SHA",
    "changeType": "source-harness",
    "riskLevel": "R3",
    "scope": {
      "changedFiles": [],
      "allowedPaths": [],
      "forbiddenPaths": []
    },
    "commands": [],
    "remoteRuns": [],
    "residualRisks": [],
    "productionClaims": {
      "claimsRuntimeReady": false,
      "claimsDeploymentReady": false,
      "claimsMergeReady": false
    },
    "rollbackOrStopCondition": "Do not merge if quality-gate fails.",
    "humanConfirmation": {},
    "safeOutput": {
      "status": "pass"
    }
  }
}
END_CODEX_EVIDENCE_PACK_JSON
