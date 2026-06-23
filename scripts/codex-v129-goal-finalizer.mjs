#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, computeGoalDigest, sha256 } from './codex-v129-goal-contract.mjs';

function digestLike(value) {
  return /^sha256:[a-f0-9]{64}$/.test(String(value || ''));
}

function digestValue(value) {
  return `sha256:${sha256(canonicalJson(value))}`;
}

function criteriaIds(criteria = []) {
  return criteria.map((criterion) => criterion.id);
}

function sameArray(a = [], b = []) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function buildGoalCompletionProof(input = {}) {
  const goal = input.goalContract || {};
  const goalDigest = computeGoalDigest(goal);
  const criteria = Array.isArray(input.criteriaResults) ? input.criteriaResults : [];
  const goalCriteria = Array.isArray(goal.acceptanceCriteria) ? goal.acceptanceCriteria : [];
  const workerReceiptDigest = input.workerReceipt ? digestValue(input.workerReceipt) : input.workerReceiptDigest;
  const verifierReceiptDigest = input.verifierReceipt ? digestValue(input.verifierReceipt) : input.verifierReceiptDigest;
  const evidenceDigest = input.evidence ? digestValue(input.evidence) : input.evidenceDigest;
  const truthOwnerDigest = digestValue(goal.truthOwnerRefs || []);
  const headBindings = Array.isArray(input.headBindings) ? input.headBindings : [];
  const sameHead = headBindings.length > 0 && headBindings.every((head) => head && head === input.candidateHeadSha);
  const tokenBudgetStatus = {
    status: Number(input.tokenBudget?.usedBytes || 0) <= Number(input.tokenBudget?.maxBytes || 0) ? 'pass' : 'fail',
    usedBytes: Number(input.tokenBudget?.usedBytes || 0),
    maxBytes: Number(input.tokenBudget?.maxBytes || 0),
  };
  const unresolvedCriterionCount = criteria.filter((criterion) => criterion.required !== false && criterion.status !== 'pass').length;
  const proof = {
    schemaVersion: '1.2.9',
    goalDigest,
    candidateHeadSha: input.candidateHeadSha,
    baseSha: goal.binding?.baseSha || input.baseSha,
    scopeDigest: goal.binding?.scopeDigest || null,
    truthOwnerDigest,
    routeDecisionDigest: input.routeDecisionDigest,
    workerReceiptDigest,
    verifierReceiptDigest,
    evidenceDigest,
    criteriaResults: criteria,
    unresolvedCriterionCount,
    repairIterationCount: Number(input.repairIterationCount || 0),
    sameBlockerCount: Number(input.sameBlockerCount || 0),
    tokenBudgetStatus,
    sameHead,
    completionState: 'blocked',
    safeNextAction: 'blocked_repair_or_stop',
    authorityCreated: false,
    safeSummaryOnly: true,
  };
  const reasons = [];
  if (input.goalDigest && input.goalDigest !== goalDigest) reasons.push('goal_digest_mismatch');
  if (!sameArray(criteriaIds(goalCriteria), criteriaIds(criteria))) reasons.push('acceptance_criteria_id_or_count_mismatch');
  for (const key of ['goalDigest', 'scopeDigest', 'truthOwnerDigest', 'routeDecisionDigest', 'workerReceiptDigest', 'verifierReceiptDigest', 'evidenceDigest']) {
    if (!digestLike(proof[key])) reasons.push(`${key}_invalid`);
  }
  if (input.truthOwnerDigest && input.truthOwnerDigest !== truthOwnerDigest) reasons.push('truth_owner_digest_mismatch');
  if (input.scopeDigest && input.scopeDigest !== proof.scopeDigest) reasons.push('scope_digest_mismatch');
  if (input.workerReceiptDigest && input.workerReceiptDigest !== workerReceiptDigest) reasons.push('worker_receipt_digest_mismatch');
  if (input.verifierReceiptDigest && input.verifierReceiptDigest !== verifierReceiptDigest) reasons.push('verifier_receipt_digest_mismatch');
  if (input.evidenceDigest && input.evidenceDigest !== evidenceDigest) reasons.push('evidence_digest_mismatch');
  if (!/^[a-f0-9]{40}$/.test(String(proof.candidateHeadSha || ''))) reasons.push('candidate_head_invalid');
  if (!/^[a-f0-9]{40}$/.test(String(proof.baseSha || ''))) reasons.push('base_sha_invalid');
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
  proof.proofDigest = digestValue({ ...proof, proofDigest: undefined });
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
