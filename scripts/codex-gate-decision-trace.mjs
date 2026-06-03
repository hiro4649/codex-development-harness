#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { fileURLToPath } from 'node:url';
import {
  scanObjectForUnsafe,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';

function safeJson(env, name) {
  if (!env[name]) return null;
  try {
    return JSON.parse(env[name]);
  } catch {
    return null;
  }
}

function collect(report, statuses) {
  const out = [];
  for (const [key, value] of Object.entries(report || {})) {
    if (value && statuses.includes(value.status)) {
      const reason = Array.isArray(value.reasonCodes) && value.reasonCodes[0] ? value.reasonCodes[0] : value.status;
      out.push(`${key}:${reason}`);
    }
  }
  return out.slice(0, 5);
}

export function buildGateDecisionTrace(env = process.env) {
  const report = safeJson(env, 'CODEX_GATE_REPORT_JSON') || safeJson(env, 'CODEX_LOCAL_QUALITY_REPORT_JSON') || {};
  const scoreStatus = safeJson(env, 'CODEX_SCORE_DECOMPOSITION_JSON')?.scoreDecompositionStatus ||
    report.scoreDecompositionStatus ||
    report.qualityScoreStatus ||
    report.targetQualityScoreStatus ||
    {};
  const score = Number(scoreStatus.score ?? report.qualityScoreStatus?.score ?? report.targetQualityScoreStatus?.score ?? 100);
  const topBlockingReasons = collect(report, ['fail', 'missing']);
  const topManualReasons = collect(report, ['manual_confirmation_required']);
  const topWarnings = collect(report, ['warning']);
  const topNextActions = [
    ...topBlockingReasons.map((item) => `Resolve ${item}`),
    ...topManualReasons.map((item) => `Confirm or repair ${item}`),
    ...topWarnings.map((item) => `Review ${item}`),
  ].slice(0, 5);
  const payload = {
    score,
    decisionPath: [
      score <= 70 ? 'blocking_failure_cap' : null,
      score === 89 ? 'manual_or_warning_cap' : null,
      score === 95 ? 'optional_not_applicable_cap' : null,
      score === 100 ? 'all_required_passed' : null,
    ].filter(Boolean),
    topBlockingReasons,
    topManualReasons,
    topWarnings,
    topNextActions,
    reasonCodes: [],
  };
  if ((report.status === 'fail' || score <= 70) && !topBlockingReasons.length) payload.reasonCodes.push('gate_decision_trace_missing');
  if (scanObjectForUnsafe(payload).length) payload.reasonCodes.push('gate_decision_trace_unsafe');
  const status = payload.reasonCodes.length ? 'fail' : 'pass';
  return simpleStatus('gateDecisionTraceStatus', status, payload);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildGateDecisionTrace();
    writeJsonReport(report, 'CODEX_GATE_DECISION_TRACE_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('gateDecisionTraceStatus', 'fail', {
      score: 70,
      decisionPath: ['trace_failed'],
      topBlockingReasons: ['gate_decision_trace_missing'],
      topManualReasons: [],
      topWarnings: [],
      topNextActions: ['Regenerate safe gate decision trace.'],
      reasonCodes: ['gate_decision_trace_missing'],
    });
    writeJsonReport(report, 'CODEX_GATE_DECISION_TRACE_REPORT');
    process.exit(1);
  }
}
