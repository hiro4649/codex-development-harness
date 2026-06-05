#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor, readText } from './codex-v080-lib.mjs';

export const V102_STATUS_KEYS = [
  'cleanMainBaselineStabilityStatus',
  'legacySelfTestMatrixStatus',
  'fixtureOrchestrationFlakeStatus',
  'supportFileBoundaryStatus',
  'sourceTargetManifestBoundaryStatus',
  'supportFileMaterializationStatus',
  'cleanMainRepairPlanStatus',
  'baselineRepairIsolationStatus',
  'currentBranchRegressionStatus',
  'v085CheckoutDiffIsolationStatus',
  'activeCheckoutDiffIsolationStatus',
  'productPrDiffContainmentStatus',
  'harnessFixtureDiffIsolationStatus',
  'productPrEvidenceGeneratorStatus',
  'productPrEvidenceValidatorStatus',
  'productPrEvidenceSafeSummaryStatus',
  'backupArtifactManagerStatus',
  'repoExternalBackupStatus',
  'dirtyWorktreeBackupBoundaryStatus',
  'prRecoveryAutopilotStatus',
  'stalePrRecoveryPlanStatus',
  'currentHeadRecoveryPlanStatus',
  'sameHeadRemoteEvidencePlanStatus',
  'bodyOnlyRepairPlanStatus',
  'ownerActionNextStepStatus',
  'externalBlockedStatus',
  'reviewerAvailabilityStatus',
  'splitScoreModelStatus',
  'prDependencyGraphStatus',
  'smallRepoModeStatus',
  'safeNextActionStatus',
  'handoverSnapshotStatus',
  'operatorSevenLineSummaryStatus',
  'machineReplayDigestStatus',
  'protectedStateInventoryStatus',
  'workflowResumeStateStatus',
  'v102SelfTestStatus',
];

export const V102_REASON_CODES = [
  'clean_main_legacy_self_test_drift',
  'clean_main_support_file_boundary_mismatch',
  'clean_main_actual_product_bug',
  'fixture_orchestration_timing',
  'support_file_materialization_mismatch',
  'source_target_manifest_boundary_error',
  'v085_active_checkout_diff_leak',
  'product_pr_diff_containment_failed',
  'harness_fixture_diff_isolation_failed',
  'product_pr_evidence_missing',
  'product_pr_pending_after_push_not_remote_pass',
  'target_merge_ready_without_same_head_remote_pass',
  'backup_artifact_tracked',
  'backup_artifact_staged',
  'backup_artifact_repo_internal',
  'external_blocked_independent_reviewer_unavailable',
  'writer_only_review_detected',
  'split_score_model_missing',
  'pr_dependency_graph_missing',
  'safe_next_action_ambiguous',
  'handover_snapshot_missing',
  'protected_state_inventory_missing',
  'protected_patch_apply_forbidden',
  'protected_stash_pop_forbidden',
  'workflow_resume_state_missing',
  'v102_self_test_missing',
];

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function bool(value) {
  return value === true || value === '1' || value === 'true' || value === 'yes';
}

function status(statusKey, state, payload = {}) {
  const report = simpleStatus(statusKey, state, {
    ...payload,
    reasonCodes: uniq(payload.reasonCodes),
    warnings: uniq(payload.warnings),
    safeSummaryOnly: true,
  });
  return scanObjectForUnsafe(report).length
    ? simpleStatus(statusKey, 'fail', { reasonCodes: ['unsafe_value_detected'], safeSummaryOnly: true })
    : report;
}

function pass(statusKey, payload = {}) {
  return status(statusKey, 'pass', payload);
}

function fail(statusKey, reasonCodes, payload = {}) {
  return status(statusKey, 'fail', { ...payload, reasonCodes });
}

function notApplicable(statusKey, reasonCodes = ['not_relevant_for_task_mode'], payload = {}) {
  return status(statusKey, 'not_applicable', { ...payload, reasonCodes });
}

function mergeStatus(statusKey, reports, successPayload = {}) {
  const reasons = uniq(reports.flatMap((report) => report?.[Object.keys(report).find((key) => key.endsWith('Status')) || statusKey]?.reasonCodes || []));
  return reasons.length ? fail(statusKey, reasons) : pass(statusKey, successPayload);
}

function hasAny(input, keys) {
  return keys.some((key) => bool(input[key]));
}

const CLEAN_MAIN_REPAIR_ACTIONS = [
  'harness_fix_required',
  'support_file_boundary_fix_required',
  'legacy_fixture_compatibility_fix_required',
  'product_fix_required',
  'remote_infra_required',
  'manual_owner_decision_required',
];

const RECOVERY_ACTIONS = [
  'rebase_required',
  'rerun_required',
  'empty_commit_refresh_required',
  'body_only_repair_required',
  'harness_fix_required',
  'product_fix_required',
  'split_pr_required',
  'close_as_superseded_required',
  'manual_owner_decision_required',
  'external_blocked_required',
];

function oneAllowedAction(action, allowed) {
  const actions = Array.isArray(action) ? action : [action];
  const filtered = actions.filter(Boolean);
  return filtered.length === 1 && allowed.includes(filtered[0]);
}

export function buildCleanMainBaselineStabilityReport(input = {}) {
  const classification = input.classification || 'clean_main_pass';
  const reasons = [];
  if (classification === 'legacy_self_test_drift') reasons.push('clean_main_legacy_self_test_drift');
  if (classification === 'support_file_materialization_mismatch') reasons.push('clean_main_support_file_boundary_mismatch');
  if (classification === 'source_target_manifest_boundary_error') reasons.push('source_target_manifest_boundary_error');
  if (classification === 'actual_product_bug') reasons.push('clean_main_actual_product_bug');
  if (classification === 'unknown') reasons.push('safe_next_action_ambiguous');
  if (bool(input.cleanMainFailTreatedAsProductPrFail)) reasons.push('clean_main_support_file_boundary_mismatch');
  return reasons.length ? fail('cleanMainBaselineStabilityStatus', reasons, { classification }) : pass('cleanMainBaselineStabilityStatus', { classification });
}

export function buildCleanMainRepairPlanReport(input = {}) {
  return oneAllowedAction(input.action || 'harness_fix_required', CLEAN_MAIN_REPAIR_ACTIONS)
    ? pass('cleanMainRepairPlanStatus', { action: input.action || 'harness_fix_required' })
    : fail('cleanMainRepairPlanStatus', ['safe_next_action_ambiguous']);
}

export function buildBaselineRepairIsolationReport(input = {}) {
  return hasAny(input, ['productFixMixedWithHarnessFix', 'unknownRepairOwner'])
    ? fail('baselineRepairIsolationStatus', ['safe_next_action_ambiguous'])
    : pass('baselineRepairIsolationStatus');
}

export function buildCurrentBranchRegressionReport(input = {}) {
  return bool(input.currentBranchRegression)
    ? fail('currentBranchRegressionStatus', ['clean_main_actual_product_bug'])
    : pass('currentBranchRegressionStatus');
}

export function buildLegacySelfTestMatrixReport(input = {}) {
  const matrix = {
    v085SelfTestStatus: input.v085SelfTestStatus || 'pass',
    v092SelfTestStatus: input.v092SelfTestStatus || 'pass',
    v099SelfTestStatus: input.v099SelfTestStatus || 'pass',
    v100SelfTestStatus: input.v100SelfTestStatus || 'pass',
    v101SelfTestStatus: input.v101SelfTestStatus || 'pass',
    v102SelfTestStatus: input.v102SelfTestStatus || 'pass',
  };
  const activeVersion = input.activeVersion || 'v102';
  const activeKey = `${activeVersion}SelfTestStatus`;
  const reasons = [];
  if (!Object.hasOwn(matrix, 'v102SelfTestStatus')) reasons.push('v102_self_test_missing');
  if (matrix[activeKey] === 'fail') reasons.push('clean_main_legacy_self_test_drift');
  if (!input.failureClass && Object.values(matrix).includes('fail')) reasons.push('safe_next_action_ambiguous');
  return reasons.length
    ? fail('legacySelfTestMatrixStatus', reasons, { matrix, activeVersion })
    : pass('legacySelfTestMatrixStatus', {
      matrix,
      activeVersion,
      legacyAdvisoryVersions: input.legacyAdvisoryVersions || ['v085', 'v092'],
      blockingVersions: input.blockingVersions || ['v101', 'v102'],
      repairHint: input.repairHint || 'classify_legacy_drift_before_product_pr_recovery',
    });
}

export function buildFixtureOrchestrationFlakeReport(input = {}) {
  const classification = input.classification || 'stable_pass';
  const reasons = [];
  if (classification === 'fixture_orchestration_timing' || classification === 'transient_flake') reasons.push('fixture_orchestration_timing');
  if (classification === 'actual_product_concurrency_bug') reasons.push('clean_main_actual_product_bug');
  if (classification === 'unknown') reasons.push('safe_next_action_ambiguous');
  if (bool(input.singlePassTreatedStable)) reasons.push('fixture_orchestration_timing');
  return reasons.length ? fail('fixtureOrchestrationFlakeStatus', reasons, { classification }) : pass('fixtureOrchestrationFlakeStatus', { classification });
}

export function buildSupportFileBoundaryReport(input = {}) {
  const reasons = [];
  if (bool(input.targetRequiresSourceManifest) || bool(input.sourceOnlyCopiedToTarget)) reasons.push('source_target_manifest_boundary_error');
  if (bool(input.materializationMismatch)) reasons.push('support_file_materialization_mismatch');
  if (bool(input.targetFailsWithoutSourceOnlyManifest)) reasons.push('source_target_manifest_boundary_error');
  return reasons.length ? fail('supportFileBoundaryStatus', reasons) : pass('supportFileBoundaryStatus', {
    sourceOnly: ['CODEX_SOURCE_HARNESS_MANIFEST.json'],
    targetAllowed: ['docs/process/CODEX_HARNESS_MANIFEST.json', 'scripts/codex-*'],
  });
}

export function buildSourceTargetManifestBoundaryReport(input = {}) {
  return hasAny(input, ['sourceManifestCopiedToTarget', 'targetManifestMissing'])
    ? fail('sourceTargetManifestBoundaryStatus', ['source_target_manifest_boundary_error'])
    : pass('sourceTargetManifestBoundaryStatus');
}

export function buildSupportFileMaterializationReport(input = {}) {
  return bool(input.materializationMismatch)
    ? fail('supportFileMaterializationStatus', ['support_file_materialization_mismatch'])
    : pass('supportFileMaterializationStatus');
}

export function buildV085CheckoutDiffIsolationReport(input = {}) {
  const reasons = [];
  if (bool(input.activeCheckoutDiffLeak) || bool(input.pr42ShapedProductDiffAsFixture)) reasons.push('v085_active_checkout_diff_leak');
  if (bool(input.globalIgnoreProductDocs) || bool(input.topLevelProductGateHidden)) reasons.push('product_pr_diff_containment_failed');
  if (bool(input.harnessOnlyForbiddenPathWeakened)) reasons.push('harness_fixture_diff_isolation_failed');
  if (bool(input.pendingAfterPushAsRemotePass)) reasons.push('product_pr_pending_after_push_not_remote_pass');
  if (bool(input.targetMergeReadyWithoutSameHeadRemotePass)) reasons.push('target_merge_ready_without_same_head_remote_pass');
  return reasons.length ? fail('v085CheckoutDiffIsolationStatus', reasons) : pass('v085CheckoutDiffIsolationStatus');
}

export function buildActiveCheckoutDiffIsolationReport(input = {}) {
  return bool(input.activeCheckoutDiffLeak)
    ? fail('activeCheckoutDiffIsolationStatus', ['v085_active_checkout_diff_leak'])
    : pass('activeCheckoutDiffIsolationStatus');
}

export function buildProductPrDiffContainmentReport(input = {}) {
  return hasAny(input, ['productDiffHidden', 'productDiffMixedWithHarnessFixture'])
    ? fail('productPrDiffContainmentStatus', ['product_pr_diff_containment_failed'])
    : pass('productPrDiffContainmentStatus');
}

export function buildHarnessFixtureDiffIsolationReport(input = {}) {
  return hasAny(input, ['usesActiveWorktreeDiff', 'fixturePathMixedWithProductPr'])
    ? fail('harnessFixtureDiffIsolationStatus', ['harness_fixture_diff_isolation_failed'])
    : pass('harnessFixtureDiffIsolationStatus');
}

export function buildProductPrEvidenceGeneratorReport(input = {}) {
  const evidence = {
    taskMode: input.taskMode || 'product_change',
    riskLevel: input.riskLevel || 'R3',
    changedFiles: input.changedFiles || ['product_file'],
    expectedProductFiles: input.expectedProductFiles || ['product_file'],
    localPrePushEvidence: input.localPrePushEvidence || 'present',
    formalProductEvidence: input.formalProductEvidence || 'present',
    safeNpmDiagnostic: input.safeNpmDiagnostic || 'present',
    remoteBaseline: input.remoteBaseline || 'present',
    sameHeadRemoteQualityGate: input.sameHeadRemoteQualityGate || 'pass',
    reviewIndependence: input.reviewIndependence || 'present',
    runtimeReadinessBoundary: input.runtimeReadinessBoundary || 'not_claimed',
    productionGoBoundary: input.productionGoBoundary || 'not_claimed',
    limitations: input.limitations || 'not runtime or production readiness',
    nextAction: input.nextAction || 'wait_for_same_head_remote_pass',
  };
  return pass('productPrEvidenceGeneratorStatus', { evidence });
}

export function buildProductPrEvidenceValidatorReport(input = {}) {
  const reasons = [];
  if (bool(input.formalMissing)) reasons.push('product_pr_evidence_missing');
  if (bool(input.safeSummaryMissing)) reasons.push('product_pr_evidence_missing');
  if (bool(input.remoteEvidenceStale) || bool(input.sameHeadMismatch)) reasons.push('product_pr_evidence_missing');
  if (bool(input.pendingAfterPushAsRemotePass)) reasons.push('product_pr_pending_after_push_not_remote_pass');
  if (bool(input.targetMergeReadyWithoutSameHeadRemotePass)) reasons.push('target_merge_ready_without_same_head_remote_pass');
  if (bool(input.placeholderOnly) || bool(input.lifeboatOnly)) reasons.push('product_pr_evidence_missing');
  if (bool(input.runtimeReadinessClaimed) || bool(input.productionReadinessClaimed)) reasons.push('target_merge_ready_without_same_head_remote_pass');
  return reasons.length ? fail('productPrEvidenceValidatorStatus', reasons) : pass('productPrEvidenceValidatorStatus');
}

export function buildProductPrEvidenceSafeSummaryReport(input = {}) {
  return bool(input.safeSummaryMissing)
    ? fail('productPrEvidenceSafeSummaryStatus', ['product_pr_evidence_missing'])
    : pass('productPrEvidenceSafeSummaryStatus', { valuesPrinted: false });
}

export function buildBackupArtifactManagerReport(input = {}) {
  const reasons = [];
  if (bool(input.tracked)) reasons.push('backup_artifact_tracked');
  if (bool(input.staged)) reasons.push('backup_artifact_staged');
  if (bool(input.repoInternal)) reasons.push('backup_artifact_repo_internal');
  if (bool(input.gitCleanAttempt) || bool(input.gitResetAttempt)) reasons.push('backup_artifact_repo_internal');
  if (bool(input.safeSummaryMissing)) reasons.push('safe_next_action_ambiguous');
  return reasons.length ? fail('backupArtifactManagerStatus', reasons) : pass('backupArtifactManagerStatus');
}

export function buildRepoExternalBackupReport(input = {}) {
  return bool(input.repoInternal)
    ? fail('repoExternalBackupStatus', ['backup_artifact_repo_internal'])
    : pass('repoExternalBackupStatus', { backupLocation: input.backupLocation || 'repo_external_safe_backup' });
}

export function buildDirtyWorktreeBackupBoundaryReport(input = {}) {
  return hasAny(input, ['trackedBackup', 'stagedBackup', 'protectedPatchApplied', 'protectedStashPopped'])
    ? fail('dirtyWorktreeBackupBoundaryStatus', ['backup_artifact_tracked'])
    : pass('dirtyWorktreeBackupBoundaryStatus');
}

export function buildPrRecoveryAutopilotReport(input = {}) {
  return oneAllowedAction(input.action || 'rebase_required', RECOVERY_ACTIONS)
    ? pass('prRecoveryAutopilotStatus', { action: input.action || 'rebase_required' })
    : fail('prRecoveryAutopilotStatus', ['safe_next_action_ambiguous']);
}

export function buildStalePrRecoveryPlanReport(input = {}) {
  return bool(input.stalePrTreatedAsMergeCandidate)
    ? fail('stalePrRecoveryPlanStatus', ['safe_next_action_ambiguous'])
    : pass('stalePrRecoveryPlanStatus', { action: input.action || 'rebase_required' });
}

export function buildCurrentHeadRecoveryPlanReport(input = {}) {
  return bool(input.oldBaseRemotePassAsCurrentHead)
    ? fail('currentHeadRecoveryPlanStatus', ['target_merge_ready_without_same_head_remote_pass'])
    : pass('currentHeadRecoveryPlanStatus', { action: input.action || 'rerun_required' });
}

export function buildSameHeadRemoteEvidencePlanReport(input = {}) {
  return hasAny(input, ['sameHeadMismatch', 'workflowDispatchAsPrEvidence'])
    ? fail('sameHeadRemoteEvidencePlanStatus', ['target_merge_ready_without_same_head_remote_pass'])
    : pass('sameHeadRemoteEvidencePlanStatus');
}

export function buildBodyOnlyRepairPlanReport(input = {}) {
  return bool(input.productFailureTreatedBodyOnly)
    ? fail('bodyOnlyRepairPlanStatus', ['safe_next_action_ambiguous'])
    : pass('bodyOnlyRepairPlanStatus', { action: input.action || 'body_only_repair_required' });
}

export function buildOwnerActionNextStepReport(input = {}) {
  const required = ['safeNextAction', 'ownerAction', 'forbiddenScope', 'whyNow'];
  const missing = required.filter((key) => !input[key]);
  return missing.length ? fail('ownerActionNextStepStatus', ['safe_next_action_ambiguous'], { missing }) : pass('ownerActionNextStepStatus', {
    safeNextAction: input.safeNextAction,
    ownerAction: input.ownerAction,
    forbiddenScope: input.forbiddenScope,
    whyNow: input.whyNow,
  });
}

export function buildExternalBlockedReport(input = {}) {
  return bool(input.mergeReadyWhileExternalBlocked)
    ? fail('externalBlockedStatus', ['external_blocked_independent_reviewer_unavailable'])
    : pass('externalBlockedStatus', { state: input.state || 'not_applicable' });
}

export function buildReviewerAvailabilityReport(input = {}) {
  if (bool(input.writerOnlyReview)) return fail('reviewerAvailabilityStatus', ['writer_only_review_detected']);
  if (bool(input.reviewerUnavailable)) return status('reviewerAvailabilityStatus', 'blocked_external', { reasonCodes: ['external_blocked_independent_reviewer_unavailable'] });
  return pass('reviewerAvailabilityStatus');
}

export function buildSplitScoreModelReport(input = {}) {
  const required = ['productEvidenceScore', 'harnessEvidenceScore', 'governanceScore', 'externalBlockedStatus', 'mergeReadiness', 'safeNextAction'];
  const missing = required.filter((key) => !input[key]);
  if (missing.length) return fail('splitScoreModelStatus', ['split_score_model_missing'], { missing });
  if (String(input.externalBlockedStatus).includes('blocked') && input.mergeReadiness === 'yes') {
    return fail('splitScoreModelStatus', ['external_blocked_independent_reviewer_unavailable']);
  }
  return pass('splitScoreModelStatus');
}

export function buildPrDependencyGraphReport(input = {}) {
  if (bool(input.dependentPr) && !input.blocked_by) return fail('prDependencyGraphStatus', ['pr_dependency_graph_missing']);
  if (bool(input.supersededPrMergeCandidate)) return fail('prDependencyGraphStatus', ['pr_dependency_graph_missing']);
  return pass('prDependencyGraphStatus', {
    blocked_by: input.blocked_by || [],
    must_merge_before: input.must_merge_before || [],
    safeNextAction: input.safeNextAction || 'resolve_dependency_before_recovery',
  });
}

export function buildSmallRepoModeReport(input = {}) {
  return bool(input.externalBlockedMergeReady)
    ? fail('smallRepoModeStatus', ['external_blocked_independent_reviewer_unavailable'])
    : pass('smallRepoModeStatus');
}

export function buildSafeNextActionReport(input = {}) {
  const action = String(input.safeNextAction || 'request_independent_review');
  const vague = /if needed|as needed|maybe|必要なら|確認してください/i.test(action);
  return action && !vague && !action.includes('\n')
    ? pass('safeNextActionStatus', { safeNextAction: action })
    : fail('safeNextActionStatus', ['safe_next_action_ambiguous']);
}

const HANDOVER_REQUIRED = [
  'sourceHarnessVersion',
  'sourceMainHead',
  'sourceRemoteGate',
  'targetRepos',
  'targetMainHeads',
  'openPRs',
  'blockedPRs',
  'protectedBranches',
  'protectedStashes',
  'protectedPatches',
  'priority1Status',
  'runtimeReadinessClaims',
  'productionReadinessClaims',
  'rawLogsReadStatus',
  'rawDiffReadStatus',
  'nextSafeAction',
  'forbiddenScopes',
  'datasetAuditPolicyState',
  'voicePolicyState',
];

export function buildHandoverSnapshotReport(input = {}) {
  const snapshot = input.snapshot || buildDefaultHandoverSnapshot();
  const missing = HANDOVER_REQUIRED.filter((key) => snapshot[key] === undefined);
  return missing.length ? fail('handoverSnapshotStatus', ['handover_snapshot_missing'], { missing }) : pass('handoverSnapshotStatus');
}

export function buildOperatorSevenLineSummaryReport(input = {}) {
  const lines = input.lines || [
    'source harness v1.0.2 active',
    'source main verified',
    'target rollout not started',
    'protected state inventoried',
    'runtime readiness not claimed',
    'production readiness not claimed',
    'next action is source remote gate verification',
  ];
  return lines.length === 7 ? pass('operatorSevenLineSummaryStatus', { lineCount: 7 }) : fail('operatorSevenLineSummaryStatus', ['handover_snapshot_missing']);
}

export function buildMachineReplayDigestReport(input = {}) {
  return input.digest && typeof input.digest === 'object'
    ? pass('machineReplayDigestStatus')
    : fail('machineReplayDigestStatus', ['handover_snapshot_missing']);
}

export function buildProtectedStateInventoryReport(input = {}) {
  const reasons = [];
  if (bool(input.patchApplied)) reasons.push('protected_patch_apply_forbidden');
  if (bool(input.stashPopped)) reasons.push('protected_stash_pop_forbidden');
  if (bool(input.missingInventory)) reasons.push('protected_state_inventory_missing');
  return reasons.length ? fail('protectedStateInventoryStatus', reasons) : pass('protectedStateInventoryStatus');
}

export function buildWorkflowResumeStateReport(input = {}) {
  const required = ['lastCompletedPhase', 'currentPhase', 'nextPhase', 'blockedPhase', 'blockerReason', 'safeToResume', 'mustNotResume', 'requiredOwnerDecision'];
  const missing = required.filter((key) => input[key] === undefined);
  if (missing.length) return fail('workflowResumeStateStatus', ['workflow_resume_state_missing'], { missing });
  if (bool(input.forbiddenScope)) return fail('workflowResumeStateStatus', ['workflow_resume_state_missing']);
  return pass('workflowResumeStateStatus');
}

export function buildDefaultHandoverSnapshot() {
  return {
    sourceHarnessVersion: '1.0.2',
    sourceMainHead: 'current_head_required_after_merge',
    sourceRemoteGate: 'pending_until_source_pr_remote_pass',
    targetRepos: [],
    targetMainHeads: {},
    openPRs: [],
    blockedPRs: [],
    protectedBranches: [],
    protectedStashes: [],
    protectedPatches: [],
    priority1Status: 'not_started',
    runtimeReadinessClaims: 'none',
    productionReadinessClaims: 'none',
    rawLogsReadStatus: 'not_read',
    rawDiffReadStatus: 'not_read',
    nextSafeAction: 'verify_source_pr_remote_gate',
    forbiddenScopes: ['target_rollout', 'product_code'],
    datasetAuditPolicyState: 'runner_not_started',
    voicePolicyState: 'policy_only',
  };
}

export function buildV102SelfTestRegistrationReport(input = {}) {
  const reasons = [];
  if (!fs.existsSync('scripts/codex-v102-self-test.mjs') || bool(input.selfTestMissing)) reasons.push('v102_self_test_missing');
  if (!readText('scripts/codex-local-quality-gate.mjs')?.includes('v102SelfTestStatus')) reasons.push('v102_self_test_missing');
  if (!readText('CODEX_SOURCE_HARNESS_MANIFEST.json')?.includes('codex-v102-self-test.mjs')) reasons.push('v102_self_test_missing');
  return reasons.length ? fail('v102SelfTestStatus', reasons) : pass('v102SelfTestStatus');
}

export function buildDefaultV102Reports(context = {}) {
  return {
    cleanMainBaselineStabilityStatus: buildCleanMainBaselineStabilityReport(),
    legacySelfTestMatrixStatus: buildLegacySelfTestMatrixReport(),
    fixtureOrchestrationFlakeStatus: buildFixtureOrchestrationFlakeReport(),
    supportFileBoundaryStatus: buildSupportFileBoundaryReport(),
    sourceTargetManifestBoundaryStatus: buildSourceTargetManifestBoundaryReport(),
    supportFileMaterializationStatus: buildSupportFileMaterializationReport(),
    cleanMainRepairPlanStatus: buildCleanMainRepairPlanReport(),
    baselineRepairIsolationStatus: buildBaselineRepairIsolationReport(),
    currentBranchRegressionStatus: buildCurrentBranchRegressionReport(),
    v085CheckoutDiffIsolationStatus: buildV085CheckoutDiffIsolationReport(),
    activeCheckoutDiffIsolationStatus: buildActiveCheckoutDiffIsolationReport(),
    productPrDiffContainmentStatus: buildProductPrDiffContainmentReport(),
    harnessFixtureDiffIsolationStatus: buildHarnessFixtureDiffIsolationReport(),
    productPrEvidenceGeneratorStatus: buildProductPrEvidenceGeneratorReport(),
    productPrEvidenceValidatorStatus: buildProductPrEvidenceValidatorReport(),
    productPrEvidenceSafeSummaryStatus: buildProductPrEvidenceSafeSummaryReport(),
    backupArtifactManagerStatus: buildBackupArtifactManagerReport(),
    repoExternalBackupStatus: buildRepoExternalBackupReport(),
    dirtyWorktreeBackupBoundaryStatus: buildDirtyWorktreeBackupBoundaryReport(),
    prRecoveryAutopilotStatus: buildPrRecoveryAutopilotReport(),
    stalePrRecoveryPlanStatus: buildStalePrRecoveryPlanReport(),
    currentHeadRecoveryPlanStatus: buildCurrentHeadRecoveryPlanReport(),
    sameHeadRemoteEvidencePlanStatus: buildSameHeadRemoteEvidencePlanReport(),
    bodyOnlyRepairPlanStatus: buildBodyOnlyRepairPlanReport(),
    ownerActionNextStepStatus: buildOwnerActionNextStepReport({
      safeNextAction: context.safeNextAction || 'verify_source_pr_remote_gate',
      ownerAction: 'harness_maintainer',
      forbiddenScope: 'target_rollout',
      whyNow: 'v102_source_development',
    }),
    externalBlockedStatus: buildExternalBlockedReport(),
    reviewerAvailabilityStatus: buildReviewerAvailabilityReport(),
    splitScoreModelStatus: buildSplitScoreModelReport({
      productEvidenceScore: 'not_applicable',
      harnessEvidenceScore: 'pass',
      governanceScore: 'pass',
      externalBlockedStatus: 'not_applicable',
      mergeReadiness: 'no_until_remote_pass',
      safeNextAction: 'verify_source_pr_remote_gate',
    }),
    prDependencyGraphStatus: buildPrDependencyGraphReport(),
    smallRepoModeStatus: buildSmallRepoModeReport(),
    safeNextActionStatus: buildSafeNextActionReport({ safeNextAction: context.safeNextAction || 'verify_source_pr_remote_gate' }),
    handoverSnapshotStatus: buildHandoverSnapshotReport(),
    operatorSevenLineSummaryStatus: buildOperatorSevenLineSummaryReport(),
    machineReplayDigestStatus: buildMachineReplayDigestReport({ digest: buildDefaultHandoverSnapshot() }),
    protectedStateInventoryStatus: buildProtectedStateInventoryReport(),
    workflowResumeStateStatus: buildWorkflowResumeStateReport({
      lastCompletedPhase: 'source_v101_preflight',
      currentPhase: 'source_v102_development',
      nextPhase: 'source_remote_gate',
      blockedPhase: 'target_rollout',
      blockerReason: 'not_in_scope',
      safeToResume: true,
      mustNotResume: ['target_rollout', 'product_code'],
      requiredOwnerDecision: 'none',
    }),
    v102SelfTestStatus: buildV102SelfTestRegistrationReport(),
  };
}

export function readV102Input(envName) {
  const candidates = [
    process.env.CODEX_V102_INPUT_JSON,
    envName ? process.env[`${envName}_INPUT_JSON`] : '',
  ];
  for (const text of candidates) {
    if (!text) continue;
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return { invalidInputJson: true };
    }
  }
  return {};
}

export function runV102GateCli(metaUrl, argvOne, builder, envName) {
  if (argvOne && fileURLToPath(metaUrl) === argvOne) {
    const report = builder(readV102Input(envName));
    writeJsonReport(report, envName);
    exitFor(report);
  }
}

export function buildCompositeStatus(statusKey, reports) {
  return mergeStatus(statusKey, reports);
}
