#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.0
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : (process.argv[index + 1] || '');
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
function runReport() {
  const result = spawnSync(process.execPath, ['scripts/codex-local-quality-gate.mjs'], {
    env: { ...process.env, CODEX_QUALITY_REPORT: 'json' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  try { return JSON.parse(result.stdout || '{}'); } catch { return null; }
}
function list(values, fallback = 'none') {
  const clean = (values || []).filter(Boolean);
  return clean.length ? clean.map((item) => `- ${item}`).join('\n') : `- ${fallback}`;
}
function topFindings(report) {
  const groups = report?.rootCauseGroups || [];
  if (groups.length) {
    return groups.slice(0, 3).map((group) => [
      `${group.priority || 'P3'} ${group.rootCauseId || 'unknown'}`,
      `rules=${(group.ruleIds || []).join(',') || 'unknown'}`,
      `severity=${group.severity || 'unknown'}`,
      `confidence=${group.confidence || 'unknown'}`,
      `fix=${group.recommendedFixType || 'cannot_determine'}`,
      `files=${(group.affectedFiles || []).length}`,
    ].join(' '));
  }
  return [...(report?.blockingFindings || []), ...(report?.warningFindings || []), ...(report?.infoFindings || [])]
    .slice(0, 3)
    .map((finding) => `${finding.priority || 'P3'} ${finding.ruleId || finding.id}: ${finding.severity || 'unknown'} / ${finding.confidence || 'unknown'}`);
}

const reportPath = argValue('--report') || process.env.CODEX_QUALITY_REPORT_PATH || '';
const report = reportPath && fs.existsSync(reportPath) ? readJson(reportPath) : (runReport() || {});
const reviewers = report?.selectedReviewers?.reviewers || [];
const decision = report?.decisionMatrix || {};
const focus = [
  ...(decision.reasons || []).map((reason) => `decision: ${reason}`),
  ...(report?.humanReviewReasons || []).map((reason) => `reason: ${reason}`),
  ...(report?.rootCauseGroups || []).slice(0, 5).map((group) => `root cause: ${group.rootCauseId} (${group.recommendedFixType || 'cannot_determine'})`),
];
const checks = [
  'run the project quality gate requested by policy',
  'confirm secret scan result',
  'confirm local quality gate result',
  'confirm profile-required checks when applicable',
  'confirm residual risks are documented',
];
const prompt = [
  'Codex Review Prompt Draft',
  '',
  `profile: ${report.profile || 'unknown'}`,
  `harnessVersion: ${report.harnessVersion || 'unknown'}`,
  `riskLevel: ${report.riskLevel || 'unknown'}`,
  `mergeReady: ${report.mergeReady === true ? 'true' : 'false'}`,
  `decision: ${decision.status || 'unknown'}`,
  `mustFixBeforeMerge: ${decision.mustFixBeforeMerge === true ? 'true' : 'false'}`,
  `auditRegressionSuite: ${report.auditRegressionSuite?.status || 'unknown'}`,
  `auditQuality: ${report.auditQualityStatus || 'unknown'} score=${report.auditQualityScore ?? 'unknown'}`,
  `auditGrade: ${report.auditGrade?.status || 'unknown'} score=${report.auditGrade?.auditGrade ?? 'unknown'}`,
  `oracleValidation: ${report.oracleValidation?.oracleValidationStatus || report.oracleValidation?.status || 'unknown'}`,
  `decisionSimulator: ${report.decisionSimulator?.status || 'unknown'} scenarios=${report.decisionSimulator?.scenarioResults?.length || 0}`,
  `acceptanceCriteria: ${report.acceptanceCriteria?.status || 'unknown'} missing=${report.acceptanceCriteria?.missingCriteria?.length || 0}`,
  `confusionRisk: ${report.confusionRisk?.confusionRiskStatus || report.confusionRisk?.status || 'unknown'}`,
  `temporalConsistency: ${report.temporalConsistency?.temporalConsistencyStatus || report.temporalConsistency?.status || 'unknown'}`,
  `auditEvaluation: ${report.auditEvaluation?.evaluationStatus || report.auditEvaluation?.status || 'unknown'}`,
  `faultInjectionBenchmark: ${report.faultInjectionBenchmark?.faultInjectionStatus || report.faultInjectionBenchmark?.status || 'unknown'}`,
  `semanticImpact: ${report.semanticImpact?.semanticImpact || report.semanticImpact?.status || 'unknown'}`,
  `testSufficiencyScore: ${report.testSufficiency?.testSufficiencyScore ?? 'unknown'}`,
  `specTestMismatch: ${report.specTestMismatch?.specTestMismatchStatus || report.specTestMismatch?.status || 'unknown'}`,
  `specTestCodeConsistency: ${report.specTestCodeConsistency?.specTestCodeConsistencyStatus || report.specTestCodeConsistency?.status || 'unknown'}`,
  `defectTaxonomy: ${report.defectTaxonomy?.status || 'unknown'}`,
  `decisionTrace: ${report.decisionTrace?.finalDecision || report.decisionTrace?.status || 'unknown'}`,
  `ciParity: ${report.ciParity?.ciParityStatus || report.ciParity?.status || 'unknown'}`,
  `scopeAgreement: ${report.prScopeAgreement?.status || 'unknown'}`,
  `minimalPrPlan: ${report.minimalPrPlan?.splitRecommended === true ? 'split recommended' : 'single PR acceptable by safe summary'}`,
  `ciRiskPrediction: ${report.ciRiskPrediction?.ciRiskStatus || report.ciRiskPrediction?.status || 'unknown'}`,
  `realProjectEvaluation: ${report.realProjectEvaluation?.realProjectEvaluationStatus || report.realProjectEvaluation?.status || 'unknown'}`,
  `trustLevel: ${report.trustLevel || 'unknown'}`,
  `mutationBenchmark: ${report.mutationBenchmark?.mutationBenchmarkStatus || report.mutationBenchmark?.status || 'unknown'} detected=${report.mutationBenchmark?.detectedMutationCount || 0}`,
  `adversarialPrSimulator: ${report.adversarialPrSimulator?.status || 'unknown'} bypass=${report.adversarialPrSimulator?.bypassDetected === true}`,
  `auditBypass: ${report.auditBypass?.auditBypassStatus || report.auditBypass?.status || 'unknown'} risks=${report.auditBypass?.bypassRiskCount || 0}`,
  `minimumEvidence: ${report.minimumEvidence?.minimumEvidenceStatus || report.minimumEvidence?.status || 'unknown'} missing=${report.minimumEvidence?.missingEvidence?.length || 0}`,
  `policyLint: ${report.policyLint?.policyLintStatus || report.policyLint?.status || 'unknown'}`,
  `auditEffectiveness: ${report.auditEffectiveness?.effectivenessStatus || report.auditEffectiveness?.status || 'unknown'}`,
  `verificationCompleteness: ${report.verificationCompleteness?.verificationCompletenessStatus || report.verificationCompleteness?.status || 'unknown'}`,
  `reviewerAssignmentQuality: ${report.reviewerAssignmentQuality?.status || 'unknown'}`,
  `repairQuality: ${report.repairQuality?.repairQualityStatus || report.repairQuality?.status || 'unknown'}`,
  `auditConflict: ${report.auditConflict?.auditConflictStatus || report.auditConflict?.status || 'unknown'}`,
  `maturityScore: ${report.maturityScore?.maturityScore ?? 'unknown'}`,
  `humanInLoop: ${report.humanInLoopEnforcement?.status || 'unknown'}`,
  `humanReviewChecklist: ${report.humanReviewChecklist?.status || 'unknown'} role=${report.humanReviewChecklist?.reviewRole || 'none'}`,
  `deploymentBoundary: ${report.deploymentBoundary?.status || 'unknown'}`,
  `releaseCandidateStatus: ${report.releaseCandidateStatus || 'unknown'}`,
  `mergeBlockExplanation: ${report.mergeBlockExplanation?.status || 'unknown'}`,
  `fixImpact: ${report.fixImpact || 'unknown'}`,
  `humanReviewRequired: ${report.humanReviewRequired === true ? 'true' : 'false'}`,
  '',
  'Selected reviewers',
  list(reviewers),
  '',
  'Top findings',
  list(topFindings(report)),
  '',
  'Blocking findings',
  list((report.blockingFindings || []).slice(0, 5).map((item) => `${item.priority || 'P0'} ${item.ruleId || item.id}: ${item.recommendedFixType || 'cannot_determine'}`)),
  '',
  'Warning findings',
  list((report.warningFindings || []).slice(0, 5).map((item) => `${item.priority || 'P2'} ${item.ruleId || item.id}: ${item.recommendedFixType || 'cannot_determine'}`)),
  '',
  'Review focus',
  list(focus, 'review changed paths, checks, and residual risks'),
  '',
  'Must check',
  list([
    `top root causes: ${(report.rootCauseGroups || []).slice(0, 3).map((group) => group.rootCauseId).join(', ') || 'none'}`,
    `human review reasons: ${(report.humanReviewReasons || []).slice(0, 3).join(', ') || 'none'}`,
    `PR split: ${report.prSplitRecommendation?.splitRecommended === true ? 'recommended' : 'not required by safe summary'}`,
    `minimal PR plan: ${report.minimalPrPlan?.firstPRRecommendation || 'smallest safe change first'}`,
    `test gaps: ${(report.testSufficiency?.missingTestIntent || []).slice(0, 3).map((item) => item.intent).join(', ') || 'none'}`,
    `spec-test mismatch: ${report.specTestMismatch?.recommendedHumanReview === true ? 'review recommended' : 'none reported'}`,
    `role-based human review: ${(report.humanReviewRoleMapping?.roles || []).slice(0, 3).join(', ') || 'none'}`,
    `scope agreement: ${report.prScopeAgreement?.status || 'unknown'}`,
    `CI parity: ${report.ciParity?.ciParityStatus || report.ciParity?.status || 'unknown'}`,
    `semantic impact: ${report.semanticImpact?.semanticImpact || 'unknown'}`,
    `stop conditions: ${(report.stopConditions?.triggeredStopConditions || []).slice(0, 3).join(', ') || 'none triggered'}`,
    `minimum evidence: ${(report.minimumEvidence?.missingEvidence || []).slice(0, 3).join(', ') || 'complete or not evaluated'}`,
    `bypass risks: ${(report.auditBypass?.topBypassRisks || []).slice(0, 3).join(', ') || 'none reported'}`,
    `policy lint: ${(report.policyLint?.weakPolicyWarnings || []).slice(0, 2).join(', ') || report.policyLint?.policyLintStatus || 'unknown'}`,
    `verification completeness missing: ${(report.verificationCompleteness?.missingVerification || []).slice(0, 3).join(', ') || 'none'}`,
    `audit conflict: ${(report.auditConflict?.conflicts || []).slice(0, 3).join(', ') || 'none'}`,
    `reviewer assignment: ${(report.reviewerAssignmentQuality?.requiredReviewerSkills || []).slice(0, 3).join(', ') || 'none'}`,
    `manual confirmation: ${report.humanInLoopEnforcement?.manualConfirmationRequired === true ? 'required' : 'not required by safe summary'}`,
    `acceptance criteria missing: ${(report.acceptanceCriteria?.missingCriteria || []).slice(0, 3).join(', ') || 'none'}`,
    `spec authority: ${report.specAuthorityStatus?.specAuthorityStatus || report.specAuthorityStatus?.status || 'unknown'}`,
  ]),
  '',
  'Human review checklist',
  list([
    ...(report.humanReviewChecklist?.mustCheck || []).slice(0, 4),
    ...(report.humanReviewChecklist?.questionsForHuman || []).slice(0, 2),
  ], 'no additional checklist items'),
  '',
  'Bypass risks',
  list(report.auditBypass?.topBypassRisks || [], 'none reported'),
  '',
  'Reviewer challenge questions',
  list(report.reviewerChallengeQuestions?.questions || [], 'none required by safe summary'),
  '',
  'Reviewer assignment',
  list([
    `skills: ${(report.reviewerAssignmentQuality?.requiredReviewerSkills || []).join(', ') || 'none'}`,
    `roles: ${(report.reviewerAssignmentQuality?.requiredHumanRoles || []).join(', ') || 'none'}`,
    ...(report.reviewerAssignmentQuality?.blockingQuestions || []).slice(0, 3),
  ], 'none required by safe summary'),
  '',
  'Blocking questions',
  list(report.reviewerAssignmentQuality?.blockingQuestions || [], 'none required by safe summary'),
  '',
  'Must not change',
  list([
    'unrelated implementation files',
    'secret-bearing files or environment files',
    'verification policy just to silence findings',
    ...((report.minimalPrPlan?.doNotMix || []).slice(0, 3)),
  ]),
  '',
  'Semantic hints',
  list((report.semanticDiffHints || []).slice(0, 5).map((item) => `${item.id}: ${item.reason}`)),
  '',
  'Fix validation hints',
  list((report.fixValidationHints || []).slice(0, 5).map((item) => `${item.recommendedFixType}: ${(item.hints || []).join('; ')}`)),
  '',
  'Remediation plan',
  list((report.remediationPlan?.recommendedFixOrder || []).slice(0, 5).map((item) => `fix root cause: ${item}`), 'no remediation root causes reported'),
  '',
  'PR split recommendation',
  list((report.prSplitRecommendation?.suggestedPRs || []).slice(0, 3).map((item) => `${item.type}: ${(item.rootCauseIds || []).join(', ')}`), report.prSplitRecommendation?.splitRecommended ? 'split by fix type' : 'single PR acceptable by safe summary'),
  '',
  'Merge-block explanation',
  list((report.mergeBlockExplanation?.reasons || []).slice(0, 5).map((item) => `${item.id}${item.count !== undefined ? ` count=${item.count}` : ''}`), 'no merge-block reason reported'),
  '',
  'Stop conditions',
  list(report.stopConditions?.triggeredStopConditions || [], 'none triggered'),
  '',
  'Do not include',
  '- secrets, credentials, endpoints, raw payloads, raw logs, private paths, or tokens',
  '- unrelated refactors or dependency changes',
  '- implementation changes unless the review explicitly asks for them',
  '',
  'Checks to run or confirm',
  list(checks),
  '',
  'Recommended commands',
  list(report.auditValidationCommandPlan?.commands || [
    'node scripts/codex-secret-safety-scan.mjs',
    'node scripts/codex-local-quality-gate.mjs',
    'CODEX_RUN_PROFILE_REQUIRED_CHECKS=1 node scripts/codex-local-quality-gate.mjs',
  ]),
  '',
  'Output format',
  '- findings first',
  '- then required follow-ups',
  '- then merge recommendation',
  '- safe summary only',
  '',
].join('\n');

const target = process.env.CODEX_REVIEW_PROMPT_DRAFT_PATH || '';
if (target && process.env.CODEX_WRITE_REVIEW_PROMPT_DRAFT === '1') {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, prompt, 'utf8');
}
process.stdout.write(prompt);
