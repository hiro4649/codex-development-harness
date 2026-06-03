#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
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

export function buildChainScopeReport(input = parseJson(process.env.CODEX_CHAIN_SCOPE_JSON) || {}, env = process.env) {
  const readiness = parseBool(input.runtimeReadinessClaimed ?? env.CODEX_RUNTIME_READINESS_CLAIMED);
  if (!readiness && !parseBool(input.forceCheck) && !parseBool(input.scopeConflict)) return safe('chainScopeStatus', 'not_applicable', { reasonCodes: ['no_chain_scope_claim'] });
  const reasonCodes = [];
  if (input.invalidInput) reasonCodes.push('chain_scope_conflict');
  if (parseBool(input.stagingProdChainMixed) || parseBool(input.productionGoWithStagingChain) || parseBool(input.txAllowedInNoTxMode)) reasonCodes.push('chain_scope_conflict');
  if (readiness && parseBool(input.chainSpecificRuntimeReadiness) && !parseBool(input.chainEvidencePresent)) reasonCodes.push('chain_scope_conflict');
  return safe('chainScopeStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, runtimeReadinessClaimed: readiness });
}


if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildChainScopeReport();
  writeJsonReport(report, 'CODEX_CHAIN_SCOPE_REPORT');
  exitFor(report);
}
