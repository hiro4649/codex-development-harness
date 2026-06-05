#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, writeJsonReport } from './codex-v080-lib.mjs';
import { evaluateWorkflowReport } from './codex-workflow-quality-runner.mjs';
import { classifyChange, loadClassificationRules } from './codex-change-classification-gate.mjs';
import { buildProductVerificationReport } from './codex-product-verification-gate.mjs';
import { buildProductVerificationEvidenceReport } from './codex-product-verification-evidence-normalize.mjs';
import { buildTestMetricsReport } from './codex-test-metrics-collect.mjs';
import { buildStalePrAuditReport } from './codex-stale-pr-audit-gate.mjs';
import { buildCompactReasonSummary } from './codex-reason-summary.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(here);

function run(script, options = {}) {
  const result = spawnSync(process.execPath, [path.join(repo, script), '--json'], {
    cwd: options.cwd || repo,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    return { code: result.status, parsed: JSON.parse(result.stdout || '{}') };
  } catch {
    return { code: result.status, parsed: null };
  }
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function assertCase(name, ok, failures, cases, status = ok ? 'pass' : 'fail') {
  cases.push({ name, status });
  if (!ok) failures.push(name);
}

function passStatus(status = 'pass') {
  return { status, safeSummaryOnly: true, reasonCodes: [] };
}

function sourcePassReport() {
  const report = {
    status: 'pass',
    mergeReady: true,
    humanReviewRequired: false,
    qualityScoreStatus: { status: 'pass', score: 100, safeSummaryOnly: true },
  };
  for (const key of [
    'sourceHarnessValidationStatus',
    'profileTemplateCompatibilityStatus',
    'genericHarnessCoreStatus',
    'agentsContextStatus',
    'environmentReadinessStatus',
    'goldenSetStatus',
    'changeClassificationStatus',
    'productVerificationStatus',
    'productVerificationEvidenceStatus',
    'testMetricsStatus',
    'remoteProductBaselineStatus',
    'remoteNpmDiagnosticStatus',
    'workflowPreflightStatus',
    'safeArtifactIndexStatus',
    'openPrHygieneStatus',
    'targetFinalSummaryStatus',
    'stalePrAuditStatus',
    'reasonSummaryStatus',
    'bestOfNEvidenceStatus',
    'taskQueueLiteStatus',
    'safeTraceSchemaStatus',
    'curatorReportStatus',
    'offlineEvolutionProposalStatus',
    'testCoverageEvidenceStatus',
    'performanceEvidenceStatus',
    'agentMemoryPolicyStatus',
    'skillLifecyclePolicyStatus',
    'curatorSuggestionStatus',
    'selfEvolutionPolicyStatus',
    'safeArtifactValidation',
    'outputShapeStatus',
    'openaiCodexMethodStatus',
    'methodSupportStatus',
    'productionReadinessStatus',
    'evidenceIntegrityStatus',
    'hermesInvariantStatus',
    'evidencePackStatus',
    'humanConfirmationObjectStatus',
    'safeOutputScanStatus',
    'ciReplayStatus',
    'prBodyLintStatus',
    'failureReasonCatalogStatus',
    'v071SelfTestStatus',
    'v072SelfTestStatus',
    'v080SelfTestStatus',
    'v081SelfTestStatus',
    'v082SelfTestStatus',
    'v083SelfTestStatus',
  ]) report[key] = passStatus();
  return report;
}

function targetPassReport() {
  const report = {
    status: 'pass',
    mergeReady: true,
    targetMergeReady: true,
    targetQualityScoreStatus: { status: 'pass', score: 100, safeSummaryOnly: true },
  };
  for (const key of [
    'targetManifestStatus',
    'secretScan',
    'agentsContextStatus',
    'environmentReadinessStatus',
    'changeClassificationStatus',
    'productVerificationStatus',
    'productVerificationEvidenceStatus',
    'testMetricsStatus',
    'remoteProductBaselineStatus',
    'remoteNpmDiagnosticStatus',
    'workflowPreflightStatus',
    'safeArtifactIndexStatus',
    'openPrHygieneStatus',
    'targetFinalSummaryStatus',
    'stalePrAuditStatus',
    'reasonSummaryStatus',
    'safeOutputScanStatus',
    'v080SelfTestStatus',
    'v081SelfTestStatus',
    'v082SelfTestStatus',
    'v083SelfTestStatus',
    'safeArtifactValidation',
    'outputShapeStatus',
  ]) report[key] = passStatus();
  return report;
}

function withRulesTmp(callback) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v082-'));
  fs.mkdirSync(path.join(tmp, 'docs', 'process'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'docs', 'process', 'CODEX_CHANGE_CLASSIFICATION_RULES.json'), path.join(tmp, 'docs', 'process', 'CODEX_CHANGE_CLASSIFICATION_RULES.json'));
  return callback(tmp);
}

function buildReport() {
  const failures = [];
  const cases = [];

  let result = evaluateWorkflowReport(sourcePassReport(), { eventName: 'workflow_dispatch' });
  assertCase('workflow runner accepts source pass report', result.status === 'pass', failures, cases, result.status);
  const failedSource = sourcePassReport();
  failedSource.agentsContextStatus = passStatus('fail');
  result = evaluateWorkflowReport(failedSource, { eventName: 'pull_request' });
  assertCase('workflow runner rejects source fail report', result.status === 'fail', failures, cases, result.status);
  result = evaluateWorkflowReport(targetPassReport(), { eventName: 'pull_request' });
  assertCase('workflow runner accepts target pass report', result.status === 'pass', failures, cases, result.status);
  const manualSource = sourcePassReport();
  manualSource.humanConfirmationObjectStatus = passStatus('manual_confirmation_required');
  result = evaluateWorkflowReport(manualSource, { eventName: 'pull_request' });
  assertCase('workflow runner preserves manual_confirmation_required', result.status === 'fail', failures, cases, result.status);

  result = withRulesTmp((tmp) => loadClassificationRules({ CODEX_CHANGE_CLASSIFICATION_RULES_PATH: path.join(tmp, 'docs', 'process', 'CODEX_CHANGE_CLASSIFICATION_RULES.json') }));
  assertCase('change classification rules JSON loads', result.ok, failures, cases, result.ok ? 'pass' : result.reasonCode);
  result = loadClassificationRules({ CODEX_CHANGE_CLASSIFICATION_RULES_PATH: path.join(os.tmpdir(), 'missing-rules.json') });
  assertCase('missing classification rules JSON fails in PR context', result.ok === false && result.reasonCode === 'classification_rules_missing', failures, cases, result.reasonCode);

  let classified = classifyChange(['scripts/run-tests.js'], { CODEX_EVENT_NAME: 'pull_request' });
  assertCase('scripts/run-tests.js classified as verification-relevant', classified.productRelevantChanged, failures, cases, classified.status);
  classified = classifyChange(['package-lock.json'], { CODEX_EVENT_NAME: 'pull_request' });
  assertCase('package-lock file is package/lock relevant', classified.packageOrLockfileChanged, failures, cases, classified.status);
  classified = classifyChange(['unknown.safe'], { CODEX_EVENT_NAME: 'pull_request' });
  assertCase('unknown file fails in PR context', classified.status === 'fail', failures, cases, classified.status);
  classified = classifyChange(['scripts/codex-local-quality-gate.mjs'], { CODEX_EVENT_NAME: 'pull_request' });
  assertCase('harness-only changed files classify as harnessOnly', classified.classification.harnessOnly, failures, cases, classified.status);
  classified = classifyChange(['README.md'], { CODEX_EVENT_NAME: 'pull_request' });
  assertCase('docs-only changed files classify as docsOnly', classified.classification.docsOnly, failures, cases, classified.status);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v082-override-'));
  write(path.join(tmp, 'docs', 'process', 'CODEX_CHANGE_CLASSIFICATION_RULES.json'), fs.readFileSync(path.join(repo, 'docs', 'process', 'CODEX_CHANGE_CLASSIFICATION_RULES.json'), 'utf8'));
  write(path.join(tmp, 'docs', 'process', 'CODEX_CHANGE_CLASSIFICATION_RULES.local.json'), JSON.stringify({
    authorityFiles: ['PROJECT_AUTHORITY.md'],
  }, null, 2));
  const oldCwd = process.cwd();
  process.chdir(tmp);
  classified = classifyChange(['PROJECT_AUTHORITY.md'], { CODEX_EVENT_NAME: 'pull_request' });
  process.chdir(oldCwd);
  assertCase('local override can add a repo-specific authority file safely', classified.classification.authorityChanged, failures, cases, classified.status);

  result = buildProductVerificationEvidenceReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_SKIP_NPM: '1',
    CODEX_CHANGED_FILES: 'scripts/codex-local-quality-gate.mjs',
    CODEX_NPM_SKIP_REASON: 'harness-only',
  });
  assertCase('harness-only change with CODEX_SKIP_NPM=1 passes through normalized evidence', result.productVerificationEvidenceStatus.status === 'pass', failures, cases, result.productVerificationEvidenceStatus.status);
  result = buildProductVerificationReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_SKIP_NPM: '1',
    CODEX_CHANGED_FILES: 'src/app.js',
  });
  assertCase('product src change with CODEX_SKIP_NPM=1 fails through normalized evidence', result.productVerificationStatus.status === 'fail', failures, cases, result.productVerificationStatus.status);
  result = buildProductVerificationReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_SKIP_NPM: '1',
    CODEX_CHANGED_FILES: 'scripts/codex-local-quality-gate.mjs',
    CODEX_PR_BODY: 'Runtime readiness claimed: yes.',
  });
  assertCase('runtime readiness claim with CODEX_SKIP_NPM=1 fails', result.productVerificationStatus.status === 'fail', failures, cases, result.productVerificationStatus.status);
  result = buildProductVerificationReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_CHANGED_FILES: 'package-lock.json',
  });
  assertCase('package/lockfile change without evidence fails', result.productVerificationStatus.status === 'fail', failures, cases, result.productVerificationStatus.status);
  result = buildProductVerificationReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_CHANGED_FILES: 'src/app.js',
    CODEX_PRODUCT_VERIFICATION_COMMANDS: 'npm test',
    CODEX_PRODUCT_VERIFICATION_RESULT: 'pass',
    CODEX_REMOTE_PRODUCT_BASELINE_JSON: JSON.stringify({
      schemaVersion: '0.8.3',
      harnessVersion: HARNESS_VERSION,
      repository: 'example/repo',
      baseSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      baselineType: 'npm_test',
      commands: [{ name: 'npm test', result: 'pass' }],
      result: 'pass',
      date: '2026-05-24T00:00:00Z',
      source: 'fixture',
      safeSummary: 'safe baseline summary',
      knownFailures: [],
      expiresAt: '2099-01-01T00:00:00Z',
      rawValuesStored: false,
      safeSummaryOnly: true,
    }),
  });
  assertCase('npm test pass evidence with duration/testCount normalizes to pass', result.productVerificationStatus.status === 'pass', failures, cases, result.productVerificationStatus.status);
  const unsafeEvidence = path.join(os.tmpdir(), `codex-unsafe-evidence-${Date.now()}.json`);
  write(unsafeEvidence, JSON.stringify({ rawLogs: 'stored output' }));
  result = buildProductVerificationEvidenceReport({ CODEX_PRODUCT_VERIFICATION_EVIDENCE_PATH: unsafeEvidence });
  assertCase('unsafe evidence field fails safe output', result.productVerificationEvidenceStatus.status === 'fail', failures, cases, result.productVerificationEvidenceStatus.status);

  const metricsFile = path.join(os.tmpdir(), `codex-safe-metrics-${Date.now()}.json`);
  write(metricsFile, JSON.stringify({ command: 'npm test', result: 'pass', durationMs: 123, testCount: 4, safeSummary: 'safe metrics' }));
  result = buildTestMetricsReport({ CODEX_TEST_METRICS_INPUT_PATH: metricsFile });
  assertCase('safe npm metrics pass', result.testMetricsStatus.status === 'pass', failures, cases, result.testMetricsStatus.status);
  const unsafeMetricsFile = path.join(os.tmpdir(), `codex-unsafe-metrics-${Date.now()}.json`);
  write(unsafeMetricsFile, JSON.stringify({ command: 'npm test', result: 'pass', rawLogs: 'stored raw output' }));
  result = buildTestMetricsReport({ CODEX_TEST_METRICS_INPUT_PATH: unsafeMetricsFile });
  assertCase('metrics with raw logs fail', result.testMetricsStatus.status === 'fail', failures, cases, result.testMetricsStatus.status);

  result = run('scripts/codex-performance-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'This change is faster.' } });
  assertCase('performance claim without baseline/new metrics fails', result.parsed?.performanceEvidenceStatus?.status === 'fail', failures, cases, result.parsed?.performanceEvidenceStatus?.status);
  const perfMetricsFile = path.join(os.tmpdir(), `codex-perf-metrics-${Date.now()}.json`);
  write(perfMetricsFile, JSON.stringify({ baselineSummary: 'old safe baseline', newMeasurementSummary: 'new safe measurement' }));
  result = run('scripts/codex-performance-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'This change is faster.', CODEX_TEST_METRICS_PATH: perfMetricsFile } });
  assertCase('performance claim with safe baseline/new metrics passes', result.parsed?.performanceEvidenceStatus?.status === 'pass', failures, cases, result.parsed?.performanceEvidenceStatus?.status);

  const staleBody = 'BEGIN_CODEX_MANUAL_CONFIRMATION_JSON\n{\"codexManualConfirmation\":{\"headSha\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}}\nEND_CODEX_MANUAL_CONFIRMATION_JSON';
  result = buildStalePrAuditReport({ CODEX_EVENT_NAME: 'pull_request', CODEX_PR_HEAD_SHA: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', CODEX_PR_BODY: staleBody });
  assertCase('stale confirmation fails', result.stalePrAuditStatus.status === 'fail', failures, cases, result.stalePrAuditStatus.status);
  result = buildStalePrAuditReport({ CODEX_EVENT_NAME: 'pull_request', CODEX_PR_HEAD_SHA: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', CODEX_PR_BODY: '"headSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"' });
  assertCase('stale evidence fails', result.stalePrAuditStatus.status === 'fail', failures, cases, result.stalePrAuditStatus.status);
  result = buildStalePrAuditReport({ CODEX_EVENT_NAME: 'pull_request', CODEX_PR_HEAD_SHA: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', CODEX_PR_BODY: '"headSha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"' });
  assertCase('fresh current-head evidence passes', result.stalePrAuditStatus.status === 'pass', failures, cases, result.stalePrAuditStatus.status);
  result = buildStalePrAuditReport({});
  assertCase('no PR context returns not_applicable', result.stalePrAuditStatus.status === 'not_applicable', failures, cases, result.stalePrAuditStatus.status);

  result = buildCompactReasonSummary({ status: 'fail', targetQualityScoreStatus: { status: 'fail', score: 70 }, failures: [{ id: 'workflow_runner_failed', message: 'safe failure' }] });
  assertCase('compact reason summary contains no unsafe values', result.status === 'pass' && result.summary.safeSummaryOnly, failures, cases, result.status);

  result = run('scripts/codex-v081-self-test.mjs', { env: { CODEX_QUALITY_REPORT: 'json', CODEX_SKIP_V082_SELF_TEST: '1' } });
  assertCase('v0.8.1 core behavior still passes', result.parsed?.v081SelfTestStatus?.status === 'pass', failures, cases, result.parsed?.v081SelfTestStatus?.status);

  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    v082SelfTestStatus: { status: failures.length ? 'fail' : 'pass', cases, failures, safeSummaryOnly: true },
    valuesPrinted: false,
    status: failures.length ? 'fail' : 'pass',
    safeSummary: failures.length ? 'v0.8.2 self-test failed; see safe labels.' : 'v0.8.2 self-test passed.',
  };
}

try {
  const report = buildReport();
  writeJsonReport(report, 'CODEX_V082_SELF_TEST_REPORT');
  process.exit(report.status === 'fail' ? 1 : 0);
} catch {
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    v082SelfTestStatus: { status: 'fail', failures: ['unexpected_error'], safeSummaryOnly: true },
    valuesPrinted: false,
    status: 'fail',
  };
  writeJsonReport(report, 'CODEX_V082_SELF_TEST_REPORT');
  process.exit(1);
}
