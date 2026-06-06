<!-- CODEX_QUALITY_HARNESS_FILE v1.1.0 -->

# CODEX v1.1.0 Spec

## Theme

Token Economy and Operational Closure.

## Source-Only Scope

This is a source harness body. Target rollout is `not_started`; target repos are
not touched; product code is not changed; runtime readiness and production
readiness are not claimed.

## Required Statuses

The active self-test is `v110SelfTestStatus`. v1.0.9 compatibility is retained
through `v109SelfTestStatus` and the v1.1.0 absorption map.

Core v1.1.0 statuses:

- proSummaryFirstStatus
- detailOnDemandStatus
- deltaOnlyReportingStatus
- tokenBudgetStatus
- sessionBudgetStatus
- mainThreadAuthorityStatus
- oneVerifierDefaultStatus
- eightSessionExceptionGateStatus
- decisionLedgerFileStatus
- gateLedgerFileStatus
- stopResumeContractStatus
- longRunningValidationPlannerStatus
- ciWatcherV2Status
- activeHarnessReconciliationStatus
- codexInstructionCompressionStatus
- standingPolicyReferenceStatus
- repoBoundaryReferenceStatus
- noRepeatContextGuardStatus
- precisionPreservationStatus
- structuredEvidenceFirstStatus
- prBodyAsRenderedOutputStatus
- bodySchemaNormalizerV2Status
- bodyRepairHintStatus
- prInventoryReductionEngineStatus
- mainReflectionPackageBuilderStatus
- reviewEvidenceProtocolV3Status
- runtimeReturnGateV2Status
- forbiddenContentScannerV2Status
- readinessLanguageLinterV2Status
- noDeployProofArtifactStatus
- vgcTokenStageArtifactStatus
- ownerValuesWorkflowStatus
- deployApprovalStateMachineStatus
- runtimeReadinessBlockerDigestStatus
- live2dCriticalInvariantStatus
- performanceBudgetV2Status
- operatorEffortScoreStatus
- outputVolumeScoreStatus
- sessionEfficiencyScoreStatus

## Evidence Precedence

1. Decision Ledger safe JSON
2. Gate Ledger safe JSON
3. Evidence Pack
4. CI safe artifact
5. PR body structured metadata block
6. PR body markdown fallback

PR body text is rendered output, not the primary machine source.

## Absorption Map

- decisionLedgerStatus -> decisionLedgerFileStatus / proSummaryFirstStatus
- gateLedgerStatus -> gateLedgerFileStatus
- operatorDigestV4Status -> proSummaryFirstStatus / detailOnDemandStatus
- workflowLedgerStatus -> stopResumeContractStatus / decisionLedgerFileStatus
- ciWatcherStatus -> ciWatcherV2Status
- prInventoryReductionStatus -> prInventoryReductionEngineStatus
- mainReflectionPackageStatus -> mainReflectionPackageBuilderStatus
- reviewEvidenceProtocolV2Status -> reviewEvidenceProtocolV3Status
- runtimeReturnGateStatus -> runtimeReturnGateV2Status
- safeCiFailureArtifactV2Status -> ciWatcherV2Status
- repairPlanSafeJsonStatus -> bodyRepairHintStatus
- missingStatusTaxonomyStatus -> status compression compatibility
- externalSourceAbsorptionMapStatus -> standingPolicyReferenceStatus
- orchestrationAbsorptionMapStatus -> sessionBudgetStatus / mainThreadAuthorityStatus

Absorbed safety failures remain blocking; absorbed advisory statuses remain
advisory.

## Compatibility

v1.0.9 safety failures are not converted to advisory. Runtime and production
readiness boundaries, product verification, safe output scanning, same-head
checks, and required check closure remain enforced.

