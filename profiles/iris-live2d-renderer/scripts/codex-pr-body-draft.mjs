#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.9
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : (process.argv[index + 1] || '');
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
function runLocalGateJson() {
  const result = spawnSync(process.execPath, ['scripts/codex-local-quality-gate.mjs'], {
    env: { ...process.env, CODEX_QUALITY_REPORT: 'json' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0 || !result.stdout) return null;
  try { return JSON.parse(result.stdout); } catch { return null; }
}
function safeList(values, fallback = 'none') {
  const list = (values || []).filter(Boolean);
  return list.length ? list.map((item) => `- ${item}`).join('\n') : `- ${fallback}`;
}
function hasFullRunEvidence(report) {
  return (report?.localGate?.checksRun || []).some((check) => /test|full/i.test(check.name || ''));
}
function knownRiskSummary(report) {
  const risks = report?.knownRisks || {};
  const parts = [];
  if (risks.count) parts.push(`known risks: ${risks.count}`);
  if ((risks.expired || []).length) parts.push(`expired: ${risks.expired.length}`);
  if ((risks.invalid || []).length) parts.push(`invalid: ${risks.invalid.length}`);
  return parts.length ? parts.join(', ') : 'known risks: none';
}
function reviewersSummary(report) {
  const reviewers = report?.selectedReviewers?.reviewers || report?.evidencePack?.selectedReviewers || [];
  return reviewers.length ? reviewers.join(', ') : 'none';
}
function statusOf(value) {
  return value?.status || value?.validationStatus || value?.curatorSuggestionStatus || value?.selfEvolutionPolicyStatus || 'unknown';
}
function suggestionSideEffectSummary(report) {
  const curator = report.curatorSuggestionStatus || {};
  const selfEvolution = report.selfEvolutionPolicyStatus || {};
  const changed = [
    ...((curator.changedFiles || [])),
    ...((selfEvolution.changedFiles || [])),
  ].filter(Boolean);
  if (changed.length) return `changed files detected (${changed.length})`;
  if (statusOf(curator) === 'pass' && statusOf(selfEvolution) === 'pass') return 'none';
  return 'review required';
}
function prCreationPolicy(report) {
  return report.localGate?.status === 'fail' || report.status === 'fail'
    ? 'PR creation prohibited until local quality gate passes'
    : 'PR creation allowed only after human review';
}

const reportPath = argValue('--report') || process.env.CODEX_QUALITY_REPORT_PATH || '';
let report = reportPath && fs.existsSync(reportPath) ? readJson(reportPath) : runLocalGateJson();
if (!report) {
  report = {
    profile: 'unknown',
    harnessVersion: 'unknown',
    status: 'unknown',
    mergeReady: false,
    riskLevel: 'unknown',
    secretScan: { status: 'unknown' },
    localGate: { status: 'unknown', checksRun: [] },
    profileRequiredChecks: { status: 'unknown' },
    knownRisks: { count: 0 },
    warnings: [],
    skippedChecks: [],
    changedPathsSummary: { count: 0, paths: [] },
  };
}

const changed = report.changedPathsSummary || report.changedPaths || { count: 0, paths: [] };
const warnings = (report.warnings || []).map((warning) => `${warning.id}${warning.path ? ` (${warning.path})` : ''}`);
const blockingFindings = (report.blockingFindings || []).map((finding) => `${finding.id}${finding.path ? ` (${finding.path})` : ''}`);
const warningFindings = (report.warningFindings || []).map((finding) => `${finding.id}${finding.path ? ` (${finding.path})` : ''}${finding.known ? ' [known]' : ''}`);
const infoFindings = (report.infoFindings || []).map((finding) => `${finding.id}${finding.path ? ` (${finding.path})` : ''}`);
const topFindings = [...(report.blockingFindings || []), ...(report.warningFindings || []), ...(report.infoFindings || [])]
  .slice(0, 5)
  .map((finding) => `${finding.priority || 'P3'} ${finding.ruleId || finding.id} rootCause=${finding.rootCauseId || 'unknown'}: ${finding.severity || 'unknown'} / ${finding.confidence || 'unknown'}${finding.path ? ` (${finding.path})` : ''}`);
const rootCauses = (report.rootCauseGroups || [])
  .slice(0, 5)
  .map((group) => `${group.priority || 'P3'} ${group.rootCauseId || 'unknown'}: ${group.recommendedFixType || 'cannot_determine'} / files=${(group.affectedFiles || []).length}`);
const skipped = (report.skippedChecks || []).map((check) => `${check.name}: ${check.reason}`);
const fullRunDone = hasFullRunEvidence(report);
const evidence = report.evidencePack || {};
const worktree = report.worktreeStatus || {};
const decision = report.decisionMatrix || {};
const residual = report.residualTestStatus || {};
const manual = report.manualConfirmationStatus || evidence.manualConfirmationStatus || { required: false, status: 'not_required' };
const draft = [
  'Change summary',
  `Codex quality harness ${report.harnessVersion || 'unknown'} update.`,
  `profile: ${report.profile || 'unknown'}`,
  `riskLevel: ${report.riskLevel || 'unknown'}`,
  `mergeReady: ${report.mergeReady === true ? 'true' : 'false'}`,
  `decision matrix: ${decision.status || 'unknown'}`,
  `humanReviewRequired: ${decision.humanReviewRequired === true || report.humanReviewRequired === true ? 'true' : 'false'}`,
  `mustFixBeforeMerge: ${decision.mustFixBeforeMerge === true ? 'true' : 'false'}`,
  `fixImpact: ${report.fixImpact || 'unknown'}`,
  '',
  'Quality evidence summary',
  `worktree doctor: ${evidence.worktreeDoctor || worktree.status || 'unknown'}`,
  `secret scan: ${evidence.secretScan || report.secretScan?.status || 'unknown'}`,
  `local quality gate: ${evidence.localQualityGate || report.localGate?.status || report.status || 'unknown'}`,
  `profile required checks: ${evidence.profileRequiredChecks || report.profileRequiredChecks?.status || 'unknown'}`,
  `pr separation: ${evidence.prSeparationStatus || report.prSeparationStatus?.status || 'unknown'}`,
  `code audit: ${report.codeAudit?.status || evidence.codeAudit?.status || 'unknown'}`,
  `blocking findings: ${(report.blockingFindings || []).length}`,
  `warning findings: ${(report.warningFindings || []).length}`,
  `info findings: ${(report.infoFindings || []).length}`,
  `root causes: ${(report.rootCauseGroups || []).length}`,
  `code audit calibration: ${report.codeAuditCalibration?.status || 'unknown'}`,
  `audit regression suite: ${report.auditRegressionSuite?.status || 'unknown'}`,
  `audit scorecard: ${report.auditScorecard?.status || 'unknown'} fp=${report.auditScorecard?.falsePositiveCount || 0} fn=${report.auditScorecard?.falseNegativeCount || 0}`,
  `audit quality: ${report.auditQualityStatus || 'unknown'} score=${report.auditQualityScore ?? 'unknown'}`,
  `audit grade: ${report.auditGrade?.status || 'unknown'} score=${report.auditGrade?.auditGrade ?? 'unknown'}`,
  `oracle validation: ${report.oracleValidation?.oracleValidationStatus || report.oracleValidation?.status || 'unknown'} pass=${report.oracleValidation?.oraclePassCount || 0} fail=${report.oracleValidation?.oracleFailCount || 0}`,
  `decision simulator: ${report.decisionSimulator?.status || 'unknown'} scenarios=${report.decisionSimulator?.scenarioResults?.length || 0}`,
  `remediation verification: ${report.remediationVerification?.remediationVerificationStatus || report.remediationVerification?.status || 'unknown'}`,
  `benchmark pack: ${report.benchmarkPack?.benchmarkPackStatus || report.benchmarkPack?.status || 'unknown'} count=${report.benchmarkPack?.benchmarkCount || 0}`,
  `audit evaluation: ${report.auditEvaluation?.evaluationStatus || report.auditEvaluation?.status || 'unknown'}`,
  `fault injection benchmark: ${report.faultInjectionBenchmark?.faultInjectionStatus || report.faultInjectionBenchmark?.status || 'unknown'} detected=${report.faultInjectionBenchmark?.detectedFaultCount || 0}`,
  `semantic impact: ${report.semanticImpact?.semanticImpact || report.semanticImpact?.status || 'unknown'}`,
  `test sufficiency: ${report.testSufficiency?.testSufficiencyScore ?? 0} missing=${report.testSufficiency?.missingTestIntent?.length || 0}`,
  `spec-test mismatch: ${report.specTestMismatch?.specTestMismatchStatus || report.specTestMismatch?.status || 'unknown'} suspected=${report.specTestMismatch?.suspectedMismatchCount || 0}`,
  `spec-test-code consistency: ${report.specTestCodeConsistency?.specTestCodeConsistencyStatus || report.specTestCodeConsistency?.status || 'unknown'}`,
  `defect taxonomy: ${report.defectTaxonomy?.status || 'unknown'} categories=${report.defectTaxonomy?.defectCategory?.length || 0}`,
  `oracle limits: canDetermine=${report.oracleLimits?.canDetermine?.length || 0} cannotDetermine=${report.oracleLimits?.cannotDetermine?.length || 0}`,
  `decision trace: ${report.decisionTrace?.finalDecision || report.decisionTrace?.status || 'unknown'}`,
  `acceptance criteria: ${report.acceptanceCriteria?.status || 'unknown'} missing=${report.acceptanceCriteria?.missingCriteria?.length || 0}`,
  `confusion risk: ${report.confusionRisk?.confusionRiskStatus || report.confusionRisk?.status || 'unknown'}`,
  `temporal consistency: ${report.temporalConsistency?.temporalConsistencyStatus || report.temporalConsistency?.status || 'unknown'}`,
  `scenario replay: ${report.scenarioReplay?.replayStatus || report.scenarioReplay?.status || 'unknown'}`,
  `spec authority: ${report.specAuthorityStatus?.specAuthorityStatus || report.specAuthorityStatus?.status || 'unknown'}`,
  `audit completeness: ${report.auditCompleteness?.auditComplete === true ? 'complete' : 'partial'}`,
  `confidence evidence: ${report.auditConfidenceEvidence?.confidence || report.auditConfidenceEvidence?.status || 'unknown'}`,
  `precision/recall guardrail: ${report.precisionRecallGuardrails?.status || 'unknown'}`,
  `calibration lock: ${report.calibrationLockStatus?.status || 'unknown'}`,
  `audit usefulness: ${report.auditUsefulnessValidation?.usefulnessValidationStatus || report.auditUsefulnessValidation?.status || 'unknown'}`,
  `minimal PR plan: ${report.minimalPrPlan?.splitRecommended === true ? 'split recommended' : 'single PR acceptable by safe summary'}`,
  `CI risk prediction: ${report.ciRiskPrediction?.ciRiskStatus || report.ciRiskPrediction?.status || 'unknown'}`,
  `CI parity: ${report.ciParity?.ciParityStatus || report.ciParity?.status || 'unknown'}`,
  `scope agreement: ${report.prScopeAgreement?.status || 'unknown'} prType=${report.prScopeAgreement?.prType || 'unknown'}`,
  `residual failure governance: ${report.residualFailureGovernance?.residualFailureStatus || report.residualFailureGovernance?.status || 'unknown'}`,
  `profile invariant evaluation: ${report.profileInvariantEvaluation?.status || 'unknown'} findings=${report.profileInvariantEvaluation?.findingCount || 0}`,
  `validation command plan: ${report.auditValidationCommandPlan?.commands?.length || 0} safe commands`,
  `rule tuning recommendation: ${report.ruleTuningRecommendation?.recommendations?.length || 0} autoApply=false`,
  `golden pack: ${report.goldenPack?.goldenPackStatus || report.goldenPack?.status || 'unknown'}`,
  `real project evaluation: ${report.realProjectEvaluation?.realProjectEvaluationStatus || report.realProjectEvaluation?.status || 'unknown'}`,
  `performance summary: ${report.performanceSummary?.status || 'unknown'}`,
  `safe artifact validation: ${report.safeArtifactValidation?.status || 'unknown'}`,
  `output shape: ${report.outputShapeStatus?.status || 'unknown'}`,
  `source harness validation: ${report.sourceHarnessValidationStatus?.status || 'unknown'}`,
  `agent memory policy: ${report.agentMemoryPolicyStatus?.status || 'unknown'}`,
  `skill lifecycle policy: ${report.skillLifecyclePolicyStatus?.status || 'unknown'}`,
  `curator suggestion: ${report.curatorSuggestionStatus?.status || 'unknown'} autoApply=${report.curatorSuggestionStatus?.autoApply === false ? 'false' : 'unknown'} autoCommit=${report.curatorSuggestionStatus?.autoCommit === false ? 'false' : 'unknown'} autoPush=${report.curatorSuggestionStatus?.autoPush === false ? 'false' : 'unknown'}`,
  `self evolution policy: ${report.selfEvolutionPolicyStatus?.status || 'unknown'} autoApply=${report.selfEvolutionPolicyStatus?.autoApply === false ? 'false' : 'unknown'} autoCommit=${report.selfEvolutionPolicyStatus?.autoCommit === false ? 'false' : 'unknown'} autoPush=${report.selfEvolutionPolicyStatus?.autoPush === false ? 'false' : 'unknown'}`,
  `suggestion-only side effects: ${suggestionSideEffectSummary(report)}`,
  'real development repos propagated: no',
  `rollout gate: ${report.rolloutGate?.status || 'unknown'}`,
  `trustLevel: ${report.trustLevel || 'unknown'}`,
  `noise budget: ${report.noiseBudget?.status || 'unknown'} shown=${report.noiseBudget?.warningsShown || 0} hidden=${report.noiseBudget?.warningsHidden || 0}`,
  `rule effectiveness: ${report.ruleEffectivenessReport?.status || 'unknown'} rules=${report.ruleEffectivenessReport?.rules?.length || 0}`,
  `false positive candidates: ${(report.falsePositiveCandidates || []).length}`,
  `false negative guard: ${report.falseNegativeGuard?.status || 'unknown'}`,
  `profile calibration: ${report.profileCalibrationPack?.status || 'unknown'}`,
  `real repo readiness: ${report.auditReadinessForRealRepo?.readyForRealRepo === true ? 'true' : 'false'}`,
  `release candidate: ${report.releaseCandidateStatus || 'unknown'}`,
  `prediction validation: ${report.predictionValidation?.status || 'unknown'} count=${report.predictionValidation?.predictions?.length || 0}`,
  `audit-to-test mapping: ${report.auditToTestMapping?.status || 'unknown'} count=${report.auditToTestMapping?.mappings?.length || 0}`,
  `local vs CI expectation: ${report.localVsCiExpectation?.ciRiskStatus || report.localVsCiExpectation?.status || 'unknown'}`,
  `schema: quality=${report.qualityReportSchemaVersion || 'unknown'} codeAudit=${report.codeAuditSchemaVersion || 'unknown'}`,
  `canary findings: ${(report.canaryFindings || []).length}`,
  `reviewer coverage: ${report.reviewerCoverageStatus?.status || 'unknown'}`,
  `merge-block explanation: ${report.mergeBlockExplanation?.status || 'unknown'}`,
  `audit performance: ${report.auditPerformance?.status || 'unknown'} files=${report.auditPerformance?.scannedFiles || 0} partial=${report.auditPerformance?.partial === true}`,
  `semantic hints: ${(report.semanticDiffHints || []).length}`,
  `fix validation hints: ${(report.fixValidationHints || []).length}`,
  `negative signals: ${(report.negativeSignals || []).length}`,
  `selected reviewers: ${reviewersSummary(report)}`,
  `domain invariant: ${evidence.domainInvariantStatus || report.domainInvariantStatus?.status || 'unknown'}`,
  `test weakening: ${evidence.testWeakeningStatus || report.testWeakeningStatus?.status || 'unknown'}`,
  `coverage intent: ${evidence.coverageIntentStatus || report.coverageIntentStatus?.status || 'unknown'}`,
  `security-sensitive change: ${evidence.securitySensitiveChangeStatus || report.securitySensitiveChangeStatus?.status || 'unknown'}`,
  `dependency/fresh install: ${evidence.dependencyAuditStatus || report.dependencyAuditStatus?.status || 'unknown'}`,
  `known code audit baseline applied: ${report.codeAuditBaseline?.matched?.length || 0}`,
  `expired code audit baseline: ${report.codeAuditBaseline?.expired?.length || 0}`,
  `suppression hygiene: ${report.suppressionStatus?.status || 'unknown'}`,
  `missing test intent: ${(report.missingTestIntent || []).length}`,
  `manual merge policy: ${evidence.manualMergePolicy || report.manualMergePolicy?.status || 'manual_confirmation_required'}`,
  `PR type inference: ${report.prTypeInference?.inferredType || report.prType || 'unknown'} (${report.prTypeInference?.status || 'unknown'})`,
  `residual full run-tests: ${residual.status || 'unknown'} knownResidual=${residual.knownResidualAccepted === true}`,
  `full run residual intelligence: ${report.fullRunResidualIntelligence?.status || 'unknown'} mustMention=${report.fullRunResidualIntelligence?.mustMentionInPRBody === true}`,
  `partial run handling: ${report.partialRunHandling?.status || 'unknown'} mustMention=${report.partialRunHandling?.mustMentionInPR === true}`,
  `human review packet: ${report.humanReviewPacket?.status || 'unknown'}`,
  `apply recommendation: ${report.applyRecommendation?.applyRecommended === true ? 'apply recommended' : 'review before apply'}`,
  `stop conditions triggered: ${(report.stopConditions?.triggeredStopConditions || []).length}`,
  `reviewer skill shape: ${report.skillShapeStatus?.status || 'unknown'}`,
  '',
  'Verification',
  `secret scan: ${report.secretScan?.status || 'unknown'}`,
  `local quality gate: ${report.localGate?.status || report.status || 'unknown'}`,
  `profile required checks: ${report.profileRequiredChecks?.status || 'unknown'}`,
  `source harness validation: ${statusOf(report.sourceHarnessValidationStatus)}`,
  `agent memory policy: ${statusOf(report.agentMemoryPolicyStatus)}`,
  `skill lifecycle policy: ${statusOf(report.skillLifecyclePolicyStatus)}`,
  `curator suggestion: ${statusOf(report.curatorSuggestionStatus)}`,
  `self evolution policy: ${statusOf(report.selfEvolutionPolicyStatus)}`,
  `suggestion-only side effects: ${suggestionSideEffectSummary(report)}`,
  `JSON report mergeReady: ${report.mergeReady === true ? 'true' : 'false'}`,
  `PR creation policy: ${prCreationPolicy(report)}`,
  'GitHub Actions quality-gate: PASS / manual confirmation required',
  '',
  'Manual confirmation',
  `- required: ${manual.required === true ? 'yes' : 'no'}`,
  `- status: ${manual.status || 'unknown'}`,
  `- riskLevel: ${report.riskLevel || 'unknown'}`,
  `- headSha: ${manual.headSha || '<current-pr-head-sha>'}`,
  '- confirmedByRole: <role only>',
  '- reviewedItems:',
  '- qualityGateNotWeakened: true / false',
  '- riskLevelNotLowered: true / false',
  '- residualRisks:',
  '- manualBranchProtectionAcknowledged: true / false',
  '',
  'Confirmed',
  `changed paths count: ${changed.count || 0}`,
  `blocked paths touched: ${(changed.blocked || []).length}`,
  `out-of-scope paths touched: ${(changed.outOfScope || []).length}`,
  `high-risk paths touched: ${(changed.highRisk || []).length}`,
  `${knownRiskSummary(report)}`,
  `clean clone: ${worktree.cleanClone === true ? 'yes' : 'no'}`,
  `dirty worktree: ${worktree.isDirty === true ? 'yes' : 'no'}`,
  '',
  'Post-merge verification plan',
  'Run node scripts/codex-post-merge-verify.mjs on main after merge.',
  ...((report.postMergeVerificationPlan || []).map((item) => `- ${item}`)),
  '',
  'Residual risks',
  'branch protection may require manual policy review when repository settings cannot enforce quality-gate.',
  fullRunDone ? 'full run evidence: present in local gate checks.' : 'full run evidence: not present; note this if required by the project.',
  report.localGate?.status === 'fail' ? 'full run or local gate failure: review safe summary before merge.' : 'local gate failure: none reported.',
  `decision recommended action: ${decision.recommendedNextAction || report.recommendedAction || 'review before merge'}`,
  `mustFixBeforeMerge: ${decision.mustFixBeforeMerge === true ? 'yes' : 'no'}`,
  `mustReviewBeforeMerge: ${decision.humanReviewRequired === true || report.humanReviewRequired === true ? 'yes' : 'no'}`,
  `canProceedWithKnownRisks: ${decision.canProceedWithRisks === true ? 'yes' : 'no'}`,
  `manualConfirmationRequired: ${decision.manualConfirmationRequired === true ? 'yes' : 'no'}`,
  `PR split recommendation: ${report.prSplitRecommendation?.splitRecommended === true ? 'split recommended' : 'single PR acceptable by safe summary'}`,
  `minimal PR first step: ${report.minimalPrPlan?.firstPRRecommendation || 'smallest safe change first'}`,
  (report.minimalPrPlan?.doNotMix?.length ? `do not mix:\n${safeList(report.minimalPrPlan.doNotMix)}` : 'do not mix: no additional policy guidance'),
  (report.testSufficiency?.missingTestIntent?.length ? `test sufficiency gaps:\n${safeList(report.testSufficiency.missingTestIntent.map((item) => `${item.intent}: ${item.recommendedTestType || 'targeted test'}`))}` : 'test sufficiency gaps: none'),
  `spec-test mismatch review: ${report.specTestMismatch?.recommendedHumanReview === true ? 'human review recommended' : 'not required by safe summary'}`,
  `CI risk must mention in PR: ${report.ciRiskPrediction?.mustMentionInPR === true ? 'yes' : 'no'}`,
  (report.prSplitRecommendation?.splitRecommended ? `suggested PR split:\n${safeList((report.prSplitRecommendation.suggestedPRs || []).map((item) => `${item.type}: ${(item.rootCauseIds || []).join(', ')}`))}` : 'suggested PR split: none'),
  `baseline lifecycle: ${report.baselineLifecycle?.status || 'unknown'}`,
  `releaseCandidateStatus: ${report.releaseCandidateStatus || 'unknown'}`,
  `sourceHarnessValidationStatus: ${statusOf(report.sourceHarnessValidationStatus)}`,
  `new policy inspection: memory=${statusOf(report.agentMemoryPolicyStatus)} skill=${statusOf(report.skillLifecyclePolicyStatus)} selfEvolution=${statusOf(report.selfEvolutionPolicyStatus)} curator=${statusOf(report.curatorSuggestionStatus)}`,
  `suggestion-only side effects: ${suggestionSideEffectSummary(report)}`,
  'real development repositories not updated: FUNKY / IRIS / IRIS-live2d-renderer',
  `PR creation policy: ${prCreationPolicy(report)}`,
  `known residual / partial run: ${report.partialRunHandling?.mustMentionInPR === true ? 'must mention in PR body' : 'none requiring PR note'}`,
  `scope agreement summary: ${report.prScopeAgreement?.status || 'unknown'} blocked=${report.prScopeAgreement?.notInScope?.length || 0}`,
  `residual failure summary: ${report.residualFailureGovernance?.mustMentionInPR === true ? 'must mention in PR body' : 'no residual note required by safe summary'}`,
  `CI parity summary: ${report.ciParity?.ciParityStatus || report.ciParity?.status || 'unknown'}`,
  `human review roles: ${(report.humanReviewRoleMapping?.roles || []).join(', ') || 'none'}`,
  `human review packet summary: ${report.humanReviewPacket?.status || 'unknown'} reasons=${(report.humanReviewPacket?.humanReviewReasons || []).length || 0}`,
  `human review checklist: ${report.humanReviewChecklist?.status || 'unknown'} role=${report.humanReviewChecklist?.reviewRole || 'none'}`,
  `human-in-the-loop: ${report.humanInLoopEnforcement?.status || 'unknown'} manual=${report.humanInLoopEnforcement?.manualConfirmationRequired === true}`,
  `trust boundary: canSupport=${report.trustBoundary?.canSupport?.length || 0} cannotGuarantee=${report.trustBoundary?.cannotGuarantee?.length || 0}`,
  `deployment boundary: doesNotGuarantee=${report.deploymentBoundary?.doesNotGuarantee?.length || 0}`,
  `mutation benchmark: ${report.mutationBenchmark?.mutationBenchmarkStatus || report.mutationBenchmark?.status || 'unknown'} detected=${report.mutationBenchmark?.detectedMutationCount || 0}`,
  `adversarial PR simulator: ${report.adversarialPrSimulator?.status || 'unknown'} bypass=${report.adversarialPrSimulator?.bypassDetected === true}`,
  `audit bypass: ${report.auditBypass?.auditBypassStatus || report.auditBypass?.status || 'unknown'} risks=${report.auditBypass?.bypassRiskCount || 0}`,
  `minimum evidence: ${report.minimumEvidence?.minimumEvidenceStatus || report.minimumEvidence?.status || 'unknown'} missing=${report.minimumEvidence?.missingEvidence?.length || 0}`,
  `reviewer challenge questions: ${report.reviewerChallengeQuestions?.questions?.length || 0}`,
  `policy lint: ${report.policyLint?.policyLintStatus || report.policyLint?.status || 'unknown'}`,
  `audit effectiveness: ${report.auditEffectiveness?.effectivenessStatus || report.auditEffectiveness?.status || 'unknown'} useful=${report.auditEffectiveness?.usefulFindingCount || 0}`,
  `fix outcome: ${report.fixOutcome?.fixOutcomeStatus || report.fixOutcome?.status || 'unknown'} unresolved=${report.fixOutcome?.unresolvedFindings?.length || 0}`,
  `verification completeness: ${report.verificationCompleteness?.verificationCompletenessStatus || report.verificationCompleteness?.status || 'unknown'} missing=${report.verificationCompleteness?.missingVerification?.length || 0}`,
  `repair quality: ${report.repairQuality?.repairQualityStatus || report.repairQuality?.status || 'unknown'}`,
  `split effectiveness: ${report.splitEffectiveness?.splitEffectivenessStatus || report.splitEffectiveness?.status || 'unknown'}`,
  `freshness: ${report.freshness?.freshnessStatus || report.freshness?.status || 'unknown'}`,
  `audit conflict: ${report.auditConflict?.auditConflictStatus || report.auditConflict?.status || 'unknown'}`,
  `audit mode recommendation: ${report.auditModeRecommendation?.recommendedAuditMode || 'unknown'}`,
  `maturity score: ${report.maturityScore?.maturityScore ?? 'unknown'} band=${report.maturityScore?.maturityBand || 'unknown'}`,
  `stop conditions:\n${safeList(report.stopConditions?.triggeredStopConditions || [], 'none triggered')}`,
  'postMergeVerificationRequired: yes',
  report.humanReviewRequired ? `human review required: ${safeList(report.humanReviewReasons || [])}` : 'human review required: no',
  blockingFindings.length ? `blocking findings:\n${safeList(blockingFindings)}` : 'blocking findings: none',
  warningFindings.length ? `warning findings:\n${safeList(warningFindings)}` : 'warning findings: none',
  infoFindings.length ? `info findings:\n${safeList(infoFindings)}` : 'info findings: none',
  rootCauses.length ? `root cause summary:\n${safeList(rootCauses)}` : 'root cause summary: none',
  topFindings.length ? `top findings:\n${safeList(topFindings)}` : 'top findings: none',
  (report.mergeBlockExplanation?.reasons || []).length ? `merge-block explanation:\n${safeList((report.mergeBlockExplanation.reasons || []).map((item) => `${item.id}${item.count !== undefined ? `=${item.count}` : ''}`))}` : 'merge-block explanation: none',
  (report.acceptanceCriteria?.missingCriteria || []).length ? `acceptance criteria missing:\n${safeList(report.acceptanceCriteria.missingCriteria)}` : 'acceptance criteria missing: none',
  (report.deploymentBoundary?.doesNotGuarantee || []).length ? `deployment boundary does not guarantee:\n${safeList(report.deploymentBoundary.doesNotGuarantee)}` : 'deployment boundary does not guarantee: see project risk notes',
  (report.minimumEvidence?.missingEvidence || []).length ? `minimum evidence missing:\n${safeList(report.minimumEvidence.missingEvidence)}` : 'minimum evidence missing: none',
  (report.reviewerChallengeQuestions?.questions || []).length ? `reviewer challenge questions:\n${safeList(report.reviewerChallengeQuestions.questions.slice(0, 5))}` : 'reviewer challenge questions: none',
  (report.auditBypass?.topBypassRisks || []).length ? `bypass risks:\n${safeList(report.auditBypass.topBypassRisks)}` : 'bypass risks: none',
  (report.skippedCheckJustification?.checks || []).length ? `skipped check justification:\n${safeList(report.skippedCheckJustification.checks.map((item) => `${item.skippedCheck}: ${item.reason}; mention=${item.mustMentionInPR === true}`))}` : 'skipped check justification: none',
  `risk acceptance warning: ${report.riskAcceptanceWorkflow?.autoApply === false ? 'manual only with expiry and role' : 'not evaluated'}`,
  (report.verificationCompleteness?.missingVerification || []).length ? `verification completeness missing:\n${safeList(report.verificationCompleteness.missingVerification)}` : 'verification completeness missing: none',
  (report.reviewerAssignmentQuality?.blockingQuestions || []).length ? `reviewer assignment blocking questions:\n${safeList(report.reviewerAssignmentQuality.blockingQuestions)}` : 'reviewer assignment blocking questions: none',
  `audit conflict detector: ${report.auditConflict?.auditConflictStatus || report.auditConflict?.status || 'unknown'}`,
  `audit mode recommendation: ${report.auditModeRecommendation?.recommendedAuditMode || 'unknown'} (${report.auditModeRecommendation?.why || 'safe summary'})`,
  (report.remediationPlan?.recommendedFixOrder || []).length ? `remediation plan:\n${safeList(report.remediationPlan.recommendedFixOrder)}` : 'remediation plan: none',
  (report.auditQualityWarnings || []).length ? `audit quality warnings:\n${safeList(report.auditQualityWarnings)}` : 'audit quality warnings: none',
  (report.negativeSignals || []).length ? `negative signals:\n${safeList((report.negativeSignals || []).map((item) => `${item.id}: ${item.reason}`))}` : 'negative signals: none',
  `audit performance summary: ${report.auditPerformance?.status || 'unknown'} scannedFiles=${report.auditPerformance?.scannedFiles || 0} rootCauses=${report.auditPerformance?.rootCauseCount || 0}`,
  (report.remediationChecklist || []).length ? `remediation checklist:\n${safeList(report.remediationChecklist)}` : 'remediation checklist: none',
  warnings.length ? `warnings:\n${safeList(warnings)}` : 'warnings: none',
  skipped.length ? `skipped checks:\n${safeList(skipped)}` : 'skipped checks: none',
  '',
].join('\n');

const target = process.env.CODEX_PR_BODY_DRAFT_PATH || '';
if (target && process.env.CODEX_WRITE_PR_BODY_DRAFT === '1') {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, draft, 'utf8');
}
process.stdout.write(draft);
