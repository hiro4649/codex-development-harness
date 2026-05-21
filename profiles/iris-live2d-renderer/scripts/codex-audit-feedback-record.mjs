#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.9
import process from 'node:process';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : (process.argv[index + 1] || '');
}
function boolValue(name) {
  const value = (argValue(name) || '').toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}
function safeText(value, fallback = 'not_provided') {
  return String(value || fallback).replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80);
}
const record = {
  status: 'manual_review_required',
  findingFingerprint: safeText(argValue('--fingerprint') || process.env.CODEX_FINDING_FINGERPRINT),
  ruleId: safeText(argValue('--rule-id') || process.env.CODEX_RULE_ID),
  profile: safeText(argValue('--profile') || process.env.CODEX_PROFILE || 'generic'),
  reviewOutcome: safeText(argValue('--outcome') || process.env.CODEX_REVIEW_OUTCOME || 'unknown'),
  wasUseful: boolValue('--useful'),
  wasFalsePositive: boolValue('--false-positive'),
  wasMissedRisk: boolValue('--missed-risk'),
  wasBlockingCorrect: boolValue('--blocking-correct'),
  recommendedTuning: safeText(argValue('--recommended-tuning') || process.env.CODEX_RECOMMENDED_TUNING || 'review_policy'),
  expiresAt: safeText(argValue('--expires-at') || process.env.CODEX_FEEDBACK_EXPIRES_AT || 'required'),
  reviewedBy: safeText(argValue('--reviewed-by') || process.env.CODEX_REVIEWED_BY || 'review-role'),
};
const summary = {
  safeFeedbackSummary: record,
  baselineCandidate: {
    suggested: record.wasFalsePositive === true,
    humanApprovalRequired: true,
    reasonRequired: true,
    expiresAtRequired: true,
  },
  ruleTuningCandidate: {
    suggested: record.wasMissedRisk === true || record.wasFalsePositive === true,
    autoApply: false,
  },
  profileTuningCandidate: {
    suggested: Boolean(record.profile),
    autoApply: false,
  },
};
if (process.env.CODEX_AUDIT_FEEDBACK_JSON === '1') process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
else {
  console.log('== Codex audit feedback record ==');
  console.log(`status: ${summary.safeFeedbackSummary.status}`);
  console.log(`ruleId: ${summary.safeFeedbackSummary.ruleId}`);
  console.log(`profile: ${summary.safeFeedbackSummary.profile}`);
  console.log(`baselineCandidate: ${summary.baselineCandidate.suggested}`);
  console.log(`ruleTuningCandidate: ${summary.ruleTuningCandidate.suggested}`);
  console.log(`profileTuningCandidate: ${summary.profileTuningCandidate.suggested}`);
  console.log('autoApply: false');
}
