#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.8
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
function listFindings(report) {
  return [...(report?.blockingFindings || []), ...(report?.warningFindings || []), ...(report?.infoFindings || [])];
}
function likelyFalsePositive(finding) {
  if ((finding.priority === 'P0' || finding.priority === 'P1') && finding.confidence === 'high') return false;
  const file = String(finding.path || '');
  return finding.confidence === 'low' || finding.known === true || file.startsWith('docs/') || /\.(md|txt)$/i.test(file);
}
function main() {
  const report = readJson(argValue('--report') || process.env.CODEX_QUALITY_REPORT_PATH || '') || {};
  const evidence = readJson(argValue('--evidence') || process.env.CODEX_EVIDENCE_PACK_PATH || '') || {};
  const previous = readJson(argValue('--previous') || process.env.CODEX_PREVIOUS_QUALITY_REPORT_PATH || '') || null;
  const findings = listFindings(report);
  const useful = findings.filter((finding) => ['high', 'medium'].includes(finding.usefulness || finding.confidence || '') || finding.severity === 'blocking');
  const lowValue = findings.filter((finding) => likelyFalsePositive(finding));
  const actionable = findings.filter((finding) => finding.actionability === 'actionable_now');
  const human = findings.filter((finding) => finding.humanReviewRequired === true || finding.actionability === 'needs_human_review');
  const previousFingerprints = new Set(listFindings(previous).map((finding) => finding.fingerprint).filter(Boolean));
  const newFindingCount = previous ? findings.filter((finding) => finding.fingerprint && !previousFingerprints.has(finding.fingerprint)).length : 0;
  const result = {
    realProjectEvaluationStatus: (report.auditQualityStatus === 'pass' && report.safeArtifactValidation?.secretFree !== false) ? 'pass' : 'warning',
    profile: report.profile || evidence.profile || 'unknown',
    usefulFindings: useful.length,
    lowValueFindings: lowValue.length,
    likelyFalsePositives: lowValue.length,
    likelyMissedRisks: report.falseNegativeGuard?.findings?.length || 0,
    actionableFindings: actionable.length,
    humanReviewFindings: human.length,
    newFindingCount,
    mergeDecisionQuality: report.mergeReady === false && (report.blockingFindings || []).length ? 'consistent_blocked' : (report.mergeReady === true ? 'ready_by_safe_checks' : 'needs_review'),
    recommendedRuleTuning: lowValue.length > useful.length ? 'review low-value warning rules' : 'no immediate rule tuning suggested',
    recommendedProfileTuning: report.profileCalibrationReport?.status === 'available' ? 'review profile calibration summary' : 'collect more safe profile feedback',
    recommendedNextAction: report.recommendedNextAction || report.recommendedAction || 'review safe evaluation summary',
  };
  if (process.env.CODEX_REAL_PROJECT_EVALUATION_JSON === '1') {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  console.log('== Codex real project audit evaluation ==');
  for (const [key, value] of Object.entries(result)) {
    console.log(`${key}: ${Array.isArray(value) ? value.length : value}`);
  }
}
main();
