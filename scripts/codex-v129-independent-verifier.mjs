#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { canonicalJson, computeGoalDigest, sha256 } from './codex-v129-goal-contract.mjs';

function digestLike(value) {
  return /^sha256:[a-f0-9]{64}$/.test(String(value || ''));
}

function digestValue(value) {
  return `sha256:${sha256(canonicalJson(value))}`;
}

function listFiles(root) {
  const output = [];
  if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) return output;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...listFiles(full));
    else if (entry.isFile()) output.push(full);
  }
  return output.sort();
}

export function computeWorkspaceTreeDigest(root) {
  const files = listFiles(root).map((file) => ({
    path: path.relative(root, file).replace(/\\/g, '/'),
    digest: `sha256:${sha256(fs.readFileSync(file))}`,
  }));
  return digestValue(files);
}

function readCandidateHead(root) {
  const file = path.join(root || '', 'CANDIDATE_HEAD');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : null;
}

export function verifyV129IndependentReview(input = {}) {
  const reasonCodes = [];
  const recomputed = {
    workerWorkspaceDigest: input.workerWorkspacePath ? computeWorkspaceTreeDigest(input.workerWorkspacePath) : null,
    verifierWorkspaceDigest: input.verifierWorkspacePath ? computeWorkspaceTreeDigest(input.verifierWorkspacePath) : null,
    workerCandidateHeadSha: input.workerWorkspacePath ? readCandidateHead(input.workerWorkspacePath) : null,
    verifierCandidateHeadSha: input.verifierWorkspacePath ? readCandidateHead(input.verifierWorkspacePath) : null,
    goalDigest: input.goalContract ? computeGoalDigest(input.goalContract) : null,
    workerReceiptDigest: input.workerReceipt ? digestValue(input.workerReceipt) : null,
    evidenceDigest: input.evidence ? digestValue(input.evidence) : null,
  };
  if (!input.workerId || !input.verifierId) reasonCodes.push('worker_or_verifier_missing');
  if (input.workerId && input.workerId === input.verifierId) reasonCodes.push('same_worker_verifier');
  if (!input.workerWorkspacePath || !input.verifierWorkspacePath || !recomputed.workerWorkspaceDigest || !recomputed.verifierWorkspaceDigest) reasonCodes.push('workspace_digest_missing');
  if (input.workerWorkspacePath && input.verifierWorkspacePath && path.resolve(input.workerWorkspacePath) === path.resolve(input.verifierWorkspacePath)) reasonCodes.push('same_workspace_path');
  if (recomputed.workerWorkspaceDigest && recomputed.verifierWorkspaceDigest && recomputed.workerWorkspaceDigest === recomputed.verifierWorkspaceDigest) reasonCodes.push('same_workspace');
  if (input.workerWorkspaceDigest && input.workerWorkspaceDigest !== recomputed.workerWorkspaceDigest) reasonCodes.push('worker_workspace_digest_mismatch');
  if (input.verifierWorkspaceDigest && input.verifierWorkspaceDigest !== recomputed.verifierWorkspaceDigest) reasonCodes.push('verifier_workspace_digest_mismatch');
  if (input.candidateHeadSha && (input.candidateHeadSha !== recomputed.workerCandidateHeadSha || input.candidateHeadSha !== recomputed.verifierCandidateHeadSha)) reasonCodes.push('candidate_head_recompute_mismatch');
  if (input.goalDigest && input.goalDigest !== recomputed.goalDigest) reasonCodes.push('goal_digest_recompute_mismatch');
  if (input.workerReceiptDigest && input.workerReceiptDigest !== recomputed.workerReceiptDigest) reasonCodes.push('worker_receipt_digest_recompute_mismatch');
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
