#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.8
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
const summary = report.mutationBenchmark || { mutationBenchmarkStatus: 'unknown', mutationCount: 0, detectedMutationCount: 0, missedMutationCount: 0, overDetectedMutationCount: 0, perMutationResult: [] };

console.log('== Codex audit mutation benchmark ==');
console.log(`mutationBenchmarkStatus: ${summary.mutationBenchmarkStatus || summary.status || 'unknown'}`);
console.log(`mutationCount: ${summary.mutationCount || 0}`);
console.log(`detectedMutationCount: ${summary.detectedMutationCount || 0}`);
console.log(`missedMutationCount: ${summary.missedMutationCount || 0}`);
console.log(`overDetectedMutationCount: ${summary.overDetectedMutationCount || 0}`);
for (const item of (summary.perMutationResult || []).slice(0, 12)) console.log(`mutation: ${item.mutationId} rule=${item.ruleId} detected=${item.detected === true}`);
console.log(`recommendedTuning: ${summary.recommendedTuning || 'review safe mutation benchmark'}`);
if (process.env.CODEX_AUDIT_MUTATION_JSON === '1') console.log(JSON.stringify(summary, null, 2));
process.exit(unsafeText(summary) ? 1 : 0);
