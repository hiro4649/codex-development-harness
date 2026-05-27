#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.3
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, parseArgs, simpleStatus, writeJsonReport } from './codex-v080-lib.mjs';
import { scanSafeOutput } from './codex-safe-output-scan.mjs';
import { buildCompactReasonSummary } from './codex-reason-summary.mjs';
import { buildSafeArtifactIndex } from './codex-safe-artifact-index.mjs';
import { buildFinalSummary } from './codex-target-final-summary.mjs';
import { buildDiagnosticConsolidatedSummary } from './codex-diagnostic-consolidation-runner.mjs';
import { buildInvalidReportRecoverySummary } from './codex-invalid-report-recovery.mjs';

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
  ...v093StatusKeys,
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
  const hasV084Shape = report.harnessVersion === HARNESS_VERSION || [...v084Fields].some((key) => report[key]);
  const hasV085Shape = report.harnessVersion === HARNESS_VERSION || [...v085Fields].some((key) => report[key]);
  const hasV086Shape = report.harnessVersion === HARNESS_VERSION || [...v086Fields].some((key) => report[key]);
  const hasV087Shape = report.harnessVersion === HARNESS_VERSION || [...v087Fields].some((key) => report[key]);
  const hasV088Shape = report.harnessVersion === HARNESS_VERSION || [...v088Fields].some((key) => report[key]);
  const hasV089Shape = report.harnessVersion === HARNESS_VERSION || [...v089Fields].some((key) => report[key]);
  const hasV090Shape = report.harnessVersion === HARNESS_VERSION || [...v090Fields].some((key) => report[key]);
  const hasV092Shape = report.harnessVersion === HARNESS_VERSION || [...v092Fields].some((key) => report[key]);
  const hasV093Shape = report.harnessVersion === HARNESS_VERSION || [...v093Fields].some((key) => report[key]);
  const required = (mode === 'target' ? targetRequiredPass : sourceRequiredPass)
    .filter((key) => hasV084Shape || !v084Fields.has(key))
    .filter((key) => hasV085Shape || !v085Fields.has(key))
    .filter((key) => hasV086Shape || !v086Fields.has(key))
    .filter((key) => hasV087Shape || !v087Fields.has(key))
    .filter((key) => hasV088Shape || !v088Fields.has(key))
    .filter((key) => hasV089Shape || !v089Fields.has(key))
    .filter((key) => hasV090Shape || !v090Fields.has(key))
    .filter((key) => hasV092Shape || !v092Fields.has(key))
    .filter((key) => hasV093Shape || !v093Fields.has(key));
  const failures = [];
  for (const key of required) {
    const status = report[key]?.status || 'missing';
    if (!statusAllowed(key, status, options.eventName || process.env.CODEX_EVENT_NAME)) failures.push(`${key}=${status}`);
  }
  if (options.gateExit && options.gateExit !== 0 && !['pass', 'manual_confirmation_required'].includes(report.status)) {
    failures.push(`report.status=${report.status || 'missing'}`);
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
  const safeSummary = {
    marker,
    harnessVersion: HARNESS_VERSION,
    mode,
    status: report.status || 'missing',
    mergeReady: Boolean(report.mergeReady),
    targetMergeReady: report.targetMergeReady ?? null,
    humanReviewRequired: Boolean(report.humanReviewRequired),
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
    failureCount: Array.isArray(report.failures) ? report.failures.length : 0,
    warningCount: Array.isArray(report.warnings) ? report.warnings.length : 0,
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
  fs.writeFileSync('codex-self-test-cases.safe.json', JSON.stringify({
    suite: report.v092SelfTestStatus?.suite || report.selfTestCaseExportStatus?.suite || 'local_quality_gate',
    caseCount: report.v092SelfTestStatus?.caseCount ?? report.selfTestCaseExportStatus?.caseCount ?? 0,
    failedCaseCount: report.v092SelfTestStatus?.failedCaseCount ?? report.selfTestCaseExportStatus?.failedCaseCount ?? 0,
    failedCases: Array.isArray(report.v092SelfTestStatus?.failedCases) ? report.v092SelfTestStatus.failedCases.slice(0, 20) : (Array.isArray(report.selfTestCaseExportStatus?.failedCases) ? report.selfTestCaseExportStatus.failedCases.slice(0, 20) : []),
    safeSummaryOnly: true,
  }, null, 2));
  fs.writeFileSync('codex-safe-artifact-classification.safe.json', JSON.stringify(report.safeArtifactClassifierStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));
  fs.writeFileSync('codex-pr-evidence-rendered.safe.json', JSON.stringify(report.prEvidenceRendererStatus?.blocks || { status: report.prEvidenceRendererStatus?.status || 'missing', safeSummaryOnly: true }, null, 2));
  fs.writeFileSync('codex-evidence-auto-repair-hint.safe.json', JSON.stringify(report.evidenceAutoRepairHintStatus?.hint || { status: report.evidenceAutoRepairHintStatus?.status || 'missing', safeSummaryOnly: true }, null, 2));
  fs.writeFileSync('codex-same-head-artifact-evidence.safe.json', JSON.stringify(report.sameHeadArtifactEvidenceStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));
  fs.writeFileSync('codex-docker-smoke-artifact.safe.json', JSON.stringify(report.dockerSmokeCurrentHeadArtifactStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));
  fs.writeFileSync('codex-pr-evidence-compact.safe.json', JSON.stringify(report.prEvidenceCompactStatus || { status: 'missing', safeSummaryOnly: true }, null, 2));
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
    ...(result.mode === 'target' ? [{ artifactName: 'codex-target-quality-summary.json', path: 'codex-target-quality-summary.json', status: 'present' }] : []),
    { artifactName: 'codex-workflow-preflight.safe.json', path: 'codex-workflow-preflight.safe.json', status: fs.existsSync('codex-workflow-preflight.safe.json') ? 'present' : 'missing', reasonCodes: fs.existsSync('codex-workflow-preflight.safe.json') ? [] : ['safe_artifact_missing'] },
    { artifactName: 'codex-test-metrics.safe.json', path: 'codex-test-metrics.safe.json', status: fs.existsSync('codex-test-metrics.safe.json') ? 'present' : 'not_applicable' },
    { artifactName: 'codex-invalid-report-recovery-summary.json', path: 'codex-invalid-report-recovery-summary.json', status: fs.existsSync('codex-invalid-report-recovery-summary.json') ? 'present' : 'not_applicable' },
  ], result.mode, { enforceRequired: true, maxArtifacts: 20 });
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
  if (result.failures.length) {
    for (const item of result.failures.slice(0, 20)) {
      const safe = String(item).replace(/[^A-Za-z0-9_.:= -]/g, '_').slice(0, 180);
      console.error(`::error title=codex-quality-gate::${safe}`);
    }
    process.exit(1);
  }
}
