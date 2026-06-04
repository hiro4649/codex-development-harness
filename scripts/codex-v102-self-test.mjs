#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { scanObjectForUnsafe, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import * as gates from './codex-v102-gate-lib.mjs';

const baseResume = {
  lastCompletedPhase: 'phase_a',
  currentPhase: 'phase_b',
  nextPhase: 'phase_c',
  blockedPhase: 'none',
  blockerReason: 'none',
  safeToResume: true,
  mustNotResume: ['target_rollout'],
  requiredOwnerDecision: 'none',
};

const baseSplitScore = {
  productEvidenceScore: 'pass',
  harnessEvidenceScore: 'pass',
  governanceScore: 'pass',
  externalBlockedStatus: 'not_applicable',
  mergeReadiness: 'no_until_remote_pass',
  safeNextAction: 'request_independent_review',
};

const CASES = [
  ['parent_v101_required_for_v102_pass', gates.buildLegacySelfTestMatrixReport, { v101SelfTestStatus: 'pass', v102SelfTestStatus: 'pass' }, 'legacySelfTestMatrixStatus', 'pass'],
  ['v101_self_test_preserved_pass', gates.buildLegacySelfTestMatrixReport, { activeVersion: 'v102', v101SelfTestStatus: 'pass' }, 'legacySelfTestMatrixStatus', 'pass'],
  ['v102_self_test_registered_pass', gates.buildV102SelfTestRegistrationReport, {}, 'v102SelfTestStatus', 'pass'],

  ['clean_main_baseline_pass', gates.buildCleanMainBaselineStabilityReport, { classification: 'clean_main_pass' }, 'cleanMainBaselineStabilityStatus', 'pass'],
  ['clean_main_legacy_self_test_drift_fails', gates.buildCleanMainBaselineStabilityReport, { classification: 'legacy_self_test_drift' }, 'cleanMainBaselineStabilityStatus', 'fail'],
  ['clean_main_support_file_boundary_mismatch_fails', gates.buildCleanMainBaselineStabilityReport, { classification: 'support_file_materialization_mismatch' }, 'cleanMainBaselineStabilityStatus', 'fail'],
  ['clean_main_actual_product_bug_classified', gates.buildCleanMainBaselineStabilityReport, { classification: 'actual_product_bug' }, 'cleanMainBaselineStabilityStatus', 'fail'],
  ['clean_main_unknown_fails', gates.buildCleanMainBaselineStabilityReport, { classification: 'unknown' }, 'cleanMainBaselineStabilityStatus', 'fail'],

  ['legacy_self_test_matrix_all_pass', gates.buildLegacySelfTestMatrixReport, {}, 'legacySelfTestMatrixStatus', 'pass'],
  ['legacy_self_test_matrix_v085_fail_classified', gates.buildLegacySelfTestMatrixReport, { v085SelfTestStatus: 'fail', failureClass: 'legacy_self_test_drift', legacyAdvisoryVersions: ['v085'] }, 'legacySelfTestMatrixStatus', 'pass'],
  ['legacy_self_test_matrix_v092_fail_classified', gates.buildLegacySelfTestMatrixReport, { v092SelfTestStatus: 'fail', failureClass: 'legacy_self_test_drift', legacyAdvisoryVersions: ['v092'] }, 'legacySelfTestMatrixStatus', 'pass'],
  ['legacy_self_test_matrix_active_failure_blocks', gates.buildLegacySelfTestMatrixReport, { activeVersion: 'v102', v102SelfTestStatus: 'fail', failureClass: 'active_failure' }, 'legacySelfTestMatrixStatus', 'fail'],
  ['legacy_self_test_matrix_legacy_advisory_not_blocking', gates.buildLegacySelfTestMatrixReport, { v085SelfTestStatus: 'fail', failureClass: 'legacy_advisory' }, 'legacySelfTestMatrixStatus', 'pass'],

  ['fixture_orchestration_stable_pass', gates.buildFixtureOrchestrationFlakeReport, { classification: 'stable_pass' }, 'fixtureOrchestrationFlakeStatus', 'pass'],
  ['fixture_orchestration_transient_flake_classified', gates.buildFixtureOrchestrationFlakeReport, { classification: 'transient_flake' }, 'fixtureOrchestrationFlakeStatus', 'fail'],
  ['fixture_orchestration_actual_product_bug_classified', gates.buildFixtureOrchestrationFlakeReport, { classification: 'actual_product_concurrency_bug' }, 'fixtureOrchestrationFlakeStatus', 'fail'],
  ['fixture_orchestration_unknown_fails', gates.buildFixtureOrchestrationFlakeReport, { classification: 'unknown' }, 'fixtureOrchestrationFlakeStatus', 'fail'],

  ['support_file_source_only_manifest_not_required_in_target_pass', gates.buildSupportFileBoundaryReport, {}, 'supportFileBoundaryStatus', 'pass'],
  ['support_file_target_requires_source_manifest_fails', gates.buildSupportFileBoundaryReport, { targetRequiresSourceManifest: true }, 'supportFileBoundaryStatus', 'fail'],
  ['support_file_materialization_mismatch_fails', gates.buildSupportFileMaterializationReport, { materializationMismatch: true }, 'supportFileMaterializationStatus', 'fail'],
  ['source_target_manifest_boundary_pass', gates.buildSourceTargetManifestBoundaryReport, {}, 'sourceTargetManifestBoundaryStatus', 'pass'],

  ['v085_fixture_isolated_diff_pass', gates.buildV085CheckoutDiffIsolationReport, {}, 'v085CheckoutDiffIsolationStatus', 'pass'],
  ['v085_fixture_active_product_diff_leak_fails', gates.buildV085CheckoutDiffIsolationReport, { activeCheckoutDiffLeak: true }, 'v085CheckoutDiffIsolationStatus', 'fail'],
  ['v085_fixture_forbidden_harness_path_still_fails', gates.buildV085CheckoutDiffIsolationReport, { harnessOnlyForbiddenPathWeakened: true }, 'v085CheckoutDiffIsolationStatus', 'fail'],
  ['top_level_product_gate_still_sees_product_diff', gates.buildProductPrDiffContainmentReport, {}, 'productPrDiffContainmentStatus', 'pass'],
  ['pr42_shaped_product_diff_not_fixture_pass', gates.buildV085CheckoutDiffIsolationReport, {}, 'v085CheckoutDiffIsolationStatus', 'pass'],
  ['pending_after_push_not_remote_pass', gates.buildV085CheckoutDiffIsolationReport, { pendingAfterPushAsRemotePass: true }, 'v085CheckoutDiffIsolationStatus', 'fail'],
  ['target_merge_ready_without_same_head_remote_fails', gates.buildV085CheckoutDiffIsolationReport, { targetMergeReadyWithoutSameHeadRemotePass: true }, 'v085CheckoutDiffIsolationStatus', 'fail'],

  ['product_pr_evidence_generate_pass', gates.buildProductPrEvidenceGeneratorReport, {}, 'productPrEvidenceGeneratorStatus', 'pass'],
  ['product_pr_evidence_missing_formal_fails', gates.buildProductPrEvidenceValidatorReport, { formalMissing: true }, 'productPrEvidenceValidatorStatus', 'fail'],
  ['product_pr_evidence_safe_summary_required', gates.buildProductPrEvidenceSafeSummaryReport, { safeSummaryMissing: true }, 'productPrEvidenceSafeSummaryStatus', 'fail'],
  ['product_pr_evidence_stale_remote_fails', gates.buildProductPrEvidenceValidatorReport, { remoteEvidenceStale: true }, 'productPrEvidenceValidatorStatus', 'fail'],
  ['product_pr_evidence_placeholder_only_fails', gates.buildProductPrEvidenceValidatorReport, { placeholderOnly: true }, 'productPrEvidenceValidatorStatus', 'fail'],
  ['product_pr_evidence_lifeboat_only_fails', gates.buildProductPrEvidenceValidatorReport, { lifeboatOnly: true }, 'productPrEvidenceValidatorStatus', 'fail'],

  ['backup_artifact_repo_external_pass', gates.buildRepoExternalBackupReport, {}, 'repoExternalBackupStatus', 'pass'],
  ['backup_artifact_tracked_file_fails', gates.buildBackupArtifactManagerReport, { tracked: true }, 'backupArtifactManagerStatus', 'fail'],
  ['backup_artifact_stage_attempt_fails', gates.buildBackupArtifactManagerReport, { staged: true }, 'backupArtifactManagerStatus', 'fail'],
  ['backup_artifact_git_clean_forbidden_fails', gates.buildBackupArtifactManagerReport, { gitCleanAttempt: true }, 'backupArtifactManagerStatus', 'fail'],
  ['backup_artifact_git_reset_forbidden_fails', gates.buildBackupArtifactManagerReport, { gitResetAttempt: true }, 'backupArtifactManagerStatus', 'fail'],

  ['pr_recovery_rebase_required_pass', gates.buildPrRecoveryAutopilotReport, { action: 'rebase_required' }, 'prRecoveryAutopilotStatus', 'pass'],
  ['pr_recovery_body_only_repair_pass', gates.buildPrRecoveryAutopilotReport, { action: 'body_only_repair_required' }, 'prRecoveryAutopilotStatus', 'pass'],
  ['pr_recovery_close_superseded_pass', gates.buildPrRecoveryAutopilotReport, { action: 'close_as_superseded_required' }, 'prRecoveryAutopilotStatus', 'pass'],
  ['pr_recovery_product_fix_required_pass', gates.buildPrRecoveryAutopilotReport, { action: 'product_fix_required' }, 'prRecoveryAutopilotStatus', 'pass'],
  ['pr_recovery_harness_fix_required_pass', gates.buildPrRecoveryAutopilotReport, { action: 'harness_fix_required' }, 'prRecoveryAutopilotStatus', 'pass'],
  ['pr_recovery_external_blocked_required_pass', gates.buildPrRecoveryAutopilotReport, { action: 'external_blocked_required' }, 'prRecoveryAutopilotStatus', 'pass'],
  ['pr_recovery_ambiguous_next_action_fails', gates.buildPrRecoveryAutopilotReport, { action: ['rebase_required', 'rerun_required'] }, 'prRecoveryAutopilotStatus', 'fail'],

  ['external_blocked_reviewer_unavailable_pass', gates.buildReviewerAvailabilityReport, { reviewerUnavailable: true }, 'reviewerAvailabilityStatus', 'blocked_external'],
  ['writer_only_review_fails', gates.buildReviewerAvailabilityReport, { writerOnlyReview: true }, 'reviewerAvailabilityStatus', 'fail'],
  ['independent_review_pass', gates.buildReviewerAvailabilityReport, {}, 'reviewerAvailabilityStatus', 'pass'],
  ['external_blocked_merge_ready_fails', gates.buildExternalBlockedReport, { mergeReadyWhileExternalBlocked: true }, 'externalBlockedStatus', 'fail'],
  ['split_score_model_required_fields_pass', gates.buildSplitScoreModelReport, baseSplitScore, 'splitScoreModelStatus', 'pass'],

  ['pr_dependency_graph_blocked_by_pass', gates.buildPrDependencyGraphReport, { dependentPr: true, blocked_by: ['upstream'] }, 'prDependencyGraphStatus', 'pass'],
  ['pr_dependency_graph_missing_for_dependent_pr_fails', gates.buildPrDependencyGraphReport, { dependentPr: true }, 'prDependencyGraphStatus', 'fail'],
  ['pr_dependency_graph_superseded_pr_merge_fails', gates.buildPrDependencyGraphReport, { supersededPrMergeCandidate: true }, 'prDependencyGraphStatus', 'fail'],
  ['safe_next_action_one_line_pass', gates.buildSafeNextActionReport, { safeNextAction: 'request_independent_review' }, 'safeNextActionStatus', 'pass'],
  ['safe_next_action_vague_fails', gates.buildSafeNextActionReport, { safeNextAction: 'if needed confirm later' }, 'safeNextActionStatus', 'fail'],

  ['handover_snapshot_required_fields_pass', gates.buildHandoverSnapshotReport, { snapshot: gates.buildDefaultHandoverSnapshot() }, 'handoverSnapshotStatus', 'pass'],
  ['handover_snapshot_missing_main_head_fails', gates.buildHandoverSnapshotReport, { snapshot: { ...gates.buildDefaultHandoverSnapshot(), sourceMainHead: undefined } }, 'handoverSnapshotStatus', 'fail'],
  ['handover_snapshot_missing_protected_state_fails', gates.buildHandoverSnapshotReport, { snapshot: { ...gates.buildDefaultHandoverSnapshot(), protectedPatches: undefined } }, 'handoverSnapshotStatus', 'fail'],
  ['operator_seven_line_summary_pass', gates.buildOperatorSevenLineSummaryReport, {}, 'operatorSevenLineSummaryStatus', 'pass'],
  ['machine_replay_digest_json_pass', gates.buildMachineReplayDigestReport, { digest: gates.buildDefaultHandoverSnapshot() }, 'machineReplayDigestStatus', 'pass'],
  ['protected_state_inventory_patch_apply_forbidden_fails', gates.buildProtectedStateInventoryReport, { patchApplied: true }, 'protectedStateInventoryStatus', 'fail'],
  ['protected_state_inventory_stash_pop_forbidden_fails', gates.buildProtectedStateInventoryReport, { stashPopped: true }, 'protectedStateInventoryStatus', 'fail'],
  ['workflow_resume_state_pass', gates.buildWorkflowResumeStateReport, baseResume, 'workflowResumeStateStatus', 'pass'],
  ['workflow_resume_missing_next_action_fails', gates.buildWorkflowResumeStateReport, { ...baseResume, nextPhase: undefined }, 'workflowResumeStateStatus', 'fail'],
  ['workflow_resume_forbidden_scope_fails', gates.buildWorkflowResumeStateReport, { ...baseResume, forbiddenScope: true }, 'workflowResumeStateStatus', 'fail'],
];

const results = CASES.map(([name, builder, input, key, expected]) => {
  const report = builder(input);
  const actual = report[key]?.status || report.status;
  return {
    name,
    status: actual === expected ? 'pass' : 'fail',
    expected,
    actual,
    safeSummaryOnly: true,
  };
});

const failures = results.filter((item) => item.status !== 'pass');
const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.6',
  status: failures.length ? 'fail' : 'pass',
  v102SelfTestStatus: {
    status: failures.length ? 'fail' : 'pass',
    caseCount: results.length,
    failures,
    safeSummaryOnly: true,
  },
  cases: results,
  safeSummaryOnly: true,
};

if (scanObjectForUnsafe(report).length) {
  report.status = 'fail';
  report.v102SelfTestStatus = { status: 'fail', reasonCodes: ['unsafe_value_detected'], safeSummaryOnly: true };
}

writeJsonReport(report, 'CODEX_V102_SELF_TEST_REPORT');
exitFor(report);
