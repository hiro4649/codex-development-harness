#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.4
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, readJson, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

export function buildFinalSummary(report = {}, mode = report.targetQualityScoreStatus ? 'target' : 'source') {
  const summary = {
    schemaVersion: '0.8.3',
    harnessVersion: HARNESS_VERSION,
    repo: report.repository || process.env.CODEX_REPOSITORY || '',
    mode,
    headSha: report.headSha || process.env.CODEX_PR_HEAD_SHA || process.env.GITHUB_SHA || '',
    targetQualityScore: report.targetQualityScoreStatus?.score ?? null,
    sourceQualityScore: report.qualityScoreStatus?.score ?? null,
    agentsContext: report.agentsContextStatus?.status || 'missing',
    changeClassification: report.changeClassificationStatus?.status || 'missing',
    productVerification: report.productVerificationStatus?.status || 'missing',
    baselineStatus: report.remoteProductBaselineStatus?.status || 'not_applicable',
    npmDiagnostic: report.remoteNpmDiagnosticStatus?.status || 'not_applicable',
    codeReviewMonitor: report.codeReviewMonitorStatus?.status || 'missing',
    promptGovernance: report.promptGovernanceStatus?.status || 'missing',
    knowledgeGovernance: report.knowledgeGovernanceStatus?.status || 'missing',
    contractGovernance: report.contractGovernanceStatus?.status || 'missing',
    complexityGovernance: report.complexityGovernanceStatus?.status || 'missing',
    artifactLifeboat: report.artifactLifeboatStatus?.status || 'missing',
    classificationCoverage: report.classificationCoverageStatus?.status || 'missing',
    remoteLocalParity: report.remoteLocalParityStatus?.status || 'missing',
    noArtifactFailure: report.noArtifactFailureStatus?.status || 'missing',
    versionLineage: report.versionLineageStatus?.status || 'missing',
    prEvidenceRenderer: report.prEvidenceRendererStatus?.status || 'missing',
    safeArtifactClassifier: report.safeArtifactClassifierStatus?.status || 'missing',
    securityLifecycle: report.securityLifecycleStatus?.status || 'missing',
    reviewIndependence: report.reviewIndependenceStatus?.status || 'missing',
    taskBriefCompiler: report.taskBriefCompilerStatus?.status || 'missing',
    bestOfNDecision: report.bestOfNDecisionStatus?.status || 'missing',
    environmentProfile: report.environmentProfileStatus?.status || 'missing',
    agentsContextBudget: report.agentsContextBudgetStatus?.status || 'missing',
    evidenceAutoRepairHint: report.evidenceAutoRepairHintStatus?.status || 'missing',
    previousTargetHotfixPreservation: report.previousTargetHotfixPreservationStatus?.status || 'missing',
    targetPatchManifest: report.targetPatchManifestStatus?.status || 'missing',
    targetRolloutConflict: report.targetRolloutConflictStatus?.status || 'missing',
    remoteProductPrContextFixture: report.remoteProductPrContextFixtureStatus?.status || 'missing',
    targetScriptClassificationFixture: report.targetScriptClassificationFixtureStatus?.status || 'missing',
    sameHeadArtifactEvidence: report.sameHeadArtifactEvidenceStatus?.status || 'missing',
    dockerSmokeCurrentHeadArtifact: report.dockerSmokeCurrentHeadArtifactStatus?.status || 'missing',
    targetSkipNpmProductOverride: report.targetSkipNpmProductOverrideStatus?.status || 'missing',
    goalCondition: report.goalConditionStatus?.status || 'missing',
    reviewPolicyClassifier: report.reviewPolicyClassifierStatus?.status || 'missing',
    prEvidenceCompact: report.prEvidenceCompactStatus?.status || 'missing',
    remoteProductContextRestore: report.remoteProductContextRestoreStatus?.status || 'missing',
    productRelevantEvidenceLock: report.productRelevantEvidenceLockStatus?.status || 'missing',
    productBaselineContinuity: report.productBaselineContinuityStatus?.status || 'missing',
    skipNpmProductBypass: report.skipNpmProductBypassStatus?.status || 'missing',
    pullRequestContextFidelity: report.pullRequestContextFidelityStatus?.status || 'missing',
    productVerificationContext: report.productVerificationContextStatus?.status || 'missing',
    productEvidencePropagation: report.productEvidencePropagationStatus?.status || 'missing',
    productContextSafeArtifact: report.productContextSafeArtifactStatus?.status || 'missing',
    runtimeJobSafety: report.runtimeJobSafetyStatus?.status || 'missing',
    txPathStateEvidence: report.txPathStateEvidenceStatus?.status || 'missing',
    envConsistency: report.envConsistencyStatus?.status || 'missing',
    stagingNoTxPreflight: report.stagingNoTxPreflightStatus?.status || 'missing',
    runtimeLogSecretScan: report.runtimeLogSecretScanStatus?.status || 'missing',
    chainScope: report.chainScopeStatus?.status || 'missing',
    falsePositiveBudget: report.falsePositiveBudgetStatus?.status || 'missing',
    baselineHealth: report.baselineHealthStatus?.status || 'missing',
    evidenceContinuity: report.evidenceContinuityStatus?.status || 'missing',
    prBodySurfaceNormalizer: report.prBodySurfaceNormalizerStatus?.status || 'missing',
    prTemplateCompiler: report.prTemplateCompilerStatus?.status || 'missing',
    selfTestCaseExport: report.selfTestCaseExportStatus?.status || 'missing',
    scoreDecomposition: report.scoreDecompositionStatus?.status || 'missing',
    gateDecisionTrace: report.gateDecisionTraceStatus?.status || 'missing',
    oldHarnessMarker: report.oldHarnessMarkerStatus?.status || 'missing',
    v089SelfTest: report.v089SelfTestStatus?.status || 'missing',
    v090SelfTest: report.v090SelfTestStatus?.status || 'missing',
    v092SelfTest: report.v092SelfTestStatus?.status || 'missing',
    v093SelfTest: report.v093SelfTestStatus?.status || 'missing',
    v094SelfTest: report.v094SelfTestStatus?.status || 'missing',
    stalePrAudit: report.stalePrAuditStatus?.status || 'not_applicable',
    reasonSummary: report.reasonSummary?.status || report.reasonSummaryStatus?.status || 'missing',
    runtimeReadinessClaimed: Boolean(report.changeClassificationStatus?.runtimeReadinessClaimed),
    productFilesChanged: Boolean(report.changeClassificationStatus?.productRelevantChanged),
    packageFilesChanged: Boolean(report.changeClassificationStatus?.packageOrLockfileChanged),
    mergeReadiness: report.targetMergeReady ?? report.mergeReady ?? false,
    topNextAction: report.reasonSummary?.topNextActions?.[0] || report.reasonSummaryStatus?.summary?.topNextActions?.[0] || '',
    safeSummaryOnly: true,
  };
  return {
    status: scanObjectForUnsafe(summary).length ? 'fail' : 'pass',
    reasonCodes: scanObjectForUnsafe(summary).length ? ['target_final_summary_invalid'] : [],
    summary,
  };
}

export function buildFinalSummaryReport(env = process.env) {
  const file = env.CODEX_FINAL_SUMMARY_REPORT_PATH || env.CODEX_WORKFLOW_REPORT_PATH || process.argv[2];
  if (!file) return simpleStatus('targetFinalSummaryStatus', 'not_applicable', { reasonCodes: ['final_summary_not_requested'] });
  const parsed = readJson(file);
  if (!parsed.ok) return simpleStatus('targetFinalSummaryStatus', 'fail', { reasonCodes: ['target_final_summary_invalid'] });
  const built = buildFinalSummary(parsed.value);
  return simpleStatus('targetFinalSummaryStatus', built.status, {
    reasonCodes: built.reasonCodes,
    summary: built.summary,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildFinalSummaryReport();
    if (process.argv.includes('--write-artifact') && report.targetFinalSummaryStatus.summary) {
      const mode = report.targetFinalSummaryStatus.summary.mode === 'target' ? 'target' : 'source';
      fs.writeFileSync(`codex-${mode}-final-summary.json`, JSON.stringify(report.targetFinalSummaryStatus.summary, null, 2));
    }
    writeJsonReport(report, 'CODEX_TARGET_FINAL_SUMMARY_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('targetFinalSummaryStatus', 'fail', { reasonCodes: ['target_final_summary_invalid'] });
    writeJsonReport(report, 'CODEX_TARGET_FINAL_SUMMARY_REPORT');
    process.exit(1);
  }
}
