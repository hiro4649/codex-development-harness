# Target Hotfix Preservation Replay

CODEX_QUALITY_HARNESS_FILE v1.0.7

Statuses:

- targetHotfixPreservationAcrossRolloutStatus
- rolloutRegressionReplayStatus
- previousTargetHotfixInventoryStatus
- targetHotfixDroppedStatus

Preserved hotfixes include backend cwd routing, contracts cwd routing, legacy
self-test advisory, stale reason summary blocker removal, active suite source
export, same-head evidence requirement, safe artifact head match, no root npm
when package is missing, local gate side-effect guard, branch/head invariant, and
targetMergeReady false without same-head remote pass.
