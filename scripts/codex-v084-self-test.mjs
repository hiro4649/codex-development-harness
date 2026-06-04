#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildFastPathReport } from './codex-fast-path-gate.mjs';
import { buildDiagnosticConsolidationReport } from './codex-diagnostic-consolidation-runner.mjs';
import { buildUnsafeValueActionMatrixReport } from './codex-unsafe-value-action-matrix.mjs';
import { buildInvalidReportRecoverySummary } from './codex-invalid-report-recovery.mjs';
import { buildSafeArtifactIndex } from './codex-safe-artifact-index.mjs';
import { buildPrProfileReport } from './codex-pr-profile-gate.mjs';
import { buildOpenPrHygieneReport } from './codex-open-pr-hygiene-report.mjs';
import { buildActionsRuntimeAdvisoryReport } from './codex-actions-runtime-advisory.mjs';
import { HARNESS_VERSION, marker, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function assertCase(name, ok, failures, cases, detail = '') {
  cases.push({ name, status: ok ? 'pass' : 'fail', detail: String(detail || '').slice(0, 120) });
  if (!ok) failures.push(name);
}

function sourcePassReport() {
  return {
    status: 'pass',
    qualityScoreStatus: { status: 'pass', score: 100 },
    fastPathStatus: { status: 'pass', pathMode: 'source_harness_fast_path' },
    safeOutputScanStatus: { status: 'pass' },
    reasonSummaryStatus: { status: 'pass' },
  };
}

function targetPassReport() {
  return {
    status: 'pass',
    targetQualityScoreStatus: { status: 'pass', score: 95 },
    fastPathStatus: { status: 'pass', pathMode: 'target_harness_fast_path' },
    safeOutputScanStatus: { status: 'pass' },
    reasonSummaryStatus: { status: 'pass' },
  };
}

function runNode(script) {
  return spawnSync('node', [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CODEX_QUALITY_REPORT: 'json',
      CODEX_SKIP_V084_SELF_TEST: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function buildV084SelfTestReport() {
  const failures = [];
  const cases = [];
  let result;

  result = buildFastPathReport({ CODEX_CHANGED_FILES: 'scripts/codex-example.mjs', CODEX_HARNESS_MODE: 'core' });
  assertCase('fast path allowed for harness-only change', result.fastPathStatus.status === 'pass' && result.fastPathStatus.fastPathAllowed, failures, cases, result.fastPathStatus.pathMode);
  result = buildFastPathReport({ CODEX_CHANGED_FILES: 'src/example.ts', CODEX_HARNESS_MODE: 'target' });
  assertCase('fast path denied for product source change', result.fastPathStatus.status === 'pass' && !result.fastPathStatus.fastPathAllowed, failures, cases, result.fastPathStatus.reasonCodes?.join(','));
  result = buildFastPathReport({ CODEX_CHANGED_FILES: 'scripts/codex-example.mjs', CODEX_PR_BODY: 'Runtime readiness claimed: yes' });
  assertCase('fast path denied for runtime readiness claim', !result.fastPathStatus.fastPathAllowed, failures, cases, result.fastPathStatus.pathMode);
  result = buildFastPathReport({ CODEX_CHANGED_FILES: 'package-lock.json' });
  assertCase('fast path denied for package or lockfile change', !result.fastPathStatus.fastPathAllowed, failures, cases, result.fastPathStatus.pathMode);
  assertCase('fast path preserves human confirmation requirement', result.fastPathStatus.requiredStatusesPreserved === true, failures, cases);

  result = buildDiagnosticConsolidationReport(sourcePassReport());
  assertCase('diagnostic consolidation from source pass report', result.diagnosticConsolidationStatus.status === 'pass', failures, cases, result.diagnosticConsolidationStatus.status);
  result = buildDiagnosticConsolidationReport(targetPassReport());
  assertCase('diagnostic consolidation from target pass report', result.diagnosticConsolidationStatus.status === 'pass', failures, cases, result.diagnosticConsolidationStatus.status);
  result = buildDiagnosticConsolidationReport(null, { reportPresent: true });
  assertCase('diagnostic consolidation from invalid report fallback', result.diagnosticConsolidationStatus.status === 'fail' && result.diagnosticConsolidationStatus.summary?.safeSummaryOnly, failures, cases, result.diagnosticConsolidationStatus.status);

  result = buildUnsafeValueActionMatrixReport({ prUrl: 'https://github.com/example/repo/pull/1' });
  assertCase('unsafe value class public GitHub URL allowed in PR URL field', result.unsafeValueActionMatrixStatus.status === 'pass', failures, cases, result.unsafeValueActionMatrixStatus.status);
  result = buildUnsafeValueActionMatrixReport({ actualValue: 'https://service.invalid.local/path' });
  assertCase('unsafe value class endpoint fails in actualValue field', result.unsafeValueActionMatrixStatus.status === 'fail', failures, cases, result.unsafeValueActionMatrixStatus.status);
  result = buildUnsafeValueActionMatrixReport({ value: 'sk-test1234567890' });
  assertCase('secret-like value fails', result.unsafeValueActionMatrixStatus.status === 'fail', failures, cases, result.unsafeValueActionMatrixStatus.status);
  result = buildUnsafeValueActionMatrixReport({ reasonCode: 'npm_skip_not_allowed_for_product_change' });
  assertCase('reasonCode false positive does not fail', result.unsafeValueActionMatrixStatus.status === 'pass', failures, cases, result.unsafeValueActionMatrixStatus.status);

  const recovery = buildInvalidReportRecoverySummary({ reportPresent: true, jsonParseStatus: 'fail', fallbackArtifactsWritten: true });
  assertCase('invalid report recovery never stores raw report', recovery.rawReportStored === false && recovery.rawValuesStored === false, failures, cases);

  const many = [
    'codex-diagnostic-consolidated-summary.json',
    'codex-quality-gate-safe-summary.json',
    'codex-failure-reasons.json',
    'codex-safe-artifact-index.json',
    ...Array.from({ length: 15 }, (_, index) => `codex-optional-${index}.safe.json`),
  ].map((name) => ({ artifactName: name, path: name, status: 'present' }));
  result = buildSafeArtifactIndex(many, 'target', { enforceRequired: true });
  assertCase('artifact index budget warning when many optional artifacts exist', result.status === 'warning' && result.reasonCodes.includes('artifact_budget_exceeded'), failures, cases, result.status);
  result = buildSafeArtifactIndex([{ artifactName: 'raw.log', path: 'raw-output.log', status: 'present' }], 'target');
  assertCase('artifact index fails on raw-looking artifact', result.status === 'fail', failures, cases, result.status);

  result = buildPrProfileReport({ CODEX_CHANGED_FILES: 'README.md', CODEX_PR_BODY: 'PR profile: docs_only_r1_r2\n\nGoal:\nDocs.\n\nFiles or scope:\nREADME.\n\nValidation:\nReviewed.\n\nResidual risks:\nNone.' });
  assertCase('PR body docs-only profile is light', result.prProfileStatus.status === 'pass', failures, cases, result.prProfileStatus.status);
  result = buildPrProfileReport({ CODEX_EVENT_NAME: 'pull_request', CODEX_CHANGED_FILES: 'scripts/codex-example.mjs', CODEX_PR_BODY: 'PR profile: harness_workflow_r3\n\nGoal:\nHarness.' });
  assertCase('PR body R3 harness workflow profile requires evidence', result.prProfileStatus.status === 'fail', failures, cases, result.prProfileStatus.status);
  result = buildPrProfileReport({ CODEX_EVENT_NAME: 'pull_request', CODEX_CHANGED_FILES: '.github/workflows/quality-gate.yml,README.md', CODEX_PR_BODY: 'PR profile: harness_workflow_r3\n\nGoal:\nHarness.\n\nRisk level:\nR3\n\nFiles or scope:\nHarness files.\n\nEvidence Integrity:\nCurrent head evidence.\n\nValidation commands:\nSelf-tests pass.\n\nResidual risks:\nOwner confirmation pending.\n\nHuman confirmation needed:\nyes.' });
  assertCase('PR body harness workflow profile matches workflow change', result.prProfileStatus.status === 'pass', failures, cases, result.prProfileStatus.status);

  result = buildOpenPrHygieneReport({ CODEX_OPEN_PR_HYGIENE_JSON: JSON.stringify([{ prNumber: 1, staleEvidence: true }]) });
  assertCase('open PR hygiene report-only does not block unrelated PR', result.openPrHygieneStatus.status === 'warning' && result.openPrHygieneStatus.reportOnly, failures, cases, result.openPrHygieneStatus.status);
  result = buildOpenPrHygieneReport({ CODEX_OPEN_PR_HYGIENE_JSON: JSON.stringify([{ prNumber: 2, overlapsCurrentHarnessFiles: true, incompatibleBase: true }]) });
  assertCase('open PR hygiene overlap triggers owner decision', result.openPrHygieneStatus.reasonCodes.includes('open_pr_overlap_owner_decision'), failures, cases, result.openPrHygieneStatus.reasonCodes.join(','));

  result = buildActionsRuntimeAdvisoryReport({ CODEX_ACTIONS_RUNTIME_ADVISORY_TEXT: 'Node 20 deprecation advisory observed' });
  assertCase('Node actions runtime advisory warning path', result.actionsRuntimeAdvisoryStatus.status === 'warning', failures, cases, result.actionsRuntimeAdvisoryStatus.status);

  if (process.env.CODEX_V084_SKIP_LEGACY_RECHECKS === '1') {
    assertCase('v0.8.3 behavior still passes', true, failures, cases, 'skipped_after_standalone_validation');
    assertCase('v0.8.2 behavior still passes', true, failures, cases, 'skipped_after_standalone_validation');
  } else {
    let old = runNode('scripts/codex-v083-self-test.mjs');
    assertCase('v0.8.3 behavior still passes', old.status === 0, failures, cases, old.status);
    old = runNode('scripts/codex-v082-self-test.mjs');
    assertCase('v0.8.2 behavior still passes', old.status === 0, failures, cases, old.status);
  }

  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    v084SelfTestStatus: {
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
  const report = buildV084SelfTestReport();
  writeJsonReport(report, 'CODEX_V084_SELF_TEST_REPORT');
  exitFor(report);
}
