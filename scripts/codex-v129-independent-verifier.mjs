#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.9

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function digestLike(value) {
  return /^sha256:[a-f0-9]{64}$/.test(String(value || ''));
}

export function verifyV129IndependentReview(input = {}) {
  const reasonCodes = [];
  if (!input.workerId || !input.verifierId) reasonCodes.push('worker_or_verifier_missing');
  if (input.workerId && input.workerId === input.verifierId) reasonCodes.push('same_worker_verifier');
  if (!input.workerWorkspaceDigest || !input.verifierWorkspaceDigest) reasonCodes.push('workspace_digest_missing');
  if (input.workerWorkspaceDigest && input.workerWorkspaceDigest === input.verifierWorkspaceDigest) reasonCodes.push('same_workspace');
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
    authorityCreated: false,
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const report = verifyV129IndependentReview(JSON.parse(fs.readFileSync(0, 'utf8') || '{}'));
  writeJsonReport(report);
  exitFor(report.status);
}
