#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.0
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}
function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}
function lines(text) {
  return String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
function countRev(range) {
  const out = git(['rev-list', '--count', range]).trim();
  const n = Number(out);
  return Number.isFinite(n) ? n : 0;
}
function changedFiles(args) {
  return lines(git(args)).map(normalizePath).sort();
}
function shortSha(ref) {
  return git(['rev-parse', '--short', ref]).trim();
}
function fullSha(ref) {
  return git(['rev-parse', ref]).trim();
}
function writeJsonIfRequested(report) {
  const target = process.env.CODEX_WORKTREE_DOCTOR_REPORT_PATH || '';
  if (!target) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

const branch = git(['branch', '--show-current']).trim() || '(detached)';
const hasOriginMain = Boolean(git(['rev-parse', '--verify', 'origin/main']).trim());
const head = fullSha('HEAD');
const originMain = hasOriginMain ? fullSha('origin/main') : '';
const unstaged = changedFiles(['diff', '--name-only']);
const staged = changedFiles(['diff', '--cached', '--name-only']);
const untracked = changedFiles(['ls-files', '--others', '--exclude-standard']);
const ahead = hasOriginMain ? countRev('origin/main..HEAD') : 0;
const behind = hasOriginMain ? countRev('HEAD..origin/main') : 0;
const dirty = unstaged.length > 0 || staged.length > 0 || untracked.length > 0;
const isMain = branch === 'main';
const hasUntrackedFiles = untracked.length > 0;
const hasStagedChanges = staged.length > 0;
const hasUnstagedChanges = unstaged.length > 0;
const cleanClone =
  isMain &&
  !dirty &&
  hasOriginMain &&
  ahead === 0 &&
  behind === 0 &&
  head === originMain;
const safeToDevelop = !isMain && !hasStagedChanges && !hasUnstagedChanges;
const safeToCreatePR = !isMain && !dirty && ahead > 0;
const cleanMainRequired = process.env.CODEX_REQUIRE_CLEAN_MAIN === '1';
const cleanPrBranchRequired = process.env.CODEX_REQUIRE_CLEAN_PR_BRANCH === '1';
const cleanWorktreeRequired = process.env.CODEX_REQUIRE_CLEAN_WORKTREE === '1';

const warnings = [];
if (!hasOriginMain) warnings.push({ id: 'originMain.missing', message: 'origin/main was not available.' });
if (branch === 'main' && !cleanClone) warnings.push({ id: 'main.directWork', message: 'main is not in clean clone state.' });
if (dirty) warnings.push({ id: 'worktree.dirty', message: 'Worktree has staged, unstaged, or untracked changes.' });
if (ahead > 0) warnings.push({ id: 'commits.localOnly', message: 'HEAD has commits not in origin/main.' });
if (behind > 0) warnings.push({ id: 'commits.remoteOnly', message: 'origin/main has commits not in HEAD.' });
const recommendedAction = cleanClone
  ? 'create a feature branch before editing'
  : (safeToCreatePR
    ? 'open or update a pull request'
    : (dirty
      ? 'review local changes before continuing'
      : (behind > 0
        ? 'update from origin/main before continuing'
        : 'continue with care')));

const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v0.7.0',
  harnessVersion: '0.7.0',
  status: warnings.length ? 'warning' : 'pass',
  currentBranch: branch,
  branch,
  isMain,
  isDirty: dirty,
  hasUntrackedFiles,
  hasStagedChanges,
  hasUnstagedChanges,
  localOnlyCommits: ahead,
  remoteOnlyCommits: behind,
  head: shortSha('HEAD'),
  originMain: hasOriginMain ? shortSha('origin/main') : null,
  headEqualsOriginMain: hasOriginMain && head === originMain,
  headMatchesOriginMain: hasOriginMain && head === originMain,
  cleanClone,
  safeToDevelop,
  safeToCreatePR,
  cleanMainRequired,
  cleanPrBranchRequired,
  cleanWorktreeRequired,
  prBranchSafeSummary: branch !== 'main' && !dirty,
  recommendedAction,
  counts: {
    ahead,
    behind,
    unstaged: unstaged.length,
    staged: staged.length,
    untracked: untracked.length,
  },
  files: {
    unstaged,
    staged,
    untracked,
  },
  warnings,
};

writeJsonIfRequested(report);

if (process.env.CODEX_WORKTREE_DOCTOR_JSON === '1') {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('== Codex worktree doctor ==');
  console.log(`branch: ${report.branch}`);
  console.log(`is main: ${report.isMain ? 'yes' : 'no'}`);
  console.log(`dirty: ${report.isDirty ? 'yes' : 'no'}`);
  console.log(`head: ${report.head}`);
  console.log(`origin/main: ${report.originMain || 'unavailable'}`);
  console.log(`head matches origin/main: ${report.headMatchesOriginMain ? 'yes' : 'no'}`);
  console.log(`clean clone: ${report.cleanClone ? 'yes' : 'no'}`);
  console.log(`pr branch safe summary: ${report.prBranchSafeSummary ? 'yes' : 'no'}`);
  console.log(`local-only commits: ${ahead}`);
  console.log(`remote-only commits: ${behind}`);
  console.log(`unstaged files: ${unstaged.length}`);
  console.log(`staged files: ${staged.length}`);
  console.log(`untracked files: ${untracked.length}`);
  console.log(`safe to develop: ${report.safeToDevelop ? 'yes' : 'no'}`);
  console.log(`safe to create PR: ${report.safeToCreatePR ? 'yes' : 'no'}`);
  console.log(`recommended action: ${report.recommendedAction}`);
  for (const warning of warnings) console.log(`warning: ${warning.id}`);
}

if (cleanMainRequired && !cleanClone) process.exit(1);
if (cleanPrBranchRequired && (isMain || dirty)) process.exit(1);
if (cleanWorktreeRequired && dirty) process.exit(1);
