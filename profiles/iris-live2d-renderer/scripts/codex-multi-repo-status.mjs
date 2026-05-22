#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.9
import { execFileSync, spawnSync } from 'node:child_process';
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
function repoLabel(repoPath) {
  return path.basename(path.resolve(repoPath));
}
function git(repoPath, args) {
  try { return execFileSync('git', args, { cwd: repoPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; }
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
  console.log('== Codex multi-repo status ==');
  console.log('status: manual_confirmation_required');
  console.log('reason: config file not found');
  process.exit(0);
}

const config = readJson(configPath);
const targets = Array.isArray(config.targets) ? config.targets : [];
const results = [];
for (const target of targets) {
  const repoPath = target.repoPath || '';
  const label = repoLabel(repoPath || 'unknown');
  if (!repoPath || !fs.existsSync(repoPath)) {
    results.push({ label, status: 'fail', reason: 'repo path unavailable' });
    continue;
  }
  const statusLines = git(repoPath, ['status', '--short']).split(/\r?\n/).filter(Boolean);
  const ahead = Number(git(repoPath, ['rev-list', '--count', 'origin/main..HEAD']).trim() || 0);
  const behind = Number(git(repoPath, ['rev-list', '--count', 'HEAD..origin/main']).trim() || 0);
  const { exitCode, report } = runReport(repoPath);
  const profileOk = !target.expectedProfile || report?.profile === target.expectedProfile;
  const versionOk = !target.expectedHarnessVersion || report?.harnessVersion === target.expectedHarnessVersion;
  results.push({
    label,
    status: exitCode === 0 && profileOk && versionOk && statusLines.length === 0 ? 'pass' : 'warning',
    profile: report?.profile || 'unknown',
    harnessVersion: report?.harnessVersion || 'unknown',
    worktreeClean: statusLines.length === 0,
    localOnlyCommits: Number.isFinite(ahead) ? ahead : 0,
    remoteOnlyCommits: Number.isFinite(behind) ? behind : 0,
    secretScan: report?.secretScan?.status || 'unknown',
    localGate: report?.localGate?.status || 'unknown',
    profileRequired: report?.profileRequiredChecks?.status || 'unknown',
    knownRisks: report?.knownRisks?.status || 'unknown',
    mergeReady: report?.mergeReady === true,
  });
}

console.log('== Codex multi-repo status ==');
console.log(`targets: ${results.length}`);
for (const item of results) {
  console.log(`${item.label}: ${item.status} version=${item.harnessVersion} profile=${item.profile} mergeReady=${item.mergeReady ? 'true' : 'false'}`);
}
process.exit(results.some((item) => item.status === 'fail') ? 1 : 0);
