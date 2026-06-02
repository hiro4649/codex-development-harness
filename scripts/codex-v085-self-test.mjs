#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { HARNESS_VERSION, marker, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildV085StabilityReport } from './codex-v085-stability-gate.mjs';
import { buildFastPathReport } from './codex-fast-path-gate.mjs';

function assertCase(name, ok, failures, cases, detail = '') {
  cases.push({ name, status: ok ? 'pass' : 'fail', detail: String(detail || '').slice(0, 120) });
  if (!ok) failures.push(name);
}

function env(overrides = {}) {
  return {
    CODEX_QUALITY_REPORT: 'json',
    CODEX_HARNESS_MODE: 'target',
    CODEX_PR_BODY: '',
    CODEX_CHANGED_FILES: '',
    ...overrides,
  };
}

function classification(value) {
  return JSON.stringify({ changeClassificationStatus: value });
}

function productStatus(value) {
  return JSON.stringify({ productVerificationStatus: value });
}

function fastPath(value) {
  return JSON.stringify({ fastPathStatus: value });
}

async function runV085(overrides) {
  return (await buildV085StabilityReport(env(overrides))).v085StabilityStatus;
}

function runNode(script) {
  return spawnSync('node', [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CODEX_QUALITY_REPORT: 'json',
      CODEX_SKIP_V085_SELF_TEST: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export async function buildV085SelfTestReport() {
  const failures = [];
  const cases = [];
  let result;

  result = await runV085({});
  assertCase('no PR context -> not_applicable', result.taskDisciplineStatus.status === 'not_applicable', failures, cases, result.taskDisciplineStatus.status);

  result = await runV085({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_BODY: 'PR profile: harness_workflow_r3\n\nTask mode: harness_change\n\nGoal:\nHarness.\n\nRisk level:\nR3\n\nFiles or scope:\nHarness files.\n\nEvidence Integrity:\nCurrent head evidence.\n\nValidation commands:\nSelf-test pass.\n\nResidual risks:\nNone.\n\nHuman confirmation needed:\nyes.',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { harnessOnly: true }, productRelevantChanged: false }),
    CODEX_FAST_PATH_JSON: fastPath({ status: 'pass', fastPathAllowed: true, pathMode: 'target_harness_fast_path' }),
  });
  assertCase('harness-only change with no product claim -> pass', result.status === 'pass', failures, cases, result.status);

  result = await runV085({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_BODY: 'Goal:\nDocs.',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { docsOnly: true }, productRelevantChanged: false }),
  });
  assertCase('docs-only change with missing task mode -> warning, not fail', result.taskDisciplineStatus.status === 'warning' && result.status !== 'fail', failures, cases, result.status);

  result = await runV085({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_BODY: 'Goal:\nProduct.',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true }, productRelevantChanged: true }),
  });
  assertCase('productRelevantChanged with missing task mode -> manual_confirmation_required', result.taskDisciplineStatus.status === 'manual_confirmation_required', failures, cases, result.taskDisciplineStatus.status);

  const goodBugfixEvidence = {
    codexBugFixEvidence: {
      schemaVersion: '0.8.5',
      reproductionStatus: 'reproduced',
      rootCause: { status: 'identified' },
      fixScope: { unrelatedChangesIncluded: false },
      verification: { status: 'pass' },
      regressionTest: { present: true },
    },
  };
  result = await runV085({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_RISK_LEVEL: 'R3',
    CODEX_CHANGED_FILES: 'src/example.ts',
    CODEX_PR_BODY: 'PR profile: product_r3\n\nTask mode: bugfix\n\nGoal:\nFix.\n\nRisk level:\nR3\n\nProduct verification:\nFocused check.\n\nAffected entrypoints:\nSafe label.\n\nFailure paths considered:\nSafe label.\n\nResidual risks:\nNone.\n\nHuman confirmation needed:\nyes.',
    CODEX_BUGFIX_EVIDENCE_JSON: JSON.stringify(goodBugfixEvidence),
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true }, productRelevantChanged: true }),
  });
  assertCase('bugfix with reproduction/rootCause/verification -> pass', result.bugfixEvidenceStatus.status === 'pass', failures, cases, result.bugfixEvidenceStatus.status);

  result = await runV085({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_BODY: 'Task mode: bugfix',
    CODEX_BUGFIX_EVIDENCE_JSON: JSON.stringify({ codexBugFixEvidence: { rootCause: { status: 'identified' }, verification: { status: 'pass' } } }),
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true }, productRelevantChanged: true }),
  });
  assertCase('bugfix missing reproduction -> fail', result.bugfixEvidenceStatus.status === 'fail' && result.bugfixEvidenceStatus.reasonCodes.includes('bugfix_reproduction_missing'), failures, cases, result.bugfixEvidenceStatus.status);

  result = await runV085({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_BODY: 'Task mode: bugfix',
    CODEX_BUGFIX_EVIDENCE_JSON: JSON.stringify({ codexBugFixEvidence: { reproductionStatus: 'reproduced', verification: { status: 'pass' } } }),
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true }, productRelevantChanged: true }),
  });
  assertCase('bugfix missing rootCause -> fail', result.bugfixEvidenceStatus.status === 'fail' && result.bugfixEvidenceStatus.reasonCodes.includes('bugfix_root_cause_missing'), failures, cases, result.bugfixEvidenceStatus.status);

  result = await runV085({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_BODY: 'Task mode: bugfix',
    CODEX_BUGFIX_EVIDENCE_JSON: JSON.stringify({ codexBugFixEvidence: { reproductionStatus: 'reproduced', rootCause: { status: 'unknown' }, verification: { status: 'pass' } } }),
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true }, productRelevantChanged: true }),
  });
  assertCase('bugfix with rootCause unknown and code change -> fail', result.bugfixEvidenceStatus.status === 'fail', failures, cases, result.bugfixEvidenceStatus.reasonCodes.join(','));

  result = await runV085({ CODEX_HARNESS_SOURCE_REPO: '1' });
  assertCase('optional import smoke config absent -> not_applicable', result.importSmokeMicroStatus.status === 'not_applicable', failures, cases, result.importSmokeMicroStatus.status);

  result = await runV085({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_IMPORT_SMOKE_CONFIG_JSON: JSON.stringify({ criticalImports: 'bad' }),
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true }, productRelevantChanged: true }),
  });
  assertCase('import smoke config invalid -> warning or fail based on context', ['warning', 'fail'].includes(result.importSmokeMicroStatus.status), failures, cases, result.importSmokeMicroStatus.status);

  result = await runV085({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_IMPORT_SMOKE_CONFIG_JSON: JSON.stringify({ maxRuntimeMs: 500, criticalImports: [{ name: 'lib', specifier: 'node:fs', safeToImport: true, expectedExports: ['notThere'] }] }),
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { productSourceChanged: true }, productRelevantChanged: true }),
  });
  assertCase('import smoke configured and export missing -> fail when product/runtime relevant', result.importSmokeMicroStatus.status === 'fail', failures, cases, result.importSmokeMicroStatus.status);

  result = await runV085({
    CODEX_RUNTIME_RISK_REGISTER_JSON: JSON.stringify({ risks: [{ id: 'risk-1', severity: 'P1', status: 'open', releaseBlocking: true, evidenceRequired: ['safe evidence'], affectedAreas: ['runtime'] }] }),
    CODEX_PR_BODY: 'Task mode: release_gate\nRuntime readiness claimed: yes',
    CODEX_CHANGE_CLASSIFICATION_JSON: classification({ status: 'pass', classification: { runtimeReadinessClaimed: true }, runtimeReadinessClaimed: true, productRelevantChanged: false }),
  });
  assertCase('runtime risk register open P1 plus runtime readiness claim -> fail', result.runtimeRiskRegisterStatus.status === 'fail', failures, cases, result.runtimeRiskRegisterStatus.status);

  result = await runV085({
    CODEX_RUNTIME_RISK_REGISTER_CHANGED: '1',
    CODEX_RUNTIME_RISK_REGISTER_JSON: JSON.stringify({ risks: [{ id: 'risk-2', severity: 'P1', status: 'closed', releaseBlocking: true, evidenceRequired: ['safe evidence'], affectedAreas: ['runtime'] }] }),
  });
  assertCase('runtime risk closed without evidence -> fail', result.runtimeRiskRegisterStatus.status === 'fail', failures, cases, result.runtimeRiskRegisterStatus.status);

  result = await runV085({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_CHANGED_FILES: '.github/workflows/quality-gate.yml,README.md',
    CODEX_PR_BODY: 'PR profile: docs_only_r1_r2\n\nGoal:\nDocs.',
  });
  assertCase('PR profile conflict -> prProfileAssistStatus warning with allowedProfiles and missingSections', result.prProfileAssistStatus.status === 'warning' && result.prProfileAssistStatus.allowedProfiles.length > 0, failures, cases, result.prProfileAssistStatus.status);

  result = await runV085({
    CODEX_PRODUCT_VERIFICATION_JSON: productStatus({ status: 'fail', reasonCodes: ['npm_skip_not_allowed_for_product_change'] }),
  });
  assertCase('product verification fail -> productEvidenceExplainStatus includes one clear failure class', result.productEvidenceExplainStatus.explanation.skipNotAllowed === true, failures, cases, result.productEvidenceExplainStatus.nextBestFix);

  const fast = buildFastPathReport({ CODEX_CHANGED_FILES: 'src/example.ts', CODEX_HARNESS_MODE: 'target' }).fastPathStatus;
  assertCase('fast path denied -> decision=denied_full_verification_required', fast.decision === 'denied_full_verification_required' && fast.mergeInterpretation === 'full_verification_required', failures, cases, fast.decision);

  if (process.env.CODEX_V085_SKIP_LEGACY_RECHECKS === '1') {
    assertCase('v0.8.4 behavior still passes', true, failures, cases, 'skipped_after_standalone_validation');
  } else {
    const old = runNode('scripts/codex-v084-self-test.mjs');
    assertCase('v0.8.4 behavior still passes', old.status === 0, failures, cases, old.status);
  }

  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    v085SelfTestStatus: {
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
    const report = await buildV085SelfTestReport();
    writeJsonReport(report, 'CODEX_V085_SELF_TEST_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('v085SelfTestStatus', 'fail', { failures: ['unexpected_error'] });
    writeJsonReport(report, 'CODEX_V085_SELF_TEST_REPORT');
    process.exit(1);
  }
}
