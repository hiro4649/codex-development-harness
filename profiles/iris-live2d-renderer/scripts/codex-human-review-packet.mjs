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
  if (!file || !fs.existsSync(file)) return null;
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
function list(lines, fallback = 'none') {
  const clean = (lines || []).filter(Boolean);
  return clean.length ? clean.map((line) => `- ${line}`).join('\n') : `- ${fallback}`;
}

const report = readJson(argValue('--report') || process.env.CODEX_QUALITY_REPORT_PATH || '') || runReport() || {};
const packet = report.humanReviewPacket || {};
const top = packet.topFindings || [...(report.blockingFindings || []), ...(report.warningFindings || [])].slice(0, 5);
const changed = report.changedPathsSummary || {};
const output = [
  '== Codex human review packet ==',
  `profile: ${report.profile || 'unknown'}`,
  `prType: ${packet.prType || report.prType || 'unknown'}`,
  `riskLevel: ${packet.riskLevel || report.riskLevel || 'unknown'}`,
  `humanReviewRequired: ${report.humanReviewRequired === true}`,
  `changedPathCount: ${changed.count || 0}`,
  '',
  'Top findings',
  list(top.map((finding) => `${finding.priority || 'P3'} ${finding.ruleId || finding.id || 'finding'} ${finding.rootCauseId || ''}`)),
  '',
  'Top root causes',
  list((packet.topRootCauses || report.rootCauseGroups || []).slice(0, 5).map((group) => `${group.priority || 'P3'} ${group.rootCauseId || 'unknown'} ${group.recommendedFixType || 'cannot_determine'}`)),
  '',
  'Test sufficiency gaps',
  list((packet.testSufficiencyGaps || report.testSufficiency?.missingTestIntent || []).slice(0, 5).map((item) => `${item.intent || item.recommendedTestType || 'test intent'}: ${item.whyNeeded || 'targeted evidence needed'}`)),
  '',
  'Spec-test mismatch',
  `status: ${packet.specTestMismatch?.specTestMismatchStatus || report.specTestMismatch?.specTestMismatchStatus || report.specTestMismatch?.status || 'unknown'}`,
  `suspected: ${packet.specTestMismatch?.suspectedMismatchCount || report.specTestMismatch?.suspectedMismatchCount || 0}`,
  '',
  'Semantic impact',
  `primary: ${packet.semanticImpact?.semanticImpact || report.semanticImpact?.semanticImpact || 'unknown'}`,
  '',
  'Minimal PR plan',
  `splitRecommended: ${packet.minimalPrPlan?.splitRecommended === true || report.minimalPrPlan?.splitRecommended === true}`,
  `firstPRRecommendation: ${packet.minimalPrPlan?.firstPRRecommendation || report.minimalPrPlan?.firstPRRecommendation || 'smallest safe change first'}`,
  '',
  'Human review reasons',
  list(packet.humanReviewReasons || report.humanReviewReasons),
  '',
  'Human review roles',
  list(report.humanReviewRoleMapping?.roles || [], 'no role mapping required by safe summary'),
  '',
  'Scope agreement',
  `status: ${report.prScopeAgreement?.status || 'unknown'}`,
  `notInScopeCount: ${report.prScopeAgreement?.notInScope?.length || 0}`,
  '',
  'CI parity',
  `status: ${report.ciParity?.ciParityStatus || report.ciParity?.status || 'unknown'}`,
  '',
  'Minimum evidence',
  `status: ${report.minimumEvidence?.minimumEvidenceStatus || report.minimumEvidence?.status || 'unknown'}`,
  list(report.minimumEvidence?.missingEvidence || [], 'no missing evidence reported'),
  '',
  'Bypass risks',
  `status: ${report.auditBypass?.auditBypassStatus || report.auditBypass?.status || 'unknown'}`,
  list(report.auditBypass?.topBypassRisks || [], 'none reported'),
  '',
  'Reviewer challenge questions',
  list(report.reviewerChallengeQuestions?.questions || [], 'none required by safe summary'),
  '',
  'Policy lint',
  `status: ${report.policyLint?.policyLintStatus || report.policyLint?.status || 'unknown'}`,
  list([...(report.policyLint?.weakPolicyWarnings || []), ...(report.policyLint?.overStrictPolicyWarnings || [])].slice(0, 5), 'no policy lint warnings reported'),
  '',
  'Verification completeness',
  `status: ${report.verificationCompleteness?.verificationCompletenessStatus || report.verificationCompleteness?.status || 'unknown'}`,
  list(report.verificationCompleteness?.missingVerification || [], 'no missing verification reported'),
  '',
  'Reviewer assignment quality',
  `status: ${report.reviewerAssignmentQuality?.status || 'unknown'}`,
  list([...(report.reviewerAssignmentQuality?.requiredReviewerSkills || []), ...(report.reviewerAssignmentQuality?.requiredHumanRoles || [])], 'no reviewer assignment required'),
  '',
  'Blocking questions',
  list(report.reviewerAssignmentQuality?.blockingQuestions || [], 'none required by safe summary'),
  '',
  'Checks run',
  list((packet.checksRun || report.localGate?.checksRun || []).map((check) => `${check.name}: ${check.status || 'unknown'}`)),
  '',
  'Checks skipped',
  list((packet.checksSkipped || report.skippedChecks || []).map((check) => `${check.name}: ${check.reason || 'not specified'}`)),
  '',
  'Known residuals',
  `mustMentionInPR: ${report.partialRunHandling?.mustMentionInPR === true || packet.knownResiduals === true}`,
  '',
  'What not to merge',
  list(packet.whatNotToMerge || report.stopConditions?.triggeredStopConditions),
  '',
  'What not to change',
  list(packet.whatNotToChange || report.minimalPrPlan?.doNotMix),
  '',
  'Recommended reviewer skill',
  `skill: ${packet.recommendedReviewerSkill || report.selectedReviewers?.reviewers?.[0] || 'none'}`,
  '',
  'Recommended validation',
  list(packet.recommendedValidation || report.auditValidationCommandPlan?.commands),
  '',
  'Questions for human',
  list(packet.questionsForHuman, 'confirm evidence and residual risks are acceptable'),
  '',
].join('\n');

const target = process.env.CODEX_HUMAN_REVIEW_PACKET_PATH || '';
if (target && process.env.CODEX_WRITE_HUMAN_REVIEW_PACKET === '1') {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output, 'utf8');
}
process.stdout.write(output);
