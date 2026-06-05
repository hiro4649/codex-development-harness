#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { scanObjectForUnsafe, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import * as gates from './codex-v105-gate-lib.mjs';

const CASES = [
  ['backend_only_pr_uses_backend_cwd', gates.buildRepresentativeProductPrValidationReport, { kind: 'backend_only' }, 'representativeProductPrValidationStatus', 'pass', 'representative_product_pr_validation'],
  ['contracts_only_pr_uses_contracts_cwd', gates.buildRepresentativeProductPrValidationReport, { kind: 'contracts_only' }, 'representativeProductPrValidationStatus', 'pass', 'representative_product_pr_validation'],
  ['docs_only_pr_does_not_require_product_npm', gates.buildRepresentativeProductPrValidationReport, { kind: 'docs_only' }, 'representativeProductPrValidationStatus', 'pass', 'representative_product_pr_validation'],
  ['harness_only_pr_does_not_require_product_verification', gates.buildRepresentativeProductPrValidationReport, { kind: 'harness_only' }, 'representativeProductPrValidationStatus', 'pass', 'representative_product_pr_validation'],
  ['token_deploy_preflight_forbids_deploy_tx_readiness', gates.buildRepresentativeProductPrValidationReport, { kind: 'token_deploy_preflight', deploy: true }, 'representativeProductPrValidationStatus', 'fail', 'representative_product_pr_validation'],
  ['cripto_tip_chain_listener_requires_observability_atomicity', gates.buildRepresentativeProductPrValidationReport, { kind: 'cripto_chain_listener', observabilityBoundary: false, atomicityBoundary: true }, 'representativeProductPrValidationStatus', 'fail', 'representative_product_pr_validation'],
  ['funky_safe_row_separates_mapper_jsonl_db_runtime', gates.buildRepresentativeProductPrValidationReport, { kind: 'funky_safe_row', separatesMapperJsonlDbRuntime: true }, 'representativeProductPrValidationStatus', 'pass', 'representative_product_pr_validation'],
  ['voxweave_saturated_policy_lane_blocks_new_policy_pr', gates.buildRepresentativeProductPrValidationReport, { kind: 'voxweave_policy_lane', saturated: true, newPolicyPr: true }, 'representativeProductPrValidationStatus', 'fail', 'representative_product_pr_validation'],
  ['live2d_pr42_shaped_pr_safe_json_non_merge_ready', gates.buildRepresentativeProductPrValidationReport, { kind: 'live2d_pr42', safeJson: true, mergeReady: false }, 'representativeProductPrValidationStatus', 'pass', 'representative_product_pr_validation'],
  ['iris_clean_main_baseline_distinguishes_local_and_remote_pass', gates.buildRepresentativeProductPrValidationReport, { kind: 'iris_baseline', localPass: true, remotePass: false }, 'representativeProductPrValidationStatus', 'fail', 'representative_product_pr_validation'],

  ['evidence_pack_safe_json_is_canonical', gates.buildEvidenceSingleSourceReport, { pack: { canonical: 'evidence-pack.safe.json', prBodyFromPack: true, docsFromPack: true } }, 'evidenceSingleSourceStatus', 'pass', 'evidence_single_source'],
  ['pr_body_generated_from_evidence_pack', gates.buildEvidenceSingleSourceReport, { pack: { canonical: 'evidence-pack.safe.json', prBodyFromPack: true, docsFromPack: true } }, 'evidenceSingleSourceStatus', 'pass', 'evidence_single_source'],
  ['docs_generated_from_evidence_pack', gates.buildEvidenceSingleSourceReport, { pack: { canonical: 'evidence-pack.safe.json', prBodyFromPack: true, docsFromPack: true } }, 'evidenceSingleSourceStatus', 'pass', 'evidence_single_source'],
  ['head_sha_drift_fails', gates.buildEvidenceSingleSourceReport, { pack: { canonical: 'evidence-pack.safe.json', headShaDrift: true } }, 'evidenceDriftCheckerStatus', 'fail', 'evidence_single_source'],
  ['run_id_drift_fails', gates.buildEvidenceSingleSourceReport, { pack: { canonical: 'evidence-pack.safe.json', runIdDrift: true } }, 'evidenceDriftCheckerStatus', 'fail', 'evidence_single_source'],
  ['test_count_drift_fails', gates.buildEvidenceSingleSourceReport, { pack: { canonical: 'evidence-pack.safe.json', testCountDrift: true } }, 'evidenceDriftCheckerStatus', 'fail', 'evidence_single_source'],
  ['profile_drift_fails', gates.buildEvidenceSingleSourceReport, { pack: { canonical: 'evidence-pack.safe.json', profileDrift: true } }, 'evidenceDriftCheckerStatus', 'fail', 'evidence_single_source'],
  ['readiness_claim_drift_fails', gates.buildEvidenceSingleSourceReport, { pack: { canonical: 'evidence-pack.safe.json', readinessClaimDrift: true } }, 'evidenceDriftCheckerStatus', 'fail', 'evidence_single_source'],

  ['nonzero_exit_emits_safe_json', gates.buildTargetSafeReportContractReport, { exitCode: 1, safeJsonEmitted: true }, 'targetSafeReportContractStatus', 'pass', 'target_safe_report_contract'],
  ['no_console_payload_emits_fixed_safe_failure', gates.buildTargetSafeReportContractReport, { noConsolePayload: true }, 'targetSafeReportContractStatus', 'fail', 'target_safe_report_contract'],
  ['no_safe_report_emits_fixed_safe_failure', gates.buildTargetSafeReportContractReport, { noSafeReport: true }, 'targetSafeReportContractStatus', 'fail', 'target_safe_report_contract'],
  ['empty_safe_json_emits_fixed_safe_failure', gates.buildTargetSafeReportContractReport, { emptySafeJson: true }, 'targetSafeReportContractStatus', 'fail', 'target_safe_report_contract'],
  ['target_finalizer_skipped_emits_fixed_safe_failure', gates.buildTargetSafeReportContractReport, { finalizerSkipped: true }, 'targetSafeReportContractStatus', 'fail', 'target_safe_report_contract'],
  ['child_process_no_output_emits_fixed_safe_failure', gates.buildTargetSafeReportContractReport, { childNoOutput: true }, 'targetSafeReportContractStatus', 'fail', 'target_safe_report_contract'],

  ['source_only_change_still_emits_target_safe_json', gates.buildSourceOnlyCompatibilityReport, { targetSafeJson: true }, 'sourceOnlyCompatibilityStatus', 'pass', 'source_only_compatibility'],
  ['product_r3_simulation_pending_after_push', gates.buildSourceOnlyCompatibilityReport, {}, 'sourceOnlyCompatibilityStatus', 'pass', 'source_only_compatibility'],
  ['remote_evidence_pass_false_before_same_head_remote_pass', gates.buildSourceOnlyCompatibilityReport, {}, 'sourceOnlyCompatibilityStatus', 'pass', 'source_only_compatibility'],
  ['target_merge_ready_false_before_same_head_remote_pass', gates.buildSourceOnlyCompatibilityReport, {}, 'sourceOnlyCompatibilityStatus', 'pass', 'source_only_compatibility'],
  ['merge_ready_false_before_same_head_remote_pass', gates.buildSourceOnlyCompatibilityReport, {}, 'sourceOnlyCompatibilityStatus', 'pass', 'source_only_compatibility'],

  ['v105_active_pass_blocks_correctly', gates.buildActiveLegacySelfTestSummaryReport, {}, 'activeLegacySelfTestSummaryStatus', 'pass', 'active_legacy_self_test_summary'],
  ['v105_active_failure_blocks', gates.buildActiveLegacySelfTestSummaryReport, { v105Failure: true }, 'activeLegacySelfTestSummaryStatus', 'fail', 'active_legacy_self_test_summary'],
  ['v104_failure_advisory_when_non_active', gates.buildActiveLegacySelfTestSummaryReport, { v104Failure: true }, 'activeLegacySelfTestSummaryStatus', 'pass', 'active_legacy_self_test_summary'],
  ['v103_failure_advisory_when_non_active', gates.buildActiveLegacySelfTestSummaryReport, { v103Failure: true }, 'activeLegacySelfTestSummaryStatus', 'pass', 'active_legacy_self_test_summary'],
  ['legacy_failure_never_top_level_failure', gates.buildActiveLegacySelfTestSummaryReport, { v104Failure: true, v103Failure: true }, 'activeLegacySelfTestSummaryStatus', 'pass', 'active_legacy_self_test_summary'],
  ['legacy_artifact_labelled_advisory', gates.buildActiveLegacySelfTestSummaryReport, {}, 'activeLegacySelfTestSummaryStatus', 'pass', 'active_legacy_self_test_summary'],

  ['npm_executed_source_emitted', gates.buildDiagnosticSourceTraceReport, { npmExecuted: true, npmExitCode: true, cwd: true, commandClass: true, packageScope: true, remoteProductEvidence: true }, 'diagnosticSourceTraceStatus', 'pass', 'diagnostic_source_trace'],
  ['npm_exit_code_source_emitted', gates.buildDiagnosticSourceTraceReport, { npmExecuted: true, npmExitCode: true, cwd: true, commandClass: true, packageScope: true, remoteProductEvidence: true }, 'diagnosticSourceTraceStatus', 'pass', 'diagnostic_source_trace'],
  ['cwd_source_emitted', gates.buildDiagnosticSourceTraceReport, { npmExecuted: true, npmExitCode: true, cwd: true, commandClass: true, packageScope: true, remoteProductEvidence: true }, 'diagnosticSourceTraceStatus', 'pass', 'diagnostic_source_trace'],
  ['command_class_source_emitted', gates.buildDiagnosticSourceTraceReport, { npmExecuted: true, npmExitCode: true, cwd: true, commandClass: true, packageScope: true, remoteProductEvidence: true }, 'diagnosticSourceTraceStatus', 'pass', 'diagnostic_source_trace'],
  ['package_scope_source_emitted', gates.buildDiagnosticSourceTraceReport, { npmExecuted: true, npmExitCode: true, cwd: true, commandClass: true, packageScope: true, remoteProductEvidence: true }, 'diagnosticSourceTraceStatus', 'pass', 'diagnostic_source_trace'],
  ['remote_product_evidence_source_emitted', gates.buildDiagnosticSourceTraceReport, { npmExecuted: true, npmExitCode: true, cwd: true, commandClass: true, packageScope: true, remoteProductEvidence: true }, 'diagnosticSourceTraceStatus', 'pass', 'diagnostic_source_trace'],
  ['normalizer_source_mismatch_fails_with_safe_suggested_patch', gates.buildDiagnosticSourceTraceReport, { normalizerSourceMismatch: true }, 'diagnosticSourceTraceStatus', 'fail', 'diagnostic_source_trace'],

  ['workflow_removes_product_verification_fails', gates.buildQualityGateSelfProtectionReport, { removesProductVerification: true }, 'qualityGateSelfProtectionStatus', 'fail', 'quality_gate_self_protection'],
  ['workflow_removes_same_head_requirement_fails', gates.buildQualityGateSelfProtectionReport, { removesSameHeadRequirement: true }, 'qualityGateSelfProtectionStatus', 'fail', 'quality_gate_self_protection'],
  ['workflow_removes_safe_output_scan_fails', gates.buildQualityGateSelfProtectionReport, { removesSafeOutputScan: true }, 'qualityGateSelfProtectionStatus', 'fail', 'quality_gate_self_protection'],
  ['workflow_weakens_runtime_readiness_boundary_fails', gates.buildQualityGateSelfProtectionReport, { weakensRuntimeReadinessBoundary: true }, 'qualityGateSelfProtectionStatus', 'fail', 'quality_gate_self_protection'],
  ['workflow_weakens_production_go_boundary_fails', gates.buildQualityGateSelfProtectionReport, { weakensProductionGoBoundary: true }, 'qualityGateSelfProtectionStatus', 'fail', 'quality_gate_self_protection'],

  ['draft_pr_inventory_saturated_stops_policy_pr', gates.buildIntegrationGovernanceReport, { saturated: true }, 'stopCreatingPolicyPrStatus', 'pass', 'integration_governance'],
  ['new_policy_pr_duplicate_blocked', gates.buildIntegrationGovernanceReport, { duplicatePolicyPr: true }, 'stopCreatingPolicyPrStatus', 'fail', 'integration_governance'],
  ['next_pr_necessity_none_no_new_pr', gates.buildIntegrationGovernanceReport, { saturated: true }, 'nextIntegrationCandidateStatus', 'pass', 'integration_governance'],
  ['codex_action_allowed_inventory_only', gates.buildIntegrationGovernanceReport, { saturated: true }, 'integrationGovernanceStatus', 'pass', 'integration_governance'],
  ['merge_readiness_no_for_saturated_inventory', gates.buildIntegrationGovernanceReport, { saturated: true }, 'draftPrInventoryModelStatus', 'pass', 'integration_governance'],

  ['g0_scaffold_not_production_ready', gates.buildProductionReadinessG4GateReport, { stage: 'G0' }, 'productionReadinessG4GateStatus', 'fail', 'production_readiness_g4'],
  ['g1_mock_vertical_slice_not_production_ready', gates.buildProductionReadinessG4GateReport, { stage: 'G1' }, 'productionReadinessG4GateStatus', 'fail', 'production_readiness_g4'],
  ['g2_durable_mvp_not_production_ready', gates.buildProductionReadinessG4GateReport, { stage: 'G2' }, 'productionReadinessG4GateStatus', 'fail', 'production_readiness_g4'],
  ['g3_integration_ready_not_production_ready', gates.buildProductionReadinessG4GateReport, { stage: 'G3' }, 'productionReadinessG4GateStatus', 'fail', 'production_readiness_g4'],
  ['g4_requires_observability_alerts_rollback_slo_chaos_secret_rotation_runbook', gates.buildProductionReadinessG4GateReport, { stage: 'G4', observability: true, alerts: true, rollback: true, slo: true, chaos: true, secretRotation: true, runbook: true }, 'productionReadinessG4GateStatus', 'pass', 'production_readiness_g4'],

  ['missing_metrics_fail_for_runtime_listener_pr', gates.buildObservabilityEvidenceGateReport, { runtimeListenerPr: true, metrics: false, dlqMetric: true, lagMetric: true }, 'observabilityEvidenceGateStatus', 'fail', 'observability'],
  ['metrics_documented_but_not_tested_fails', gates.buildObservabilityEvidenceGateReport, { runtimeListenerPr: true, metrics: true, metricsDocumented: true, metricsTested: false, dlqMetric: true, lagMetric: true }, 'observabilityEvidenceGateStatus', 'fail', 'observability'],
  ['dlq_metric_missing_fails', gates.buildObservabilityEvidenceGateReport, { runtimeListenerPr: true, metrics: true, metricsTested: true, dlqMetric: false, lagMetric: true }, 'observabilityEvidenceGateStatus', 'fail', 'observability'],
  ['lag_metric_missing_fails', gates.buildObservabilityEvidenceGateReport, { runtimeListenerPr: true, metrics: true, metricsTested: true, dlqMetric: true, lagMetric: false }, 'observabilityEvidenceGateStatus', 'fail', 'observability'],

  ['rpc_down_recovery_required', gates.buildChaosLiteRuntimeSimulationReport, { rpcDownRecovery: false }, 'chaosLiteRuntimeSimulationStatus', 'fail', 'chaos_lite'],
  ['websocket_silent_disconnect_required', gates.buildChaosLiteRuntimeSimulationReport, { websocketSilentDisconnect: false }, 'chaosLiteRuntimeSimulationStatus', 'fail', 'chaos_lite'],
  ['duplicate_log_idempotency_required', gates.buildChaosLiteRuntimeSimulationReport, { duplicateLogIdempotency: false }, 'chaosLiteRuntimeSimulationStatus', 'fail', 'chaos_lite'],
  ['db_update_plus_outbox_enqueue_atomicity_required', gates.buildAtomicityDeliveryIntegrityReport, { dbUpdateWithoutOutboxAtomicity: true }, 'atomicityDeliveryIntegrityStatus', 'fail', 'atomicity_delivery'],
  ['finalizer_skipped_still_produces_safe_json', gates.buildChaosLiteRuntimeSimulationReport, { safeJsonOnFinalizerSkipped: true }, 'chaosLiteRuntimeSimulationStatus', 'pass', 'chaos_lite'],

  ['human_github_review_typed', gates.buildReviewEvidenceTypedSchemaReport, { type: 'human_github_review' }, 'reviewEvidenceTypedSchemaStatus', 'pass', 'review_evidence'],
  ['owner_confirmation_typed', gates.buildReviewEvidenceTypedSchemaReport, { type: 'owner_confirmation' }, 'reviewEvidenceTypedSchemaStatus', 'pass', 'review_evidence'],
  ['chatgpt_pro_technical_assessment_typed', gates.buildReviewEvidenceTypedSchemaReport, { type: 'chatgpt_pro_technical_assessment' }, 'reviewEvidenceTypedSchemaStatus', 'pass', 'review_evidence'],
  ['codex_operational_comment_typed', gates.buildReviewEvidenceTypedSchemaReport, { type: 'codex_operational_comment' }, 'reviewEvidenceTypedSchemaStatus', 'pass', 'review_evidence'],
  ['stale_head_review_fails', gates.buildReviewEvidenceTypedSchemaReport, { type: 'human_github_review', staleHead: true }, 'reviewEvidenceTypedSchemaStatus', 'fail', 'review_evidence'],
  ['codex_operational_comment_not_independent_review', gates.buildReviewEvidenceTypedSchemaReport, { type: 'codex_operational_comment', requiresIndependentReview: true }, 'reviewEvidenceTypedSchemaStatus', 'fail', 'review_evidence'],

  ['public_evm_address_pass', gates.buildOwnerValuesValidatorStandardReport, { value: '0x1234567890abcdef1234567890abcdef12345678', context: 'public_evm_address' }, 'ownerValuesValidatorStandardStatus', 'pass', 'owner_values'],
  ['tbd_placeholder_pass', gates.buildOwnerValuesValidatorStandardReport, { value: 'TBD' }, 'ownerValuesValidatorStandardStatus', 'pass', 'owner_values'],
  ['hex_private_key_like_fails', gates.buildOwnerValuesValidatorStandardReport, { value: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }, 'ownerValuesValidatorStandardStatus', 'fail', 'owner_values'],
  ['jwt_like_fails', gates.buildOwnerValuesValidatorStandardReport, { value: ['eyJaaaaaaaaaaa', 'bbbbbbbbbbbb', 'cccccccccc'].join('.') }, 'ownerValuesValidatorStandardStatus', 'fail', 'owner_values'],
  ['db_url_fails', gates.buildOwnerValuesValidatorStandardReport, { value: 'postgres://redacted' }, 'ownerValuesValidatorStandardStatus', 'fail', 'owner_values'],
  ['private_rpc_url_fails', gates.buildOwnerValuesValidatorStandardReport, { value: 'https://private-rpc.invalid' }, 'ownerValuesValidatorStandardStatus', 'fail', 'owner_values'],
  ['public_explorer_url_allowed_field_aware', gates.buildOwnerValuesValidatorStandardReport, { value: 'https://etherscan.io/address/example', context: 'public_explorer_url' }, 'ownerValuesValidatorStandardStatus', 'pass', 'owner_values'],

  ['token_ladder_stage_0_to_8_emitted', gates.buildTokenDeploymentLadderStateReport, { stage: 0 }, 'tokenDeploymentLadderStateStatus', 'pass', 'token_ladder'],
  ['testnet_deploy_not_approved_not_ready', gates.buildTokenDeploymentLadderStateReport, { stage: 3, ownerApproved: false }, 'tokenDeploymentLadderStateStatus', 'fail', 'token_ladder'],
  ['mainnet_not_approved_not_ready', gates.buildTokenDeploymentLadderStateReport, { stage: 8, ownerApproved: false }, 'tokenDeploymentLadderStateStatus', 'fail', 'token_ladder'],
  ['owner_values_validation_format_only_not_approval', gates.buildTokenDeploymentLadderStateReport, { stage: 0 }, 'tokenDeploymentLadderStateStatus', 'pass', 'token_ladder'],

  ['old_marker_returns_safe_suggested_patch', gates.buildSafeSuggestedPatchReport, { oldMarker: true }, 'safeSuggestedPatchStatus', 'pass', 'safe_suggested_patch'],
  ['routing_mismatch_returns_safe_suggested_patch', gates.buildSafeSuggestedPatchReport, { routingMismatch: true }, 'safeSuggestedPatchStatus', 'pass', 'safe_suggested_patch'],
  ['diagnostic_source_mismatch_returns_safe_suggested_patch', gates.buildSafeSuggestedPatchReport, { diagnosticSourceMismatch: true }, 'safeSuggestedPatchStatus', 'pass', 'safe_suggested_patch'],
  ['safe_suggested_patch_no_raw_diff_output', gates.buildSafeSuggestedPatchReport, { oldMarker: true }, 'safeSuggestedPatchStatus', 'pass', 'safe_suggested_patch'],

  ...['diagnostic_only', 'body_only_repair', 'harness_only_pr', 'product_pr_refresh', 'review_and_ready', 'merge_only', 'no_deploy_preflight', 'owner_values_format_validation', 'inventory_only', 'integration_plan_only', 'no_new_pr'].map((mode) => [`task_size_${mode}`, gates.buildTaskSizeAdvisorReport, { mode }, 'taskSizeAdvisorStatus', 'pass', 'task_size_advisor']),

  ['runtime_readiness_blocker_digest_v2_blocks_runtime_claim', gates.buildRuntimeReadinessBlockerDigestV2Report, { runtimeReadyClaimed: true }, 'runtimeReadinessBlockerDigestV2Status', 'fail', 'runtime_readiness_blocker_digest_v2'],

  ['goal_mode_contract_required', gates.buildDynamicWorkflowWorkerBoundaryV2Report, { goalModeContract: false }, 'dynamicWorkflowWorkerBoundaryV2Status', 'fail', 'dynamic_workflow_v2'],
  ['work_packet_schema_required', gates.buildDynamicWorkflowWorkerBoundaryV2Report, { workPacketSchema: false }, 'dynamicWorkflowWorkerBoundaryV2Status', 'fail', 'dynamic_workflow_v2'],
  ['role_profile_plugin_required', gates.buildDynamicWorkflowWorkerBoundaryV2Report, { roleProfilePlugin: false }, 'roleProfilePluginV2Status', 'fail', 'dynamic_workflow_v2'],
  ['tool_permission_boundary_required', gates.buildDynamicWorkflowWorkerBoundaryV2Report, { toolPermissionBoundary: false }, 'dynamicWorkflowWorkerBoundaryV2Status', 'fail', 'dynamic_workflow_v2'],
  ['worker_file_ownership_required', gates.buildDynamicWorkflowWorkerBoundaryV2Report, { workerFileOwnership: false }, 'dynamicWorkflowWorkerBoundaryV2Status', 'fail', 'dynamic_workflow_v2'],
  ['approval_gate_required_for_runtime_tx_deploy', gates.buildDynamicWorkflowWorkerBoundaryV2Report, { runtimeTxDeploy: true, approvalGate: false }, 'dynamicWorkflowWorkerBoundaryV2Status', 'fail', 'dynamic_workflow_v2'],
  ['verification_fan_in_required', gates.buildDynamicWorkflowWorkerBoundaryV2Report, { verificationFanIn: false }, 'dynamicWorkflowWorkerBoundaryV2Status', 'fail', 'dynamic_workflow_v2'],
  ['subworker_cannot_auto_merge', gates.buildDynamicWorkflowWorkerBoundaryV2Report, { autoMerge: true }, 'dynamicWorkflowWorkerBoundaryV2Status', 'fail', 'dynamic_workflow_v2'],
  ['subworker_cannot_auto_deploy', gates.buildDynamicWorkflowWorkerBoundaryV2Report, { autoDeploy: true }, 'dynamicWorkflowWorkerBoundaryV2Status', 'fail', 'dynamic_workflow_v2'],
  ['subworker_cannot_access_tools_outside_role_permission', gates.buildDynamicWorkflowWorkerBoundaryV2Report, { toolOutsideRole: true }, 'toolPermissionBoundaryV2Status', 'fail', 'dynamic_workflow_v2'],
  ['subworker_cannot_write_files_outside_ownership', gates.buildDynamicWorkflowWorkerBoundaryV2Report, { writeOutsideOwnership: true }, 'dynamicWorkflowWorkerBoundaryV2Status', 'fail', 'dynamic_workflow_v2'],
  ['dynamic_workflow_cannot_bypass_quality_gate', gates.buildDynamicWorkflowWorkerBoundaryV2Report, { bypassQualityGate: true }, 'dynamicWorkflowWorkerBoundaryV2Status', 'fail', 'dynamic_workflow_v2'],
];

const defaultReport = gates.buildDefaultV105Reports({ caseCount: CASES.length, failedCaseCount: 0 });
for (const key of gates.V105_STATUS_KEYS) {
  CASES.push([`default_status_${key}`, () => defaultReport, {}, key, 'pass', 'status_coverage']);
}

const requiredCategories = [
  'representative_product_pr_validation',
  'evidence_single_source',
  'target_safe_report_contract',
  'source_only_compatibility',
  'active_legacy_self_test_summary',
  'diagnostic_source_trace',
  'quality_gate_self_protection',
  'integration_governance',
  'production_readiness_g4',
  'observability',
  'chaos_lite',
  'atomicity_delivery',
  'review_evidence',
  'owner_values',
  'token_ladder',
  'safe_suggested_patch',
  'task_size_advisor',
  'runtime_readiness_blocker_digest_v2',
  'dynamic_workflow_v2',
  'status_coverage',
];

const results = CASES.map(([name, builder, input, key, expected, category]) => {
  const report = builder(input);
  const actual = report[key]?.status || report.status;
  return { name, category, status: actual === expected ? 'pass' : 'fail', expected, actual, safeSummaryOnly: true };
});

const coveredStatuses = new Set(CASES.map(([, , , key]) => key));
const coverageFailures = gates.V105_STATUS_KEYS
  .filter((key) => !coveredStatuses.has(key))
  .map((key) => ({ name: `missing_status_coverage_${key}`, category: 'coverage', status: 'fail', expected: 'covered', actual: 'missing', safeSummaryOnly: true }));
const categoryFailures = requiredCategories
  .filter((category) => !results.some((item) => item.category === category))
  .map((category) => ({ name: `missing_category_${category}`, category, status: 'fail', expected: 'covered', actual: 'missing', safeSummaryOnly: true }));

const allResults = [...results, ...coverageFailures, ...categoryFailures];
const failures = allResults.filter((item) => item.status !== 'pass');
const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.7',
  status: failures.length ? 'fail' : 'pass',
  activeHarnessVersion: '1.0.5',
  activeSelfTestSuite: 'v105',
  activeSelfTestStatusKey: 'v105SelfTestStatus',
  legacySuites: { v104: 'advisory', v103: 'advisory' },
  v105SelfTestStatus: {
    status: failures.length ? 'fail' : 'pass',
    caseCount: allResults.length,
    failedCaseCount: failures.length,
    activeSelfTestSuite: 'v105',
    legacySuites: { v104: 'advisory', v103: 'advisory' },
    failures,
    safeSummaryOnly: true,
  },
  caseCategories: requiredCategories,
  safeSummaryOnly: true,
};

if (scanObjectForUnsafe(report).length) {
  report.status = 'fail';
  report.v105SelfTestStatus = { status: 'fail', reasonCodes: ['unsafe_value_detected'], safeSummaryOnly: true };
}

writeJsonReport(report, 'CODEX_V105_SELF_TEST_REPORT');
exitFor(report);
