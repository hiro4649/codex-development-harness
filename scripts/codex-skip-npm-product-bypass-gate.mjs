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

export function buildSkipNpmProductBypassReport(input = parseJson(process.env.CODEX_SKIP_NPM_PRODUCT_BYPASS_JSON) || {}, env = process.env) {
  const productRelevant = parseBool(input.productRelevant ?? input.productRelevantChanged ?? env.CODEX_PRODUCT_RELEVANT_CHANGED);
  const skipNpm = parseBool(input.skipNpm ?? env.CODEX_SKIP_NPM);
  const harnessOnly = parseBool(input.harnessOnly ?? env.CODEX_HARNESS_ONLY_ROLLOUT);
  const allowedReason = Boolean(input.allowedReason || input.explicitReason || env.CODEX_SKIP_NPM_REASON);
  const reasonCodes = [];
  if (input.invalidInput) reasonCodes.push('skip_npm_product_bypass');
  if (productRelevant && skipNpm && !(harnessOnly && allowedReason)) reasonCodes.push('skip_npm_product_bypass');
  if (productRelevant && parseBool(input.npmUnavailable) && !parseBool(input.baselineAlternativePresent)) reasonCodes.push('remote_npm_diagnostic_missing');
  if (productRelevant && parseBool(input.targetQualityScorePassWithSkipOnlyEvidence)) reasonCodes.push('skip_npm_product_bypass');
  if (parseBool(input.productFilesChanged) && parseBool(input.targetRolloutModeLeaked)) reasonCodes.push('skip_npm_product_bypass');
  if (productRelevant && parseBool(input.harnessOnlyReasonReused)) reasonCodes.push('skip_npm_product_bypass');
  return safe('skipNpmProductBypassStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, productRelevant, skipNpm, harnessOnlySkipAllowed: harnessOnly && skipNpm && allowedReason && !productRelevant });
}


if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildSkipNpmProductBypassReport();
  writeJsonReport(report, 'CODEX_SKIP_NPM_PRODUCT_BYPASS_REPORT');
  exitFor(report);
}
