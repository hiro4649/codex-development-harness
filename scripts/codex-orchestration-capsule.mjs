#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.1

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { pass, fail } from './codex-outcome-contract.mjs';

export const V119_OPERATOR_STATUS_KEYS = [
  'orchestrationModeStatus',
  'permissionGrantStatus',
  'localRepoReadinessStatus',
  'workerContractStatus',
  'workerProofStatus',
  'reviewChainStatus',
  'ownerDecisionBriefStatus',
  'finalDecisionPointerStatus',
];

export const V119_P0_ARTIFACTS = [
  'codex-orchestration-capsule.safe.json',
  'codex-worker-proof.safe.json',
  'codex-owner-decision-brief.safe.json',
];

export const V120_OPERATOR_STATUS_KEYS = V119_OPERATOR_STATUS_KEYS;
export const V120_P0_ARTIFACTS = V119_P0_ARTIFACTS;
export const V121_OPERATOR_STATUS_KEYS = V119_OPERATOR_STATUS_KEYS;
export const V121_P0_ARTIFACTS = V119_P0_ARTIFACTS;

const MODEL_TIERS = new Set(['low_cost_worker', 'standard_worker', 'specialist_reviewer', 'highest_reasoning_reviewer']);
const TYPED_BLOCKERS = new Set([
  'none',
  'repeated_failure',
  'unclear_root_cause',
  'reviewer_disagreement',
  'scope_boundary',
  'authority_boundary',
  'evidence_contradiction',
  'token_budget_exceeded',
  'validation_unavailable',
  'security_sensitive_ambiguity',
  'restricted_asset_ambiguity',
  'runtime_readiness_boundary',
]);
const ESCALATION_REASONS = new Set([
  'none',
  'same_primary_class_repeated',
  'same_test_failure_repeated',
  'reviewer_cannot_classify',
  'tests_worsened',
  'root_cause_unclear',
  'scope_boundary_uncertainty',
  'security_sensitive_ambiguity',
  'cross_repo_dependency_ambiguity',
  'package_runtime_boundary_uncertainty',
  'delegated_continuation_uncertainty',
  'evidence_contradiction',
]);
const DE_ESCALATION_REASONS = new Set(['none', 'root_cause_classified', 'repair_plan_bounded', 'validation_path_known', 'next_action_mechanical']);
const REVIEWER_MODES = new Set(['none', 'lightweight_single', 'specialist_single', 'specialist_pair', 'highest_reasoning_review']);
const TOKEN_SAVINGS_CLASSES = new Set(['unknown', 'none', 'low', 'medium', 'high']);
const SAFE_SUMMARY_STATUSES = new Set(['unknown', 'pass', 'fail', 'not_required_with_reason']);

const ORCHESTRATION_MODES = new Set([
  'analysis_only',
  'single_repo_task',
  'multi_repo_watch',
  'worker_split_task',
  'preserve_watch',
]);

const TERMINAL_ACTIONS = new Set([
  'analysis_only',
  'create_pr_only',
  'preserve_only',
  'investigate_only',
  'merge_current_pr',
]);

const MUTATION_ACTIONS = new Set(['commit', 'push', 'createPr', 'rerunCi', 'fixCi']);
const CURRENT_OWNER_ONLY_ACTIONS = new Set(['merge', 'release', 'publish', 'secretAccess', 'walletRpcDeployAccess']);
const REVIEW_DELEGABLE_ACTIONS = new Set(['commit', 'push', 'createPr', 'rerunCi', 'fixCi', 'merge']);
const NON_DELEGABLE_CURRENT_ACTIONS = new Set(['release', 'publish', 'secretAccess', 'walletRpcDeployAccess']);
const REVIEW_AGENT_ALLOWED_ACTIONS = new Set(['inspect', 'classify', 'request_repair', 're_review']);

function status(ok, reasonCodes = [], extra = {}) {
  return ok ? pass(extra) : fail(reasonCodes, extra);
}

function truncateList(values = [], limit = 50) {
  return Array.isArray(values) ? values.slice(0, limit).map(String) : [];
}

function defaultOwnerPriorScope(input = {}) {
  return {
    scopeId: input.scopeId || null,
    repo: input.repo || null,
    allowedActions: truncateList(input.allowedActions, 20),
    expiresAt: input.expiresAt || null,
    headSha: input.headSha || null,
    branchConstraint: input.branchConstraint || null,
    sourceInstructionRef: input.sourceInstructionRef || null,
  };
}

function defaultReviewDelegation(input = {}) {
  return {
    enabled: input.enabled === true,
    delegateId: input.delegateId || null,
    delegateRole: input.delegateRole || 'technical_reviewer',
    allowedActions: truncateList(input.allowedActions, 20),
    requiredReviewStatus: input.requiredReviewStatus || 'technical_acceptance_yes',
    currentReviewStatus: input.currentReviewStatus || 'none',
    autoContinue: input.autoContinue === true,
    expiresAt: input.expiresAt || null,
    headSha: input.headSha || null,
    branchConstraint: input.branchConstraint || null,
    sourceInstructionRef: input.sourceInstructionRef || null,
  };
}

function defaultReviewAgentContract(input = {}) {
  return {
    enabled: input.enabled === true,
    workerId: input.workerId || 'single_worker',
    reviewerId: input.reviewerId || 'specialist_reviewer',
    reviewerRole: input.reviewerRole || 'specialist_review_agent',
    reviewScope: input.reviewScope || 'worker_output_safe_artifacts_only',
    allowedActions: truncateList(input.allowedActions || ['inspect', 'classify', 'request_repair', 're_review'], 8),
    forbiddenActions: truncateList(input.forbiddenActions || ['approve', 'merge', 'claim_readiness', 'release', 'publish', 'walletRpcDeployAccess', 'secretAccess'], 20),
    repairAllowedFiles: truncateList(input.repairAllowedFiles || [], 50),
    maxRepairIterations: Math.min(Number(input.maxRepairIterations || 2), 2),
    sameFailureStopThreshold: Math.min(Number(input.sameFailureStopThreshold || 2), 2),
    requiresIndependentContext: input.requiresIndependentContext !== false,
    canApprove: false,
    canMerge: false,
    canClaimReadiness: false,
  };
}

function defaultAdaptiveIntelligenceRouting(input = {}) {
  return {
    routingVersion: '1',
    typedBlocker: TYPED_BLOCKERS.has(input.typedBlocker) ? input.typedBlocker : 'none',
    defaultTier: 'low_cost_worker',
    currentTier: MODEL_TIERS.has(input.currentTier) ? input.currentTier : 'low_cost_worker',
    highestTierUsed: input.highestTierUsed === true,
    escalationCount: Math.min(Number(input.escalationCount || 0), 2),
    deEscalationCount: Math.min(Number(input.deEscalationCount || 0), 4),
    maxEscalationsPerTask: 2,
    maxRepairIterationsBeforeEscalation: 2,
    maxRepairIterationsTotal: 4,
    escalationReason: ESCALATION_REASONS.has(input.escalationReason) ? input.escalationReason : 'none',
    deEscalationReady: input.deEscalationReady === true,
    deEscalationReason: DE_ESCALATION_REASONS.has(input.deEscalationReason) ? input.deEscalationReason : 'none',
    hysteresis: {
      requireBoundedValidationAfterHighestTier: true,
      sameTypedBlockerReEscalationRequiresNewEvidence: true,
      stopOnSameTypedBlockerAfterHighestTier: true,
      highTierRepairPlanPreferredOverRepeatedHighTier: true,
    },
    authorityBoundary: 'v1.1.8_final_decision_and_owner_boundaries_preserved',
    safeNextAction: input.routingSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultReviewPoolPolicy(input = {}) {
  return {
    reviewPoolVersion: '1',
    defaultReviewerCount: 1,
    currentReviewerCount: Math.min(Number(input.currentReviewerCount || 0), 3),
    maxReviewersDefault: 2,
    maxReviewersHard: 3,
    reviewerMode: REVIEWER_MODES.has(input.reviewerMode) ? input.reviewerMode : 'none',
    reviewerIndependenceRequired: true,
    sameWorkerSelfReviewCanPass: false,
    sameWorkerOutputCanSatisfyIndependentReview: false,
    sameRepairLoopCanSelfAccept: false,
    sameAgentSelfReviewAdvisoryOnly: true,
    boundedContextPacketRequired: true,
    findingRequiresPrimaryClassOrCannotClassify: true,
    reviewerCanApproveOwnerDecision: false,
    reviewerCanSubmitGitHubApprovalReview: false,
    reviewerCanClaimReadiness: false,
    safeNextAction: input.reviewPoolSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultModelTierBudget(input = {}) {
  return {
    maxWorkerContextTokens: Math.min(Number(input.maxWorkerContextTokens || 3000), 3000),
    maxSpecialistContextTokens: Math.min(Number(input.maxSpecialistContextTokens || 5000), 5000),
    maxHighestReviewerContextTokens: Math.min(Number(input.maxHighestReviewerContextTokens || 8000), 8000),
    fullConversationAllowedForHighTier: false,
    rawLogsAllowedForHighTier: false,
    secretValuesAllowedForHighTier: false,
    unrelatedRepoHistoryAllowedForHighTier: false,
    passStatusDetail: 'count_only',
    routineProgressOutput: 'silent',
  };
}

function defaultAdaptiveMetrics(input = {}) {
  const tierCounts = input.modelTierUsedCount || {};
  const safeArtifactReadCount = Math.max(0, Number(input.safeArtifactReadCount || 0));
  const finalReportLineCount = Math.max(0, Number(input.finalReportLineCount || 0));
  const ownerQuestionCount = Math.max(0, Number(input.ownerQuestionCount || 0));
  return {
    metricsVersion: '1',
    taskId: input.taskId || 'unknown',
    repo: input.repo || 'hiro4649/codex-development-harness',
    headSha: input.headSha || null,
    modelTierUsedCount: {
      low_cost_worker: Math.max(0, Number(tierCounts.low_cost_worker || input.lowCostWorkerCount || 1)),
      standard_worker: Math.max(0, Number(tierCounts.standard_worker || input.standardWorkerCount || 0)),
      specialist_reviewer: Math.max(0, Number(tierCounts.specialist_reviewer || input.specialistReviewerCount || 0)),
      highest_reasoning_reviewer: Math.max(0, Number(tierCounts.highest_reasoning_reviewer || input.highestReasoningReviewerCount || 0)),
    },
    highestTierUsed: input.highestTierUsed === true,
    highestTierReason: input.highestTierReason || input.typedBlocker || 'none',
    escalationCount: Math.max(0, Math.min(Number(input.escalationCount || 0), 2)),
    deEscalationCount: Math.max(0, Math.min(Number(input.deEscalationCount || 0), 4)),
    repairIterationCount: Math.max(0, Number(input.repairIterationCount || input.repairIterations || 0)),
    ownerQuestionCount,
    safeArtifactReadCount,
    finalReportLineCount,
    calibrationTargets: {
      safeArtifactReadCountTarget: Math.max(1, Number(input.safeArtifactReadCountTarget || 4)),
      finalReportLineCountTarget: Math.max(1, Number(input.finalReportLineCountTarget || 14)),
      ownerQuestionCountTarget: Math.max(0, Number(input.ownerQuestionCountTarget || 1)),
    },
    calibrationWarnings: {
      safeArtifactReadCountAboveTarget: safeArtifactReadCount > Math.max(1, Number(input.safeArtifactReadCountTarget || 4)),
      finalReportLineCountAboveTarget: finalReportLineCount > Math.max(1, Number(input.finalReportLineCountTarget || 14)),
      ownerQuestionCountAboveTarget: ownerQuestionCount > Math.max(0, Number(input.ownerQuestionCountTarget || 1)),
    },
    estimatedRepeatedContextSuppressed: Math.max(0, Number(input.estimatedRepeatedContextSuppressed || 0)),
    estimatedTokenSavingsClass: TOKEN_SAVINGS_CLASSES.has(input.estimatedTokenSavingsClass) ? input.estimatedTokenSavingsClass : 'unknown',
    rawLogsRead: false,
    safeNextAction: input.metricsSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultRoutingCalibration(input = {}) {
  return {
    calibrationVersion: '1',
    typedBlocker: TYPED_BLOCKERS.has(input.typedBlocker) ? input.typedBlocker : 'none',
    defaultTier: 'low_cost_worker',
    currentTier: MODEL_TIERS.has(input.currentTier) ? input.currentTier : 'low_cost_worker',
    escalationWasRequired: input.escalationWasRequired === true,
    escalationReason: ESCALATION_REASONS.has(input.escalationReason) ? input.escalationReason : 'none',
    escalationEvidence: input.escalationEvidence || 'safe_summary_only',
    overEscalationDetected: input.overEscalationDetected === true,
    deEscalationReady: input.deEscalationReady === true,
    deEscalationBlockedReason: input.deEscalationBlockedReason || 'none',
    safeNextAction: input.calibrationSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultTargetScoreBaseline(input = {}) {
  const accepted = Number(input.acceptedTargetQualityScore ?? 89);
  const current = Number(input.currentTargetQualityScore ?? accepted);
  return {
    baselineVersion: '1',
    repo: input.repo || 'target_repo',
    acceptedTargetQualityScore: accepted,
    currentTargetQualityScore: current,
    scoreRegressionDetected: input.scoreRegressionDetected === true || current < accepted,
    scoreImprovementRequired: input.scoreImprovementRequired === true && current < accepted,
    repairAllowedForScoreOnly: input.repairAllowedForScoreOnly === true,
    reason: input.targetScoreReason || 'remote_pass_and_no_blocker',
    safeNextAction: input.targetScoreSafeNextAction || 'none',
  };
}

function defaultEvidenceFreshnessGuard(input = {}) {
  const safeSummaryStatus = SAFE_SUMMARY_STATUSES.has(input.safeSummaryStatus) ? input.safeSummaryStatus : 'unknown';
  const sameHead = input.sameHead !== false;
  const mergeEvidenceCoherent = input.mergeEvidenceCoherent !== false;
  const drift = input.evidenceDriftDetected === true || sameHead === false || mergeEvidenceCoherent === false || safeSummaryStatus === 'fail';
  return {
    freshnessVersion: '1',
    workflowSuccessRequiresSafeSummaryPass: input.workflowSuccessRequiresSafeSummaryPass !== false,
    githubCheckConclusion: input.githubCheckConclusion || 'unknown',
    safeSummaryStatus,
    sameHead,
    mergeEvidenceCoherent,
    evidenceDriftDetected: drift,
    safeNextAction: input.freshnessSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultMinimalReverificationMatrix(input = {}) {
  return {
    matrixVersion: '1',
    sameHeadRequired: input.sameHeadRequired !== false,
    localGateRequiredAfterHarnessChange: input.localGateRequiredAfterHarnessChange !== false,
    remoteGateRequiredBeforeMerge: input.remoteGateRequiredBeforeMerge !== false,
    rerunRequiredOnlyOnStateDelta: input.rerunRequiredOnlyOnStateDelta !== false,
    safeArtifactsOnly: true,
  };
}

export function buildOrchestrationCapsule(input = {}) {
  const permissionGrant = {
    triage: input.triage === true,
    monitor: input.monitor === true,
    implement: input.implement === true,
    commit: input.commit === true,
    push: input.push === true,
    createPr: input.createPr === true,
    rerunCi: input.rerunCi === true,
    fixCi: input.fixCi === true,
    merge: input.merge === true,
    closeIssue: input.closeIssue === true,
    release: input.release === true,
    publish: input.publish === true,
    externalToolUse: input.externalToolUse === true,
    secretAccess: input.secretAccess === true,
    walletRpcDeployAccess: input.walletRpcDeployAccess === true,
    permissionEvidenceSource: input.permissionEvidenceSource || 'none',
    mutationPermissionAuthority: input.mutationPermissionAuthority || 'none',
    mergePermissionAuthority: input.mergePermissionAuthority || 'none',
    releasePermissionAuthority: input.releasePermissionAuthority || 'none',
    walletRpcDeployPermissionAuthority: input.walletRpcDeployPermissionAuthority || 'none',
    secretAccessAuthority: input.secretAccessAuthority || 'none',
    ownerPriorScope: defaultOwnerPriorScope(input.ownerPriorScope || {}),
    reviewDelegation: defaultReviewDelegation(input.reviewDelegation || {}),
    scope: input.scope || 'source_only',
  };
  const localRepoReadiness = {
    repo: input.repo || 'hiro4649/codex-development-harness',
    cwd: input.cwd || 'safe_path_redacted',
    branch: input.branch || 'unknown',
    defaultBranch: input.defaultBranch || 'main',
    pullFfOnlyStatus: input.pullFfOnlyStatus || 'not_required_with_reason',
    worktreeCleanBefore: input.worktreeCleanBefore !== false,
    worktreeCleanAfter: input.worktreeCleanAfter !== false,
    dirtyWorktreePolicy: input.dirtyWorktreePolicy || 'not_applicable',
    destructiveRecoveryAttempted: input.destructiveRecoveryAttempted === true,
    frozenBranchDetected: input.frozenBranchDetected === true,
    wrongRepoDetected: input.wrongRepoDetected === true,
  };
  const workerContract = {
    workerId: input.workerId || 'single_worker',
    repo: input.repo || 'hiro4649/codex-development-harness',
    itemUrl: input.itemUrl || null,
    allowedFiles: truncateList(input.allowedFiles, 50),
    forbiddenFiles: truncateList(input.forbiddenFiles, 50),
    forbiddenScopeProfile: input.forbiddenScopeProfile || 'SOURCE_HARNESS_BODY_ONLY_V121',
    acceptanceCriteria: truncateList(input.acceptanceCriteria, 8),
    nonGoals: truncateList(input.nonGoals, 8),
    stopBoundary: truncateList(input.stopBoundary, 8),
    requiredProof: truncateList(input.requiredProof, 8),
    mustNotDelegate: input.mustNotDelegate !== false,
    terminalAction: input.terminalAction || 'create_pr_only',
    contextBudgetTokens: Math.min(Number(input.contextBudgetTokens || 3000), 3000),
  };
  const reviewAgentContract = defaultReviewAgentContract({
    ...(input.reviewAgentContract || {}),
    workerId: workerContract.workerId,
  });
  return {
    orchestrationVersion: '1',
    activeHarnessVersion: input.activeHarnessVersion || '1.2.1',
    finalAuthority: 'v1.1.8_final_decision_kernel',
    orchestrationMode: input.orchestrationMode || 'single_repo_task',
    stateDelta: input.stateDelta === true,
    permissionGrant,
    localRepoReadiness,
    workerContract,
    reviewAgentContract,
    adaptiveIntelligenceRouting: defaultAdaptiveIntelligenceRouting(input.adaptiveIntelligenceRouting || input),
    reviewPoolPolicy: defaultReviewPoolPolicy(input.reviewPoolPolicy || input),
    escalationPolicy: {
      escalateOnlyOnTypedBlocker: true,
      highestReasoningOnlyForPersistentAmbiguity: true,
      typedBlockerTaxonomy: [...TYPED_BLOCKERS],
    },
    deEscalationPolicy: {
      deEscalateWhenRootCauseAndRepairPlanBounded: true,
      requireBoundedSuccessfulValidationAfterHighestTier: true,
      nextActionMustBeMechanical: true,
    },
    modelTierBudget: defaultModelTierBudget(input.modelTierBudget || input),
    adaptiveMetrics: defaultAdaptiveMetrics(input.adaptiveMetrics || input),
    routingCalibration: defaultRoutingCalibration(input.routingCalibration || input),
    targetScoreBaseline: defaultTargetScoreBaseline(input.targetScoreBaseline || input),
    evidenceFreshnessGuard: defaultEvidenceFreshnessGuard(input.evidenceFreshnessGuard || input),
    minimalReverificationMatrix: defaultMinimalReverificationMatrix(input.minimalReverificationMatrix || input),
    authorityBoundary: {
      conflictPrecedence: [
        'v1.1.8_final_decision_over_v1.1.9_v1.2.0_and_v1.2.1',
        'v1.1.9_orchestration_over_v1.2.0_routing_and_v1.2.1_calibration',
        'owner_only_boundary_over_reviewer_output',
      ],
      highTierReviewCreatesOwnerApproval: false,
      reviewPoolConsensusCreatesMergePermission: false,
      adaptiveRoutingCreatesMergePermission: false,
      mayRecordMergeCurrentPrEligibilityOnly: true,
    },
    lightHeartbeat: {
      routineHeartbeatOutput: 'silent',
      stateDeltaDetected: input.stateDelta === true,
      interventionAllowed: input.interventionAllowed === true,
      interventionReason: input.interventionReason || 'none',
    },
    evidenceBundle: {
      bundleId: input.evidenceBundleId || null,
      canBundleLowRiskEvidence: input.canBundleLowRiskEvidence === true,
      bundleReason: input.bundleReason || 'not_required_with_reason',
      newDocsPrRecommended: input.newDocsPrRecommended === true,
    },
    preserveExitCondition: {
      type: input.preserveExitType || 'none',
      safeNextAction: input.preserveExitSafeNextAction || 'none',
    },
    safeNextAction: input.safeNextAction || 'owner_merge_decision_only_after_same_head_pass',
    rawLogsRead: false,
    eightSessionUsed: false,
    safeSummaryOnly: true,
  };
}

function isSubset(values = [], allowed = []) {
  if (!Array.isArray(values) || !Array.isArray(allowed)) return false;
  if (allowed.length === 0) return values.length === 0;
  const allowedSet = new Set(allowed);
  return values.every((item) => allowedSet.has(item));
}

function ownerPriorScopeValid(scope = {}) {
  if (!scope || typeof scope !== 'object') return false;
  const hasConstraint = Boolean(scope.headSha || scope.branchConstraint);
  return Boolean(scope.scopeId && scope.repo && Array.isArray(scope.allowedActions) && scope.allowedActions.length && scope.expiresAt && scope.sourceInstructionRef && hasConstraint);
}

function reviewDelegationValid(delegation = {}, action = null) {
  if (!delegation || typeof delegation !== 'object' || delegation.enabled !== true) return false;
  const hasConstraint = Boolean(delegation.headSha || delegation.branchConstraint);
  const accepted = delegation.currentReviewStatus === delegation.requiredReviewStatus;
  const actionAllowed = !action || delegation.allowedActions?.includes(action);
  return Boolean(delegation.delegateId && delegation.delegateRole && delegation.requiredReviewStatus && accepted && actionAllowed && delegation.expiresAt && delegation.sourceInstructionRef && hasConstraint);
}

export function validatePermissionGrant(grant = {}) {
  const reasons = [];
  const delegation = grant.reviewDelegation || {};
  if (delegation.enabled === true) {
    if (!reviewDelegationValid(delegation)) reasons.push('review_delegation_metadata_or_acceptance_missing');
    for (const action of delegation.allowedActions || []) {
      if (!REVIEW_DELEGABLE_ACTIONS.has(action)) reasons.push(`review_delegate_cannot_authorize_${action}`);
    }
  }
  if (grant.permissionEvidenceSource === 'repository_policy') {
    for (const action of [...MUTATION_ACTIONS, ...CURRENT_OWNER_ONLY_ACTIONS]) {
      if (grant[action] === true) reasons.push(`repository_policy_cannot_authorize_${action}`);
    }
  }
  if (grant.mutationPermissionAuthority === 'owner_prior_scope_only') {
    if (!ownerPriorScopeValid(grant.ownerPriorScope)) reasons.push('owner_prior_scope_metadata_missing');
    for (const action of MUTATION_ACTIONS) {
      if (grant[action] === true && !grant.ownerPriorScope?.allowedActions?.includes(action)) reasons.push(`owner_prior_scope_missing_${action}`);
    }
  }
  if (grant.mutationPermissionAuthority === 'owner_delegated_current_only') {
    for (const action of MUTATION_ACTIONS) {
      if (grant[action] === true && !reviewDelegationValid(delegation, action)) reasons.push(`owner_delegated_scope_missing_${action}`);
    }
  }
  for (const action of CURRENT_OWNER_ONLY_ACTIONS) {
    if (grant[action] !== true) continue;
    const authorityKey = action === 'walletRpcDeployAccess' ? 'walletRpcDeployPermissionAuthority'
      : action === 'secretAccess' ? 'secretAccessAuthority'
        : `${action}PermissionAuthority`;
    if (action === 'merge') {
      if (grant[authorityKey] === 'owner_delegated_current_only' && !reviewDelegationValid(delegation, 'merge')) reasons.push('merge_requires_accepted_review_delegation');
      if (!['owner_explicit_current_only', 'owner_delegated_current_only'].includes(grant[authorityKey])) reasons.push('merge_requires_owner_explicit_or_delegated_current_only');
    } else if (NON_DELEGABLE_CURRENT_ACTIONS.has(action) && grant[authorityKey] !== 'owner_explicit_current_only') {
      reasons.push(`${action}_requires_owner_explicit_current_only`);
    }
  }
  if (grant.createPr === true && !['owner_prior_scope_only', 'owner_explicit_only', 'owner_delegated_current_only'].includes(grant.mutationPermissionAuthority)) reasons.push('create_pr_requires_owner_scope');
  if (grant.push === true && grant.merge === true && !['owner_explicit_current_only', 'owner_delegated_current_only'].includes(grant.mergePermissionAuthority)) reasons.push('push_permission_does_not_grant_merge');
  return reasons.length ? fail(reasons) : pass({ permissionEvidenceSource: grant.permissionEvidenceSource || 'none' });
}

export function validateLocalRepoReadiness(readiness = {}) {
  const reasons = [];
  if (readiness.wrongRepoDetected === true) reasons.push('wrong_repo_blocks_worker_execution');
  if (readiness.frozenBranchDetected === true || readiness.branch === 'codex/iris-harness-validation-compat-preservation-20260612') reasons.push('frozen_iris_dirty_cascade_branch_blocks_worker_execution');
  if (readiness.destructiveRecoveryAttempted === true) reasons.push('destructive_recovery_attempt_without_owner_scope');
  if (readiness.worktreeCleanBefore !== true || readiness.worktreeCleanAfter !== true) reasons.push('dirty_worktree_blocks_worker_execution');
  if (readiness.pullFfOnlyStatus === 'fail') reasons.push('pull_ff_only_failure_blocks_worker_execution');
  return reasons.length ? fail(reasons) : pass({ pullFfOnlyStatus: readiness.pullFfOnlyStatus || 'not_required_with_reason' });
}

export function validateWorkerContract(contract = {}) {
  const reasons = [];
  if (!contract.workerId || !contract.repo) reasons.push('worker_contract_required_before_implementation');
  if (!TERMINAL_ACTIONS.has(contract.terminalAction)) reasons.push('worker_contract_terminal_action_invalid');
  if (contract.mustNotDelegate !== true) reasons.push('worker_must_not_delegate_by_default');
  if (Number(contract.contextBudgetTokens || 0) > 3000) reasons.push('worker_contract_context_budget_max_3000');
  for (const key of ['allowedFiles', 'forbiddenFiles', 'acceptanceCriteria', 'stopBoundary']) {
    if (!Array.isArray(contract[key])) reasons.push(`worker_contract_${key}_missing`);
  }
  if (!contract.forbiddenScopeProfile) reasons.push('worker_contract_forbidden_scope_profile_missing');
  return reasons.length ? fail(reasons) : pass({ terminalAction: contract.terminalAction });
}

export function validateReviewAgentContract(contract = {}, workerContract = {}) {
  const reasons = [];
  if (contract.enabled !== true) return pass({ enabled: false });
  if (contract.workerId && contract.reviewerId && contract.workerId === contract.reviewerId) reasons.push('self_review_cannot_substitute_specialist_review');
  if (contract.canApprove !== false) reasons.push('specialist_review_cannot_approve');
  if (contract.canMerge !== false) reasons.push('specialist_review_cannot_merge');
  if (contract.canClaimReadiness !== false) reasons.push('specialist_review_cannot_claim_readiness');
  if (contract.requiresIndependentContext !== true) reasons.push('review_agent_requires_independent_context');
  if (Number(contract.maxRepairIterations || 0) > 2 || Number(contract.sameFailureStopThreshold || 0) > 2) reasons.push('auto_repair_iteration_limits_exceeded');
  for (const action of contract.allowedActions || []) {
    if (!REVIEW_AGENT_ALLOWED_ACTIONS.has(action)) reasons.push(`review_agent_action_not_allowed_${action}`);
  }
  if (!isSubset(contract.repairAllowedFiles || [], workerContract.allowedFiles || [])) reasons.push('repair_allowed_files_must_be_subset_of_worker_contract');
  return reasons.length ? fail(reasons) : pass({ enabled: true, maxRepairIterations: contract.maxRepairIterations });
}

export function validateAdaptiveIntelligenceRouting(routing = {}) {
  const reasons = [];
  if (routing.routingVersion !== '1') reasons.push('adaptive_routing_version_invalid');
  if (!TYPED_BLOCKERS.has(routing.typedBlocker)) reasons.push('typed_blocker_invalid');
  if (routing.defaultTier !== 'low_cost_worker') reasons.push('low_cost_worker_must_be_default');
  if (!MODEL_TIERS.has(routing.currentTier)) reasons.push('current_model_tier_invalid');
  if (!ESCALATION_REASONS.has(routing.escalationReason)) reasons.push('escalation_reason_invalid');
  if (!DE_ESCALATION_REASONS.has(routing.deEscalationReason)) reasons.push('de_escalation_reason_invalid');
  if (Number(routing.maxEscalationsPerTask || 0) > 2) reasons.push('max_escalations_per_task_exceeded');
  if (Number(routing.maxRepairIterationsBeforeEscalation || 0) > 2) reasons.push('max_repair_iterations_before_escalation_exceeded');
  if (Number(routing.maxRepairIterationsTotal || 0) > 4) reasons.push('max_repair_iterations_total_exceeded');
  if (routing.authorityBoundary !== 'v1.1.8_final_decision_and_owner_boundaries_preserved') reasons.push('adaptive_routing_authority_boundary_changed');
  if (routing.highestTierUsed === true && routing.deEscalationReady === true && routing.hysteresis?.requireBoundedValidationAfterHighestTier !== true) reasons.push('highest_tier_deescalation_requires_bounded_validation');
  return reasons.length ? fail(reasons) : pass({ currentTier: routing.currentTier, typedBlocker: routing.typedBlocker });
}

export function validateReviewPoolPolicy(policy = {}) {
  const reasons = [];
  if (policy.reviewPoolVersion !== '1') reasons.push('review_pool_version_invalid');
  if (!REVIEWER_MODES.has(policy.reviewerMode)) reasons.push('reviewer_mode_invalid');
  if (Number(policy.maxReviewersDefault || 0) > 2) reasons.push('review_pool_default_max_two');
  if (Number(policy.maxReviewersHard || 0) > 3) reasons.push('review_pool_hard_max_three');
  if (policy.reviewerIndependenceRequired !== true) reasons.push('reviewer_independence_required');
  if (policy.sameWorkerSelfReviewCanPass !== false) reasons.push('same_worker_self_review_cannot_pass');
  if (policy.sameWorkerOutputCanSatisfyIndependentReview !== false) reasons.push('same_worker_output_cannot_satisfy_independent_review');
  if (policy.sameRepairLoopCanSelfAccept !== false) reasons.push('same_repair_loop_cannot_self_accept');
  if (policy.boundedContextPacketRequired !== true) reasons.push('reviewer_bounded_context_packet_required');
  if (policy.findingRequiresPrimaryClassOrCannotClassify !== true) reasons.push('reviewer_finding_requires_primary_class_or_cannot_classify');
  if (policy.reviewerCanApproveOwnerDecision !== false) reasons.push('reviewer_cannot_be_owner_approval');
  if (policy.reviewerCanSubmitGitHubApprovalReview !== false) reasons.push('reviewer_cannot_submit_github_approval_review');
  if (policy.reviewerCanClaimReadiness !== false) reasons.push('reviewer_cannot_claim_readiness');
  return reasons.length ? fail(reasons) : pass({ reviewerMode: policy.reviewerMode, currentReviewerCount: policy.currentReviewerCount });
}

export function validateModelTierBudget(budget = {}) {
  const reasons = [];
  if (Number(budget.maxWorkerContextTokens || 0) > 3000) reasons.push('worker_context_max_3000');
  if (Number(budget.maxSpecialistContextTokens || 0) > 5000) reasons.push('specialist_context_max_5000');
  if (Number(budget.maxHighestReviewerContextTokens || 0) > 8000) reasons.push('highest_reviewer_context_max_8000');
  if (budget.fullConversationAllowedForHighTier !== false) reasons.push('high_tier_full_conversation_forbidden_by_default');
  if (budget.rawLogsAllowedForHighTier !== false) reasons.push('high_tier_raw_logs_forbidden');
  if (budget.secretValuesAllowedForHighTier !== false) reasons.push('high_tier_secret_values_forbidden');
  if (budget.unrelatedRepoHistoryAllowedForHighTier !== false) reasons.push('high_tier_unrelated_history_forbidden');
  if (budget.passStatusDetail !== 'count_only') reasons.push('pass_status_detail_must_be_count_only');
  if (budget.routineProgressOutput !== 'silent') reasons.push('routine_progress_output_silent');
  return reasons.length ? fail(reasons) : pass({ maxHighestReviewerContextTokens: budget.maxHighestReviewerContextTokens });
}

export function validateAdaptiveMetrics(metrics = {}) {
  const reasons = [];
  if (metrics.metricsVersion !== '1') reasons.push('adaptive_metrics_version_invalid');
  for (const tierName of MODEL_TIERS) {
    if (Number(metrics.modelTierUsedCount?.[tierName] || 0) < 0) reasons.push(`adaptive_metrics_negative_${tierName}`);
  }
  if (metrics.rawLogsRead === true) reasons.push('adaptive_metrics_raw_logs_forbidden');
  if (!TOKEN_SAVINGS_CLASSES.has(metrics.estimatedTokenSavingsClass)) reasons.push('adaptive_metrics_token_savings_class_invalid');
  if (metrics.highestTierUsed === true && (!metrics.highestTierReason || metrics.highestTierReason === 'none')) reasons.push('highest_tier_metric_requires_reason');
  return reasons.length ? fail(reasons) : pass({ highestTierUsed: metrics.highestTierUsed === true, estimatedTokenSavingsClass: metrics.estimatedTokenSavingsClass || 'unknown' });
}

export function validateRoutingCalibration(calibration = {}) {
  const reasons = [];
  if (calibration.calibrationVersion !== '1') reasons.push('routing_calibration_version_invalid');
  if (!TYPED_BLOCKERS.has(calibration.typedBlocker)) reasons.push('routing_calibration_typed_blocker_invalid');
  if (calibration.defaultTier !== 'low_cost_worker') reasons.push('routing_calibration_default_tier_invalid');
  if (!MODEL_TIERS.has(calibration.currentTier)) reasons.push('routing_calibration_current_tier_invalid');
  if (!ESCALATION_REASONS.has(calibration.escalationReason)) reasons.push('routing_calibration_escalation_reason_invalid');
  if (calibration.currentTier === 'highest_reasoning_reviewer' && calibration.escalationWasRequired !== true) reasons.push('highest_tier_requires_required_escalation');
  if (calibration.currentTier === 'highest_reasoning_reviewer' && calibration.typedBlocker === 'none') reasons.push('highest_tier_requires_typed_blocker');
  if (calibration.escalationWasRequired === true && calibration.escalationReason !== 'none' && calibration.typedBlocker === 'none') reasons.push('escalation_requires_typed_blocker');
  if (calibration.overEscalationDetected === true && calibration.deEscalationReady !== true) reasons.push('over_escalation_requires_deescalation_ready');
  if (calibration.escalationEvidence !== 'safe_summary_only') reasons.push('routing_calibration_requires_safe_summary_evidence');
  return reasons.length ? fail(reasons) : pass({ currentTier: calibration.currentTier, overEscalationDetected: calibration.overEscalationDetected === true });
}

export function validateTargetScoreBaseline(baseline = {}) {
  const reasons = [];
  if (baseline.baselineVersion !== '1') reasons.push('target_score_baseline_version_invalid');
  if (Number(baseline.currentTargetQualityScore || 0) < Number(baseline.acceptedTargetQualityScore || 0) && baseline.scoreRegressionDetected !== true) reasons.push('target_score_regression_must_be_recorded');
  if (baseline.repairAllowedForScoreOnly === true) reasons.push('target_score_only_repair_forbidden');
  if (baseline.scoreImprovementRequired === true && baseline.reason === 'remote_pass_and_no_blocker') reasons.push('remote_pass_without_blocker_cannot_require_score_repair');
  return reasons.length ? fail(reasons) : pass({ currentTargetQualityScore: baseline.currentTargetQualityScore ?? null });
}

export function validateEvidenceFreshnessGuard(guard = {}) {
  const reasons = [];
  if (guard.freshnessVersion !== '1') reasons.push('evidence_freshness_version_invalid');
  if (guard.workflowSuccessRequiresSafeSummaryPass !== true) reasons.push('workflow_success_requires_safe_summary_pass');
  if (!SAFE_SUMMARY_STATUSES.has(guard.safeSummaryStatus)) reasons.push('safe_summary_status_invalid');
  if (guard.sameHead === false || guard.mergeEvidenceCoherent === false || guard.safeSummaryStatus === 'fail') {
    if (guard.evidenceDriftDetected !== true) reasons.push('evidence_drift_must_be_recorded');
  }
  return reasons.length ? fail(reasons) : pass({ evidenceDriftDetected: guard.evidenceDriftDetected === true });
}

export function validateOrchestrationCapsule(capsule = {}) {
  const modeOk = ORCHESTRATION_MODES.has(capsule.orchestrationMode) && capsule.finalAuthority === 'v1.1.8_final_decision_kernel';
  return {
    orchestrationModeStatus: status(modeOk, ['orchestration_mode_invalid_or_final_authority_changed'], { orchestrationMode: capsule.orchestrationMode }),
    permissionGrantStatus: validatePermissionGrant(capsule.permissionGrant || {}),
    localRepoReadinessStatus: validateLocalRepoReadiness(capsule.localRepoReadiness || {}),
    workerContractStatus: validateWorkerContract(capsule.workerContract || {}),
    reviewAgentContractStatus: validateReviewAgentContract(capsule.reviewAgentContract || {}, capsule.workerContract || {}),
    adaptiveRoutingInternalStatus: validateAdaptiveIntelligenceRouting(capsule.adaptiveIntelligenceRouting || {}),
    reviewPoolInternalStatus: validateReviewPoolPolicy(capsule.reviewPoolPolicy || {}),
    modelTierBudgetInternalStatus: validateModelTierBudget(capsule.modelTierBudget || {}),
    adaptiveMetricsInternalStatus: validateAdaptiveMetrics(capsule.adaptiveMetrics || {}),
    routingCalibrationInternalStatus: validateRoutingCalibration(capsule.routingCalibration || {}),
    targetScoreBaselineInternalStatus: validateTargetScoreBaseline(capsule.targetScoreBaseline || {}),
    evidenceFreshnessGuardInternalStatus: validateEvidenceFreshnessGuard(capsule.evidenceFreshnessGuard || {}),
  };
}

export function buildOrchestrationReport(input = {}) {
  const capsule = buildOrchestrationCapsule(input);
  return {
    orchestrationCapsule: capsule,
    ...validateOrchestrationCapsule(capsule),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildOrchestrationReport();
  if (process.env.CODEX_ORCHESTRATION_CAPSULE_PATH) {
    fs.writeFileSync(process.env.CODEX_ORCHESTRATION_CAPSULE_PATH, JSON.stringify(report.orchestrationCapsule, null, 2));
  }
  writeJsonReport({ orchestrationModeStatus: report.orchestrationModeStatus, ...report, status: Object.values(validateOrchestrationCapsule(report.orchestrationCapsule)).every((item) => item.status === 'pass') ? 'pass' : 'fail', safeSummaryOnly: true }, 'CODEX_ORCHESTRATION_CAPSULE_REPORT');
  exitFor({ status: Object.values(validateOrchestrationCapsule(report.orchestrationCapsule)).every((item) => item.status === 'pass') ? 'pass' : 'fail' });
}
