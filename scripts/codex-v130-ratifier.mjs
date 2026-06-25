#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.0

import crypto from 'node:crypto';
import { canonicalJson } from './codex-v129-goal-contract.mjs';

export function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

export function buildProgressVector(input = {}) {
  const vector = {
    authorityViolationCount: Number(input.authorityViolationCount || 0),
    safetyViolationCount: Number(input.safetyViolationCount || 0),
    regressionCount: Number(input.regressionCount || 0),
    unmetRequiredCriterionCount: Number(input.unmetRequiredCriterionCount || 0),
    baselineFailureCount: Number(input.baselineFailureCount || 0),
    confirmedFindingCount: Number(input.confirmedFindingCount || 0),
    evidenceContradictionCount: Number(input.evidenceContradictionCount || 0),
    scopeDeltaCount: Number(input.scopeDeltaCount || 0),
    validationCoverageCount: Number(input.validationCoverageCount || 0),
  };
  vector.progressDigest = sha256(canonicalJson(vector));
  return vector;
}

export function evaluateNoHumanTerminal(policy, terminal) {
  if ((policy.noHumanTerminalPolicy.forbiddenTerminals || []).includes(terminal)) {
    return { status: 'fail', reasonCodes: ['v130_human_terminal_forbidden'], terminal: 'auto_reject', safeSummaryOnly: true };
  }
  if (!(policy.noHumanTerminalPolicy.allowedTerminals || []).includes(terminal)) {
    return { status: 'fail', reasonCodes: ['v130_unknown_terminal'], terminal: 'auto_reject', safeSummaryOnly: true };
  }
  return { status: 'pass', reasonCodes: [], terminal, safeSummaryOnly: true };
}

export function ratifyExactHead(policy, input = {}) {
  const reasonCodes = [];
  const digestFields = [
    'goalDigest',
    'policyDigest',
    'requiredChecksDigest',
    'realHostReceiptDigest',
    'benchmarkReceiptDigest',
    'rollbackPlanDigest',
  ];
  const optionalDigestFields = ['specialistReceiptDigests'];
  if (!/^[a-f0-9]{40}$/.test(String(input.candidateHeadSha || ''))) reasonCodes.push('v130_candidate_head_invalid');
  if (!/^[a-f0-9]{40}$/.test(String(input.baseSha || ''))) reasonCodes.push('v130_base_sha_invalid');
  if (input.observedHeadSha !== input.candidateHeadSha) reasonCodes.push('v130_exact_head_mismatch');
  if (input.requiredChecksPass !== true) reasonCodes.push('v130_required_checks_not_pass');
  if (input.previousTrustedPolicy !== '1.2.9') reasonCodes.push('v130_previous_trusted_policy_required');
  if (input.candidatePolicySelfAuthorization === true) reasonCodes.push('v130_candidate_policy_self_authorization');
  if (input.authorityCreated === true) reasonCodes.push('v130_ratification_authority_created');
  if (!input.repositoryId) reasonCodes.push('v130_ratification_repository_id_missing');
  for (const key of digestFields) {
    if (!/^sha256:[a-f0-9]{64}$/.test(String(input[key] || ''))) reasonCodes.push(`v130_ratification_${key}_missing`);
  }
  for (const key of optionalDigestFields) {
    const value = input[key];
    if (!Array.isArray(value) || value.length === 0 || value.some((item) => !/^sha256:[a-f0-9]{64}$/.test(String(item || '')))) {
      reasonCodes.push(`v130_ratification_${key}_missing`);
    }
  }
  if (!String(input.authorityEpoch || '')) reasonCodes.push('v130_ratification_authority_epoch_missing');
  if (!String(input.revocationNonce || '')) reasonCodes.push('v130_ratification_revocation_nonce_missing');
  if (!String(input.expiresAt || '')) reasonCodes.push('v130_ratification_expiry_missing');
  if (!['ratify', 'reject'].includes(input.decision)) reasonCodes.push('v130_ratification_decision_invalid');
  const receipt = {
    schemaVersion: '1.3.0',
    repositoryId: input.repositoryId || null,
    goalDigest: input.goalDigest || null,
    baseSha: input.baseSha || '0'.repeat(40),
    candidateHeadSha: input.candidateHeadSha || '0'.repeat(40),
    observedHeadSha: input.observedHeadSha || '0'.repeat(40),
    policyDigest: input.policyDigest || null,
    requiredChecksDigest: input.requiredChecksDigest || null,
    specialistReceiptDigests: input.specialistReceiptDigests || [],
    realHostReceiptDigest: input.realHostReceiptDigest || null,
    benchmarkReceiptDigest: input.benchmarkReceiptDigest || null,
    rollbackPlanDigest: input.rollbackPlanDigest || null,
    authorityEpoch: input.authorityEpoch || null,
    revocationNonce: input.revocationNonce || null,
    expiresAt: input.expiresAt || null,
    decision: input.decision || null,
    exactHead: input.observedHeadSha === input.candidateHeadSha,
    authorityCreated: false,
  };
  receipt.receiptDigest = sha256(canonicalJson(receipt));
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes, receipt, safeSummaryOnly: true };
}

export function buildTransactionalStateReceipt(input = {}) {
  const reasonCodes = [];
  for (const key of ['goalDigest', 'candidateHeadSha', 'treeDigest']) {
    if (!input[key]) reasonCodes.push(`v130_state_receipt_missing_${key}`);
  }
  const receipt = {
    schemaVersion: '1.3.0',
    state: input.state || 'validated',
    goalDigest: input.goalDigest || 'sha256:' + '0'.repeat(64),
    candidateHeadSha: input.candidateHeadSha || '0'.repeat(40),
    treeDigest: input.treeDigest || 'sha256:' + '0'.repeat(64),
    previousReceiptDigest: input.previousReceiptDigest || null,
    authorityCreated: false,
  };
  receipt.receiptDigest = sha256(canonicalJson(receipt));
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes, receipt, safeSummaryOnly: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const policy = { noHumanTerminalPolicy: { allowedTerminals: ['completed'], forbiddenTerminals: ['manual_merge_required'] } };
  const result = evaluateNoHumanTerminal(policy, 'completed');
  console.log(canonicalJson(result));
  process.exit(result.status === 'pass' ? 0 : 1);
}
