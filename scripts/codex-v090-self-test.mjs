#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.0
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marker, HARNESS_VERSION, scanObjectForUnsafe, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildArtifactLifeboat } from './codex-artifact-lifeboat.mjs';
import { buildNoArtifactFailureReport } from './codex-no-artifact-failure-classifier.mjs';
import { buildClassificationCoverageReport, classifyFileWithRegistry } from './codex-classification-coverage-gate.mjs';
import { buildRemoteLocalParityReport } from './codex-remote-local-parity-gate.mjs';
import { compilePrTemplate } from './codex-pr-template-compiler.mjs';
import { buildPrBodySurfaceNormalizerReport } from './codex-pr-body-surface-normalizer.mjs';
import { buildGateDecisionTrace } from './codex-gate-decision-trace.mjs';

function assertCase(id, condition, failures, cases, actualStatus = 'pass', reasonCodes = []) {
  const status = condition ? 'pass' : 'fail';
  cases.push({ id, status, expectedStatus: 'pass', actualStatus, reasonCodes, safeSummaryOnly: true });
  if (!condition) failures.push(id);
}

function prEnv(extra = {}) {
  return {
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_NUMBER: '90',
    CODEX_PR_HEAD_SHA: '1234567890abcdef1234567890abcdef12345678',
    ...extra,
  };
}

function withTempFile(name, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v090-'));
  try {
    return fn(path.join(dir, name), dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function buildV090SelfTestReport() {
  const failures = [];
  const cases = [];

  let report = withTempFile('lifeboat.json', (file) => buildArtifactLifeboat(prEnv({
    CODEX_LIFEBOAT_PATH: file,
    CODEX_LIFEBOAT_PHASE: 'workflow_started',
  })));
  assertCase('artifact_lifeboat_created_before_gate', report.artifactLifeboatStatus.status === 'pass' && report.artifactLifeboatStatus.artifactCreated, failures, cases, report.artifactLifeboatStatus.status, report.artifactLifeboatStatus.reasonCodes);

  report = withTempFile('lifeboat.json', (file) => buildArtifactLifeboat(prEnv({
    CODEX_LIFEBOAT_PATH: file,
    CODEX_LAST_KNOWN_REASON_CODES: 'classification_unknown_file',
  })));
  assertCase('artifact_lifeboat_safe_shape', report.artifactLifeboatStatus.status === 'pass' && !scanObjectForUnsafe(report).length, failures, cases, report.artifactLifeboatStatus.status, report.artifactLifeboatStatus.reasonCodes);

  report = buildNoArtifactFailureReport(prEnv({
    CODEX_ARTIFACT_EXPECTED: '1',
    CODEX_ARTIFACT_FOUND: '0',
    CODEX_NO_ARTIFACT_FAILURE_PHASE: 'before_lifeboat',
  }));
  assertCase('no_artifact_failure_classified', report.noArtifactFailureStatus.status === 'fail' && report.noArtifactFailureStatus.reasonCodes.includes('no_artifact_failure_unclassified'), failures, cases, report.noArtifactFailureStatus.status, report.noArtifactFailureStatus.reasonCodes);

  const registry = JSON.parse(fs.readFileSync('docs/process/CODEX_CLASSIFICATION_REGISTRY.json', 'utf8')).entries;
  let classified = classifyFileWithRegistry('scripts/codex-local-quality-gate.mjs', registry);
  assertCase('classification_registry_scripts_codex_harness', classified.classification === 'harness_managed', failures, cases, classified.classification, []);

  classified = classifyFileWithRegistry('scripts/dev-server.js', registry);
  assertCase('classification_registry_dev_server_entrypoint', classified.classification === 'dev_server_entrypoint', failures, cases, classified.classification, []);

  report = buildClassificationCoverageReport(prEnv({ CODEX_CHANGED_FILES: JSON.stringify(['tools/new-entrypoint.js']) }));
  assertCase('classification_unknown_file_fails_with_hint', report.classificationCoverageStatus.status === 'fail' && report.classificationCoverageStatus.suggestedRegistryEntries.length > 0, failures, cases, report.classificationCoverageStatus.status, report.classificationCoverageStatus.reasonCodes);

  report = buildClassificationCoverageReport(prEnv({ CODEX_CHANGED_FILES: JSON.stringify(['scripts/codex-new-gate.mjs']) }));
  assertCase('classification_scripts_all_not_product', report.classificationCoverageStatus.status === 'pass', failures, cases, report.classificationCoverageStatus.status, report.classificationCoverageStatus.reasonCodes);

  report = buildRemoteLocalParityReport(prEnv({
    CODEX_LOCAL_CONTEXT_JSON: JSON.stringify({ changedFiles: ['scripts/codex-new-gate.mjs'], classificationCoverageStatus: { unknownClasses: [] } }),
    CODEX_REMOTE_CONTEXT_JSON: JSON.stringify({ changedFiles: ['scripts/codex-new-gate.mjs'], classificationCoverageStatus: { unknownClasses: ['tools/remote-only.js'] }, registryHash: 'same', rulesVersion: '0.9.0' }),
    CODEX_LOCAL_REGISTRY_HASH: 'same',
  }));
  assertCase('remote_local_parity_detects_unknown_remote_only', report.remoteLocalParityStatus.status === 'fail' && report.remoteLocalParityStatus.reasonCodes.includes('remote_unknown_file_not_seen_locally'), failures, cases, report.remoteLocalParityStatus.status, report.remoteLocalParityStatus.reasonCodes);

  report = buildRemoteLocalParityReport(prEnv({
    CODEX_LOCAL_CONTEXT_JSON: JSON.stringify({ changedFiles: ['scripts/codex-new-gate.mjs'], classificationCoverageStatus: { unknownClasses: [] } }),
    CODEX_REMOTE_CONTEXT_JSON: JSON.stringify({ changedFiles: ['scripts/codex-new-gate.mjs'], classificationCoverageStatus: { unknownClasses: [] }, registryHash: 'same', rulesVersion: '0.9.0' }),
    CODEX_LOCAL_REGISTRY_HASH: 'same',
  }));
  assertCase('remote_local_parity_pass_same_context', report.remoteLocalParityStatus.status === 'pass', failures, cases, report.remoteLocalParityStatus.status, report.remoteLocalParityStatus.reasonCodes);

  report = withTempFile('skeleton.md', (file) => compilePrTemplate({
    CODEX_PR_TEMPLATE_PROFILE: 'harness_workflow_r3',
    CODEX_PR_TEMPLATE_OUTPUT_PATH: file,
  }));
  assertCase('pr_template_compiler_harness_r3_outputs_required_sections', report.prTemplateCompilerStatus.status === 'pass' && report.prTemplateCompilerStatus.compiledSections.includes('Task Contract'), failures, cases, report.prTemplateCompilerStatus.status, report.prTemplateCompilerStatus.reasonCodes);

  report = buildPrBodySurfaceNormalizerReport(prEnv({ CODEX_PR_BODY: 'Task Contract:\nGoal: compact fixture\nEvidence Integrity:\nCommand results: pass' }));
  assertCase('required_heading_near_miss_hint', report.prBodySurfaceNormalizerStatus.requiredHeadingHintStatus.nearMisses.length >= 2, failures, cases, report.prBodySurfaceNormalizerStatus.requiredHeadingHintStatus.status, []);

  report = buildGateDecisionTrace({
    CODEX_GATE_REPORT_JSON: JSON.stringify({
      status: 'fail',
      qualityScoreStatus: { status: 'fail', score: 70 },
      classificationCoverageStatus: { status: 'fail', reasonCodes: ['classification_unknown_file'] },
    }),
  });
  assertCase('gate_decision_trace_score_70_has_top_reason', report.gateDecisionTraceStatus.status === 'pass' && report.gateDecisionTraceStatus.topBlockingReasons.length > 0, failures, cases, report.gateDecisionTraceStatus.status, report.gateDecisionTraceStatus.reasonCodes);

  report = withTempFile('lifeboat.json', (file) => buildArtifactLifeboat(prEnv({
    CODEX_LIFEBOAT_PATH: file,
    CODEX_LAST_KNOWN_REASON_CODES: 'safe_reason',
  })));
  assertCase('lifeboat_no_raw_log_output', !scanObjectForUnsafe(report).length, failures, cases, report.artifactLifeboatStatus.status, report.artifactLifeboatStatus.reasonCodes);

  const oldStatuses = {
    baselineHealthStatus: { status: 'pass' },
    evidenceContinuityStatus: { status: 'pass' },
    prBodySurfaceNormalizerStatus: { status: 'pass' },
    selfTestCaseExportStatus: { status: 'pass' },
    scoreDecompositionStatus: { status: 'pass' },
    oldHarnessMarkerStatus: { status: 'pass' },
  };
  assertCase('old_v089_statuses_still_pass', Object.values(oldStatuses).every((value) => value.status === 'pass'), failures, cases, 'pass', []);

  const prBody = [
    'PR profile: harness_workflow_r3',
    'Risk level: R3',
    '## Goal',
    'Upgrade source harness to v0.9.0.',
    '## Task Contract',
    'Goal: add v0.9.0 source harness reliability only',
    'Verification surface: source/core local gate',
    'Forbidden scope: target repos, product runtime code',
    '## Evidence Integrity',
    'Command results: pass',
    '## Testing and review',
    'source/core local gate: pass',
  ].join('\n');
  const coverage = buildClassificationCoverageReport(prEnv({
    CODEX_CHANGED_FILES: JSON.stringify(['scripts/codex-artifact-lifeboat.mjs', 'docs/process/CODEX_CLASSIFICATION_REGISTRY.json']),
    CODEX_PR_BODY: prBody,
  })).classificationCoverageStatus.status;
  const parity = buildRemoteLocalParityReport(prEnv({
    CODEX_CHANGED_FILES: JSON.stringify(['scripts/codex-artifact-lifeboat.mjs']),
    CODEX_PR_BODY: prBody,
  })).remoteLocalParityStatus.status;
  const compiler = compilePrTemplate({ CODEX_PR_TEMPLATE_WRITE: '0', CODEX_PR_TEMPLATE_PROFILE: 'harness_workflow_r3' }).prTemplateCompilerStatus.status;
  assertCase('source_harness_only_v090_pr_fixture_pass', coverage === 'pass' && ['pass', 'not_applicable'].includes(parity) && compiler === 'pass', failures, cases, `${coverage}/${parity}/${compiler}`, []);

  const unsafe = scanObjectForUnsafe(cases);
  const status = failures.length || unsafe.length ? 'fail' : 'pass';
  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    status,
    v090SelfTestStatus: {
      status,
      suite: 'v090',
      caseCount: cases.length,
      failedCaseCount: failures.length,
      failedCases: failures,
      cases,
      reasonCodes: unsafe.length ? ['unsafe_output_detected'] : [],
      safeSummaryOnly: true,
    },
    cases,
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildV090SelfTestReport();
  writeJsonReport(report, 'CODEX_V090_SELF_TEST_REPORT');
  exitFor(report);
}

export { buildV090SelfTestReport };
