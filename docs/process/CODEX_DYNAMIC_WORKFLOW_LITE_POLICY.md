# Dynamic Workflow Lite Policy

CODEX_QUALITY_HARNESS_FILE v1.0.7

Statuses:

- dynamicWorkflowDecisionStatus
- goalModeContractStatus
- orchestrationScriptSchemaStatus
- workPacketSchemaStatus
- workerRoleMatrixStatus
- workerFileOwnershipV2Status
- subagentExecutionPermissionStatus
- simulatedSubagentFallbackStatus
- approvalGateCoverageStatus
- verificationFanInStatus
- workflowResumeCheckpointStatus
- workflowArtifactReplayStatus
- workflowHumanOverrideStatus

Workflow generation is not completion. Simulated subagent is not executed
subagent. Autonomous commit, push, merge, migration, transaction, runtime
readiness, and production readiness are forbidden.

Every work packet records goal, repo, role, allowed files, forbidden files,
approval gate, verification command, safe output boundary, stop condition, and
resume checkpoint.
