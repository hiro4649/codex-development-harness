#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { fileURLToPath } from 'node:url';
import { isPrContext, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function parseJson(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return { invalidInput: true }; }
}
function parseBool(value) { return value === true || value === '1' || value === 'true'; }
function parseList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || '').split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean);
}
function uniq(values) { return [...new Set(values.filter(Boolean))]; }
function safe(statusKey, status, payload) {
  const out = simpleStatus(statusKey, status, { ...payload, reasonCodes: uniq(payload.reasonCodes || []), safeSummaryOnly: true });
  return scanObjectForUnsafe(out).length ? simpleStatus(statusKey, 'fail', { reasonCodes: ['unsafe_value_detected'], safeSummaryOnly: true }) : out;
}

export function buildRemoteProductContextRestoreReport(input = parseJson(process.env.CODEX_REMOTE_PRODUCT_CONTEXT_RESTORE_JSON) || {}, env = process.env) {
  const pr = isPrContext(env) || parseBool(input.isPullRequest);
  const productRelevant = parseBool(input.productRelevant ?? input.productRelevantChanged ?? env.CODEX_PRODUCT_RELEVANT_CHANGED);
  const workflowDispatchSubstitute = parseBool(input.workflowDispatchTreatedAsPrCheck) || (input.eventName === 'workflow_dispatch' && parseBool(input.prCheckPassClaimed));
  const changedFiles = parseList(input.changedFiles ?? env.CODEX_CHANGED_FILES);
  if (!pr && !productRelevant && !workflowDispatchSubstitute && !parseBool(input.forceCheck)) return safe('remoteProductContextRestoreStatus', 'not_applicable', { reasonCodes: ['local_non_pr_no_product_context_required'] });
  const reasonCodes = [];
  if (input.invalidInput) reasonCodes.push('remote_product_context_missing');
  if (productRelevant && !parseBool(input.productVerificationRequired ?? env.CODEX_PRODUCT_VERIFICATION_REQUIRED ?? true)) reasonCodes.push('remote_product_context_missing');
  if (productRelevant && !parseBool(input.remoteProductBaselineRequired ?? env.CODEX_REMOTE_PRODUCT_BASELINE_REQUIRED ?? true)) reasonCodes.push('remote_product_context_missing');
  if (pr && parseBool(input.contextDropped)) reasonCodes.push('remote_product_context_missing');
  if (pr && productRelevant && changedFiles.length === 0) reasonCodes.push('pull_request_context_missing');
  if (workflowDispatchSubstitute || parseBool(input.workflowDispatchDiagnosticOnlyAsPass)) reasonCodes.push('workflow_dispatch_not_pr_substitute');
  if (parseBool(input.targetRolloutProductContextMissing)) reasonCodes.push('remote_product_context_missing');
  if (parseBool(input.remoteContextRestoreFixtureMissing)) reasonCodes.push('remote_product_context_missing');
  return safe('remoteProductContextRestoreStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, productRelevant, pullRequestContext: pr, changedFileCount: changedFiles.length });
}


if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildRemoteProductContextRestoreReport();
  writeJsonReport(report, 'CODEX_REMOTE_PRODUCT_CONTEXT_RESTORE_REPORT');
  exitFor(report);
}
