#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.8
import fs from 'node:fs';
import process from 'node:process';

function filesFromArgs() {
  const index = process.argv.indexOf('--reports');
  if (index !== -1) return process.argv.slice(index + 1).filter((item) => !item.startsWith('--'));
  return (process.env.CODEX_QUALITY_REPORTS || '').split(';').filter(Boolean);
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; }
}
const reports = filesFromArgs().map(readJson).filter(Boolean);
const profileMap = new Map();
const ruleMap = new Map();
for (const report of reports) {
  const profile = report.profile || 'unknown';
  const entry = profileMap.get(profile) || { profile, total: 0, blocking: 0, warning: 0, humanReview: 0 };
  entry.total += 1;
  entry.blocking += report.blockingFindings?.length || 0;
  entry.warning += report.warningFindings?.length || 0;
  entry.humanReview += report.humanReviewRequired ? 1 : 0;
  profileMap.set(profile, entry);
  for (const finding of [...(report.blockingFindings || []), ...(report.warningFindings || []), ...(report.infoFindings || [])]) {
    const key = finding.ruleId || finding.id || 'unknown';
    ruleMap.set(key, (ruleMap.get(key) || 0) + 1);
  }
}
const summary = {
  status: 'available',
  totalPRs: reports.length,
  mergeReadyTrueCount: reports.filter((report) => report.mergeReady === true).length,
  mergeReadyFalseCount: reports.filter((report) => report.mergeReady === false).length,
  blockingFindingsCount: reports.reduce((sum, report) => sum + (report.blockingFindings?.length || 0), 0),
  warningsCount: reports.reduce((sum, report) => sum + (report.warningFindings?.length || 0), 0),
  falsePositiveFeedbackCount: 0,
  missedRiskFeedbackCount: 0,
  postMergeFailureCount: reports.filter((report) => report.postMerge?.status === 'fail').length,
  profileBreakdown: [...profileMap.values()].sort((a, b) => a.profile.localeCompare(b.profile)),
  topRulesByFindingCount: [...ruleMap.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([ruleId, count]) => ({ ruleId, count })),
  topRulesByFalsePositiveFeedback: [],
  recommendedTuning: reports.length ? 'review profile breakdown and top rules' : 'provide safe reports to summarize',
};
if (process.env.CODEX_AUDIT_PERFORMANCE_JSON === '1') process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
else {
  console.log('== Codex audit performance summary ==');
  console.log(`totalPRs: ${summary.totalPRs}`);
  console.log(`mergeReadyTrueCount: ${summary.mergeReadyTrueCount}`);
  console.log(`mergeReadyFalseCount: ${summary.mergeReadyFalseCount}`);
  console.log(`blockingFindingsCount: ${summary.blockingFindingsCount}`);
  console.log(`warningsCount: ${summary.warningsCount}`);
  console.log(`profileBreakdown: ${summary.profileBreakdown.length}`);
  console.log(`recommendedTuning: ${summary.recommendedTuning}`);
}
