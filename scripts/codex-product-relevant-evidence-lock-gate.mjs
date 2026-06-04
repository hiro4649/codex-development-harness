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

export function buildProductRelevantEvidenceLockReport(input = parseJson(process.env.CODEX_PRODUCT_RELEVANT_EVIDENCE_LOCK_JSON) || {}, env = process.env) {
  const productRelevant = parseBool(input.productRelevant ?? input.productRelevantChanged ?? env.CODEX_PRODUCT_RELEVANT_CHANGED);
  if (!productRelevant && !parseBool(input.forceCheck)) return safe('productRelevantEvidenceLockStatus', 'not_applicable', { reasonCodes: ['no_product_relevant_change'] });
  const reasonCodes = [];
  if (input.invalidInput) reasonCodes.push('product_relevant_evidence_missing');
  if (!parseBool(input.productVerificationResult ?? input.productVerificationPresent)) reasonCodes.push('product_relevant_evidence_missing');
  if (!parseBool(input.remoteProductBaselineResult ?? input.remoteProductBaselinePresent)) reasonCodes.push('remote_product_baseline_missing');
  if (parseBool(input.npmBaselineRequired) && !parseBool(input.npmBaselineResult ?? input.npmBaselinePresent)) reasonCodes.push('remote_npm_diagnostic_missing');
  if (parseBool(input.sameHeadMismatch)) reasonCodes.push('same_head_artifact_mismatch');
  if (parseBool(input.skipNpm) && !parseBool(input.allowedHarnessOnlyReason)) reasonCodes.push('skip_npm_product_bypass');
  if (parseBool(input.runtimeReadinessClaimed) && !parseBool(input.oraclePresent)) reasonCodes.push('runtime_claim_requires_product_checks');
  if (parseBool(input.targetQualityScorePassWithMissingProductEvidence)) reasonCodes.push('product_relevant_evidence_missing');
  return safe('productRelevantEvidenceLockStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, productRelevant });
}


if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildProductRelevantEvidenceLockReport();
  writeJsonReport(report, 'CODEX_PRODUCT_RELEVANT_EVIDENCE_LOCK_REPORT');
  exitFor(report);
}
