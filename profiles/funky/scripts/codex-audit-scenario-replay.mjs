#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.0
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : (process.argv[index + 1] || '');
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
function runReport() {
  const expected = argValue('--expected') || process.env.CODEX_EXPECTED_DECISION || '';
  const result = spawnSync(process.execPath, ['scripts/codex-local-quality-gate.mjs'], {
    env: { ...process.env, CODEX_QUALITY_REPORT: 'json', CODEX_EXPECTED_DECISION: expected },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  try { return JSON.parse(result.stdout || '{}'); } catch { return {}; }
}
function unsafeText(value) {
  const text = JSON.stringify(value || '');
  return [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
    /\bsk-[A-Za-z0-9]{20,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/[^\s"']+/i,
  ].some((pattern) => pattern.test(text));
}

const reportPath = argValue('--report') || process.env.CODEX_QUALITY_REPORT_PATH || '';
const expected = argValue('--expected') || process.env.CODEX_EXPECTED_DECISION || '';
const report = reportPath && fs.existsSync(reportPath) ? readJson(reportPath) : runReport();
const replay = report.scenarioReplay || {};
const actual = report.decisionTrace?.finalDecision || replay.actualDecision || 'unknown';
const sameDecision = expected ? expected === actual : replay.sameDecision !== false;
const summary = {
  replayStatus: expected ? (sameDecision ? 'sameDecision' : 'changedDecision') : (replay.replayStatus || 'not_provided'),
  sameDecision,
  changedDecision: !sameDecision,
  expectedDecision: expected || 'not_provided',
  actualDecision: actual,
  reason: sameDecision ? 'safe scenario decision matched expectation or no expectation was supplied' : 'safe scenario decision changed',
  manualReviewRequired: !sameDecision,
};

console.log('== Codex audit scenario replay ==');
console.log(`replayStatus: ${summary.replayStatus}`);
console.log(`sameDecision: ${summary.sameDecision ? 'true' : 'false'}`);
console.log(`expectedDecision: ${summary.expectedDecision}`);
console.log(`actualDecision: ${summary.actualDecision}`);
console.log(`manualReviewRequired: ${summary.manualReviewRequired ? 'true' : 'false'}`);
console.log(`reason: ${summary.reason}`);
if (process.env.CODEX_AUDIT_SCENARIO_REPLAY_JSON === '1') console.log(JSON.stringify(summary, null, 2));
process.exit(unsafeText(summary) ? 1 : 0);
