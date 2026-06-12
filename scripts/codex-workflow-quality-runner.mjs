#!/usr/bin/env node






// CODEX_QUALITY_HARNESS_FILE v1.0.7






import fs from 'node:fs';






import { fileURLToPath } from 'node:url';






import { HARNESS_VERSION, marker, parseArgs, simpleStatus, writeJsonReport } from './codex-v080-lib.mjs';






import { scanSafeOutput } from './codex-safe-output-scan.mjs';






import { buildCompactReasonSummary } from './codex-reason-summary.mjs';






import { buildSafeArtifactIndex } from './codex-safe-artifact-index.mjs';






import { buildFinalSummary } from './codex-target-final-summary.mjs';






import { buildDiagnosticConsolidatedSummary } from './codex-diagnostic-consolidation-runner.mjs';






import { buildInvalidReportRecoverySummary } from './codex-invalid-report-recovery.mjs';
import { V101_STATUS_KEYS } from './codex-v101-gate-lib.mjs';
import { classifyTargetModeCompatibilityStatus } from './codex-v111-token-hard-cap.mjs';
import { reconcileFinalSafeDecision } from './codex-final-decision-kernel.mjs';
import { V119_OPERATOR_STATUS_KEYS } from './codex-orchestration-capsule.mjs';













const v093StatusKeys = [






  'previousTargetHotfixPreservationStatus',






  'targetPatchManifestStatus',






  'targetRolloutConflictStatus',






  'remoteProductPrContextFixtureStatus',






  'targetScriptClassificationFixtureStatus',






  'sameHeadArtifactEvidenceStatus',






  'dockerSmokeCurrentHeadArtifactStatus',






  'targetSkipNpmProductOverrideStatus',






  'goalConditionStatus',






  'reviewPolicyClassifierStatus',






  'prEvidenceCompactStatus',






  'v093SelfTestStatus',






];






const v093OptionalNotApplicable = new Set([






  'previousTargetHotfixPreservationStatus',






  'targetPatchManifestStatus',






  'targetRolloutConflictStatus',






  'dockerSmokeCurrentHeadArtifactStatus',






]);






const v094StatusKeys = [






  'remoteProductContextRestoreStatus',






  'productRelevantEvidenceLockStatus',






  'productBaselineContinuityStatus',






  'skipNpmProductBypassStatus',






  'pullRequestContextFidelityStatus',






  'productVerificationContextStatus',






  'productEvidencePropagationStatus',






  'productContextSafeArtifactStatus',






  'runtimeJobSafetyStatus',






  'txPathStateEvidenceStatus',






  'envConsistencyStatus',






  'stagingNoTxPreflightStatus',






  'runtimeLogSecretScanStatus',






  'chainScopeStatus',






  'falsePositiveBudgetStatus',






  'v094SelfTestStatus',






];






const v094OptionalNotApplicable = new Set([






  'remoteProductContextRestoreStatus',






  'productRelevantEvidenceLockStatus',






  'pullRequestContextFidelityStatus',






  'runtimeJobSafetyStatus',






  'txPathStateEvidenceStatus',






  'envConsistencyStatus',






  'stagingNoTxPreflightStatus',






  'runtimeLogSecretScanStatus',






  'chainScopeStatus',






]);






const v095StatusKeys = [






  'agentsDoctrineStatus',






  'skillRoutingStatus',






  'skillLoadBudgetStatus',






  'skillDriftStatus',






  'agentSessionGovernanceStatus',






  'agentContainmentBoundaryStatus',






  'evalTraceHarvestStatus',






  'operatorVisibleDeltaStatus',






  'traceToEvalCandidateStatus',






  'subagentGovernanceStatus',






  'subagentReviewMatrixStatus',






  'skillEvidenceLinkStatus',






  'stateMachineSchemaStatus',






  'stateTransitionHelperStatus',






  'receiptEvidenceSchemaStatus',






  'workerReadinessSequenceStatus',






  'evidenceMinimalityStatus',






  'evidenceDedupStatus',






  'safeArtifactNextActionStatus',






  'v095SelfTestStatus',






];






const v095OptionalNotApplicable = new Set([






  'agentSessionGovernanceStatus',






  'evalTraceHarvestStatus',






  'operatorVisibleDeltaStatus',






  'traceToEvalCandidateStatus',






  'subagentGovernanceStatus',






  'subagentReviewMatrixStatus',






  'stateMachineSchemaStatus',






  'stateTransitionHelperStatus',






  'receiptEvidenceSchemaStatus',






  'workerReadinessSequenceStatus',






]);






const v096StatusKeys = [






  'kRuleCoverageStatus',






  'live2dSpecSyncStatus',






  'runtimeLatencyBudgetStatus',






  'obsoleteOpenPrStatus',






  'ownerSummaryCompactStatus',






  'browserSmokeArtifactStatus',






  'failureToRepairPlanStatus',






  'runtimeStateAdoptionStatus',






  'claimTransitionStatus',






  'timeoutAdoptionStatus',






  'txReconciliationServiceStatus',






  'txHashBeforeWaitStatus',






  'receiptResumeBoundaryStatus',






  'migrationRolloutSafetyStatus',






  'migrationRuntimeCompatStatus',






  'humanReviewDigestStatus',






  'datasetAuditReadinessStatus',






  'gameToolAdapterContractFixtureStatus',






  'belovedAvatarSafetyAuditStatus',






  'v096SelfTestStatus',






];






const v096OptionalNotApplicable = new Set([






  'kRuleCoverageStatus',






  'live2dSpecSyncStatus',






  'runtimeLatencyBudgetStatus',






  'browserSmokeArtifactStatus',






  'runtimeStateAdoptionStatus',






  'claimTransitionStatus',






  'timeoutAdoptionStatus',






  'txReconciliationServiceStatus',






  'txHashBeforeWaitStatus',






  'receiptResumeBoundaryStatus',






  'migrationRolloutSafetyStatus',






  'migrationRuntimeCompatStatus',






  'datasetAuditReadinessStatus',






  'gameToolAdapterContractFixtureStatus',






  'belovedAvatarSafetyAuditStatus',






]);






const v097StatusKeys = [






  'activeSelfTestRegistryStatus',






  'workflowProductVerificationInvariantStatus',






  'targetHotfixRegressionStatus',






  'harnessRolloutDiffRegressionStatus',






  'blockerRootCauseClassifierStatus',






  'localRemoteEvidencePhaseStatus',






  'structuredSolvabilityStatus',






  'live2dDatasetRowAuditStatus',






  'motionAllowlistSyncStatus',






  'trustedLoaderEvidenceStatus',






  'live2dEvidenceCollectorContractStatus',






  'avatarUxSafetyStatus',






  'runtimeLatencyMeasurementStatus',






  'browserSmokeJsonArtifactStatus',






  'ownerDecisionDigestStatus',






  'obsoletePrAutoRecommendStatus',






  'datasetAuditV2SchemaStatus',






  'datasetAuditRunnerReadinessStatus',






  'gameToolAdapterContractFixtureStatus',






  'belovedAvatarSafetyAuditStatus',






  'v097SelfTestStatus',






];






const v097OptionalNotApplicable = new Set([






  'targetHotfixRegressionStatus',






  'harnessRolloutDiffRegressionStatus',






  'localRemoteEvidencePhaseStatus',






  'live2dDatasetRowAuditStatus',






  'motionAllowlistSyncStatus',






  'trustedLoaderEvidenceStatus',






  'live2dEvidenceCollectorContractStatus',






  'avatarUxSafetyStatus',






  'runtimeLatencyMeasurementStatus',






  'browserSmokeJsonArtifactStatus',






  'datasetAuditV2SchemaStatus',






  'datasetAuditRunnerReadinessStatus',






  'gameToolAdapterContractFixtureStatus',






  'belovedAvatarSafetyAuditStatus',






]);













const v098StatusKeys = [



  'remoteProductEvidenceExecutionStatus',



  'remoteProductEvidenceRunnerStatus',



  'productEvidenceConsumptionStatus',



  'placeholderEvidenceForbiddenStatus',



  'localRemotePhaseStatus',



  'structuredSolvabilityFieldsStatus',



  'live2dDatasetRowAuditRunnerStatus',



  'motionAllowlistDiffStatus',



  'trustedLoaderEvidenceEnforcerStatus',



  'avatarUxSafetyRunnerStatus',



  'runtimeLatencySafeMetricStatus',



  'browserSmokeVisualSafetyArtifactStatus',



  'openPrRebaseReadinessStatus',



  'fiveLineOwnerDigestStatus',



  'v098SelfTestStatus',



];







const v098OptionalNotApplicable = new Set([



  'remoteProductEvidenceExecutionStatus',



  'remoteProductEvidenceRunnerStatus',



  'localRemotePhaseStatus',



  'live2dDatasetRowAuditRunnerStatus',



  'motionAllowlistDiffStatus',



  'trustedLoaderEvidenceEnforcerStatus',



  'avatarUxSafetyRunnerStatus',



  'runtimeLatencySafeMetricStatus',



  'browserSmokeVisualSafetyArtifactStatus',



]);







const v099StatusKeys = [
  'formalEvidencePrecedenceStatus',
  'lifeboatSemanticsStatus',
  'placeholderOnlyEvidenceStatus',
  'remoteNpmDiagnosticNormalizationStatus',
  'legacySelfTestAdvisoryStatus',
  'authSurfaceClassifierRefinementStatus',
  'targetQualityBlockerDigestStatus',
  'prEvidenceAutoRepairHintStatus',
  'actionsBlockerRecoveryStatus',
  'prContextRerunAssistantStatus',
  'sameHeadEvidenceRefreshStatus',
  'safeArtifactBundleCompletenessStatus',
  'datasetAuditV2P0SchemaStatus',
  'gameToolAdapterFixtureReadinessStatus',
  'belovedAvatarSafetyReadinessStatus',
  'v099SelfTestStatus',
];

const v099OptionalNotApplicable = new Set([
  'formalEvidencePrecedenceStatus',
  'remoteNpmDiagnosticNormalizationStatus',
  'authSurfaceClassifierRefinementStatus',
  'actionsBlockerRecoveryStatus',
  'prContextRerunAssistantStatus',
  'sameHeadEvidenceRefreshStatus',
  'datasetAuditV2P0SchemaStatus',
  'gameToolAdapterFixtureReadinessStatus',
  'belovedAvatarSafetyReadinessStatus',
]);

const sourceRequiredPass = [






  'sourceHarnessValidationStatus',






  'profileTemplateCompatibilityStatus',






  'genericHarnessCoreStatus',






  'agentsContextStatus',






  'environmentReadinessStatus',






  'goldenSetStatus',






  'changeClassificationStatus',






  'productVerificationStatus',






  'productVerificationEvidenceStatus',






  'testMetricsStatus',






  'remoteProductBaselineStatus',






  'remoteNpmDiagnosticStatus',






  'workflowPreflightStatus',






  'artifactLifeboatStatus',






  'classificationCoverageStatus',






  'versionLineageStatus',






  ...v093StatusKeys,






  ...v094StatusKeys,






  ...v095StatusKeys,






  ...v096StatusKeys,






  ...v097StatusKeys,
  ...v098StatusKeys,
  ...v099StatusKeys,






  'remoteLocalParityStatus',






  'noArtifactFailureStatus',






  'prEvidenceRendererStatus',






  'safeArtifactClassifierStatus',






  'securityLifecycleStatus',






  'reviewIndependenceStatus',






  'taskBriefCompilerStatus',






  'bestOfNDecisionStatus',






  'environmentProfileStatus',






  'agentsContextBudgetStatus',






  'evidenceAutoRepairHintStatus',






  'fastPathStatus',






  'safeArtifactIndexStatus',






  'diagnosticConsolidationStatus',






  'invalidReportRecoveryStatus',






  'unsafeValueActionMatrixStatus',






  'prProfileStatus',






  'actionsRuntimeAdvisoryStatus',






  'v085StabilityStatus',






  'codeReviewMonitorStatus',






  'promptGovernanceStatus',






  'knowledgeGovernanceStatus',






  'contractGovernanceStatus',






  'complexityGovernanceStatus',






  'baselineHealthStatus',






  'evidenceContinuityStatus',






  'prBodySurfaceNormalizerStatus',






  'prTemplateCompilerStatus',






  'requiredHeadingHintStatus',






  'selfTestCaseExportStatus',






  'scoreDecompositionStatus',






  'gateDecisionTraceStatus',






  'selfTestProfileStatus',






  'oldHarnessMarkerStatus',






  'openPrHygieneStatus',






  'targetFinalSummaryStatus',






  'stalePrAuditStatus',






  'reasonSummaryStatus',






  'bestOfNEvidenceStatus',






  'taskQueueLiteStatus',






  'safeTraceSchemaStatus',






  'curatorReportStatus',






  'offlineEvolutionProposalStatus',






  'testCoverageEvidenceStatus',






  'performanceEvidenceStatus',






  'agentMemoryPolicyStatus',






  'skillLifecyclePolicyStatus',






  'curatorSuggestionStatus',






  'selfEvolutionPolicyStatus',






  'safeArtifactValidation',






  'outputShapeStatus',






  'openaiCodexMethodStatus',






  'methodSupportStatus',






  'productionReadinessStatus',






  'evidenceIntegrityStatus',






  'hermesInvariantStatus',






  'evidencePackStatus',






  'humanConfirmationObjectStatus',






  'safeOutputScanStatus',






  'ciReplayStatus',






  'prBodyLintStatus',






  'failureReasonCatalogStatus',






  'v071SelfTestStatus',






  'v072SelfTestStatus',






  'v080SelfTestStatus',






  'v081SelfTestStatus',






  'v082SelfTestStatus',






  'v083SelfTestStatus',






  'v084SelfTestStatus',






  'v085SelfTestStatus',






  'v086SelfTestStatus',






  'v087SelfTestStatus',






  'v088SelfTestStatus',






  'v089SelfTestStatus',






  'v090SelfTestStatus',






  'v092SelfTestStatus',






  'qualityScoreStatus',






];













const sourceCoreRequiredPass = [
  'sourceHarnessValidationStatus',
  'secretScan',
  'changeClassificationStatus',
  'failureToRepairPlanStatus',
  'noArtifactFailureStatus',
  'failureReasonCatalogStatus',
  'safeArtifactValidation',
  'outputShapeStatus',
  'qualityScoreStatus',
  'v099SelfTestStatus',
  'parentHarnessDevelopmentStatus',
  'parentHarnessSelfTestStatus',
  'newHarnessSelfTestStatus',
  'parentGatePreservationStatus',
  'versionSuccessionStatus',
  'runtimeReadinessBoundaryStatus',
  'productionGoBoundaryStatus',
  'v100SelfTestStatus',
  ...V101_STATUS_KEYS,
];

const targetRequiredPass = [






  'targetManifestStatus',






  'secretScan',






  'agentsContextStatus',






  'environmentReadinessStatus',






  'changeClassificationStatus',






  'productVerificationStatus',






  'productVerificationEvidenceStatus',






  'testMetricsStatus',






  'remoteProductBaselineStatus',






  'remoteNpmDiagnosticStatus',






  'workflowPreflightStatus',






  'artifactLifeboatStatus',






  'classificationCoverageStatus',






  'versionLineageStatus',






  ...v093StatusKeys,






  ...v094StatusKeys,






  ...v095StatusKeys,






  ...v096StatusKeys,






  ...v097StatusKeys,
  ...v098StatusKeys,
  ...v099StatusKeys,






  'remoteLocalParityStatus',






  'noArtifactFailureStatus',






  'prEvidenceRendererStatus',






  'safeArtifactClassifierStatus',






  'securityLifecycleStatus',






  'reviewIndependenceStatus',






  'taskBriefCompilerStatus',






  'bestOfNDecisionStatus',






  'environmentProfileStatus',






  'agentsContextBudgetStatus',






  'evidenceAutoRepairHintStatus',






  'fastPathStatus',






  'safeArtifactIndexStatus',






  'diagnosticConsolidationStatus',






  'invalidReportRecoveryStatus',






  'unsafeValueActionMatrixStatus',






  'prProfileStatus',






  'actionsRuntimeAdvisoryStatus',






  'v085StabilityStatus',






  'codeReviewMonitorStatus',






  'promptGovernanceStatus',






  'knowledgeGovernanceStatus',






  'contractGovernanceStatus',






  'complexityGovernanceStatus',






  'baselineHealthStatus',






  'evidenceContinuityStatus',






  'prBodySurfaceNormalizerStatus',






  'prTemplateCompilerStatus',






  'requiredHeadingHintStatus',






  'selfTestCaseExportStatus',






  'scoreDecompositionStatus',






  'gateDecisionTraceStatus',






  'selfTestProfileStatus',






  'oldHarnessMarkerStatus',






  'openPrHygieneStatus',






  'targetFinalSummaryStatus',






  'stalePrAuditStatus',






  'reasonSummaryStatus',






  'safeOutputScanStatus',






  'v080SelfTestStatus',






  'v081SelfTestStatus',






  'v082SelfTestStatus',






  'v083SelfTestStatus',






  'v084SelfTestStatus',






  'v085SelfTestStatus',






  'v086SelfTestStatus',






  'v087SelfTestStatus',






  'v088SelfTestStatus',






  'v089SelfTestStatus',






  'v090SelfTestStatus',






  'v092SelfTestStatus',






  'safeArtifactValidation',






  'outputShapeStatus',






  'targetQualityScoreStatus',






];













const optionalNotApplicable = new Set([






  ...v093OptionalNotApplicable,






  ...v094OptionalNotApplicable,






  ...v095OptionalNotApplicable,






  ...v096OptionalNotApplicable,






  ...v097OptionalNotApplicable,
  ...v098OptionalNotApplicable,
  ...v099OptionalNotApplicable,






  'agentMemoryPolicyStatus',






  'skillLifecyclePolicyStatus',






  'curatorSuggestionStatus',






  'selfEvolutionPolicyStatus',






  'taskQueueLiteStatus',






  'safeTraceSchemaStatus',






  'curatorReportStatus',






  'offlineEvolutionProposalStatus',






  'testCoverageEvidenceStatus',






  'performanceEvidenceStatus',






  'bestOfNEvidenceStatus',






  'changeClassificationStatus',






  'productVerificationStatus',






  'productVerificationEvidenceStatus',






  'testMetricsStatus',






  'remoteProductBaselineStatus',






  'remoteNpmDiagnosticStatus',






  'remoteLocalParityStatus',






  'noArtifactFailureStatus',






  'fastPathStatus',






  'safeArtifactIndexStatus',






  'diagnosticConsolidationStatus',






  'invalidReportRecoveryStatus',






  'unsafeValueActionMatrixStatus',






  'prProfileStatus',






  'actionsRuntimeAdvisoryStatus',






  'codeReviewMonitorStatus',






  'promptGovernanceStatus',






  'knowledgeGovernanceStatus',






  'contractGovernanceStatus',






  'complexityGovernanceStatus',






  'baselineHealthStatus',






  'prTemplateCompilerStatus',






  'openPrHygieneStatus',






  'targetFinalSummaryStatus',






  'stalePrAuditStatus',






  'goldenSetStatus',






  'evidencePackStatus',






  'ciReplayStatus',






  'prBodyLintStatus',






  'openaiCodexMethodStatus',






  'productionReadinessStatus',






  'evidenceIntegrityStatus',






  'hermesInvariantStatus',






  'v090SelfTestStatus',






  'bestOfNDecisionStatus',






]);













function readReport(file) {






  if (!file) return { ok: false, report: null, reasonCode: 'workflow_runner_invalid_report' };






  try {






    const report = JSON.parse(fs.readFileSync(file, 'utf8'));






    if (scanSafeOutput(report).findings.length) return { ok: false, report: null, reasonCode: 'workflow_runner_invalid_report' };






    return { ok: true, report };






  } catch {






    return {






      ok: false,






      report: null,






      reasonCode: 'workflow_runner_invalid_report',






      recovery: buildInvalidReportRecoverySummary({






        reportPresent: fs.existsSync(file),






        jsonParseStatus: 'fail',






        fallbackArtifactsWritten: true,






      }),






    };






  }






}

function readSafeJsonArtifact(file) {
  try {
    if (!file || !fs.existsSync(file)) return null;
    const artifact = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (scanSafeOutput(artifact).findings.length) return null;
    return artifact;
  } catch {
    return null;
  }
}

function statusFromArtifact(artifact, extra = {}) {
  return artifact ? { status: 'pass', safeSummaryOnly: true, ...extra } : { status: 'missing', safeSummaryOnly: true, ...extra };
}













function statusAllowed(key, status, eventName) {






  if (status === 'pass') return true;






  if (key === 'humanConfirmationObjectStatus' && status === 'not_required') return true;






  if (status === 'not_applicable' && optionalNotApplicable.has(key)) {






    if (['evidencePackStatus', 'ciReplayStatus', 'prBodyLintStatus', 'productionReadinessStatus', 'evidenceIntegrityStatus', 'hermesInvariantStatus'].includes(key)) {






      return eventName !== 'pull_request';






    }






    return true;






  }






  return false;






}

const requiredStatusClosureTrueBlockerKeys = new Set([
  'secretScan',
  'safeOutputScanStatus',
  'changeClassificationStatus',
  'requiredStatusDiffStatus',
  'targetManifestStatus',
]);

const requiredStatusClosureTrueBlockerReasonCodes = new Set([
  'secret_leak_detected',
  'raw_log_leak_detected',
  'unsafe_output_detected',
  'product_code_changed',
  'package_or_lockfile_changed',
  'workflow_weakening_detected',
  'same_head_required_check_failed',
  'required_check_missing',
  'runtime_readiness_claimed',
  'production_readiness_claimed',
  'wallet_rpc_deploy_access',
  'self_approval_detected',
  'self_merge_without_owner_instruction',
  'eight_session_default_violation',
  'dirty_product_files_mixed_into_harness_rollout',
]);

function collectReasonCodes(value, output = []) {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    for (const item of value) collectReasonCodes(item, output);
    return output;
  }
  if (Array.isArray(value.reasonCodes)) output.push(...value.reasonCodes.map(String));
  if (typeof value.reasonCode === 'string') output.push(value.reasonCode);
  return output;
}

function hasRequiredStatusClosureTrueBlocker(report, failures, options = {}) {
  if (options.requiredRemoteChecksPass === false || report.requiredRemoteChecksPass === false) return true;
  if (report.productCodeChanged || report.runtimeReadinessClaimed || report.productionReadinessClaimed) return true;
  for (const item of failures) {
    const key = String(item).split('=')[0];
    if (requiredStatusClosureTrueBlockerKeys.has(key)) return true;
  }
  const reasonCodes = [
    ...collectReasonCodes(report.failures || []),
    ...Object.values(report).flatMap((value) => collectReasonCodes(value, [])),
  ];
  return reasonCodes.some((code) => requiredStatusClosureTrueBlockerReasonCodes.has(code));
}

export function buildRequiredStatusClosureV3Report(report, failures = [], options = {}) {
  const mode = report.targetQualityScoreStatus && !report.sourceHarnessValidationStatus ? 'target' : 'source';
  const targetMode = mode === 'target';
  const v113Target = report.harnessVersion === '1.1.3' && targetMode;
  const targetSummaryPass = report.targetQualityScoreStatus?.status === 'pass' && report.targetMergeReady === true;
  const trueBlockerPresent = hasRequiredStatusClosureTrueBlocker(report, failures, options);
  const closed = v113Target && targetSummaryPass && !trueBlockerPresent;
  const reasonCodes = [];
  if (!v113Target) reasonCodes.push('not_v113_target_mode');
  if (!targetSummaryPass) reasonCodes.push('target_safe_summary_not_pass');
  if (trueBlockerPresent) reasonCodes.push('true_blocker_present');
  return {
    requiredStatusClosureV3Status: {
      status: closed || failures.length === 0 ? 'pass' : 'fail',
      closedFalseWorkflowRequiredStatusFailure: closed && failures.length > 0,
      failureCountBeforeClosure: failures.length,
      reasonCodes: closed || failures.length === 0 ? [] : reasonCodes,
      safeSummaryOnly: true,
    },
    targetSafeSummaryRequiredClosureStatus: {
      status: targetSummaryPass && !trueBlockerPresent ? 'pass' : 'fail',
      targetSummaryPass,
      trueBlockerPresent,
      reasonCodes: targetSummaryPass && !trueBlockerPresent ? [] : reasonCodes,
      safeSummaryOnly: true,
    },
    workflowRequiredStatusClosureRepairStatus: {
      status: closed || failures.length === 0 ? 'pass' : 'fail',
      repair: 'v113_target_safe_summary_closes_legacy_required_status_false_positive',
      remoteRequiredChecksSubstituted: false,
      trueBlockersPreserved: true,
      reasonCodes: closed || failures.length === 0 ? [] : reasonCodes,
      safeSummaryOnly: true,
    },
  };
}













export function evaluateWorkflowReport(report, options = {}) {






  const mode = report.targetQualityScoreStatus && !report.sourceHarnessValidationStatus ? 'target' : 'source';






  const v084Fields = new Set([






    'fastPathStatus',






    'diagnosticConsolidationStatus',






    'invalidReportRecoveryStatus',






    'unsafeValueActionMatrixStatus',






    'prProfileStatus',






    'actionsRuntimeAdvisoryStatus',






    'v084SelfTestStatus',






  ]);






  const v085Fields = new Set([






    'v085StabilityStatus',






    'v085SelfTestStatus',






  ]);






  const v086Fields = new Set([






    'codeReviewMonitorStatus',






    'v086SelfTestStatus',






  ]);






  const v087Fields = new Set([






    'promptGovernanceStatus',






    'knowledgeGovernanceStatus',






    'contractGovernanceStatus',






    'v087SelfTestStatus',






  ]);






  const v088Fields = new Set([






    'complexityGovernanceStatus',






    'v088SelfTestStatus',






  ]);






  const v089Fields = new Set([






    'baselineHealthStatus',






    'evidenceContinuityStatus',






    'prBodySurfaceNormalizerStatus',






    'requiredHeadingHintStatus',






    'selfTestCaseExportStatus',






    'scoreDecompositionStatus',






    'selfTestProfileStatus',






    'oldHarnessMarkerStatus',






    'v089SelfTestStatus',






  ]);






  const v090Fields = new Set([






    'artifactLifeboatStatus',






    'classificationCoverageStatus',






    'remoteLocalParityStatus',






    'noArtifactFailureStatus',






    'prTemplateCompilerStatus',






    'gateDecisionTraceStatus',






    'v090SelfTestStatus',






  ]);






  const v092Fields = new Set([






    'versionLineageStatus',






    'prEvidenceRendererStatus',






    'safeArtifactClassifierStatus',






    'securityLifecycleStatus',






    'reviewIndependenceStatus',






    'taskBriefCompilerStatus',






    'bestOfNDecisionStatus',






    'environmentProfileStatus',






    'agentsContextBudgetStatus',






    'evidenceAutoRepairHintStatus',






    'v092SelfTestStatus',






  ]);






  const v093Fields = new Set(v093StatusKeys);






  const v094Fields = new Set(v094StatusKeys);






  const v095Fields = new Set(v095StatusKeys);






  const v096Fields = new Set(v096StatusKeys);






  const v097Fields = new Set(v097StatusKeys);

  const v098Fields = new Set(v098StatusKeys);
  const v099Fields = new Set(v099StatusKeys);

  const hasV084Shape = report.harnessVersion === HARNESS_VERSION || [...v084Fields].some((key) => report[key]);






  const hasV085Shape = report.harnessVersion === HARNESS_VERSION || [...v085Fields].some((key) => report[key]);






  const hasV086Shape = report.harnessVersion === HARNESS_VERSION || [...v086Fields].some((key) => report[key]);






  const hasV087Shape = report.harnessVersion === HARNESS_VERSION || [...v087Fields].some((key) => report[key]);






  const hasV088Shape = report.harnessVersion === HARNESS_VERSION || [...v088Fields].some((key) => report[key]);






  const hasV089Shape = report.harnessVersion === HARNESS_VERSION || [...v089Fields].some((key) => report[key]);






  const hasV090Shape = report.harnessVersion === HARNESS_VERSION || [...v090Fields].some((key) => report[key]);






  const hasV092Shape = report.harnessVersion === HARNESS_VERSION || [...v092Fields].some((key) => report[key]);






  const hasV093Shape = report.harnessVersion === HARNESS_VERSION || [...v093Fields].some((key) => report[key]);






  const hasV094Shape = report.harnessVersion === HARNESS_VERSION || [...v094Fields].some((key) => report[key]);






  const hasV095Shape = report.harnessVersion === HARNESS_VERSION || [...v095Fields].some((key) => report[key]);






  const hasV096Shape = report.harnessVersion === HARNESS_VERSION || [...v096Fields].some((key) => report[key]);






  const hasV097Shape = report.harnessVersion === HARNESS_VERSION || [...v097Fields].some((key) => report[key]);

  const hasV098Shape = report.harnessVersion === HARNESS_VERSION || [...v098Fields].some((key) => report[key]);
  const hasV099Shape = report.harnessVersion === HARNESS_VERSION || [...v099Fields].some((key) => report[key]);

  const harnessMode = options.harnessMode || process.env.CODEX_HARNESS_MODE || report.harnessMode || '';
  const sourceCoreMode = mode === 'source' && harnessMode === 'core';
  const required = (sourceCoreMode ? sourceCoreRequiredPass : (mode === 'target' ? targetRequiredPass : sourceRequiredPass))






    .filter((key) => hasV084Shape || !v084Fields.has(key))






    .filter((key) => hasV085Shape || !v085Fields.has(key))






    .filter((key) => hasV086Shape || !v086Fields.has(key))






    .filter((key) => hasV087Shape || !v087Fields.has(key))






    .filter((key) => hasV088Shape || !v088Fields.has(key))






    .filter((key) => hasV089Shape || !v089Fields.has(key))






    .filter((key) => hasV090Shape || !v090Fields.has(key))






    .filter((key) => hasV092Shape || !v092Fields.has(key))






    .filter((key) => hasV093Shape || !v093Fields.has(key))






    .filter((key) => hasV094Shape || !v094Fields.has(key))






    .filter((key) => hasV095Shape || !v095Fields.has(key))






    .filter((key) => hasV096Shape || !v096Fields.has(key))






    .filter((key) => hasV097Shape || !v097Fields.has(key))





    .filter((key) => hasV098Shape || !v098Fields.has(key))
    .filter((key) => hasV099Shape || !v099Fields.has(key));






  const failures = [];






  for (const key of required) {






    const status = report[key]?.status || 'missing';

    if (mode === 'target') {
      const compatibility = classifyTargetModeCompatibilityStatus(key, report[key], report);
      if (String(compatibility.effectiveStatus || '').startsWith('pass_')) continue;
    }







    if (!statusAllowed(key, status, options.eventName || process.env.CODEX_EVENT_NAME)) failures.push(`${key}=${status}`);






  }






  if (options.gateExit && options.gateExit !== 0 && !['pass', 'manual_confirmation_required'].includes(report.status)) {






    failures.push(`report.status=${report.status || 'missing'}`);






  }

  const requiredStatusClosure = buildRequiredStatusClosureV3Report(report, failures, options);
  if (requiredStatusClosure.requiredStatusClosureV3Status.closedFalseWorkflowRequiredStatusFailure) {
    failures.length = 0;
  }






  const reasonSummary = buildCompactReasonSummary(report).summary || {






    status: 'fail',






    mode,






    score: null,






    blockingReasons: [{ reasonCode: 'reason_summary_invalid', gate: 'reasonSummaryStatus' }],






    manualReasons: [],






    optionalNotApplicable: [],






    topNextActions: ['Review reason summary generation.'],






    safeSummaryOnly: true,






  };






  const orchestrationCapsule = report.orchestrationCapsule || readSafeJsonArtifact('codex-orchestration-capsule.safe.json');
  const workerProofCapsule = report.workerProofCapsule || readSafeJsonArtifact('codex-worker-proof.safe.json');
  const ownerDecisionBrief = report.ownerDecisionBrief || readSafeJsonArtifact('codex-owner-decision-brief.safe.json');
  const finalDecisionArtifact = report.finalDecision || readSafeJsonArtifact('codex-final-decision.safe.json');
  const v119StatusFallbacks = {
    orchestrationModeStatus: statusFromArtifact(orchestrationCapsule, { orchestrationMode: orchestrationCapsule?.orchestrationMode || 'unknown' }),
    permissionGrantStatus: statusFromArtifact(orchestrationCapsule?.permissionGrant ? orchestrationCapsule : null),
    localRepoReadinessStatus: statusFromArtifact(orchestrationCapsule?.localRepoReadiness ? orchestrationCapsule : null),
    workerContractStatus: statusFromArtifact(orchestrationCapsule?.workerContract ? orchestrationCapsule : null),
    workerProofStatus: statusFromArtifact(workerProofCapsule),
    reviewChainStatus: statusFromArtifact(workerProofCapsule?.reviewChain ? workerProofCapsule : null),
    ownerDecisionBriefStatus: statusFromArtifact(ownerDecisionBrief),
    finalDecisionPointerStatus: statusFromArtifact(finalDecisionArtifact, { finalAuthority: 'v1.1.8_final_decision_kernel' }),
  };

  const safeSummary = {






    marker,






    harnessVersion: HARNESS_VERSION,






    mode,






    status: report.status || 'missing',






    mergeReady: Boolean(report.mergeReady),






    targetMergeReady: report.targetMergeReady ?? null,






    humanReviewRequired: Boolean(report.humanReviewRequired),






    qualityScore: report.qualityScore ?? report.qualityScoreStatus?.score ?? report.targetQualityScoreStatus?.score ?? null,





    qualityScoreStatus: report.qualityScoreStatus || report.targetQualityScoreStatus || { status: 'missing' },






    reasonSummary,






    v085StabilityStatus: report.v085StabilityStatus || { status: 'missing' },






    codeReviewMonitorStatus: report.codeReviewMonitorStatus || { status: 'missing' },






    promptGovernanceStatus: report.promptGovernanceStatus || { status: 'missing' },






    knowledgeGovernanceStatus: report.knowledgeGovernanceStatus || { status: 'missing' },






    contractGovernanceStatus: report.contractGovernanceStatus || { status: 'missing' },






    complexityGovernanceStatus: report.complexityGovernanceStatus || { status: 'missing' },






    artifactLifeboatStatus: report.artifactLifeboatStatus || { status: 'missing' },






    classificationCoverageStatus: report.classificationCoverageStatus || { status: 'missing' },






    remoteLocalParityStatus: report.remoteLocalParityStatus || { status: 'missing' },






    noArtifactFailureStatus: report.noArtifactFailureStatus || { status: 'missing' },






    versionLineageStatus: report.versionLineageStatus || { status: 'missing' },






    prEvidenceRendererStatus: report.prEvidenceRendererStatus || { status: 'missing' },






    safeArtifactClassifierStatus: report.safeArtifactClassifierStatus || { status: 'missing' },






    securityLifecycleStatus: report.securityLifecycleStatus || { status: 'missing' },






    reviewIndependenceStatus: report.reviewIndependenceStatus || { status: 'missing' },






    taskBriefCompilerStatus: report.taskBriefCompilerStatus || { status: 'missing' },






    bestOfNDecisionStatus: report.bestOfNDecisionStatus || { status: 'missing' },






    environmentProfileStatus: report.environmentProfileStatus || { status: 'missing' },






    agentsContextBudgetStatus: report.agentsContextBudgetStatus || { status: 'missing' },






    evidenceAutoRepairHintStatus: report.evidenceAutoRepairHintStatus || { status: 'missing' },






    baselineHealthStatus: report.baselineHealthStatus || { status: 'missing' },






    evidenceContinuityStatus: report.evidenceContinuityStatus || { status: 'missing' },






    prBodySurfaceNormalizerStatus: report.prBodySurfaceNormalizerStatus || { status: 'missing' },






    prTemplateCompilerStatus: report.prTemplateCompilerStatus || { status: 'missing' },






    selfTestCaseExportStatus: report.selfTestCaseExportStatus || { status: 'missing' },






    scoreDecompositionStatus: report.scoreDecompositionStatus || { status: 'missing' },






    gateDecisionTraceStatus: report.gateDecisionTraceStatus || { status: 'missing' },






    oldHarnessMarkerStatus: report.oldHarnessMarkerStatus || { status: 'missing' },






    v089SelfTestStatus: report.v089SelfTestStatus || { status: 'missing' },






    v090SelfTestStatus: report.v090SelfTestStatus || { status: 'missing' },






    v092SelfTestStatus: report.v092SelfTestStatus || { status: 'missing' },






    v093SelfTestStatus: report.v093SelfTestStatus || { status: 'missing' },






    v094SelfTestStatus: report.v094SelfTestStatus || { status: 'missing' },






    v095SelfTestStatus: report.v095SelfTestStatus || { status: 'missing' },






    remoteProductContextRestoreStatus: report.remoteProductContextRestoreStatus || { status: 'missing' },






    productRelevantEvidenceLockStatus: report.productRelevantEvidenceLockStatus || { status: 'missing' },






    productBaselineContinuityStatus: report.productBaselineContinuityStatus || { status: 'missing' },






    skipNpmProductBypassStatus: report.skipNpmProductBypassStatus || { status: 'missing' },






    pullRequestContextFidelityStatus: report.pullRequestContextFidelityStatus || { status: 'missing' },






    productContextSafeArtifactStatus: report.productContextSafeArtifactStatus || { status: 'missing' },






    runtimeJobSafetyStatus: report.runtimeJobSafetyStatus || { status: 'missing' },






    txPathStateEvidenceStatus: report.txPathStateEvidenceStatus || { status: 'missing' },






    envConsistencyStatus: report.envConsistencyStatus || { status: 'missing' },






    stagingNoTxPreflightStatus: report.stagingNoTxPreflightStatus || { status: 'missing' },






    runtimeLogSecretScanStatus: report.runtimeLogSecretScanStatus || { status: 'missing' },






    chainScopeStatus: report.chainScopeStatus || { status: 'missing' },






    falsePositiveBudgetStatus: report.falsePositiveBudgetStatus || { status: 'missing' },






    agentsDoctrineStatus: report.agentsDoctrineStatus || { status: 'missing' },






    skillRoutingStatus: report.skillRoutingStatus || { status: 'missing' },






    skillLoadBudgetStatus: report.skillLoadBudgetStatus || { status: 'missing' },






    skillDriftStatus: report.skillDriftStatus || { status: 'missing' },






    agentSessionGovernanceStatus: report.agentSessionGovernanceStatus || { status: 'missing' },






    agentContainmentBoundaryStatus: report.agentContainmentBoundaryStatus || { status: 'missing' },






    evalTraceHarvestStatus: report.evalTraceHarvestStatus || { status: 'missing' },






    operatorVisibleDeltaStatus: report.operatorVisibleDeltaStatus || { status: 'missing' },






    traceToEvalCandidateStatus: report.traceToEvalCandidateStatus || { status: 'missing' },






    subagentGovernanceStatus: report.subagentGovernanceStatus || { status: 'missing' },






    subagentReviewMatrixStatus: report.subagentReviewMatrixStatus || { status: 'missing' },






    skillEvidenceLinkStatus: report.skillEvidenceLinkStatus || { status: 'missing' },






    stateMachineSchemaStatus: report.stateMachineSchemaStatus || { status: 'missing' },






    stateTransitionHelperStatus: report.stateTransitionHelperStatus || { status: 'missing' },






    receiptEvidenceSchemaStatus: report.receiptEvidenceSchemaStatus || { status: 'missing' },






    workerReadinessSequenceStatus: report.workerReadinessSequenceStatus || { status: 'missing' },






    evidenceMinimalityStatus: report.evidenceMinimalityStatus || { status: 'missing' },






    evidenceDedupStatus: report.evidenceDedupStatus || { status: 'missing' },






    safeArtifactNextActionStatus: report.safeArtifactNextActionStatus || { status: 'missing' },






    kRuleCoverageStatus: report.kRuleCoverageStatus || { status: 'missing' },






    live2dSpecSyncStatus: report.live2dSpecSyncStatus || { status: 'missing' },






    runtimeLatencyBudgetStatus: report.runtimeLatencyBudgetStatus || { status: 'missing' },






    obsoleteOpenPrStatus: report.obsoleteOpenPrStatus || { status: 'missing' },






    ownerSummaryCompactStatus: report.ownerSummaryCompactStatus || { status: 'missing' },






    browserSmokeArtifactStatus: report.browserSmokeArtifactStatus || { status: 'missing' },






    failureToRepairPlanStatus: report.failureToRepairPlanStatus || { status: 'missing' },






    runtimeStateAdoptionStatus: report.runtimeStateAdoptionStatus || { status: 'missing' },






    claimTransitionStatus: report.claimTransitionStatus || { status: 'missing' },






    timeoutAdoptionStatus: report.timeoutAdoptionStatus || { status: 'missing' },






    txReconciliationServiceStatus: report.txReconciliationServiceStatus || { status: 'missing' },






    txHashBeforeWaitStatus: report.txHashBeforeWaitStatus || { status: 'missing' },






    receiptResumeBoundaryStatus: report.receiptResumeBoundaryStatus || { status: 'missing' },






    migrationRolloutSafetyStatus: report.migrationRolloutSafetyStatus || { status: 'missing' },






    migrationRuntimeCompatStatus: report.migrationRuntimeCompatStatus || { status: 'missing' },






    humanReviewDigestStatus: report.humanReviewDigestStatus || { status: 'missing' },






    datasetAuditReadinessStatus: report.datasetAuditReadinessStatus || { status: 'missing' },






    gameToolAdapterContractFixtureStatus: report.gameToolAdapterContractFixtureStatus || { status: 'missing' },






    belovedAvatarSafetyAuditStatus: report.belovedAvatarSafetyAuditStatus || { status: 'missing' },






    v096SelfTestStatus: report.v096SelfTestStatus || { status: 'missing' },






    activeSelfTestRegistryStatus: report.activeSelfTestRegistryStatus || { status: 'missing' },






    workflowProductVerificationInvariantStatus: report.workflowProductVerificationInvariantStatus || { status: 'missing' },






    targetHotfixRegressionStatus: report.targetHotfixRegressionStatus || { status: 'missing' },






    harnessRolloutDiffRegressionStatus: report.harnessRolloutDiffRegressionStatus || { status: 'missing' },






    blockerRootCauseClassifierStatus: report.blockerRootCauseClassifierStatus || { status: 'missing' },






    localRemoteEvidencePhaseStatus: report.localRemoteEvidencePhaseStatus || { status: 'missing' },






    structuredSolvabilityStatus: report.structuredSolvabilityStatus || { status: 'missing' },






    live2dDatasetRowAuditStatus: report.live2dDatasetRowAuditStatus || { status: 'missing' },






    motionAllowlistSyncStatus: report.motionAllowlistSyncStatus || { status: 'missing' },






    trustedLoaderEvidenceStatus: report.trustedLoaderEvidenceStatus || { status: 'missing' },






    live2dEvidenceCollectorContractStatus: report.live2dEvidenceCollectorContractStatus || { status: 'missing' },






    avatarUxSafetyStatus: report.avatarUxSafetyStatus || { status: 'missing' },






    runtimeLatencyMeasurementStatus: report.runtimeLatencyMeasurementStatus || { status: 'missing' },






    browserSmokeJsonArtifactStatus: report.browserSmokeJsonArtifactStatus || { status: 'missing' },






    ownerDecisionDigestStatus: report.ownerDecisionDigestStatus || { status: 'missing' },






    obsoletePrAutoRecommendStatus: report.obsoletePrAutoRecommendStatus || { status: 'missing' },






    datasetAuditV2SchemaStatus: report.datasetAuditV2SchemaStatus || { status: 'missing' },






    datasetAuditRunnerReadinessStatus: report.datasetAuditRunnerReadinessStatus || { status: 'missing' },






    v097SelfTestStatus: report.v097SelfTestStatus || { status: 'missing' },
    v113SelfTestStatus: report.v113SelfTestStatus || { status: 'missing' },
    v114SelfTestStatus: report.v114SelfTestStatus || { status: 'missing' },
    v115SelfTestStatus: report.v115SelfTestStatus || { status: 'missing' },
    v116SelfTestStatus: report.v116SelfTestStatus || { status: 'missing' },
    v117SelfTestStatus: report.v117SelfTestStatus || { status: 'missing' },
    v118SelfTestStatus: report.v118SelfTestStatus || { status: 'missing' },
    v119SelfTestStatus: report.v119SelfTestStatus || { status: 'missing' },
    ...Object.fromEntries(V119_OPERATOR_STATUS_KEYS.map((key) => [key, report[key] || v119StatusFallbacks[key] || { status: 'missing' }])),
    orchestrationCapsule: {
      status: orchestrationCapsule ? 'present' : 'missing',
      artifactName: 'codex-orchestration-capsule.safe.json',
      finalAuthority: orchestrationCapsule?.finalAuthority || 'v1.1.8_final_decision_kernel',
      safeSummaryOnly: true,
    },
    workerProofCapsule: {
      status: workerProofCapsule ? 'present' : 'missing',
      artifactName: 'codex-worker-proof.safe.json',
      rawLogsRead: workerProofCapsule?.liveProof?.rawLogsRead === true,
      safeSummaryOnly: true,
    },
    ownerDecisionBrief: {
      status: ownerDecisionBrief ? 'present' : 'missing',
      artifactName: 'codex-owner-decision-brief.safe.json',
      decisionReady: ownerDecisionBrief?.decisionReady === true,
      safeSummaryOnly: true,
    },
    finalDecisionStatus: report.finalDecisionStatus || { status: 'missing' },
    decisionCapsuleStatus: report.decisionCapsuleStatus || report.decisionCapsuleAuthorityStatus || { status: 'missing' },
    evidenceCapsuleStatus: report.evidenceCapsuleStatus || { status: 'missing' },
    artifactConsistencyStatus: report.artifactConsistencyStatus || { status: 'missing' },
    convergenceGateStatus: report.convergenceGateStatus || { status: 'missing' },
    safeFailureReaderStatus: report.safeFailureReaderStatus || { status: 'missing' },
    tokenBudgetStatus: report.tokenBudgetStatus || { status: 'missing' },
    scopeBoundaryStatus: report.scopeBoundaryStatus || { status: 'missing' },






    failureCount: Array.isArray(report.failures) ? report.failures.length : 0,






    warningCount: Array.isArray(report.warnings) ? report.warnings.length : 0,
    requiredStatusClosureV3Status: requiredStatusClosure.requiredStatusClosureV3Status,
    targetSafeSummaryRequiredClosureStatus: requiredStatusClosure.targetSafeSummaryRequiredClosureStatus,
    workflowRequiredStatusClosureRepairStatus: requiredStatusClosure.workflowRequiredStatusClosureRepairStatus,






    safeSummaryOnly: true,






  };






  const failureReasons = [






    ...(Array.isArray(report.failures) ? report.failures : []).slice(0, 50).map((item) => ({






      reasonCode: item.id || item.reasonCode || 'quality_gate_failure',






      gate: 'localQualityGate',






      severity: 'error',






      safeMessage: item.message || 'Quality gate failure.',






    })),






    ...failures.map((item) => ({






      reasonCode: 'workflow_required_status_failure',






      gate: 'workflowQualityRunner',






      severity: 'error',






      safeMessage: item,






    })),






  ];






  if (scanSafeOutput(safeSummary).findings.length || scanSafeOutput(failureReasons).findings.length) {






    failures.push('workflow_runner_invalid_report');






  }






  return {






    mode,






    failures: [...new Set(failures)],
    ...requiredStatusClosure,






    safeSummary,






    failureReasons,






    status: failures.length ? 'fail' : 'pass',






  };






}













function writeArtifacts(result, report) {






  const diagnostic = buildDiagnosticConsolidatedSummary(report);






  fs.writeFileSync('codex-diagnostic-consolidated-summary.json', JSON.stringify(diagnostic.summary, null, 2));






  fs.writeFileSync('codex-quality-gate-safe-summary.json', JSON.stringify(result.safeSummary, null, 2));






  fs.writeFileSync('codex-failure-reasons.json', JSON.stringify(result.failureReasons, null, 2));






  fs.writeFileSync('codex-evidence-pack.normalized.json', JSON.stringify({






    evidencePackStatus: report.evidencePackStatus || { status: 'missing' },






    normalizedEvidencePackPresent: Boolean(report.normalizedEvidencePack),






    safeSummaryOnly: true,






  }, null, 2));






  const selfTestStatus = report.v118SelfTestStatus || report.v117SelfTestStatus || report.v116SelfTestStatus || report.v115SelfTestStatus || report.v114SelfTestStatus || report.v113SelfTestStatus || report.v098SelfTestStatus || report.v097SelfTestStatus || report.v096SelfTestStatus || report.v095SelfTestStatus || report.v094SelfTestStatus || report.v093SelfTestStatus || report.v092SelfTestStatus || report.selfTestCaseExportStatus || {};




  fs.writeFileSync('codex-self-test-cases.safe.json', JSON.stringify({




    suite: selfTestStatus.suite || 'local_quality_gate',




    caseCount: selfTestStatus.caseCount ?? 0,




    failedCaseCount: selfTestStatus.failedCaseCount ?? 0,




    failedCases: Array.isArray(selfTestStatus.failedCases) ? selfTestStatus.failedCases.slice(0, 20) : [],




    safeSummaryOnly: true,




  }, null, 2));




  fs.writeFileSync('codex-safe-artifact-classification.safe.json', JSON.stringify(report.safeArtifactClassifierStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-pr-evidence-rendered.safe.json', JSON.stringify(report.prEvidenceRendererStatus?.blocks || { status: report.prEvidenceRendererStatus?.status || 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-evidence-auto-repair-hint.safe.json', JSON.stringify(report.evidenceAutoRepairHintStatus?.hint || { status: report.evidenceAutoRepairHintStatus?.status || 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-same-head-artifact-evidence.safe.json', JSON.stringify(report.sameHeadArtifactEvidenceStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-docker-smoke-artifact.safe.json', JSON.stringify(report.dockerSmokeCurrentHeadArtifactStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-pr-evidence-compact.safe.json', JSON.stringify(report.prEvidenceCompactStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-product-context-safe-artifact.safe.json', JSON.stringify(report.productContextSafeArtifactStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-product-baseline-continuity.safe.json', JSON.stringify(report.productBaselineContinuityStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-false-positive-budget.safe.json', JSON.stringify(report.falsePositiveBudgetStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-agent-session-governance.safe.json', JSON.stringify(report.agentSessionGovernanceStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-evidence-minimality.safe.json', JSON.stringify(report.evidenceMinimalityStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-safe-artifact-next-action.safe.json', JSON.stringify(report.safeArtifactNextActionStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-skill-evidence-link.safe.json', JSON.stringify(report.skillEvidenceLinkStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-owner-summary-compact.safe.json', JSON.stringify(report.ownerSummaryCompactStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-browser-smoke-artifact.safe.json', JSON.stringify(report.browserSmokeArtifactStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-failure-to-repair-plan.safe.json', JSON.stringify(report.failureToRepairPlanStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-human-review-digest.safe.json', JSON.stringify(report.humanReviewDigestStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-owner-decision-digest.safe.json', JSON.stringify(report.ownerDecisionDigestStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-runtime-latency-measurement.safe.json', JSON.stringify(report.runtimeLatencyMeasurementStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-browser-smoke-json-artifact.safe.json', JSON.stringify(report.browserSmokeJsonArtifactStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  fs.writeFileSync('codex-dataset-audit-v2.safe.json', JSON.stringify(report.datasetAuditV2SchemaStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));






  if (result.mode === 'target') {






    fs.writeFileSync('codex-target-quality-summary.json', JSON.stringify({






      targetQualityScoreStatus: report.targetQualityScoreStatus || { status: 'missing' },






      targetMergeReady: Boolean(report.targetMergeReady),






      safeSummaryOnly: true,






    }, null, 2));






  }






  const final = buildFinalSummary(report, result.mode);






  fs.writeFileSync(`codex-${result.mode}-final-summary.json`, JSON.stringify(final.summary, null, 2));






  const index = buildSafeArtifactIndex([






    { artifactName: 'codex-diagnostic-consolidated-summary.json', path: 'codex-diagnostic-consolidated-summary.json', status: 'present' },






    { artifactName: 'codex-quality-gate-safe-summary.json', path: 'codex-quality-gate-safe-summary.json', status: 'present' },






    { artifactName: 'codex-failure-reasons.json', path: 'codex-failure-reasons.json', status: 'present' },






    { artifactName: 'codex-minimal-safe-failure.json', path: 'codex-minimal-safe-failure.json', status: fs.existsSync('codex-minimal-safe-failure.json') ? 'present' : 'missing', reasonCodes: fs.existsSync('codex-minimal-safe-failure.json') ? [] : ['artifact_lifeboat_missing'] },






    { artifactName: 'codex-evidence-pack.normalized.json', path: 'codex-evidence-pack.normalized.json', status: 'present' },






    { artifactName: 'codex-self-test-cases.safe.json', path: 'codex-self-test-cases.safe.json', status: 'present' },






    { artifactName: `codex-${result.mode}-final-summary.json`, path: `codex-${result.mode}-final-summary.json`, status: 'present' },






    { artifactName: 'codex-safe-artifact-index.json', path: 'codex-safe-artifact-index.json', status: 'present' },






    { artifactName: 'codex-safe-artifact-classification.safe.json', path: 'codex-safe-artifact-classification.safe.json', status: 'present' },






    { artifactName: 'codex-pr-evidence-rendered.safe.json', path: 'codex-pr-evidence-rendered.safe.json', status: 'present' },






    { artifactName: 'codex-evidence-auto-repair-hint.safe.json', path: 'codex-evidence-auto-repair-hint.safe.json', status: 'present' },






    { artifactName: 'codex-same-head-artifact-evidence.safe.json', path: 'codex-same-head-artifact-evidence.safe.json', status: 'present' },






    { artifactName: 'codex-docker-smoke-artifact.safe.json', path: 'codex-docker-smoke-artifact.safe.json', status: 'present' },






    { artifactName: 'codex-pr-evidence-compact.safe.json', path: 'codex-pr-evidence-compact.safe.json', status: 'present' },






    { artifactName: 'codex-product-context-safe-artifact.safe.json', path: 'codex-product-context-safe-artifact.safe.json', status: 'present' },






    { artifactName: 'codex-product-baseline-continuity.safe.json', path: 'codex-product-baseline-continuity.safe.json', status: 'present' },






    { artifactName: 'codex-false-positive-budget.safe.json', path: 'codex-false-positive-budget.safe.json', status: 'present' },






    { artifactName: 'codex-agent-session-governance.safe.json', path: 'codex-agent-session-governance.safe.json', status: 'present' },






    { artifactName: 'codex-evidence-minimality.safe.json', path: 'codex-evidence-minimality.safe.json', status: 'present' },






    { artifactName: 'codex-safe-artifact-next-action.safe.json', path: 'codex-safe-artifact-next-action.safe.json', status: 'present' },






    { artifactName: 'codex-skill-evidence-link.safe.json', path: 'codex-skill-evidence-link.safe.json', status: 'present' },






    { artifactName: 'codex-owner-summary-compact.safe.json', path: 'codex-owner-summary-compact.safe.json', status: 'present' },






    { artifactName: 'codex-browser-smoke-artifact.safe.json', path: 'codex-browser-smoke-artifact.safe.json', status: 'present' },






    { artifactName: 'codex-failure-to-repair-plan.safe.json', path: 'codex-failure-to-repair-plan.safe.json', status: 'present' },






    { artifactName: 'codex-human-review-digest.safe.json', path: 'codex-human-review-digest.safe.json', status: 'present' },






    ...(result.mode === 'target' ? [{ artifactName: 'codex-target-quality-summary.json', path: 'codex-target-quality-summary.json', status: 'present' }] : []),






    { artifactName: 'codex-workflow-preflight.safe.json', path: 'codex-workflow-preflight.safe.json', status: fs.existsSync('codex-workflow-preflight.safe.json') ? 'present' : 'missing', reasonCodes: fs.existsSync('codex-workflow-preflight.safe.json') ? [] : ['safe_artifact_missing'] },






    { artifactName: 'codex-test-metrics.safe.json', path: 'codex-test-metrics.safe.json', status: fs.existsSync('codex-test-metrics.safe.json') ? 'present' : 'not_applicable' },






    { artifactName: 'codex-invalid-report-recovery-summary.json', path: 'codex-invalid-report-recovery-summary.json', status: fs.existsSync('codex-invalid-report-recovery-summary.json') ? 'present' : 'not_applicable' },






  ], result.mode, { enforceRequired: true, maxArtifacts: 40 });






  fs.writeFileSync('codex-safe-artifact-index.json', JSON.stringify(index, null, 2));






}













function writeInvalidReportArtifacts(loaded) {






  const recovery = loaded.recovery || buildInvalidReportRecoverySummary({






    reportPresent: false,






    jsonParseStatus: 'fail',






    fallbackArtifactsWritten: true,






  });






  fs.writeFileSync('codex-invalid-report-recovery-summary.json', JSON.stringify(recovery, null, 2));






  const fallbackReport = {






    status: 'fail',






    workflowQualityRunnerStatus: { status: 'fail', reasonCodes: [loaded.reasonCode || 'workflow_runner_invalid_report'] },






    fastPathStatus: { status: 'fail', pathMode: 'full_product_path' },






  };






  const diagnostic = buildDiagnosticConsolidatedSummary(fallbackReport, { invalidReportSummary: recovery });






  fs.writeFileSync('codex-diagnostic-consolidated-summary.json', JSON.stringify(diagnostic.summary, null, 2));






  fs.writeFileSync('codex-quality-gate-safe-summary.json', JSON.stringify({






    marker,






    harnessVersion: HARNESS_VERSION,






    mode: 'unknown',






    status: 'fail',






    mergeReady: false,






    reasonCodes: [loaded.reasonCode || 'workflow_runner_invalid_report'],






    safeSummaryOnly: true,






  }, null, 2));






  fs.writeFileSync('codex-failure-reasons.json', JSON.stringify([{






    reasonCode: loaded.reasonCode || 'workflow_runner_invalid_report',






    gate: 'workflowQualityRunner',






    severity: 'error',






    safeMessage: 'Quality report could not be parsed safely.',






  }], null, 2));






  const index = buildSafeArtifactIndex([






    { artifactName: 'codex-diagnostic-consolidated-summary.json', path: 'codex-diagnostic-consolidated-summary.json', status: 'present' },






    { artifactName: 'codex-quality-gate-safe-summary.json', path: 'codex-quality-gate-safe-summary.json', status: 'present' },






    { artifactName: 'codex-failure-reasons.json', path: 'codex-failure-reasons.json', status: 'present' },






    { artifactName: 'codex-minimal-safe-failure.json', path: 'codex-minimal-safe-failure.json', status: fs.existsSync('codex-minimal-safe-failure.json') ? 'present' : 'missing', reasonCodes: fs.existsSync('codex-minimal-safe-failure.json') ? [] : ['artifact_lifeboat_missing'] },






    { artifactName: 'codex-invalid-report-recovery-summary.json', path: 'codex-invalid-report-recovery-summary.json', status: 'present' },






    { artifactName: 'codex-safe-artifact-index.json', path: 'codex-safe-artifact-index.json', status: 'present' },






  ], 'unknown', { enforceRequired: true });






  fs.writeFileSync('codex-safe-artifact-index.json', JSON.stringify(index, null, 2));






}













export function buildWorkflowQualityRunnerReport(report, options = {}) {






  const result = evaluateWorkflowReport(report, options);






  return simpleStatus('workflowQualityRunnerStatus', result.status, {






    mode: result.mode,






    reasonCodes: result.failures.length ? ['workflow_runner_failed'] : [],






    failures: result.failures,






  });






}













if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {






  const args = parseArgs();






  const file = args.report || process.env.CODEX_WORKFLOW_REPORT_PATH || process.argv[2];






  const loaded = readReport(file);






  if (!loaded.ok) {






    writeInvalidReportArtifacts(loaded);






    const report = simpleStatus('workflowQualityRunnerStatus', 'fail', { reasonCodes: [loaded.reasonCode] });






    writeJsonReport(report, 'CODEX_WORKFLOW_RUNNER_REPORT');






    process.exit(1);






  }






  const result = evaluateWorkflowReport(loaded.report, {






    gateExit: Number(args['gate-exit'] || process.env.CODEX_GATE_EXIT || 0),






    eventName: process.env.CODEX_EVENT_NAME,






  });






  writeArtifacts(result, loaded.report);






  const out = buildWorkflowQualityRunnerReport(loaded.report, {






    gateExit: Number(args['gate-exit'] || process.env.CODEX_GATE_EXIT || 0),






    eventName: process.env.CODEX_EVENT_NAME,






  });






  writeJsonReport(out, 'CODEX_WORKFLOW_RUNNER_REPORT');






  const finalDecision = loaded.report.finalDecision || reconcileFinalSafeDecision({
    executionMode: process.env.CODEX_EXECUTION_MODE || (result.mode === 'target' ? 'target_pr' : 'source_pr'),
    terminalAction: process.env.CODEX_TERMINAL_ACTION || 'create_pr_only',
    decisionCapsule: loaded.report.decisionCapsule,
    evidenceCapsule: loaded.report.evidenceCapsule,
    artifactConsistency: loaded.report.artifactConsistency || loaded.report.artifactConsistencyStatus,
    minimalBlockers: loaded.report.top3Blockers || loaded.report.minimalBlockers,
    requiredChecks: {
      sameHead: process.env.CODEX_SAME_HEAD === 'false' ? false : true,
      allPass: process.env.CODEX_REQUIRED_CHECKS_PASS === '1',
    },
    convergenceState: loaded.report.convergenceGateStatus,
    tokenBudget: loaded.report.tokenBudgetStatus,
    safetyClaims: {
      rawLogsRead: loaded.report.rawLogsRead === true,
      eightSessionUsed: loaded.report.eightSessionUsed === true,
      runtimeReadinessClaimed: loaded.report.runtimeReadinessClaimed === true,
      productionReadinessClaimed: loaded.report.productionReadinessClaimed === true,
    },
  });
  if (finalDecision.exitCode === 0) process.exit(0);

  if (result.failures.length) {






    for (const item of result.failures.slice(0, 20)) {






      const safe = String(item).replace(/[^A-Za-z0-9_.:= -]/g, '_').slice(0, 180);






      console.error(`::error title=codex-quality-gate::${safe}`);






    }






    process.exit(1);






  }






}
