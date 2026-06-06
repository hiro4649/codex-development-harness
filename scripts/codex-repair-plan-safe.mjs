#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.9

import { MARKER, buildStatus } from './codex-status-taxonomy.mjs';

export const REPAIR_KINDS = [
  'body_only',
  'harness_only',
  'workflow_metadata_only',
  'source_harness_only',
  'target_harness_rollout_only',
  'product_scope',
  'review_governance',
  'manual_gate_required',
  'external_runner_blocked',
  'terminal_no_action',
  'unsafe_to_repair',
];

export function buildRepairPlanSafe(input = {}) {
  const repairKind = REPAIR_KINDS.includes(input.repairKind) ? input.repairKind : 'terminal_no_action';
  const productCodeChangeNeeded = Boolean(input.productCodeChangeNeeded || repairKind === 'product_scope');
  const rawLogsNeeded = Boolean(input.rawLogsNeeded);
  const ownerActionNeeded = Boolean(input.ownerActionNeeded || repairKind === 'manual_gate_required');
  return {
    marker: MARKER,
    repairPlanVersion: '1.0.9',
    reasonCode: input.reasonCode || 'unknown_safe_metadata_limited',
    failureClass: input.failureClass || 'terminal_no_action',
    repairKind,
    sourceFile: safeToken(input.sourceFile || 'safe_metadata'),
    parserInputPath: safeToken(input.parserInputPath || 'safe_artifact'),
    expectedField: input.expectedField || 'status',
    actualField: input.actualField || 'not_available',
    minimalSafeFix: input.minimalSafeFix || (repairKind === 'terminal_no_action' ? 'wait_for_state_delta' : 'apply_minimal_harness_fix'),
    allowedFiles: input.allowedFiles || ['scripts/codex-*', 'docs/process/**'],
    forbiddenFiles: input.forbiddenFiles || ['src/**', 'apps/**', 'contracts/**', 'package.json', 'package-lock.json', '.env*'],
    productCodeChangeNeeded,
    bodyOnlyRepairAllowed: repairKind === 'body_only',
    harnessOnlyRepairAllowed: ['harness_only', 'source_harness_only', 'target_harness_rollout_only'].includes(repairKind) && !productCodeChangeNeeded,
    workflowChangeNeeded: Boolean(input.workflowChangeNeeded || repairKind === 'workflow_metadata_only'),
    rawLogsNeeded,
    ownerActionNeeded,
    nextSafeAction: input.nextSafeAction || (rawLogsNeeded ? 'stop_raw_logs_forbidden' : 'emit_safe_summary_only'),
    safeSummaryOnly: true,
  };
}

export function validateRepairPlanSafe(plan = {}) {
  const reasonCodes = [];
  for (const field of ['repairPlanVersion', 'reasonCode', 'failureClass', 'repairKind', 'allowedFiles', 'forbiddenFiles', 'safeSummaryOnly']) {
    if (!(field in plan)) reasonCodes.push('repair_plan_required_field_missing');
  }
  if (plan.rawLogsNeeded) reasonCodes.push('raw_logs_needed_forbidden');
  if (!plan.safeSummaryOnly) reasonCodes.push('safe_summary_required');
  if (hasUnsafeValue(plan)) reasonCodes.push('unsafe_value_detected');
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes: [...new Set(reasonCodes)], safeSummaryOnly: true };
}

export function buildRepairPlanSafeStatus(input = {}) {
  const plan = buildRepairPlanSafe(input);
  const validation = validateRepairPlanSafe(plan);
  return buildStatus('repairPlanSafeJsonStatus', validation.status, {
    reasonCodes: validation.reasonCodes,
    safeSummary: { repairKind: plan.repairKind, productCodeChangeNeeded: plan.productCodeChangeNeeded },
  });
}

function safeToken(value) {
  return String(value).replace(/[A-Za-z]:\\[^ ]+|\/[^ ]+/g, 'safe_path');
}

function hasUnsafeValue(value) {
  return /secret|token=|api[_-]?key|private[_-]?key|wallet_private|rpc_url|raw payload|raw logs|\b(?:gh[pousr]_|sk-|AKIA|glpat-|npm_|xox[baprs]-)[A-Za-z0-9_-]{8,}\b/i.test(JSON.stringify(value));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(buildRepairPlanSafe({ repairKind: 'terminal_no_action' }), null, 2));
}
