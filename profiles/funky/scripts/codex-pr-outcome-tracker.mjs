#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.9
import fs from 'node:fs';
import process from 'node:process';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : (process.argv[index + 1] || '');
}
function readJson(file) {
  if (!file || !fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; }
}
const report = readJson(argValue('--report') || process.env.CODEX_QUALITY_REPORT_PATH || '') || {};
const outcome = {
  status: 'available',
  prType: report.prType || report.prTypeInference?.inferredType || 'unknown',
  profile: report.profile || 'unknown',
  riskLevel: report.riskLevel || 'unknown',
  mergeReadyBeforeMerge: report.mergeReady === true,
  qualityGateStatus: report.localGate?.status || report.status || 'unknown',
  merged: process.env.CODEX_PR_MERGED === '1',
  postMergeVerificationStatus: report.postMerge?.status || 'not_run',
  newFailureAfterMerge: process.env.CODEX_POST_MERGE_FAILURE === '1',
  knownResiduals: report.partialRunHandling?.mustMentionInPR === true,
  humanReviewRequired: report.humanReviewRequired === true,
  humanReviewCompleted: process.env.CODEX_HUMAN_REVIEW_COMPLETED === '1',
  ruleFindingsSummary: {
    blocking: report.blockingFindings?.length || 0,
    warning: report.warningFindings?.length || 0,
    info: report.infoFindings?.length || 0,
  },
};
if (process.env.CODEX_PR_OUTCOME_JSON === '1') process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
else {
  console.log('== Codex PR outcome tracker ==');
  for (const [key, value] of Object.entries(outcome)) {
    console.log(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
  }
}
