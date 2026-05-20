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
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}
function listFindings(report) {
  return [
    ...(report?.blockingFindings || []),
    ...(report?.warningFindings || []),
    ...(report?.infoFindings || []),
  ];
}
function safeCount(list, predicate) {
  return (list || []).filter(predicate).length;
}
function likelyFalsePositive(finding) {
  if (finding.confidence === 'high' && (finding.priority === 'P0' || finding.priority === 'P1' || finding.severity === 'blocking')) return false;
  const file = String(finding.path || '');
  if (finding.known === true) return true;
  if (finding.confidence === 'low') return true;
  return /\.(md|txt)$/i.test(file) || file.startsWith('docs/') || file.includes('/docs/');
}
function actionability(finding) {
  if (finding.actionability) return finding.actionability;
  if (String(finding.id || '').startsWith('dependencyAudit.')) return 'actionable_now';
  if (String(finding.id || '').startsWith('testWeakening.')) return 'actionable_now';
  if (finding.humanReviewRequired) return 'needs_human_review';
  return 'needs_more_context';
}
function evaluate(report, evidence, baseline, previous, prType) {
  const findings = listFindings(report);
  const fingerprints = new Set();
  let duplicates = 0;
  for (const finding of findings) {
    const key = finding.fingerprint || `${finding.ruleId || finding.id}|${finding.rootCauseId || ''}`;
    if (fingerprints.has(key)) duplicates += 1;
    fingerprints.add(key);
  }
  const falsePositiveCount = safeCount(findings, likelyFalsePositive);
  const actionableCount = safeCount(findings, (finding) => actionability(finding) === 'actionable_now');
  const humanReviewCount = safeCount(findings, (finding) => finding.humanReviewRequired === true || actionability(finding) === 'needs_human_review');
  const usefulCount = safeCount(findings, (finding) => ['high', 'medium'].includes(finding.usefulness || '') || finding.severity === 'blocking' || finding.priority === 'P0' || finding.priority === 'P1');
  const previousFingerprints = new Set(listFindings(previous).map((finding) => finding.fingerprint).filter(Boolean));
  const newFindingCount = previous ? findings.filter((finding) => finding.fingerprint && !previousFingerprints.has(finding.fingerprint)).length : 0;
  const baselineCount = Array.isArray(baseline?.findings) ? baseline.findings.length : (Array.isArray(baseline?.entries) ? baseline.entries.length : 0);
  const calibration = report?.profileCalibrationPack?.status || evidence?.profileCalibrationPack?.status || 'not_available';
  const status = report?.auditQualityStatus === 'pass' && report?.outputShapeStatus?.secretFree !== false ? 'pass' : 'warning';
  return {
    evaluationStatus: status,
    profile: report?.profile || 'unknown',
    prType: prType || report?.prType || report?.prTypeInference?.inferredType || 'unknown',
    usefulFindingCount: usefulCount,
    likelyFalsePositiveCount: falsePositiveCount,
    likelyDuplicateCount: duplicates,
    likelyActionableCount: actionableCount,
    humanReviewRequiredCount: humanReviewCount,
    newFindingCount,
    baselineEntryCount: baselineCount,
    profileCalibrationStatus: calibration,
    recommendedTuning: falsePositiveCount > actionableCount
      ? 'review low-usefulness findings and consider narrow baseline or rule tuning'
      : 'no immediate tuning suggested by safe evaluation',
  };
}

const report = readJson(argValue('--report') || process.env.CODEX_QUALITY_REPORT_PATH || '');
const evidence = readJson(argValue('--evidence') || process.env.CODEX_EVIDENCE_PACK_PATH || '');
const baseline = readJson(argValue('--baseline') || process.env.CODEX_CODE_AUDIT_BASELINE_PATH || '');
const previous = readJson(argValue('--previous') || process.env.CODEX_PREVIOUS_QUALITY_REPORT_PATH || '');
const prType = argValue('--pr-type') || process.env.CODEX_PR_TYPE || '';
const result = evaluate(report || {}, evidence || {}, baseline || {}, previous || null, prType);

if (process.env.CODEX_AUDIT_EVALUATION_JSON === '1') {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  console.log('== Codex code audit evaluation ==');
  console.log(`evaluationStatus: ${result.evaluationStatus}`);
  console.log(`profile: ${result.profile}`);
  console.log(`prType: ${result.prType}`);
  console.log(`usefulFindingCount: ${result.usefulFindingCount}`);
  console.log(`likelyFalsePositiveCount: ${result.likelyFalsePositiveCount}`);
  console.log(`likelyDuplicateCount: ${result.likelyDuplicateCount}`);
  console.log(`likelyActionableCount: ${result.likelyActionableCount}`);
  console.log(`humanReviewRequiredCount: ${result.humanReviewRequiredCount}`);
  console.log(`profileCalibrationStatus: ${result.profileCalibrationStatus}`);
  console.log(`recommendedTuning: ${result.recommendedTuning}`);
}
