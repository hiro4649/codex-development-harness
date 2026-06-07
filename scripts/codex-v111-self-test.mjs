#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.1

import { writeJsonReport, exitFor, scanObjectForUnsafe } from './codex-v080-lib.mjs';
import {
  HARNESS_VERSION,
  MARKER,
  V111_STATUS_KEYS,
  V111_ABSORPTION_MAP,
  buildDefaultV111Statuses,
  buildContextCapsule,
  evaluateInputTokenBudget,
  evaluateSessionHardCap,
  buildTerminalBlockedPlaybook,
  buildSafeFailingTestArtifact,
  evaluatePrLifecycle,
  planEvidenceRefresh,
  buildValidationResumePlan,
  buildCiWatcherArtifact,
  evaluateNoNewPrUnlessDelta,
  buildMainReflectionPackageV2,
  buildOwnershipLedger,
  classifyReviewEvidenceV4,
  evaluateTokenStage,
  buildFunkyLaneLedger,
  evaluateLive2dCriticalInvariants,
  scanSafeEvidenceWording,
  classifyRemoteProductEvidence,
  evaluateFixtureStability,
  buildPerformanceTokenAudit,
  buildV111Report,
  classifyTargetModeCompatibilityStatus,
  buildTargetModeLegacyCompatibilityReport,
} from './codex-v111-token-hard-cap.mjs';

function test(name, fn) {
  try {
    return { name, status: fn() ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch {
    return { name, status: 'fail', reasonCodes: ['self_test_exception'], safeSummaryOnly: true };
  }
}

const capsule = buildContextCapsule();

const cases = [
  test('all_required_v111_status_keys_have_default_pass', () => V111_STATUS_KEYS.every((key) => buildDefaultV111Statuses()[key]?.status === 'pass')),
  test('absorbed_v110_statuses_remain_recognized', () => V111_ABSORPTION_MAP.tokenBudgetStatus.includes('inputTokenBudgetStatus') && V111_ABSORPTION_MAP.ciWatcherV2Status.includes('sameHeadCiLedgerStatus')),
  test('absorbed_statuses_not_missing', () => Object.values(V111_ABSORPTION_MAP).every((value) => Array.isArray(value) && value.length > 0)),
  test('absorbed_blocking_failures_remain_blocking', () => evaluateInputTokenBudget({ requiredCheckFailureHidden: true }).status === 'fail'),
  test('absorbed_advisory_statuses_remain_advisory', () => evaluateSessionHardCap({ sessionCount: 2 }).status === 'pass'),
  test('v110_summaries_remain_parseable', () => buildV111Report().v110SelfTestStatus.status === 'pass'),
  test('target_mode_legacy_v110_statuses_absorbed', () => classifyTargetModeCompatibilityStatus('tokenBudgetStatus', { status: 'missing' }, buildDefaultV111Statuses()).classification === 'absorbed_by_v111'),
  test('target_mode_legacy_v109_statuses_absorbed', () => classifyTargetModeCompatibilityStatus('decisionLedgerStatus', { status: 'missing' }, buildDefaultV111Statuses()).classification === 'absorbed_by_v111'),
  test('target_mode_v108_v109_v110_lineage_does_not_replace_v111', () => classifyTargetModeCompatibilityStatus('v111SelfTestStatus', { status: 'missing' }, { v110SelfTestStatus: { status: 'pass' } }).effectiveStatus === 'fail'),
  test('target_mode_generic_missing_not_emitted_for_absorbed', () => classifyTargetModeCompatibilityStatus('ciWatcherStatus', { status: 'missing' }, buildDefaultV111Statuses()).reasonCodes.includes('absorbed_by_v111')),
  test('target_mode_missing_legacy_absorbed_nonblocking_if_replacement_exists', () => classifyTargetModeCompatibilityStatus('operatorDigestV4Status', { status: 'missing' }, buildDefaultV111Statuses()).effectiveStatus === 'pass_absorbed'),
  test('target_mode_missing_current_required_v111_status_blocks', () => classifyTargetModeCompatibilityStatus('v111SelfTestStatus', { status: 'missing' }, buildDefaultV111Statuses()).classification === 'missing_blocking'),
  test('target_mode_no_status_reported_blocks', () => classifyTargetModeCompatibilityStatus('ciWatcherStatus', { status: 'no_status_reported' }, buildDefaultV111Statuses()).effectiveStatus === 'fail'),
  test('target_mode_unsafe_output_blocks', () => classifyTargetModeCompatibilityStatus('goldenSetStatus', { status: 'fail', reasonCodes: ['unsafe_value_detected'] }, buildDefaultV111Statuses()).effectiveStatus === 'fail'),
  test('target_mode_runtime_readiness_claim_blocks', () => classifyTargetModeCompatibilityStatus('runtimeReturnGateStatus', { status: 'fail', reasonCodes: ['runtime_readiness_claimed'] }, buildDefaultV111Statuses()).effectiveStatus === 'fail'),
  test('target_mode_production_readiness_claim_blocks', () => classifyTargetModeCompatibilityStatus('mainReflectionPackageStatus', { status: 'fail', reasonCodes: ['production_readiness_claimed'] }, buildDefaultV111Statuses()).effectiveStatus === 'fail'),
  test('target_mode_legacy_compat_voxweave_v111_rollout', () => buildTargetModeLegacyCompatibilityReport({
    ...buildDefaultV111Statuses(),
    versionLineageStatus: { status: 'fail', reasonCodes: ['active_marker_version_mismatch'] },
    knowledgeGovernanceStatus: { status: 'fail', reasonCodes: ['knowledge_marker_mismatch'] },
    goldenSetStatus: { status: 'fail', reasonCodes: ['golden_set_failed'] },
    v080SelfTestStatus: { status: 'fail' },
    v081SelfTestStatus: { status: 'fail' },
    v082SelfTestStatus: { status: 'fail' },
    v083SelfTestStatus: { status: 'fail' },
    v087SelfTestStatus: { status: 'fail' },
    v090SelfTestStatus: { status: 'fail' },
    v092SelfTestStatus: { status: 'fail' },
  }).status === 'pass'),
  test('target_mode_true_blocker_fixture_still_fails', () => buildTargetModeLegacyCompatibilityReport({ ...buildDefaultV111Statuses(), v111SelfTestStatus: { status: 'fail' } }).status === 'fail'),
  test('target_mode_safe_artifact_pro_summary_only', () => buildTargetModeLegacyCompatibilityReport(buildDefaultV111Statuses()).safeSummaryOnly === true),
  test('target_mode_context_capsule_emitted', () => buildDefaultV111Statuses().contextCapsuleStatus.status === 'pass'),
  test('target_mode_decision_gate_ledger_emitted', () => classifyTargetModeCompatibilityStatus('decisionLedgerStatus', { status: 'missing' }, buildDefaultV111Statuses()).absorbedBy.includes('contextCapsuleStatus')),
  test('target_mode_token_hard_cap_preserved', () => buildDefaultV111Statuses().chatHardCapStatus.status === 'pass'),
  test('target_mode_eight_session_default_denied', () => evaluateSessionHardCap({ sessionCount: 8 }).reasonCodes.includes('eight_session_default_denied')),

  test('context_capsule_emitted_on_pass', () => capsule.activeHarness === '1.1.1' && capsule.safeSummaryOnly === true),
  test('context_capsule_emitted_on_blocked', () => buildContextCapsule({ currentTerminalBlocker: 'blocked' }).currentTerminalBlocker === 'blocked'),
  test('context_capsule_emitted_on_terminal_blocked', () => buildContextCapsule({ targetRepos: { 'CRIPTO-TIP': 'terminal_blocked_previous_harness_active' } }).targetRepos['CRIPTO-TIP'].includes('terminal_blocked')),
  test('context_capsule_resumes_without_history', () => capsule.detailMode === 'explicit_request_only' && capsule.oneSafeNextAction.length > 0),
  test('context_capsule_never_claims_runtime_readiness', () => capsule.runtimeReadinessClaimed === false),
  test('context_capsule_never_claims_production_readiness', () => capsule.productionReadinessClaimed === false),
  test('context_capsule_freshness_status', () => buildContextCapsule({ generatedAt: 'safe_now' }).generatedAt === 'safe_now'),
  test('compact_thread_handoff_status', () => buildContextCapsule().thread === 'source_harness_v111'),

  test('chat_hard_cap_blocks_detail_default', () => evaluateInputTokenBudget({ detailMode: true, explicitDetailRequest: false }).status === 'fail'),
  test('input_token_budget_full_evaluation_becomes_digest', () => evaluateInputTokenBudget({ fullEvaluationRepeated: true, newFindings: false }).digest === 'no_new_findings'),
  test('evaluation_digest_ingest_new_findings', () => evaluateInputTokenBudget({ fullEvaluationRepeated: true, newFindings: true }).status === 'pass'),
  test('artifact_pointer_only_blocks_expansion', () => evaluateInputTokenBudget({ artifactExpanded: true }).reasonCodes.includes('artifact_pointer_only_required')),
  test('detail_escalation_gate_requires_explicit_request', () => evaluateInputTokenBudget({ detailMode: true }).reasonCodes.includes('detail_escalation_required')),
  test('no_history_replay_blocks_without_delta', () => evaluateInputTokenBudget({ historyReplayedWithoutDelta: true }).status === 'fail'),
  test('state_delta_required_hard_blocker_visible', () => evaluateInputTokenBudget({ hardBlockerHidden: true }).status === 'fail'),
  test('required_check_failure_never_hidden', () => evaluateInputTokenBudget({ requiredCheckFailureHidden: true }).status === 'fail'),
  test('readiness_violation_never_hidden', () => evaluateInputTokenBudget({ readinessViolationHidden: true }).status === 'fail'),

  test('eight_session_without_owner_exception_fails', () => evaluateSessionHardCap({ sessionCount: 8 }).reasonCodes.includes('eight_session_default_denied')),
  test('eight_session_without_role_ledger_fails', () => evaluateSessionHardCap({ sessionCount: 8, ownerException: true, exitCriteria: true }).reasonCodes.includes('role_ledger_required')),
  test('eight_session_without_exit_criteria_fails', () => evaluateSessionHardCap({ sessionCount: 8, ownerException: true, roleLedger: true }).reasonCodes.includes('exit_criteria_required')),
  test('fan_in_more_than_once_fails', () => evaluateSessionHardCap({ fanInCount: 2 }).status === 'fail'),
  test('duplicate_investigation_fails', () => evaluateSessionHardCap({ duplicateInvestigation: true }).status === 'fail'),
  test('worktree_isolation_required_for_mutating_sessions', () => evaluateSessionHardCap({ fileMutatingSessions: true }).status === 'fail'),
  test('main_only_passes', () => evaluateSessionHardCap({ sessionCount: 1 }).mode === 'main_only'),
  test('main_plus_verifier_passes', () => evaluateSessionHardCap({ sessionCount: 2 }).status === 'pass'),
  test('main_verifier_refutation_passes_high_risk', () => evaluateSessionHardCap({ sessionCount: 3 }).mode === 'main_verifier_refutation'),
  test('precision_not_weakened_by_session_cap', () => evaluateSessionHardCap({ sessionCount: 2 }).precisionPreserved === true),
  test('subagent_merge_authority_blocked', () => evaluateSessionHardCap({ subagentMergeAuthority: true }).status === 'fail'),
  test('wallet_rpc_deploy_access_blocked', () => evaluateSessionHardCap({ walletRpcDeployAccess: true }).status === 'fail'),

  test('terminal_blocked_playbook_emitted', () => buildTerminalBlockedPlaybook({ productCodeFailure: true }).terminalBlocked === true),
  test('terminal_blocked_prohibits_merge', () => buildTerminalBlockedPlaybook({ productCodeFailure: true }).mergeProhibited === true),
  test('terminal_blocked_prohibits_raw_logs', () => buildTerminalBlockedPlaybook().rawLogsAllowed === false),
  test('terminal_blocked_prohibits_product_repair_inside_rollout', () => buildTerminalBlockedPlaybook({ productCodeFailure: true }).forbiddenActions.includes('product_repair_inside_harness_rollout')),
  test('terminal_blocked_next_action_none_until_owner_scope', () => buildTerminalBlockedPlaybook({ productCodeFailure: true }).repairScope === 'separate_product_scope_required'),
  test('terminal_blocked_cache_prevents_reanalysis', () => evaluateNoNewPrUnlessDelta({ terminalBlockedCacheActive: true }).status === 'fail'),

  test('safe_failing_test_artifact_emitted', () => buildSafeFailingTestArtifact().status === 'pass'),
  test('pnpm_typecheck_passed_but_test_failed_classified', () => buildSafeFailingTestArtifact({ typecheckPassed: true, testFailed: true }).typecheckPassed === true),
  test('product_code_failure_propagates', () => buildSafeFailingTestArtifact({ productCodeLikelyInvolved: true }).productCodeLikelyInvolved === true),
  test('raw_stack_omitted_required', () => buildSafeFailingTestArtifact({ rawStackOmitted: false }).status === 'fail'),
  test('raw_logs_read_false_required', () => buildSafeFailingTestArtifact({ rawLogsRead: true }).status === 'fail'),
  test('safe_failing_test_allows_separate_repair_not_rollout_repair', () => buildTerminalBlockedPlaybook({ productCodeFailure: true }).nextSafeBranch === 'separate_owner_authorized_product_repair'),

  test('pr_lifecycle_pushed_to_checks_running', () => evaluatePrLifecycle({ state: 'pushed_waiting_actions' }).nextState === 'checks_running'),
  test('merge_ready_requires_same_head', () => evaluatePrLifecycle({ state: 'merge_ready', sameHead: false }).status === 'fail'),
  test('merge_ready_blocks_failed_required_check', () => evaluatePrLifecycle({ state: 'merge_ready', sameHead: true, requiredCheckFailure: true }).status === 'fail'),
  test('merge_ready_blocks_no_status_reported', () => evaluatePrLifecycle({ state: 'merge_ready', sameHead: true, noStatusReported: true }).status === 'fail'),
  test('closed_without_merge_not_reusable', () => evaluatePrLifecycle({ state: 'closed_without_merge', reuseAsFreshEvidence: true }).status === 'fail'),
  test('evidence_refresh_pending_safe_output', () => planEvidenceRefresh({ pending: true }).safePendingOutput === true),
  test('evidence_refresh_timeout_safe_classification', () => planEvidenceRefresh({ timeout: true }).classification === 'validation_incomplete_timeout'),
  test('evidence_refresh_required_failure_stops_polling', () => planEvidenceRefresh({ requiredCheckFailure: true }).stopPolling === true),
  test('evidence_refresh_invalid_artifact_stops_polling', () => planEvidenceRefresh({ invalidArtifactShape: true }).status === 'failure'),
  test('evidence_refresh_never_requires_raw_logs', () => planEvidenceRefresh({ requiredCheckFailure: true }).rawLogsRequired === false),

  test('validation_resume_plan_emitted', () => buildValidationResumePlan().status === 'pass'),
  test('validation_timeout_not_pass', () => buildValidationResumePlan({ timeout: true }).status === 'validation_incomplete_timeout'),
  test('validation_resume_records_branch_and_head', () => buildValidationResumePlan({ branch: 'b', head: 'h' }).head === 'h'),
  test('validation_resume_skips_already_passed', () => buildValidationResumePlan().skipAlreadyPassed === true),
  test('validation_resume_safe_summary_only', () => buildValidationResumePlan().safeSummaryOnly === true),

  test('ci_watcher_artifact_emitted', () => buildCiWatcherArtifact({ pr: 1 }).pr === 1),
  test('ci_watcher_same_head_ledger', () => buildCiWatcherArtifact({ sameHead: true }).sameHead === true),
  test('ci_watcher_quality_gate_alone_not_merge_ready', () => evaluatePrLifecycle({ state: 'merge_ready', sameHead: true, requiredCheckFailure: true }).status === 'fail'),
  test('ci_watcher_no_raw_logs_printed', () => buildCiWatcherArtifact({ status: 'failure' }).rawLogsPrinted === false),
  test('ci_watcher_no_status_reported_is_not_green', () => buildCiWatcherArtifact({ status: 'no_status_reported' }).status === 'no_status_reported'),
  test('ci_watcher_stale_pass_not_allowed', () => evaluatePrLifecycle({ state: 'merge_ready', sameHead: false }).status === 'fail'),

  test('no_new_pr_without_delta_fails', () => evaluateNoNewPrUnlessDelta({}).status === 'fail'),
  test('ledger_absorbable_update_fails_new_pr', () => evaluateNoNewPrUnlessDelta({ newOwnerInstruction: true, ledgerCanAbsorb: true }).status === 'fail'),
  test('duplicate_pr_fails', () => evaluateNoNewPrUnlessDelta({ newOwnerInstruction: true, duplicateOpenPr: true }).status === 'fail'),
  test('terminal_blocked_cache_fails_new_pr', () => evaluateNoNewPrUnlessDelta({ terminalBlockedCacheActive: true }).status === 'fail'),
  test('new_blocker_reducing_delta_permits_pr', () => evaluateNoNewPrUnlessDelta({ hardBlockerReduced: true }).status === 'pass'),

  test('main_reflection_package_v2_not_merge_approval', () => buildMainReflectionPackageV2().mergeClaimExcluded === true),
  test('main_reflection_runtime_excluded', () => buildMainReflectionPackageV2().runtimeExcluded === true),
  test('main_reflection_decision_blocked_supported', () => buildMainReflectionPackageV2({ decision: 'blocked' }).decision === 'blocked'),
  test('canonical_ownership_ledger_no_owner_grant_invented', () => buildOwnershipLedger().ownerGranted === false),
  test('canonical_ownership_grant_expires_on_head_change', () => buildOwnershipLedger({ ownerGranted: true }).expiresOnHeadChange === true),

  test('chatgpt_pro_review_is_technical_not_native', () => classifyReviewEvidenceV4({ type: 'chatgpt_pro_technical_review' }).nativeGitHubApproval === false),
  test('native_github_review_is_native_approval', () => classifyReviewEvidenceV4({ type: 'native_github_review' }).nativeGitHubApproval === true),
  test('codex_self_check_not_owner_approval', () => classifyReviewEvidenceV4({ type: 'codex_self_check' }).ownerApproval === false),
  test('review_request_only_not_evidence', () => classifyReviewEvidenceV4({ type: 'review_request_only' }).status === 'fail'),
  test('writer_only_not_independent_review', () => classifyReviewEvidenceV4({ type: 'writer_comment' }).status === 'fail'),
  test('bot_only_not_independent_review', () => classifyReviewEvidenceV4({ type: 'bot_comment' }).status === 'fail'),

  test('vgc_token_stage_artifact_v2_no_deploy', () => evaluateTokenStage({ state: 'OWNER_REVIEW_READY' }).status === 'pass'),
  test('deploy_approval_state_machine_blocks_deploy', () => evaluateTokenStage({ deploy: true }).status === 'fail'),
  test('owner_values_workflow_no_owner_approval_invented', () => evaluateTokenStage({ ownerApprovalInvented: true }).status === 'fail'),
  test('token_preflight_gate_ledger_mainnet_blocked', () => evaluateTokenStage({ state: 'MAINNET_BLOCKED' }).mainnetBlocked === true),

  test('funky_lane_ledger_emitted', () => buildFunkyLaneLedger().lane === 'D8'),
  test('funky_actual_db_query_default_false', () => buildFunkyLaneLedger().actualDbQueryAllowed === false),
  test('funky_file_export_default_false', () => buildFunkyLaneLedger().fileExportAllowed === false),
  test('funky_staging_no_tx_pass_false', () => buildFunkyLaneLedger().stagingNoTxPass === false),
  test('funky_runtime_readiness_false', () => buildFunkyLaneLedger().runtimeReadiness === false),
  test('merge_top_blocker_visible', () => buildFunkyLaneLedger({ topBlocker: 'x' }).topBlocker === 'x'),

  test('live2d_critical_invariant_top_gate_pass', () => evaluateLive2dCriticalInvariants().status === 'pass'),
  test('live2d_priority1_blocked_preserved_required', () => evaluateLive2dCriticalInvariants({ priority1BlockedPreserved: false }).status === 'fail'),
  test('fixture_evidence_not_real_evidence', () => evaluateLive2dCriticalInvariants({ fixtureEvidenceAsReal: true }).status === 'fail'),
  test('motion_dataset_executable_blocked', () => evaluateLive2dCriticalInvariants({ motionDatasetExecutable: true }).status === 'fail'),
  test('trusted_loader_enablement_blocked', () => evaluateLive2dCriticalInvariants({ trustedLoaderEnabled: true }).status === 'fail'),
  test('avatar_ux_readiness_claim_blocked', () => evaluateLive2dCriticalInvariants({ runtimeReadinessClaimed: true }).status === 'fail'),

  test('safe_evidence_wording_allowlist_allows_boundary_phrases', () => scanSafeEvidenceWording().status === 'pass'),
  test('safe_evidence_wording_blocks_raw_values', () => scanSafeEvidenceWording({ text: 'ghp_1234567890abcdef' }).status === 'fail'),

  test('remote_product_evidence_not_required_pass', () => classifyRemoteProductEvidence().class === 'not_required'),
  test('remote_npm_required_not_executed_fails', () => classifyRemoteProductEvidence({ required: true }).class === 'required_not_executed'),
  test('remote_npm_executed_artifact_missing_fails', () => classifyRemoteProductEvidence({ executed: true, artifactPresent: false }).status === 'fail'),
  test('remote_npm_normalization_failed_fails', () => classifyRemoteProductEvidence({ executed: true, artifactPresent: true, normalizationFailed: true }).status === 'fail'),
  test('remote_npm_result_pass', () => classifyRemoteProductEvidence({ executed: true, artifactPresent: true, result: 'pass' }).status === 'pass'),
  test('remote_npm_result_fail', () => classifyRemoteProductEvidence({ executed: true, artifactPresent: true, result: 'fail' }).status === 'fail'),
  test('local_npm_cannot_substitute_remote_npm', () => classifyRemoteProductEvidence({ executed: true, artifactPresent: true }).localNpmCanSubstituteRemoteNpm === false),

  test('active_marker_internal_version_alignment_pass', () => evaluateFixtureStability({ markerVersion: '1.1.1' }).status === 'pass'),
  test('active_marker_internal_version_alignment_fail', () => evaluateFixtureStability({ markerVersion: '1.1.0' }).status === 'fail'),
  test('fixture_contract_registry_default_pass', () => evaluateFixtureStability().status === 'pass'),
  test('narrow_fixture_no_broad_gate', () => evaluateFixtureStability({ narrowCallsBroadGate: true }).status === 'fail'),
  test('full_suite_interference_detector', () => evaluateFixtureStability({ focusedPass: true, fullSuiteFail: true }).status === 'fail'),
  test('legacy_advisory_classifier_v2_allows_manifest_advisory', () => evaluateFixtureStability({ legacyAdvisoryManifestAllows: true }).legacyAdvisoryAllowed === true),

  test('performance_budget_v3_emitted', () => buildPerformanceTokenAudit().status === 'pass'),
  test('quality_gate_cost_profile_fields_present', () => buildPerformanceTokenAudit().mandatoryGateCount >= 1),
  test('token_economy_loss_audit_parity_pass', () => buildPerformanceTokenAudit().semanticLossRisk === 'low'),
  test('operational_closure_score_pass', () => buildPerformanceTokenAudit().closureScore === 100),
  test('precision_benchmark_parity_blocks_mismatch', () => buildPerformanceTokenAudit({ fullDecision: 'a', summaryDecision: 'b' }).status === 'fail'),
  test('required_evidence_preserved', () => buildPerformanceTokenAudit().requiredEvidencePreserved === true),
  test('required_blockers_preserved', () => buildPerformanceTokenAudit().requiredBlockersPreserved === true),

  test('build_v111_report_passes', () => buildV111Report().status === 'pass'),
  test('target_rollout_not_started', () => buildV111Report().targetRollout === 'not_started'),
  test('target_repos_not_touched', () => buildV111Report().targetReposTouched === false),
  test('product_code_not_changed', () => buildV111Report().productCodeChanged === false),
  test('runtime_readiness_not_claimed', () => buildV111Report().runtimeReadinessClaimed === false),
  test('production_readiness_not_claimed', () => buildV111Report().productionReadinessClaimed === false),
  test('self_approval_no', () => buildV111Report().selfApproval === false),
  test('self_merge_no', () => buildV111Report().selfMerge === false),
  test('subagent_merge_authority_no', () => buildV111Report().subagentMergeAuthority === false),
  test('local_agent_secret_access_no', () => buildV111Report().localAgentSecretAccess === false),
  test('wallet_rpc_deploy_access_no', () => buildV111Report().walletRpcDeployAccess === false),
];

const failures = cases.filter((item) => item.status !== 'pass');
const status = failures.length ? 'fail' : 'pass';
const report = {
  marker: MARKER,
  harnessVersion: HARNESS_VERSION,
  sourceHarnessVersion: HARNESS_VERSION,
  status,
  activeHarnessVersion: HARNESS_VERSION,
  previousHarnessVersion: '1.1.0',
  activeSelfTestSuite: 'v111',
  activeSelfTestStatusKey: 'v111SelfTestStatus',
  v110SelfTestStatus: { status: 'pass', reasonCodes: ['v110_compatibility_preserved'], safeSummaryOnly: true },
  ...buildDefaultV111Statuses(),
  v111SelfTestStatus: {
    status,
    blocking: true,
    reasonCodes: failures.length ? ['v111_self_test_failed'] : [],
    safeSummary: { caseCount: cases.length, failedCaseCount: failures.length },
    failures,
    safeSummaryOnly: true,
  },
  targetRollout: 'not_started',
  targetReposTouched: false,
  productCodeChanged: false,
  runtimeReadinessClaimed: false,
  productionReadinessClaimed: false,
  selfApproval: false,
  selfMerge: false,
  subagentMergeAuthority: false,
  localAgentSecretAccess: false,
  walletRpcDeployAccess: false,
  safeSummaryOnly: true,
};

const unsafe = scanObjectForUnsafe(report);
if (unsafe.length) {
  report.status = 'fail';
  report.v111SelfTestStatus.status = 'fail';
  report.v111SelfTestStatus.reasonCodes = ['unsafe_value_detected'];
  report.v111SelfTestStatus.failures = [{ name: 'safe_output_scan', status: 'fail', safeSummaryOnly: true }];
}

writeJsonReport(report, 'CODEX_V111_SELF_TEST_REPORT');
exitFor(report);
