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
  'legal_compliance_claim',
  'youtube_policy_compliance_claim',
  'production_go_claim',
  'runtime_readiness_claim',
  'target_branch_mutation',
  'external_workspace_process',
  'stale_diagnostic_reintroduction',
  'owner_values_treated_as_deploy_approval',
  'fixture_pass_treated_as_real_evidence',
  'pr_body_treated_as_source_of_truth',
  'duplicate_inventory_pr',
  'full_json_stdout',
  'oversized_final_report',
  'multiple_safe_next_actions',
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
  legal_compliance_claim: 'replace_with_non_claim_boundary',
  youtube_policy_compliance_claim: 'replace_with_non_claim_boundary',
  production_go_claim: 'require_owner_production_scope_and_real_evidence',
  runtime_readiness_claim: 'replace_with_runtime_boundary_status',
  target_branch_mutation: 'stop_and_restore_caller_branch_boundary',
  external_workspace_process: 'stop_and_remove_external_process_from_harness_scope',
  stale_diagnostic_reintroduction: 'prefer_formal_same_head_evidence',
  owner_values_treated_as_deploy_approval: 'require_typed_deploy_receipt',
  fixture_pass_treated_as_real_evidence: 'classify_fixture_as_non_real_evidence',
  pr_body_treated_as_source_of_truth: 'use_safe_artifact_as_source_of_truth',
  duplicate_inventory_pr: 'close_or_absorb_existing_inventory_before_new_pr',
  full_json_stdout: 'write_full_json_to_file_only',
  oversized_final_report: 'compress_to_pro_summary_budget',
  multiple_safe_next_actions: 'select_exactly_one_safe_next_action',
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
