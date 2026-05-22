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
  const result = spawnSync(process.execPath, ['scripts/codex-local-quality-gate.mjs'], {
    env: { ...process.env, CODEX_QUALITY_REPORT: 'json' },
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
const report = reportPath && fs.existsSync(reportPath) ? readJson(reportPath) : runReport();
const simulator = report.decisionSimulator || {};
const scenarios = simulator.scenarioResults || [];
const failed = scenarios.filter((item) => item.passFail === 'review');
const summary = {
  status: failed.length ? 'review' : 'pass',
  scenarioCount: scenarios.length,
  failedScenarioCount: failed.length,
  mergeReady: report.mergeReady === true,
  humanReviewRequired: report.humanReviewRequired === true,
  mustFixBeforeMerge: report.decisionMatrix?.mustFixBeforeMerge === true,
  recommendedNextAction: report.recommendedNextAction || report.recommendedAction || 'review safe decision',
};

console.log('== Codex PR decision simulator ==');
console.log(`status: ${summary.status}`);
console.log(`scenarioCount: ${summary.scenarioCount}`);
console.log(`failedScenarioCount: ${summary.failedScenarioCount}`);
console.log(`mergeReady: ${summary.mergeReady ? 'true' : 'false'}`);
console.log(`humanReviewRequired: ${summary.humanReviewRequired ? 'true' : 'false'}`);
console.log(`mustFixBeforeMerge: ${summary.mustFixBeforeMerge ? 'true' : 'false'}`);
for (const item of scenarios.slice(0, 10)) console.log(`scenario: ${item.scenario} expected=${item.expectedDecision} actual=${item.actualDecision} result=${item.passFail}`);
console.log(`recommendedNextAction: ${summary.recommendedNextAction}`);
if (process.env.CODEX_PR_DECISION_SIMULATOR_JSON === '1') console.log(JSON.stringify({ ...summary, scenarios }, null, 2));
process.exit(unsafeText(summary) || unsafeText(scenarios) ? 1 : 0);
