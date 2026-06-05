#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, readJson, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeTestMetrics(input = {}) {
  const metrics = {
    schemaVersion: '0.8.3',
    harnessVersion: HARNESS_VERSION,
    command: String(input.command || input.commandName || process.env.CODEX_TEST_METRICS_COMMAND || 'unspecified').slice(0, 100),
    result: ['pass', 'fail', 'not_run'].includes(input.result || process.env.CODEX_TEST_METRICS_RESULT)
      ? (input.result || process.env.CODEX_TEST_METRICS_RESULT)
      : 'not_run',
    durationMs: numberOrNull(input.durationMs ?? process.env.CODEX_TEST_METRICS_DURATION_MS),
    testCount: numberOrNull(input.testCount ?? process.env.CODEX_TEST_METRICS_TEST_COUNT),
    failedCount: numberOrNull(input.failedCount ?? process.env.CODEX_TEST_METRICS_FAILED_COUNT),
    skippedCount: numberOrNull(input.skippedCount ?? process.env.CODEX_TEST_METRICS_SKIPPED_COUNT),
    source: ['local', 'remote'].includes(input.source || process.env.CODEX_TEST_METRICS_SOURCE)
      ? (input.source || process.env.CODEX_TEST_METRICS_SOURCE)
      : 'local',
    headSha: String(input.headSha || process.env.CODEX_PR_HEAD_SHA || '').slice(0, 80),
    safeSummary: String(input.safeSummary || process.env.CODEX_TEST_METRICS_SAFE_SUMMARY || 'safe test metrics summary').slice(0, 200),
    baselineSummary: input.baselineSummary || process.env.CODEX_TEST_METRICS_BASELINE_SUMMARY || '',
    newMeasurementSummary: input.newMeasurementSummary || process.env.CODEX_TEST_METRICS_NEW_MEASUREMENT_SUMMARY || '',
    safeSummaryOnly: true,
  };
  const unsafeKeyPattern = /raw(?:Logs?|Payload|Diff|Output)|secret|token|endpointValue|privatePath|productionData|personalData/i;
  const unsafeKeys = Object.keys(input || {}).some((key) => unsafeKeyPattern.test(key));
  const unsafe = [...scanObjectForUnsafe(metrics), ...(unsafeKeys ? [{ reasonCode: 'test_metrics_unsafe', path: 'metrics' }] : [])];
  return { metrics, unsafe };
}

function inputFromEnv(env = process.env) {
  const file = env.CODEX_TEST_METRICS_INPUT_PATH;
  if (!file) return {};
  const parsed = readJson(file);
  if (!parsed.ok) return { __invalid: parsed.reasonCode };
  return parsed.value;
}

export function buildTestMetricsReport(env = process.env) {
  const input = inputFromEnv(env);
  if (input.__invalid) {
    return simpleStatus('testMetricsStatus', 'fail', { reasonCodes: ['test_metrics_invalid'] });
  }
  const { metrics, unsafe } = normalizeTestMetrics(input);
  const status = unsafe.length ? 'fail' : 'pass';
  return simpleStatus('testMetricsStatus', status, {
    reasonCodes: unsafe.length ? ['test_metrics_unsafe'] : [],
    metrics,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildTestMetricsReport();
    if (process.argv.includes('--write-artifact') && report.testMetricsStatus.metrics) {
      fs.writeFileSync('codex-test-metrics.safe.json', JSON.stringify(report.testMetricsStatus.metrics, null, 2));
    }
    writeJsonReport(report, 'CODEX_TEST_METRICS_REPORT');
    exitFor(report);
  } catch {
    const report = {
      marker,
      harnessVersion: HARNESS_VERSION,
      testMetricsStatus: { status: 'fail', reasonCodes: ['test_metrics_invalid'], safeSummaryOnly: true },
      valuesPrinted: false,
      status: 'fail',
    };
    writeJsonReport(report, 'CODEX_TEST_METRICS_REPORT');
    process.exit(1);
  }
}
