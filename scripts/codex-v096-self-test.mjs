#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4

import { fileURLToPath } from 'node:url';
import { marker, HARNESS_VERSION, scanObjectForUnsafe, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  buildKRuleCoverageReport,
  buildLive2DSpecSyncReport,
  buildRuntimeLatencyBudgetReport,
  buildObsoleteOpenPrReport,
  buildOwnerSummaryCompactReport,
  buildBrowserSmokeArtifactReport,
  buildFailureToRepairPlanReport,
  buildRuntimeStateAdoptionReport,
  buildClaimTransitionReport,
  buildTimeoutAdoptionReport,
  buildTxReconciliationServiceReport,
  buildTxHashBeforeWaitReport,
  buildReceiptResumeBoundaryReport,
  buildMigrationRolloutSafetyReport,
  buildMigrationRuntimeCompatReport,
  buildHumanReviewDigestReport,
  buildDatasetAuditReadinessReport,
  buildGameToolAdapterContractFixtureReport,
  buildBelovedAvatarSafetyAuditReport,
} from './codex-v096-gate-lib.mjs';

function statusOf(report, key) {
  return report[key]?.status || report.status || 'missing';
}

function reasonsOf(report, key) {
  return report[key]?.reasonCodes || [];
}

function assertCase(id, condition, failures, cases, actualStatus = 'pass', reasonCodes = []) {
  cases.push({ id, status: condition ? 'pass' : 'fail', actualStatus, reasonCodes, safeSummaryOnly: true });
  if (!condition) failures.push(id);
}

export function buildV096SelfTestReport() {
  const failures = [];
  const cases = [];
  let report;

  report = buildKRuleCoverageReport({ forceCheck: true, allowlistPresent: true, coverageTestPresent: true });
  assertCase('k_rule_coverage_live2d_allowlist_required_pass', statusOf(report, 'kRuleCoverageStatus') === 'pass', failures, cases, statusOf(report, 'kRuleCoverageStatus'), reasonsOf(report, 'kRuleCoverageStatus'));
  report = buildKRuleCoverageReport({ forceCheck: true, allowlistPresent: true });
  assertCase('k_rule_coverage_missing_test_fails', statusOf(report, 'kRuleCoverageStatus') === 'fail', failures, cases, statusOf(report, 'kRuleCoverageStatus'), reasonsOf(report, 'kRuleCoverageStatus'));
  report = buildKRuleCoverageReport({ forceCheck: true, allowlistPresent: true, coverageTestPresent: true, staleCoverageManifest: true });
  assertCase('k_rule_stale_coverage_manifest_fails', statusOf(report, 'kRuleCoverageStatus') === 'fail', failures, cases, statusOf(report, 'kRuleCoverageStatus'), reasonsOf(report, 'kRuleCoverageStatus'));

  report = buildLive2DSpecSyncReport({ live2dSpecRelevant: true });
  assertCase('live2d_spec_phase_order_pass', statusOf(report, 'live2dSpecSyncStatus') === 'pass', failures, cases, statusOf(report, 'live2dSpecSyncStatus'), reasonsOf(report, 'live2dSpecSyncStatus'));
  report = buildLive2DSpecSyncReport({ live2dSpecRelevant: true, futurePhaseMixed: true });
  assertCase('live2d_spec_future_phase_mixed_fails', statusOf(report, 'live2dSpecSyncStatus') === 'fail', failures, cases, statusOf(report, 'live2dSpecSyncStatus'), reasonsOf(report, 'live2dSpecSyncStatus'));

  report = buildRuntimeLatencyBudgetReport({ runtimeRelevant: true, duplicateDeliveryRisk: true });
  assertCase('runtime_latency_duplicate_delivery_fails', statusOf(report, 'runtimeLatencyBudgetStatus') === 'fail', failures, cases, statusOf(report, 'runtimeLatencyBudgetStatus'), reasonsOf(report, 'runtimeLatencyBudgetStatus'));
  report = buildRuntimeLatencyBudgetReport({ runtimeRelevant: true, queueDrainBeforeReady: true });
  assertCase('runtime_latency_queue_drain_before_ready_fails', statusOf(report, 'runtimeLatencyBudgetStatus') === 'fail', failures, cases, statusOf(report, 'runtimeLatencyBudgetStatus'), reasonsOf(report, 'runtimeLatencyBudgetStatus'));
  report = buildRuntimeLatencyBudgetReport({ runtimeRelevant: true });
  assertCase('runtime_latency_bounded_interval_pass', statusOf(report, 'runtimeLatencyBudgetStatus') === 'pass', failures, cases, statusOf(report, 'runtimeLatencyBudgetStatus'), reasonsOf(report, 'runtimeLatencyBudgetStatus'));

  report = buildObsoleteOpenPrReport({ oldHarnessOpenPr: true });
  assertCase('obsolete_open_pr_old_harness_warns', statusOf(report, 'obsoleteOpenPrStatus') === 'warning', failures, cases, statusOf(report, 'obsoleteOpenPrStatus'), reasonsOf(report, 'obsoleteOpenPrStatus'));
  report = buildObsoleteOpenPrReport({ reuseOldPr: true });
  assertCase('obsolete_open_pr_reuse_fails', statusOf(report, 'obsoleteOpenPrStatus') === 'fail', failures, cases, statusOf(report, 'obsoleteOpenPrStatus'), reasonsOf(report, 'obsoleteOpenPrStatus'));

  report = buildOwnerSummaryCompactReport({ required: true, present: true, lineCount: 7 });
  assertCase('owner_summary_7line_required_pass', ['pass', 'warning'].includes(statusOf(report, 'ownerSummaryCompactStatus')), failures, cases, statusOf(report, 'ownerSummaryCompactStatus'), reasonsOf(report, 'ownerSummaryCompactStatus'));
  report = buildOwnerSummaryCompactReport({ required: true });
  assertCase('owner_summary_missing_fails', statusOf(report, 'ownerSummaryCompactStatus') === 'fail', failures, cases, statusOf(report, 'ownerSummaryCompactStatus'), reasonsOf(report, 'ownerSummaryCompactStatus'));

  report = buildBrowserSmokeArtifactReport({ browserSmokeRequired: true, artifactPresent: true });
  assertCase('browser_smoke_safe_artifact_pass', statusOf(report, 'browserSmokeArtifactStatus') === 'pass', failures, cases, statusOf(report, 'browserSmokeArtifactStatus'), reasonsOf(report, 'browserSmokeArtifactStatus'));
  report = buildBrowserSmokeArtifactReport({ browserSmokeRequired: true, artifactPresent: true, rawConsoleLogIncluded: true });
  assertCase('browser_smoke_raw_console_log_fails', statusOf(report, 'browserSmokeArtifactStatus') === 'fail', failures, cases, statusOf(report, 'browserSmokeArtifactStatus'), reasonsOf(report, 'browserSmokeArtifactStatus'));

  report = buildFailureToRepairPlanReport({ failurePresent: true, planPresent: true, bodyOnlyRepair: true });
  assertCase('failure_to_repair_plan_body_only_pass', statusOf(report, 'failureToRepairPlanStatus') === 'pass', failures, cases, statusOf(report, 'failureToRepairPlanStatus'), reasonsOf(report, 'failureToRepairPlanStatus'));
  report = buildFailureToRepairPlanReport({ failurePresent: true });
  assertCase('failure_to_repair_plan_missing_fails', statusOf(report, 'failureToRepairPlanStatus') === 'fail', failures, cases, statusOf(report, 'failureToRepairPlanStatus'), reasonsOf(report, 'failureToRepairPlanStatus'));

  report = buildRuntimeStateAdoptionReport({ runtimeStateRelevant: true, schemaOnly: true });
  assertCase('runtime_state_adoption_schema_only_not_ready', statusOf(report, 'runtimeStateAdoptionStatus') === 'pass' && report.runtimeStateAdoptionStatus.runtimeReadinessProven === false, failures, cases, statusOf(report, 'runtimeStateAdoptionStatus'), reasonsOf(report, 'runtimeStateAdoptionStatus'));
  report = buildRuntimeStateAdoptionReport({ runtimeStateRelevant: true, helperUsed: true });
  assertCase('runtime_state_adoption_helper_used_pass', statusOf(report, 'runtimeStateAdoptionStatus') === 'pass', failures, cases, statusOf(report, 'runtimeStateAdoptionStatus'), reasonsOf(report, 'runtimeStateAdoptionStatus'));

  report = buildClaimTransitionReport({ claimRelevant: true });
  assertCase('claim_transition_atomic_required', statusOf(report, 'claimTransitionStatus') === 'fail', failures, cases, statusOf(report, 'claimTransitionStatus'), reasonsOf(report, 'claimTransitionStatus'));
  report = buildTimeoutAdoptionReport({ txWaitPath: true });
  assertCase('timeout_adoption_tx_wait_without_timeout_fails', statusOf(report, 'timeoutAdoptionStatus') === 'fail', failures, cases, statusOf(report, 'timeoutAdoptionStatus'), reasonsOf(report, 'timeoutAdoptionStatus'));
  report = buildTxReconciliationServiceReport({ txRelevant: true });
  assertCase('tx_reconciliation_service_missing_fails', statusOf(report, 'txReconciliationServiceStatus') === 'fail', failures, cases, statusOf(report, 'txReconciliationServiceStatus'), reasonsOf(report, 'txReconciliationServiceStatus'));
  report = buildTxHashBeforeWaitReport({ txWaitRelevant: true });
  assertCase('txhash_before_wait_missing_fails', statusOf(report, 'txHashBeforeWaitStatus') === 'fail', failures, cases, statusOf(report, 'txHashBeforeWaitStatus'), reasonsOf(report, 'txHashBeforeWaitStatus'));
  report = buildReceiptResumeBoundaryReport({ receiptRelevant: true });
  assertCase('receipt_resume_boundary_missing_fails', statusOf(report, 'receiptResumeBoundaryStatus') === 'fail', failures, cases, statusOf(report, 'receiptResumeBoundaryStatus'), reasonsOf(report, 'receiptResumeBoundaryStatus'));

  report = buildMigrationRolloutSafetyReport({ migrationRelevant: true, additiveNullable: true });
  assertCase('migration_rollout_additive_nullable_pass', statusOf(report, 'migrationRolloutSafetyStatus') === 'pass', failures, cases, statusOf(report, 'migrationRolloutSafetyStatus'), reasonsOf(report, 'migrationRolloutSafetyStatus'));
  report = buildMigrationRolloutSafetyReport({ migrationRelevant: true, destructiveMigration: true });
  assertCase('migration_rollout_destructive_without_rollback_fails', statusOf(report, 'migrationRolloutSafetyStatus') === 'fail', failures, cases, statusOf(report, 'migrationRolloutSafetyStatus'), reasonsOf(report, 'migrationRolloutSafetyStatus'));
  report = buildMigrationRuntimeCompatReport({ migrationRelevant: true });
  assertCase('migration_runtime_compat_missing_fails', statusOf(report, 'migrationRuntimeCompatStatus') === 'fail', failures, cases, statusOf(report, 'migrationRuntimeCompatStatus'), reasonsOf(report, 'migrationRuntimeCompatStatus'));

  report = buildHumanReviewDigestReport({ r3: true });
  assertCase('human_review_digest_required_for_r3', statusOf(report, 'humanReviewDigestStatus') === 'fail', failures, cases, statusOf(report, 'humanReviewDigestStatus'), reasonsOf(report, 'humanReviewDigestStatus'));
  report = buildDatasetAuditReadinessReport({ datasetAuditRelevant: true, schemaPresent: true });
  assertCase('dataset_audit_readiness_schema_pass', statusOf(report, 'datasetAuditReadinessStatus') === 'pass', failures, cases, statusOf(report, 'datasetAuditReadinessStatus'), reasonsOf(report, 'datasetAuditReadinessStatus'));
  report = buildDatasetAuditReadinessReport({ datasetAuditRelevant: true, schemaPresent: true, autoFixEnabled: true });
  assertCase('dataset_audit_auto_fix_fails', statusOf(report, 'datasetAuditReadinessStatus') === 'fail', failures, cases, statusOf(report, 'datasetAuditReadinessStatus'), reasonsOf(report, 'datasetAuditReadinessStatus'));

  report = buildGameToolAdapterContractFixtureReport({ gameToolRelevant: true, candidateDirectHandoff: true });
  assertCase('game_tool_candidate_direct_handoff_fails', statusOf(report, 'gameToolAdapterContractFixtureStatus') === 'fail', failures, cases, statusOf(report, 'gameToolAdapterContractFixtureStatus'), reasonsOf(report, 'gameToolAdapterContractFixtureStatus'));
  report = buildGameToolAdapterContractFixtureReport({ gameToolRelevant: true, approvedAction: true });
  assertCase('game_tool_approved_action_passes', statusOf(report, 'gameToolAdapterContractFixtureStatus') === 'pass', failures, cases, statusOf(report, 'gameToolAdapterContractFixtureStatus'), reasonsOf(report, 'gameToolAdapterContractFixtureStatus'));

  report = buildBelovedAvatarSafetyAuditReport({ avatarRelevant: true, memoryPrivacyViolation: true });
  assertCase('beloved_avatar_memory_privacy_violation_fails', statusOf(report, 'belovedAvatarSafetyAuditStatus') === 'fail', failures, cases, statusOf(report, 'belovedAvatarSafetyAuditStatus'), reasonsOf(report, 'belovedAvatarSafetyAuditStatus'));
  report = buildBelovedAvatarSafetyAuditReport({});
  assertCase('beloved_avatar_docs_only_not_applicable', statusOf(report, 'belovedAvatarSafetyAuditStatus') === 'not_applicable', failures, cases, statusOf(report, 'belovedAvatarSafetyAuditStatus'), reasonsOf(report, 'belovedAvatarSafetyAuditStatus'));

  report = buildOwnerSummaryCompactReport({ present: true, lineCount: 5 });
  assertCase('source_harness_only_v096_fixture_pass', statusOf(report, 'ownerSummaryCompactStatus') === 'pass', failures, cases, statusOf(report, 'ownerSummaryCompactStatus'), reasonsOf(report, 'ownerSummaryCompactStatus'));
  report = buildFailureToRepairPlanReport({ failurePresent: true, planPresent: true });
  assertCase('target_harness_rollout_v096_fixture_pass', statusOf(report, 'failureToRepairPlanStatus') === 'pass', failures, cases, statusOf(report, 'failureToRepairPlanStatus'), reasonsOf(report, 'failureToRepairPlanStatus'));

  const unsafe = scanObjectForUnsafe(cases);
  const status = failures.length || unsafe.length ? 'fail' : 'pass';
  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    status,
    v096SelfTestStatus: {
      status,
      suite: 'v096',
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
  const report = buildV096SelfTestReport();
  writeJsonReport(report, 'CODEX_V096_SELF_TEST_REPORT');
  exitFor(report);
}
