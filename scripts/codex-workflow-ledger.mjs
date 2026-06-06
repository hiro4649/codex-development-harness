#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.9

import { MARKER, buildStatus } from './codex-status-taxonomy.mjs';

export function buildWorkflowLedger(input = {}) {
  return {
    marker: MARKER,
    workflowLedgerVersion: '1.0.9',
    operationId: input.operationId || 'source_harness_v109',
    repo: input.repo || 'hiro4649/codex-development-harness',
    branch: input.branch || 'codex/harness-v1-0-9-decision-ledger-001',
    startHead: input.startHead || 'current_main_head',
    endHead: input.endHead || 'current_branch_head',
    steps: (input.steps || ['startup_checks', 'source_harness_edit', 'local_validation']).map((step, index) => ({ index: index + 1, step, status: 'recorded' })),
    safeState: input.safeState || 'source_harness_only',
    mergePerformed: false,
    prCreated: Boolean(input.prCreated),
    reviewPosted: false,
    bodyPublished: Boolean(input.bodyPublished),
    ciWatched: Boolean(input.ciWatched),
    rawLogsRead: false,
    productCodeChanged: false,
    runtimeReadinessClaimed: false,
    productionReadinessClaimed: false,
    safeSummaryOnly: true,
  };
}

export function validateWorkflowLedger(ledger = {}) {
  const required = ['workflowLedgerVersion', 'operationId', 'repo', 'branch', 'startHead', 'endHead', 'steps', 'safeState', 'mergePerformed', 'rawLogsRead', 'productCodeChanged', 'runtimeReadinessClaimed', 'productionReadinessClaimed'];
  const missing = required.filter((field) => !(field in ledger));
  const forbidden = [];
  if (ledger.rawLogsRead) forbidden.push('raw_logs_read');
  if (ledger.productCodeChanged) forbidden.push('product_code_changed');
  if (ledger.runtimeReadinessClaimed) forbidden.push('runtime_readiness_claimed');
  if (ledger.productionReadinessClaimed) forbidden.push('production_readiness_claimed');
  return { status: missing.length || forbidden.length ? 'fail' : 'pass', reasonCodes: [...missing.map(() => 'workflow_ledger_required_field_missing'), ...forbidden], safeSummaryOnly: true };
}

export function buildWorkflowLedgerStatus(input = {}) {
  const ledger = buildWorkflowLedger(input);
  const validation = validateWorkflowLedger(ledger);
  return buildStatus('workflowLedgerStatus', validation.status, { reasonCodes: validation.reasonCodes, safeSummary: { stepCount: ledger.steps.length } });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(buildWorkflowLedger(), null, 2));
}
