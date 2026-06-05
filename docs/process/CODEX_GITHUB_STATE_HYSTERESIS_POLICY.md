# GitHub State Hysteresis Policy

CODEX_QUALITY_HARNESS_FILE v1.0.7

Statuses:

- githubStateHysteresisStatus
- lastMinutePrStateRefreshStatus
- headShaStillCurrentStatus
- checksStillCurrentStatus
- mergeableStabilityStatus
- baseShaFreshnessStatus

Do not trust one stale mergeable value. Do not treat mergeable unknown as pass.
Do not merge if head SHA changed after checks, checks are on an old head, the
base SHA changed without refresh, or the event payload is older than the live PR
body.
