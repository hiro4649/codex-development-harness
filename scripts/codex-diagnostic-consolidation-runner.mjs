#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, parseArgs, readJson, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildInvalidReportRecoverySummary } from './codex-invalid-report-recovery.mjs';

function reasonCatalog() {
  const parsed = readJson('docs/process/CODEX_FAILURE_REASON_CATALOG.json');
  return parsed.ok ? new Set((parsed.value.reasonCodes || []).map((item) => item.reasonCode)) : new Set();
}

function scoreFor(report, mode) {
  const status = mode === 'target' ? report.targetQualityScoreStatus : report.qualityScoreStatus;
  return typeof status?.score === 'number' ? status.score : null;
}

function statusItems(report) {
  return Object.entries(report || {}).filter(([key, value]) =>
    (key.endsWith('Status') || key === 'secretScan' || key === 'safeArtifactValidation') &&
    value && typeof value === 'object');
}

function safeReasonCode(key, status) {
  if (status === 'manual_confirmation_required') return 'missing_human_confirmation';
  if (status === 'warning') return 'workflow_required_status_failure';
  if (status === 'not_applicable') return 'safe_artifact_missing';
  return `${key}_failed`.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
}

export function buildDiagnosticConsolidatedSummary(report, options = {}) {
  const mode = report?.targetQualityScoreStatus && !report?.sourceHarnessValidationStatus ? 'target' : 'source';
  const catalog = reasonCatalog();
  const blocking = [];
  const manual = [];
  const optional = [];
  for (const [key, value] of statusItems(report)) {
    const status = value.status || 'missing';
    const reasonCodes = Array.isArray(value.reasonCodes) && value.reasonCodes.length ? value.reasonCodes : [safeReasonCode(key, status)];
    const entry = { gate: key, status, reasonCodes: reasonCodes.slice(0, 5) };
    if (['fail', 'missing', 'not_run'].includes(status)) blocking.push(entry);
    else if (['manual_confirmation_required', 'warning'].includes(status)) manual.push(entry);
    else if (status === 'not_applicable') optional.push(entry);
  }
  const summary = {
    schemaVersion: '0.8.4',
    harnessVersion: HARNESS_VERSION,
    mode,
    score: scoreFor(report, mode),
    pathMode: report?.fastPathStatus?.pathMode || 'full_product_path',
    blockingReasons: blocking.slice(0, 10),
    manualReasons: manual.slice(0, 10),
    optionalReasons: optional.slice(0, 10),
    unsafeValueClasses: report?.safeOutputScanStatus?.unsafeClasses || [],
    invalidReportSummary: options.invalidReportSummary || null,
    baselineSummary: report?.remoteProductBaselineStatus ? { status: report.remoteProductBaselineStatus.status } : null,
    npmDiagnosticSummary: report?.remoteNpmDiagnosticStatus ? { status: report.remoteNpmDiagnosticStatus.status } : null,
    stalePrSummary: report?.stalePrAuditStatus ? { status: report.stalePrAuditStatus.status } : null,
    artifactIndexSummary: report?.safeArtifactIndexStatus ? { status: report.safeArtifactIndexStatus.status } : null,
    v094Summary: {
      remoteProductContextRestore: report?.remoteProductContextRestoreStatus?.status || 'missing',
      productRelevantEvidenceLock: report?.productRelevantEvidenceLockStatus?.status || 'missing',
      productBaselineContinuity: report?.productBaselineContinuityStatus?.status || 'missing',
      skipNpmProductBypass: report?.skipNpmProductBypassStatus?.status || 'missing',
      pullRequestContextFidelity: report?.pullRequestContextFidelityStatus?.status || 'missing',
      productVerificationContext: report?.productVerificationContextStatus?.status || 'missing',
      productEvidencePropagation: report?.productEvidencePropagationStatus?.status || 'missing',
      productContextSafeArtifact: report?.productContextSafeArtifactStatus?.status || 'missing',
      runtimeJobSafety: report?.runtimeJobSafetyStatus?.status || 'missing',
      txPathStateEvidence: report?.txPathStateEvidenceStatus?.status || 'missing',
      envConsistency: report?.envConsistencyStatus?.status || 'missing',
      stagingNoTxPreflight: report?.stagingNoTxPreflightStatus?.status || 'missing',
      runtimeLogSecretScan: report?.runtimeLogSecretScanStatus?.status || 'missing',
      chainScope: report?.chainScopeStatus?.status || 'missing',
      falsePositiveBudget: report?.falsePositiveBudgetStatus?.status || 'missing',
      v094SelfTest: report?.v094SelfTestStatus?.status || 'missing',
      safeSummaryOnly: true,
    },
    v095Summary: {
      agentsDoctrine: report?.agentsDoctrineStatus?.status || 'missing',
      skillRouting: report?.skillRoutingStatus?.status || 'missing',
      skillLoadBudget: report?.skillLoadBudgetStatus?.status || 'missing',
      skillDrift: report?.skillDriftStatus?.status || 'missing',
      agentSessionGovernance: report?.agentSessionGovernanceStatus?.status || 'missing',
      agentContainmentBoundary: report?.agentContainmentBoundaryStatus?.status || 'missing',
      evalTraceHarvest: report?.evalTraceHarvestStatus?.status || 'missing',
      operatorVisibleDelta: report?.operatorVisibleDeltaStatus?.status || 'missing',
      traceToEvalCandidate: report?.traceToEvalCandidateStatus?.status || 'missing',
      subagentGovernance: report?.subagentGovernanceStatus?.status || 'missing',
      subagentReviewMatrix: report?.subagentReviewMatrixStatus?.status || 'missing',
      skillEvidenceLink: report?.skillEvidenceLinkStatus?.status || 'missing',
      stateMachineSchema: report?.stateMachineSchemaStatus?.status || 'missing',
      stateTransitionHelper: report?.stateTransitionHelperStatus?.status || 'missing',
      receiptEvidenceSchema: report?.receiptEvidenceSchemaStatus?.status || 'missing',
      workerReadinessSequence: report?.workerReadinessSequenceStatus?.status || 'missing',
      evidenceMinimality: report?.evidenceMinimalityStatus?.status || 'missing',
      evidenceDedup: report?.evidenceDedupStatus?.status || 'missing',
      safeArtifactNextAction: report?.safeArtifactNextActionStatus?.status || 'missing',
      v095SelfTest: report?.v095SelfTestStatus?.status || 'missing',
      safeSummaryOnly: true,
    },
    v097Summary: {
      activeSelfTestRegistry: report?.activeSelfTestRegistryStatus?.status || 'missing',
      workflowProductVerificationInvariant: report?.workflowProductVerificationInvariantStatus?.status || 'missing',
      targetHotfixRegression: report?.targetHotfixRegressionStatus?.status || 'missing',
      harnessRolloutDiffRegression: report?.harnessRolloutDiffRegressionStatus?.status || 'missing',
      blockerRootCauseClassifier: report?.blockerRootCauseClassifierStatus?.status || 'missing',
      localRemoteEvidencePhase: report?.localRemoteEvidencePhaseStatus?.status || 'missing',
      structuredSolvability: report?.structuredSolvabilityStatus?.status || 'missing',
      live2dDatasetRowAudit: report?.live2dDatasetRowAuditStatus?.status || 'missing',
      motionAllowlistSync: report?.motionAllowlistSyncStatus?.status || 'missing',
      trustedLoaderEvidence: report?.trustedLoaderEvidenceStatus?.status || 'missing',
      live2dEvidenceCollectorContract: report?.live2dEvidenceCollectorContractStatus?.status || 'missing',
      avatarUxSafety: report?.avatarUxSafetyStatus?.status || 'missing',
      runtimeLatencyMeasurement: report?.runtimeLatencyMeasurementStatus?.status || 'missing',
      browserSmokeJsonArtifact: report?.browserSmokeJsonArtifactStatus?.status || 'missing',
      ownerDecisionDigest: report?.ownerDecisionDigestStatus?.status || 'missing',
      obsoletePrAutoRecommend: report?.obsoletePrAutoRecommendStatus?.status || 'missing',
      datasetAuditV2Schema: report?.datasetAuditV2SchemaStatus?.status || 'missing',
      datasetAuditRunnerReadiness: report?.datasetAuditRunnerReadinessStatus?.status || 'missing',
      v097SelfTest: report?.v097SelfTestStatus?.status || 'missing',
      safeSummaryOnly: true,
    },
    v098Summary: {
      remoteProductEvidenceExecution: report?.remoteProductEvidenceExecutionStatus?.status || 'missing',
      remoteProductEvidenceRunner: report?.remoteProductEvidenceRunnerStatus?.status || 'missing',
      productEvidenceConsumption: report?.productEvidenceConsumptionStatus?.status || 'missing',
      placeholderEvidenceForbidden: report?.placeholderEvidenceForbiddenStatus?.status || 'missing',
      localRemotePhase: report?.localRemotePhaseStatus?.status || 'missing',
      structuredSolvabilityFields: report?.structuredSolvabilityFieldsStatus?.status || 'missing',
      live2dDatasetRowAuditRunner: report?.live2dDatasetRowAuditRunnerStatus?.status || 'missing',
      motionAllowlistDiff: report?.motionAllowlistDiffStatus?.status || 'missing',
      trustedLoaderEvidenceEnforcer: report?.trustedLoaderEvidenceEnforcerStatus?.status || 'missing',
      avatarUxSafetyRunner: report?.avatarUxSafetyRunnerStatus?.status || 'missing',
      runtimeLatencySafeMetric: report?.runtimeLatencySafeMetricStatus?.status || 'missing',
      browserSmokeVisualSafetyArtifact: report?.browserSmokeVisualSafetyArtifactStatus?.status || 'missing',
      openPrRebaseReadiness: report?.openPrRebaseReadinessStatus?.status || 'missing',
      fiveLineOwnerDigest: report?.fiveLineOwnerDigestStatus?.status || 'missing',
      v098SelfTest: report?.v098SelfTestStatus?.status || 'missing',
      safeSummaryOnly: true,
    },
    v099Summary: {
      formalEvidencePrecedence: report?.formalEvidencePrecedenceStatus?.status || 'missing',
      lifeboatSemantics: report?.lifeboatSemanticsStatus?.status || 'missing',
      placeholderOnlyEvidence: report?.placeholderOnlyEvidenceStatus?.status || 'missing',
      remoteNpmDiagnosticNormalization: report?.remoteNpmDiagnosticNormalizationStatus?.status || 'missing',
      legacySelfTestAdvisory: report?.legacySelfTestAdvisoryStatus?.status || 'missing',
      authSurfaceClassifierRefinement: report?.authSurfaceClassifierRefinementStatus?.status || 'missing',
      targetQualityBlockerDigest: report?.targetQualityBlockerDigestStatus?.status || 'missing',
      prEvidenceAutoRepairHint: report?.prEvidenceAutoRepairHintStatus?.status || 'missing',
      actionsBlockerRecovery: report?.actionsBlockerRecoveryStatus?.status || 'missing',
      prContextRerunAssistant: report?.prContextRerunAssistantStatus?.status || 'missing',
      sameHeadEvidenceRefresh: report?.sameHeadEvidenceRefreshStatus?.status || 'missing',
      safeArtifactBundleCompleteness: report?.safeArtifactBundleCompletenessStatus?.status || 'missing',
      datasetAuditV2P0Schema: report?.datasetAuditV2P0SchemaStatus?.status || 'missing',
      gameToolAdapterFixtureReadiness: report?.gameToolAdapterFixtureReadinessStatus?.status || 'missing',
      belovedAvatarSafetyReadiness: report?.belovedAvatarSafetyReadinessStatus?.status || 'missing',
      v099SelfTest: report?.v099SelfTestStatus?.status || 'missing',
      safeSummaryOnly: true,
    },
    v096Summary: {
      kRuleCoverage: report?.kRuleCoverageStatus?.status || 'missing',
      live2dSpecSync: report?.live2dSpecSyncStatus?.status || 'missing',
      runtimeLatencyBudget: report?.runtimeLatencyBudgetStatus?.status || 'missing',
      obsoleteOpenPr: report?.obsoleteOpenPrStatus?.status || 'missing',
      ownerSummaryCompact: report?.ownerSummaryCompactStatus?.status || 'missing',
      browserSmokeArtifact: report?.browserSmokeArtifactStatus?.status || 'missing',
      failureToRepairPlan: report?.failureToRepairPlanStatus?.status || 'missing',
      runtimeStateAdoption: report?.runtimeStateAdoptionStatus?.status || 'missing',
      claimTransition: report?.claimTransitionStatus?.status || 'missing',
      timeoutAdoption: report?.timeoutAdoptionStatus?.status || 'missing',
      txReconciliationService: report?.txReconciliationServiceStatus?.status || 'missing',
      txHashBeforeWait: report?.txHashBeforeWaitStatus?.status || 'missing',
      receiptResumeBoundary: report?.receiptResumeBoundaryStatus?.status || 'missing',
      migrationRolloutSafety: report?.migrationRolloutSafetyStatus?.status || 'missing',
      migrationRuntimeCompat: report?.migrationRuntimeCompatStatus?.status || 'missing',
      humanReviewDigest: report?.humanReviewDigestStatus?.status || 'missing',
      datasetAuditReadiness: report?.datasetAuditReadinessStatus?.status || 'missing',
      gameToolAdapterContractFixture: report?.gameToolAdapterContractFixtureStatus?.status || 'missing',
      belovedAvatarSafetyAudit: report?.belovedAvatarSafetyAuditStatus?.status || 'missing',
      v096SelfTest: report?.v096SelfTestStatus?.status || 'missing',
      safeSummaryOnly: true,
    },
    v093Summary: {
      previousTargetHotfixPreservation: report?.previousTargetHotfixPreservationStatus?.status || 'missing',
      targetPatchManifest: report?.targetPatchManifestStatus?.status || 'missing',
      targetRolloutConflict: report?.targetRolloutConflictStatus?.status || 'missing',
      remoteProductPrContextFixture: report?.remoteProductPrContextFixtureStatus?.status || 'missing',
      targetScriptClassificationFixture: report?.targetScriptClassificationFixtureStatus?.status || 'missing',
      sameHeadArtifactEvidence: report?.sameHeadArtifactEvidenceStatus?.status || 'missing',
      dockerSmokeCurrentHeadArtifact: report?.dockerSmokeCurrentHeadArtifactStatus?.status || 'missing',
      targetSkipNpmProductOverride: report?.targetSkipNpmProductOverrideStatus?.status || 'missing',
      goalCondition: report?.goalConditionStatus?.status || 'missing',
      reviewPolicyClassifier: report?.reviewPolicyClassifierStatus?.status || 'missing',
      prEvidenceCompact: report?.prEvidenceCompactStatus?.status || 'missing',
      v093SelfTest: report?.v093SelfTestStatus?.status || 'missing',
      safeSummaryOnly: true,
    },
    v092Summary: {
      versionLineage: report?.versionLineageStatus?.status || 'missing',
      prEvidenceRenderer: report?.prEvidenceRendererStatus?.status || 'missing',
      safeArtifactClassifier: report?.safeArtifactClassifierStatus?.status || 'missing',
      securityLifecycle: report?.securityLifecycleStatus?.status || 'missing',
      reviewIndependence: report?.reviewIndependenceStatus?.status || 'missing',
      taskBriefCompiler: report?.taskBriefCompilerStatus?.status || 'missing',
      bestOfNDecision: report?.bestOfNDecisionStatus?.status || 'missing',
      environmentProfile: report?.environmentProfileStatus?.status || 'missing',
      agentsContextBudget: report?.agentsContextBudgetStatus?.status || 'missing',
      evidenceAutoRepairHint: report?.evidenceAutoRepairHintStatus?.status || 'missing',
      v092SelfTest: report?.v092SelfTestStatus?.status || 'missing',
      safeSummaryOnly: true,
    },
    v085Summary: report?.v085StabilityStatus ? {
      status: report.v085StabilityStatus.status,
      taskDiscipline: report.v085StabilityStatus.taskDisciplineStatus?.status || 'missing',
      bugfixEvidence: report.v085StabilityStatus.bugfixEvidenceStatus?.status || 'missing',
      fastPathDecision: report.v085StabilityStatus.fastPathExplainabilityStatus?.decision || '',
    } : null,
    codeReviewMonitorSummary: report?.codeReviewMonitorStatus ? {
      status: report.codeReviewMonitorStatus.status,
      reviewProfile: report.codeReviewMonitorStatus.reviewProfile || 'unknown',
      blockingCount: Array.isArray(report.codeReviewMonitorStatus.blockingFindings) ? report.codeReviewMonitorStatus.blockingFindings.length : 0,
      manualCount: Array.isArray(report.codeReviewMonitorStatus.manualFindings) ? report.codeReviewMonitorStatus.manualFindings.length : 0,
      warningCount: Array.isArray(report.codeReviewMonitorStatus.warnings) ? report.codeReviewMonitorStatus.warnings.length : 0,
      safeSummaryOnly: true,
    } : null,
    governanceSummary: {
      prompt: report?.promptGovernanceStatus?.status || 'missing',
      knowledge: report?.knowledgeGovernanceStatus?.status || 'missing',
      contract: report?.contractGovernanceStatus?.status || 'missing',
      safeSummaryOnly: true,
    },
    oneScreenDashboard: report?.v085StabilityStatus?.oneScreenDashboardStatus || null,
    nextActions: (blocking.length ? ['fix_blocking_gate'] : manual.length ? ['provide_current_head_confirmation'] : ['ready_for_review']).slice(0, 5),
    safeSummaryOnly: true,
  };
  const reasonCodes = [...new Set([
    ...blocking.flatMap((item) => item.reasonCodes),
    ...manual.flatMap((item) => item.reasonCodes),
  ])].filter((code) => !catalog.size || catalog.has(code) || code.endsWith('_failed'));
  const invalidReasonCodes = [...new Set([
    ...blocking.flatMap((item) => item.reasonCodes),
    ...manual.flatMap((item) => item.reasonCodes),
  ])].filter((code) => catalog.size && !catalog.has(code) && !code.endsWith('_failed'));
  const unsafe = scanObjectForUnsafe(summary).length > 0;
  return {
    summary,
    status: unsafe || invalidReasonCodes.length ? 'fail' : 'pass',
    reasonCodes: [
      ...(unsafe ? ['diagnostic_consolidation_invalid'] : []),
      ...(invalidReasonCodes.length ? ['diagnostic_consolidation_invalid'] : []),
      ...reasonCodes.slice(0, 10),
    ],
  };
}

export function buildDiagnosticConsolidationReport(input = null, options = {}) {
  if (!input || typeof input !== 'object') {
    const invalidReportSummary = buildInvalidReportRecoverySummary({
      reportPresent: Boolean(options.reportPresent),
      jsonParseStatus: 'fail',
      fallbackArtifactsWritten: true,
    });
    const consolidated = buildDiagnosticConsolidatedSummary({
      status: 'fail',
      fastPathStatus: { status: 'fail', pathMode: 'full_product_path' },
      workflowQualityRunnerStatus: { status: 'fail', reasonCodes: ['workflow_runner_invalid_report'] },
    }, { invalidReportSummary });
    return simpleStatus('diagnosticConsolidationStatus', 'fail', {
      reasonCodes: ['diagnostic_consolidation_invalid'],
      summary: consolidated.summary,
    });
  }
  const consolidated = buildDiagnosticConsolidatedSummary(input, options);
  return simpleStatus('diagnosticConsolidationStatus', consolidated.status, {
    reasonCodes: consolidated.status === 'pass' ? [] : consolidated.reasonCodes,
    summary: consolidated.summary,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const args = parseArgs();
    let input = null;
    if (args.report) {
      try {
        input = JSON.parse(fs.readFileSync(args.report, 'utf8'));
      } catch {
        input = null;
      }
    } else if (process.env.CODEX_DIAGNOSTIC_REPORT_JSON) {
      input = JSON.parse(process.env.CODEX_DIAGNOSTIC_REPORT_JSON);
    } else {
      input = { status: 'pass', qualityScoreStatus: { status: 'pass', score: 100 }, fastPathStatus: { status: 'pass', pathMode: 'source_harness_fast_path' } };
    }
    const report = buildDiagnosticConsolidationReport(input, { reportPresent: Boolean(args.report) });
    if (args.out || process.argv.includes('--write-artifact')) {
      fs.writeFileSync(args.out || 'codex-diagnostic-consolidated-summary.json', JSON.stringify(report.diagnosticConsolidationStatus.summary, null, 2));
    }
    writeJsonReport(report, 'CODEX_DIAGNOSTIC_CONSOLIDATION_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('diagnosticConsolidationStatus', 'fail', { reasonCodes: ['diagnostic_consolidation_invalid'] });
    writeJsonReport(report, 'CODEX_DIAGNOSTIC_CONSOLIDATION_REPORT');
    process.exit(1);
  }
}
