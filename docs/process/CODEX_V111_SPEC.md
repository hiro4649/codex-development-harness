<!-- CODEX_QUALITY_HARNESS_FILE v1.1.1 -->

# CODEX v1.1.1 Spec

## Theme

Token Hard Cap, Context Capsule, and Failure Closure.

## Source-Only Scope

This is a source harness body. Target rollout is `not_started`; target repos are
not touched; product code is not changed; runtime readiness and production
readiness are not claimed.

## Required Statuses

The active self-test is `v111SelfTestStatus`. v1.1.0 compatibility is retained
through `v110SelfTestStatus` and the v1.1.1 absorption map.

Core v1.1.1 status families:

- Context Capsule: contextCapsuleStatus, contextCapsuleFreshnessStatus,
  compactThreadHandoffStatus
- Token hard cap: chatHardCapStatus, inputTokenBudgetStatus,
  artifactPointerOnlyStatus, detailEscalationGateStatus,
  evaluationDigestIngestStatus, codexInstructionMacroStatus,
  noHistoryReplayStatus, stateDeltaRequiredStatus
- Session hard cap: activeSessionCountHardCapStatus,
  eightSessionDefaultDeniedStatus, sessionSpawnBudgetStatus,
  orchestrationCostLedgerStatus, fanInOnceStatus,
  duplicateInvestigationBlockStatus
- Failure closure: terminalBlockedPlaybookStatus,
  safeFailingTestArtifactStatus, safeTestSummaryStatus, rawStackOmittedStatus
- PR lifecycle and validation resume: prLifecycleStateMachineStatus,
  evidenceRefreshPollingStatus, safePendingOutputStatus,
  longRunningValidationPlannerV2Status, executableStopResumeStatus,
  validationResumePlanStatus, validationIncompleteTimeoutStatus
- CI watcher and no-delta PR suppression: ciWatcherArtifactStatus,
  sameHeadCiLedgerStatus, noNewPrUnlessDeltaStatus,
  ledgerAbsorptionFirstStatus, prInventoryNumericCapStatus,
  duplicatePrDetectorStatus, obsoletePrCloseRecommenderStatus
- Governance ledgers: mainReflectionPackageV2Status,
  canonicalOwnershipLedgerStatus, reviewEvidenceProtocolV4Status,
  typedReviewApprovalSchemaStatus
- Repo-specific stage standards: vgcTokenStageArtifactV2Status,
  funkyLaneLedgerStatus, live2dCriticalInvariantTopGateStatus
- Remote evidence and fixture stability: remoteProductEvidenceSplitStatus,
  remoteNpmRequiredStatus, remoteNpmExecutedStatus,
  remoteNpmArtifactPresentStatus, remoteNpmNormalizedStatus,
  remoteNpmResultStatus, activeMarkerInternalVersionAlignmentStatus,
  fixtureContractRegistryStatus, narrowFixtureNoBroadGateStatus,
  fullSuiteInterferenceDetectorStatus, legacyAdvisoryClassifierV2Status
- Performance and precision: performanceBudgetV3Status,
  qualityGateCostProfileStatus, tokenEconomyLossAuditStatus,
  operationalClosureScoreStatus, precisionBenchmarkParityStatus

## Required Safe Artifacts

v1.1.1 defines these safe JSON artifact contracts:

- `.codex/context-capsule.safe.json`
- `.codex/terminal-blocked-playbook.safe.json`
- `.codex/safe-failing-test-artifact.safe.json`
- `.codex/validation-resume-plan.safe.json`
- `.codex/ci-watcher.safe.json`
- `.codex/main-reflection-package.safe.json`
- `.codex/ownership-ledger.safe.json`
- `.codex/funky-lane-ledger.safe.json`
- `.codex/performance-token-audit.safe.json`

Artifacts are safe-summary only. They must not contain raw logs, raw stack
traces, secrets, endpoint values, private paths, DB rows, transaction payloads,
wallet/RPC data, viewer data, memory data, product runtime payloads, or owner
private values.

## Absorption Map

- proSummaryFirstStatus -> chatHardCapStatus / artifactPointerOnlyStatus
- detailOnDemandStatus -> detailEscalationGateStatus
- deltaOnlyReportingStatus -> stateDeltaRequiredStatus / noHistoryReplayStatus
- tokenBudgetStatus -> inputTokenBudgetStatus / chatHardCapStatus
- sessionBudgetStatus -> activeSessionCountHardCapStatus /
  eightSessionDefaultDeniedStatus
- codexInstructionCompressionStatus -> codexInstructionMacroStatus
- standingPolicyReferenceStatus -> codexInstructionMacroStatus /
  noHistoryReplayStatus
- repoBoundaryReferenceStatus -> contextCapsuleStatus
- noRepeatContextGuardStatus -> noHistoryReplayStatus /
  stateDeltaRequiredStatus
- decisionLedgerFileStatus -> contextCapsuleStatus / ledgerAbsorptionFirstStatus
- gateLedgerFileStatus -> ledgerAbsorptionFirstStatus
- stopResumeContractStatus -> executableStopResumeStatus /
  validationResumePlanStatus
- longRunningValidationPlannerStatus -> longRunningValidationPlannerV2Status
- ciWatcherV2Status -> ciWatcherArtifactStatus / sameHeadCiLedgerStatus
- forbiddenContentScannerV2Status -> safeEvidenceWordingAllowlistStatus plus
  existing scanner compatibility
- readinessLanguageLinterV2Status -> preserved and compatible
- noDeployProofArtifactStatus -> tokenPreflightGateLedgerStatus /
  deployApprovalStateMachineV2Status
- vgcTokenStageArtifactStatus -> vgcTokenStageArtifactV2Status
- ownerValuesWorkflowStatus -> ownerValuesWorkflowV2Status
- deployApprovalStateMachineStatus -> deployApprovalStateMachineV2Status
- runtimeReadinessBlockerDigestStatus -> runtimeReadinessBlockerDigestV3Status
- live2dCriticalInvariantStatus -> live2dCriticalInvariantTopGateStatus
- performanceBudgetV2Status -> performanceBudgetV3Status
- operatorEffortScoreStatus -> tokenEconomyLossAuditStatus /
  operationalClosureScoreStatus
- outputVolumeScoreStatus -> chatHardCapStatus
- sessionEfficiencyScoreStatus -> activeSessionCountHardCapStatus

Absorbed safety failures remain blocking; absorbed advisory statuses remain
advisory.

## Target-Mode Compatibility Bridge

`targetModeLegacyCompatibilityStatus` classifies older target surfaces as
`blocking_current`, `absorbed_by_v111`, `advisory_legacy`,
`not_applicable_for_lane`, `not_required_for_target_mode`,
`missing_blocking`, `missing_nonblocking`, or `harness_internal_gap`.
It must not emit generic `missing`.

v1.1.1 target mode accepts absorbed v1.1.0 and v1.0.9 statuses when their
current replacement status is present and passing. v108, v109, and v110
self-test statuses are compatibility lineage only; they do not replace a
passing `v111SelfTestStatus`.

The bridge must preserve true blockers: unsafe output, secret or raw log leak,
same-head mismatch, required check failed or missing, no-status-reported,
runtime or production readiness claims, forbidden product code changes,
wallet/RPC/deploy access, self approval, self merge, subagent merge authority,
8-session default violation, and product repair inside harness rollout.

## Compatibility

v1.1.0 behavior remains intact. v1.1.1 must not weaken same-head enforcement,
safe artifact requirements, raw log prohibition, Decision Ledger, Gate Ledger,
Stop/Resume, Failure Triage, Repair Plan, CI Watcher, required/advisory
separation, runtime readiness firewall, production readiness firewall,
product/harness separation, review independence, manual gate boundary, parent
final authority, subagent advisory-only boundaries, or wallet/RPC/deploy access
prohibition.
