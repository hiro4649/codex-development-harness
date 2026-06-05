#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, writeJsonReport } from './codex-v080-lib.mjs';
import { evaluateWorkflowReport } from './codex-workflow-quality-runner.mjs';
import { buildWorkflowPreflight } from './codex-workflow-preflight.mjs';
import { buildRemoteProductBaselineReport } from './codex-remote-product-baseline-gate.mjs';
import { buildRemoteNpmDiagnosticReport } from './codex-remote-npm-diagnostic-classify.mjs';
import { buildProductVerificationReport } from './codex-product-verification-gate.mjs';
import { buildSafeArtifactIndex } from './codex-safe-artifact-index.mjs';
import { buildOpenPrHygieneReport } from './codex-open-pr-hygiene-report.mjs';
import { buildFinalSummary } from './codex-target-final-summary.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(here);

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

function run(script, env = {}) {
  const result = spawnSync(process.execPath, [path.join(repo, script), '--json'], {
    cwd: repo,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    return { code: result.status, parsed: JSON.parse(result.stdout || '{}') };
  } catch {
    return { code: result.status, parsed: null };
  }
}

function baseline(result = 'pass') {
  return JSON.stringify({
    schemaVersion: '0.8.3',
    harnessVersion: HARNESS_VERSION,
    repository: 'example/repo',
    baseSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    baselineType: 'npm_test',
    commands: [{ name: 'npm test', result }],
    result,
    date: '2026-05-24T00:00:00Z',
    source: 'fixture',
    safeSummary: 'safe baseline summary',
    knownFailures: result === 'fail' ? ['safe_known_failure'] : [],
    expiresAt: '2099-01-01T00:00:00Z',
    rawValuesStored: false,
    safeSummaryOnly: true,
  });
}

function staleBaseline() {
  const value = JSON.parse(baseline('pass'));
  value.expiresAt = '2000-01-01T00:00:00Z';
  return JSON.stringify(value);
}

function withTempCwd(callback) {
  const old = process.cwd();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v083-preflight-'));
  try {
    process.chdir(tmp);
    return callback(tmp);
  } finally {
    process.chdir(old);
  }
}

function assertCase(name, ok, failures, cases, status = ok ? 'pass' : 'fail') {
  cases.push({ name, status });
  if (!ok) failures.push(name);
}

function buildReport() {
  const failures = [];
  const cases = [];

  let result = evaluateWorkflowReport(sourcePassReport(), { eventName: 'workflow_dispatch' });
  assertCase('source runner still accepts pass report', result.status === 'pass', failures, cases, result.status);
  result = evaluateWorkflowReport(targetPassReport(), { eventName: 'pull_request' });
  assertCase('target runner still accepts pass report', result.status === 'pass', failures, cases, result.status);

  result = withTempCwd((tmp) => {
    fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'docs', 'process'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'scripts', 'codex-local-quality-gate.mjs'), '');
    fs.writeFileSync(path.join(tmp, 'scripts', 'codex-workflow-quality-runner.mjs'), '');
    fs.writeFileSync(path.join(tmp, 'CODEX_SOURCE_HARNESS_MANIFEST.json'), JSON.stringify({
      marker,
      harnessVersion: HARNESS_VERSION,
      sourceRepoMode: true,
      safeSummaryOnly: true,
    }));
    fs.copyFileSync(
      path.join(repo, 'docs', 'process', 'CODEX_CHANGE_CLASSIFICATION_RULES.json'),
      path.join(tmp, 'docs', 'process', 'CODEX_CHANGE_CLASSIFICATION_RULES.json'),
    );
    return buildWorkflowPreflight({ CODEX_HARNESS_SOURCE_REPO: '1', CODEX_HARNESS_MODE: 'core' });
  });
  assertCase('workflow preflight source mode pass', result.workflowPreflightStatus.status === 'pass', failures, cases, result.workflowPreflightStatus.status);
  result = withTempCwd((tmp) => {
    fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'docs', 'process'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'scripts', 'codex-local-quality-gate.mjs'), '');
    fs.writeFileSync(path.join(tmp, 'scripts', 'codex-workflow-quality-runner.mjs'), '');
    fs.writeFileSync(path.join(tmp, 'docs', 'process', 'CODEX_HARNESS_MANIFEST.json'), '{}');
    fs.copyFileSync(path.join(repo, 'docs', 'process', 'CODEX_CHANGE_CLASSIFICATION_RULES.json'), path.join(tmp, 'docs', 'process', 'CODEX_CHANGE_CLASSIFICATION_RULES.json'));
    return buildWorkflowPreflight({ CODEX_HARNESS_MODE: 'target' });
  });
  assertCase('workflow preflight target mode pass', result.workflowPreflightStatus.status === 'pass', failures, cases, result.workflowPreflightStatus.status);
  result = withTempCwd(() => buildWorkflowPreflight({ CODEX_HARNESS_MODE: 'target' }));
  assertCase('workflow preflight missing required file fails', result.workflowPreflightStatus.status === 'fail', failures, cases, result.workflowPreflightStatus.status);

  result = buildRemoteProductBaselineReport({ CODEX_EVENT_NAME: 'pull_request', CODEX_CHANGED_FILES: 'src/app.js', CODEX_REMOTE_PRODUCT_BASELINE_JSON: baseline('pass') });
  assertCase('remote product baseline valid pass', result.remoteProductBaselineStatus.status === 'pass', failures, cases, result.remoteProductBaselineStatus.status);
  result = buildRemoteProductBaselineReport({ CODEX_EVENT_NAME: 'pull_request', CODEX_CHANGED_FILES: 'src/app.js' });
  assertCase('remote product baseline missing fails for product change', result.remoteProductBaselineStatus.status === 'fail', failures, cases, result.remoteProductBaselineStatus.status);
  result = buildRemoteProductBaselineReport({ CODEX_EVENT_NAME: 'pull_request', CODEX_CHANGED_FILES: 'scripts/codex-local-quality-gate.mjs' });
  assertCase('remote product baseline not required for harness-only', result.remoteProductBaselineStatus.status === 'not_applicable', failures, cases, result.remoteProductBaselineStatus.status);
  result = buildRemoteProductBaselineReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_CHANGED_FILES: 'README.md',
    CODEX_PR_BODY: '## Performance Evidence\nNo performance claim is made.',
  });
  assertCase('performance evidence denial does not require baseline', result.remoteProductBaselineStatus.status === 'not_applicable', failures, cases, result.remoteProductBaselineStatus.status);
  result = buildRemoteProductBaselineReport({ CODEX_EVENT_NAME: 'pull_request', CODEX_CHANGED_FILES: 'src/app.js', CODEX_REMOTE_PRODUCT_BASELINE_JSON: staleBaseline() });
  assertCase('stale baseline fails', result.remoteProductBaselineStatus.status === 'fail', failures, cases, result.remoteProductBaselineStatus.status);

  result = buildProductVerificationReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_CHANGED_FILES: 'src/app.js',
    CODEX_PRODUCT_VERIFICATION_COMMANDS: 'npm test',
    CODEX_PRODUCT_VERIFICATION_RESULT: 'fail',
    CODEX_REMOTE_PRODUCT_BASELINE_JSON: baseline('fail'),
  });
  assertCase('baseline fail plus npm fail is baseline_failure', result.productVerificationStatus.reasonCodes.includes('baseline_failure'), failures, cases, result.productVerificationStatus.status);
  result = buildProductVerificationReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_CHANGED_FILES: 'src/app.js',
    CODEX_PRODUCT_VERIFICATION_COMMANDS: 'npm test',
    CODEX_PRODUCT_VERIFICATION_RESULT: 'fail',
    CODEX_REMOTE_PRODUCT_BASELINE_JSON: baseline('pass'),
  });
  assertCase('baseline pass plus npm fail is candidate_regression', result.productVerificationStatus.reasonCodes.includes('candidate_regression'), failures, cases, result.productVerificationStatus.status);

  result = buildRemoteNpmDiagnosticReport({ CODEX_NPM_SAFE_FAILURE_CATEGORY: 'lint_failure', CODEX_NPM_EXIT_CODE: '1' });
  assertCase('npm diagnostic safe categories pass', result.remoteNpmDiagnosticStatus.status === 'pass', failures, cases, result.remoteNpmDiagnosticStatus.status);
  result = buildRemoteNpmDiagnosticReport({ CODEX_NPM_SAFE_FAILURE_CATEGORY: 'not_a_category', CODEX_NPM_EXIT_CODE: '1' });
  assertCase('unknown_npm_failure is warning or manual, not silent pass', result.remoteNpmDiagnosticStatus.status === 'manual_confirmation_required', failures, cases, result.remoteNpmDiagnosticStatus.status);
  const unsafeNpm = path.join(os.tmpdir(), `codex-v083-unsafe-npm-${Date.now()}.json`);
  fs.writeFileSync(unsafeNpm, JSON.stringify({ rawLogs: 'stored raw output' }));
  result = buildRemoteNpmDiagnosticReport({ CODEX_NPM_TEST_SAFE_SUMMARY_PATH: unsafeNpm });
  assertCase('npm diagnostic with raw log field fails', result.remoteNpmDiagnosticStatus.status === 'fail', failures, cases, result.remoteNpmDiagnosticStatus.status);

  result = buildSafeArtifactIndex([{ artifactName: 'codex-quality-gate-safe-summary.json', path: 'codex-quality-gate-safe-summary.json', status: 'present' }], 'target');
  assertCase('safe artifact index lists all artifacts', result.status === 'pass' && result.artifacts.length === 1, failures, cases, result.status);
  result = buildSafeArtifactIndex([{ artifactName: 'raw.log', path: 'raw-output.log', status: 'present' }], 'target');
  assertCase('artifact index rejects raw-looking artifact', result.status === 'fail', failures, cases, result.status);

  result = buildOpenPrHygieneReport({ CODEX_OPEN_PR_HYGIENE_JSON: JSON.stringify([{ prNumber: 12, staleEvidence: true, needsOwnerDecision: true }]) });
  assertCase('open PR hygiene report flags stale evidence', result.openPrHygieneStatus.status === 'warning', failures, cases, result.openPrHygieneStatus.status);
  assertCase('open PR hygiene report is report-only', result.openPrHygieneStatus.reportOnly === true, failures, cases);

  result = buildFinalSummary(targetPassReport(), 'target');
  assertCase('target final summary has no unsafe values', result.status === 'pass' && result.summary.safeSummaryOnly, failures, cases, result.status);

  if (process.env.CODEX_V083_SKIP_LEGACY_RECHECKS === '1') {
    assertCase('v0.8.2 behavior still passes', true, failures, cases, 'skipped_after_standalone_validation');
    assertCase('v0.8.1 behavior still passes', true, failures, cases, 'skipped_after_standalone_validation');
  } else {
    result = run('scripts/codex-v082-self-test.mjs', { CODEX_QUALITY_REPORT: 'json', CODEX_SKIP_V083_SELF_TEST: '1' });
    assertCase('v0.8.2 behavior still passes', result.parsed?.v082SelfTestStatus?.status === 'pass', failures, cases, result.parsed?.v082SelfTestStatus?.status);
    result = run('scripts/codex-v081-self-test.mjs', { CODEX_QUALITY_REPORT: 'json', CODEX_SKIP_V082_SELF_TEST: '1', CODEX_SKIP_V083_SELF_TEST: '1' });
    assertCase('v0.8.1 behavior still passes', result.parsed?.v081SelfTestStatus?.status === 'pass', failures, cases, result.parsed?.v081SelfTestStatus?.status);
  }

  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    v083SelfTestStatus: { status: failures.length ? 'fail' : 'pass', cases, failures, safeSummaryOnly: true },
    valuesPrinted: false,
    status: failures.length ? 'fail' : 'pass',
    safeSummary: failures.length ? 'v0.8.3 self-test failed; see safe labels.' : 'v0.8.3 self-test passed.',
  };
}

try {
  const report = buildReport();
  writeJsonReport(report, 'CODEX_V083_SELF_TEST_REPORT');
  process.exit(report.status === 'fail' ? 1 : 0);
} catch {
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    v083SelfTestStatus: { status: 'fail', failures: ['unexpected_error'], safeSummaryOnly: true },
    valuesPrinted: false,
    status: 'fail',
  };
  writeJsonReport(report, 'CODEX_V083_SELF_TEST_REPORT');
  process.exit(1);
}
