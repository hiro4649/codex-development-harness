#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.4

import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  V114_STATUS_KEYS,
  buildLoopBudget,
  buildLoopHandoff,
  buildLoopNextAction,
  buildLoopState,
  buildDecisionCore,
  buildMinimalBlockerEntry,
  buildTerminalCloseout,
  buildTokenCostLedger,
  buildValidationDependencyGraph,
  buildSafeValidationCacheKey,
  buildV114Report,
  classifyForbiddenScopeSet,
  classifyInventoryCloseout,
  classifyLoopFailure,
  classifyManualGateReceipt,
  classifyReadinessClaim,
  classifyRealEvidenceBoundary,
  classifyRemoteEvidenceState,
  classifyRenderedOutputFailure,
  classifyStatusSurfaceTier,
  classifyTargetProcessGuard,
  evaluateLoopExit,
  loopTypes,
  validateDecisionCoreAuthoritative,
  validateFinalReportBudget,
  validateLoopGuardrails,
  validateNoSpeculativeRepair,
  validateOneSafeNextAction,
} from './codex-v114-loop-kernel.mjs';
import { classifyGuardrailOperation, validateHookGuardrailRegistry } from './codex-v114-guardrail-registry.mjs';
import {
  applyTargetActiveSelfTestRegistryMapping,
  applyTargetCompatibilityShadowStatuses,
  applyTargetModeLegacyCompatibilityShadow,
  buildRemoteProductEvidenceExecutionInput,
  buildSafeArtifactIndexInputForQualityGate,
  shouldAutoSelectTargetHarnessMode,
} from './codex-local-quality-gate.mjs';

function test(name, fn) {
  try {
    return { name, status: fn() ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch {
    return { name, status: 'fail', reasonCodes: ['self_test_exception'], safeSummaryOnly: true };
  }
}

const report = buildV114Report();
const unknown = classifyLoopFailure({ unknownFailure: true });
const timeout = classifyLoopFailure({ timedOut: true });
const missingDetail = classifyLoopFailure({ safeDetailUnavailable: true });
const requiredFail = evaluateLoopExit(buildLoopState(), { requiredChecksPass: false, qualityGatePass: true, ownerMergeInstruction: true });
const qgOnly = evaluateLoopExit(buildLoopState(), { requiredChecksPass: false, qualityGatePass: true, ownerMergeInstruction: false });
const nextAction = buildLoopNextAction({ safeNextAction: ['one', 'two'], reasonCodes: ['a', 'b', 'c', 'd'] });
const compactBudget = buildLoopBudget({ operatorVisibleStatusCount: 7, topReasonCodeCount: 3 });
const largeBudget = buildLoopBudget({ operatorVisibleStatusCount: 11 });
const handoff = buildLoopHandoff({ currentBlocker: 'state_delta_required' });
const terminal = buildTerminalCloseout({ classification: 'separate_owner_scope_preserved' });
const decisionCore = buildDecisionCore({ primaryClass: 'same_head_required_check_failed', requiredChecksPass: false });
const minimalBlocker = buildMinimalBlockerEntry({ primaryClass: 'same_head_required_check_failed' });
const remoteNpmExecutionMissing = classifyRemoteEvidenceState({ remoteNpmRequired: true });
const remoteNpmArtifactMissing = classifyRemoteEvidenceState({ remoteNpmRequired: true, remoteNpmExecuted: true });
const remoteNpmNormalizationFailed = classifyRemoteEvidenceState({ remoteNpmRequired: true, remoteNpmExecuted: true, remoteNpmArtifactPresent: true });
const remoteNpmFailed = classifyRemoteEvidenceState({ remoteNpmRequired: true, remoteNpmExecuted: true, remoteNpmArtifactPresent: true, remoteNpmNormalized: true, remoteNpmResult: 'fail' });
const validationGraph = buildValidationDependencyGraph({ changedFiles: ['scripts/codex-v114-self-test.mjs'] });
const cacheKey = buildSafeValidationCacheKey({ headSha: 'abc', inputHash: 'def', changedFiles: ['scripts/codex-v114-self-test.mjs'] });
const tokenLedger = buildTokenCostLedger({ duplicatedBoundaryText: 1 });
const legacyExecutionInput = buildRemoteProductEvidenceExecutionInput(
  { changeClassificationStatus: { classification: { productSourceChanged: true } } },
  { CODEX_PR_HEAD_SHA: 'head-a', CODEX_EVENT_NAME: 'pull_request' },
);
const legacyArtifactIndexInput = buildSafeArtifactIndexInputForQualityGate({ CODEX_REMOTE_NPM_EXECUTED: '0' });
const targetCompatibilityShadowReport = {
  agentsContextStatus: { status: 'fail', reasonCodes: ['agents_context_missing_harness_block'] },
  promptGovernanceStatus: { status: 'warning', reasonCodes: ['agents_change_without_prompt_eval'] },
  reviewIndependenceStatus: { status: 'fail', reasonCodes: ['review_independence_missing'] },
  v080SelfTestStatus: { status: 'fail', reasonCodes: ['legacy_marker_mismatch'] },
  targetManifestStatus: { status: 'fail', reasonCodes: ['target_manifest_missing'] },
  warnings: [{ id: 'promptGovernanceStatus.warning' }],
};
const targetCompatibilityShadowFailures = [
  { id: 'agentsContextStatus.failed' },
  { id: 'reviewIndependenceStatus.failed' },
  { id: 'v080SelfTestStatus.failed' },
  { id: 'targetManifestStatus.failed' },
];
const targetCompatibilityShadow = applyTargetCompatibilityShadowStatuses(targetCompatibilityShadowReport, targetCompatibilityShadowFailures);
const targetLegacyShadowReport = {
  targetModeLegacyCompatibilityStatus: {
    status: 'fail',
    classifications: [
      { key: 'v111SelfTestStatus', classification: 'missing_blocking' },
      { key: 'v080SelfTestStatus', classification: 'advisory_legacy' },
    ],
    reasonCodes: ['target_mode_compatibility_blocking_status'],
    safeSummaryOnly: true,
  },
};
const targetLegacyShadowFailures = [{ id: 'targetModeLegacyCompatibilityStatus.failed' }];
const targetLegacyShadow = applyTargetModeLegacyCompatibilityShadow(targetLegacyShadowReport, targetLegacyShadowFailures);
const targetAutoModeFixture = shouldAutoSelectTargetHarnessMode({}, {
  targetRepoMode: true,
});
const funkyLegacySelfTestShadowReport = {
  newHarnessSelfTestStatus: { status: 'fail', reasonCodes: ['new_harness_self_test_failed'] },
  v101SelfTestStatus: { status: 'fail', reasonCodes: ['legacy_target_self_test_missing'] },
  v102SelfTestStatus: { status: 'fail', reasonCodes: ['legacy_target_self_test_missing'] },
  v103SelfTestStatus: { status: 'fail', reasonCodes: ['legacy_target_self_test_missing'] },
  targetManifestStatus: { status: 'pass' },
};
const funkyLegacySelfTestShadowFailures = [
  { id: 'newHarnessSelfTestStatus.failed' },
  { id: 'v101SelfTestStatus.failed' },
  { id: 'v102SelfTestStatus.failed' },
  { id: 'v103SelfTestStatus.failed' },
];
const funkyLegacySelfTestShadow = applyTargetCompatibilityShadowStatuses(funkyLegacySelfTestShadowReport, funkyLegacySelfTestShadowFailures);
const funkyActiveRegistryReport = {
  activeSelfTestRegistryStatus: {
    status: 'fail',
    reasonCodes: ['active_self_test_registry_missing'],
  },
};
const funkyActiveRegistryFailures = [{ id: 'activeSelfTestRegistryStatus.failed' }];
const funkyActiveRegistry = applyTargetActiveSelfTestRegistryMapping(funkyActiveRegistryReport, funkyActiveRegistryFailures, {
  manifest: {
    targetRepoMode: true,
    harnessVersion: '1.1.4',
    activeSelfTestSuite: 'v114',
    activeSelfTestStatusKey: 'v114SelfTestStatus',
  },
  localGateText: 'v114SelfTestStatus',
  selfTestPresent: true,
});
const funkyMissingRegistryReport = {
  activeSelfTestRegistryStatus: {
    status: 'fail',
    reasonCodes: ['active_self_test_registry_missing'],
  },
};
const funkyMissingRegistry = applyTargetActiveSelfTestRegistryMapping(funkyMissingRegistryReport, [], {
  manifest: {
    targetRepoMode: true,
    harnessVersion: '1.1.4',
    activeSelfTestSuite: 'v114',
    activeSelfTestStatusKey: 'v113SelfTestStatus',
  },
  localGateText: 'v114SelfTestStatus',
  selfTestPresent: true,
});
const criptoTipV085ShadowReport = {
  v085SelfTestStatus: {
    status: 'fail',
    failures: ['harness-only change with no product claim -> manual_confirmation_required'],
    safeSummaryOnly: true,
  },
  targetManifestStatus: { status: 'pass' },
};
const criptoTipV085ShadowFailures = [{ id: 'v085SelfTestStatus.failed' }];
const criptoTipV085Shadow = applyTargetCompatibilityShadowStatuses(criptoTipV085ShadowReport, criptoTipV085ShadowFailures);

const cases = [
  test('all_v114_status_keys_default_pass', () => V114_STATUS_KEYS.every((key) => report[key]?.status === 'pass')),
  test('v114_report_passes', () => report.status === 'pass'),
  test('loop_types_registered', () => ['preflight_loop', 'implementation_loop', 'local_validation_loop', 'remote_validation_loop', 'failure_triage_loop', 'repair_scope_loop', 'closeout_loop'].every((item) => loopTypes.includes(item))),
  test('unknown_failure_forbids_product_repair', () => unknown.primaryFailureClass === 'unknown_failure' && unknown.productRepairAllowed === false),
  test('timeout_forbids_product_repair', () => timeout.productRepairAllowed === false && timeout.mergeAllowed === false),
  test('safe_detail_unavailable_forbids_product_repair', () => missingDetail.primaryFailureClass === 'safe_detail_unavailable' && missingDetail.productRepairAllowed === false),
  test('same_head_required_checks_fail_blocks_merge', () => requiredFail.mergeAllowed === false && requiredFail.reasonCodes.includes('required_checks_not_pass')),
  test('quality_gate_pass_alone_not_merge_ready', () => qgOnly.mergeAllowed === false && qgOnly.qualityGatePassAloneAllowsMerge === false),
  test('safe_next_action_must_be_singular', () => nextAction.safeNextAction === 'one' && nextAction.safeNextActionCount === 1),
  test('loop_exit_criteria_required', () => evaluateLoopExit(buildLoopState(), { requiredChecksPass: true, qualityGatePass: true, ownerMergeInstruction: true }).mergeAllowed === true),
  test('eight_session_default_fail', () => validateLoopGuardrails({ eightSessionUsed: true }).status === 'fail'),
  test('raw_log_command_blocked', () => classifyGuardrailOperation('raw_log_command').allowed === false),
  test('scope_mixing_blocked', () => classifyGuardrailOperation('runtime_scope_violation').status === 'fail'),
  test('token_budget_pass_when_compact', () => compactBudget.status === 'pass'),
  test('token_budget_fail_when_oversized', () => largeBudget.status === 'fail'),
  test('stop_resume_handoff_minimal', () => handoff.status === 'pass' && handoff.lineBudget <= 12),
  test('terminal_closeout_classifies_separate_owner_scope', () => terminal.classification === 'separate_owner_scope_preserved'),
  test('loop_state_compact_output', () => JSON.stringify(buildLoopState()).split(/\r?\n/).length === 1),
  test('no_speculative_repair_blocks_unknown_product_repair', () => validateNoSpeculativeRepair({ unknownFailure: true, productRepairAttempted: true }).status === 'fail'),
  test('hook_guardrail_registry_blocks_forbidden_operations', () => validateHookGuardrailRegistry().status === 'pass'),
  test('raw_output_never_printed', () => report.rawLogsRead === false && report.eightSessionUsed === false && report.walletRpcDeployAccess === false),
  test('source_only_non_goals_preserved', () => report.targetRollout === 'not_started' && report.targetReposTouched === false && report.productCodeChanged === false),
  test('decision_core_authoritative', () => validateDecisionCoreAuthoritative({ primaryClass: 'owner_decision_required' }).status === 'pass' && decisionCore.artifactPointer === 'codex-decision-core.safe.json'),
  test('minimal_blockers_single_entry', () => Object.keys(minimalBlocker).filter((key) => key !== 'safeSummaryOnly').length === 8 && minimalBlocker.primaryBlocker === 'same_head_required_check_failed'),
  test('status_surface_tiered', () => classifyStatusSurfaceTier('v114SelfTestStatus') === 'critical_now' && classifyStatusSurfaceTier('legacySelfTestStatus') === 'compatibility_shadow'),
  test('pr_body_not_source_of_truth', () => validateDecisionCoreAuthoritative({ prBodyOverridesSafeArtifact: true }).status === 'fail'),
  test('rendered_output_failure_not_product_failure', () => classifyRenderedOutputFailure({ prBodyFailure: true }).productFailure === false),
  test('remote_npm_state_machine', () => classifyRemoteEvidenceState({ remoteNpmRequired: false }).blocking_reason === 'not_required'),
  test('remote_npm_execution_missing', () => remoteNpmExecutionMissing.blocking_reason === 'execution_missing'),
  test('remote_npm_artifact_missing', () => remoteNpmArtifactMissing.blocking_reason === 'artifact_missing'),
  test('remote_npm_normalization_failed', () => remoteNpmNormalizationFailed.blocking_reason === 'normalization_shape_mismatch'),
  test('remote_npm_failed', () => remoteNpmFailed.blocking_reason === 'npm_failed'),
  test('validation_dependency_graph_avoids_redundant_full_replay', () => validationGraph.avoidsRedundantFullReplay === true),
  test('safe_validation_cache_not_merge_authority', () => cacheKey.cacheAllowed === true && cacheKey.mergeAuthority === false),
  test('forbidden_scope_set_id_applied', () => classifyForbiddenScopeSet('CRIPTO_TIP_CORE_BOUNDARY_V1').status === 'pass'),
  test('readiness_claim_classifier_negative_boundary_allowed', () => classifyReadinessClaim({ type: 'negative_boundary' }).status === 'pass'),
  test('readiness_claim_classifier_affirmative_claim_blocked', () => classifyReadinessClaim({ type: 'affirmative_claim' }).status === 'fail'),
  test('owner_values_not_deploy_approval', () => classifyManualGateReceipt({ ownerValues: true }).status === 'fail'),
  test('manual_gate_typed_receipt_required', () => classifyManualGateReceipt({ typedDeployReceipt: true }).deployApproval === true),
  test('real_evidence_boundary_fixture_pass_not_production_go', () => classifyRealEvidenceBoundary({ productionGoByFixture: true }).status === 'fail'),
  test('target_branch_mutation_blocked', () => classifyTargetProcessGuard({ targetBranchMutated: true }).status === 'fail'),
  test('external_workspace_process_blocked', () => classifyTargetProcessGuard({ externalWorkspaceProcess: true }).status === 'fail'),
  test('inventory_duplicate_blocks_new_pr', () => classifyInventoryCloseout({ sameTargetSameBlockerSameEvidenceSameNextAction: true }).status === 'fail'),
  test('token_cost_ledger_detects_duplicate_boundary_text', () => tokenLedger.status === 'fail' && tokenLedger.reasonCodes.includes('duplicated_boundary_text_present')),
  test('final_report_12_line_budget', () => validateFinalReportBudget({ lines: 12 }).status === 'pass' && validateFinalReportBudget({ lines: 13 }).status === 'fail'),
  test('one_safe_next_action_only', () => validateOneSafeNextAction({ safeNextAction: ['a', 'b'] }).status === 'fail'),
  test('formal_evidence_overrides_stale_diagnostic', () => classifyGuardrailOperation('stale_diagnostic_reintroduction').allowed === false),
  test('stale_diagnostic_reintroduction_fails', () => classifyGuardrailOperation('stale_diagnostic_reintroduction').reasonCode === 'stale_diagnostic_reintroduction'),
  test('compatibility_shadow_count_only', () => buildV114Report().evaluationAbsorptionStatus.status === 'pass' && buildV114Report().evaluationAbsorptionStatus.statusTiers?.legacySelfTestStatus !== 'critical_now'),
  test('completed_target_not_reprinted', () => validateFinalReportBudget({ completedTargetDetailsReprinted: true }).status === 'fail'),
  test('legacy_target_v113_quality_gate_exports_preserved', () => legacyExecutionInput.forceCheck === true && Array.isArray(legacyArtifactIndexInput)),
  test('voxweave_target_mode_workflow_gate_compatibility', () => targetCompatibilityShadow.demotedStatusCount === 4 && targetCompatibilityShadowFailures.length === 1 && targetCompatibilityShadowReport.warnings.length === 0),
  test('target_mode_compat_shadow_count_only', () => targetCompatibilityShadowReport.reviewIndependenceStatus.status === 'pass' && targetCompatibilityShadowReport.targetManifestStatus.status === 'fail'),
  test('target_mode_legacy_compat_shadow_count_only', () => targetLegacyShadow.status === 'pass' && targetLegacyShadowFailures.length === 0),
  test('target_manifest_true_blocker_hard', () => targetCompatibilityShadowReport.targetManifestStatus.status === 'fail'),
  test('target_mode_manifest_auto_detection', () => targetAutoModeFixture === true),
  test('funky_target_v101_v103_compat_shadow_count_only', () => funkyLegacySelfTestShadow.demotedStatusCount === 4 && funkyLegacySelfTestShadowFailures.length === 0),
  test('funky_target_active_v114_registry_required', () => funkyActiveRegistry.status === 'pass' && funkyActiveRegistryFailures.length === 0 && funkyActiveRegistryReport.activeSelfTestRegistryStatus.targetModeMapping === true),
  test('funky_target_manifest_active_key_mismatch_remains_hard', () => funkyMissingRegistry.status === 'fail' && funkyMissingRegistryReport.activeSelfTestRegistryStatus.status === 'fail'),
  test('cripto_tip_target_v085_legacy_shadow_count_only', () => criptoTipV085Shadow.demotedStatusCount === 1 && criptoTipV085ShadowFailures.length === 0 && criptoTipV085ShadowReport.v085SelfTestStatus.status === 'pass'),
  test('cripto_tip_target_active_v114_registry_required', () => funkyActiveRegistry.status === 'pass' && funkyMissingRegistry.status === 'fail'),
  test('cripto_tip_target_new_harness_self_test_target_mode', () => funkyLegacySelfTestShadowReport.newHarnessSelfTestStatus.status === 'pass' && funkyLegacySelfTestShadowReport.newHarnessSelfTestStatus.compatibilityShadow === true),
  test('cripto_tip_domain_boundary_crypto_youtube_claims_hard', () => classifyGuardrailOperation('legal_compliance_claim').status === 'fail' && classifyGuardrailOperation('youtube_policy_compliance_claim').status === 'fail'),
  test('wallet_rpc_deploy_blockers_remain_hard', () => classifyGuardrailOperation('wallet_rpc_deploy_access').status === 'fail'),
  test('legal_youtube_compliance_claim_blockers_remain_hard', () => classifyGuardrailOperation('legal_compliance_claim').allowed === false && classifyGuardrailOperation('youtube_policy_compliance_claim').allowed === false),
  test('missing_required_target_artifact_hard_fail', () => targetCompatibilityShadowReport.targetManifestStatus.status === 'fail' && targetCompatibilityShadowFailures.some((item) => item.id === 'targetManifestStatus.failed')),
  test('product_runtime_package_workflow_blockers_remain_hard', () => classifyGuardrailOperation('workflow_scope_violation').status === 'fail' && classifyGuardrailOperation('package_lockfile_scope_violation').status === 'fail'),
];

const failures = cases.filter((item) => item.status !== 'pass');
const selfTestReport = {
  v114SelfTestStatus: { status: failures.length ? 'fail' : 'pass', caseCount: cases.length, failureCount: failures.length, safeSummaryOnly: true },
  cases,
  status: failures.length ? 'fail' : 'pass',
  safeSummaryOnly: true,
};

writeJsonReport(selfTestReport, 'CODEX_V114_SELF_TEST_REPORT');
if (!process.env.CODEX_V114_SELF_TEST_REPORT) console.log(`v114SelfTestStatus: ${selfTestReport.v114SelfTestStatus.status}`);
exitFor(selfTestReport);
