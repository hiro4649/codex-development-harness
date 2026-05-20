#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.8
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : (process.argv[index + 1] || '');
}
function readBody() {
  const file = argValue('--body-file') || process.env.CODEX_PR_BODY_FILE || '';
  if (file && fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  return process.env.CODEX_PR_BODY || '';
}
function runReport() {
  const result = spawnSync(process.execPath, ['scripts/codex-local-quality-gate.mjs'], {
    env: { ...process.env, CODEX_RUN_PROFILE_REQUIRED_CHECKS: '1', CODEX_HARNESS_PR: '1', CODEX_QUALITY_REPORT: 'json' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try { return { exitCode: result.status ?? 1, report: JSON.parse(result.stdout || '{}') }; } catch { return { exitCode: result.status ?? 1, report: null }; }
}

const { exitCode, report } = runReport();
const body = readBody();
const failures = [];
const warnings = [];
if (exitCode !== 0) failures.push('local conditions are not pass');
if (report?.mergeReady !== true) failures.push('quality report mergeReady is not true');
if (report?.prSeparationStatus?.status === 'fail') failures.push('changed paths are outside harness update scope');
if ((report?.changedPathsSummary?.blocked || []).length) failures.push('blocked paths are touched');
if ((report?.changedPathsSummary?.highRisk || []).length && report?.riskLevel !== 'R3') failures.push('high-risk paths did not classify as R3');
if (!/Verification|鬯ｯ・ｯ繝ｻ・ｮ郢晢ｽｻ繝ｻ・ｫ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｶ驛｢譎｢・ｽ・ｻ驍ｵ・ｺ繝ｻ・､繝ｻ縺､ﾂ鬯ｯ・ｮ繝ｻ・ｫ郢晢ｽｻ繝ｻ・ｲ鬮ｯ譎｢・ｽ・ｶ髯ｷ・ｷ繝ｻ・ｶ驛｢譎｢・ｽ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｨ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｼ鬯ｯ・ｯ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｩ鬮ｫ・ｰ繝ｻ・ｳ郢晢ｽｻ繝ｻ・ｾ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｽ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｨ鬯ｯ・ｮ繝ｻ・ｯ郢晢ｽｻ繝ｻ・ｷ鬮｣雋ｻ・｣・ｰ郢晢ｽｻ繝ｻ・･鬮ｮ蜿冶・繝ｻ・ｽ繝ｻ・ｺ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｣鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・｡/i.test(body)) warnings.push('PR body verification section requires confirmation');
if (!/Residual risk|鬯ｯ・ｯ繝ｻ・ｮ郢晢ｽｻ繝ｻ・ｫ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｹ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｿ鬯ｯ・ｮ繝ｻ・｣髯具ｽｹ郢晢ｽｻ繝ｻ・ｽ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｵ鬯ｮ・ｫ繝ｻ・ｴ驕ｶ謫ｾ・ｽ・ｵ郢晢ｽｻ繝ｻ・ｻ鬮ｦ・ｮ陷ｻ雜｣・ｽ・ｸ陞溘ｑ・ｽ・ｹ隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｹ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｧ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｹ鬯ｯ・ｯ繝ｻ・ｩ髯晢ｽｷ繝ｻ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・｢鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｧ鬯ｩ蟷｢・ｽ・｢髫ｴ雜｣・ｽ・｢郢晢ｽｻ繝ｻ・ｽ郢晢ｽｻ繝ｻ・ｻ鬩幢ｽ｢隴趣ｽ｢繝ｻ・ｽ繝ｻ・ｻ驛｢譎｢・ｽ・ｻ郢晢ｽｻ繝ｻ・ｯ/i.test(body)) warnings.push('PR body residual risk section requires confirmation');
if (!/quality-gate:\s*PASS/i.test(body)) warnings.push('quality-gate PASS requires manual confirmation');
warnings.push('Codex merge review required before manual merge');

console.log('== Codex manual merge policy ==');
console.log(`status: ${failures.length ? 'fail' : 'manual_confirmation_required'}`);
console.log(`mergeReady: ${report?.mergeReady === true ? 'true' : 'false'}`);
console.log(`riskLevel: ${report?.riskLevel || 'unknown'}`);
console.log(`prSeparation: ${report?.prSeparationStatus?.status || 'unknown'}`);
for (const warning of warnings) console.log(`manual confirmation: ${warning}`);
for (const failure of failures) console.log(`failure: ${failure}`);
process.exit(failures.length ? 1 : 0);
