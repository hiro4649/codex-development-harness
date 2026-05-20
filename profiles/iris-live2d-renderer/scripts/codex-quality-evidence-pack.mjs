#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.8
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function runReport() {
  const result = spawnSync(process.execPath, ['scripts/codex-local-quality-gate.mjs'], {
    env: { ...process.env, CODEX_RUN_PROFILE_REQUIRED_CHECKS: '1', CODEX_QUALITY_REPORT: 'json' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try { return { exitCode: result.status ?? 1, report: JSON.parse(result.stdout || '{}') }; } catch { return { exitCode: result.status ?? 1, report: null }; }
}
function safePack(report, exitCode) {
  return {
    evidencePackSchemaVersion: report?.evidencePackSchemaVersion || '1.1.0',
    qualityReportSchemaVersion: report?.qualityReportSchemaVersion || 'unknown',
    codeAuditSchemaVersion: report?.codeAuditSchemaVersion || 'unknown',
    harnessVersion: report?.harnessVersion || 'unknown',
    profile: report?.profile || 'unknown',
    riskLevel: report?.riskLevel || 'unknown',
    mergeReady: report?.mergeReady === true,
    worktreeDoctor: report?.worktreeStatus?.status || 'unknown',
    secretScan: report?.secretScan?.status || 'unknown',
    localQualityGate: report?.localGate?.status || (exitCode === 0 ? 'pass' : 'fail'),
    profileRequiredChecks: report?.profileRequiredChecks?.status || 'unknown',
    diffScope: {
      outOfScope: report?.changedPathsSummary?.outOfScope?.length || 0,
      blocked: report?.changedPathsSummary?.blocked?.length || 0,
      highRisk: report?.changedPathsSummary?.highRisk?.length || 0,
    },
    prSeparationStatus: report?.prSeparationStatus?.status || 'unknown',
    codeAudit: report?.codeAudit || { status: 'unknown', blocking: 0, warning: 0, info: 0 },
    decisionMatrix: report?.decisionMatrix || { status: 'unknown' },
    findingLifecycle: {
      status: report?.findingLifecycle?.status || 'unknown',
      new: report?.findingLifecycle?.new?.length || 0,
      existing: report?.findingLifecycle?.existing?.length || 0,
      resolved: report?.findingLifecycle?.resolved?.length || 0,
      needsHumanReview: report?.findingLifecycle?.needsHumanReview?.length || 0,
    },
    prTypeInference: report?.prTypeInference || { status: 'unknown', inferredType: 'unknown' },
    residualTestStatus: report?.residualTestStatus || { status: 'unknown' },
    skillShapeStatus: report?.skillShapeStatus || { status: 'unknown', checked: 0 },
    fixImpact: report?.fixImpact || 'unknown',
    rootCauseGroups: (report?.rootCauseGroups || []).slice(0, 5).map((item) => ({
      rootCauseId: item.rootCauseId,
      ruleIds: item.ruleIds,
      severity: item.severity,
      confidence: item.confidence,
      priority: item.priority,
      recommendedFixType: item.recommendedFixType,
      affectedFileCount: item.affectedFiles?.length || 0,
      findingCount: item.findingCount || 0,
    })),
    codeAuditCalibration: report?.codeAuditCalibration?.status || 'unknown',
    auditRegressionSuite: report?.auditRegressionSuite || { status: 'unknown' },
    auditScorecard: report?.auditScorecard || { status: 'unknown' },
    auditQualityStatus: report?.auditQualityStatus || 'unknown',
    auditQualityScore: report?.auditQualityScore ?? 0,
    auditQualityWarnings: report?.auditQualityWarnings || [],
    auditEvaluation: report?.auditEvaluation || { status: 'unknown' },
    faultInjectionBenchmark: report?.faultInjectionBenchmark || { status: 'unknown' },
    semanticImpact: report?.semanticImpact || { status: 'unknown', categories: [] },
    testSufficiency: report?.testSufficiency || { status: 'unknown', testSufficiencyScore: 0 },
    specTestMismatch: report?.specTestMismatch || { status: 'unknown' },
    specTestCodeConsistency: report?.specTestCodeConsistency || { status: 'unknown' },
    defectTaxonomy: report?.defectTaxonomy || { status: 'unknown' },
    oracleLimits: report?.oracleLimits || { status: 'unknown' },
    decisionTrace: report?.decisionTrace || { status: 'unknown' },
    auditConfidenceEvidence: report?.auditConfidenceEvidence || { status: 'unknown' },
    precisionRecallGuardrails: report?.precisionRecallGuardrails || { status: 'unknown' },
    calibrationLockStatus: report?.calibrationLockStatus || { status: 'unknown' },
    reviewerInstructionCompactness: report?.reviewerInstructionCompactness || { status: 'unknown' },
    fixPlanValidation: report?.fixPlanValidation || { status: 'unknown' },
    prScopeAgreement: report?.prScopeAgreement || { status: 'unknown' },
    auditDriftReport: report?.auditDriftReport || { status: 'unknown' },
    residualFailureGovernance: report?.residualFailureGovernance || { status: 'unknown' },
    ciParity: report?.ciParity || { status: 'unknown' },
    realProjectDryRunAuditPack: report?.realProjectDryRunAuditPack || { status: 'unknown' },
    severitySanity: report?.severitySanity || { status: 'unknown' },
    humanReviewRoleMapping: report?.humanReviewRoleMapping || { status: 'unknown', roles: [] },
    auditUsefulnessValidation: report?.auditUsefulnessValidation || { status: 'unknown' },
    auditGrade: report?.auditGrade || { status: 'unknown', auditGrade: 0 },
    oracleValidation: report?.oracleValidation || { status: 'unknown' },
    decisionSimulator: report?.decisionSimulator || { status: 'unknown', scenarioResults: [] },
    remediationVerification: report?.remediationVerification || { status: 'unknown' },
    benchmarkPack: report?.benchmarkPack || { status: 'unknown' },
    acceptanceCriteria: report?.acceptanceCriteria || { status: 'unknown', missingCriteria: [] },
    confusionRisk: report?.confusionRisk || { status: 'unknown', confusionSignals: [] },
    temporalConsistency: report?.temporalConsistency || { status: 'unknown', staleEvidence: [] },
    scenarioReplay: report?.scenarioReplay || { status: 'unknown' },
    humanReviewChecklist: report?.humanReviewChecklist || { status: 'unknown' },
    specAuthorityStatus: report?.specAuthorityStatus || { status: 'unknown' },
    auditCompleteness: report?.auditCompleteness || { status: 'unknown' },
    deploymentBoundary: report?.deploymentBoundary || { status: 'unknown' },
    mutationBenchmark: report?.mutationBenchmark || { status: 'unknown' },
    adversarialPrSimulator: report?.adversarialPrSimulator || { status: 'unknown' },
    auditBypass: report?.auditBypass || { status: 'unknown' },
    realWorldCanarySet: report?.realWorldCanarySet || { status: 'unknown' },
    specBoundaryMutation: report?.specBoundaryMutation || { status: 'unknown' },
    testAuditMutation: report?.testAuditMutation || { status: 'unknown' },
    dependencyAdversarial: report?.dependencyAdversarial || { status: 'unknown' },
    ciParityAdversarial: report?.ciParityAdversarial || { status: 'unknown' },
    evidenceIntegrity: report?.evidenceIntegrity || { status: 'unknown' },
    humanOverrideTemplate: report?.humanOverrideTemplate || { status: 'unknown' },
    redTeam: report?.redTeam || { status: 'unknown' },
    monotonicity: report?.monotonicity || { status: 'unknown' },
    minimumEvidence: report?.minimumEvidence || { status: 'unknown' },
    reviewerChallengeQuestions: report?.reviewerChallengeQuestions || { status: 'unknown', questions: [] },
    policyLint: report?.policyLint || { status: 'unknown' },
    auditEffectiveness: report?.auditEffectiveness || { status: 'unknown' },
    fixOutcome: report?.fixOutcome || { status: 'unknown' },
    postFixVerificationPlan: report?.postFixVerificationPlan || { status: 'unknown' },
    repairQuality: report?.repairQuality || { status: 'unknown' },
    splitEffectiveness: report?.splitEffectiveness || { status: 'unknown' },
    noiseControl: report?.noiseControl || { status: 'unknown' },
    auditLearningRecommendation: report?.auditLearningRecommendation || { status: 'unknown' },
    decisionRetrospective: report?.decisionRetrospective || { status: 'unknown' },
    rolloutScore: report?.rolloutScore || { status: 'unknown' },
    freshness: report?.freshness || { status: 'unknown' },
    riskAcceptanceWorkflow: report?.riskAcceptanceWorkflow || { status: 'unknown' },
    reviewerAssignmentQuality: report?.reviewerAssignmentQuality || { status: 'unknown' },
    verificationCompleteness: report?.verificationCompleteness || { status: 'unknown' },
    skippedCheckJustification: report?.skippedCheckJustification || { status: 'unknown' },
    auditModeRecommendation: report?.auditModeRecommendation || { status: 'unknown' },
    auditConflict: report?.auditConflict || { status: 'unknown' },
    maturityScore: report?.maturityScore || { status: 'unknown' },
    minimalPrPlan: report?.minimalPrPlan || { status: 'unknown', splitRecommended: false },
    ciRiskPrediction: report?.ciRiskPrediction || { status: 'unknown', ciRiskReasons: [] },
    profileInvariantEvaluation: report?.profileInvariantEvaluation || { status: 'unknown' },
    confidenceImprovement: report?.confidenceImprovement || { status: 'unknown', positiveSignals: [], negativeSignals: [] },
    auditValidationCommandPlan: report?.auditValidationCommandPlan || { status: 'unknown', commands: [] },
    ruleTuningRecommendation: report?.ruleTuningRecommendation || { status: 'unknown', recommendations: [] },
    goldenPack: report?.goldenPack || { status: 'unknown' },
    auditResultShape: report?.auditResultShape || { status: 'unknown' },
    trustLevel: report?.trustLevel || 'unknown',
    noiseBudget: report?.noiseBudget || { status: 'unknown', warningsShown: 0, warningsHidden: 0, topFindings: [] },
    ruleEffectivenessReport: {
      status: report?.ruleEffectivenessReport?.status || 'unknown',
      count: report?.ruleEffectivenessReport?.rules?.length || 0,
    },
    falsePositiveCandidates: (report?.falsePositiveCandidates || []).slice(0, 5),
    falseNegativeGuard: report?.falseNegativeGuard || { status: 'unknown' },
    profileCalibrationPack: report?.profileCalibrationPack || { status: 'unknown' },
    auditReadinessForRealRepo: report?.auditReadinessForRealRepo || { status: 'unknown' },
    releaseCandidateStatus: report?.releaseCandidateStatus || 'unknown',
    realProjectEvaluation: report?.realProjectEvaluation || { status: 'unknown' },
    feedbackLoop: report?.feedbackLoop || { status: 'unknown' },
    performanceSummary: report?.performanceSummary || { status: 'unknown' },
    profileCalibrationReport: report?.profileCalibrationReport || { status: 'unknown', profiles: [] },
    canaryPromotionWorkflow: report?.canaryPromotionWorkflow || { status: 'unknown' },
    ruleRetirementWorkflow: report?.ruleRetirementWorkflow || { status: 'unknown' },
    smokeBenchmark: report?.smokeBenchmark || { status: 'unknown' },
    ruleTraceability: report?.ruleTraceability || { status: 'unknown', traces: [] },
    reviewerSkillEffectiveness: report?.reviewerSkillEffectiveness || { status: 'unknown' },
    noRegressionStatus: report?.noRegressionStatus || { status: 'unknown' },
    rolloutGate: report?.rolloutGate || { status: 'unknown' },
    trustBoundary: report?.trustBoundary || { status: 'unknown' },
    humanInLoopEnforcement: report?.humanInLoopEnforcement || { status: 'unknown' },
    safeArtifactValidation: report?.safeArtifactValidation || { status: 'unknown' },
    releaseCandidateCheck: report?.releaseCandidateCheck || { status: 'unknown' },
    predictionValidation: report?.predictionValidation || { status: 'unknown', predictions: [] },
    auditToTestMapping: report?.auditToTestMapping || { status: 'unknown', mappings: [] },
    profilePortabilityCheck: report?.profilePortabilityCheck || { status: 'unknown' },
    localVsCiExpectation: report?.localVsCiExpectation || { status: 'unknown' },
    partialRunHandling: report?.partialRunHandling || { status: 'unknown' },
    humanReviewPacket: report?.humanReviewPacket || { status: 'unknown' },
    applyRecommendation: report?.applyRecommendation || { status: 'unknown' },
    stopConditions: report?.stopConditions || { status: 'unknown', triggeredStopConditions: [] },
    auditReplayPack: report?.auditReplayPack || { status: 'unknown' },
    goldenFixtures: report?.goldenFixtures || { status: 'unknown' },
    auditResultStabilityStatus: report?.auditResultStabilityStatus || { status: 'unknown' },
    prSplitRecommendation: report?.prSplitRecommendation || { status: 'unknown', splitRecommended: false },
    fullRunResidualIntelligence: report?.fullRunResidualIntelligence || { status: 'unknown' },
    baselineLifecycle: report?.baselineLifecycle || { status: 'unknown' },
    auditRuleImpact: report?.auditRuleImpact || { status: 'unknown' },
    severityDriftStatus: report?.severityDriftStatus || { status: 'unknown' },
    canaryFindings: report?.canaryFindings || [],
    reviewerCoverageStatus: report?.reviewerCoverageStatus || { status: 'unknown' },
    remediationPlan: report?.remediationPlan || { status: 'unknown' },
    mergeBlockExplanation: report?.mergeBlockExplanation || { status: 'unknown', reasons: [] },
    semanticDiffHints: report?.semanticDiffHints || [],
    fixValidationHints: report?.fixValidationHints || [],
    ruleCalibrationTable: {
      status: report?.ruleCalibrationTable?.status || 'unknown',
      count: report?.ruleCalibrationTable?.rules?.length || 0,
    },
    auditPerformance: {
      status: report?.auditPerformance?.status || 'unknown',
      scannedFiles: report?.auditPerformance?.scannedFiles || 0,
      rootCauseCount: report?.auditPerformance?.rootCauseCount || 0,
      partial: report?.auditPerformance?.partial === true,
    },
    negativeSignals: (report?.negativeSignals || []).map((item) => ({ id: item.id, reason: item.reason })),
    blockingFindings: (report?.blockingFindings || []).map((item) => ({ id: item.id, ruleId: item.ruleId, fingerprint: item.fingerprint, priority: item.priority, path: item.path })),
    warningFindings: (report?.warningFindings || []).map((item) => ({ id: item.id, ruleId: item.ruleId, fingerprint: item.fingerprint, priority: item.priority, path: item.path, known: item.known === true })),
    infoFindings: (report?.infoFindings || []).map((item) => ({ id: item.id, ruleId: item.ruleId, fingerprint: item.fingerprint, priority: item.priority, path: item.path })),
    topFindings: [...(report?.blockingFindings || []), ...(report?.warningFindings || []), ...(report?.infoFindings || [])]
      .slice(0, 5)
      .map((item) => ({ ruleId: item.ruleId, rootCauseId: item.rootCauseId, fingerprint: item.fingerprint, severity: item.severity, confidence: item.confidence, priority: item.priority, usefulness: item.usefulness, actionability: item.actionability, recommendedFixType: item.recommendedFixType, path: item.path })),
    selectedReviewers: report?.selectedReviewers?.reviewers || [],
    testWeakeningStatus: report?.testWeakeningStatus?.status || 'unknown',
    domainInvariantStatus: report?.domainInvariantStatus?.status || 'unknown',
    dependencyAuditStatus: report?.dependencyAuditStatus?.status || 'unknown',
    securitySensitiveChangeStatus: report?.securitySensitiveChangeStatus?.status || 'unknown',
    coverageIntentStatus: report?.coverageIntentStatus?.status || 'unknown',
    knownRisks: {
      status: report?.knownRisks?.status || 'unknown',
      count: report?.knownRisks?.count || 0,
      expired: report?.knownRisks?.expired?.length || 0,
      invalid: report?.knownRisks?.invalid?.length || 0,
    },
    codeAuditBaseline: {
      status: report?.codeAuditBaseline?.status || 'unknown',
      applied: report?.codeAuditBaseline?.matched?.length || 0,
      expired: report?.codeAuditBaseline?.expired?.length || 0,
    },
    missingTestIntent: report?.missingTestIntent || [],
    suppressionStatus: report?.suppressionStatus?.status || 'unknown',
    remediationChecklist: report?.remediationChecklist || [],
    manualMergePolicy: report?.manualMergePolicy?.status || 'manual_confirmation_required',
    manualConfirmationStatus: report?.manualConfirmationStatus || { required: false, status: 'not_required', source: 'none', headShaMatched: false, stale: false, missingItems: [], cannotOverrideFailures: [] },
    postMergePlan: report?.postMergeVerificationPlan || [],
    skippedChecks: (report?.skippedChecks || []).map((item) => ({ name: item.name, reason: item.reason })),
    residualRisks: (report?.warnings || []).map((item) => ({ id: item.id, path: item.path, known: item.known === true })),
    recommendedAction: report?.recommendedAction || 'review quality evidence',
  };
}

const { exitCode, report } = runReport();
const pack = safePack(report, exitCode);
const target = process.env.CODEX_EVIDENCE_PACK_PATH || path.join('docs', 'process', 'reports', 'codex-quality-evidence.json');
if (process.env.CODEX_WRITE_EVIDENCE_PACK === '1') {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
}
console.log('== Codex quality evidence pack ==');
console.log(`harnessVersion: ${pack.harnessVersion}`);
console.log(`profile: ${pack.profile}`);
console.log(`riskLevel: ${pack.riskLevel}`);
console.log(`mergeReady: ${pack.mergeReady ? 'true' : 'false'}`);
console.log(`secretScan: ${pack.secretScan}`);
console.log(`localQualityGate: ${pack.localQualityGate}`);
console.log(`profileRequiredChecks: ${pack.profileRequiredChecks}`);
console.log(`prSeparationStatus: ${pack.prSeparationStatus}`);
console.log(`codeAudit: ${pack.codeAudit.status} blocking=${pack.codeAudit.blocking || 0} warning=${pack.codeAudit.warning || 0} info=${pack.codeAudit.info || 0}`);
console.log(`decisionMatrix: ${pack.decisionMatrix.status || 'unknown'} mustFixBeforeMerge=${pack.decisionMatrix.mustFixBeforeMerge === true}`);
console.log(`findingLifecycle: ${pack.findingLifecycle.status} new=${pack.findingLifecycle.new} resolved=${pack.findingLifecycle.resolved}`);
console.log(`prTypeInference: ${pack.prTypeInference.inferredType || 'unknown'} status=${pack.prTypeInference.status || 'unknown'}`);
console.log(`residualTestStatus: ${pack.residualTestStatus.status || 'unknown'}`);
console.log(`skillShapeStatus: ${pack.skillShapeStatus.status || 'unknown'} checked=${pack.skillShapeStatus.checked || 0}`);
console.log(`rootCauseGroups: ${pack.rootCauseGroups.length}`);
console.log(`fixImpact: ${pack.fixImpact}`);
console.log(`codeAuditCalibration: ${pack.codeAuditCalibration}`);
console.log(`auditRegressionSuite: ${pack.auditRegressionSuite.status || 'unknown'} fp=${pack.auditRegressionSuite.falsePositiveCount || 0} fn=${pack.auditRegressionSuite.falseNegativeCount || 0}`);
console.log(`auditQuality: ${pack.auditQualityStatus} score=${pack.auditQualityScore}`);
console.log(`auditEvaluation: ${pack.auditEvaluation.status || pack.auditEvaluation.evaluationStatus || 'unknown'}`);
console.log(`faultInjectionBenchmark: ${pack.faultInjectionBenchmark.faultInjectionStatus || pack.faultInjectionBenchmark.status || 'unknown'} detected=${pack.faultInjectionBenchmark.detectedFaultCount || 0}`);
console.log(`semanticImpact: ${pack.semanticImpact.semanticImpact || pack.semanticImpact.status || 'unknown'} categories=${pack.semanticImpact.categories?.length || 0}`);
console.log(`testSufficiency: ${pack.testSufficiency.status || 'unknown'} score=${pack.testSufficiency.testSufficiencyScore ?? 0}`);
console.log(`specTestMismatch: ${pack.specTestMismatch.specTestMismatchStatus || pack.specTestMismatch.status || 'unknown'} suspected=${pack.specTestMismatch.suspectedMismatchCount || 0}`);
console.log(`specTestCodeConsistency: ${pack.specTestCodeConsistency.specTestCodeConsistencyStatus || pack.specTestCodeConsistency.status || 'unknown'}`);
console.log(`defectTaxonomy: ${pack.defectTaxonomy.status || 'unknown'} categories=${pack.defectTaxonomy.defectCategory?.length || 0}`);
console.log(`decisionTrace: ${pack.decisionTrace.finalDecision || pack.decisionTrace.status || 'unknown'}`);
console.log(`ciParity: ${pack.ciParity.ciParityStatus || pack.ciParity.status || 'unknown'}`);
console.log(`auditUsefulnessValidation: ${pack.auditUsefulnessValidation.usefulnessValidationStatus || pack.auditUsefulnessValidation.status || 'unknown'}`);
console.log(`auditGrade: ${pack.auditGrade.status || 'unknown'} grade=${pack.auditGrade.auditGrade ?? 0}`);
console.log(`oracleValidation: ${pack.oracleValidation.oracleValidationStatus || pack.oracleValidation.status || 'unknown'} pass=${pack.oracleValidation.oraclePassCount || 0} fail=${pack.oracleValidation.oracleFailCount || 0}`);
console.log(`decisionSimulator: ${pack.decisionSimulator.status || 'unknown'} scenarios=${pack.decisionSimulator.scenarioResults?.length || 0}`);
console.log(`remediationVerification: ${pack.remediationVerification.remediationVerificationStatus || pack.remediationVerification.status || 'unknown'}`);
console.log(`benchmarkPack: ${pack.benchmarkPack.benchmarkPackStatus || pack.benchmarkPack.status || 'unknown'} count=${pack.benchmarkPack.benchmarkCount || 0}`);
console.log(`acceptanceCriteria: ${pack.acceptanceCriteria.status || 'unknown'} missing=${pack.acceptanceCriteria.missingCriteria?.length || 0}`);
console.log(`confusionRisk: ${pack.confusionRisk.confusionRiskStatus || pack.confusionRisk.status || 'unknown'} signals=${pack.confusionRisk.confusionSignals?.length || 0}`);
console.log(`temporalConsistency: ${pack.temporalConsistency.temporalConsistencyStatus || pack.temporalConsistency.status || 'unknown'} stale=${pack.temporalConsistency.staleEvidence?.length || 0}`);
console.log(`scenarioReplay: ${pack.scenarioReplay.replayStatus || pack.scenarioReplay.status || 'unknown'}`);
console.log(`humanReviewChecklist: ${pack.humanReviewChecklist.status || 'unknown'} role=${pack.humanReviewChecklist.reviewRole || 'none'}`);
console.log(`specAuthorityStatus: ${pack.specAuthorityStatus.specAuthorityStatus || pack.specAuthorityStatus.status || 'unknown'}`);
console.log(`auditCompleteness: ${pack.auditCompleteness.auditComplete === true ? 'complete' : 'partial'}`);
console.log(`deploymentBoundary: ${pack.deploymentBoundary.status || 'unknown'} doesNotGuarantee=${pack.deploymentBoundary.doesNotGuarantee?.length || 0}`);
console.log(`mutationBenchmark: ${pack.mutationBenchmark.mutationBenchmarkStatus || pack.mutationBenchmark.status || 'unknown'} detected=${pack.mutationBenchmark.detectedMutationCount || 0}`);
console.log(`adversarialPrSimulator: ${pack.adversarialPrSimulator.status || 'unknown'} bypass=${pack.adversarialPrSimulator.bypassDetected === true}`);
console.log(`auditBypass: ${pack.auditBypass.auditBypassStatus || pack.auditBypass.status || 'unknown'} risks=${pack.auditBypass.bypassRiskCount || 0}`);
console.log(`realWorldCanarySet: ${pack.realWorldCanarySet.canarySetStatus || pack.realWorldCanarySet.status || 'unknown'} scenarios=${pack.realWorldCanarySet.scenarioCount || 0}`);
console.log(`specBoundaryMutation: ${pack.specBoundaryMutation.specBoundaryMutationStatus || pack.specBoundaryMutation.status || 'unknown'}`);
console.log(`testAuditMutation: ${pack.testAuditMutation.testAuditMutationStatus || pack.testAuditMutation.status || 'unknown'} detected=${pack.testAuditMutation.detectedWeakening?.length || 0}`);
console.log(`dependencyAdversarial: ${pack.dependencyAdversarial.dependencyAdversarialStatus || pack.dependencyAdversarial.status || 'unknown'}`);
console.log(`ciParityAdversarial: ${pack.ciParityAdversarial.ciParityAdversarialStatus || pack.ciParityAdversarial.status || 'unknown'}`);
console.log(`evidenceIntegrity: ${pack.evidenceIntegrity.evidenceIntegrityStatus || pack.evidenceIntegrity.status || 'unknown'}`);
console.log(`redTeam: ${pack.redTeam.redTeamStatus || pack.redTeam.status || 'unknown'}`);
console.log(`monotonicity: ${pack.monotonicity.monotonicityStatus || pack.monotonicity.status || 'unknown'}`);
console.log(`minimumEvidence: ${pack.minimumEvidence.minimumEvidenceStatus || pack.minimumEvidence.status || 'unknown'} missing=${pack.minimumEvidence.missingEvidence?.length || 0}`);
console.log(`reviewerChallengeQuestions: ${pack.reviewerChallengeQuestions.status || 'unknown'} count=${pack.reviewerChallengeQuestions.questions?.length || 0}`);
console.log(`policyLint: ${pack.policyLint.policyLintStatus || pack.policyLint.status || 'unknown'}`);
console.log(`auditEffectiveness: ${pack.auditEffectiveness.effectivenessStatus || pack.auditEffectiveness.status || 'unknown'} useful=${pack.auditEffectiveness.usefulFindingCount || 0}`);
console.log(`fixOutcome: ${pack.fixOutcome.fixOutcomeStatus || pack.fixOutcome.status || 'unknown'} unresolved=${pack.fixOutcome.unresolvedFindings?.length || 0}`);
console.log(`postFixVerificationPlan: ${pack.postFixVerificationPlan.status || 'unknown'} commands=${pack.postFixVerificationPlan.requiredCommands?.length || 0}`);
console.log(`repairQuality: ${pack.repairQuality.repairQualityStatus || pack.repairQuality.status || 'unknown'}`);
console.log(`splitEffectiveness: ${pack.splitEffectiveness.splitEffectivenessStatus || pack.splitEffectiveness.status || 'unknown'}`);
console.log(`noiseControl: ${pack.noiseControl.noiseStatus || pack.noiseControl.status || 'unknown'} top=${pack.noiseControl.topRootCauses?.length || 0}`);
console.log(`auditLearningRecommendation: ${pack.auditLearningRecommendation.status || 'unknown'} autoApply=${pack.auditLearningRecommendation.autoApply === true}`);
console.log(`decisionRetrospective: ${pack.decisionRetrospective.status || 'unknown'} followUp=${pack.decisionRetrospective.followUpRequired === true}`);
console.log(`rolloutScore: ${pack.rolloutScore.rolloutStatus || pack.rolloutScore.status || 'unknown'} stop=${pack.rolloutScore.stopRollout === true}`);
console.log(`freshness: ${pack.freshness.freshnessStatus || pack.freshness.status || 'unknown'} stale=${pack.freshness.staleItems?.length || 0}`);
console.log(`riskAcceptanceWorkflow: ${pack.riskAcceptanceWorkflow.status || 'unknown'} autoApply=${pack.riskAcceptanceWorkflow.autoApply === true}`);
console.log(`reviewerAssignmentQuality: ${pack.reviewerAssignmentQuality.status || 'unknown'} roles=${pack.reviewerAssignmentQuality.requiredHumanRoles?.length || 0}`);
console.log(`verificationCompleteness: ${pack.verificationCompleteness.verificationCompletenessStatus || pack.verificationCompleteness.status || 'unknown'} missing=${pack.verificationCompleteness.missingVerification?.length || 0}`);
console.log(`skippedCheckJustification: ${pack.skippedCheckJustification.skippedCheckJustificationStatus || pack.skippedCheckJustification.status || 'unknown'}`);
console.log(`auditModeRecommendation: ${pack.auditModeRecommendation.recommendedAuditMode || 'unknown'}`);
console.log(`auditConflict: ${pack.auditConflict.auditConflictStatus || pack.auditConflict.status || 'unknown'}`);
console.log(`maturityScore: ${pack.maturityScore.maturityScore ?? 'unknown'}`);
console.log(`scopeAgreement: ${pack.prScopeAgreement.status || 'unknown'}`);
console.log(`minimalPrPlan: ${pack.minimalPrPlan.status || 'unknown'} split=${pack.minimalPrPlan.splitRecommended === true}`);
console.log(`ciRiskPrediction: ${pack.ciRiskPrediction.ciRiskStatus || pack.ciRiskPrediction.status || 'unknown'}`);
console.log(`profileInvariantEvaluation: ${pack.profileInvariantEvaluation.status || 'unknown'} findings=${pack.profileInvariantEvaluation.findingCount || 0}`);
console.log(`confidenceImprovement: ${pack.confidenceImprovement.status || 'unknown'} positive=${pack.confidenceImprovement.positiveSignals?.length || 0} negative=${pack.confidenceImprovement.negativeSignals?.length || 0}`);
console.log(`auditValidationCommandPlan: ${pack.auditValidationCommandPlan.status || 'unknown'} commands=${pack.auditValidationCommandPlan.commands?.length || 0}`);
console.log(`ruleTuningRecommendation: ${pack.ruleTuningRecommendation.status || 'unknown'} count=${pack.ruleTuningRecommendation.recommendations?.length || 0}`);
console.log(`goldenPack: ${pack.goldenPack.goldenPackStatus || pack.goldenPack.status || 'unknown'}`);
console.log(`auditResultShape: ${pack.auditResultShape.status || 'unknown'}`);
console.log(`trustLevel: ${pack.trustLevel}`);
console.log(`noiseBudget: ${pack.noiseBudget.status || 'unknown'} shown=${pack.noiseBudget.warningsShown || 0} hidden=${pack.noiseBudget.warningsHidden || 0}`);
console.log(`ruleEffectiveness: ${pack.ruleEffectivenessReport.status || 'unknown'} rules=${pack.ruleEffectivenessReport.count || 0}`);
console.log(`falsePositiveCandidates: ${pack.falsePositiveCandidates.length}`);
console.log(`falseNegativeGuard: ${pack.falseNegativeGuard.status || 'unknown'}`);
console.log(`profileCalibration: ${pack.profileCalibrationPack.status || 'unknown'}`);
console.log(`realRepoReadiness: ${pack.auditReadinessForRealRepo.status || 'unknown'} ready=${pack.auditReadinessForRealRepo.readyForRealRepo === true}`);
console.log(`releaseCandidateStatus: ${pack.releaseCandidateStatus}`);
console.log(`realProjectEvaluation: ${pack.realProjectEvaluation.realProjectEvaluationStatus || pack.realProjectEvaluation.status || 'unknown'}`);
console.log(`feedbackLoop: ${pack.feedbackLoop.status || 'unknown'}`);
console.log(`performanceSummary: ${pack.performanceSummary.status || 'unknown'}`);
console.log(`profileCalibrationReport: ${pack.profileCalibrationReport.status || 'unknown'} profiles=${pack.profileCalibrationReport.profiles?.length || 0}`);
console.log(`canaryPromotionWorkflow: ${pack.canaryPromotionWorkflow.status || 'unknown'}`);
console.log(`ruleRetirementWorkflow: ${pack.ruleRetirementWorkflow.status || 'unknown'}`);
console.log(`smokeBenchmark: ${pack.smokeBenchmark.status || 'unknown'}`);
console.log(`ruleTraceability: ${pack.ruleTraceability.status || 'unknown'} traces=${pack.ruleTraceability.traces?.length || 0}`);
console.log(`reviewerSkillEffectiveness: ${pack.reviewerSkillEffectiveness.status || 'unknown'}`);
console.log(`noRegressionStatus: ${pack.noRegressionStatus.status || 'unknown'}`);
console.log(`rolloutGate: ${pack.rolloutGate.status || 'unknown'}`);
console.log(`trustBoundary: ${pack.trustBoundary.status || 'unknown'}`);
console.log(`humanInLoopEnforcement: ${pack.humanInLoopEnforcement.status || 'unknown'}`);
console.log(`safeArtifactValidation: ${pack.safeArtifactValidation.status || 'unknown'}`);
console.log(`predictionValidation: ${pack.predictionValidation.status || 'unknown'} count=${pack.predictionValidation.predictions?.length || 0}`);
console.log(`auditToTestMapping: ${pack.auditToTestMapping.status || 'unknown'} count=${pack.auditToTestMapping.mappings?.length || 0}`);
console.log(`profilePortability: ${pack.profilePortabilityCheck.status || 'unknown'}`);
console.log(`localVsCiExpectation: ${pack.localVsCiExpectation.status || 'unknown'}`);
console.log(`partialRunHandling: ${pack.partialRunHandling.status || 'unknown'}`);
console.log(`humanReviewPacket: ${pack.humanReviewPacket.status || 'unknown'}`);
console.log(`applyRecommendation: ${pack.applyRecommendation.status || 'unknown'} apply=${pack.applyRecommendation.applyRecommended === true}`);
console.log(`stopConditions: ${pack.stopConditions.status || 'unknown'} triggered=${pack.stopConditions.triggeredStopConditions?.length || 0}`);
console.log(`auditReplayPack: ${pack.auditReplayPack.status || 'unknown'}`);
console.log(`goldenFixtures: ${pack.goldenFixtures.status || 'unknown'}`);
console.log(`stabilityStatus: ${pack.auditResultStabilityStatus.status || 'unknown'}`);
console.log(`prSplitRecommendation: ${pack.prSplitRecommendation.status || 'unknown'} split=${pack.prSplitRecommendation.splitRecommended === true}`);
console.log(`fullRunResidualIntelligence: ${pack.fullRunResidualIntelligence.status || 'unknown'}`);
console.log(`baselineLifecycle: ${pack.baselineLifecycle.status || 'unknown'}`);
console.log(`auditRuleImpact: ${pack.auditRuleImpact.status || 'unknown'}`);
console.log(`canaryFindings: ${pack.canaryFindings.length}`);
console.log(`reviewerCoverage: ${pack.reviewerCoverageStatus.status || 'unknown'}`);
console.log(`mergeBlockExplanation: ${pack.mergeBlockExplanation.status || 'unknown'}`);
console.log(`auditScorecard: ${pack.auditScorecard.status || 'unknown'}`);
console.log(`ruleCalibrationTable: ${pack.ruleCalibrationTable.status} rules=${pack.ruleCalibrationTable.count}`);
console.log(`semanticDiffHints: ${pack.semanticDiffHints.length}`);
console.log(`fixValidationHints: ${pack.fixValidationHints.length}`);
console.log(`auditPerformance: ${pack.auditPerformance.status} files=${pack.auditPerformance.scannedFiles} partial=${pack.auditPerformance.partial}`);
console.log(`negativeSignals: ${pack.negativeSignals.length}`);
console.log(`topFindings: ${pack.topFindings.length}`);
console.log(`selectedReviewers: ${pack.selectedReviewers.length ? pack.selectedReviewers.join(', ') : 'none'}`);
console.log(`testWeakeningStatus: ${pack.testWeakeningStatus}`);
console.log(`domainInvariantStatus: ${pack.domainInvariantStatus}`);
console.log(`dependencyAuditStatus: ${pack.dependencyAuditStatus}`);
console.log(`securitySensitiveChangeStatus: ${pack.securitySensitiveChangeStatus}`);
console.log(`coverageIntentStatus: ${pack.coverageIntentStatus}`);
console.log(`knownRisks: ${pack.knownRisks.status} count=${pack.knownRisks.count}`);
console.log(`codeAuditBaseline: ${pack.codeAuditBaseline.status} applied=${pack.codeAuditBaseline.applied} expired=${pack.codeAuditBaseline.expired}`);
console.log(`suppressionStatus: ${pack.suppressionStatus}`);
console.log(`remediationChecklist: ${pack.remediationChecklist.length}`);
console.log(`manualMergePolicy: ${pack.manualMergePolicy}`);
console.log(`manualConfirmationStatus: ${pack.manualConfirmationStatus.status || 'unknown'} required=${pack.manualConfirmationStatus.required === true}`);
console.log(`recommendedAction: ${pack.recommendedAction}`);
process.exit(exitCode === 0 ? 0 : 1);
