#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
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

export function buildRuntimeLogSecretScanReport(input = parseJson(process.env.CODEX_RUNTIME_LOG_SECRET_SCAN_JSON) || {}, env = process.env) {
  const readiness = parseBool(input.runtimeReadinessClaimed ?? env.CODEX_RUNTIME_READINESS_CLAIMED);
  if (!readiness && !parseBool(input.forceCheck) && !parseBool(input.rawRuntimeLogsIncluded)) return safe('runtimeLogSecretScanStatus', 'not_applicable', { reasonCodes: ['no_runtime_readiness_claim'] });
  const reasonCodes = [];
  const warnings = [];
  if (input.invalidInput) reasonCodes.push('runtime_log_secret_scan_missing');
  if (parseBool(input.rawRuntimeLogsIncluded)) reasonCodes.push('raw_runtime_log_forbidden');
  if (parseBool(input.secretLikeValueAppears)) reasonCodes.push('unsafe_value_detected');
  if (readiness && !parseBool(input.logScanPresent)) reasonCodes.push('runtime_log_secret_scan_missing');
  if (parseBool(input.logScanUnavailable)) warnings.push('runtime_log_scan_unavailable');
  return safe('runtimeLogSecretScanStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings, runtimeReadinessClaimed: readiness });
}


if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildRuntimeLogSecretScanReport();
  writeJsonReport(report, 'CODEX_RUNTIME_LOG_SECRET_SCAN_REPORT');
  exitFor(report);
}
