#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.9

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, sha256 } from './codex-v129-goal-contract.mjs';

function digestLike(value) {
  return /^sha256:[a-f0-9]{64}$/.test(String(value || ''));
}

export function buildGoalCompletionProof(input = {}) {
  const criteria = Array.isArray(input.criteriaResults) ? input.criteriaResults : [];
  const unresolvedCriterionCount = criteria.filter((criterion) => criterion.required !== false && criterion.status !== 'pass').length;
  const proof = {
    schemaVersion: '1.2.9',
    goalDigest: input.goalDigest,
    candidateHeadSha: input.candidateHeadSha,
    baseSha: input.baseSha,
    scopeDigest: input.scopeDigest,
    truthOwnerDigestMatch: input.truthOwnerDigestMatch === true,
    routeDecisionDigest: input.routeDecisionDigest,
    workerReceiptDigest: input.workerReceiptDigest,
    verifierReceiptDigest: input.verifierReceiptDigest,
    criteriaResults: criteria,
    unresolvedCriterionCount,
    repairIterationCount: Number(input.repairIterationCount || 0),
    sameBlockerCount: Number(input.sameBlockerCount || 0),
    tokenBudgetStatus: input.tokenBudgetStatus || { status: 'fail' },
    sameHead: input.sameHead === true,
    completionState: 'blocked',
    safeNextAction: 'blocked_repair_or_stop',
    authorityCreated: false,
    safeSummaryOnly: true,
  };
  const reasons = [];
  for (const key of ['goalDigest', 'scopeDigest', 'routeDecisionDigest', 'workerReceiptDigest', 'verifierReceiptDigest']) {
    if (!digestLike(proof[key])) reasons.push(`${key}_invalid`);
  }
  if (!/^[a-f0-9]{40}$/.test(String(proof.candidateHeadSha || ''))) reasons.push('candidate_head_invalid');
  if (!/^[a-f0-9]{40}$/.test(String(proof.baseSha || ''))) reasons.push('base_sha_invalid');
  if (!proof.truthOwnerDigestMatch) reasons.push('truth_owner_digest_mismatch');
  if (proof.unresolvedCriterionCount !== 0) reasons.push('unresolved_criteria');
  if (proof.tokenBudgetStatus.status !== 'pass') reasons.push('token_budget_failed');
  if (!proof.sameHead) reasons.push('same_head_missing');
  if (proof.repairIterationCount > 1) reasons.push('repair_iteration_overflow');
  if (proof.sameBlockerCount > 1) reasons.push('same_blocker_repeat');
  for (const criterion of criteria) {
    if (criterion.required !== false && !digestLike(criterion.evidenceDigest)) reasons.push('criterion_evidence_digest_missing');
  }
  proof.completionState = reasons.length ? 'blocked' : 'completed';
  proof.safeNextAction = reasons.length ? 'blocked_repair_or_stop' : 'handoff_to_final_decision_kernel';
  proof.proofDigest = `sha256:${sha256(canonicalJson({ ...proof, proofDigest: undefined }))}`;
  return {
    schemaVersion: '1.2.9',
    goalCompletionProof: proof,
    status: reasons.length ? 'fail' : 'pass',
    reasonCodes: reasons,
    mergeAllowedComputed: false,
    finalDecisionBypassAttempted: false,
    authorityCreated: false,
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const report = buildGoalCompletionProof(JSON.parse(fs.readFileSync(0, 'utf8') || '{}'));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.status === 'pass' ? 0 : 1);
}
