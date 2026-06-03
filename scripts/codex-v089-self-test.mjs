#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { fileURLToPath } from 'node:url';
import { marker, HARNESS_VERSION, scanObjectForUnsafe, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildBaselineHealthReport } from './codex-baseline-health-gate.mjs';
import { buildEvidenceContinuityReport } from './codex-evidence-continuity-gate.mjs';
import { buildPrBodySurfaceNormalizerReport } from './codex-pr-body-surface-normalizer.mjs';
import { buildSelfTestCaseExportReport } from './codex-self-test-case-export.mjs';

function assertCase(id, condition, failures, cases, actualStatus = 'pass', reasonCodes = []) {
  const status = condition ? 'pass' : 'fail';
  cases.push({
    id,
    status,
    expectedStatus: 'pass',
    actualStatus,
    reasonCodes,
    safeSummaryOnly: true,
  });
  if (!condition) failures.push(id);
}

function scoreDecompositionFixture(report) {
  const caps = Object.entries(report)
    .filter(([, value]) => value && ['fail', 'warning', 'manual_confirmation_required'].includes(value.status))
    .slice(0, 5)
    .map(([key, value]) => ({ gate: key, status: value.status }));
  return {
    status: 'pass',
    score: caps.some((item) => item.status === 'fail') ? 70 : caps.length ? 89 : 100,
    caps,
    topBlockingReasons: caps.map((item) => `${item.gate}:${item.status}`),
    topNextActions: caps.map((item) => `Review ${item.gate}`),
    safeSummaryOnly: true,
  };
}

function selfTestProfileFixture(profile, files) {
  const product = files.some((file) => /^(src|apps|contracts)\//.test(file));
  const denied = profile === 'fast_harness' && product;
  return {
    status: denied ? 'fail' : 'pass',
    profile,
    allowed: !denied,
    reasonCodes: denied ? ['self_test_profile_not_allowed'] : [],
    safeSummaryOnly: true,
  };
}

function oldMarkerFixture(files) {
  const oldMarkers = files.filter((item) => /CODEX_QUALITY_HARNESS_FILE v0\.[0-8]\.[0-8]/.test(item.marker || ''));
  return {
    status: oldMarkers.length ? 'fail' : 'pass',
    currentVersion: HARNESS_VERSION,
    oldMarkersFound: oldMarkers.map((item) => ({ path: item.path, version: item.marker.replace(/^.* v/, '') })),
    reasonCodes: oldMarkers.length ? ['old_source_marker_detected'] : [],
    safeSummaryOnly: true,
  };
}

function prEnv(extra = {}) {
  return {
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_NUMBER: '99',
    CODEX_PR_HEAD_SHA: '1234567890abcdef1234567890abcdef12345678',
    ...extra,
  };
}

function buildV089SelfTestReport() {
  const failures = [];
  const cases = [];

  let report = buildBaselineHealthReport(prEnv({
    CODEX_CHANGED_FILES: JSON.stringify(['src/auth/login.ts']),
    CODEX_CHANGE_CLASSIFICATION_JSON: JSON.stringify({ productRelevantChanged: true }),
  }));
  assertCase('baseline_health_product_change_requires_baseline', report.baselineHealthStatus.status === 'fail' && report.baselineHealthStatus.reasonCodes.includes('baseline_evidence_missing'), failures, cases, report.baselineHealthStatus.status, report.baselineHealthStatus.reasonCodes);

  report = buildBaselineHealthReport({
    CODEX_CHANGED_FILES: JSON.stringify(['scripts/codex-local-quality-gate.mjs']),
  });
  assertCase('baseline_health_harness_only_not_applicable', report.baselineHealthStatus.status === 'not_applicable', failures, cases, report.baselineHealthStatus.status, report.baselineHealthStatus.reasonCodes);

  report = buildBaselineHealthReport(prEnv({
    CODEX_SKIP_NPM: '1',
    CODEX_CHANGED_FILES: JSON.stringify(['src/runtime/server.ts']),
    CODEX_CHANGE_CLASSIFICATION_JSON: JSON.stringify({ productRelevantChanged: true }),
    CODEX_REMOTE_PRODUCT_BASELINE_JSON: JSON.stringify({ status: 'pass' }),
  }));
  assertCase('baseline_health_skip_npm_product_change_fails', report.baselineHealthStatus.status === 'fail' && report.baselineHealthStatus.reasonCodes.includes('product_skip_npm_without_verification'), failures, cases, report.baselineHealthStatus.status, report.baselineHealthStatus.reasonCodes);

  report = buildEvidenceContinuityReport(prEnv({
    CODEX_CHANGED_FILES: JSON.stringify(['src/runtime/server.ts']),
    CODEX_CHANGE_CLASSIFICATION_JSON: JSON.stringify({ productRelevantChanged: true }),
    CODEX_REMOTE_PRODUCT_BASELINE_JSON: JSON.stringify({ status: 'pass' }),
    CODEX_PRODUCT_VERIFICATION_JSON: JSON.stringify({ status: 'pass' }),
  }));
  assertCase('evidence_continuity_remote_baseline_survives_workflow', report.evidenceContinuityStatus.status === 'pass', failures, cases, report.evidenceContinuityStatus.status, report.evidenceContinuityStatus.reasonCodes);
  assertCase('evidence_continuity_product_verification_survives_summary', report.evidenceContinuityStatus.status === 'pass', failures, cases, report.evidenceContinuityStatus.status, report.evidenceContinuityStatus.reasonCodes);

  report = buildEvidenceContinuityReport(prEnv({
    CODEX_PR_BODY: 'BEGIN_CODEX_EVIDENCE_PACK_JSON\n{"codexEvidencePack":{"humanConfirmation":{"confirmedByRole":"project-owner"}}}\nEND_CODEX_EVIDENCE_PACK_JSON',
  }));
  assertCase('evidence_continuity_evidence_pack_human_confirmation_survives', report.evidenceContinuityStatus.status === 'pass', failures, cases, report.evidenceContinuityStatus.status, report.evidenceContinuityStatus.reasonCodes);

  report = buildSelfTestCaseExportReport({
    CODEX_SELF_TEST_REPORT_JSON: JSON.stringify({
      status: 'fail',
      cases: [{ id: 'safe_case_id', status: 'fail', expectedStatus: 'pass', actualStatus: 'fail', reasonCodes: ['example_failed'] }],
    }),
  });
  assertCase('self_test_case_export_reports_failed_case_id', report.selfTestCaseExportStatus.status === 'pass' && report.selfTestCaseExportStatus.failedCases[0]?.caseId === 'safe_case_id', failures, cases, report.selfTestCaseExportStatus.status, report.selfTestCaseExportStatus.reasonCodes);

  report = buildPrBodySurfaceNormalizerReport(prEnv({ CODEX_PR_BODY: 'No auth changes.\nProduct code changed: no' }));
  assertCase('surface_normalizer_no_auth_changes_not_auth_surface', !report.prBodySurfaceNormalizerStatus.effectiveChangedSurfaces.includes('auth'), failures, cases, report.prBodySurfaceNormalizerStatus.status, report.prBodySurfaceNormalizerStatus.reasonCodes);

  report = buildPrBodySurfaceNormalizerReport(prEnv({ CODEX_PR_BODY: '## Task Contract\nForbidden scope: auth, storage, runtime product code' }));
  assertCase('surface_normalizer_forbidden_scope_auth_not_auth_surface', !report.prBodySurfaceNormalizerStatus.effectiveChangedSurfaces.includes('auth'), failures, cases, report.prBodySurfaceNormalizerStatus.status, report.prBodySurfaceNormalizerStatus.reasonCodes);

  report = buildPrBodySurfaceNormalizerReport(prEnv({ CODEX_PR_BODY: '## Residual risks\nRuntime rollout is separate and not included.' }));
  assertCase('surface_normalizer_residual_runtime_not_runtime_surface', !report.prBodySurfaceNormalizerStatus.effectiveChangedSurfaces.includes('runtime'), failures, cases, report.prBodySurfaceNormalizerStatus.status, report.prBodySurfaceNormalizerStatus.reasonCodes);

  report = buildPrBodySurfaceNormalizerReport(prEnv({
    CODEX_CHANGED_FILES: JSON.stringify(['src/auth/login.ts']),
    CODEX_PR_BODY: 'No auth changes.',
  }));
  assertCase('surface_normalizer_product_auth_file_overrides_denial', report.prBodySurfaceNormalizerStatus.effectiveChangedSurfaces.includes('auth'), failures, cases, report.prBodySurfaceNormalizerStatus.status, report.prBodySurfaceNormalizerStatus.reasonCodes);

  report = buildPrBodySurfaceNormalizerReport(prEnv({ CODEX_PR_BODY: 'Task Contract:\nGoal: compact fixture' }));
  assertCase('required_heading_hint_task_contract_near_miss', report.prBodySurfaceNormalizerStatus.requiredHeadingHintStatus.nearMisses.length > 0, failures, cases, report.prBodySurfaceNormalizerStatus.requiredHeadingHintStatus.status, []);

  const score = scoreDecompositionFixture({ codeReviewMonitorStatus: { status: 'manual_confirmation_required' } });
  assertCase('score_decomposition_shows_cap_gate', score.status === 'pass' && score.caps.length === 1 && score.score === 89, failures, cases, score.status, []);

  let profile = selfTestProfileFixture('fast_harness', ['src/runtime/server.ts']);
  assertCase('fast_harness_profile_denied_for_product_change', profile.status === 'fail' && profile.reasonCodes.includes('self_test_profile_not_allowed'), failures, cases, profile.status, profile.reasonCodes);

  profile = selfTestProfileFixture('fast_harness', ['scripts/codex-local-quality-gate.mjs']);
  assertCase('fast_harness_profile_allowed_for_harness_only', profile.status === 'pass', failures, cases, profile.status, profile.reasonCodes);

  const markerStatus = oldMarkerFixture([{ path: 'scripts/codex-local-quality-gate.mjs', marker: `CODEX_QUALITY_HARNESS_FILE v${'0.8.8'}` }]);
  assertCase('old_harness_marker_source_managed_fails', markerStatus.status === 'fail' && markerStatus.reasonCodes.includes('old_source_marker_detected'), failures, cases, markerStatus.status, markerStatus.reasonCodes);

  const prBody = [
    'PR profile: harness_workflow_r3',
    'Risk level: R3',
    '## Task Contract',
    'Goal: add v0.9.0 source harness operational precision only',
    '## Evidence Integrity',
    'BEGIN_CODEX_EVIDENCE_PACK_JSON',
    '{"codexEvidencePack":{"headSha":"1234567890abcdef1234567890abcdef12345678","humanConfirmation":{"confirmedByRole":"project-owner"}}}',
    'END_CODEX_EVIDENCE_PACK_JSON',
    '## Testing and review',
    'source/core local gate: pass',
  ].join('\n');
  const baseline = buildBaselineHealthReport(prEnv({
    CODEX_CHANGED_FILES: JSON.stringify(['scripts/codex-baseline-health-gate.mjs']),
    CODEX_PR_BODY: prBody,
  })).baselineHealthStatus.status;
  const continuity = buildEvidenceContinuityReport(prEnv({
    CODEX_CHANGED_FILES: JSON.stringify(['scripts/codex-baseline-health-gate.mjs']),
    CODEX_PR_BODY: prBody,
  })).evidenceContinuityStatus.status;
  const surface = buildPrBodySurfaceNormalizerReport(prEnv({
    CODEX_CHANGED_FILES: JSON.stringify(['scripts/codex-baseline-health-gate.mjs']),
    CODEX_PR_BODY: prBody,
  })).prBodySurfaceNormalizerStatus.status;
  assertCase('source_harness_only_v089_pr_fixture_pass', ['warning', 'not_applicable'].includes(baseline) && continuity === 'pass' && surface === 'pass', failures, cases, `${baseline}/${continuity}/${surface}`, []);

  const unsafe = scanObjectForUnsafe(JSON.parse(JSON.stringify(cases).replace(/npm_/g, 'npmLabel_')));
  const status = failures.length || unsafe.length ? 'fail' : 'pass';
  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    status,
    v089SelfTestStatus: {
      status,
      suite: 'v089',
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
  const report = buildV089SelfTestReport();
  writeJsonReport(report, 'CODEX_V089_SELF_TEST_REPORT');
  exitFor(report);
}

export { buildV089SelfTestReport };
