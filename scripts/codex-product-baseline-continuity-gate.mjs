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

export function buildProductBaselineContinuityReport(input = parseJson(process.env.CODEX_PRODUCT_BASELINE_CONTINUITY_JSON) || {}, env = process.env) {
  const reasonCodes = [];
  if (input.invalidInput) reasonCodes.push('product_baseline_lost');
  if (parseBool(input.baselineResultDisappeared) || parseBool(input.baselineLostInFinalSummary)) reasonCodes.push('product_baseline_lost');
  if (parseBool(input.baselineFailBecameDiagnosticPass)) reasonCodes.push('remote_product_baseline_failing');
  if (parseBool(input.candidateRegressionNotSeparated)) reasonCodes.push('baseline_candidate_regression_not_separated');
  if (parseBool(input.targetFinalSummaryOmitsBaseline)) reasonCodes.push('target_final_summary_invalid');
  if (parseBool(input.safeArtifactClassifierCannotClassifyBaselineFailure)) reasonCodes.push('safe_artifact_classification_failed');
  return safe('productBaselineContinuityStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}


if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildProductBaselineContinuityReport();
  writeJsonReport(report, 'CODEX_PRODUCT_BASELINE_CONTINUITY_REPORT');
  exitFor(report);
}
