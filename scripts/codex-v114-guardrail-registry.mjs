#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.4

import { writeJsonReport, exitFor, scanObjectForUnsafe } from './codex-v080-lib.mjs';

export const GUARDRAIL_OPERATIONS = [
  'raw_log_command',
  'secret_read',
  'wallet_rpc_deploy_access',
  'package_lockfile_scope_violation',
  'workflow_scope_violation',
  'runtime_scope_violation',
  'eight_session_operation',
  'broad_delete',
  'unscoped_rerun',
  'self_approval',
  'self_merge',
  'github_approval_review',
];

const SAFE_NEXT_ACTIONS = {
  raw_log_command: 'use_safe_artifact_metadata_only',
  secret_read: 'stop_and_report_secret_boundary',
  wallet_rpc_deploy_access: 'stop_and_require_separate_owner_scope',
  package_lockfile_scope_violation: 'remove_package_scope_from_harness_pr',
  workflow_scope_violation: 'stop_and_require_explicit_workflow_scope',
  runtime_scope_violation: 'stop_and_require_runtime_owner_scope',
  eight_session_operation: 'use_single_session_or_owner_exception',
  broad_delete: 'preserve_then_request_owner_cleanup_scope',
  unscoped_rerun: 'wait_for_state_delta_or_owner_rerun_scope',
  self_approval: 'do_not_submit_approval_review',
  self_merge: 'wait_for_explicit_owner_merge_instruction',
  github_approval_review: 'do_not_submit_github_approval_review',
};

function status(value, reasonCode, extra = {}) {
  return {
    status: value,
    allowed: value === 'pass',
    reasonCode,
    safeNextAction: SAFE_NEXT_ACTIONS[reasonCode] || 'stop_and_report_guardrail_block',
    rawOutputPrinted: false,
    safeSummaryOnly: true,
    ...extra,
  };
}

export function classifyGuardrailOperation(operation, input = {}) {
  const op = String(operation || input.operation || 'unknown_operation');
  if (GUARDRAIL_OPERATIONS.includes(op)) return status('fail', op, { operation: op });
  if (input.rawOutputPrinted === true) return status('fail', 'raw_output_printed', { operation: op });
  return status('pass', 'operation_allowed', { operation: op });
}

export function validateHookGuardrailRegistry(input = {}) {
  const operations = input.operations || GUARDRAIL_OPERATIONS;
  const findings = operations.map((operation) => classifyGuardrailOperation(operation));
  const allBlocked = findings.every((item) => item.status === 'fail' && item.allowed === false && item.rawOutputPrinted === false);
  const artifact = {
    status: allBlocked ? 'pass' : 'fail',
    registeredCount: GUARDRAIL_OPERATIONS.length,
    reasonCodes: allBlocked ? [] : ['guardrail_registry_incomplete'],
    findings: findings.slice(0, 12),
    rawOutputPrinted: false,
    safeSummaryOnly: true,
  };
  if (scanObjectForUnsafe(artifact).length) {
    return { ...artifact, status: 'fail', reasonCodes: ['unsafe_guardrail_registry_artifact'] };
  }
  return artifact;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = validateHookGuardrailRegistry();
  writeJsonReport({ hookGuardrailRegistryStatus: report, status: report.status, safeSummaryOnly: true }, 'CODEX_V114_GUARDRAIL_REGISTRY_REPORT');
  exitFor(report);
}
