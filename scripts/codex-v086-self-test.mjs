#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { HARNESS_VERSION, marker, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildCodeReviewMonitorReport } from './codex-code-review-monitor.mjs';

function assertCase(name, ok, failures, cases, detail = '') {
  cases.push({ name, status: ok ? 'pass' : 'fail', detail: String(detail || '').slice(0, 120) });
  if (!ok) failures.push(name);
}

function classification(value) {
  return JSON.stringify({ changeClassificationStatus: value });
}

function productStatus(value) {
  return JSON.stringify({ productVerificationStatus: value });
}

function v085Status(value) {
  return JSON.stringify({ v085StabilityStatus: value });
}

function env(overrides = {}) {
  return {
    CODEX_QUALITY_REPORT: 'json',
    CODEX_CODE_REVIEW_MONITOR_MODE: 'enforce',
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_BODY: '',
    CODEX_CHANGED_FILES: '',
    CODEX_DIFF_NUMSTAT: '0\t0\tREADME.md',
    ...overrides,
  };
}

function runMonitor(overrides = {}) {
  return buildCodeReviewMonitorReport(env(overrides)).codeReviewMonitorStatus;
}

function runScript(overrides = {}) {
  const safeProcessEnv = {};
  for (const key of ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'COMSPEC', 'ComSpec', 'HOME', 'TMP', 'TEMP']) {
    if (process.env[key]) safeProcessEnv[key] = process.env[key];
  }
  return spawnSync('node', ['scripts/codex-code-review-monitor.mjs'], {
    encoding: 'utf8',
    env: { ...safeProcessEnv, ...env(overrides), CODEX_CODE_REVIEW_MONITOR_REPORT: 'json' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function buildV086SelfTestReport() {
  const failures = [];
  const cases = [];
  let result;

  result = runMonitor({
    CODEX_CHANGED_FILES: 'README.md',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { docsOnly: true }, productRelevantChanged: false }),
  });
  assertCase('docs-only change -> pass or not_applicable', ['pass', 'not_applicable'].includes(result.status), failures, cases, result.status);

  result = runMonitor({
    CODEX_CHANGED_FILES: 'scripts/codex-local-quality-gate.mjs',
    CODEX_PR_BODY: 'Task mode: harness_change\n\nFiles or scope:\nHarness files.\n\nTesting and review:\nSelf-test pass.',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { harnessOnly: true }, productRelevantChanged: false }),
  });
  assertCase('harness-only change -> pass', result.status === 'pass', failures, cases, result.status);

  result = runMonitor({
    CODEX_CHANGED_FILES: 'scripts/codex-local-quality-gate.mjs,src/product.ts',
    CODEX_PR_BODY: 'Task mode: harness_change',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { harnessOnly: false, productSourceChanged: true }, productRelevantChanged: true }),
  });
  assertCase('harness-change mixed with src/ -> fail', result.status === 'fail' && result.reasonCodes.includes('harness_change_mixed_with_product_files'), failures, cases, result.status);

  result = runMonitor({
    CODEX_CHANGED_FILES: 'src/fix.ts',
    CODEX_PR_BODY: 'Task mode: bugfix',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true, testsChanged: true }, productRelevantChanged: true }),
    CODEX_PRODUCT_VERIFICATION_JSON: productStatus({ status: 'pass' }),
    CODEX_V085_STABILITY_JSON: v085Status({
      status: 'pass',
      bugfixEvidenceStatus: { status: 'pass', reasonCodes: [] },
    }),
  });
  assertCase('bugfix with reproduction/rootCause/verification -> pass', result.status === 'pass', failures, cases, result.status);

  result = runMonitor({
    CODEX_CHANGED_FILES: 'src/fix.ts',
    CODEX_PR_BODY: 'Task mode: bugfix',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true }, productRelevantChanged: true }),
    CODEX_V085_STABILITY_JSON: v085Status({
      status: 'fail',
      bugfixEvidenceStatus: { status: 'fail', reasonCodes: ['bugfix_root_cause_missing'] },
    }),
  });
  assertCase('bugfix missing rootCause -> fail', result.status === 'fail' && result.reasonCodes.includes('bugfix_review_evidence_missing'), failures, cases, result.status);

  result = runMonitor({
    CODEX_CHANGED_FILES: 'src/feature.ts,tests/feature.test.ts',
    CODEX_PR_BODY: 'Task mode: feature\n\nDone when:\nFeature is covered.\n\nRisk summary:\nsmall.\n\nTest or verification evidence:\npass.',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true, testsChanged: true }, productRelevantChanged: true }),
    CODEX_PRODUCT_VERIFICATION_JSON: productStatus({ status: 'pass' }),
  });
  assertCase('feature product change with acceptance and verification -> pass', result.status === 'pass', failures, cases, result.status);

  result = runMonitor({
    CODEX_CHANGED_FILES: 'src/feature.ts,tests/feature.test.ts',
    CODEX_PR_BODY: 'Task mode: feature\n\nTest or verification evidence:\npass.',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true, testsChanged: true }, productRelevantChanged: true }),
    CODEX_PRODUCT_VERIFICATION_JSON: productStatus({ status: 'pass' }),
  });
  assertCase('feature product change without acceptance -> warning', result.status === 'warning' && result.reasonCodes.includes('feature_acceptance_criteria_missing'), failures, cases, result.status);

  result = runMonitor({
    CODEX_CHANGED_FILES: 'src/auth/session.ts,tests/auth.test.ts',
    CODEX_PR_BODY: 'Task mode: feature\n\nDone when:\nAuth works.\n\nTest or verification evidence:\npass.',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true, testsChanged: true }, productRelevantChanged: true }),
    CODEX_PRODUCT_VERIFICATION_JSON: productStatus({ status: 'pass' }),
  });
  assertCase('auth surface changed without negative test evidence -> manual_confirmation_required', result.status === 'manual_confirmation_required' && result.reasonCodes.includes('auth_surface_changed_without_negative_test_evidence'), failures, cases, result.status);

  result = runMonitor({
    CODEX_CHANGED_FILES: 'src/db/repository.ts,tests/repository.test.ts',
    CODEX_PR_BODY: 'Task mode: feature\n\nDone when:\nStorage works.\n\nTest or verification evidence:\npass.',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true, testsChanged: true }, productRelevantChanged: true }),
    CODEX_PRODUCT_VERIFICATION_JSON: productStatus({ status: 'pass' }),
  });
  assertCase('storage surface changed without integrity evidence -> manual_confirmation_required', result.status === 'manual_confirmation_required' && result.reasonCodes.includes('storage_surface_changed_without_integrity_evidence'), failures, cases, result.status);

  result = runMonitor({
    CODEX_CHANGED_FILES: 'src/view.ts',
    CODEX_PR_BODY: 'Task mode: feature\n\nDone when:\nUI works.\n\nTest or verification evidence:\npass.',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true }, productRelevantChanged: true }),
    CODEX_PRODUCT_VERIFICATION_JSON: productStatus({ status: 'pass' }),
  });
  assertCase('product change with no test and no reason -> warning or manual', ['warning', 'manual_confirmation_required'].includes(result.status) && result.reasonCodes.includes('product_change_without_test_or_reason'), failures, cases, result.status);

  result = runMonitor({
    CODEX_CHANGED_FILES: 'src/runtime.ts,tests/runtime.test.ts',
    CODEX_PR_BODY: 'Task mode: release_gate\n\nRuntime readiness claimed: yes\n\nRollback or stop condition:\nstop.\n\nTest or verification evidence:\npass.',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true, runtimeReadinessClaimed: true, testsChanged: true }, productRelevantChanged: true, runtimeReadinessClaimed: true }),
    CODEX_PRODUCT_VERIFICATION_JSON: productStatus({ status: 'pass' }),
    CODEX_V085_STABILITY_JSON: v085Status({
      status: 'fail',
      runtimeRiskRegisterStatus: { status: 'fail', reasonCodes: ['runtime_release_blocked_by_open_risk'] },
    }),
  });
  assertCase('runtime readiness with open releaseBlocking risk via v085 status -> fail', result.status === 'fail' && result.reasonCodes.includes('runtime_release_blocked_by_open_risk'), failures, cases, result.status);

  result = runMonitor({
    CODEX_CHANGED_FILES: Array.from({ length: 16 }, (_, i) => `src/file${i}.ts`).join(','),
    CODEX_DIFF_NUMSTAT: Array.from({ length: 16 }, (_, i) => `60\t0\tsrc/file${i}.ts`).join('\n'),
    CODEX_PR_BODY: 'Task mode: feature\n\nDone when:\nFeature works.',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true }, productRelevantChanged: true }),
    CODEX_PRODUCT_VERIFICATION_JSON: productStatus({ status: 'pass' }),
  });
  assertCase('large product diff without review scope -> manual_confirmation_required', result.status === 'manual_confirmation_required' && result.reasonCodes.includes('large_product_diff_requires_review_scope'), failures, cases, result.status);

  result = runMonitor({
    CODEX_CHANGED_FILES: 'package.json',
    CODEX_PR_BODY: 'Task mode: feature\n\nDone when:\nPackage updates.',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { packageChanged: true }, productRelevantChanged: true, packageOrLockfileChanged: true }),
    CODEX_PRODUCT_VERIFICATION_JSON: productStatus({ status: 'fail', reasonCodes: ['package_change_requires_package_verification'] }),
  });
  assertCase('package change with productVerificationStatus fail -> fail', result.status === 'fail', failures, cases, result.status);

  result = runMonitor({
    CODEX_CHANGED_FILES: 'src/unsafe.ts',
    CODEX_CODE_REVIEW_MONITOR_TEST_UNSAFE_SHAPE: '1',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true }, productRelevantChanged: true }),
  });
  assertCase('unsafe output shape in monitor result -> fail', result.status === 'fail' && result.reasonCodes.includes('review_monitor_safe_summary_invalid'), failures, cases, result.status);

  const script = runScript({
    CODEX_CHANGED_FILES: 'README.md',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { docsOnly: true }, productRelevantChanged: false }),
  });
  assertCase('script smoke-run exits zero', script.status === 0 && script.stdout.includes('codeReviewMonitorStatus'), failures, cases, script.stderr || script.status);

  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    v086SelfTestStatus: {
      status: failures.length ? 'fail' : 'pass',
      casesRun: cases.length,
      failures,
      cases,
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
    status: failures.length ? 'fail' : 'pass',
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildV086SelfTestReport();
    writeJsonReport(report, 'CODEX_V086_SELF_TEST_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('v086SelfTestStatus', 'fail', { failures: ['unexpected_error'] });
    writeJsonReport(report, 'CODEX_V086_SELF_TEST_REPORT');
    process.exit(1);
  }
}
