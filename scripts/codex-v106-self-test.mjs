#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { scanObjectForUnsafe, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import * as gates from './codex-v106-gate-lib.mjs';

const CASES = [
  ['v106_active_self_test_exported_to_safe_artifact', gates.buildActiveSelfTestExportReport, {}, 'activeSelfTestExportStatus', 'pass'],
  ['active_registry_uses_target_manifest_by_default', gates.buildActiveSelfTestExportReport, {}, 'activeRegistryManifestSourceStatus', 'pass'],
  ['source_manifest_and_target_manifest_sources_are_reported', gates.buildDiagnosticProvenanceReport, {}, 'diagnosticProvenanceStatus', 'pass'],
  ['legacy_v085_uses_current_safe_shape_adapter', gates.buildLegacySelfTestCompatibilityAdapterReport, {}, 'legacySelfTestCompatibilityAdapterStatus', 'pass'],
  ['legacy_v087_fixture_local_context_does_not_read_default_repo', gates.buildLegacySelfTestCompatibilityAdapterReport, { liveRepoRead: true }, 'legacySelfTestCompatibilityAdapterStatus', 'fail'],
  ['legacy_v092_absent_if_not_required_is_advisory', gates.buildLegacySelfTestCompatibilityAdapterReport, {}, 'legacySelfTestCompatibilityAdapterStatus', 'pass'],
  ['fixture_failed_without_safe_label_fails', gates.buildSafeAttributionEverywhereReport, { safe_case_label: false }, 'safeAttributionEverywhereStatus', 'fail'],
  ['npm_failure_without_safe_label_fails', gates.buildSafeAttributionEverywhereReport, { safe_reason_code: false }, 'safeAttributionEverywhereStatus', 'fail'],
  ['target_quality_breakdown_drives_reason_summary', gates.buildTargetQualityScoreBreakdownReport, {}, 'reasonSummaryAuthoritativeStatus', 'pass'],
  ['reason_summary_does_not_rescan_fail_statuses', gates.buildTargetQualityScoreBreakdownReport, { reasonSummaryRescansFailures: true }, 'reasonSummaryAuthoritativeStatus', 'fail'],
  ['backend_workflow_path_matches_self_test_fixture', gates.buildWorkflowPathMatchesSelfTestFixtureReport, {}, 'workflowPathMatchesSelfTestFixtureStatus', 'pass'],
  ['backend_remote_plan_single_source_required', gates.buildRemoteProductEvidencePlanReport, {}, 'remoteProductEvidencePlanStatus', 'pass'],
  ['workflow_yaml_cannot_construct_product_npm_directly', gates.buildRemoteProductEvidencePlanReport, { workflowConstructsCommandIndependently: true }, 'remoteProductEvidencePlanStatus', 'fail'],
  ['safe_artifact_cwd_matches_remote_product_plan', gates.buildRemoteProductEvidencePlanReport, { safeArtifactCwd: 'apps/backend' }, 'remoteProductEvidencePlanStatus', 'pass'],
  ['diagnostic_cwd_matches_remote_product_plan', gates.buildRemoteProductEvidencePlanReport, { diagnosticCwd: 'apps/backend' }, 'remoteProductEvidencePlanStatus', 'pass'],
  ['baseline_cwd_matches_remote_product_plan', gates.buildRemoteProductEvidencePlanReport, { baselineCwd: 'apps/backend' }, 'remoteProductEvidencePlanStatus', 'pass'],
  ['body_only_repair_is_not_product_failure', gates.buildBodyOnlyRepairClassifierReport, { parserFailure: true, safeSuggestedPatch: { missingSectionName: 'Risk level', missingExactMetadataLabel: 'Risk level', acceptedAliases: ['Risk level'], rejectedReason: 'missing_required_label', currentParserMode: 'schema', minimalSafeBodyPatch: 'add_missing_label_only' } }, 'bodyOnlyRepairClassifierStatus', 'pass'],
  ['pr_body_parser_outputs_missing_exact_label', gates.buildPrBodySchemaLinterReport, { headings: ['Owner summary'] }, 'prBodySchemaLinterStatus', 'fail'],
  ['evidence_pack_is_single_source', gates.buildEvidenceSingleSourceV2Report, {}, 'evidenceSingleSourceV2Status', 'pass'],
  ['pr_body_generated_from_evidence_pack', gates.buildEvidenceSingleSourceV2Report, {}, 'evidenceSingleSourceV2Status', 'pass'],
  ['pr_body_stale_against_evidence_pack_fails', gates.buildEvidenceSingleSourceV2Report, { prBodyStale: true }, 'evidenceSingleSourceV2Status', 'fail'],
  ['quality_gate_run_id_not_required_in_pr_body', gates.buildEvidenceSingleSourceV2Report, {}, 'evidenceSingleSourceV2Status', 'pass'],
  ['secret_env_reference_not_committed_secret', gates.buildSecretFindingContextClassifierReport, { context: 'env_reference', value: 'process.env.SECRET_NAME' }, 'secretFindingContextClassifierStatus', 'pass'],
  ['secret_negative_fixture_not_committed_secret', gates.buildSecretFindingContextClassifierReport, { context: 'generated_negative_fixture', value: 'fixture_redacted' }, 'secretFindingContextClassifierStatus', 'pass'],
  ['knowledge_governance_schema_required', gates.buildKnowledgeGovernanceSchemaReport, { schema: { marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.7' } }, 'knowledgeGovernanceSchemaStatus', 'fail'],
  ['bounded_validation_timeout_is_evidence_limitation', gates.buildBoundedValidationRunnerReport, { fullTargetTimeout: true }, 'boundedValidationRunnerStatus', 'pass'],
  ['full_target_timeout_not_product_failure', gates.buildBoundedValidationRunnerReport, { fullTargetTimeout: true }, 'boundedValidationRunnerStatus', 'pass'],
  ['stacked_pr_not_main_independent', gates.buildStackedPrDependencyManagerReport, { stacked: true }, 'stackedPrDependencyManagerStatus', 'fail'],
  ['release_readiness_snapshot_blocks_candidate_rollout', gates.buildReleaseReadinessSnapshotReport, { stacked: true }, 'releaseReadinessSnapshotStatus', 'fail'],
  ['same_product_pr_harness_fix_loop_limit_blocks_new_feature', gates.buildHarnessRegressionLoopLimitReport, { harnessOnlyRepairCount: 3, rootCauseDigestExists: false }, 'harnessRegressionLoopLimitStatus', 'fail'],
  ['product_safe_fail_maps_to_next_action', gates.buildSafeFailToNextActionReport, { failure_class: 'safe_report_missing', repair_kind: 'harness_only' }, 'productPrSafeFailToNextActionMapperStatus', 'pass'],
  ['harness_only_expected_safe_failure_not_merge_evidence', gates.buildSafeFailToNextActionReport, { failure_class: 'expected_harness_safe_failure', repair_kind: 'harness_only' }, 'productPrSafeFailToNextActionMapperStatus', 'pass'],
  ['product_pr_expected_safe_failure_not_allowed_as_pass', gates.buildSafeFailToNextActionReport, { failure_class: 'product_pr_expected_safe_failure', repair_kind: 'unknown' }, 'productPrSafeFailToNextActionMapperStatus', 'fail'],
  ['subthread_review_not_human_review', gates.buildControlledOrchestrationReport, { subthreadSatisfiesHumanReview: true }, 'controlledSubthreadReviewStatus', 'fail'],
  ['subthread_cannot_push', gates.buildControlledOrchestrationReport, { subthreadPushes: true }, 'controlledSubthreadReviewStatus', 'fail'],
  ['subthread_cannot_merge', gates.buildControlledOrchestrationReport, { subthreadMerges: true }, 'controlledSubthreadReviewStatus', 'fail'],
  ['verification_fan_in_rejects_head_mismatch', gates.buildControlledOrchestrationReport, { missingTargetHeadSha: true }, 'verificationFanInStatus', 'fail'],
  ['docs_only_lane_allowed_when_explicitly_scoped', gates.buildDevelopmentLaneSeparationReport, { lane: 'docs_only_planning', changedFiles: ['docs/process/CODEX_V106_LANE_PROVENANCE_RECOVERY_POLICY.md'], is_draft: true, explicit_user_scope_change: true }, 'developmentLaneSeparationStatus', 'pass'],
  ['runtime_lane_blocked_despite_docs_lane_allowed', gates.buildDevelopmentLaneSeparationReport, { lane: 'runtime' }, 'developmentLaneSeparationStatus', 'fail'],
  ['no_repeat_monitoring_without_state_delta', gates.buildNoRepeatMonitoringGuardReport, {}, 'noRepeatMonitoringGuardStatus', 'fail'],
  ['policy_saturation_blocks_new_policy_pr', gates.buildPolicySaturationGateReport, { saturated: true }, 'policySaturationGateStatus', 'pass'],
  ['safe_suggested_patch_contains_no_raw_values', gates.buildBodyOnlyRepairClassifierReport, { parserFailure: true, safeSuggestedPatch: { missingSectionName: 'Risk level', missingExactMetadataLabel: 'Risk level', acceptedAliases: ['Risk level'], rejectedReason: 'missing_required_label', currentParserMode: 'schema', minimalSafeBodyPatch: 'add_missing_label_only' } }, 'bodyOnlyRepairClassifierStatus', 'pass'],
  ['backend_only_product_pr_expects_apps_backend_cwd', gates.buildRemoteProductEvidencePlanReport, { plan: { packageScope: 'apps/backend', cwd: 'apps/backend', commandClass: 'backend_npm_test', command: 'npm test', source: 'generated_evidence_pack', surface: 'backend', reason: 'backend_product_pr' } }, 'remoteProductEvidencePlanStatus', 'pass'],
  ['contracts_only_product_pr_expects_contracts_cwd', gates.buildRemoteProductEvidencePlanReport, { plan: { packageScope: 'contracts', cwd: 'contracts', commandClass: 'contracts_npm_test', command: 'npm test', source: 'generated_evidence_pack', surface: 'contracts', reason: 'contracts_product_pr' } }, 'remoteProductEvidencePlanStatus', 'pass'],
  ['docs_only_planning_pr_no_product_npm_required', gates.buildDevelopmentLaneSeparationReport, { lane: 'docs_only_planning', changedFiles: ['docs/process/PLAN.md'], is_draft: true, explicit_user_scope_change: true }, 'developmentLaneSeparationStatus', 'pass'],
  ['harness_only_pr_product_verification_not_applicable', gates.buildProductR3SchemaV2Report, {}, 'productR3SchemaV2Status', 'pass'],
  ['token_deploy_preflight_no_deploy_no_funded_tx', gates.buildManualGateRegistryReport, {}, 'manualGateRegistryStatus', 'pass'],
  ['live2d_product_r3_safe_fail_maps_next_action', gates.buildSafeFailToNextActionReport, { failure_class: 'live2d_no_safe_report', repair_kind: 'harness_only' }, 'productPrSafeFailToNextActionMapperStatus', 'pass'],
  ['voxweave_stacked_pr_blocks_main_independent_merge', gates.buildStackedPrDependencyManagerReport, { stacked: true }, 'stackedPrDependencyManagerStatus', 'fail'],
  ['cripto_tip_operations_pr_requires_evidence_pack_and_manual_gates', gates.buildEvidenceSingleSourceV2Report, {}, 'evidenceSingleSourceV2Status', 'pass'],
  ['iris_legacy_self_test_adapter_required', gates.buildLegacySelfTestCompatibilityAdapterReport, {}, 'legacySelfTestCompatibilityAdapterStatus', 'pass'],
];

const defaultReport = gates.buildDefaultV106Reports({ caseCount: CASES.length, failedCaseCount: 0 });
for (const key of gates.V106_STATUS_KEYS) {
  CASES.push([`default_status_${key}`, () => defaultReport, {}, key, 'pass']);
}

const results = CASES.map(([name, builder, input, key, expected]) => {
  const report = builder(input);
  const actual = report[key]?.status || report.status;
  return { name, status: actual === expected ? 'pass' : 'fail', expected, actual, safeSummaryOnly: true };
});

const failures = results.filter((item) => item.status !== 'pass');
const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.7',
  status: failures.length ? 'fail' : 'pass',
  activeHarnessVersion: '1.0.6',
  activeSelfTestSuite: 'v106',
  activeSelfTestStatusKey: 'v106SelfTestStatus',
  activeSelfTest: {
    suite: 'v106',
    statusKey: 'v106SelfTestStatus',
    status: failures.length ? 'fail' : 'pass',
    blocking: true,
    caseCount: results.length,
    failedCaseCount: failures.length,
    source: 'scripts/codex-v106-self-test.mjs',
  },
  legacySuites: { v105: 'advisory', v104: 'advisory', v103: 'advisory', v100: 'advisory', v092: 'advisory', v087: 'advisory', v085: 'advisory' },
  v106SelfTestStatus: {
    status: failures.length ? 'fail' : 'pass',
    caseCount: results.length,
    failedCaseCount: failures.length,
    activeSelfTestSuite: 'v106',
    blocking: true,
    source: 'scripts/codex-v106-self-test.mjs',
    failures,
    safeSummaryOnly: true,
  },
  syntheticRepresentativeValidation: failures.length ? 'fail' : 'pass',
  safeSummaryOnly: true,
};

if (scanObjectForUnsafe(report).length) {
  report.status = 'fail';
  report.v106SelfTestStatus = { status: 'fail', reasonCodes: ['unsafe_value_detected'], safeSummaryOnly: true };
}

writeJsonReport(report, 'CODEX_V106_SELF_TEST_REPORT');
exitFor(report);
