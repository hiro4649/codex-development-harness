#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.6

import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { REPAIR_TYPES, fail, one, pass } from './codex-decision-capsule.mjs';

const DEFAULT_CONTRACTS = {
  body_only: { allowedFiles: ['PR body'], forbiddenFiles: ['*'], commitRequired: false, rerunRequired: false, ownerScopeRequired: true },
  artifact_index_refresh: { allowedFiles: ['safe artifact index'], forbiddenFiles: ['product', 'package', 'workflow'], commitRequired: true, rerunRequired: true, ownerScopeRequired: true },
  safe_summary_refresh: { allowedFiles: ['safe summary picker'], forbiddenFiles: ['product', 'package', 'workflow'], commitRequired: true, rerunRequired: true, ownerScopeRequired: true },
  source_harness_repair: { allowedFiles: ['AGENTS.md', 'docs/process', 'scripts/codex-*'], forbiddenFiles: ['target repos', 'product', 'package', 'workflow'], commitRequired: true, rerunRequired: true, ownerScopeRequired: true },
  target_workflow_artifact_contract: { allowedFiles: ['target harness workflow artifact contract'], forbiddenFiles: ['product', 'package', 'runtime'], commitRequired: true, rerunRequired: true, ownerScopeRequired: true },
  target_harness_refresh: { allowedFiles: ['target harness managed files'], forbiddenFiles: ['product', 'package', 'runtime'], commitRequired: true, rerunRequired: true, ownerScopeRequired: true },
  product_scope_required: { allowedFiles: [], forbiddenFiles: ['harness rollout'], commitRequired: false, rerunRequired: false, ownerScopeRequired: true },
  external_confirmation_required: { allowedFiles: [], forbiddenFiles: ['code'], commitRequired: false, rerunRequired: false, ownerScopeRequired: true },
  no_safe_route: { allowedFiles: [], forbiddenFiles: ['all'], commitRequired: false, rerunRequired: false, ownerScopeRequired: true },
  terminal_block: { allowedFiles: [], forbiddenFiles: ['all'], commitRequired: false, rerunRequired: false, ownerScopeRequired: true },
};

export function compileFailureContract(input = {}) {
  let repairType = input.repairType || 'external_confirmation_required';
  if (input.productFailure === true) repairType = 'product_scope_required';
  if (input.safeDetailUnavailableTerminal === true) repairType = 'terminal_block';
  if (input.unknownFailure === true) repairType = 'no_safe_route';
  if (!REPAIR_TYPES.has(repairType)) repairType = 'no_safe_route';
  const base = DEFAULT_CONTRACTS[repairType];
  return {
    repairType,
    allowedFiles: input.allowedFiles || base.allowedFiles,
    forbiddenFiles: input.forbiddenFiles || base.forbiddenFiles,
    commitRequired: input.commitRequired ?? base.commitRequired,
    rerunRequired: input.rerunRequired ?? base.rerunRequired,
    ownerScopeRequired: input.ownerScopeRequired ?? base.ownerScopeRequired,
    safeNextAction: one(input.safeNextAction, repairType === 'terminal_block' ? 'owner_decision_or_state_delta' : 'owner_scope_required'),
    rawLogsNeeded: false,
    productRepairAllowed: false,
    safeSummaryOnly: true,
  };
}

export function validateFailureContract(input = {}) {
  const contract = input.repairType ? compileFailureContract(input) : input;
  const reasonCodes = [];
  if (!REPAIR_TYPES.has(contract.repairType)) reasonCodes.push('repair_type_invalid');
  if (!contract.safeNextAction || Array.isArray(contract.safeNextAction)) reasonCodes.push('safe_next_action_count_invalid');
  if (contract.rawLogsNeeded === true) reasonCodes.push('raw_logs_needed_forbidden');
  if (contract.productRepairAllowed === true) reasonCodes.push('product_repair_forbidden');
  if (input.sameFailureAfterOneRepair === true) reasonCodes.push('same_failure_after_one_repair');
  return reasonCodes.length ? fail(reasonCodes, { contract }) : pass({ contract });
}

export function buildRepairPlanSafe(contract = compileFailureContract()) {
  return {
    repairType: contract.repairType,
    targetFiles: contract.allowedFiles,
    allowedOperations: contract.commitRequired ? ['edit_allowed_harness_files', 'commit', 'push'] : ['metadata_only'],
    forbiddenOperations: contract.forbiddenFiles,
    requiresCommit: contract.commitRequired,
    requiresRemoteRerun: contract.rerunRequired,
    ownerScopeRequired: contract.ownerScopeRequired,
    safeNextAction: contract.safeNextAction,
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const contract = compileFailureContract({ repairType: 'source_harness_repair' });
  const report = {
    failureContractCompilerStatus: validateFailureContract(contract),
    repairPlanSafeSchemaStatus: pass({ repairPlan: buildRepairPlanSafe(contract) }),
    safeSummaryOnly: true,
  };
  report.status = Object.values(report).some((item) => item?.status === 'fail') ? 'fail' : 'pass';
  writeJsonReport(report, 'CODEX_V116_FAILURE_CONTRACT_REPORT');
  exitFor(report);
}
