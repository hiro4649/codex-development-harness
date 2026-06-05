#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function envJson(env, name) {
  if (!env[name]) return null;
  try {
    return JSON.parse(env[name]);
  } catch {
    return null;
  }
}

function safeCases(report) {
  const cases = Array.isArray(report?.cases) ? report.cases : [];
  return cases
    .filter((item) => item.status === 'fail' || item.actualStatus === 'fail')
    .map((item) => ({
      caseId: String(item.id || item.caseId || 'unknown_case').slice(0, 120),
      expectedStatus: String(item.expectedStatus || item.expected || 'pass').slice(0, 40),
      actualStatus: String(item.actualStatus || item.status || 'fail').slice(0, 40),
      reasonCodes: Array.isArray(item.reasonCodes) ? item.reasonCodes.slice(0, 8).map(String) : [],
      safeMessage: String(item.safeMessage || item.message || 'self-test case failed').slice(0, 160),
    }));
}

export function buildSelfTestCaseExportReport(env = process.env) {
  const report = envJson(env, 'CODEX_SELF_TEST_REPORT_JSON') || envJson(env, 'CODEX_V089_SELF_TEST_REPORT') || {};
  const suite = String(report.suite || report.v089SelfTestStatus?.suite || env.CODEX_SELF_TEST_SUITE || 'local_quality_gate');
  const failedCases = safeCases(report);
  const failedCaseCount = Number(report.failedCaseCount ?? failedCases.length);
  const caseCount = Number(report.caseCount ?? (Array.isArray(report.cases) ? report.cases.length : failedCases.length));
  const reportedFailure = report.status === 'fail' || report.v089SelfTestStatus?.status === 'fail' || failedCaseCount > 0;
  const reasonCodes = [];
  if (reportedFailure && !failedCases.length) reasonCodes.push('self_test_failed_case_export_missing');
  const payload = {
    suite,
    caseCount,
    failedCaseCount,
    failedCases,
    reasonCodes,
  };
  if (scanObjectForUnsafe(payload).length) reasonCodes.push('self_test_case_export_failed');
  const status = reasonCodes.length ? 'fail' : 'pass';
  return simpleStatus('selfTestCaseExportStatus', status, payload);
}

function maybeWriteArtifact(report) {
  if (!process.argv.includes('--write-artifact') && process.env.CODEX_WRITE_SELF_TEST_CASE_EXPORT !== '1') return;
  const status = report.selfTestCaseExportStatus;
  fs.writeFileSync('codex-self-test-cases.safe.json', JSON.stringify({
    suite: status.suite,
    caseCount: status.caseCount,
    failedCaseCount: status.failedCaseCount,
    failedCases: status.failedCases,
    safeSummaryOnly: true,
  }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildSelfTestCaseExportReport();
    maybeWriteArtifact(report);
    writeJsonReport(report, 'CODEX_SELF_TEST_CASE_EXPORT_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('selfTestCaseExportStatus', 'fail', { reasonCodes: ['self_test_case_export_failed'] });
    writeJsonReport(report, 'CODEX_SELF_TEST_CASE_EXPORT_REPORT');
    process.exit(1);
  }
}
