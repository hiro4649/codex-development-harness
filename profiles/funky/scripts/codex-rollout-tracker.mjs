#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.8
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : (process.argv[index + 1] || '');
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
function label(repoPath) {
  return path.basename(path.resolve(repoPath || 'unknown'));
}
function runReport(repoPath) {
  const result = spawnSync(process.execPath, ['scripts/codex-local-quality-gate.mjs'], {
    cwd: repoPath,
    env: { ...process.env, CODEX_RUN_PROFILE_REQUIRED_CHECKS: '1', CODEX_QUALITY_REPORT: 'json' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try { return { exitCode: result.status ?? 1, report: JSON.parse(result.stdout || '{}') }; } catch { return { exitCode: result.status ?? 1, report: null }; }
}

const configPath = argValue('--config') || process.env.CODEX_MULTI_REPO_TARGETS || path.join('docs', 'process', 'CODEX_MULTI_REPO_TARGETS.example.json');
if (!fs.existsSync(configPath)) {
  console.log('== Codex rollout tracker ==');
  console.log('status: manual_confirmation_required');
  console.log('reason: target config not found');
  process.exit(0);
}
const targets = readJson(configPath).targets || [];
const results = [];
for (const target of targets) {
  const repoPath = target.repoPath || '';
  if (!repoPath || !fs.existsSync(repoPath)) {
    results.push({ repo: label(repoPath), status: 'missing', recommendedAction: 'confirm repo path' });
    continue;
  }
  const { exitCode, report } = runReport(repoPath);
  const versionOk = !target.expectedHarnessVersion || report?.harnessVersion === target.expectedHarnessVersion;
  const profileOk = !target.expectedProfile || report?.profile === target.expectedProfile;
  results.push({
    repo: label(repoPath),
    expectedProfile: target.expectedProfile || 'unspecified',
    expectedHarnessVersion: target.expectedHarnessVersion || 'unspecified',
    currentHarnessVersion: report?.harnessVersion || 'unknown',
    worktreeStatus: report?.worktreeStatus?.status || 'unknown',
    qualityGateStatus: report?.status || (exitCode === 0 ? 'pass' : 'fail'),
    postMergeStatus: report?.postMerge?.status || 'unknown',
    manualPolicyStatus: report?.manualMergePolicy?.status || 'manual_confirmation_required',
    mergeReady: report?.mergeReady === true,
    status: exitCode === 0 && versionOk && profileOk ? 'pass' : 'warning',
    recommendedAction: exitCode === 0 && versionOk && profileOk ? 'continue rollout tracking' : 'review target status',
  });
}

console.log('== Codex rollout tracker ==');
console.log(`targets: ${results.length}`);
for (const item of results) {
  console.log(`${item.repo}: ${item.status} version=${item.currentHarnessVersion} profile=${item.expectedProfile} gate=${item.qualityGateStatus} postMerge=${item.postMergeStatus}`);
}
process.exit(results.some((item) => item.status === 'missing') ? 1 : 0);
