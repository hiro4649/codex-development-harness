#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.0
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

function argValue(name) { const index = process.argv.indexOf(name); return index === -1 ? '' : (process.argv[index + 1] || ''); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
function runReport() {
  const result = spawnSync(process.execPath, ['scripts/codex-local-quality-gate.mjs'], { env: { ...process.env, CODEX_QUALITY_REPORT: 'json' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try { return JSON.parse(result.stdout || '{}'); } catch { return {}; }
}
function unsafe(value) { return /\b(sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/[^\s"']+/i.test(JSON.stringify(value || '')); }
const reportPath = argValue('--report') || process.env.CODEX_QUALITY_REPORT_PATH || '';
const report = reportPath && fs.existsSync(reportPath) ? readJson(reportPath) : runReport();
const summary = report.decisionRetrospective || { status: 'unknown' };
console.log('== Codex audit decision retrospective ==');
for (const key of ['decisionWasAppropriate', 'unexpectedPostMergeFailure', 'missedPreMergeSignal', 'overBlockingSignal', 'recommendedTuning', 'followUpRequired']) {
  console.log(`${key}: ${summary[key] ?? 'unknown'}`);
}
process.exit(unsafe(summary) ? 1 : 0);
