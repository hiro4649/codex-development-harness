#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { scanObjectForUnsafe, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import * as gates from './codex-v104-gate-lib.mjs';

const CASES = [
  ['claim_repository_interface_no_internal_map_access_passes', gates.buildClaimToCodeVerifierReport, { body: 'API code now depends on repository interface\nsame-head evidence present', evidenceSources: ['safe'], sameHeadEvidence: true }, 'claimToCodeVerifierStatus', 'pass', 'claim_to_code'],
  ['claim_repository_interface_but_internal_map_access_fails', gates.buildClaimToCodeVerifierReport, { body: 'API code now depends on repository interface', evidenceSources: ['safe'], codeRefs: ['repository.recentTipsByWallet'], sameHeadEvidence: true }, 'claimContradictionStatus', 'fail', 'claim_to_code'],
  ['claim_no_runtime_change_but_runtime_file_changed_fails', gates.buildClaimToCodeVerifierReport, { body: 'no runtime readiness claimed', evidenceSources: ['safe'], changedFiles: ['runtime/adapter.js'], sameHeadEvidence: true }, 'claimToCodeVerifierStatus', 'fail', 'claim_to_code'],
  ['claim_no_production_ready_but_ready_claim_present_fails', gates.buildClaimToCodeVerifierReport, { body: 'no production readiness claimed\nproduction ready', evidenceSources: ['safe'], sameHeadEvidence: true }, 'claimContradictionStatus', 'fail', 'claim_to_code'],
  ['claim_backend_cwd_matches_product_surface_passes', gates.buildClaimToCodeVerifierReport, { body: 'backend product PR runs in apps/backend', evidenceSources: ['safe'], sameHeadEvidence: true }, 'claimCoverageStatus', 'pass', 'claim_to_code'],
  ['claim_contracts_cwd_matches_product_surface_passes', gates.buildClaimToCodeVerifierReport, { body: 'contracts PR runs in contracts', evidenceSources: ['safe'], sameHeadEvidence: true }, 'claimCoverageStatus', 'pass', 'claim_to_code'],
  ['claim_same_head_remote_pass_missing_fails', gates.buildClaimToCodeVerifierReport, { body: 'remote quality-gate pass', evidenceSources: ['safe'] }, 'claimToCodeVerifierStatus', 'fail', 'claim_to_code'],
  ['claim_safe_metadata_missing_returns_actionable_missing_fields', gates.buildClaimToCodeVerifierReport, { safeMetadataMissing: true }, 'claimSafeSuggestedCheckStatus', 'pass', 'claim_to_code'],
  ['claim_unknown_claim_does_not_pass', gates.buildClaimToCodeVerifierReport, { body: 'unmapped semantic claim', evidenceSources: ['safe'], sameHeadEvidence: true }, 'claimCoverageStatus', 'fail', 'claim_to_code'],
  ['claim_extraction_no_raw_values_output', gates.buildClaimToCodeVerifierReport, { body: 'same-head evidence present', evidenceSources: ['safe'], sameHeadEvidence: true }, 'claimExtractionStatus', 'pass', 'claim_to_code'],
  ['cripto_tip_repository_internal_maps_fail', gates.buildClaimToCodeVerifierReport, { body: 'API depends on CriptoTipRepository', evidenceSources: ['safe'], codeRefs: ['repository.recentTipsByWallet repository.affinityByUser repository.supportEvents repository.tipIntents'], sameHeadEvidence: true }, 'claimContradictionStatus', 'fail', 'claim_to_code'],

  ['server_accesses_repository_internal_map_fails', gates.buildArchitectureBoundaryLinterReport, { references: ['repository.tipIntents'] }, 'repositoryBoundaryStatus', 'fail', 'architecture_boundary'],
  ['server_uses_repository_interface_passes', gates.buildArchitectureBoundaryLinterReport, { references: ['repository.listRecentTips()'] }, 'architectureBoundaryLinterStatus', 'pass', 'architecture_boundary'],
  ['ui_reads_secret_env_fails', gates.buildArchitectureBoundaryLinterReport, { references: ['SECRET'] }, 'uiSecretBoundaryStatus', 'fail', 'architecture_boundary'],
  ['wallet_private_key_reference_fails', gates.buildArchitectureBoundaryLinterReport, { references: ['PRIVATE_KEY'] }, 'uiSecretBoundaryStatus', 'fail', 'architecture_boundary'],
  ['seed_phrase_reference_fails', gates.buildArchitectureBoundaryLinterReport, { references: ['MNEMONIC'] }, 'uiSecretBoundaryStatus', 'fail', 'architecture_boundary'],
  ['candidate_goes_to_adapter_fails', gates.buildArchitectureBoundaryLinterReport, { references: ['candidate execution shortcut adapter'] }, 'candidateExecutionBoundaryStatus', 'fail', 'architecture_boundary'],
  ['fixture_pass_claims_renderer_ready_fails', gates.buildArchitectureBoundaryLinterReport, { references: ['renderer_ready'] }, 'runtimeReadyEscalationBoundaryStatus', 'fail', 'architecture_boundary'],
  ['mock_pass_claims_production_ready_fails', gates.buildArchitectureBoundaryLinterReport, { references: ['production ready'] }, 'runtimeReadyEscalationBoundaryStatus', 'fail', 'architecture_boundary'],
  ['youtube_superchat_bypass_claim_fails', gates.buildArchitectureBoundaryLinterReport, { references: ['Super Chat bypass'] }, 'youtubeCryptoBoundaryStatus', 'fail', 'architecture_boundary'],
  ['wallet_address_passed_to_ai_reaction_fails', gates.buildArchitectureBoundaryLinterReport, { references: ['wallet_address used for reaction memory'] }, 'walletPrivacyBoundaryStatus', 'fail', 'architecture_boundary'],
  ['safe_policy_docs_only_passes', gates.buildArchitectureBoundaryLinterReport, { policyDocsOnly: true, references: ['PRIVATE_KEY policy prohibition'] }, 'architectureBoundaryLinterStatus', 'pass', 'architecture_boundary'],
  ['raw_match_value_not_output', gates.buildArchitectureBoundaryLinterReport, { references: ['repository.publicInterface'] }, 'forbiddenReferenceStatus', 'pass', 'architecture_boundary'],

  ['ci_pass_but_ac_unknown_high_risk_fails', gates.buildAcceptanceCriteriaMatrixReport, { items: [{ id: 'g1', status: 'unknown', risk: 'high' }] }, 'acceptanceCriteriaMatrixStatus', 'fail', 'acceptance_criteria_matrix'],
  ['all_required_ac_passes', gates.buildAcceptanceCriteriaMatrixReport, { items: [{ id: 'g1', status: 'pass', evidence: 'safe_ref' }] }, 'acceptanceCriteriaMatrixStatus', 'pass', 'acceptance_criteria_matrix'],
  ['partial_ac_blocks_production_ready', gates.buildAcceptanceCriteriaMatrixReport, { productionReadyClaimed: true, items: [{ id: 'g1', status: 'partial', evidence: 'safe_ref' }] }, 'doneDefinitionStatus', 'fail', 'acceptance_criteria_matrix'],
  ['not_applicable_without_reason_fails', gates.buildAcceptanceCriteriaMatrixReport, { items: [{ id: 'g1', status: 'not_applicable' }] }, 'acceptanceCriteriaMatrixStatus', 'fail', 'acceptance_criteria_matrix'],
  ['safe_evidence_refs_present_passes', gates.buildAcceptanceCriteriaMatrixReport, { items: [{ id: 'g1', status: 'pass', evidence: 'safe_line_ref' }] }, 'acceptanceCriteriaEvidenceStatus', 'pass', 'acceptance_criteria_matrix'],
  ['cripto_tip_g1_mock_slice_not_g3_integration_ready', gates.buildAcceptanceCriteriaMatrixReport, { items: [{ id: 'g1_mock', status: 'partial', evidence: 'safe_ref' }] }, 'doneDefinitionStatus', 'fail', 'acceptance_criteria_matrix'],
  ['live2d_fixture_ready_not_runtime_ready', gates.buildAcceptanceCriteriaMatrixReport, { productionReadyClaimed: true, items: [{ id: 'live2d_fixture', status: 'partial', evidence: 'safe_ref' }] }, 'acceptanceCriteriaMatrixStatus', 'fail', 'acceptance_criteria_matrix'],
  ['funky_receipt_fetcher_adapter_not_runtime_ready', gates.buildAcceptanceCriteriaMatrixReport, { productionReadyClaimed: true, items: [{ id: 'adapter', status: 'partial', evidence: 'safe_ref' }] }, 'acceptanceCriteriaMatrixStatus', 'fail', 'acceptance_criteria_matrix'],

  ['high_risk_unresolved_blocks', gates.buildRiskGateReport, { risks: [{ id: 'unsafe_custody_design', level: 'high', status: 'open' }] }, 'riskGateStatus', 'fail', 'risk_gate'],
  ['owner_accepts_manual_risk_but_not_non_overridable', gates.buildRiskGateReport, { risks: [{ id: 'secret_leak', level: 'critical', ownerAccepted: true }] }, 'riskCannotBeOverriddenStatus', 'fail', 'risk_gate'],
  ['critical_secret_leak_blocks', gates.buildRiskGateReport, { risks: [{ id: 'secret_leak', level: 'critical' }] }, 'riskGateStatus', 'fail', 'risk_gate'],
  ['production_ready_claim_without_gate_blocks', gates.buildRiskGateReport, { productionReadyClaimedWithoutGate: true }, 'riskGateStatus', 'fail', 'risk_gate'],
  ['runtime_ready_claim_without_real_evidence_blocks', gates.buildRiskGateReport, { runtimeReadyClaimedWithoutEvidence: true }, 'riskGateStatus', 'fail', 'risk_gate'],
  ['external_blocked_does_not_become_pass', gates.buildRiskGateReport, { externalBlockedTreatedAsPass: true }, 'riskGateStatus', 'fail', 'risk_gate'],
  ['risk_budget_exceeded_warns_or_fails_by_policy', gates.buildRiskGateReport, { riskBudgetUsed: 8, riskBudget: 5 }, 'riskBudgetStatus', 'fail', 'risk_gate'],
  ['risk_register_safe_summary_only', gates.buildRiskGateReport, {}, 'riskGateStatus', 'pass', 'risk_gate'],

  ['safe_file_ref_present_passes', gates.buildEvidenceReportV2Report, {}, 'evidenceReportV2Status', 'pass', 'evidence_report_v2'],
  ['raw_log_in_evidence_fails', gates.buildEvidenceReportV2Report, { evidence: { sourceHeadSha: 'a', artifactHeadSha: 'a', sameHeadEvidence: true, safeLineRefs: ['a:1'], evidenceFreshness: 'current', evidenceOrigin: 'local', note: 'raw log' } }, 'evidenceReportV2Status', 'fail', 'evidence_report_v2'],
  ['raw_diff_in_evidence_fails', gates.buildEvidenceReportV2Report, { evidence: { sourceHeadSha: 'a', artifactHeadSha: 'a', sameHeadEvidence: true, safeLineRefs: ['a:1'], evidenceFreshness: 'current', evidenceOrigin: 'local', note: 'raw diff' } }, 'evidenceReportV2Status', 'fail', 'evidence_report_v2'],
  ['artifact_head_mismatch_fails', gates.buildEvidenceReportV2Report, { evidence: { sourceHeadSha: 'a', artifactHeadSha: 'b', sameHeadEvidence: true, safeLineRefs: ['a:1'], evidenceFreshness: 'current', evidenceOrigin: 'local' } }, 'sameHeadEvidenceStatus', 'fail', 'evidence_report_v2'],
  ['same_head_remote_missing_blocks_merge', gates.buildEvidenceReportV2Report, { evidence: { sourceHeadSha: 'a', artifactHeadSha: 'a', sameHeadEvidence: false, safeLineRefs: ['a:1'], evidenceFreshness: 'current', evidenceOrigin: 'local' } }, 'sameHeadEvidenceStatus', 'fail', 'evidence_report_v2'],
  ['local_pass_remote_missing_not_merge_ready', gates.buildEvidenceReportV2Report, { evidence: { sourceHeadSha: 'a', artifactHeadSha: 'a', sameHeadEvidence: false, safeLineRefs: ['a:1'], evidenceFreshness: 'current', evidenceOrigin: 'local' } }, 'evidenceReportV2Status', 'fail', 'evidence_report_v2'],
  ['stale_evidence_detected', gates.buildEvidenceReportV2Report, { evidence: { sourceHeadSha: 'a', artifactHeadSha: 'a', sameHeadEvidence: true, safeLineRefs: ['a:1'], evidenceFreshness: 'stale', evidenceOrigin: 'local' } }, 'evidenceFreshnessStatus', 'fail', 'evidence_report_v2'],
  ['evidence_site_is_not_source_of_truth', gates.buildEvidenceReportV2Report, { evidence: { sourceHeadSha: 'a', artifactHeadSha: 'a', sameHeadEvidence: true, safeLineRefs: ['a:1'], evidenceFreshness: 'current', evidenceOrigin: 'site_source_of_truth' } }, 'evidenceOriginStatus', 'fail', 'evidence_report_v2'],

  ['mergeable_true_once_not_enough', gates.buildGithubStateHysteresisReport, { mergeableTrueOnceOnly: true }, 'mergeableStabilityStatus', 'fail', 'github_state_hysteresis'],
  ['mergeable_unknown_blocks_merge', gates.buildGithubStateHysteresisReport, { mergeable: 'UNKNOWN' }, 'mergeableStabilityStatus', 'fail', 'github_state_hysteresis'],
  ['head_sha_changed_after_checks_blocks', gates.buildGithubStateHysteresisReport, { headShaChangedAfterChecks: true }, 'headShaStillCurrentStatus', 'fail', 'github_state_hysteresis'],
  ['checks_on_old_head_block', gates.buildGithubStateHysteresisReport, { checksOnOldHead: true }, 'checksStillCurrentStatus', 'fail', 'github_state_hysteresis'],
  ['base_sha_changed_requires_refresh', gates.buildGithubStateHysteresisReport, { baseShaChanged: true }, 'baseShaFreshnessStatus', 'fail', 'github_state_hysteresis'],
  ['live_pr_body_newer_than_event_payload_wins', gates.buildGithubStateHysteresisReport, { refreshed: true }, 'lastMinutePrStateRefreshStatus', 'pass', 'github_state_hysteresis'],
  ['github_transient_classified_safe', gates.buildGithubStateHysteresisReport, { refreshed: true }, 'githubStateHysteresisStatus', 'pass', 'github_state_hysteresis'],

  ...['forge', 'gitleaks', 'slither', 'docker', 'browser_smoke'].map((tool) => [`${tool}_missing_not_pass`, gates.buildToolGapResolverReport, { missingTool: tool, safeNextAction: 'collect same-head remote equivalent' }, 'toolGapResolverStatus', 'fail', 'tool_gap_resolver']),
  ['remote_same_head_equivalent_passes', gates.buildToolGapResolverReport, { missingTool: 'slither', remoteEquivalent: { sameHead: true, safeArtifact: true }, safeNextAction: 'use same-head remote artifact' }, 'toolGapResolverStatus', 'pass', 'tool_gap_resolver'],
  ['remote_old_head_equivalent_fails', gates.buildToolGapResolverReport, { missingTool: 'slither', remoteEquivalent: { sameHead: false, safeArtifact: true }, safeNextAction: 'rerun remote artifact' }, 'remoteEquivalentEvidenceStatus', 'fail', 'tool_gap_resolver'],
  ['tool_gap_safe_next_action_present', gates.buildToolGapResolverReport, { missingTool: 'docker', safeNextAction: 'collect same-head remote artifact' }, 'toolGapSafeFallbackStatus', 'pass', 'tool_gap_resolver'],

  ['contracts_product_pr_uses_contracts_cwd', gates.buildProductSurfaceRouterV2Report, { changedFiles: ['contracts/a.sol'] }, 'productSurfaceRouterV2Status', 'pass', 'product_surface_router_v2'],
  ['backend_product_pr_uses_backend_cwd', gates.buildProductSurfaceRouterV2Report, { changedFiles: ['apps/backend/a.js'] }, 'productSurfaceRouterV2Status', 'pass', 'product_surface_router_v2'],
  ['api_product_pr_uses_api_cwd', gates.buildProductSurfaceRouterV2Report, { changedFiles: ['apps/api/a.ts'] }, 'productSurfaceRouterV2Status', 'pass', 'product_surface_router_v2'],
  ['web_product_pr_uses_web_cwd', gates.buildProductSurfaceRouterV2Report, { changedFiles: ['apps/web/a.ts'] }, 'productSurfaceRouterV2Status', 'pass', 'product_surface_router_v2'],
  ['frontend_product_pr_uses_frontend_cwd', gates.buildProductSurfaceRouterV2Report, { changedFiles: ['apps/frontend/a.ts'] }, 'productSurfaceRouterV2Status', 'pass', 'product_surface_router_v2'],
  ['root_package_missing_never_runs_root_npm', gates.buildProductSurfaceRouterV2Report, { changedFiles: ['src/a.js'], rootPackageExists: false }, 'productSurfaceRouterV2Status', 'fail', 'product_surface_router_v2'],
  ['command_class_metadata_recorded', gates.buildProductSurfaceRouterV2Report, { changedFiles: ['contracts/a.sol'] }, 'productSurfaceRouterV2Status', 'pass', 'product_surface_router_v2'],
  ['package_scope_metadata_recorded', gates.buildProductSurfaceRouterV2Report, { changedFiles: ['apps/backend/a.js'] }, 'productSurfaceRouterV2Status', 'pass', 'product_surface_router_v2'],
  ['mixed_surface_requires_split_or_explicit_multi_surface_policy', gates.buildProductSurfaceRouterV2Report, { changedFiles: ['apps/backend/a.js', 'contracts/a.sol'] }, 'productSurfaceRouterV2Status', 'fail', 'product_surface_router_v2'],

  ['active_v104_selected', gates.buildActiveSelfTestSingleSourceReport, {}, 'activeSelfTestSingleSourceStatus', 'pass', 'active_self_test_single_source'],
  ['v104_failure_blocks', gates.buildActiveSelfTestSingleSourceReport, { v104Failure: true }, 'activeSuiteMustBlockStatus', 'fail', 'active_self_test_single_source'],
  ['legacy_v103_failure_advisory_only_unless_policy_requires', gates.buildActiveSelfTestSingleSourceReport, { legacyV103Failure: true }, 'legacySelfTestAdvisoryStatus', 'pass', 'active_self_test_single_source'],
  ['legacy_v102_failure_advisory_only', gates.buildActiveSelfTestSingleSourceReport, { legacyV102Failure: true }, 'legacySelfTestAdvisoryStatus', 'pass', 'active_self_test_single_source'],
  ['active_artifact_reports_v104_not_v098', gates.buildActiveSelfTestSingleSourceReport, {}, 'activeSelfTestArtifactExportStatus', 'pass', 'active_self_test_single_source'],
  ['fallback_to_old_suite_when_v104_expected_fails', gates.buildActiveSelfTestSingleSourceReport, { fallbackToOldSuite: true }, 'activeSelfTestSingleSourceStatus', 'fail', 'active_self_test_single_source'],

  ['npm_executed_true_source_recorded', gates.buildDiagnosticSourceFieldReport, {}, 'remoteNpmDiagnosticSourceStatus', 'pass', 'diagnostic_source_fields'],
  ['npm_exit_code_zero_source_recorded', gates.buildDiagnosticSourceFieldReport, {}, 'remoteNpmDiagnosticSourceStatus', 'pass', 'diagnostic_source_fields'],
  ['formal_remote_product_evidence_precedence_passes', gates.buildDiagnosticSourceFieldReport, {}, 'remoteProductEvidenceSourceStatus', 'pass', 'diagnostic_source_fields'],
  ['diagnostic_missing_field_fails_actionably', gates.buildDiagnosticSourceFieldReport, { diagnostics: [{ field: 'npmExecuted' }] }, 'diagnosticSourceFieldStatus', 'fail', 'diagnostic_source_fields'],
  ['conflicting_evidence_classified', gates.buildDiagnosticSourceFieldReport, { conflictingEvidence: true }, 'normalizationFieldShapeStatus', 'fail', 'diagnostic_source_fields'],

  ['backend_cwd_hotfix_preserved', gates.buildTargetHotfixPreservationReport, {}, 'targetHotfixPreservationAcrossRolloutStatus', 'pass', 'target_hotfix_preservation_replay'],
  ['contracts_cwd_hotfix_preserved', gates.buildTargetHotfixPreservationReport, {}, 'targetHotfixPreservationAcrossRolloutStatus', 'pass', 'target_hotfix_preservation_replay'],
  ['legacy_advisory_preserved', gates.buildTargetHotfixPreservationReport, {}, 'previousTargetHotfixInventoryStatus', 'pass', 'target_hotfix_preservation_replay'],
  ['reason_summary_stale_blocker_not_reintroduced', gates.buildTargetHotfixPreservationReport, {}, 'rolloutRegressionReplayStatus', 'pass', 'target_hotfix_preservation_replay'],
  ['active_suite_export_not_reverted', gates.buildTargetHotfixPreservationReport, {}, 'rolloutRegressionReplayStatus', 'pass', 'target_hotfix_preservation_replay'],
  ['root_npm_missing_package_not_run', gates.buildTargetHotfixPreservationReport, {}, 'rolloutRegressionReplayStatus', 'pass', 'target_hotfix_preservation_replay'],
  ['same_head_requirement_preserved', gates.buildTargetHotfixPreservationReport, {}, 'rolloutRegressionReplayStatus', 'pass', 'target_hotfix_preservation_replay'],
  ['target_hotfix_dropped_fails_rollout', gates.buildTargetHotfixPreservationReport, { dropped: ['backend_cwd'] }, 'targetHotfixDroppedStatus', 'fail', 'target_hotfix_preservation_replay'],

  ['voxweave_pr_chain_saturated', gates.buildPrChainSaturationReport, { saturated: true }, 'harnessWorkSaturationStatus', 'pass', 'pr_chain_saturation'],
  ['independent_reviewer_unavailable_terminal', gates.buildPrChainSaturationReport, { saturated: true }, 'externalBlockedTerminalStatus', 'pass', 'external_blocked_terminal'],
  ['external_blocked_prevents_new_pr', gates.buildExternalBlockedTerminalReport, { blocker: 'legal_review_required' }, 'newPrAllowedStatus', 'pass', 'external_blocked_terminal'],

  ['role_profile_denies_unscoped_tool', gates.buildRoleToolEvidenceAnnotationReport, { unscopedTool: true }, 'toolPermissionBoundaryStatus', 'fail', 'role_tool_policy'],
  ['evidence_site_not_source_of_truth', gates.buildRoleToolEvidenceAnnotationReport, {}, 'siteIsNotSourceOfTruthStatus', 'pass', 'evidence_site_policy'],
  ['site_head_stale_warns_or_fails', gates.buildRoleToolEvidenceAnnotationReport, { siteHeadStale: true }, 'siteHeadShaFreshnessStatus', 'fail', 'evidence_site_policy'],
  ['annotation_creates_work_packet_not_verified_patch', gates.buildRoleToolEvidenceAnnotationReport, {}, 'annotationToWorkPacketStatus', 'pass', 'annotation_workpacket'],
  ['annotation_cannot_skip_claim_to_code', gates.buildRoleToolEvidenceAnnotationReport, {}, 'annotationDoesNotBypassGateStatus', 'pass', 'annotation_workpacket'],
  ['secret_bearing_tool_denied', gates.buildRoleToolEvidenceAnnotationReport, { secretBearingTool: true }, 'secretBearingToolDeniedStatus', 'pass', 'role_tool_policy'],
  ['wallet_tool_denied_by_default', gates.buildRoleToolEvidenceAnnotationReport, { walletTool: true }, 'secretBearingToolDeniedStatus', 'pass', 'role_tool_policy'],
  ['youtube_tool_denied_by_default', gates.buildRoleToolEvidenceAnnotationReport, { youtubeTool: true }, 'secretBearingToolDeniedStatus', 'pass', 'role_tool_policy'],
  ['rpc_tool_denied_by_default', gates.buildRoleToolEvidenceAnnotationReport, { rpcTool: true }, 'secretBearingToolDeniedStatus', 'pass', 'role_tool_policy'],

  ['dynamic_workflow_for_large_task_generates_work_packets', gates.buildDynamicWorkflowLiteReport, { largeTask: true }, 'dynamicWorkflowDecisionStatus', 'pass', 'dynamic_workflow_lite'],
  ['small_task_dynamic_workflow_not_needed', gates.buildDynamicWorkflowLiteReport, {}, 'dynamicWorkflowDecisionStatus', 'pass', 'dynamic_workflow_lite'],
  ['real_subagent_runner_not_started', gates.buildDynamicWorkflowLiteReport, { realSubagentRunnerStarted: true }, 'subagentExecutionPermissionStatus', 'fail', 'dynamic_workflow_lite'],
  ['simulated_subagent_labeled', gates.buildDynamicWorkflowLiteReport, {}, 'simulatedSubagentFallbackStatus', 'pass', 'dynamic_workflow_lite'],
  ['approval_gate_required_before_write', gates.buildDynamicWorkflowLiteReport, { missingApprovalGate: true }, 'approvalGateCoverageStatus', 'fail', 'dynamic_workflow_lite'],
  ['worker_file_ownership_conflict_fails', gates.buildDynamicWorkflowLiteReport, { workerFileConflict: true }, 'workerFileOwnershipV2Status', 'fail', 'dynamic_workflow_lite'],
  ['verification_fan_in_required', gates.buildDynamicWorkflowLiteReport, {}, 'verificationFanInStatus', 'pass', 'dynamic_workflow_lite'],
  ['workflow_resume_checkpoint_safe', gates.buildDynamicWorkflowLiteReport, {}, 'workflowResumeCheckpointStatus', 'pass', 'dynamic_workflow_lite'],
  ['autonomous_merge_forbidden', gates.buildDynamicWorkflowLiteReport, { autonomousMerge: true }, 'dynamicWorkflowDecisionStatus', 'fail', 'dynamic_workflow_lite'],
];

const defaultReport = gates.buildDefaultV104Reports({ caseCount: CASES.length, failedCaseCount: 0 });
for (const key of gates.V104_STATUS_KEYS) {
  CASES.push([`default_status_${key}`, () => defaultReport, {}, key, 'pass', 'repo_profile_fixtures']);
}

const requiredCategories = [
  'claim_to_code',
  'architecture_boundary',
  'acceptance_criteria_matrix',
  'risk_gate',
  'evidence_report_v2',
  'github_state_hysteresis',
  'tool_gap_resolver',
  'product_surface_router_v2',
  'active_self_test_single_source',
  'diagnostic_source_fields',
  'target_hotfix_preservation_replay',
  'pr_chain_saturation',
  'external_blocked_terminal',
  'role_tool_policy',
  'evidence_site_policy',
  'annotation_workpacket',
  'dynamic_workflow_lite',
  'repo_profile_fixtures',
];

const results = CASES.map(([name, builder, input, key, expected, category]) => {
  const report = builder(input);
  const actual = report[key]?.status || report.status;
  return { name, category, status: actual === expected ? 'pass' : 'fail', expected, actual, safeSummaryOnly: true };
});

const coveredStatuses = new Set(CASES.map(([, , , key]) => key));
const coverageFailures = gates.V104_STATUS_KEYS
  .filter((key) => !coveredStatuses.has(key))
  .map((key) => ({ name: `missing_status_coverage_${key}`, category: 'coverage', status: 'fail', expected: 'covered', actual: 'missing', safeSummaryOnly: true }));
const categoryFailures = requiredCategories
  .filter((category) => !results.some((item) => item.category === category))
  .map((category) => ({ name: `missing_category_${category}`, category, status: 'fail', expected: 'covered', actual: 'missing', safeSummaryOnly: true }));

const allResults = [...results, ...coverageFailures, ...categoryFailures];
const failures = allResults.filter((item) => item.status !== 'pass');
const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.5',
  status: failures.length ? 'fail' : 'pass',
  activeHarnessVersion: '1.0.4',
  activeSelfTestSuite: 'v104',
  activeSelfTestStatusKey: 'v104SelfTestStatus',
  legacySuites: { v103: 'advisory', v102: 'advisory' },
  v104SelfTestStatus: {
    status: failures.length ? 'fail' : 'pass',
    caseCount: allResults.length,
    failedCaseCount: failures.length,
    activeSelfTestSuite: 'v104',
    failures,
    safeSummaryOnly: true,
  },
  caseCategories: requiredCategories,
  safeSummaryOnly: true,
};

if (scanObjectForUnsafe(report).length) {
  report.status = 'fail';
  report.v104SelfTestStatus = { status: 'fail', reasonCodes: ['unsafe_value_detected'], safeSummaryOnly: true };
}

writeJsonReport(report, 'CODEX_V104_SELF_TEST_REPORT');
exitFor(report);
