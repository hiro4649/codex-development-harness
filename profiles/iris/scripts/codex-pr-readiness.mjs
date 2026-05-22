#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.0
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const HARNESS_VERSION = '0.7.0';
const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;
const args = process.argv.slice(2);

function argValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return '';
  return args[index + 1] || '';
}
function npmCliPath() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}
function commandSpec(cmd, cmdArgs) {
  if (cmd === 'node') return { command: process.execPath, args: cmdArgs };
  if (cmd === 'npm') {
    const cli = npmCliPath();
    if (cli) return { command: process.execPath, args: [cli, ...cmdArgs] };
  }
  return { command: cmd, args: cmdArgs };
}
function run(cmd, cmdArgs, options = {}) {
  const spec = commandSpec(cmd, cmdArgs);
  return spawnSync(spec.command, spec.args, {
    cwd: options.cwd || '.',
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
function git(argsForGit) {
  try {
    return execFileSync('git', argsForGit, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
function safeWriteReport(report) {
  const target = process.env.CODEX_PR_READINESS_REPORT_PATH || '';
  if (!target) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
function readPrBody() {
  const bodyFile = argValue('--body-file') || process.env.CODEX_PR_BODY_FILE || '';
  if (bodyFile && fs.existsSync(bodyFile)) return fs.readFileSync(bodyFile, 'utf8');
  return process.env.CODEX_PR_BODY || '';
}
function hasRequiredBodySections(body) {
  return {
    verification: /\u691c\u8a3c\u7d50\u679c|Verification/i.test(body),
    residualRisk: /\u6b8b\u30ea\u30b9\u30af|Residual risk/i.test(body),
    qualityGatePass: /GitHub Actions quality-gate:\s*PASS/i.test(body),
  };
}
function tryGithubActionsStatus() {
  if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    return { status: 'manual_confirmation_required', reason: 'GitHub API token unavailable.' };
  }
  const head = git(['rev-parse', 'HEAD']).trim();
  if (!head) return { status: 'manual_confirmation_required', reason: 'HEAD ref unavailable.' };
  const gh = spawnSync('gh', ['run', 'list', '--commit', head, '--json', 'name,conclusion,status', '--limit', '20'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (gh.status !== 0 || !gh.stdout) return { status: 'manual_confirmation_required', reason: 'GitHub CLI unavailable.' };
  try {
    const runs = JSON.parse(gh.stdout);
    const gate = runs.find((run) => run.name === 'quality-gate');
    if (!gate) return { status: 'manual_confirmation_required', reason: 'quality-gate run not found.' };
    return { status: gate.conclusion === 'success' ? 'pass' : 'not_pass', workflow: 'quality-gate' };
  } catch {
    return { status: 'manual_confirmation_required', reason: 'GitHub Actions response was not parseable.' };
  }
}

const tempReport = path.join(os.tmpdir(), `codex-pr-readiness-${process.pid}.json`);
const reportPath = process.env.CODEX_QUALITY_REPORT_PATH || tempReport;
const localGate = run('node', ['scripts/codex-local-quality-gate.mjs'], {
  env: {
    CODEX_RUN_PROFILE_REQUIRED_CHECKS: '1',
    CODEX_QUALITY_REPORT_PATH: reportPath,
    CODEX_WRITE_QUALITY_REPORT: '1',
  },
});
const failures = [];
const warnings = [];
let qualityReport = null;
if (fs.existsSync(reportPath)) {
  try {
    qualityReport = readJson(reportPath);
  } catch {
    failures.push({ id: 'qualityReport.parse', message: 'Quality report could not be parsed.' });
  }
}
if (localGate.status !== 0) failures.push({ id: 'localQualityGate.failed', message: 'Local quality gate failed.' });
if (!qualityReport) failures.push({ id: 'qualityReport.missing', message: 'Quality report was not generated.' });

if (qualityReport) {
  if (qualityReport.mergeReady !== true) failures.push({ id: 'qualityReport.mergeReady', message: 'Quality report mergeReady is not true.' });
  if ((qualityReport.blockingFindings || []).length) failures.push({ id: 'codeAudit.blockingFindings', message: 'Code audit has blocking findings.' });
  if (qualityReport.decisionMatrix?.mustFixBeforeMerge === true) failures.push({ id: 'decisionMatrix.mustFixBeforeMerge', message: 'Decision matrix requires fixes before merge.' });
  if (qualityReport.decisionMatrix?.humanReviewRequired === true || qualityReport.humanReviewRequired === true) {
    warnings.push({ id: 'decisionMatrix.humanReviewRequired', message: 'Manual confirmation is required before merge.' });
  }
  if (qualityReport.residualTestStatus?.knownResidualAccepted === true) {
    warnings.push({ id: 'fullRunTests.knownResidual', message: 'Known residual full run status must be documented in the PR body.' });
  }
  if (qualityReport.secretScan?.status !== 'pass') failures.push({ id: 'secretScan.notPass', message: 'Secret scan did not pass.' });
  if (qualityReport.localGate?.status !== 'pass') failures.push({ id: 'localGate.notPass', message: 'Local gate did not pass.' });
  if (qualityReport.profileRequiredChecks?.enabled && qualityReport.profileRequiredChecks?.status !== 'pass') {
    failures.push({ id: 'profileRequiredChecks.notPass', message: 'Profile required checks did not pass.' });
  }
  if (qualityReport.worktreeStatus?.status !== 'pass' && qualityReport.worktreeStatus?.safeToCreatePR !== true) {
    failures.push({ id: 'worktree.notReady', message: 'Worktree doctor did not report a PR-ready state.' });
  }
  if (qualityReport.versionConsistency?.status !== 'pass') failures.push({ id: 'versionConsistency.notPass', message: 'Harness version consistency did not pass.' });
  if (qualityReport.policySchema?.status === 'fail') failures.push({ id: 'policySchema.failed', message: 'Policy schema validation failed.' });
  const paths = qualityReport.changedPathsSummary || qualityReport.changedPaths || {};
  if ((paths.outOfScope || []).length) failures.push({ id: 'diff.outOfScope', message: 'Changed paths include entries outside allowedPaths.' });
  if ((paths.blocked || []).length) failures.push({ id: 'diff.blockedPath', message: 'Changed paths include blockedPaths entries.' });
  if ((paths.highRisk || []).length && qualityReport.riskLevel !== 'R3') failures.push({ id: 'risk.highRiskPath', message: 'High-risk paths must classify as R3.' });
}

const prBody = readPrBody();
const bodySections = hasRequiredBodySections(prBody);
if (!prBody) {
  const item = { id: 'prBody.missing', message: 'PR body was not available; local checks were still evaluated.' };
  if (process.env.CODEX_REQUIRE_PR_BODY === '1') failures.push(item);
  else warnings.push(item);
} else {
  for (const [key, ok] of Object.entries(bodySections)) {
    if (!ok) failures.push({ id: `prBody.${key}`, message: `PR body is missing ${key}.` });
  }
}

const actionsQualityGate = tryGithubActionsStatus();
if (actionsQualityGate.status === 'not_pass') failures.push({ id: 'actions.qualityGate', message: 'GitHub Actions quality-gate did not pass.' });
if (actionsQualityGate.status === 'manual_confirmation_required') {
  warnings.push({ id: 'actions.manualConfirmation', message: 'GitHub Actions quality-gate requires manual confirmation.' });
}

const readiness = {
  marker,
  harnessVersion: HARNESS_VERSION,
  status: failures.length ? 'fail' : 'pass',
  mergeReady: failures.length === 0,
  riskLevel: qualityReport?.riskLevel || 'unknown',
  secretScan: qualityReport?.secretScan || { status: 'unknown' },
  localGate: qualityReport?.localGate || { status: 'unknown' },
  profileRequiredChecks: qualityReport?.profileRequiredChecks || { status: 'unknown' },
  worktreeStatus: qualityReport?.worktreeStatus || { status: 'unknown' },
  versionConsistency: qualityReport?.versionConsistency || { status: 'unknown' },
  policySchema: qualityReport?.policySchema || { status: 'unknown' },
  changedPathsSummary: qualityReport?.changedPathsSummary || qualityReport?.changedPaths || { count: 0, paths: [] },
  prBody: {
    available: Boolean(prBody),
    verification: bodySections.verification,
    residualRisk: bodySections.residualRisk,
    qualityGatePass: bodySections.qualityGatePass,
  },
  actionsQualityGate,
  decisionMatrix: qualityReport?.decisionMatrix || { status: 'unknown' },
  codeAudit: qualityReport?.codeAudit || { status: 'unknown' },
  warnings,
  failures,
};

safeWriteReport(readiness);
console.log('== Codex PR readiness ==');
console.log(`status: ${readiness.status}`);
console.log(`riskLevel: ${readiness.riskLevel}`);
console.log(`quality report mergeReady: ${qualityReport?.mergeReady === true ? 'yes' : 'no'}`);
console.log(`secret scan: ${readiness.secretScan.status}`);
console.log(`local gate: ${readiness.localGate.status}`);
console.log(`profile required checks: ${readiness.profileRequiredChecks.status}`);
console.log(`worktree doctor: ${readiness.worktreeStatus.status}`);
console.log(`version consistency: ${readiness.versionConsistency.status}`);
console.log(`policy schema: ${readiness.policySchema.status}`);
console.log(`decision matrix: ${readiness.decisionMatrix.status}`);
console.log(`code audit: ${readiness.codeAudit.status}`);
console.log(`pr body available: ${readiness.prBody.available ? 'yes' : 'no'}`);
console.log(`actions quality-gate: ${readiness.actionsQualityGate.status}`);
for (const warning of warnings) console.log(`warning: ${warning.id}`);
for (const failure of failures) console.error(`failure: ${failure.id}`);
process.exit(failures.length ? 1 : 0);
