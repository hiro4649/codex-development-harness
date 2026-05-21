#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.9
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
function unsafe(value) {
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
const summary = report.auditEffectiveness || { effectivenessStatus: 'unknown' };

console.log('== Codex audit effectiveness tracker ==');
for (const key of ['effectivenessStatus', 'usefulFindingCount', 'ignoredFindingCount', 'fixedFindingCount', 'falsePositiveCount', 'missedRiskCount', 'reviewTriggeredCount', 'prSplitTriggeredCount', 'mergeBlockedCorrectlyCount', 'mergeBlockedIncorrectlyCount']) {
  console.log(`${key}: ${summary[key] ?? 'unknown'}`);
}
console.log(`recommendedTuning: ${summary.recommendedTuning || 'collect safe feedback before tuning'}`);
process.exit(unsafe(summary) ? 1 : 0);
