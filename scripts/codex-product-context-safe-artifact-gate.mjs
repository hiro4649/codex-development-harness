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

export function buildProductContextSafeArtifactReport(input = parseJson(process.env.CODEX_PRODUCT_CONTEXT_SAFE_ARTIFACT_JSON) || {}, env = process.env) {
  const classification = input.classification || 'manual_required';
  const reasonCodes = [];
  if (input.invalidInput) reasonCodes.push('product_context_artifact_classification_failed');
  if (parseBool(input.productContextFailure) && classification === 'body_only_repair_allowed') reasonCodes.push('product_context_artifact_classification_failed');
  if (parseBool(input.skipNpmBypass) && (classification === 'warning' || input.severity === 'warning')) reasonCodes.push('skip_npm_product_bypass');
  if (parseBool(input.sameHeadMismatch) && classification === 'rerun_same_head_allowed') reasonCodes.push('same_head_artifact_mismatch');
  if (parseBool(input.productEvidenceMissing) && classification === 'merge_allowed') reasonCodes.push('product_relevant_evidence_missing');
  return safe('productContextSafeArtifactStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, classification });
}


if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildProductContextSafeArtifactReport();
  writeJsonReport(report, 'CODEX_PRODUCT_CONTEXT_SAFE_ARTIFACT_REPORT');
  exitFor(report);
}
