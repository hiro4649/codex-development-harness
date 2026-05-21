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
  try { return JSON.parse(result.stdout || '{}'); } catch { return null; }
}
function safePlanText() {
  const planPath = argValue('--plan') || process.env.CODEX_FIX_PLAN_PATH || '';
  if (planPath && fs.existsSync(planPath)) return fs.readFileSync(planPath, 'utf8');
  return process.env.CODEX_FIX_PLAN || '';
}

const reportPath = argValue('--report') || process.env.CODEX_QUALITY_REPORT_PATH || '';
const report = reportPath && fs.existsSync(reportPath) ? readJson(reportPath) : (runReport() || {});
const plan = safePlanText();
const lower = plan.toLowerCase();
const changed = report.changedPathsSummary?.paths || [];
const scopeTooBroad = /\b(entire repo|all files|large refactor|rename everything|rewrite)\b/.test(lower);
const dangerousPatterns = ['git reset --hard', 'git clean -fd', 'git push --force', 'rm -rf'];
const dangerousCommands = dangerousPatterns.filter((item) => lower.includes(item));
if (/\b(deploy|mint|production|mainnet|testnet|migration apply)\b/.test(lower)) dangerousCommands.push('unsafe remote operation');
const blockedPatterns = report.prScopeAgreement?.blockedPaths || report.changedPathsSummary?.blocked || [];
const forbiddenChangesPlanned = changed.filter((file) => lower.includes(file.toLowerCase()) && (blockedPatterns || []).some((pattern) => file === pattern || file.startsWith(String(pattern).replace(/\*.*$/, ''))));
const missingValidation = !/\b(test|gate|scan|build|lint|verify|validate)\b/.test(lower);
const recommendedSplit = scopeTooBroad || (report.prSplitRecommendation?.splitRecommended === true);
const approvalRequired = scopeTooBroad || dangerousCommands.length > 0 || forbiddenChangesPlanned.length > 0 || report.humanReviewRequired === true;
const status = approvalRequired ? 'fail' : (missingValidation ? 'warning' : 'pass');

console.log('== Codex fix plan validator ==');
console.log(`fixPlanStatus: ${status}`);
console.log(`scopeTooBroad: ${scopeTooBroad}`);
console.log(`forbiddenChangesPlanned: ${forbiddenChangesPlanned.length}`);
console.log(`missingValidation: ${missingValidation}`);
console.log(`dangerousCommands: ${dangerousCommands.length}`);
console.log(`recommendedSplit: ${recommendedSplit}`);
console.log(`approvalRequired: ${approvalRequired}`);
if (process.env.CODEX_FIX_PLAN_VALIDATION_JSON === '1') {
  console.log(JSON.stringify({
    fixPlanStatus: status,
    scopeTooBroad,
    forbiddenChangesPlanned,
    missingValidation,
    dangerousCommands,
    recommendedSplit,
    approvalRequired,
  }, null, 2));
}
process.exit(status === 'fail' ? 1 : 0);
