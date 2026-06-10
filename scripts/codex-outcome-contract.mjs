#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.7

import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';

export const OUTCOME_CONTRACT_VERSION = '1';
export const REQUIRED_OUTCOME_FIELDS = [
  'outcomeContractVersion',
  'goalId',
  'goalSummary',
  'exitCriteria',
  'maxRepairLoops',
  'verifierRequired',
  'ownerMergeInstructionRequired',
];

export function pass(extra = {}) {
  return { status: 'pass', reasonCodes: [], safeSummaryOnly: true, ...extra };
}

export function fail(reasonCodes, extra = {}) {
  return {
    status: 'fail',
    reasonCodes: [...new Set((Array.isArray(reasonCodes) ? reasonCodes : [reasonCodes]).filter(Boolean))].slice(0, 4),
    safeSummaryOnly: true,
    ...extra,
  };
}

export function buildDefaultOutcomeContract(input = {}) {
  return {
    outcomeContractVersion: OUTCOME_CONTRACT_VERSION,
    goalId: input.goalId || 'source-harness-v117-body',
    goalSummary: input.goalSummary || 'Implement Source HARNESS v1.1.7 body only',
    exitCriteria: input.exitCriteria || [
      'source_only_files',
      'v113_to_v117_self_tests_pass',
      'decision_capsule_pass',
      'verifier_capsule_pass',
      'artifact_consistency_pass',
      'token_budget_pass',
      'same_head_remote_gate_pass',
      'owner_merge_instruction_required',
    ],
    maxRepairLoops: input.maxRepairLoops ?? 1,
    verifierRequired: input.verifierRequired ?? true,
    ownerMergeInstructionRequired: input.ownerMergeInstructionRequired ?? true,
  };
}

export function validateOutcomeContract(input = {}) {
  const contract = input.outcomeContractVersion ? input : buildDefaultOutcomeContract(input);
  const reasonCodes = [];
  for (const field of REQUIRED_OUTCOME_FIELDS) {
    if (contract[field] === undefined || contract[field] === null || contract[field] === '') {
      reasonCodes.push('outcome_required_field_missing');
      break;
    }
  }
  const summary = String(contract.goalSummary || '').trim();
  const goalId = String(contract.goalId || '').trim();
  const exitCriteria = Array.isArray(contract.exitCriteria) ? contract.exitCriteria.filter(Boolean) : [];
  const vagueGoal = /\b(all|everything|anything|whatever|nice|good|better|improve|fix it|as needed)\b/i.test(summary);
  const unboundedGoal = !Number.isFinite(Number(contract.maxRepairLoops)) || Number(contract.maxRepairLoops) < 0 || Number(contract.maxRepairLoops) > 1;
  if (contract.outcomeContractVersion !== OUTCOME_CONTRACT_VERSION) reasonCodes.push('outcome_contract_version_mismatch');
  if (!goalId || goalId.length > 96) reasonCodes.push('outcome_goal_id_invalid');
  if (!summary || summary.length > 160 || vagueGoal) reasonCodes.push('outcome_goal_not_verifiable');
  if (!exitCriteria.length) reasonCodes.push('outcome_exit_criteria_missing');
  if (!exitCriteria.includes('owner_merge_instruction_required') || contract.ownerMergeInstructionRequired !== true) {
    reasonCodes.push('outcome_owner_merge_instruction_required');
  }
  if (contract.verifierRequired !== true) reasonCodes.push('outcome_verifier_required');
  if (unboundedGoal) reasonCodes.push('outcome_unbounded_goal');
  return reasonCodes.length ? fail(reasonCodes, { outcomeContract: contract }) : pass({ outcomeContract: contract });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = { outcomeContractStatus: validateOutcomeContract(), safeSummaryOnly: true };
  report.status = report.outcomeContractStatus.status;
  writeJsonReport(report, 'CODEX_OUTCOME_CONTRACT_REPORT');
  if (!process.env.CODEX_OUTCOME_CONTRACT_REPORT && process.env.CODEX_QUALITY_REPORT !== 'json') {
    console.log(`outcomeContractStatus: ${report.outcomeContractStatus.status}`);
  }
  exitFor(report);
}
