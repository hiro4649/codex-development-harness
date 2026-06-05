# Codex Harness v1.0.4 Spec

CODEX_QUALITY_HARNESS_FILE v1.0.7

v1.0.4 is a source-harness-only release. It does not roll out to target
repositories and does not implement product runtime behavior.

The release theme is distrust by default: PR body claims, Codex summaries, safe
artifacts, code, tests, CI, acceptance criteria, GitHub state, and risk register
entries must be cross-checked before completion or merge readiness is claimed.

Required active suite:

- activeHarnessVersion: 1.0.4
- activeSelfTestSuite: v104
- activeSelfTestStatusKey: v104SelfTestStatus
- v103SelfTestStatus remains preserved/advisory, not the active suite.

Core status families:

- claimToCodeVerifierStatus
- architectureBoundaryLinterStatus
- acceptanceCriteriaMatrixStatus
- riskGateStatus
- evidenceReportV2Status
- githubStateHysteresisStatus
- toolGapResolverStatus
- productSurfaceRouterV2Status
- activeSelfTestSingleSourceStatus
- diagnosticSourceFieldStatus
- targetHotfixPreservationAcrossRolloutStatus
- prChainExpansionStatus
- externalBlockedTerminalStatus
- roleProfilePluginStatus
- toolPermissionBoundaryStatus
- evidenceSiteStatus
- annotationToWorkPacketStatus
- dynamicWorkflowDecisionStatus
- goalModeContractStatus
- workPacketSchemaStatus
- workerFileOwnershipV2Status
- approvalGateCoverageStatus
- verificationFanInStatus
- runtimeReadinessBoundaryStatus
- productionGoBoundaryStatus

Non-goals:

- No target rollout.
- No product implementation.
- No representative product PR validation.
- No runtime readiness claim.
- No production readiness claim.
