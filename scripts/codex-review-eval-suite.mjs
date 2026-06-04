#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { fileURLToPath } from 'node:url';
import { buildCodeReviewMonitorReport } from './codex-code-review-monitor.mjs';
import { HARNESS_VERSION, marker, readJson, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

const defaultCasesPath = 'docs/process/CODEX_REVIEW_EVAL_CASES.json';

function json(value) {
  return JSON.stringify(value || {});
}

function envForCase(testCase) {
  const input = testCase.inputStatuses || {};
  return {
    CODEX_QUALITY_REPORT: 'json',
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_CODE_REVIEW_MONITOR_MODE: 'enforce',
    CODEX_PR_BODY: testCase.prBody || '',
    CODEX_CHANGED_FILES: (testCase.changedFiles || []).join(','),
    CODEX_DIFF_NUMSTAT: testCase.diffNumstat || '0\t0\tREADME.md',
    CODEX_CHANGE_CLASSIFICATION_JSON: json(input.changeClassificationStatus
      ? { changeClassificationStatus: input.changeClassificationStatus }
      : { changeClassificationStatus: { status: 'pass', classification: {}, productRelevantChanged: false } }),
    CODEX_PRODUCT_VERIFICATION_JSON: json(input.productVerificationStatus
      ? { productVerificationStatus: input.productVerificationStatus }
      : { productVerificationStatus: { status: 'not_applicable', reasonCodes: ['product_evidence_not_provided'] } }),
    CODEX_V085_STABILITY_JSON: json(input.v085StabilityStatus
      ? { v085StabilityStatus: input.v085StabilityStatus }
      : { v085StabilityStatus: { status: 'not_applicable', reasonCodes: ['v085_status_not_provided'] } }),
  };
}

export function buildReviewEvalSuiteReport(env = process.env) {
  const suitePath = env.CODEX_REVIEW_EVAL_CASES_PATH || defaultCasesPath;
  const parsed = readJson(suitePath);
  if (!parsed.ok || !Array.isArray(parsed.value?.cases)) {
    return simpleStatus('reviewEvalSuiteStatus', 'fail', {
      reasonCodes: ['review_eval_suite_invalid'],
      casesRun: 0,
      failures: ['suite_invalid'],
    });
  }
  const failures = [];
  const cases = [];
  for (const testCase of parsed.value.cases) {
    const result = buildCodeReviewMonitorReport(envForCase(testCase)).codeReviewMonitorStatus;
    const expectedStatus = testCase.expected?.status;
    const expectedReasons = testCase.expected?.reasonCodes || [];
    const missingReasons = expectedReasons.filter((code) => !(result.reasonCodes || []).includes(code));
    const ok = result.status === expectedStatus && missingReasons.length === 0 && scanObjectForUnsafe(result).length === 0;
    cases.push({
      id: testCase.id,
      status: ok ? 'pass' : 'fail',
      expectedStatus,
      actualStatus: result.status,
      missingReasonCount: missingReasons.length,
      safeSummaryOnly: true,
    });
    if (!ok) failures.push(testCase.id || 'review_eval_case_failed');
  }
  const status = failures.length ? 'fail' : 'pass';
  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    reviewEvalSuiteStatus: {
      status,
      casesRun: cases.length,
      failures,
      cases,
      reasonCodes: failures.length ? ['review_eval_case_failed'] : [],
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
    status,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildReviewEvalSuiteReport();
    writeJsonReport(report, 'CODEX_REVIEW_EVAL_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('reviewEvalSuiteStatus', 'fail', { reasonCodes: ['review_eval_suite_invalid'] });
    writeJsonReport(report, 'CODEX_REVIEW_EVAL_REPORT');
    process.exit(1);
  }
}
