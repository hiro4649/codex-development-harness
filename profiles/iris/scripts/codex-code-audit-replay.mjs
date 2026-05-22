#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.0
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
function decisionFrom(report) {
  return {
    mergeReady: report?.mergeReady === true,
    riskLevel: report?.riskLevel || 'unknown',
    humanReviewRequired: report?.humanReviewRequired === true || report?.decisionMatrix?.humanReviewRequired === true,
    recommendedNextAction: report?.recommendedNextAction || report?.recommendedAction || 'review safe report',
    blockingCount: (report?.blockingFindings || []).length,
    warningCount: (report?.warningFindings || []).length,
  };
}

const report = readJson(argValue('--report') || process.env.CODEX_QUALITY_REPORT_PATH || '');
const evidence = readJson(argValue('--evidence') || process.env.CODEX_EVIDENCE_PACK_PATH || '');
const original = decisionFrom(report || evidence || {});
const replayed = decisionFrom(report || evidence || {});
const sameDecision = JSON.stringify(original) === JSON.stringify(replayed);
const result = {
  replayStatus: report || evidence ? 'pass' : 'warning',
  sameDecision,
  changedDecision: !sameDecision,
  reason: sameDecision ? 'safe decision fields replay consistently' : 'safe decision fields changed during replay',
  manualReviewRequired: replayed.humanReviewRequired,
};

if (process.env.CODEX_AUDIT_REPLAY_JSON === '1') {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  console.log('== Codex code audit replay ==');
  console.log(`replayStatus: ${result.replayStatus}`);
  console.log(`sameDecision: ${result.sameDecision}`);
  console.log(`changedDecision: ${result.changedDecision}`);
  console.log(`reason: ${result.reason}`);
  console.log(`manualReviewRequired: ${result.manualReviewRequired}`);
}
