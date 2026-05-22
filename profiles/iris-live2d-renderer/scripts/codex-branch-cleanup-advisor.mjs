#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.0
import { execFileSync } from 'node:child_process';
import process from 'node:process';

function git(args) {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; }
}
function count(range) {
  const value = Number(git(['rev-list', '--count', range]).trim());
  return Number.isFinite(value) ? value : 0;
}

const current = git(['branch', '--show-current']).trim();
const merged = new Set(git(['branch', '--merged', 'origin/main']).split(/\r?\n/).map((line) => line.replace(/^\*?\s*/, '').trim()).filter(Boolean));
const all = git(['for-each-ref', '--format=%(refname:short)', 'refs/heads']).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const candidates = [];
const details = [];
const protectedBranches = new Set(['main', 'master', current]);
for (const branch of all) {
  const localOnlyCommits = count(`origin/main..${branch}`);
  const remoteOnlyCommits = count(`${branch}..origin/main`);
  const safeToDelete = !protectedBranches.has(branch) && merged.has(branch) && localOnlyCommits === 0;
  const detail = {
    branch,
    local: true,
    remote: false,
    mergedInto: merged.has(branch) ? 'origin/main' : 'not merged',
    localOnlyCommits,
    remoteOnlyCommits,
    safeToDelete,
    reason: safeToDelete ? 'merged into origin/main with no local-only commits' : 'not a safe cleanup candidate',
  };
  details.push(detail);
  if (protectedBranches.has(branch)) continue;
  if (!merged.has(branch)) continue;
  if (localOnlyCommits > 0) continue;
  candidates.push(branch);
}

console.log('== Codex branch cleanup advisor ==');
console.log(`currentBranch: ${current || '(detached)'}`);
console.log(`deleteCandidates: ${candidates.length}`);
for (const item of details.filter((entry) => entry.safeToDelete)) {
  console.log(`candidate: ${item.branch} local=${item.local ? 'yes' : 'no'} remote=${item.remote ? 'yes' : 'no'} mergedInto=${item.mergedInto} localOnlyCommits=${item.localOnlyCommits} remoteOnlyCommits=${item.remoteOnlyCommits} safeToDelete=${item.safeToDelete ? 'true' : 'false'} reason=${item.reason}`);
}
console.log('recommendedAction: review candidates manually; do not force delete');
process.exit(0);
