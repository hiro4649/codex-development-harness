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
  try { return JSON.parse(result.stdout || '{}'); } catch { return null; }
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
const report = reportPath && fs.existsSync(reportPath) ? readJson(reportPath) : (runReport() || {});
const findings = [...(report.blockingFindings || []), ...(report.warningFindings || []), ...(report.infoFindings || [])];
const seen = new Set();
let duplicate = 0;
let missingRemediation = 0;
let missingValidation = 0;
let lowValue = 0;
let unsafe = false;

for (const finding of findings) {
  const key = `${finding.ruleId || finding.id}|${finding.rootCauseId || ''}|${finding.fingerprint || ''}`;
  if (seen.has(key)) duplicate += 1;
  seen.add(key);
  if (!finding.recommendedFixType || finding.recommendedFixType === 'cannot_determine') missingRemediation += 1;
  if (!Array.isArray(finding.fixValidationHint) || !finding.fixValidationHint.length) missingValidation += 1;
  if (finding.usefulness === 'low' || finding.confidence === 'low') lowValue += 1;
  if (unsafeText(finding)) unsafe = true;
}

const summary = {
  usefulnessValidationStatus: unsafe ? 'fail' : (duplicate || missingRemediation || missingValidation ? 'warning' : 'pass'),
  usefulFindingCount: findings.length - lowValue,
  lowValueFindingCount: lowValue,
  missingRemediationCount: missingRemediation,
  missingValidationCount: missingValidation,
  duplicateFindingCount: duplicate,
  recommendedTuning: duplicate || missingRemediation || missingValidation
    ? 'tighten finding grouping and remediation metadata'
    : 'finding metadata is actionable by safe summary',
};

console.log('== Codex audit usefulness validation ==');
console.log(`status: ${summary.usefulnessValidationStatus}`);
console.log(`usefulnessValidationStatus: ${summary.usefulnessValidationStatus}`);
console.log(`usefulFindingCount: ${summary.usefulFindingCount}`);
console.log(`lowValueFindingCount: ${summary.lowValueFindingCount}`);
console.log(`missingRemediationCount: ${summary.missingRemediationCount}`);
console.log(`missingValidationCount: ${summary.missingValidationCount}`);
console.log(`duplicateFindingCount: ${summary.duplicateFindingCount}`);
console.log(`recommendedTuning: ${summary.recommendedTuning}`);
if (process.env.CODEX_AUDIT_USEFULNESS_JSON === '1') console.log(JSON.stringify(summary, null, 2));
process.exit(summary.usefulnessValidationStatus === 'fail' ? 1 : 0);
