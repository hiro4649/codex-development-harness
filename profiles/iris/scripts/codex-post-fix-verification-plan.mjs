#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.8
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

function argValue(name) { const index = process.argv.indexOf(name); return index === -1 ? '' : (process.argv[index + 1] || ''); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
function runReport() {
  const result = spawnSync(process.execPath, ['scripts/codex-local-quality-gate.mjs'], { env: { ...process.env, CODEX_QUALITY_REPORT: 'json' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try { return JSON.parse(result.stdout || '{}'); } catch { return {}; }
}
function safeList(values) { return (values || []).slice(0, 8).map((item) => `- ${item}`).join('\n') || '- none'; }
function unsafe(value) { return /reset --hard|clean -fd|push --force|rm -rf|deploy|mint|production|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/i.test(JSON.stringify(value || '')); }

const reportPath = argValue('--report') || process.env.CODEX_QUALITY_REPORT_PATH || '';
const report = reportPath && fs.existsSync(reportPath) ? readJson(reportPath) : runReport();
const plan = report.postFixVerificationPlan || { requiredCommands: [], recommendedCommands: [], manualChecks: [], profileReviewerChecks: [], whatNotToAssume: [] };
console.log('== Codex post-fix verification plan ==');
console.log('requiredCommands:');
console.log(safeList(plan.requiredCommands));
console.log('recommendedCommands:');
console.log(safeList(plan.recommendedCommands));
console.log('manualChecks:');
console.log(safeList(plan.manualChecks));
console.log('profileReviewerChecks:');
console.log(safeList(plan.profileReviewerChecks));
console.log('whatNotToAssume:');
console.log(safeList(plan.whatNotToAssume));
process.exit(unsafe(plan) ? 1 : 0);
