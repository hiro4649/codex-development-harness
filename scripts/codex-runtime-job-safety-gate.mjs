#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
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

export function buildRuntimeJobSafetyReport(input = parseJson(process.env.CODEX_RUNTIME_JOB_SAFETY_JSON) || {}, env = process.env) {
  const runtimeRelevant = parseBool(input.runtimeRelevant ?? input.runtimeJobChanged ?? env.CODEX_RUNTIME_RELEVANT_CHANGED);
  const runtimeReadinessClaimed = parseBool(input.runtimeReadinessClaimed ?? env.CODEX_RUNTIME_READINESS_CLAIMED);
  if (!runtimeRelevant && !runtimeReadinessClaimed && !parseBool(input.forceCheck)) return safe('runtimeJobSafetyStatus', 'not_applicable', { reasonCodes: ['no_runtime_job_surface'] });
  const reasonCodes = [];
  const warnings = [];
  if (input.invalidInput) reasonCodes.push('runtime_job_safety_failed');
  if (runtimeReadinessClaimed && !parseBool(input.ownershipEvidencePresent)) reasonCodes.push('runtime_job_ownership_missing');
  if (parseBool(input.txOrRpcPathChanged) && !parseBool(input.stateEvidencePresent)) reasonCodes.push('tx_path_state_evidence_missing');
  if (parseBool(input.cronMultiProcess) && !(parseBool(input.ownershipEvidencePresent) && parseBool(input.idempotencyEvidencePresent))) reasonCodes.push('runtime_job_ownership_missing');
  if (parseBool(input.processedBooleanOnlyProtection)) reasonCodes.push('double_send_risk_unaddressed');
  if (parseBool(input.externalApiPollingChanged) && !parseBool(input.retryBackoffEvidencePresent)) warnings.push('runtime_job_retry_backoff_manual');
  if (runtimeReadinessClaimed && parseBool(input.workerBoundaryMissing)) reasonCodes.push('runtime_job_safety_failed');
  return safe('runtimeJobSafetyStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings, runtimeRelevant, runtimeReadinessClaimed });
}


if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildRuntimeJobSafetyReport();
  writeJsonReport(report, 'CODEX_RUNTIME_JOB_SAFETY_REPORT');
  exitFor(report);
}
