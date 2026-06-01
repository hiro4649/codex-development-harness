#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { HARNESS_VERSION, marker, prBodyText, isPrContext, readJson, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function hasPerformanceClaim(body) {
  const claimPattern = /\b(faster|lower memory|lower latency|more efficient|optimized|reduced cost|performance improvement|speedup)\b/i;
  return String(body || '').split(/\r?\n/).some((line) =>
    claimPattern.test(line) &&
    !/\b(no|not|without)\b.{0,80}\b(performance|faster|latency|memory|efficient|optimized|cost|speedup|claim)\b/i.test(line) &&
    !/\b(performance claim|performance evidence)\s*:\s*(not applicable|none|no)\b/i.test(line));
}

function hasEvidence(body) {
  return /Performance Evidence:/i.test(body) &&
    /baseline summary/i.test(body) &&
    /new measurement summary/i.test(body);
}

function hasSafeMetricEvidence(env) {
  const file = env.CODEX_TEST_METRICS_PATH || env.CODEX_TEST_METRICS_INPUT_PATH;
  if (!file) return false;
  const parsed = readJson(file);
  if (!parsed.ok) return false;
  const value = parsed.value || {};
  return Boolean(value.baselineSummary && value.newMeasurementSummary);
}

function buildReport(env = process.env) {
  const body = prBodyText(env);
  if (!isPrContext(env) && !body.trim()) {
    return simpleStatus('performanceEvidenceStatus', 'not_applicable', { reasonCodes: ['non_pr_context'] });
  }
  if (!hasPerformanceClaim(body)) {
    return simpleStatus('performanceEvidenceStatus', 'not_applicable', { reasonCodes: ['performance_claim_not_present'] });
  }
  const status = hasEvidence(body) || hasSafeMetricEvidence(env) ? 'pass' : 'fail';
  return simpleStatus('performanceEvidenceStatus', status, {
    reasonCodes: status === 'pass' ? [] : ['performance_metrics_required', 'performance_claim_without_evidence'],
  });
}

try {
  const report = buildReport();
  writeJsonReport(report, 'CODEX_PERFORMANCE_EVIDENCE_REPORT');
  exitFor(report);
} catch {
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    performanceEvidenceStatus: { status: 'fail', reasonCodes: ['unexpected_error'], safeSummaryOnly: true },
    valuesPrinted: false,
    status: 'fail',
  };
  writeJsonReport(report, 'CODEX_PERFORMANCE_EVIDENCE_REPORT');
  process.exit(1);
}
