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

export function buildTxPathStateEvidenceReport(input = parseJson(process.env.CODEX_TX_PATH_STATE_EVIDENCE_JSON) || {}, env = process.env) {
  const txRelevant = parseBool(input.txPathChanged ?? input.chainInteractionChanged ?? env.CODEX_TX_PATH_CHANGED);
  const readiness = parseBool(input.runtimeReadinessClaimed ?? env.CODEX_RUNTIME_READINESS_CLAIMED);
  if (!txRelevant && !readiness && !parseBool(input.forceCheck)) return safe('txPathStateEvidenceStatus', 'not_applicable', { reasonCodes: ['no_tx_path_surface'] });
  const reasonCodes = [];
  if (input.invalidInput) reasonCodes.push('tx_path_state_evidence_missing');
  if (parseBool(input.txSendingFunctionChanged) && !parseBool(input.txHashPersistencePolicyPresent)) reasonCodes.push('tx_hash_receipt_policy_missing');
  if (parseBool(input.receiptRequiredPathChanged) && !parseBool(input.receiptEvidencePolicyPresent)) reasonCodes.push('tx_hash_receipt_policy_missing');
  if (parseBool(input.chainSpecificPath) && !parseBool(input.chainIdPolicyPresent)) reasonCodes.push('tx_path_state_evidence_missing');
  if (readiness && !(parseBool(input.fundedEvidencePresent) || parseBool(input.noTxEvidencePresent))) reasonCodes.push('tx_path_state_evidence_missing');
  if (parseBool(input.doubleSendRiskUnaddressed)) reasonCodes.push('double_send_risk_unaddressed');
  if (parseBool(input.scheduledTxPath) && !parseBool(input.jobRunOwnershipPresent)) reasonCodes.push('runtime_job_ownership_missing');
  return safe('txPathStateEvidenceStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, txRelevant, runtimeReadinessClaimed: readiness });
}


if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildTxPathStateEvidenceReport();
  writeJsonReport(report, 'CODEX_TX_PATH_STATE_EVIDENCE_REPORT');
  exitFor(report);
}
