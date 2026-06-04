#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
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

export function buildEnvConsistencyReport(input = parseJson(process.env.CODEX_ENV_CONSISTENCY_JSON) || {}, env = process.env) {
  const productRelevant = parseBool(input.productRelevant ?? env.CODEX_PRODUCT_RELEVANT_CHANGED);
  const readiness = parseBool(input.runtimeReadinessClaimed ?? env.CODEX_RUNTIME_READINESS_CLAIMED);
  if (!productRelevant && !readiness && !parseBool(input.forceCheck)) return safe('envConsistencyStatus', 'not_applicable', { reasonCodes: ['env_consistency_not_required'] });
  const reasonCodes = [];
  if (input.invalidInput) reasonCodes.push('env_consistency_failed');
  if (productRelevant && parseBool(input.docsValidatorMismatch)) reasonCodes.push('env_consistency_failed');
  if (parseBool(input.stagingProdContradiction) || parseBool(input.requiredChainEnvMissing) || parseBool(input.renamedEnvWithoutMigrationNote)) reasonCodes.push('env_consistency_failed');
  if (readiness && parseBool(input.envConsistencyUnknown)) reasonCodes.push('env_consistency_failed');
  return safe('envConsistencyStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, productRelevant, runtimeReadinessClaimed: readiness });
}


if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildEnvConsistencyReport();
  writeJsonReport(report, 'CODEX_ENV_CONSISTENCY_REPORT');
  exitFor(report);
}
