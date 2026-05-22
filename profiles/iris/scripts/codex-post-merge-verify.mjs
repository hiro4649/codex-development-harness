#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.9
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const HARNESS_VERSION = '0.6.9';

function git(args) {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; }
}
function runNode(args, env = {}) {
  return spawnSync(process.execPath, args, {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
function readJson(text) {
  try { return JSON.parse(text || '{}'); } catch { return null; }
}
function sha(ref) {
  return git(['rev-parse', ref]).trim();
}

const branch = git(['branch', '--show-current']).trim() || '(detached)';
const statusLines = git(['status', '--short']).split(/\r?\n/).filter(Boolean);
const originMain = sha('origin/main');
const head = sha('HEAD');
const manifestPath = path.join('docs', 'process', 'CODEX_HARNESS_MANIFEST.json');
const policyPath = path.join('docs', 'process', 'CODEX_QUALITY_GATE_POLICY.json');
const knownRiskPath = path.join('docs', 'process', 'CODEX_KNOWN_RISKS.json');
const expectedHarnessVersion = process.env.CODEX_EXPECTED_HARNESS_VERSION || HARNESS_VERSION;

const secret = runNode(['scripts/codex-secret-safety-scan.mjs']);
const localGate = runNode(['scripts/codex-local-quality-gate.mjs']);
const profileGate = runNode(['scripts/codex-local-quality-gate.mjs'], {
  CODEX_RUN_PROFILE_REQUIRED_CHECKS: '1',
  CODEX_QUALITY_REPORT: 'json',
});
const report = readJson(profileGate.stdout);

const checks = [
  { id: 'branch.main', pass: branch === 'main' },
  { id: 'worktree.clean', pass: statusLines.length === 0 },
  { id: 'head.synced', pass: Boolean(originMain) && head === originMain },
  { id: 'secretScan.pass', pass: secret.status === 0 },
  { id: 'localGate.pass', pass: localGate.status === 0 },
  { id: 'profileRequired.pass', pass: profileGate.status === 0 },
  { id: 'version.match', pass: expectedHarnessVersion === HARNESS_VERSION && report?.harnessVersion === HARNESS_VERSION },
  { id: 'manifest.exists', pass: fs.existsSync(manifestPath) },
  { id: 'policy.exists', pass: fs.existsSync(policyPath) },
  { id: 'knownRisks.exists', pass: fs.existsSync(knownRiskPath) },
  { id: 'report.mergeReady', pass: report?.mergeReady === true },
  { id: 'knownRisks.notInvalid', pass: (report?.knownRisks?.invalid || []).length === 0 },
];
const failed = checks.filter((check) => !check.pass);

console.log('== Codex post-merge verify ==');
console.log(`status: ${failed.length ? 'fail' : 'pass'}`);
console.log(`currentBranch: ${branch}`);
console.log(`dirtyFiles: ${statusLines.length}`);
console.log(`headEqualsOriginMain: ${Boolean(originMain) && head === originMain ? 'yes' : 'no'}`);
console.log(`harnessVersion: ${report?.harnessVersion || HARNESS_VERSION}`);
console.log(`mergeReady: ${report?.mergeReady === true ? 'true' : 'false'}`);
console.log(`secret scan: ${secret.status === 0 ? 'pass' : 'fail'}`);
console.log(`local gate: ${localGate.status === 0 ? 'pass' : 'fail'}`);
console.log(`profile required: ${profileGate.status === 0 ? 'pass' : 'fail'}`);
console.log(`known risk expiry: ${report?.knownRisks?.status || 'unknown'}`);
console.log(`branch cleanup candidates: ${report?.branchCleanupAdvice?.deleteCandidates?.length || 0}`);
console.log(`manual branch protection: ${report?.manualMergePolicy?.status || 'manual_confirmation_required'}`);
console.log(`manual confirmation: ${report?.manualConfirmationStatus?.status || 'not_required'} required=${report?.manualConfirmationStatus?.required === true}`);
console.log(`postMergeVerificationPlan: ${(report?.postMergeVerificationPlan || []).length}`);
console.log('nextFiles: AGENTS.md, docs/process/CODEX_QUALITY_GATE_POLICY.json, docs/process/skills');
for (const check of failed) console.log(`failed: ${check.id}`);
process.exit(failed.length ? 1 : 0);
