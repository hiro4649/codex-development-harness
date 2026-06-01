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

export function buildFalsePositiveBudgetReport(input = parseJson(process.env.CODEX_FALSE_POSITIVE_BUDGET_JSON) || {}, env = process.env) {
  const reasonCodes = [];
  const warnings = [];
  if (input.invalidInput || parseBool(input.artifactUnsafe)) reasonCodes.push('false_positive_budget_failed');
  if (parseBool(input.hidesNonOverridableFailure) || parseBool(input.bodyOnlyRepairHidesProductEvidenceMissing)) reasonCodes.push('false_positive_budget_failed');
  if (parseBool(input.budgetExceeded) || Number(input.bodyOnlyRepairCount || 0) > Number(input.maxBodyOnlyRepairCount || 2)) warnings.push('false_positive_budget_exceeded');
  if (parseBool(input.prBodyTooLong)) warnings.push('pr_body_too_large');
  if (parseBool(input.evidenceRepairRepeated)) warnings.push('evidence_repair_repeated');
  return safe('falsePositiveBudgetStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings, metrics: { bodyOnlyRepairCount: Number(input.bodyOnlyRepairCount || 0), nearMissHeadingCount: Number(input.nearMissHeadingCount || 0), manualConfirmationLoopCount: Number(input.manualConfirmationLoopCount || 0), rerunSameHeadCount: Number(input.rerunSameHeadCount || 0), artifactPendingCount: Number(input.artifactPendingCount || 0), classificationFalsePositiveCount: Number(input.classificationFalsePositiveCount || 0) } });
}


if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildFalsePositiveBudgetReport();
  writeJsonReport(report, 'CODEX_FALSE_POSITIVE_BUDGET_REPORT');
  exitFor(report);
}
