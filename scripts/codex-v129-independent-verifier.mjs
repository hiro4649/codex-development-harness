#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { canonicalJson, computeGoalDigest, sha256 } from './codex-v129-goal-contract.mjs';
import { validateInvocationReceipt } from './codex-v129-host-dispatch.mjs';

function digestLike(value) {
  return /^sha256:[a-f0-9]{64}$/.test(String(value || ''));
}

function digestValue(value) {
  return `sha256:${sha256(canonicalJson(value))}`;
}

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 5000, maxBuffer: 16384, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export function computeWorkspaceTreeDigest(root) {
  const treeSha = git(root, ['rev-parse', 'HEAD^{tree}']);
  return treeSha ? digestValue({ treeSha }) : null;
}

function gitHead(root) {
  return git(root, ['rev-parse', 'HEAD']);
}

function gitTree(root) {
  return git(root, ['rev-parse', 'HEAD^{tree}']);
}

function gitStatus(root) {
  const status = git(root, ['status', '--porcelain']);
  return status === null ? null : status;
}

function changedFiles(root, baseSha, headSha) {
  if (!baseSha || !headSha) return [];
  const output = git(root, ['diff', '--name-only', `${baseSha}..${headSha}`]);
  return output ? output.split(/\r?\n/).filter(Boolean).map((item) => item.replace(/\\/g, '/')).sort() : [];
}

function truthOwnerDigest(root, truthOwnerRefs = []) {
  const entries = [];
  for (const ref of truthOwnerRefs) {
    const rel = String(ref.path || '').replace(/\\/g, '/');
    const full = path.join(root, rel);
    if (!rel || rel.includes('..') || path.isAbsolute(rel) || !fs.existsSync(full)) return null;
    entries.push({ path: rel, digest: `sha256:${sha256(fs.readFileSync(full))}` });
  }
  return digestValue(entries);
}

function pathsWithinScope(files = [], allowed = [], forbidden = []) {
  const allowedSet = new Set(allowed.map((item) => String(item).replace(/\\/g, '/')));
  const forbiddenSet = new Set(forbidden.map((item) => String(item).replace(/\\/g, '/')));
  return files.every((file) => allowedSet.has(file) && !forbiddenSet.has(file));
}

export function verifyV129IndependentReview(input = {}) {
  const reasonCodes = [];
  const goal = input.goalContract || {};
  const recomputed = {
    workerWorkspaceDigest: input.workerWorkspacePath ? computeWorkspaceTreeDigest(input.workerWorkspacePath) : null,
    verifierWorkspaceDigest: input.verifierWorkspacePath ? computeWorkspaceTreeDigest(input.verifierWorkspacePath) : null,
    workerCandidateHeadSha: input.workerWorkspacePath ? gitHead(input.workerWorkspacePath) : null,
    verifierCandidateHeadSha: input.verifierWorkspacePath ? gitHead(input.verifierWorkspacePath) : null,
    workerTreeSha: input.workerWorkspacePath ? gitTree(input.workerWorkspacePath) : null,
    verifierTreeSha: input.verifierWorkspacePath ? gitTree(input.verifierWorkspacePath) : null,
    workerStatusPorcelain: input.workerWorkspacePath ? gitStatus(input.workerWorkspacePath) : null,
    verifierStatusPorcelain: input.verifierWorkspacePath ? gitStatus(input.verifierWorkspacePath) : null,
    changedFiles: input.verifierWorkspacePath ? changedFiles(input.verifierWorkspacePath, goal.binding?.baseSha, input.candidateHeadSha) : [],
    truthOwnerDigest: input.verifierWorkspacePath ? truthOwnerDigest(input.verifierWorkspacePath, goal.truthOwnerRefs || []) : null,
    goalDigest: input.goalContract ? computeGoalDigest(goal) : null,
    workerReceiptDigest: input.workerReceipt ? digestValue(input.workerReceipt) : null,
    workerReceiptValidation: input.workerReceipt ? validateInvocationReceipt(input.workerReceipt, {
      request: input.dispatchRequest,
      hostAdapterDigest: input.workerReceipt.hostAdapterDigest,
    }) : null,
    evidenceDigest: input.evidence ? digestValue(input.evidence) : null,
  };
  if (!input.workerId || !input.verifierId) reasonCodes.push('worker_or_verifier_missing');
  if (input.workerId && input.workerId === input.verifierId) reasonCodes.push('same_worker_verifier');
  if (!input.dispatchRequest || typeof input.dispatchRequest !== 'object') reasonCodes.push('dispatch_request_missing');
  if (!input.workerWorkspacePath || !input.verifierWorkspacePath || !recomputed.workerWorkspaceDigest || !recomputed.verifierWorkspaceDigest) reasonCodes.push('workspace_digest_missing');
  if (!recomputed.workerCandidateHeadSha || !recomputed.verifierCandidateHeadSha || !recomputed.workerTreeSha || !recomputed.verifierTreeSha) reasonCodes.push('git_workspace_required');
  if (input.workerWorkspacePath && input.verifierWorkspacePath && path.resolve(input.workerWorkspacePath) === path.resolve(input.verifierWorkspacePath)) reasonCodes.push('same_workspace_path');
  if (input.workerWorkspacePath && input.verifierWorkspacePath && path.resolve(input.workerWorkspacePath) !== path.resolve(input.verifierWorkspacePath) && recomputed.workerCandidateHeadSha !== recomputed.verifierCandidateHeadSha) reasonCodes.push('worker_verifier_head_mismatch');
  if (input.workerWorkspaceDigest && input.workerWorkspaceDigest !== recomputed.workerWorkspaceDigest) reasonCodes.push('worker_workspace_digest_mismatch');
  if (input.verifierWorkspaceDigest && input.verifierWorkspaceDigest !== recomputed.verifierWorkspaceDigest) reasonCodes.push('verifier_workspace_digest_mismatch');
  if (input.candidateHeadSha && (input.candidateHeadSha !== recomputed.workerCandidateHeadSha || input.candidateHeadSha !== recomputed.verifierCandidateHeadSha)) reasonCodes.push('candidate_head_recompute_mismatch');
  if (recomputed.workerStatusPorcelain === null || recomputed.verifierStatusPorcelain === null) reasonCodes.push('git_status_unavailable');
  if (recomputed.workerStatusPorcelain || recomputed.verifierStatusPorcelain) reasonCodes.push('git_worktree_dirty');
  if (!pathsWithinScope(recomputed.changedFiles, goal.allowedFiles || [], goal.forbiddenFiles || [])) reasonCodes.push('changed_file_scope_mismatch');
  if (input.truthOwnerDigest && input.truthOwnerDigest !== recomputed.truthOwnerDigest) reasonCodes.push('truth_owner_digest_recompute_mismatch');
  if (!digestLike(recomputed.truthOwnerDigest)) reasonCodes.push('truth_owner_digest_recompute_missing');
  if (input.goalDigest && input.goalDigest !== recomputed.goalDigest) reasonCodes.push('goal_digest_recompute_mismatch');
  if (input.workerReceiptDigest && input.workerReceiptDigest !== recomputed.workerReceiptDigest) reasonCodes.push('worker_receipt_digest_recompute_mismatch');
  if (recomputed.workerReceiptValidation?.status !== 'pass') reasonCodes.push('worker_receipt_validation_failed');
  if (input.evidenceDigest && input.evidenceDigest !== recomputed.evidenceDigest) reasonCodes.push('evidence_digest_recompute_mismatch');
  for (const key of ['goalDigest', 'candidateHeadSha', 'routeDecisionDigest', 'workerOutputDigest']) {
    if (!input.worker?.[key] || !input.verifier?.[key] || input.worker[key] !== input.verifier[key]) reasonCodes.push(`${key}_mismatch`);
  }
  if (!digestLike(input.worker?.goalDigest)) reasonCodes.push('goal_digest_invalid');
  if (!/^[a-f0-9]{40}$/.test(String(input.worker?.candidateHeadSha || ''))) reasonCodes.push('candidate_head_invalid');
  const criteria = Array.isArray(input.criteriaResults) ? input.criteriaResults : [];
  if (!criteria.length) reasonCodes.push('criteria_results_missing');
  for (const criterion of criteria) {
    if (criterion.required !== false && criterion.status !== 'pass') reasonCodes.push('required_criterion_not_pass');
    if (criterion.required !== false && !digestLike(criterion.evidenceDigest)) reasonCodes.push('criterion_evidence_digest_missing');
  }
  if (input.verifierMergeAuthority === true) reasonCodes.push('verifier_merge_authority_forbidden');
  return {
    schemaVersion: '1.2.9',
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    recomputed,
    authorityCreated: false,
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const report = verifyV129IndependentReview(JSON.parse(fs.readFileSync(0, 'utf8') || '{}'));
  writeJsonReport(report);
  exitFor(report.status);
}
