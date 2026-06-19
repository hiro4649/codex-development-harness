#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.7

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
export const V122_OPERATOR_STATUS_KEYS = V119_OPERATOR_STATUS_KEYS;
export const V122_P0_ARTIFACTS = V119_P0_ARTIFACTS;
export const V123_OPERATOR_STATUS_KEYS = V119_OPERATOR_STATUS_KEYS;
export const V123_P0_ARTIFACTS = V119_P0_ARTIFACTS;
export const V124_OPERATOR_STATUS_KEYS = V119_OPERATOR_STATUS_KEYS;
export const V124_P0_ARTIFACTS = V119_P0_ARTIFACTS;
export const V125_OPERATOR_STATUS_KEYS = V119_OPERATOR_STATUS_KEYS;
export const V125_P0_ARTIFACTS = V119_P0_ARTIFACTS;
export const V126_OPERATOR_STATUS_KEYS = V119_OPERATOR_STATUS_KEYS;
export const V126_P0_ARTIFACTS = V119_P0_ARTIFACTS;
export const V127_OPERATOR_STATUS_KEYS = V119_OPERATOR_STATUS_KEYS;
export const V127_P0_ARTIFACTS = V119_P0_ARTIFACTS;

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
const TASK_PROFILES = new Set(['routine', 'metadata_light', 'target_rollout', 'incident_triage', 'harness_source_body', 'compatibility_repair']);
const READ_BUDGET_STATUS = new Set(['pass', 'warn', 'blocked']);
const CONTEXT_SOURCE_TYPES = new Set(['agentsMd', 'manifest', 'activeSpec', 'legacySpec', 'readme', 'skill', 'prHistory', 'safeArtifact', 'userProvidedText', 'webOrGitHubMetadata']);
const HARD_CONTEXT_BLOCKERS = new Set(['raw_logs_read', 'full_history_read_without_scope', 'wrong_profile_skill', 'legacy_spec_overread_active_conflict']);
const READ_BUDGET_BY_TASK_PROFILE = {
  routine: { mdFilesReadMax: 3, selectedSkillsMax: 2 },
  metadata_light: { mdFilesReadMax: 2, selectedSkillsMax: 1 },
  target_rollout: { mdFilesReadMax: 4, selectedSkillsMax: 2 },
  incident_triage: { mdFilesReadMax: 5, selectedSkillsMax: 3 },
  harness_source_body: { mdFilesReadMax: 6, selectedSkillsMax: 3 },
  compatibility_repair: { mdFilesReadMax: 6, selectedSkillsMax: 3 },
};
const FINAL_DECISION_PHASES = new Set(['create_pr_only', 'remote_validation', 'merge_consideration', 'post_merge_verify', 'preserve_only']);
const FINAL_DECISION_TERMINAL_ACTIONS = new Set(['create_pr_only', 'merge_current_pr', 'preserve_only', 'investigate_only', 'stop']);
const TARGET_QUALITY_STATUSES = new Set(['pass', 'fail', 'pending', 'not_required']);
const SAME_HEAD_REMOTE_GATE_STATUSES = new Set(['pass', 'fail', 'pending', 'not_required']);
const MERGE_SCOPE_STATUSES = new Set(['valid', 'missing', 'not_required_for_phase']);
const CLOSURE_STATUSES = new Set(['pass', 'inconsistent', 'blocked_with_reason']);
const CLOSURE_REASONS = new Set(['phase_create_pr_only', 'remote_gate_missing', 'owner_merge_decision_missing', 'delegated_scope_missing', 'decision_closure_inconsistent', 'merge_allowed', 'preserve_only', 'none']);
const OWNER_AUTHORITY_STATES = new Set(['not_required_for_current_scope', 'required', 'already_delegated_current_only']);
const GOAL_COMPLETION_STATUSES = new Set(['pass', 'blocked', 'owner_only']);
const LOOP_EXIT_REASONS = new Set(['goal_met', 'owner_boundary', 'no_new_evidence', 'same_root_cause_repeated', 'budget_exceeded', 'validation_regressed', 'none']);
const EVIDENCE_PHASES = new Set(['pre_pr', 'post_pr_current_head', 'post_merge']);
const PASS_MEANINGS = new Set(['local_validation_only', 'same_head_remote_validation', 'merge_policy_only', 'runtime_evidence', 'owner_authority', 'none']);
const REPAIR_SCOPES = new Set(['none', 'harness_only', 'docs_only', 'product_requires_owner_scope', 'stop_only']);
const GOAL_SHARD_PHASES = new Set(['plan', 'implement', 'verify', 'repair', 'finalize']);
const GOAL_SHARD_ROLES = new Set(['planner', 'implementer', 'verifier', 'arbiter']);
const GOAL_VALIDATION_TIERS = new Set(['static_check', 'typed_script', 'local_gate', 'remote_gate']);
const QG_LANES = new Set(['local_pre_pr', 'pushed_pr_waiting_qg', 'same_head_remote_qg', 'post_merge_sentinel']);
const QG_TERMINAL_PHASES = new Set(['create_pr_only', 'remote_validation', 'merge_consideration', 'post_merge_verify']);
const TYPED_MONITOR_ROLES = new Set(['monitor', 'planner', 'reviewer', 'verifier', 'arbiter', 'owner', 'automation']);
const TYPED_MONITOR_TARGETS = new Set(['builder', 'reviewer', 'verifier', 'arbiter', 'owner_brief']);
const TYPED_MONITOR_MESSAGES = new Set(['task_delta', 'blocker_report', 'review_finding', 'evidence_pointer', 'stop_signal', 'merge_queue_update']);
const TYPED_MONITOR_AUTHORITY = new Set(['advisory', 'delegated_scope', 'owner_only']);
const FANOUT_ROI_STATUSES = new Set(['positive', 'neutral', 'negative', 'unknown']);
const PRODUCT_VALUE_DELTAS = new Set(['none', 'evidence_only', 'developer_velocity', 'admin_workflow', 'user_visible_runtime', 'p0_vertical_slice']);
const V126_OWNER_ACTIONS = new Set(['none', 'merge_current_pr', 'create_pr_only', 'rerun_ci', 'stop']);
const V126_OWNER_SCOPES = new Set(['none', 'source_harness_body', 'harness_only', 'product_repair', 'token_only_metadata', 'docs_only', 'metadata_light']);
const V126_FORBIDDEN_AUTHORIZATIONS = ['release', 'deploy', 'wallet_rpc', 'secret_access', 'readiness_claim', 'github_approval_review'];
const V126_LOOP_EXIT_REASONS = new Set(['not_started', 'all_green', 'same_failure_repeated', 'regression_detected', 'cycle_budget_exceeded', 'owner_boundary', 'scope_boundary']);
const V126_LANE_STATES = new Set(['local_pre_pr', 'pushed_pr_waiting_qg', 'same_head_remote_qg', 'merge_consideration', 'post_merge_sentinel']);
const V126_REMOTE_STATUSES = new Set(['missing', 'pending', 'pass', 'fail', 'not_required']);
const V126_VALIDATION_TIERS = new Set(['static_check', 'typed_script', 'focused_test', 'local_gate', 'remote_gate', 'full_ci']);
const V126_SKILL_NET_VALUES = new Set(['positive', 'neutral', 'negative', 'unknown']);
const V127_OWNER_INTENTS = new Set(['none', 'harness_source_develop_and_publish', 'harness_target_rollout_complete', 'merge_specific_current_pr', 'product_development_only', 'runtime_operation', 'release_or_deploy']);
const V127_RECEIPT_ACTIONS = new Set(['edit', 'check', 'commit', 'push', 'create_pr', 'rerun_ci', 'fix_ci']);
const V127_CONDITIONAL_MERGE_SCOPES = new Set(['none', 'exact_head', 'conditional_final_head']);
const V127_CONTINUATION_STATES = new Set(['continue', 'justified_owner_boundary', 'blocked', 'clarify_once']);
const V127_LANES = new Set(['local_pre_pr', 'pushed_pr_waiting_qg', 'same_head_remote_qg', 'merge_boundary', 'post_merge_sentinel', 'blocked_recovery']);
const V127_ALLOWED_NEXT_ACTIONS = new Set(['continue_commit_push_create_pr', 'wait_for_remote_gate', 'owner_merge_decision_only', 'merge_current_pr', 'refresh_evidence_only', 'repair_harness_only', 'owner_boundary_stop', 'post_merge_verify']);
const V127_REMOTE_STATUSES = new Set(['missing', 'pending', 'pass', 'fail', 'not_required']);
const V127_BLOCKER_RECOVERIES = new Set(['none', 'refresh_current_head_evidence_only', 'rerun_same_head_remote_gate', 'repair_harness_only', 'owner_boundary_stop', 'reduce_context_and_retry', 'stop_required_check_failure']);
const V127_SKILL_ROI = new Set(['positive', 'neutral', 'negative', 'mandatory_safety']);
const V127_PLACEHOLDER_VALUES = new Set(['', 'unknown', 'required', 'none', 'null']);
const CONTEXT_LEDGER_STATUSES = new Set(['pass', 'warn', 'blocked']);
const OBSERVED_CONTEXT_SOURCE_TYPES = new Set(['agentsMd', 'manifest', 'activeSpec', 'skill', 'readme', 'legacySpec', 'prHistory', 'safeArtifact', 'githubMetadata', 'rawLog', 'fullHistory']);
const OBSERVED_READ_REASONS = new Set(['active_authority', 'task_profile_required', 'safe_artifact_pointer', 'compatibility_failure', 'authority_conflict', 'owner_requested', 'not_recorded']);
const SKILL_EFFECTIVENESS_STATUSES = new Set(['pass', 'warn', 'blocked']);
const SKILL_CONTRIBUTIONS = new Set(['useful', 'neutral', 'harmful', 'unknown']);
const SKILL_DECISION_IMPACTS = new Set(['blocked_forbidden_action', 'shortened_validation', 'reduced_md_reads', 'review_primary_class', 'owner_question_reduced', 'no_effect', 'unknown']);
const ESCALATION_EFFECTIVENESS_STATUSES = new Set(['effective', 'neutral', 'harmful', 'unknown', 'not_used']);
const ESCALATED_AGENT_ROLES = new Set(['none', 'specialist_reviewer', 'highest_reasoning_reviewer']);

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

function normalizeContextSources(input = {}) {
  const output = {};
  for (const type of CONTEXT_SOURCE_TYPES) {
    output[type] = input[type] || (type === 'agentsMd' || type === 'manifest' || type === 'activeSpec' ? 'required' : 'conditional');
  }
  output.prHistory = input.prHistory || 'pointer_only';
  output.safeArtifact = input.safeArtifact || 'preferred';
  output.userProvidedText = input.userProvidedText || 'not_counted_as_file_read';
  output.webOrGitHubMetadata = input.webOrGitHubMetadata || 'evidence_source';
  return output;
}

function defaultActiveAuthorityTuple(input = {}) {
  return {
    agentsMarker: input.agentsMarker || 'CODEX_QUALITY_HARNESS_FILE v1.2.7',
    manifestActiveHarnessVersion: input.manifestActiveHarnessVersion || '1.2.7',
    activeSelfTestSuite: input.activeSelfTestSuite || 'v127',
    activeSpecPath: input.activeSpecPath || 'docs/process/CODEX_V127_SPEC.md',
    finalAuthorityPointer: input.finalAuthorityPointer || 'v1.1.8_final_decision_kernel',
    sourceOnlyRelease: input.sourceOnlyRelease !== false,
  };
}

function defaultSkillContextRouting(input = {}) {
  const taskProfile = TASK_PROFILES.has(input.taskProfile) ? input.taskProfile : 'routine';
  const budget = READ_BUDGET_BY_TASK_PROFILE[taskProfile];
  const selectedSkills = truncateList(input.selectedSkills || [], 5);
  const mdFilesRead = truncateList(input.mdFilesRead || [], 10);
  const selectedSkillsMax = budget.selectedSkillsMax;
  const mdFilesReadMax = budget.mdFilesReadMax;
  const requestedSelectedSkillsMax = Number(input.selectedSkillsMax || selectedSkillsMax);
  const requestedMdFilesReadMax = Number(input.mdFilesReadMax || mdFilesReadMax);
  const blockerClasses = truncateList(input.blockerClasses || [], 10);
  const selectedSkillsOverBudget = selectedSkills.length > selectedSkillsMax;
  const mdFilesReadOverBudget = mdFilesRead.length > mdFilesReadMax;
  const typedJustificationPresent = Boolean(input.typedJustification);
  const safeNextAction = input.skillContextSafeNextAction || input.safeNextAction || 'one_action';
  const tokenBudgetStatus = input.tokenBudgetStatus || 'pass';
  const budgetOverrideAttempted = requestedSelectedSkillsMax > selectedSkillsMax || requestedMdFilesReadMax > mdFilesReadMax;
  const thirdSkillPermitted = input.thirdSkillAllowed === true && typedJustificationPresent && selectedSkillsMax >= 3 && tokenBudgetStatus === 'pass' && safeNextAction === 'one_action';
  const thirdSkillMissingGuard = selectedSkills.length >= 3 && !thirdSkillPermitted;
  const smallOverreadWithJustification = mdFilesReadOverBudget && typedJustificationPresent && input.readBudgetStatus !== 'blocked';
  const hardBlocked = blockerClasses.some((item) => HARD_CONTEXT_BLOCKERS.has(item));
  const inferredStatus = hardBlocked || budgetOverrideAttempted || selectedSkillsOverBudget || thirdSkillMissingGuard
    ? 'blocked'
    : smallOverreadWithJustification
      ? 'warn'
      : mdFilesReadOverBudget
        ? 'blocked'
        : 'pass';
  return {
    schemaVersion: input.schemaVersion || '1.2.7',
    taskProfile,
    selectedSkills,
    rejectedSkills: truncateList(input.rejectedSkills || [], 10),
    mdFilesRead,
    mdFilesRejected: truncateList(input.mdFilesRejected || [], 20),
    requiredFirstReads: truncateList(input.requiredFirstReads || ['AGENTS.md', 'docs/process/CODEX_HARNESS_MANIFEST.json', 'docs/process/CODEX_V127_SPEC.md'], 8),
    deferredReads: truncateList(input.deferredReads || ['README.md', 'legacy_specs', 'pr_history_docs'], 12),
    forbiddenReads: truncateList(input.forbiddenReads || ['raw_logs', 'full_history_without_scope'], 12),
    contextSourceType: normalizeContextSources(input.contextSourceType || {}),
    actualReadObserved: truncateList(input.actualReadObserved || [], 20),
    declaredContextUse: truncateList(input.declaredContextUse || [], 20),
    ownerProvidedContext: {
      present: input.ownerProvidedContext?.present === true,
      countedAsFileRead: false,
    },
    safeArtifactPointerUse: {
      used: input.safeArtifactPointerUse?.used === true || input.safeArtifactPointerUsed === true,
      pointerOnly: input.safeArtifactPointerUse?.pointerOnly !== false,
    },
    skillTokenBudget: Math.max(1, Number(input.skillTokenBudget || 1200)),
    mdTokenBudget: Math.max(1, Number(input.mdTokenBudget || 2000)),
    tokenBudgetStatus,
    selectedSkillsMax,
    mdFilesReadMax,
    requestedSelectedSkillsMax,
    requestedMdFilesReadMax,
    budgetOverrideAttempted,
    thirdSkillAllowed: thirdSkillPermitted,
    typedJustification: input.typedJustification || null,
    profileIdOnlyMode: input.profileIdOnlyMode !== false,
    repeatedForbiddenTextSuppressed: input.repeatedForbiddenTextSuppressed !== false,
    skillMisfireDetected: input.skillMisfireDetected === true,
    skillMisfireReason: input.skillMisfireReason || 'none',
    legacySpecReadAllowed: input.legacySpecReadAllowed === true,
    legacySpecReadReason: input.legacySpecReadReason || 'none',
    fullHistoryReadAllowed: input.fullHistoryReadAllowed === true,
    readBudgetStatus: READ_BUDGET_STATUS.has(input.readBudgetStatus) ? input.readBudgetStatus : inferredStatus,
    blockerClasses,
    activeAuthorityTuple: defaultActiveAuthorityTuple(input.activeAuthorityTuple || input),
    sourceHardFail: input.sourceHardFail === true,
    targetAdvisoryOnly: input.targetAdvisoryOnly === true,
    safeNextAction: input.skillContextSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultFinalDecisionClosure(input = {}) {
  const phase = FINAL_DECISION_PHASES.has(input.phase) ? input.phase : 'create_pr_only';
  const terminalAction = FINAL_DECISION_TERMINAL_ACTIONS.has(input.terminalAction) ? input.terminalAction : 'create_pr_only';
  const mergeAllowed = input.mergeAllowed === true;
  const targetQualityStatus = TARGET_QUALITY_STATUSES.has(input.targetQualityStatus) ? input.targetQualityStatus : 'not_required';
  const blockingReasonsCount = Math.max(0, Number(input.blockingReasonsCount || 0));
  const sameHeadRemoteGate = SAME_HEAD_REMOTE_GATE_STATUSES.has(input.sameHeadRemoteGate) ? input.sameHeadRemoteGate : 'not_required';
  const ownerOrDelegatedMergeScope = MERGE_SCOPE_STATUSES.has(input.ownerOrDelegatedMergeScope) ? input.ownerOrDelegatedMergeScope : 'not_required_for_phase';
  const mergeReadyButFalse = phase === 'merge_consideration'
    && sameHeadRemoteGate === 'pass'
    && targetQualityStatus === 'pass'
    && blockingReasonsCount === 0
    && ownerOrDelegatedMergeScope === 'valid'
    && mergeAllowed === false;
  const inferredReason = input.singleClosureReason
    || (mergeAllowed ? 'merge_allowed'
      : mergeReadyButFalse ? 'decision_closure_inconsistent'
        : phase === 'create_pr_only' ? 'phase_create_pr_only'
          : sameHeadRemoteGate !== 'pass' ? 'remote_gate_missing'
            : ownerOrDelegatedMergeScope === 'missing' ? 'owner_merge_decision_missing'
              : phase === 'preserve_only' ? 'preserve_only'
                : 'none');
  const closureStatus = CLOSURE_STATUSES.has(input.closureStatus)
    ? input.closureStatus
    : (inferredReason === 'decision_closure_inconsistent' ? 'inconsistent' : 'pass');
  return {
    closureVersion: '1.2.4',
    phase,
    terminalAction,
    mergeAllowed,
    targetQualityStatus,
    blockingReasonsCount,
    sameHeadRemoteGate,
    ownerOrDelegatedMergeScope,
    closureStatus,
    singleClosureReason: CLOSURE_REASONS.has(inferredReason) ? inferredReason : 'none',
    safeNextAction: input.finalDecisionClosureSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultWorkspaceIdentityGate(input = {}) {
  const mutationTask = input.mutationTask === true;
  const readOnlyAudit = input.readOnlyAudit === true || input.taskMode === 'read_only_audit';
  const worktreeClean = input.worktreeClean !== false;
  const repoResolvableOnGitHub = input.repoResolvableOnGitHub !== false;
  const wrongRepo = input.wrongRepo === true;
  const frozenBranchUsed = input.frozenBranchUsed === true;
  const localOnlyState = input.localOnlyState === true;
  const dirtyAllowed = input.dirtyWorktreePreservationScope === true;
  const blocked = (wrongRepo && !readOnlyAudit)
    || frozenBranchUsed
    || (mutationTask && repoResolvableOnGitHub === false)
    || (mutationTask && localOnlyState)
    || (mutationTask && worktreeClean === false && !dirtyAllowed);
  const warn = !blocked && (wrongRepo || repoResolvableOnGitHub === false || worktreeClean === false || localOnlyState);
  return {
    workspaceIdentityVersion: '1.2.7',
    expectedRepo: input.expectedRepo || input.repo || 'hiro4649/codex-development-harness',
    actualRemoteUrl: input.actualRemoteUrl || 'safe_url_or_hash',
    defaultBranch: input.defaultBranch || 'main',
    currentBranch: input.currentBranch || input.branch || 'unknown',
    headSha: input.headSha || null,
    agentsMarker: input.agentsMarker || 'CODEX_QUALITY_HARNESS_FILE v1.2.7',
    manifestActiveHarnessVersion: input.manifestActiveHarnessVersion || '1.2.7',
    mutationTask,
    readOnlyAudit,
    worktreeClean,
    repoResolvableOnGitHub,
    frozenBranchUsed,
    localOnlyState,
    wrongRepo,
    dirtyWorktreePreservationScope: dirtyAllowed,
    workspaceIdentityStatus: blocked ? 'blocked' : (warn ? 'warn' : 'pass'),
    safeNextAction: input.workspaceIdentitySafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultActivePolicyIndex(input = {}) {
  return {
    schemaVersion: '1.2.7',
    indexPath: input.indexPath || 'docs/process/CODEX_ACTIVE_POLICY_INDEX.json',
    taskProfile: TASK_PROFILES.has(input.taskProfile) ? input.taskProfile : 'routine',
    requiredReads: truncateList(input.requiredReads || ['AGENTS.md', 'docs/process/CODEX_HARNESS_MANIFEST.json', 'docs/process/CODEX_V127_SPEC.md'], 8),
    allowedConditionalReads: truncateList(input.allowedConditionalReads || [], 8),
    forbiddenByDefault: truncateList(input.forbiddenByDefault || ['README.md', 'legacy_specs', 'pr_history_docs'], 8),
    selectedSkillsMax: Math.max(0, Number(input.selectedSkillsMax || 2)),
    mdFilesReadMax: Math.max(0, Number(input.mdFilesReadMax || 3)),
    activePolicyIndexStatus: input.activePolicyIndexStatus || 'pass',
    safeNextAction: input.activePolicyIndexSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function normalizeObservedReads(values = []) {
  return Array.isArray(values) ? values.slice(0, 20).map((item) => ({
    sourceType: OBSERVED_CONTEXT_SOURCE_TYPES.has(item?.sourceType) ? item.sourceType : 'safeArtifact',
    pathOrRef: String(item?.pathOrRef || 'safe_identifier'),
    readReason: OBSERVED_READ_REASONS.has(item?.readReason) ? item.readReason : 'not_recorded',
    taskProfile: TASK_PROFILES.has(item?.taskProfile) ? item.taskProfile : 'routine',
    countsTowardBudget: item?.countsTowardBudget !== false,
  })) : [];
}

function defaultContextReadLedger(input = {}) {
  const observedToolReads = normalizeObservedReads(input.observedToolReads || []);
  const observedButUndeclaredUse = truncateList(input.observedButUndeclaredUse || [], 20);
  const hardObserved = observedToolReads.some((item) => ['rawLog', 'fullHistory'].includes(item.sourceType)
    || (item.sourceType === 'legacySpec' && !['compatibility_failure', 'authority_conflict'].includes(item.readReason))
    || (item.sourceType === 'prHistory' && !['safe_artifact_pointer', 'owner_requested'].includes(item.readReason)));
  const blocked = hardObserved || observedButUndeclaredUse.some((item) => ['rawLog', 'legacySpec', 'prHistory', 'fullHistory', 'forbiddenSkill'].includes(item));
  const softObserved = (Array.isArray(input.unobservedDeclaredUse) && input.unobservedDeclaredUse.length > 0)
    || observedButUndeclaredUse.some((item) => !['rawLog', 'legacySpec', 'prHistory', 'fullHistory', 'forbiddenSkill'].includes(item));
  return {
    ledgerVersion: '1.2.3',
    observedToolReads,
    declaredContextUse: truncateList(input.declaredContextUse || [], 20),
    ownerProvidedContext: {
      present: input.ownerProvidedContext?.present === true,
      countedAsFileRead: false,
    },
    unobservedDeclaredUse: truncateList(input.unobservedDeclaredUse || [], 20),
    observedButUndeclaredUse,
    contextLedgerStatus: blocked ? 'blocked' : (softObserved ? 'warn' : (input.contextLedgerStatus || 'pass')),
    safeNextAction: input.contextLedgerSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function normalizeSkillContracts(values = []) {
  return Array.isArray(values) ? values.slice(0, 12).map((contract) => ({
    schemaVersion: contract?.schemaVersion || 'skill-contract-v2',
    skillId: String(contract?.skillId || ''),
    allowed_repo_profiles: truncateList(contract?.allowed_repo_profiles || [], 20),
    forbidden_repo_profiles: truncateList(contract?.forbidden_repo_profiles || [], 20),
    task_profiles: truncateList(contract?.task_profiles || [], 20),
    max_context_tokens: Math.max(0, Number(contract?.max_context_tokens || 0)),
    when_to_use: truncateList(contract?.when_to_use || [], 20),
    when_not_to_use: truncateList(contract?.when_not_to_use || [], 20),
    required_artifacts: truncateList(contract?.required_artifacts || [], 20),
    forbidden_actions: truncateList(contract?.forbidden_actions || [], 20),
    artifact_pointer_first: contract?.artifact_pointer_first === true,
    raw_logs_forbidden: contract?.raw_logs_forbidden === true,
    owner_decision_boundary: contract?.owner_decision_boundary === true,
    output_contract: contract?.output_contract || null,
  })) : [];
}

function defaultSkillContractRegistry(input = {}) {
  return {
    registryVersion: '1.2.3',
    currentRepoProfile: input.currentRepoProfile || input.repoProfile || 'source_harness',
    selectedSkillIds: truncateList(input.selectedSkillIds || input.selectedSkills || [], 8),
    contracts: normalizeSkillContracts(input.contracts || []),
    selectedSkillContractRequired: input.selectedSkillContractRequired !== false,
    skillContractStatus: input.skillContractStatus || 'pass',
    safeNextAction: input.skillContractSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function normalizeSkillUseRecords(values = []) {
  return Array.isArray(values) ? values.slice(0, 12).map((record) => ({
    skillId: String(record?.skillId || ''),
    selectionReason: record?.selectionReason || 'task_profile_match',
    repoProfile: record?.repoProfile || 'source_harness',
    taskProfile: TASK_PROFILES.has(record?.taskProfile) ? record.taskProfile : 'routine',
    contribution: SKILL_CONTRIBUTIONS.has(record?.contribution) ? record.contribution : 'unknown',
    detectedIssue: record?.detectedIssue || 'none',
    decisionImpact: SKILL_DECISION_IMPACTS.has(record?.decisionImpact) ? record.decisionImpact : 'unknown',
    misfireDetected: record?.misfireDetected === true,
    misfireReason: record?.misfireReason || 'none',
    forbiddenActionRecommended: record?.forbiddenActionRecommended === true,
  })) : [];
}

function defaultSkillEffectivenessLedger(input = {}) {
  const records = normalizeSkillUseRecords(input.skillUseRecords || []);
  const blocked = records.some((record) => record.misfireDetected || record.forbiddenActionRecommended || record.contribution === 'harmful');
  const unknown = records.some((record) => record.contribution === 'unknown' || record.decisionImpact === 'unknown');
  const sourceHard = input.sourceHard === true;
  return {
    ledgerVersion: '1.2.3',
    selectedSkills: truncateList(input.selectedSkills || [], 8),
    rejectedSkills: truncateList(input.rejectedSkills || [], 12),
    skillUseRecords: records,
    sourceHard,
    skillEffectivenessStatus: blocked ? 'blocked' : (unknown ? (sourceHard ? 'blocked' : 'warn') : (input.skillEffectivenessStatus || 'pass')),
    safeNextAction: input.skillEffectivenessSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultEscalationEffectivenessLedger(input = {}) {
  const highTierUsed = input.highTierUsed === true || input.escalatedAgentRole === 'highest_reasoning_reviewer';
  const escalatedAgentRole = ESCALATED_AGENT_ROLES.has(input.escalatedAgentRole) ? input.escalatedAgentRole : (highTierUsed ? 'highest_reasoning_reviewer' : 'none');
  const escalationUsed = escalatedAgentRole !== 'none' || (input.escalationReason && input.escalationReason !== 'none');
  const newFindingProduced = input.newFindingProduced === true;
  const repairPlanChanged = input.repairPlanChanged === true;
  const validationImproved = input.validationImproved === true;
  const sameRootCauseResolved = input.sameRootCauseResolved === true;
  const effective = newFindingProduced || repairPlanChanged || validationImproved || sameRootCauseResolved;
  const noSignalAfterHighTier = highTierUsed && !effective;
  const sameRootCauseRepeatCount = Math.max(0, Number(input.sameRootCauseRepeatCount || 0));
  return {
    ledgerVersion: '1.2.3',
    beforeEscalationBlocker: TYPED_BLOCKERS.has(input.beforeEscalationBlocker) ? input.beforeEscalationBlocker : (TYPED_BLOCKERS.has(input.typedBlocker) ? input.typedBlocker : 'none'),
    escalationReason: ESCALATION_REASONS.has(input.escalationReason) ? input.escalationReason : 'none',
    escalatedAgentRole,
    inputContextPacket: {
      fullConversationUsed: input.inputContextPacket?.fullConversationUsed === true,
      rawLogsUsed: input.inputContextPacket?.rawLogsUsed === true,
      safeArtifactsUsed: truncateList(input.inputContextPacket?.safeArtifactsUsed || [], 8),
      mdFilesUsed: truncateList(input.inputContextPacket?.mdFilesUsed || [], 8),
      changedFileExcerptsUsed: input.inputContextPacket?.changedFileExcerptsUsed !== false,
    },
    newFindingProduced,
    repairPlanChanged,
    validationImproved,
    sameRootCauseResolved,
    sameRootCauseRepeatCount,
    deEscalationResult: input.deEscalationResult || (highTierUsed ? 'stopped' : 'returned_to_low_cost_worker'),
    effectivenessStatus: noSignalAfterHighTier ? 'neutral' : (escalationUsed ? (effective ? 'effective' : 'neutral') : 'not_used'),
    safeNextAction: noSignalAfterHighTier ? 'stop_escalation_no_new_information' : (input.escalationEffectivenessSafeNextAction || input.safeNextAction || 'one_action'),
  };
}

function defaultGoalContract(input = {}) {
  const terminalAction = FINAL_DECISION_TERMINAL_ACTIONS.has(input.terminalAction) ? input.terminalAction : 'create_pr_only';
  const nonDelegableActions = truncateList(input.nonDelegableActions || [
    'release',
    'deploy',
    'wallet_rpc',
    'secret_access',
    'funded_transaction',
    'governance_transaction',
    'bscscan_verification',
    'production_readiness_claim',
    'legal_compliance_claim',
    'youtube_policy_claim',
  ], 20);
  const requiredEvidence = truncateList(input.requiredEvidence || ['v124_self_test', 'source_local_quality_gate'], 12);
  const verificationPlan = truncateList(input.verificationPlan || ['run_v124_self_test', 'run_source_local_quality_gate'], 12);
  return {
    goalContractVersion: '1.2.4',
    goalId: input.goalId || 'source_harness_v124_body',
    ownerScopeId: input.ownerScopeId || null,
    terminalAction,
    delegableActions: truncateList(input.delegableActions || ['technical_evaluation', 'safe_next_action'], 12),
    nonDelegableActions,
    desiredEndState: input.desiredEndState || 'source_harness_v124_body_pr_created',
    successCriteria: truncateList(input.successCriteria || [
      'existing_p0_artifacts_only',
      'v118_final_decision_authority_preserved',
      'v119_status_surface_preserved',
      'v124_self_test_pass',
    ], 12),
    requiredEvidence,
    forbiddenShortcuts: truncateList(input.forbiddenShortcuts || ['owner_authority_creation', 'pr_body_machine_evidence', 'unbounded_loop'], 12),
    verificationPlan,
    timeOrTurnBudget: input.timeOrTurnBudget || 'bounded',
    costBudget: input.costBudget || 'medium',
    stopCondition: GOAL_COMPLETION_STATUSES.has(input.stopCondition) ? input.stopCondition : 'owner_only',
    safeNextAction: input.goalSafeNextAction || input.safeNextAction || 'one_action',
    goalCompletionProof: {
      successCriteriaSatisfied: input.goalCompletionProof?.successCriteriaSatisfied === true,
      requiredEvidenceSatisfied: input.goalCompletionProof?.requiredEvidenceSatisfied === true,
      forbiddenShortcutsAbsent: input.goalCompletionProof?.forbiddenShortcutsAbsent !== false,
      verificationPlanExecuted: input.goalCompletionProof?.verificationPlanExecuted === true,
      remainingUnverifiedClaims: truncateList(input.goalCompletionProof?.remainingUnverifiedClaims || [], 10),
      completionStatus: GOAL_COMPLETION_STATUSES.has(input.goalCompletionProof?.completionStatus) ? input.goalCompletionProof.completionStatus : 'blocked',
    },
  };
}

function defaultDelegationBoundary(input = {}) {
  const ownerAuthorityState = OWNER_AUTHORITY_STATES.has(input.ownerAuthorityState) ? input.ownerAuthorityState : 'not_required_for_current_scope';
  return {
    delegationBoundaryVersion: '1.2.4',
    delegationScope: input.delegationScope || 'technical_evaluation_and_safe_next_action',
    ownerAuthorityState,
    ownerAuthorityCreatedByAI: input.ownerAuthorityCreatedByAI === true,
    ownerOnlyAuthorityBypassed: input.ownerOnlyAuthorityBypassed === true,
    expertJudgmentCanMerge: input.expertJudgmentCanMerge === true,
    expertJudgmentCanRelease: input.expertJudgmentCanRelease === true,
    expertJudgmentCanClaimReadiness: input.expertJudgmentCanClaimReadiness === true,
    agentFindingsConverged: input.agentFindingsConverged !== false,
    finalDecisionClosureAdapter: {
      adapterVersion: '1.2.4',
      finalAuthority: 'v1.1.8_final_decision_kernel',
      createsFinalAuthority: false,
      normalizedInputs: truncateList(input.finalDecisionClosureAdapter?.normalizedInputs || ['goal', 'delegation', 'evidence', 'blocker'], 8),
    },
    delegationRevocation: {
      revoked: input.delegationRevocation?.revoked === true,
      revocationReason: input.delegationRevocation?.revocationReason || 'none',
      continueAllowed: input.delegationRevocation?.continueAllowed !== false,
    },
    expertDisagreement: {
      disagreementDetected: input.expertDisagreement?.disagreementDetected === true,
      disagreementType: input.expertDisagreement?.disagreementType || 'none',
      arbiterAction: input.expertDisagreement?.arbiterAction || 'continue_with_lower_risk_path',
      safeNextAction: input.expertDisagreement?.safeNextAction || 'one_action',
    },
    safeNextAction: input.delegationSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultEvidenceSemanticsKernel(input = {}) {
  const phase = EVIDENCE_PHASES.has(input.phase) ? input.phase : 'pre_pr';
  return {
    evidenceSemanticsVersion: '1.2.4',
    evidencePhase: {
      phase,
      committedEvidenceMode: input.committedEvidenceMode || 'pre_pr_or_previous_head',
      currentHeadEvidenceSource: input.currentHeadEvidenceSource || 'github_safe_artifact',
      selfReferentialShaRequired: input.selfReferentialShaRequired === true,
    },
    machineEvidenceAuthority: input.machineEvidenceAuthority || 'safe_artifact',
    humanSummaryAuthority: input.humanSummaryAuthority || 'pr_body',
    prBodyIsMachineEvidence: input.prBodyIsMachineEvidence === true,
    prBodyMachineBlocking: input.prBodyMachineBlocking === true,
    currentHeadRequiredForMerge: input.currentHeadRequiredForMerge !== false,
    sameHeadEvidenceGate: {
      prHead: input.sameHeadEvidenceGate?.prHead || input.prHead || null,
      ciHead: input.sameHeadEvidenceGate?.ciHead || input.ciHead || null,
      reviewHead: input.sameHeadEvidenceGate?.reviewHead || input.reviewHead || null,
      artifactHead: input.sameHeadEvidenceGate?.artifactHead || input.artifactHead || null,
      sameHeadEvidence: input.sameHeadEvidenceGate?.sameHeadEvidence !== false,
    },
    passSemantics: {
      localValidationPass: input.passSemantics?.localValidationPass === true,
      sameHeadRemoteValidationPass: input.passSemantics?.sameHeadRemoteValidationPass === true,
      mergePolicyPass: input.passSemantics?.mergePolicyPass === true,
      runtimeEvidencePass: input.passSemantics?.runtimeEvidencePass === true,
      productReadinessPass: input.passSemantics?.productReadinessPass === true,
      ownerAuthorityPass: input.passSemantics?.ownerAuthorityPass === true,
      passMeaning: PASS_MEANINGS.has(input.passSemantics?.passMeaning) ? input.passSemantics.passMeaning : 'local_validation_only',
      doesNotImply: truncateList(input.passSemantics?.doesNotImply || [
        'production_readiness',
        'runtime_readiness',
        'owner_approval',
        'legal_compliance',
        'youtube_policy_compliance',
        'release_permission',
      ], 12),
    },
    evidenceCapabilityMatrix: input.evidenceCapabilityMatrix || {
      remoteQualityGatePass: {
        supports: ['same_head_merge_confidence'],
        doesNotSupport: ['production_readiness', 'owner_approval'],
      },
      localGatePass: {
        supports: ['local_validation_confidence'],
        doesNotSupport: ['same_head_remote_merge_confidence'],
      },
      reviewerAccepted: {
        supports: ['technical_review_confidence'],
        doesNotSupport: ['owner_approval', 'github_approval_review'],
      },
    },
    canonicalStatus: {
      safeOutput: input.canonicalStatus?.safeOutput || 'pass',
      remoteGate: input.canonicalStatus?.remoteGate || 'not_required',
      primaryBlockingReason: input.canonicalStatus?.primaryBlockingReason || null,
      rawStatusReadDirectlyByFinalDecision: input.canonicalStatus?.rawStatusReadDirectlyByFinalDecision === true,
    },
    safeNextAction: input.evidenceSemanticsSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultTargetHarnessFootprintPolicy(input = {}) {
  return {
    footprintVersion: '1.2.4',
    newP0ArtifactAllowed: input.newP0ArtifactAllowed === true,
    newTopLevelStatusAllowed: input.newTopLevelStatusAllowed === true,
    newSkillAllowed: input.newSkillAllowed === true,
    workflowChangeAllowed: input.workflowChangeAllowed === true,
    productCodeChangeAllowed: input.productCodeChangeAllowed === true,
    packageLockChangeAllowed: input.packageLockChangeAllowed === true,
    agentsMaxLines: Math.min(Number(input.agentsMaxLines || 80), 80),
    targetSpecMaxLines: Math.min(Number(input.targetSpecMaxLines || 220), 220),
    activePolicyIndexMaxEntries: Math.min(Number(input.activePolicyIndexMaxEntries || 8), 8),
    scoreOnlyRepairAllowed: input.scoreOnlyRepairAllowed === true,
    repoSpecificVisualProofSurface: {
      enabled: input.repoSpecificVisualProofSurface?.enabled === true,
      allowedRepoProfiles: truncateList(input.repoSpecificVisualProofSurface?.allowedRepoProfiles || ['ui_frontend', 'live2d_renderer'], 8),
      notRequiredFor: truncateList(input.repoSpecificVisualProofSurface?.notRequiredFor || ['harness_source', 'backend_only', 'token_only_managed'], 8),
      privateImageRedactionRequired: input.repoSpecificVisualProofSurface?.privateImageRedactionRequired !== false,
    },
    safeNextAction: input.targetFootprintSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultGoalShardAndProgressEvidence(input = {}) {
  const goalShard = input.goalShard || input;
  const progress = input.progressEvidence || input.goalProgressEvidence || {};
  const phase = GOAL_SHARD_PHASES.has(goalShard.phase) ? goalShard.phase : 'implement';
  const assignedRole = GOAL_SHARD_ROLES.has(goalShard.assignedRole) ? goalShard.assignedRole : 'implementer';
  const validationTier = GOAL_VALIDATION_TIERS.has(goalShard.validationTier) ? goalShard.validationTier : 'local_gate';
  return {
    controlPlaneVersion: '1.2.5',
    isControlPlaneNotAuthorityExpansion: true,
    maxGoalShards: Math.min(Math.max(1, Number(input.maxGoalShards || 8)), 8),
    goalShard: {
      goalId: goalShard.goalId || 'source_harness_v125_body',
      parentGoalId: goalShard.parentGoalId || null,
      objective: goalShard.objective || 'add Source HARNESS v1.2.5 body only',
      phase,
      assignedRole,
      baseHead: goalShard.baseHead || null,
      expiresWhenHeadChanges: goalShard.expiresWhenHeadChanges !== false,
      allowedFiles: truncateList(goalShard.allowedFiles || [], 50),
      forbiddenFiles: truncateList(goalShard.forbiddenFiles || [], 50),
      requiredEvidence: truncateList(goalShard.requiredEvidence || ['v125_self_test', 'source_local_quality_gate'], 12),
      validationTier,
      ownerAuthorityCreatedByShard: goalShard.ownerAuthorityCreatedByShard === true,
      staleWhen: truncateList(goalShard.staleWhen || ['baseHead_changed', 'allowedFiles_overlap_without_arbiter', 'parentGoal_superseded', 'validationTier_no_longer_valid'], 8),
      duplicateGoalDetectionRequired: goalShard.duplicateGoalDetectionRequired !== false,
      completionCompactsToSafeSummary: goalShard.completionCompactsToSafeSummary !== false,
    },
    progressEvidence: {
      reportedProgress: progress.reportedProgress || 'not_started',
      toolEvidencePointers: truncateList(progress.toolEvidencePointers || [], 12),
      verifiedSteps: truncateList(progress.verifiedSteps || [], 12),
      unverifiedClaims: truncateList(progress.unverifiedClaims || [], 12),
      skippedSteps: truncateList(progress.skippedSteps || [], 12),
      failedChecks: truncateList(progress.failedChecks || [], 12),
      progressReportStatus: progress.progressReportStatus || 'blocked',
    },
    safeNextAction: input.goalShardSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultEvidenceLaneAndQGLane(input = {}) {
  const lanes = input.evidenceLaneAndQGLane || input;
  const qg = lanes.qgLaneSemantics || {};
  const lane = QG_LANES.has(qg.currentLane) ? qg.currentLane : 'local_pre_pr';
  const terminalPhase = QG_TERMINAL_PHASES.has(qg.terminalPhase) ? qg.terminalPhase : 'create_pr_only';
  const sameHeadRequired = terminalPhase === 'merge_consideration'
    ? qg.sameHeadRemoteGateRequired !== false
    : qg.sameHeadRemoteGateRequired === true;
  return {
    controlPlaneVersion: '1.2.5',
    committedEvidenceLane: {
      present: lanes.committedEvidenceLane?.present !== false,
      purpose: lanes.committedEvidenceLane?.purpose || 'historical_or_pre_pr_evidence',
      currentHeadMergeEvidence: lanes.committedEvidenceLane?.currentHeadMergeEvidence === true,
      boundByRemoteCurrentHeadLane: lanes.committedEvidenceLane?.boundByRemoteCurrentHeadLane === true,
    },
    remoteCurrentHeadLane: {
      status: lanes.remoteCurrentHeadLane?.status || 'not_required',
      sameHead: lanes.remoteCurrentHeadLane?.sameHead === true,
      headSha: lanes.remoteCurrentHeadLane?.headSha || null,
    },
    ownerIntentLane: {
      explicitOwnerIntentRequired: true,
      ownerAuthorityCreatedByAI: lanes.ownerIntentLane?.ownerAuthorityCreatedByAI === true,
      source: lanes.ownerIntentLane?.source || 'none',
    },
    humanSummaryLane: {
      prBodyIsHumanSummaryOnly: lanes.humanSummaryLane?.prBodyIsHumanSummaryOnly !== false,
      prBodyIsMachineEvidence: lanes.humanSummaryLane?.prBodyIsMachineEvidence === true,
    },
    qgLaneSemantics: {
      currentLane: lane,
      terminalPhase,
      remoteEvidenceMissingIsNormal: lane === 'local_pre_pr',
      pendingIsFailure: qg.pendingIsFailure === true,
      sameHeadRemoteGateRequired: sameHeadRequired,
      sameHeadHardOnlyForMergeConsideration: qg.sameHeadHardOnlyForMergeConsideration !== false,
      postMergeRequiresMarkerManifestDriftCheck: qg.postMergeRequiresMarkerManifestDriftCheck !== false,
    },
    safeNextAction: input.evidenceLaneSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultTypedMonitorInboxAndFanoutGuard(input = {}) {
  const inbox = input.typedMonitorInbox || {};
  const fanout = input.fanoutRoiLedger || input.costAwareFanoutGuard || {};
  const messageType = TYPED_MONITOR_MESSAGES.has(inbox.messageType) ? inbox.messageType : 'evidence_pointer';
  const newSignal = fanout.newFindingProduced === true || fanout.repairPlanChanged === true || fanout.validationImproved === true || fanout.sameRootCauseResolved === true;
  return {
    controlPlaneVersion: '1.2.5',
    typedMonitorInbox: {
      messageId: inbox.messageId || 'not_required',
      fromRole: TYPED_MONITOR_ROLES.has(inbox.fromRole) ? inbox.fromRole : 'monitor',
      toRole: TYPED_MONITOR_TARGETS.has(inbox.toRole) ? inbox.toRole : 'owner_brief',
      messageType,
      authorityLevel: TYPED_MONITOR_AUTHORITY.has(inbox.authorityLevel) ? inbox.authorityLevel : 'advisory',
      rawPromptInjection: inbox.rawPromptInjection === true,
      references: truncateList(inbox.references || ['safe_artifact_pointer'], 8),
      ownerAuthorityCreatedByMessage: inbox.ownerAuthorityCreatedByMessage === true,
      mutationAuthorizedByMessage: inbox.mutationAuthorizedByMessage === true,
    },
    fanoutRoiLedger: {
      agentCount: Math.min(Math.max(1, Number(fanout.agentCount || 1)), 3),
      highestTierUsed: fanout.highestTierUsed === true,
      escalationReason: ESCALATION_REASONS.has(fanout.escalationReason) ? fanout.escalationReason : 'none',
      newFindingProduced: fanout.newFindingProduced === true,
      repairPlanChanged: fanout.repairPlanChanged === true,
      validationImproved: fanout.validationImproved === true,
      sameRootCauseResolved: fanout.sameRootCauseResolved === true,
      tokenCostClass: TOKEN_SAVINGS_CLASSES.has(fanout.tokenCostClass) ? fanout.tokenCostClass : 'unknown',
      roiStatus: FANOUT_ROI_STATUSES.has(fanout.roiStatus) ? fanout.roiStatus : (newSignal ? 'positive' : 'neutral'),
      nextFanoutAllowed: fanout.nextFanoutAllowed === true,
    },
    safeNextAction: input.monitorFanoutSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultSkillReviewProductValueYield(input = {}) {
  const payload = input.skillReviewProductValueYield || input;
  const skill = payload.skillEffectiveness || {};
  const review = payload.reviewYield || {};
  const product = payload.productValueDelta || {};
  const targetInitialRollout = payload.targetInitialRollout === true;
  return {
    controlPlaneVersion: '1.2.5',
    sourceHard: payload.sourceHard === true,
    targetInitialRollout,
    skillEffectiveness: {
      status: skill.status || (targetInitialRollout ? 'warn' : 'pass'),
      wrongProfileSkill: skill.wrongProfileSkill === true,
      harmDetected: skill.harmDetected === true,
      effectivenessUnknown: skill.effectivenessUnknown === true,
    },
    reviewYield: {
      status: review.status || (targetInitialRollout ? 'warn' : 'pass'),
      newFindingCount: Math.max(0, Number(review.newFindingCount || 0)),
      acceptedFindingCount: Math.max(0, Number(review.acceptedFindingCount || 0)),
      duplicateFindingCount: Math.max(0, Number(review.duplicateFindingCount || 0)),
      falsePositiveCount: Math.max(0, Number(review.falsePositiveCount || 0)),
      changedDecisionBecauseOfReview: review.changedDecisionBecauseOfReview === true,
      checkedFailureModes: truncateList(review.checkedFailureModes || [], 12),
      reviewCostWorthIt: review.reviewCostWorthIt || 'unknown',
    },
    productValueDelta: {
      delta: PRODUCT_VALUE_DELTAS.has(product.delta) ? product.delta : 'evidence_only',
      advisoryPressureOnly: product.advisoryPressureOnly !== false,
      authorizesProductCodeChange: product.authorizesProductCodeChange === true,
      authorizesPackageOrLockfileChange: product.authorizesPackageOrLockfileChange === true,
      authorizesRuntimeReadiness: product.authorizesRuntimeReadiness === true,
      overridesOwnerScope: product.overridesOwnerScope === true,
      evidenceOnlyRepetitionCount: Math.max(0, Number(product.evidenceOnlyRepetitionCount || 0)),
      nextProductSliceRecommendation: product.nextProductSliceRecommendation || 'owner_brief_only',
    },
    safeNextAction: input.yieldSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultObservedWorkspaceOwnerReceiptAndCapability(input = {}) {
  const payload = input.observedWorkspaceOwnerReceiptAndCapability || input;
  const workspace = payload.observedWorkspaceState || {};
  const owner = payload.ownerDecisionReceipt || {};
  const delegated = payload.ownerDelegatedProcessReceipt || {};
  const capability = payload.capabilityBoundary || {};
  return {
    runtimeVersion: '1.2.6',
    observedWorkspaceState: {
      expectedRepo: workspace.expectedRepo || payload.repo || 'hiro4649/codex-development-harness',
      actualRemote: workspace.actualRemote || 'safe_remote_id',
      defaultBranch: workspace.defaultBranch || 'main',
      currentBranch: workspace.currentBranch || payload.branch || 'unknown',
      headSha: workspace.headSha || payload.headSha || null,
      originHeadSha: workspace.originHeadSha || null,
      worktreeClean: workspace.worktreeClean !== false,
      wrongCwdDetected: workspace.wrongCwdDetected === true,
      staleCloneDetected: workspace.staleCloneDetected === true,
      frozenBranchUsed: workspace.frozenBranchUsed === true,
      mutationAllowedHere: workspace.mutationAllowedHere !== false,
    },
    ownerDecisionReceipt: {
      present: owner.present === true,
      receiptId: owner.receiptId || 'not_present',
      prNumber: owner.prNumber || null,
      headSha: owner.headSha || null,
      allowedAction: V126_OWNER_ACTIONS.has(owner.allowedAction) ? owner.allowedAction : 'create_pr_only',
      scope: V126_OWNER_SCOPES.has(owner.scope) ? owner.scope : 'source_harness_body',
      instructionTextHash: owner.instructionTextHash || null,
      expiresOnHeadChange: owner.expiresOnHeadChange !== false,
      forbiddenAuthorizations: truncateList(owner.forbiddenAuthorizations || V126_FORBIDDEN_AUTHORIZATIONS, 12),
      ownerAuthorityCreatedByAI: owner.ownerAuthorityCreatedByAI === true,
    },
    ownerDelegatedProcessReceipt: {
      present: delegated.present === true,
      delegateRole: delegated.delegateRole || 'technical_agents',
      scope: V126_OWNER_SCOPES.has(delegated.scope) ? delegated.scope : 'none',
      allowedActions: truncateList(delegated.allowedActions || [], 8),
      blockedActions: truncateList(delegated.blockedActions || V126_FORBIDDEN_AUTHORIZATIONS, 12),
      autoContinueAllowed: delegated.autoContinueAllowed === true,
      expiresOnHeadChange: delegated.expiresOnHeadChange !== false,
      ownerAuthorityCreatedByAI: delegated.ownerAuthorityCreatedByAI === true,
    },
    capabilityBoundary: {
      bridgeDefaultEnabled: capability.bridgeDefaultEnabled === true,
      readOnlyFirst: capability.readOnlyFirst !== false,
      writeRequiresOwnerScope: capability.writeRequiresOwnerScope !== false,
      workspaceOnlyWrite: capability.workspaceOnlyWrite !== false,
      secretPathBlocked: capability.secretPathBlocked !== false,
      rawLogsForbidden: capability.rawLogsForbidden !== false,
      rawTranscriptMiningForbidden: capability.rawTranscriptMiningForbidden !== false,
      walletRpcDeployForbidden: capability.walletRpcDeployForbidden !== false,
      bridgeTranscriptMachineEvidence: capability.bridgeTranscriptMachineEvidence === true,
      ownerAuthorityCreatedByBridge: capability.ownerAuthorityCreatedByBridge === true,
      executionDigestRequired: capability.executionDigestRequired !== false,
    },
    safeNextAction: payload.observedStateSafeNextAction || payload.safeNextAction || 'one_action',
  };
}

function defaultSpecFirstCheckerBuilderLoopAndStopCircuit(input = {}) {
  const payload = input.specFirstCheckerBuilderLoopAndStopCircuit || input;
  return {
    runtimeVersion: '1.2.6',
    specFirstRequired: payload.specFirstRequired !== false,
    builderCanEdit: payload.builderCanEdit !== false,
    checkerCanEdit: payload.checkerCanEdit === true,
    checkerOutputRequiredForSuccess: payload.checkerOutputRequiredForSuccess !== false,
    sameAgentCannotSatisfyIndependentCheck: payload.sameAgentCannotSatisfyIndependentCheck !== false,
    maxCycles: Math.min(Math.max(1, Number(payload.maxCycles || 5)), 5),
    currentCycle: Math.max(0, Number(payload.currentCycle || 0)),
    sameFailureRepeatLimit: Math.min(Math.max(1, Number(payload.sameFailureRepeatLimit || 2)), 2),
    sameFailureRepeatCount: Math.max(0, Number(payload.sameFailureRepeatCount || 0)),
    regressionStops: payload.regressionStops !== false,
    regressionDetected: payload.regressionDetected === true,
    testWeakeningStops: payload.testWeakeningStops !== false,
    testWeakeningDetected: payload.testWeakeningDetected === true,
    ownerBoundaryStops: payload.ownerBoundaryStops !== false,
    loopContinuationAllowed: payload.loopContinuationAllowed === true,
    loopExitReason: V126_LOOP_EXIT_REASONS.has(payload.loopExitReason) ? payload.loopExitReason : 'not_started',
    safeNextAction: payload.loopSafeNextAction || payload.safeNextAction || 'one_action',
  };
}

function defaultEvidenceLaneStateMachineAndSafeFailureCapsule(input = {}) {
  const payload = input.evidenceLaneStateMachineAndSafeFailureCapsule || input;
  const lane = payload.evidenceLaneStateMachine || {};
  const failure = payload.safeFailureCapsule || {};
  return {
    runtimeVersion: '1.2.6',
    evidenceLaneStateMachine: {
      currentState: V126_LANE_STATES.has(lane.currentState) ? lane.currentState : 'local_pre_pr',
      remoteStatus: V126_REMOTE_STATUSES.has(lane.remoteStatus) ? lane.remoteStatus : 'missing',
      sameHead: lane.sameHead === true,
      headSha: lane.headSha || null,
      ownerReceiptRequiredForMerge: lane.ownerReceiptRequiredForMerge !== false,
      sameHeadRemoteRequiredForMerge: lane.sameHeadRemoteRequiredForMerge !== false,
      finalDecisionClosureRequired: lane.finalDecisionClosureRequired !== false,
      mergeConsiderationAllowed: lane.mergeConsiderationAllowed === true,
      prBodyMachineEvidence: lane.prBodyMachineEvidence === true,
    },
    safeFailureCapsule: {
      failureFingerprint: failure.failureFingerprint || 'none',
      sameFailureAsPreviousCycle: failure.sameFailureAsPreviousCycle === true,
      check: failure.check || 'none',
      safeFile: failure.safeFile || null,
      safeLine: failure.safeLine || null,
      safeReason: failure.safeReason || 'none',
      rawLogIncluded: failure.rawLogIncluded === true,
      rawTranscriptIncluded: failure.rawTranscriptIncluded === true,
      rawDiffIncluded: failure.rawDiffIncluded === true,
      builderInstruction: failure.builderInstruction || 'fix_root_cause_only',
      scopeExpansionAllowed: failure.scopeExpansionAllowed === true,
      onePrimaryClass: failure.onePrimaryClass !== false,
    },
    safeNextAction: payload.failureLaneSafeNextAction || payload.safeNextAction || 'one_action',
  };
}

function defaultContextSkillValidationBudgetRouter(input = {}) {
  const payload = input.contextSkillValidationBudgetRouter || input;
  const selectedSkills = truncateList(payload.selectedSkills || [], 5);
  const mdFilesRead = truncateList(payload.mdFilesRead || [], 10);
  return {
    runtimeVersion: '1.2.6',
    taskProfile: payload.taskProfile || 'routine',
    impactedAreas: truncateList(payload.impactedAreas || [], 12),
    selectedSkills,
    rejectedSkills: truncateList(payload.rejectedSkills || [], 12),
    mdFilesRead,
    mdFilesDeferred: truncateList(payload.mdFilesDeferred || ['README.md', 'legacy_specs', 'pr_history_docs'], 12),
    maxSkillCount: Math.min(Math.max(0, Number(payload.maxSkillCount || 2)), 2),
    maxMdFilesRead: Math.min(Math.max(0, Number(payload.maxMdFilesRead || 3)), 3),
    selectedValidationTier: V126_VALIDATION_TIERS.has(payload.selectedValidationTier) ? payload.selectedValidationTier : 'static_check',
    whyThisTier: payload.whyThisTier || 'task_profile_and_changed_files',
    sameHeadRemoteGateCannotBeSkippedForMerge: payload.sameHeadRemoteGateCannotBeSkippedForMerge !== false,
    contextReductionMustNotReduceEvidence: payload.contextReductionMustNotReduceEvidence !== false,
    skillRoutingMustNotReduceVerification: payload.skillRoutingMustNotReduceVerification !== false,
    knowledgePointerCannotOverrideChangedFiles: payload.knowledgePointerCannotOverrideChangedFiles !== false,
    validationRouterCannotSkipSameHeadRemoteForMerge: payload.validationRouterCannotSkipSameHeadRemoteForMerge !== false,
    safeNextAction: payload.routerSafeNextAction || payload.safeNextAction || 'one_action',
  };
}

function defaultSkillReviewProductValueEffectiveness(input = {}) {
  const payload = input.skillReviewProductValueEffectiveness || input;
  const skill = payload.skillEffectiveness || {};
  const review = payload.reviewEffectiveness || {};
  const product = payload.productValueReturnGate || {};
  return {
    runtimeVersion: '1.2.6',
    skillEffectiveness: {
      skillId: skill.skillId || 'not_selected',
      selected: skill.selected === true,
      usedCorrectly: skill.usedCorrectly !== false,
      newEvidenceProduced: skill.newEvidenceProduced === true,
      failureAvoided: skill.failureAvoided === true,
      diffReduced: skill.diffReduced === true,
      validationAdded: skill.validationAdded === true,
      wrongSkillCost: Math.max(0, Number(skill.wrongSkillCost || 0)),
      wrongProfileSkill: skill.wrongProfileSkill === true,
      harmfulSkill: skill.harmfulSkill === true,
      netValue: V126_SKILL_NET_VALUES.has(skill.netValue) ? skill.netValue : 'unknown',
    },
    reviewEffectiveness: {
      newFindingCount: Math.max(0, Number(review.newFindingCount || 0)),
      acceptedFindingCount: Math.max(0, Number(review.acceptedFindingCount || 0)),
      duplicateFindingCount: Math.max(0, Number(review.duplicateFindingCount || 0)),
      falsePositiveCount: Math.max(0, Number(review.falsePositiveCount || 0)),
      assumptionDiffPresent: review.assumptionDiffPresent === true,
      decisionChangedByReview: review.decisionChangedByReview === true,
      negativeFindingRequiredWhenHighRisk: review.negativeFindingRequiredWhenHighRisk === true,
      noNewSignalRepeatCount: Math.max(0, Number(review.noNewSignalRepeatCount || 0)),
      fanoutContinuationAllowed: review.fanoutContinuationAllowed === true,
    },
    productValueReturnGate: {
      recentHarnessOnlyCount: Math.max(0, Number(product.recentHarnessOnlyCount || 0)),
      evidenceOnlyRepeated: product.evidenceOnlyRepeated === true,
      nextProductSliceRecommended: product.nextProductSliceRecommended === true,
      productScopeAuthorized: product.productScopeAuthorized === true,
      safeNextAction: product.safeNextAction || 'owner_scope_or_stop',
    },
    safeNextAction: payload.effectivenessSafeNextAction || payload.safeNextAction || 'one_action',
  };
}

function defaultTypedOwnerProcessReceiptAndContinuationKernel(input = {}) {
  const payload = input.typedOwnerProcessReceiptAndContinuationKernel || input;
  const process = payload.ownerProcessReceipt || {};
  const conditional = payload.ownerConditionalMergeReceipt || {};
  const product = payload.ownerProductScopeReceipt || {};
  const dangerous = payload.ownerDangerousCapabilityReceipt || {};
  const continuation = payload.continuationDecision || {};
  const receiptProvenancePresent = Boolean(process.receiptId && process.taskId && (process.ownerInstructionHash || process.sourceInstructionRef));
  const processPresent = process.present === true;
  const inferredReceiptValid = processPresent && receiptProvenancePresent && process.expiresOnScopeDelta !== false && continuation.scopeDeltaDetected !== true;
  const continuationState = V127_CONTINUATION_STATES.has(continuation.state)
    ? continuation.state
    : inferredReceiptValid
      ? 'continue'
      : 'justified_owner_boundary';
  return {
    runtimeVersion: '1.2.7',
    normalizedOwnerIntent: V127_OWNER_INTENTS.has(payload.normalizedOwnerIntent) ? payload.normalizedOwnerIntent : (processPresent ? 'harness_source_develop_and_publish' : 'none'),
    ownerProcessReceipt: {
      present: processPresent,
      receiptId: process.receiptId || null,
      taskId: process.taskId || null,
      ownerInstructionHash: process.ownerInstructionHash || null,
      sourceInstructionRef: process.sourceInstructionRef || null,
      receiptProvenancePresent,
      allowedActions: truncateList(process.allowedActions || [], 8),
      survivesInScopeCommitHeadChanges: process.survivesInScopeCommitHeadChanges !== false,
      expiresOnScopeDelta: process.expiresOnScopeDelta !== false,
      scopeDigest: process.scopeDigest || 'source_harness_v127_body_only',
      headShaBindingRequiredForMerge: process.headShaBindingRequiredForMerge !== false,
      ownerAuthorityCreatedByAI: process.ownerAuthorityCreatedByAI === true,
    },
    ownerConditionalMergeReceipt: {
      present: conditional.present === true,
      scope: V127_CONDITIONAL_MERGE_SCOPES.has(conditional.scope) ? conditional.scope : 'none',
      prNumber: conditional.prNumber || null,
      headSha: conditional.headSha || null,
      requiresSameHeadRequiredChecksPass: conditional.requiresSameHeadRequiredChecksPass !== false,
      requiresScopeDigestUnchanged: conditional.requiresScopeDigestUnchanged !== false,
      requiresFinalDecisionAllowsMerge: conditional.requiresFinalDecisionAllowsMerge !== false,
      expiresOnScopeDelta: conditional.expiresOnScopeDelta !== false,
      ownerAuthorityCreatedByAI: conditional.ownerAuthorityCreatedByAI === true,
    },
    ownerProductScopeReceipt: {
      present: product.present === true,
      productCodeChangeAllowed: product.productCodeChangeAllowed === true,
      packageOrLockfileChangeAllowed: product.packageOrLockfileChangeAllowed === true,
      workflowChangeAllowed: product.workflowChangeAllowed === true,
      expiresOnScopeDelta: product.expiresOnScopeDelta !== false,
    },
    ownerDangerousCapabilityReceipt: {
      present: dangerous.present === true,
      releaseAllowed: dangerous.releaseAllowed === true,
      deployAllowed: dangerous.deployAllowed === true,
      walletRpcAllowed: dangerous.walletRpcAllowed === true,
      secretAccessAllowed: dangerous.secretAccessAllowed === true,
      fundedTransactionAllowed: dangerous.fundedTransactionAllowed === true,
      governanceTransactionAllowed: dangerous.governanceTransactionAllowed === true,
      bscScanVerificationAllowed: dangerous.bscScanVerificationAllowed === true,
      readinessClaimAllowed: dangerous.readinessClaimAllowed === true,
    },
    continuationDecision: {
      state: continuationState,
      avoidableOwnerStopDetected: continuation.avoidableOwnerStopDetected === true,
      receiptValid: continuation.receiptValid === false ? false : inferredReceiptValid,
      scopeDeltaDetected: continuation.scopeDeltaDetected === true,
      oneSafeNextAction: continuation.oneSafeNextAction || (inferredReceiptValid ? 'continue_commit_push_create_pr' : 'owner_boundary_stop'),
    },
    safeNextAction: payload.safeNextAction || (inferredReceiptValid ? 'continue_within_owner_process_receipt' : 'owner_boundary_stop'),
  };
}

function defaultDecisionEvidenceEnvelopeAndSameHeadBinder(input = {}) {
  const payload = input.decisionEvidenceEnvelopeAndSameHeadBinder || input;
  const envelope = payload.decisionEvidenceEnvelope || {};
  const localHead = envelope.localHead || envelope.headSha || null;
  const prHead = envelope.prHead || null;
  const workflowHead = envelope.workflowHead || null;
  const artifactHead = envelope.artifactHead || null;
  const requiredHeads = [localHead, prHead, workflowHead, artifactHead];
  const allHeadsPresent = requiredHeads.every(Boolean);
  const allHeadsMatch = allHeadsPresent && requiredHeads.every((head) => head === localHead);
  const sameHead = allHeadsMatch;
  return {
    runtimeVersion: '1.2.7',
    decisionEvidenceEnvelope: {
      lane: V127_LANES.has(envelope.lane) ? envelope.lane : 'local_pre_pr',
      repo: envelope.repo || payload.repo || 'hiro4649/codex-development-harness',
      branch: envelope.branch || payload.branch || 'unknown',
      baseSha: envelope.baseSha || null,
      localHead,
      prHead,
      workflowHead,
      artifactHead,
      ownerReceiptBinding: envelope.ownerReceiptBinding || 'valid',
      sameHead,
      localGate: envelope.localGate || 'pass',
      remoteGate: V127_REMOTE_STATUSES.has(envelope.remoteGate) ? envelope.remoteGate : 'missing',
      allowedNextAction: V127_ALLOWED_NEXT_ACTIONS.has(envelope.allowedNextAction) ? envelope.allowedNextAction : 'continue_commit_push_create_pr',
      oneBlockingReason: envelope.oneBlockingReason || null,
      prBodyMachineEvidence: envelope.prBodyMachineEvidence === true,
    },
    sameHeadBinder: {
      rejectsHeadMismatch: payload.rejectsHeadMismatch !== false,
      requiredForMerge: payload.requiredForMerge !== false,
      allRequiredHeadsPresent: allHeadsPresent,
      allRequiredHeadsMatch: allHeadsMatch,
      sameHeadDerivedFromHashes: true,
      artifactHeadMustMatchWorkflowHead: payload.artifactHeadMustMatchWorkflowHead !== false,
      prBodyIsDisplayOnly: payload.prBodyIsDisplayOnly !== false,
    },
    safeNextAction: payload.safeNextAction || 'follow_decision_evidence_lane',
  };
}

function defaultValidationDagAndContentAddressedReuse(input = {}) {
  const payload = input.validationDagAndContentAddressedReuse || input;
  const cache = payload.validationCacheKey || {};
  const reuseStatus = payload.reuseStatus || 'not_used';
  return {
    runtimeVersion: '1.2.7',
    validationPlanVersion: 'v127',
    reuseStatus,
    validationCacheKey: {
      headSha: cache.headSha || payload.headSha || 'not_reused_local_pre_pr_head',
      validationPlanVersion: cache.validationPlanVersion || 'v127',
      scriptDigest: cache.scriptDigest || 'sha256:not_reused_validation_plan',
      lockfileDigest: cache.lockfileDigest || 'none',
      runnerImage: cache.runnerImage || 'local_runner_not_reused',
      nodeOrRuntimeVersion: cache.nodeOrRuntimeVersion || 'node_not_reused',
      taskProfile: TASK_PROFILES.has(cache.taskProfile) ? cache.taskProfile : 'harness_source_body',
      environmentClass: cache.environmentClass || 'local_or_ci',
    },
    priorArtifactPointer: payload.priorArtifactPointer || null,
    invalidatesOn: truncateList(payload.invalidatesOn || ['validation_script', 'workflow', 'lockfile', 'runtime', 'runner', 'task_profile', 'changed_category', 'required_check_policy'], 12),
    reusedValidationResults: Math.max(0, Number(payload.reusedValidationResults || 0)),
    newValidationExecutions: Math.max(0, Number(payload.newValidationExecutions || 1)),
    nightlyFullGateReplacesPremergeRequiredChecks: payload.nightlyFullGateReplacesPremergeRequiredChecks === true,
    safeNextAction: payload.safeNextAction || 'reuse_only_when_cache_key_matches',
  };
}

function defaultContextOutputOwnerInterruptTokenBudget(input = {}) {
  const payload = input.contextOutputOwnerInterruptTokenBudget || input;
  return {
    runtimeVersion: '1.2.7',
    tokenEconomyMetrics: {
      authorityMarkdownReads: Math.max(0, Number(payload.authorityMarkdownReads || 2)),
      safeArtifactReads: Math.max(0, Number(payload.safeArtifactReads || 3)),
      selectedSkills: Math.max(0, Number(payload.selectedSkills || 1)),
      extraReads: Math.max(0, Number(payload.extraReads || 0)),
      operatorOutputLines: Math.max(0, Number(payload.operatorOutputLines || 8)),
      ownerInterruptCount: Math.max(0, Number(payload.ownerInterruptCount || 0)),
      repeatedSafetyTextCount: Math.max(0, Number(payload.repeatedSafetyTextCount || 0)),
      reusedValidationResults: Math.max(0, Number(payload.reusedValidationResults || 0)),
      newValidationExecutions: Math.max(0, Number(payload.newValidationExecutions || 1)),
      observed: payload.observed === true,
      metricsSource: payload.metricsSource || 'not_observed',
      countsSource: payload.countsSource || 'declared_budget',
      observedCounts: payload.observedCounts === true,
      declaredBudget: {
        authorityMarkdownReads: Math.max(0, Number(payload.declaredBudget?.authorityMarkdownReads ?? payload.authorityMarkdownReads ?? 2)),
        safeArtifactReads: Math.max(0, Number(payload.declaredBudget?.safeArtifactReads ?? payload.safeArtifactReads ?? 3)),
        selectedSkills: Math.max(0, Number(payload.declaredBudget?.selectedSkills ?? payload.selectedSkills ?? 1)),
        operatorOutputLines: Math.max(0, Number(payload.declaredBudget?.operatorOutputLines ?? payload.operatorOutputLines ?? 8)),
      },
      routineArtifactBytes: Math.max(0, Number(payload.routineArtifactBytes || 0)),
      safeArtifactBytes: Math.max(0, Number(payload.safeArtifactBytes || 0)),
      outputLineCount: Math.max(0, Number(payload.outputLineCount || payload.operatorOutputLines || 0)),
    },
    outputBudget: {
      finalReportLineBudget: Math.min(Math.max(1, Number(payload.finalReportLineBudget || 8)), 20),
      progressUpdateLineBudget: Math.min(Math.max(1, Number(payload.progressUpdateLineBudget || 2)), 4),
      safeArtifactReadsMax: Math.min(Math.max(1, Number(payload.safeArtifactReadsMax || 3)), 3),
      selectedSkillsMax: Math.min(Math.max(0, Number(payload.selectedSkillsMax || 1)), 1),
      routineArtifactBytesMax: Math.max(1, Number(payload.routineArtifactBytesMax || 4096)),
      requireObservedMetrics: payload.requireObservedMetrics === true,
      repeatedSafetyTextSuppressed: payload.repeatedSafetyTextSuppressed !== false,
    },
    safeNextAction: payload.safeNextAction || 'emit_delta_only_safe_summary',
  };
}

function defaultBlockerClosureAndProductValuePressure(input = {}) {
  const payload = input.blockerClosureAndProductValuePressure || input;
  const blocker = payload.typedBlockerClosure || {};
  const product = payload.productValuePressure || {};
  const skill = payload.skillRoiOptimization || {};
  return {
    runtimeVersion: '1.2.7',
    typedBlockerClosure: {
      blocker: blocker.blocker || 'none',
      severity: blocker.severity || 'none',
      recovery: V127_BLOCKER_RECOVERIES.has(blocker.recovery) ? blocker.recovery : 'none',
      allowedActions: truncateList(blocker.allowedActions || [], 8),
      forbiddenActions: truncateList(blocker.forbiddenActions || ['scope_expand', 'product_repair_without_scope', 'merge'], 8),
      onePrimaryClass: blocker.onePrimaryClass !== false,
      oneSafeNextAction: blocker.oneSafeNextAction || 'continue_if_no_blocker',
    },
    productValuePressure: {
      productValueDelta: product.productValueDelta || 'developer_velocity',
      harnessContinuationBudget: Math.max(0, Number(product.harnessContinuationBudget || 1)),
      portfolioRolloutCountsAsOneHarnessCycle: product.portfolioRolloutCountsAsOneHarnessCycle !== false,
      explicitHarnessScopeCanContinue: product.explicitHarnessScopeCanContinue !== false,
      productScopeAuthorized: product.productScopeAuthorized === true,
      advisoryOnly: product.advisoryOnly !== false,
    },
    skillRoiOptimization: {
      skillId: skill.skillId || 'not_selected',
      roiStatus: V127_SKILL_ROI.has(skill.roiStatus) ? skill.roiStatus : 'neutral',
      mandatorySafetySkill: skill.mandatorySafetySkill === true,
      disabledAfterTwoNeutralSamples: skill.disabledAfterTwoNeutralSamples === true,
    },
    safeNextAction: payload.safeNextAction || 'recover_or_return_to_product_value',
  };
}

export function buildOrchestrationCapsule(input = {}) {
  const v127ProcessInput = (input.typedOwnerProcessReceiptAndContinuationKernel || input).ownerProcessReceipt || {};
  const v127ProcessHasProvenance = Boolean(v127ProcessInput.receiptId && v127ProcessInput.taskId && (v127ProcessInput.ownerInstructionHash || v127ProcessInput.sourceInstructionRef));
  const v127ProcessReceiptValid = v127ProcessInput.present === true && v127ProcessHasProvenance && v127ProcessInput.expiresOnScopeDelta !== false;
  const v127AllowedActions = new Set(Array.isArray(v127ProcessInput.allowedActions) ? v127ProcessInput.allowedActions : []);
  const v127Allows = (action) => v127ProcessReceiptValid && v127AllowedActions.has(action);
  const permissionGrant = {
    triage: input.triage === true,
    monitor: input.monitor === true,
    implement: input.implement === true,
    commit: input.commit === true || v127Allows('commit'),
    push: input.push === true || v127Allows('push'),
    createPr: input.createPr === true || v127Allows('create_pr'),
    rerunCi: input.rerunCi === true || v127Allows('rerun_ci'),
    fixCi: input.fixCi === true || v127Allows('fix_ci'),
    merge: input.merge === true,
    closeIssue: input.closeIssue === true,
    release: input.release === true,
    publish: input.publish === true,
    externalToolUse: input.externalToolUse === true,
    secretAccess: input.secretAccess === true,
    walletRpcDeployAccess: input.walletRpcDeployAccess === true,
    permissionEvidenceSource: input.permissionEvidenceSource || (v127ProcessReceiptValid ? 'owner_process_receipt' : 'none'),
    mutationPermissionAuthority: input.mutationPermissionAuthority || (v127ProcessReceiptValid ? 'owner_explicit_only' : 'none'),
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
    forbiddenScopeProfile: input.forbiddenScopeProfile || 'SOURCE_HARNESS_BODY_ONLY_V125',
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
    activeHarnessVersion: input.activeHarnessVersion || '1.2.7',
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
    skillContextRouting: defaultSkillContextRouting(input.skillContextRouting || input),
    finalDecisionClosure: defaultFinalDecisionClosure(input.finalDecisionClosure || input),
    workspaceIdentityGate: defaultWorkspaceIdentityGate(input.workspaceIdentityGate || input),
    activePolicyIndex: defaultActivePolicyIndex(input.activePolicyIndex || input),
    contextReadLedger: defaultContextReadLedger(input.contextReadLedger || input),
    skillContractRegistry: defaultSkillContractRegistry(input.skillContractRegistry || input),
    skillEffectivenessLedger: defaultSkillEffectivenessLedger(input.skillEffectivenessLedger || input),
    escalationEffectivenessLedger: defaultEscalationEffectivenessLedger(input.escalationEffectivenessLedger || input),
    goalContract: defaultGoalContract(input.goalContract || input),
    delegationBoundary: defaultDelegationBoundary(input.delegationBoundary || input),
    evidenceSemanticsKernel: defaultEvidenceSemanticsKernel(input.evidenceSemanticsKernel || input),
    targetHarnessFootprintPolicy: defaultTargetHarnessFootprintPolicy(input.targetHarnessFootprintPolicy || input),
    goalShardAndProgressEvidence: defaultGoalShardAndProgressEvidence(input.goalShardAndProgressEvidence || input),
    evidenceLaneAndQGLaneSemantics: defaultEvidenceLaneAndQGLane(input.evidenceLaneAndQGLaneSemantics || input),
    typedMonitorInboxAndFanoutGuard: defaultTypedMonitorInboxAndFanoutGuard(input.typedMonitorInboxAndFanoutGuard || input),
    skillReviewProductValueYield: defaultSkillReviewProductValueYield(input.skillReviewProductValueYield || input),
    observedWorkspaceOwnerReceiptAndCapability: defaultObservedWorkspaceOwnerReceiptAndCapability(input.observedWorkspaceOwnerReceiptAndCapability || input),
    specFirstCheckerBuilderLoopAndStopCircuit: defaultSpecFirstCheckerBuilderLoopAndStopCircuit(input.specFirstCheckerBuilderLoopAndStopCircuit || input),
    evidenceLaneStateMachineAndSafeFailureCapsule: defaultEvidenceLaneStateMachineAndSafeFailureCapsule(input.evidenceLaneStateMachineAndSafeFailureCapsule || input),
    contextSkillValidationBudgetRouter: defaultContextSkillValidationBudgetRouter(input.contextSkillValidationBudgetRouter || input),
    skillReviewProductValueEffectiveness: defaultSkillReviewProductValueEffectiveness(input.skillReviewProductValueEffectiveness || input),
    typedOwnerProcessReceiptAndContinuationKernel: defaultTypedOwnerProcessReceiptAndContinuationKernel(input.typedOwnerProcessReceiptAndContinuationKernel || input),
    decisionEvidenceEnvelopeAndSameHeadBinder: defaultDecisionEvidenceEnvelopeAndSameHeadBinder(input.decisionEvidenceEnvelopeAndSameHeadBinder || input),
    validationDagAndContentAddressedReuse: defaultValidationDagAndContentAddressedReuse(input.validationDagAndContentAddressedReuse || input),
    contextOutputOwnerInterruptTokenBudget: defaultContextOutputOwnerInterruptTokenBudget(input.contextOutputOwnerInterruptTokenBudget || input),
    blockerClosureAndProductValuePressure: defaultBlockerClosureAndProductValuePressure(input.blockerClosureAndProductValuePressure || input),
    authorityBoundary: {
      conflictPrecedence: [
        'v1.1.8_final_decision_over_v1.1.9_v1.2.0_v1.2.1_v1.2.2_v1.2.3_v1.2.4_v1.2.5_v1.2.6_and_v1.2.7',
        'v1.1.9_orchestration_over_v1.2.0_routing_v1.2.1_calibration_v1.2.2_context_routing_v1.2.3_observed_evidence_v1.2.4_delegated_autonomy_v1.2.5_control_plane_v1.2.6_observed_state_loop_and_v1.2.7_receipt_continuation',
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

export function validateFinalDecisionClosure(closure = {}) {
  const reasons = [];
  if (!['1.2.3', '1.2.4'].includes(closure.closureVersion)) reasons.push('final_decision_closure_version_invalid');
  if (!FINAL_DECISION_PHASES.has(closure.phase)) reasons.push('final_decision_closure_phase_invalid');
  if (!FINAL_DECISION_TERMINAL_ACTIONS.has(closure.terminalAction)) reasons.push('final_decision_closure_terminal_action_invalid');
  if (!TARGET_QUALITY_STATUSES.has(closure.targetQualityStatus)) reasons.push('final_decision_closure_target_quality_invalid');
  if (!SAME_HEAD_REMOTE_GATE_STATUSES.has(closure.sameHeadRemoteGate)) reasons.push('final_decision_closure_same_head_invalid');
  if (!MERGE_SCOPE_STATUSES.has(closure.ownerOrDelegatedMergeScope)) reasons.push('final_decision_closure_scope_invalid');
  if (!CLOSURE_STATUSES.has(closure.closureStatus)) reasons.push('final_decision_closure_status_invalid');
  if (!CLOSURE_REASONS.has(closure.singleClosureReason)) reasons.push('final_decision_closure_reason_invalid');
  const readyButFalse = closure.phase === 'merge_consideration'
    && closure.sameHeadRemoteGate === 'pass'
    && closure.targetQualityStatus === 'pass'
    && Number(closure.blockingReasonsCount || 0) === 0
    && closure.ownerOrDelegatedMergeScope === 'valid'
    && closure.mergeAllowed !== true;
  if (readyButFalse) reasons.push('decision_closure_inconsistent');
  if (closure.terminalAction === 'merge_current_pr' && closure.sameHeadRemoteGate !== 'pass') reasons.push('merge_current_pr_requires_same_head_remote_gate');
  if (closure.terminalAction === 'merge_current_pr' && closure.ownerOrDelegatedMergeScope !== 'valid') reasons.push('merge_current_pr_requires_owner_or_delegated_scope');
  if (closure.terminalAction === 'merge_current_pr' && closure.targetQualityStatus !== 'pass') reasons.push('merge_current_pr_requires_target_quality_pass');
  if (closure.terminalAction === 'merge_current_pr' && Number(closure.blockingReasonsCount || 0) > 0) reasons.push('merge_current_pr_requires_no_blocking_reasons');
  if (closure.terminalAction === 'merge_current_pr' && closure.mergeAllowed !== true) reasons.push('merge_current_pr_requires_merge_allowed_true');
  if (closure.closureStatus === 'inconsistent') reasons.push('decision_closure_inconsistent');
  if (closure.phase === 'create_pr_only' && closure.singleClosureReason !== 'phase_create_pr_only') reasons.push('create_pr_only_requires_phase_reason');
  if (closure.phase === 'merge_consideration' && closure.mergeAllowed !== true && closure.singleClosureReason === 'none') reasons.push('merge_block_requires_single_closure_reason');
  if (closure.phase === 'merge_consideration' && closure.mergeAllowed !== true && closure.sameHeadRemoteGate !== 'pass' && closure.singleClosureReason !== 'remote_gate_missing') reasons.push('remote_gate_block_requires_remote_gate_reason');
  if (closure.phase === 'merge_consideration' && closure.mergeAllowed !== true && closure.ownerOrDelegatedMergeScope === 'missing' && !['owner_merge_decision_missing', 'delegated_scope_missing'].includes(closure.singleClosureReason)) reasons.push('merge_scope_block_requires_owner_or_delegated_reason');
  return reasons.length ? fail(reasons) : pass({ phase: closure.phase, singleClosureReason: closure.singleClosureReason });
}

export function validateWorkspaceIdentityGate(gate = {}) {
  const reasons = [];
  if (!['1.2.3', '1.2.4', '1.2.5', '1.2.6', '1.2.7'].includes(gate.workspaceIdentityVersion)) reasons.push('workspace_identity_version_invalid');
  if (!['CODEX_QUALITY_HARNESS_FILE v1.2.3', 'CODEX_QUALITY_HARNESS_FILE v1.2.4', 'CODEX_QUALITY_HARNESS_FILE v1.2.5', 'CODEX_QUALITY_HARNESS_FILE v1.2.6', 'CODEX_QUALITY_HARNESS_FILE v1.2.7'].includes(gate.agentsMarker)) reasons.push('workspace_identity_agents_marker_invalid');
  if (!['1.2.3', '1.2.4', '1.2.5', '1.2.6', '1.2.7'].includes(gate.manifestActiveHarnessVersion)) reasons.push('workspace_identity_manifest_version_invalid');
  if (gate.wrongRepo === true && gate.readOnlyAudit !== true) reasons.push('wrong_workspace_blocked');
  if (gate.frozenBranchUsed === true) reasons.push('frozen_branch_blocked');
  if (gate.mutationTask === true && gate.repoResolvableOnGitHub !== true) reasons.push('unresolvable_remote_for_mutation');
  if (gate.mutationTask === true && gate.localOnlyState === true) reasons.push('local_only_state_for_pr_creation');
  if (gate.mutationTask === true && gate.worktreeClean !== true && gate.dirtyWorktreePreservationScope !== true) reasons.push('dirty_worktree_without_preservation_scope');
  if (gate.workspaceIdentityStatus === 'blocked') reasons.push('workspace_identity_blocked');
  return reasons.length ? fail(reasons) : pass({ expectedRepo: gate.expectedRepo, currentBranch: gate.currentBranch });
}

export function validateActivePolicyIndex(index = {}) {
  const reasons = [];
  if (!['1.2.3', '1.2.4', '1.2.5', '1.2.6', '1.2.7'].includes(index.schemaVersion)) reasons.push('active_policy_index_schema_invalid');
  if (index.indexPath !== 'docs/process/CODEX_ACTIVE_POLICY_INDEX.json') reasons.push('active_policy_index_path_invalid');
  for (const item of ['AGENTS.md', 'docs/process/CODEX_HARNESS_MANIFEST.json']) {
    if (!Array.isArray(index.requiredReads) || !index.requiredReads.includes(item)) reasons.push(`active_policy_index_missing_${item}`);
  }
  if (!Array.isArray(index.requiredReads) || !index.requiredReads.some((item) => ['docs/process/CODEX_V123_SPEC.md', 'docs/process/CODEX_V124_SPEC.md', 'docs/process/CODEX_V125_SPEC.md', 'docs/process/CODEX_V126_SPEC.md', 'docs/process/CODEX_V127_SPEC.md'].includes(item))) reasons.push('active_policy_index_missing_active_spec');
  if (Array.isArray(index.requiredReads) && index.requiredReads.some((item) => ['README.md', 'legacy_specs', 'pr_history_docs'].includes(item))) reasons.push('active_policy_index_required_reads_too_broad');
  if (Number(index.selectedSkillsMax || 0) > 3) reasons.push('active_policy_index_skill_budget_too_high');
  if (Number(index.mdFilesReadMax || 0) > 6) reasons.push('active_policy_index_md_budget_too_high');
  return reasons.length ? fail(reasons) : pass({ taskProfile: index.taskProfile, requiredReads: Array.isArray(index.requiredReads) ? index.requiredReads.length : 0 });
}

export function validateContextReadLedger(ledger = {}) {
  const reasons = [];
  if (ledger.ledgerVersion !== '1.2.3') reasons.push('context_read_ledger_version_invalid');
  if (!CONTEXT_LEDGER_STATUSES.has(ledger.contextLedgerStatus)) reasons.push('context_read_ledger_status_invalid');
  for (const read of ledger.observedToolReads || []) {
    if (!OBSERVED_CONTEXT_SOURCE_TYPES.has(read.sourceType)) reasons.push('observed_context_source_type_invalid');
    if (!OBSERVED_READ_REASONS.has(read.readReason)) reasons.push('observed_context_read_reason_invalid');
    if (read.sourceType === 'rawLog') reasons.push('raw_logs_read');
    if (read.sourceType === 'fullHistory') reasons.push('full_history_read_without_scope');
    if (read.sourceType === 'legacySpec' && !['compatibility_failure', 'authority_conflict'].includes(read.readReason)) reasons.push('legacy_spec_read_without_reason');
    if (read.sourceType === 'prHistory' && !['safe_artifact_pointer', 'owner_requested'].includes(read.readReason)) reasons.push('pr_history_read_without_pointer');
  }
  for (const item of ledger.observedButUndeclaredUse || []) {
    if (['rawLog', 'legacySpec', 'prHistory', 'fullHistory', 'forbiddenSkill'].includes(item)) reasons.push(`observed_forbidden_context_${item}`);
  }
  if (ledger.ownerProvidedContext?.countedAsFileRead === true) reasons.push('owner_provided_context_not_file_read');
  if (ledger.contextLedgerStatus === 'blocked') reasons.push('context_read_ledger_blocked');
  return reasons.length ? fail(reasons) : pass({ observedToolReadCount: Array.isArray(ledger.observedToolReads) ? ledger.observedToolReads.length : 0 });
}

export function validateSkillContractRegistry(registry = {}) {
  const reasons = [];
  if (registry.registryVersion !== '1.2.3') reasons.push('skill_contract_registry_version_invalid');
  const selected = new Set(registry.selectedSkillIds || []);
  const currentRepoProfile = registry.currentRepoProfile || 'source_harness';
  const contracts = new Map((registry.contracts || []).map((contract) => [contract.skillId, contract]));
  if (registry.selectedSkillContractRequired !== false) {
    for (const skillId of selected) {
      if (!contracts.has(skillId)) reasons.push(`selected_skill_contract_missing_${skillId}`);
    }
  }
  for (const contract of registry.contracts || []) {
    if (contract.schemaVersion !== 'skill-contract-v2') reasons.push('skill_contract_schema_invalid');
    if (!contract.skillId) reasons.push('skill_contract_id_missing');
    for (const key of ['allowed_repo_profiles', 'forbidden_repo_profiles', 'task_profiles', 'when_to_use', 'when_not_to_use', 'required_artifacts', 'forbidden_actions']) {
      if (!Array.isArray(contract[key])) reasons.push(`skill_contract_${key}_missing`);
    }
    for (const key of ['allowed_repo_profiles', 'task_profiles', 'when_to_use', 'when_not_to_use', 'required_artifacts', 'forbidden_actions']) {
      if (Array.isArray(contract[key]) && contract[key].length === 0) reasons.push(`skill_contract_${key}_empty`);
    }
    if (Number(contract.max_context_tokens || 0) <= 0 || Number(contract.max_context_tokens || 0) > 8000) reasons.push('skill_contract_context_budget_invalid');
    if (contract.artifact_pointer_first !== true) reasons.push('skill_contract_artifact_pointer_first_required');
    if (contract.raw_logs_forbidden !== true) reasons.push('skill_contract_raw_logs_forbidden_required');
    if (contract.owner_decision_boundary !== true) reasons.push('skill_contract_owner_boundary_required');
    if (!contract.output_contract) reasons.push('skill_contract_output_contract_missing');
    if (selected.has(contract.skillId) && Array.isArray(contract.forbidden_repo_profiles) && contract.forbidden_repo_profiles.includes(currentRepoProfile)) reasons.push('skill_contract_forbidden_repo_profile');
    if (selected.has(contract.skillId) && Array.isArray(contract.allowed_repo_profiles) && contract.allowed_repo_profiles.length > 0 && !contract.allowed_repo_profiles.includes(currentRepoProfile)) reasons.push('skill_contract_repo_profile_not_allowed');
  }
  return reasons.length ? fail(reasons) : pass({ selectedSkillCount: selected.size, contractCount: registry.contracts?.length || 0 });
}

export function validateSkillEffectivenessLedger(ledger = {}) {
  const reasons = [];
  if (ledger.ledgerVersion !== '1.2.3') reasons.push('skill_effectiveness_ledger_version_invalid');
  if (!SKILL_EFFECTIVENESS_STATUSES.has(ledger.skillEffectivenessStatus)) reasons.push('skill_effectiveness_status_invalid');
  for (const record of ledger.skillUseRecords || []) {
    if (!SKILL_CONTRIBUTIONS.has(record.contribution)) reasons.push('skill_effectiveness_contribution_invalid');
    if (!SKILL_DECISION_IMPACTS.has(record.decisionImpact)) reasons.push('skill_effectiveness_decision_impact_invalid');
    if (record.misfireDetected === true) reasons.push('skill_misfire_detected');
    if (record.forbiddenActionRecommended === true) reasons.push('skill_forbidden_action_recommended');
    if (record.contribution === 'harmful') reasons.push('skill_effectiveness_harmful');
    if (ledger.sourceHard === true && (record.contribution === 'unknown' || record.decisionImpact === 'unknown')) reasons.push('skill_effectiveness_unknown_source_hard');
  }
  if (ledger.skillEffectivenessStatus === 'blocked') reasons.push('skill_effectiveness_blocked');
  return reasons.length ? fail(reasons) : pass({ selectedSkillCount: ledger.selectedSkills?.length || 0 });
}

export function validateEscalationEffectivenessLedger(ledger = {}) {
  const reasons = [];
  if (ledger.ledgerVersion !== '1.2.3') reasons.push('escalation_effectiveness_ledger_version_invalid');
  if (!TYPED_BLOCKERS.has(ledger.beforeEscalationBlocker)) reasons.push('escalation_effectiveness_blocker_invalid');
  if (!ESCALATION_REASONS.has(ledger.escalationReason)) reasons.push('escalation_effectiveness_reason_invalid');
  if (!ESCALATED_AGENT_ROLES.has(ledger.escalatedAgentRole)) reasons.push('escalated_agent_role_invalid');
  if (!ESCALATION_EFFECTIVENESS_STATUSES.has(ledger.effectivenessStatus)) reasons.push('escalation_effectiveness_status_invalid');
  if (ledger.inputContextPacket?.rawLogsUsed === true) reasons.push('escalation_context_raw_logs_forbidden');
  const highTierUsed = ledger.escalatedAgentRole === 'highest_reasoning_reviewer';
  const noSignal = ledger.newFindingProduced !== true && ledger.repairPlanChanged !== true && ledger.validationImproved !== true && ledger.sameRootCauseResolved !== true;
  if (highTierUsed && noSignal) reasons.push('escalation_no_new_information');
  if (highTierUsed && Number(ledger.sameRootCauseRepeatCount || 0) >= 2 && noSignal) reasons.push('same_root_cause_after_high_tier_requires_new_signal_or_stop');
  return reasons.length ? fail(reasons) : pass({ escalatedAgentRole: ledger.escalatedAgentRole, effectivenessStatus: ledger.effectivenessStatus });
}

export function validateGoalContract(contract = {}) {
  const reasons = [];
  if (contract.goalContractVersion !== '1.2.4') reasons.push('goal_contract_version_invalid');
  if (!contract.goalId) reasons.push('goal_contract_id_required');
  if (!FINAL_DECISION_TERMINAL_ACTIONS.has(contract.terminalAction)) reasons.push('goal_contract_terminal_action_invalid');
  if (!Array.isArray(contract.successCriteria) || contract.successCriteria.length === 0) reasons.push('goal_contract_success_criteria_required');
  if (!Array.isArray(contract.requiredEvidence) || contract.requiredEvidence.length === 0) reasons.push('goal_contract_required_evidence_required');
  if (!Array.isArray(contract.forbiddenShortcuts)) reasons.push('goal_contract_forbidden_shortcuts_required');
  if (!Array.isArray(contract.verificationPlan) || contract.verificationPlan.length === 0) reasons.push('goal_contract_verification_plan_required');
  for (const action of contract.nonDelegableActions || []) {
    if (['release', 'deploy', 'wallet_rpc', 'secret_access', 'funded_transaction', 'governance_transaction', 'bscscan_verification', 'production_readiness_claim', 'legal_compliance_claim', 'youtube_policy_claim'].includes(action)) continue;
    if (String(action).includes('owner_authority')) continue;
  }
  const proof = contract.goalCompletionProof || {};
  if (proof.completionStatus === 'pass') {
    if (proof.successCriteriaSatisfied !== true) reasons.push('goal_completion_requires_success_criteria');
    if (proof.requiredEvidenceSatisfied !== true) reasons.push('goal_completion_requires_required_evidence');
    if (proof.forbiddenShortcutsAbsent !== true) reasons.push('goal_completion_requires_no_forbidden_shortcuts');
    if (proof.verificationPlanExecuted !== true) reasons.push('goal_completion_requires_verification_plan');
    if (Array.isArray(proof.remainingUnverifiedClaims) && proof.remainingUnverifiedClaims.length > 0) reasons.push('goal_completion_requires_no_unverified_claims');
  }
  if (!GOAL_COMPLETION_STATUSES.has(proof.completionStatus)) reasons.push('goal_completion_status_invalid');
  return reasons.length ? fail(reasons) : pass({ goalId: contract.goalId, terminalAction: contract.terminalAction });
}

export function validateDelegationBoundary(boundary = {}) {
  const reasons = [];
  if (boundary.delegationBoundaryVersion !== '1.2.4') reasons.push('delegation_boundary_version_invalid');
  if (!OWNER_AUTHORITY_STATES.has(boundary.ownerAuthorityState)) reasons.push('owner_authority_state_invalid');
  if (boundary.ownerAuthorityCreatedByAI === true) reasons.push('owner_authority_created_by_ai');
  if (boundary.ownerOnlyAuthorityBypassed === true) reasons.push('owner_only_authority_bypassed');
  if (boundary.expertJudgmentCanMerge === true) reasons.push('expert_judgment_cannot_merge');
  if (boundary.expertJudgmentCanRelease === true) reasons.push('expert_judgment_cannot_release');
  if (boundary.expertJudgmentCanClaimReadiness === true) reasons.push('expert_judgment_cannot_claim_readiness');
  const adapter = boundary.finalDecisionClosureAdapter || {};
  if (adapter.adapterVersion !== '1.2.4') reasons.push('final_decision_closure_adapter_version_invalid');
  if (adapter.finalAuthority !== 'v1.1.8_final_decision_kernel') reasons.push('final_decision_closure_adapter_authority_changed');
  if (adapter.createsFinalAuthority === true) reasons.push('final_decision_closure_adapter_cannot_create_authority');
  const revocation = boundary.delegationRevocation || {};
  if (revocation.revoked === true && revocation.continueAllowed === true) reasons.push('revoked_delegation_cannot_continue');
  const disagreement = boundary.expertDisagreement || {};
  if (disagreement.disagreementDetected === true && !['stop', 'ask_owner', 'request_more_evidence', 'continue_with_lower_risk_path'].includes(disagreement.arbiterAction)) reasons.push('expert_disagreement_action_invalid');
  return reasons.length ? fail(reasons) : pass({ ownerAuthorityState: boundary.ownerAuthorityState });
}

export function validateEvidenceSemanticsKernel(kernel = {}) {
  const reasons = [];
  if (kernel.evidenceSemanticsVersion !== '1.2.4') reasons.push('evidence_semantics_version_invalid');
  const phase = kernel.evidencePhase || {};
  if (!EVIDENCE_PHASES.has(phase.phase)) reasons.push('evidence_phase_invalid');
  if (phase.selfReferentialShaRequired === true) reasons.push('self_referential_sha_required_forbidden');
  if (kernel.machineEvidenceAuthority !== 'safe_artifact') reasons.push('machine_evidence_authority_must_be_safe_artifact');
  if (kernel.humanSummaryAuthority !== 'pr_body') reasons.push('human_summary_authority_must_be_pr_body');
  if (kernel.prBodyIsMachineEvidence === true || kernel.prBodyMachineBlocking === true) reasons.push('pr_body_cannot_be_machine_evidence');
  const sameHead = kernel.sameHeadEvidenceGate || {};
  if (kernel.currentHeadRequiredForMerge !== true) reasons.push('current_head_required_for_merge');
  if (sameHead.sameHeadEvidence !== true) reasons.push('same_head_evidence_required');
  const passSemantics = kernel.passSemantics || {};
  if (!PASS_MEANINGS.has(passSemantics.passMeaning)) reasons.push('pass_meaning_invalid');
  for (const forbiddenMeaning of ['production_readiness', 'runtime_readiness', 'owner_approval', 'legal_compliance', 'youtube_policy_compliance', 'release_permission']) {
    if (!Array.isArray(passSemantics.doesNotImply) || !passSemantics.doesNotImply.includes(forbiddenMeaning)) reasons.push(`pass_semantics_missing_${forbiddenMeaning}`);
  }
  if (passSemantics.productReadinessPass === true || passSemantics.runtimeEvidencePass === true || passSemantics.ownerAuthorityPass === true) reasons.push('pass_semantics_cannot_imply_readiness_or_owner_authority_by_default');
  const canonical = kernel.canonicalStatus || {};
  if (canonical.rawStatusReadDirectlyByFinalDecision === true) reasons.push('final_decision_must_use_canonical_status');
  return reasons.length ? fail(reasons) : pass({ phase: phase.phase, passMeaning: passSemantics.passMeaning });
}

export function validateTargetHarnessFootprintPolicy(policy = {}) {
  const reasons = [];
  if (policy.footprintVersion !== '1.2.4') reasons.push('target_footprint_version_invalid');
  for (const [key, reason] of [
    ['newP0ArtifactAllowed', 'target_footprint_blocks_new_p0_artifact'],
    ['newTopLevelStatusAllowed', 'target_footprint_blocks_new_top_level_status'],
    ['newSkillAllowed', 'target_footprint_blocks_new_skill'],
    ['workflowChangeAllowed', 'target_footprint_blocks_workflow_change'],
    ['productCodeChangeAllowed', 'target_footprint_blocks_product_code'],
    ['packageLockChangeAllowed', 'target_footprint_blocks_package_lock'],
    ['scoreOnlyRepairAllowed', 'target_footprint_blocks_score_only_repair'],
  ]) {
    if (policy[key] === true) reasons.push(reason);
  }
  if (Number(policy.agentsMaxLines || 0) > 80) reasons.push('target_footprint_agents_too_large');
  if (Number(policy.targetSpecMaxLines || 0) > 220) reasons.push('target_footprint_spec_too_large');
  if (Number(policy.activePolicyIndexMaxEntries || 0) > 8) reasons.push('target_footprint_policy_index_too_large');
  const visual = policy.repoSpecificVisualProofSurface || {};
  if (visual.enabled === true && visual.privateImageRedactionRequired !== true) reasons.push('visual_proof_requires_private_image_redaction');
  return reasons.length ? fail(reasons) : pass({ agentsMaxLines: policy.agentsMaxLines });
}

export function validateGoalShardAndProgressEvidence(control = {}) {
  const reasons = [];
  const shard = control.goalShard || {};
  const progress = control.progressEvidence || {};
  if (control.controlPlaneVersion !== '1.2.5') reasons.push('goal_shard_control_version_invalid');
  if (control.isControlPlaneNotAuthorityExpansion !== true) reasons.push('v125_must_be_control_plane_not_authority_expansion');
  if (Number(control.maxGoalShards || 0) > 8) reasons.push('goal_shard_cap_exceeded');
  if (!shard.goalId || !shard.objective) reasons.push('goal_shard_identity_required');
  if (!GOAL_SHARD_PHASES.has(shard.phase)) reasons.push('goal_shard_phase_invalid');
  if (!GOAL_SHARD_ROLES.has(shard.assignedRole)) reasons.push('goal_shard_role_invalid');
  if (!GOAL_VALIDATION_TIERS.has(shard.validationTier)) reasons.push('goal_shard_validation_tier_invalid');
  if (shard.expiresWhenHeadChanges !== true) reasons.push('goal_shard_expires_when_head_changes_required');
  if (shard.ownerAuthorityCreatedByShard === true) reasons.push('goal_shard_cannot_create_owner_authority');
  if (shard.duplicateGoalDetectionRequired !== true) reasons.push('goal_shard_duplicate_detection_required');
  if (shard.completionCompactsToSafeSummary !== true) reasons.push('goal_shard_completion_must_compact_to_safe_summary');
  for (const required of ['baseHead_changed', 'allowedFiles_overlap_without_arbiter', 'parentGoal_superseded', 'validationTier_no_longer_valid']) {
    if (!Array.isArray(shard.staleWhen) || !shard.staleWhen.includes(required)) reasons.push(`goal_shard_stale_when_missing_${required}`);
  }
  if (progress.progressReportStatus === 'pass' && (!Array.isArray(progress.toolEvidencePointers) || progress.toolEvidencePointers.length === 0)) reasons.push('progress_pass_requires_tool_evidence');
  if (Array.isArray(progress.unverifiedClaims) && progress.unverifiedClaims.length > 0 && progress.progressReportStatus === 'pass') reasons.push('progress_pass_forbids_unverified_claims');
  return reasons.length ? fail(reasons) : pass({ goalId: shard.goalId, validationTier: shard.validationTier });
}

export function validateEvidenceLaneAndQGLane(control = {}) {
  const reasons = [];
  const committed = control.committedEvidenceLane || {};
  const remote = control.remoteCurrentHeadLane || {};
  const owner = control.ownerIntentLane || {};
  const human = control.humanSummaryLane || {};
  const qg = control.qgLaneSemantics || {};
  if (control.controlPlaneVersion !== '1.2.5') reasons.push('evidence_lane_control_version_invalid');
  if (committed.currentHeadMergeEvidence === true && committed.boundByRemoteCurrentHeadLane !== true) reasons.push('committed_lane_not_current_head_merge_evidence');
  if (remote.sameHead === true && !remote.headSha) reasons.push('remote_current_head_lane_requires_head_sha_when_same_head');
  if (owner.ownerAuthorityCreatedByAI === true) reasons.push('owner_intent_lane_cannot_be_ai_created');
  if (human.prBodyIsHumanSummaryOnly !== true || human.prBodyIsMachineEvidence === true) reasons.push('pr_body_must_remain_human_summary_only');
  if (!QG_LANES.has(qg.currentLane)) reasons.push('qg_lane_invalid');
  if (!QG_TERMINAL_PHASES.has(qg.terminalPhase)) reasons.push('qg_terminal_phase_invalid');
  if (qg.currentLane === 'local_pre_pr' && qg.remoteEvidenceMissingIsNormal !== true) reasons.push('local_pre_pr_remote_missing_is_normal');
  if (qg.pendingIsFailure === true) reasons.push('qg_pending_must_not_be_failure');
  if (qg.sameHeadRemoteGateRequired === true && qg.terminalPhase !== 'merge_consideration') reasons.push('same_head_remote_gate_hard_only_for_merge_consideration');
  if (qg.sameHeadHardOnlyForMergeConsideration !== true) reasons.push('same_head_hard_phase_boundary_required');
  if (qg.terminalPhase === 'post_merge_verify' && qg.postMergeRequiresMarkerManifestDriftCheck !== true) reasons.push('post_merge_requires_marker_manifest_drift_check');
  return reasons.length ? fail(reasons) : pass({ currentLane: qg.currentLane, terminalPhase: qg.terminalPhase });
}

export function validateTypedMonitorInboxAndFanoutGuard(control = {}) {
  const reasons = [];
  const inbox = control.typedMonitorInbox || {};
  const fanout = control.fanoutRoiLedger || {};
  const newSignal = fanout.newFindingProduced === true || fanout.repairPlanChanged === true || fanout.validationImproved === true || fanout.sameRootCauseResolved === true;
  if (control.controlPlaneVersion !== '1.2.5') reasons.push('typed_monitor_control_version_invalid');
  if (!TYPED_MONITOR_ROLES.has(inbox.fromRole)) reasons.push('typed_monitor_from_role_invalid');
  if (!TYPED_MONITOR_TARGETS.has(inbox.toRole)) reasons.push('typed_monitor_to_role_invalid');
  if (!TYPED_MONITOR_MESSAGES.has(inbox.messageType)) reasons.push('typed_monitor_message_type_invalid');
  if (!TYPED_MONITOR_AUTHORITY.has(inbox.authorityLevel)) reasons.push('typed_monitor_authority_invalid');
  if (inbox.rawPromptInjection === true) reasons.push('typed_monitor_blocks_raw_prompt_injection');
  if (inbox.ownerAuthorityCreatedByMessage === true) reasons.push('typed_monitor_message_cannot_create_owner_authority');
  if (inbox.mutationAuthorizedByMessage === true) reasons.push('typed_monitor_message_cannot_authorize_mutation');
  if (Number(fanout.agentCount || 0) > 3) reasons.push('fanout_agent_cap_exceeded');
  if (!FANOUT_ROI_STATUSES.has(fanout.roiStatus)) reasons.push('fanout_roi_status_invalid');
  if (fanout.highestTierUsed === true && !newSignal && fanout.nextFanoutAllowed === true) reasons.push('fanout_stops_when_high_tier_produces_no_new_information');
  if (fanout.nextFanoutAllowed === true && !newSignal) reasons.push('fanout_requires_new_signal');
  return reasons.length ? fail(reasons) : pass({ messageType: inbox.messageType, roiStatus: fanout.roiStatus });
}

export function validateSkillReviewProductValueYield(control = {}) {
  const reasons = [];
  const skill = control.skillEffectiveness || {};
  const review = control.reviewYield || {};
  const product = control.productValueDelta || {};
  if (control.controlPlaneVersion !== '1.2.5') reasons.push('yield_control_version_invalid');
  if (skill.wrongProfileSkill === true) reasons.push('skill_yield_wrong_profile_hard_fail');
  if (skill.harmDetected === true) reasons.push('skill_yield_harm_detected');
  if (control.sourceHard === true && skill.effectivenessUnknown === true) reasons.push('skill_effectiveness_unknown_source_hard');
  if (control.sourceHard === true && review.reviewCostWorthIt === 'unknown') reasons.push('review_yield_unknown_source_hard');
  if (product.advisoryPressureOnly !== true) reasons.push('product_value_delta_must_be_advisory_only');
  if (product.authorizesProductCodeChange === true) reasons.push('product_value_delta_cannot_authorize_product_code');
  if (product.authorizesPackageOrLockfileChange === true) reasons.push('product_value_delta_cannot_authorize_package_or_lockfile');
  if (product.authorizesRuntimeReadiness === true) reasons.push('product_value_delta_cannot_authorize_runtime_readiness');
  if (product.overridesOwnerScope === true) reasons.push('product_value_delta_cannot_override_owner_scope');
  if (product.delta === 'evidence_only' && Number(product.evidenceOnlyRepetitionCount || 0) >= 2 && !product.nextProductSliceRecommendation) reasons.push('evidence_only_repetition_requires_owner_brief_recommendation');
  return reasons.length ? fail(reasons) : pass({ productValueDelta: product.delta, targetInitialRollout: control.targetInitialRollout === true });
}

export function validateObservedWorkspaceOwnerReceiptAndCapability(control = {}) {
  const reasons = [];
  const workspace = control.observedWorkspaceState || {};
  const owner = control.ownerDecisionReceipt || {};
  const delegated = control.ownerDelegatedProcessReceipt || {};
  const capability = control.capabilityBoundary || {};
  if (control.runtimeVersion !== '1.2.6') reasons.push('observed_state_runtime_version_invalid');
  if (workspace.wrongCwdDetected === true) reasons.push('wrong_cwd_blocks_v126_loop');
  if (workspace.staleCloneDetected === true) reasons.push('stale_clone_blocks_v126_loop');
  if (workspace.frozenBranchUsed === true) reasons.push('frozen_branch_blocks_v126_loop');
  if (workspace.worktreeClean !== true) reasons.push('observed_workspace_requires_clean_worktree');
  if (workspace.mutationAllowedHere !== true) reasons.push('observed_workspace_mutation_not_allowed');
  if (!V126_OWNER_ACTIONS.has(owner.allowedAction)) reasons.push('owner_receipt_action_invalid');
  if (!V126_OWNER_SCOPES.has(owner.scope)) reasons.push('owner_receipt_scope_invalid');
  if (owner.ownerAuthorityCreatedByAI === true) reasons.push('owner_receipt_cannot_be_created_by_ai');
  if (owner.allowedAction === 'merge_current_pr') {
    if (owner.present !== true) reasons.push('merge_action_requires_owner_decision_receipt');
    if (!owner.headSha) reasons.push('merge_receipt_requires_head_sha');
    if (owner.expiresOnHeadChange !== true) reasons.push('merge_receipt_must_expire_on_head_change');
  }
  for (const required of V126_FORBIDDEN_AUTHORIZATIONS) {
    if (!Array.isArray(owner.forbiddenAuthorizations) || !owner.forbiddenAuthorizations.includes(required)) reasons.push(`owner_receipt_missing_forbidden_${required}`);
  }
  if (delegated.ownerAuthorityCreatedByAI === true) reasons.push('delegated_process_receipt_cannot_be_created_by_ai');
  for (const action of delegated.allowedActions || []) {
    if (['release', 'deploy', 'wallet_rpc', 'secret_access', 'readiness_claim', 'github_approval_review'].includes(action)) reasons.push(`delegated_process_forbidden_${action}`);
  }
  if (delegated.autoContinueAllowed === true && delegated.present !== true) reasons.push('delegated_auto_continue_requires_receipt');
  if (capability.bridgeDefaultEnabled === true) reasons.push('bridge_must_not_be_default_on');
  if (capability.workspaceOnlyWrite !== true) reasons.push('bridge_write_must_be_workspace_only');
  if (capability.secretPathBlocked !== true) reasons.push('capability_boundary_secret_path_required');
  if (capability.rawLogsForbidden !== true || capability.rawTranscriptMiningForbidden !== true) reasons.push('capability_boundary_forbids_raw_logs_and_transcripts');
  if (capability.walletRpcDeployForbidden !== true) reasons.push('capability_boundary_wallet_rpc_deploy_forbidden');
  if (capability.bridgeTranscriptMachineEvidence === true) reasons.push('bridge_transcript_cannot_be_machine_evidence');
  if (capability.ownerAuthorityCreatedByBridge === true) reasons.push('bridge_cannot_create_owner_authority');
  if (capability.executionDigestRequired !== true) reasons.push('bridge_requires_safe_execution_digest');
  return reasons.length ? fail(reasons) : pass({ currentBranch: workspace.currentBranch, ownerAction: owner.allowedAction });
}

export function validateSpecFirstCheckerBuilderLoopAndStopCircuit(control = {}) {
  const reasons = [];
  if (control.runtimeVersion !== '1.2.6') reasons.push('checker_builder_loop_runtime_version_invalid');
  if (control.specFirstRequired !== true) reasons.push('spec_first_required');
  if (control.builderCanEdit !== true) reasons.push('builder_must_be_explicit_edit_role');
  if (control.checkerCanEdit === true) reasons.push('checker_must_be_read_only');
  if (control.checkerOutputRequiredForSuccess !== true) reasons.push('checker_output_required_for_success');
  if (control.sameAgentCannotSatisfyIndependentCheck !== true) reasons.push('same_agent_cannot_satisfy_independent_check');
  if (Number(control.maxCycles || 0) > 5) reasons.push('loop_cycle_cap_exceeded');
  if (Number(control.sameFailureRepeatLimit || 0) > 2) reasons.push('same_failure_repeat_cap_exceeded');
  if (control.regressionStops !== true) reasons.push('regression_stop_required');
  if (control.testWeakeningStops !== true) reasons.push('test_weakening_stop_required');
  if (control.regressionDetected === true) reasons.push('loop_stops_on_regression');
  if (control.testWeakeningDetected === true) reasons.push('loop_stops_on_test_weakening');
  if (!V126_LOOP_EXIT_REASONS.has(control.loopExitReason)) reasons.push('loop_exit_reason_invalid');
  if (control.loopContinuationAllowed === true && Number(control.currentCycle || 0) >= Number(control.maxCycles || 0)) reasons.push('loop_continue_after_cycle_cap');
  if (control.loopContinuationAllowed === true && Number(control.sameFailureRepeatCount || 0) >= Number(control.sameFailureRepeatLimit || 0)) reasons.push('loop_continue_after_same_failure_repeat_cap');
  return reasons.length ? fail(reasons) : pass({ loopExitReason: control.loopExitReason });
}

export function validateEvidenceLaneStateMachineAndSafeFailureCapsule(control = {}) {
  const reasons = [];
  const lane = control.evidenceLaneStateMachine || {};
  const failure = control.safeFailureCapsule || {};
  if (control.runtimeVersion !== '1.2.6') reasons.push('evidence_lane_state_machine_version_invalid');
  if (!V126_LANE_STATES.has(lane.currentState)) reasons.push('v126_lane_state_invalid');
  if (!V126_REMOTE_STATUSES.has(lane.remoteStatus)) reasons.push('v126_remote_status_invalid');
  if (lane.prBodyMachineEvidence === true) reasons.push('pr_body_cannot_be_machine_evidence_v126');
  if (lane.currentState === 'local_pre_pr' && lane.remoteStatus !== 'missing') reasons.push('local_pre_pr_remote_status_should_be_missing');
  if (lane.currentState === 'pushed_pr_waiting_qg' && !['pending', 'missing'].includes(lane.remoteStatus)) reasons.push('waiting_qg_allows_only_pending_or_missing');
  if (lane.currentState === 'same_head_remote_qg' && lane.remoteStatus === 'pass' && lane.sameHead !== true) reasons.push('same_head_remote_pass_requires_same_head');
  if (lane.currentState === 'merge_consideration') {
    if (lane.remoteStatus !== 'pass' || lane.sameHead !== true) reasons.push('merge_consideration_requires_same_head_remote_pass');
    if (lane.ownerReceiptRequiredForMerge !== true) reasons.push('merge_consideration_requires_owner_receipt_boundary');
    if (lane.sameHeadRemoteRequiredForMerge !== true) reasons.push('merge_consideration_cannot_skip_same_head_remote');
    if (lane.finalDecisionClosureRequired !== true) reasons.push('merge_consideration_requires_final_decision_closure');
  }
  if (failure.rawLogIncluded === true || failure.rawTranscriptIncluded === true || failure.rawDiffIncluded === true) reasons.push('safe_failure_capsule_forbids_raw_inputs');
  if (failure.scopeExpansionAllowed === true) reasons.push('safe_failure_capsule_cannot_expand_scope');
  if (failure.onePrimaryClass !== true) reasons.push('safe_failure_capsule_requires_one_primary_class');
  if (failure.builderInstruction !== 'fix_root_cause_only') reasons.push('safe_failure_capsule_requires_root_cause_only_instruction');
  return reasons.length ? fail(reasons) : pass({ currentState: lane.currentState, remoteStatus: lane.remoteStatus });
}

export function validateContextSkillValidationBudgetRouter(control = {}) {
  const reasons = [];
  if (control.runtimeVersion !== '1.2.6') reasons.push('context_skill_validation_router_version_invalid');
  if (Number(control.maxSkillCount || 0) > 2) reasons.push('v126_skill_count_cap_exceeded');
  if (Number(control.maxMdFilesRead || 0) > 3) reasons.push('v126_md_file_read_cap_exceeded');
  if ((control.selectedSkills || []).length > Number(control.maxSkillCount || 0)) reasons.push('selected_skills_over_v126_budget');
  if ((control.mdFilesRead || []).length > Number(control.maxMdFilesRead || 0)) reasons.push('md_files_read_over_v126_budget');
  if (!V126_VALIDATION_TIERS.has(control.selectedValidationTier)) reasons.push('validation_tier_invalid_v126');
  if (control.sameHeadRemoteGateCannotBeSkippedForMerge !== true) reasons.push('same_head_remote_gate_cannot_be_skipped_for_merge');
  if (control.contextReductionMustNotReduceEvidence !== true) reasons.push('context_reduction_must_not_reduce_evidence');
  if (control.skillRoutingMustNotReduceVerification !== true) reasons.push('skill_routing_must_not_reduce_verification');
  if (control.knowledgePointerCannotOverrideChangedFiles !== true) reasons.push('knowledge_pointer_cannot_override_changed_files');
  if (control.validationRouterCannotSkipSameHeadRemoteForMerge !== true) reasons.push('validation_router_cannot_skip_same_head_remote_for_merge');
  return reasons.length ? fail(reasons) : pass({ selectedValidationTier: control.selectedValidationTier });
}

export function validateSkillReviewProductValueEffectiveness(control = {}) {
  const reasons = [];
  const skill = control.skillEffectiveness || {};
  const review = control.reviewEffectiveness || {};
  const product = control.productValueReturnGate || {};
  if (control.runtimeVersion !== '1.2.6') reasons.push('skill_review_product_value_effectiveness_version_invalid');
  if (skill.wrongProfileSkill === true) reasons.push('v126_wrong_profile_skill_hard_fail');
  if (skill.harmfulSkill === true) reasons.push('v126_harmful_skill_hard_fail');
  if (!V126_SKILL_NET_VALUES.has(skill.netValue)) reasons.push('skill_net_value_invalid');
  if (skill.netValue === 'negative' && skill.wrongSkillCost === 0) reasons.push('negative_skill_value_requires_wrong_skill_cost');
  if (review.fanoutContinuationAllowed === true && Number(review.noNewSignalRepeatCount || 0) >= 2) reasons.push('fanout_stops_after_two_no_new_signal_cycles');
  if (review.negativeFindingRequiredWhenHighRisk === true && review.assumptionDiffPresent !== true && Number(review.newFindingCount || 0) === 0) reasons.push('high_risk_review_requires_assumption_diff_or_new_finding');
  if (product.productScopeAuthorized === true) reasons.push('product_value_return_gate_cannot_authorize_product_scope');
  if (product.evidenceOnlyRepeated === true && Number(product.recentHarnessOnlyCount || 0) >= 3 && product.nextProductSliceRecommended !== true) reasons.push('repeated_harness_only_requires_next_product_slice_recommendation');
  return reasons.length ? fail(reasons) : pass({ skillNetValue: skill.netValue, recentHarnessOnlyCount: product.recentHarnessOnlyCount });
}

export function validateTypedOwnerProcessReceiptAndContinuationKernel(control = {}) {
  const reasons = [];
  const process = control.ownerProcessReceipt || {};
  const conditional = control.ownerConditionalMergeReceipt || {};
  const product = control.ownerProductScopeReceipt || {};
  const dangerous = control.ownerDangerousCapabilityReceipt || {};
  const continuation = control.continuationDecision || {};
  if (control.runtimeVersion !== '1.2.7') reasons.push('typed_owner_process_receipt_version_invalid');
  if (!V127_OWNER_INTENTS.has(control.normalizedOwnerIntent)) reasons.push('normalized_owner_intent_invalid');
  for (const action of process.allowedActions || []) if (!V127_RECEIPT_ACTIONS.has(action)) reasons.push(`owner_process_action_invalid_${action}`);
  if (process.survivesInScopeCommitHeadChanges !== true) reasons.push('process_receipt_must_survive_in_scope_commit_head_changes');
  if (process.expiresOnScopeDelta !== true) reasons.push('process_receipt_must_expire_on_scope_delta');
  if (!process.scopeDigest) reasons.push('process_receipt_requires_scope_digest');
  if (process.ownerAuthorityCreatedByAI === true) reasons.push('process_receipt_cannot_be_ai_created');
  if (process.present === true && process.receiptProvenancePresent !== true) reasons.push('owner_process_receipt_requires_provenance');
  if (process.present === true && (!process.receiptId || !process.taskId || (!process.ownerInstructionHash && !process.sourceInstructionRef))) reasons.push('owner_process_receipt_missing_receipt_task_or_instruction_ref');
  if (control.normalizedOwnerIntent === 'harness_source_develop_and_publish' && process.present === true) {
    for (const action of ['commit', 'push', 'create_pr']) {
      if (!process.allowedActions?.includes(action)) reasons.push(`develop_publish_missing_${action}`);
    }
  }
  if (conditional.present === true) {
    if (!V127_CONDITIONAL_MERGE_SCOPES.has(conditional.scope) || conditional.scope === 'none') reasons.push('conditional_merge_receipt_scope_invalid');
    if (conditional.requiresSameHeadRequiredChecksPass !== true) reasons.push('conditional_merge_requires_same_head_required_checks');
    if (conditional.requiresScopeDigestUnchanged !== true) reasons.push('conditional_merge_requires_scope_digest_unchanged');
    if (conditional.requiresFinalDecisionAllowsMerge !== true) reasons.push('conditional_merge_requires_final_decision');
    if (conditional.expiresOnScopeDelta !== true) reasons.push('conditional_merge_expires_on_scope_delta');
    if (conditional.scope === 'exact_head' && !conditional.headSha) reasons.push('exact_head_merge_receipt_requires_head_sha');
    if (conditional.ownerAuthorityCreatedByAI === true) reasons.push('conditional_merge_receipt_cannot_be_ai_created');
  }
  if (product.present !== true && (product.productCodeChangeAllowed || product.packageOrLockfileChangeAllowed || product.workflowChangeAllowed)) reasons.push('product_scope_requires_product_scope_receipt');
  if (dangerous.present !== true) {
    for (const [key, value] of Object.entries(dangerous)) {
      if (key !== 'present' && value === true) reasons.push(`dangerous_capability_requires_receipt_${key}`);
    }
  }
  if (!V127_CONTINUATION_STATES.has(continuation.state)) reasons.push('continuation_state_invalid');
  if (continuation.state === 'continue' && process.present !== true) reasons.push('continue_requires_owner_process_receipt');
  if (continuation.state === 'continue' && process.receiptProvenancePresent !== true) reasons.push('continue_requires_owner_receipt_provenance');
  if (continuation.state === 'continue' && continuation.receiptValid !== true) reasons.push('continue_requires_valid_receipt');
  if (continuation.state === 'continue' && continuation.scopeDeltaDetected === true) reasons.push('continue_forbidden_after_scope_delta');
  if (continuation.state === 'continue' && continuation.avoidableOwnerStopDetected === true) reasons.push('avoidable_owner_stop_detected');
  if (continuation.state === 'clarify_once' && continuation.receiptValid === true && continuation.scopeDeltaDetected !== true) reasons.push('clarify_once_unnecessary_when_receipt_valid_and_scope_clean');
  return reasons.length ? fail(reasons) : pass({ state: continuation.state, normalizedOwnerIntent: control.normalizedOwnerIntent });
}

export function validateDecisionEvidenceEnvelopeAndSameHeadBinder(control = {}) {
  const reasons = [];
  const envelope = control.decisionEvidenceEnvelope || {};
  const binder = control.sameHeadBinder || {};
  if (control.runtimeVersion !== '1.2.7') reasons.push('decision_evidence_envelope_version_invalid');
  if (!V127_LANES.has(envelope.lane)) reasons.push('decision_evidence_lane_invalid');
  if (!V127_ALLOWED_NEXT_ACTIONS.has(envelope.allowedNextAction)) reasons.push('decision_evidence_allowed_next_action_invalid');
  if (!V127_REMOTE_STATUSES.has(envelope.remoteGate)) reasons.push('decision_evidence_remote_gate_invalid');
  if (envelope.prBodyMachineEvidence === true) reasons.push('decision_evidence_pr_body_is_display_only');
  if (binder.prBodyIsDisplayOnly !== true) reasons.push('same_head_binder_pr_body_display_only_required');
  if (binder.rejectsHeadMismatch !== true) reasons.push('same_head_binder_must_reject_head_mismatch');
  if (binder.sameHeadDerivedFromHashes !== true) reasons.push('same_head_must_be_derived_from_hashes');
  if (envelope.sameHead === true && (binder.allRequiredHeadsPresent !== true || binder.allRequiredHeadsMatch !== true)) reasons.push('same_head_true_requires_non_null_matching_heads');
  if (envelope.lane === 'merge_boundary') {
    if (envelope.sameHead !== true) reasons.push('merge_boundary_requires_same_head');
    if (binder.allRequiredHeadsPresent !== true) reasons.push('merge_boundary_requires_all_required_heads');
    if (binder.allRequiredHeadsMatch !== true) reasons.push('merge_boundary_requires_matching_required_heads');
    if (envelope.remoteGate !== 'pass') reasons.push('merge_boundary_requires_remote_pass');
    if (envelope.ownerReceiptBinding !== 'valid') reasons.push('merge_boundary_requires_owner_receipt_binding');
    if (envelope.allowedNextAction !== 'merge_current_pr') reasons.push('merge_boundary_next_action_must_be_merge_current_pr');
  }
  if (['same_head_remote_qg', 'merge_boundary'].includes(envelope.lane) && envelope.sameHead === false && !envelope.oneBlockingReason) reasons.push('head_mismatch_requires_one_blocking_reason');
  if (envelope.lane === 'blocked_recovery' && !envelope.oneBlockingReason) reasons.push('blocked_recovery_requires_one_blocking_reason');
  return reasons.length ? fail(reasons) : pass({ lane: envelope.lane, allowedNextAction: envelope.allowedNextAction });
}

export function validateValidationDagAndContentAddressedReuse(control = {}) {
  const reasons = [];
  const cache = control.validationCacheKey || {};
  if (control.runtimeVersion !== '1.2.7') reasons.push('validation_dag_version_invalid');
  if (control.validationPlanVersion !== 'v127') reasons.push('validation_plan_version_invalid');
  for (const required of ['headSha', 'validationPlanVersion', 'scriptDigest', 'lockfileDigest', 'runnerImage', 'nodeOrRuntimeVersion', 'taskProfile', 'environmentClass']) {
    if (!cache[required]) reasons.push(`validation_cache_key_missing_${required}`);
    if (V127_PLACEHOLDER_VALUES.has(String(cache[required] || '').toLowerCase()) && !['lockfileDigest'].includes(required)) reasons.push(`validation_cache_key_placeholder_${required}`);
  }
  for (const required of ['validation_script', 'workflow', 'lockfile', 'runtime', 'runner', 'task_profile', 'changed_category', 'required_check_policy']) {
    if (!control.invalidatesOn?.includes(required)) reasons.push(`validation_cache_missing_invalidator_${required}`);
  }
  if (control.reuseStatus === 'hit' && !control.priorArtifactPointer) reasons.push('validation_cache_hit_requires_prior_artifact_pointer');
  if (control.reuseStatus === 'hit' && Object.entries(cache).some(([key, value]) => key !== 'lockfileDigest' && V127_PLACEHOLDER_VALUES.has(String(value || '').toLowerCase()))) reasons.push('validation_cache_hit_forbids_placeholder_key');
  if (control.nightlyFullGateReplacesPremergeRequiredChecks === true) reasons.push('nightly_full_gate_cannot_replace_premerge_required_checks');
  return reasons.length ? fail(reasons) : pass({ reusedValidationResults: control.reusedValidationResults, newValidationExecutions: control.newValidationExecutions });
}

export function validateContextOutputOwnerInterruptTokenBudget(control = {}) {
  const reasons = [];
  const metrics = control.tokenEconomyMetrics || {};
  const output = control.outputBudget || {};
  if (control.runtimeVersion !== '1.2.7') reasons.push('token_budget_version_invalid');
  if (output.requireObservedMetrics === true && metrics.observed !== true) reasons.push('token_metrics_must_be_observed');
  if ((output.requireObservedMetrics === true || metrics.observed === true) && (!metrics.metricsSource || metrics.metricsSource === 'not_observed')) reasons.push('token_metrics_source_required');
  if (metrics.observed === true && Number(metrics.safeArtifactBytes || 0) <= 0) reasons.push('safe_artifact_bytes_must_be_observed');
  if (metrics.observed === true && Number(metrics.routineArtifactBytes || 0) <= 0) reasons.push('routine_artifact_bytes_must_be_observed');
  if (metrics.observed === true && Number(metrics.outputLineCount || 0) <= 0) reasons.push('output_line_count_must_be_observed');
  if (metrics.observed === true && metrics.countsSource !== 'observed_trace' && metrics.countsSource !== 'declared_budget') reasons.push('token_counts_source_invalid');
  if (metrics.observed === true && metrics.countsSource === 'declared_budget' && metrics.observedCounts === true) reasons.push('declared_budget_counts_cannot_be_observed');
  if (Number(metrics.authorityMarkdownReads || 0) > 2) reasons.push('authority_markdown_reads_over_budget');
  if (Number(metrics.safeArtifactReads || 0) > Number(output.safeArtifactReadsMax || 0)) reasons.push('safe_artifact_reads_over_budget');
  if (Number(metrics.selectedSkills || 0) > Number(output.selectedSkillsMax || 0)) reasons.push('selected_skills_over_v127_budget');
  if (Number(metrics.routineArtifactBytes || 0) > Number(output.routineArtifactBytesMax || 0)) reasons.push('routine_artifact_bytes_over_budget');
  if (Number(metrics.ownerInterruptCount || 0) > 0) reasons.push('owner_interrupt_count_should_be_zero_under_valid_process_receipt');
  if (Number(metrics.repeatedSafetyTextCount || 0) > 1) reasons.push('repeated_safety_text_not_suppressed');
  if (Number(metrics.extraReads || 0) > 2) reasons.push('extra_reads_over_budget');
  if (Number(metrics.operatorOutputLines || 0) > Number(output.finalReportLineBudget || 0)) reasons.push('operator_output_lines_over_final_report_budget');
  if (Number(output.finalReportLineBudget || 0) > 20) reasons.push('final_report_line_budget_too_large');
  if (output.repeatedSafetyTextSuppressed !== true) reasons.push('repeated_safety_text_suppression_required');
  return reasons.length ? fail(reasons) : pass({ ownerInterruptCount: metrics.ownerInterruptCount, operatorOutputLines: metrics.operatorOutputLines });
}

export function validateV127PermissionGrantReceiptCoherence(capsule = {}) {
  const reasons = [];
  const grant = capsule.permissionGrant || {};
  const kernel = capsule.typedOwnerProcessReceiptAndContinuationKernel || {};
  const process = kernel.ownerProcessReceipt || {};
  const continuation = kernel.continuationDecision || {};
  const allowed = new Set(process.allowedActions || []);
  const validProcessReceipt = process.present === true && process.receiptProvenancePresent === true && continuation.receiptValid === true && continuation.scopeDeltaDetected !== true;
  if (grant.permissionEvidenceSource === 'owner_process_receipt' && validProcessReceipt !== true) reasons.push('owner_process_permission_source_requires_valid_receipt');
  if (validProcessReceipt === true) {
    if (grant.permissionEvidenceSource !== 'owner_process_receipt') reasons.push('valid_process_receipt_requires_permission_source');
    if (grant.mutationPermissionAuthority !== 'owner_explicit_only') reasons.push('valid_process_receipt_requires_owner_explicit_mutation_authority');
    const actionMap = { commit: 'commit', push: 'push', create_pr: 'createPr', rerun_ci: 'rerunCi', fix_ci: 'fixCi' };
    for (const [receiptAction, grantKey] of Object.entries(actionMap)) {
      if (allowed.has(receiptAction) && grant[grantKey] !== true) reasons.push(`permission_grant_missing_${grantKey}_from_receipt`);
      if (!allowed.has(receiptAction) && grant[grantKey] === true && grant.permissionEvidenceSource === 'owner_process_receipt') reasons.push(`permission_grant_overstates_${grantKey}`);
    }
  }
  return reasons.length ? fail(reasons) : pass({ permissionEvidenceSource: grant.permissionEvidenceSource || 'none' });
}

export function validateBlockerClosureAndProductValuePressure(control = {}) {
  const reasons = [];
  const blocker = control.typedBlockerClosure || {};
  const product = control.productValuePressure || {};
  const skill = control.skillRoiOptimization || {};
  if (control.runtimeVersion !== '1.2.7') reasons.push('blocker_closure_product_value_version_invalid');
  if (!V127_BLOCKER_RECOVERIES.has(blocker.recovery)) reasons.push('blocker_recovery_invalid');
  if (blocker.onePrimaryClass !== true) reasons.push('blocker_closure_requires_one_primary_class');
  if (blocker.blocker !== 'none' && blocker.recovery === 'none') reasons.push('typed_blocker_requires_recovery_class');
  if (product.portfolioRolloutCountsAsOneHarnessCycle !== true) reasons.push('portfolio_rollout_must_count_as_one_harness_cycle');
  if (product.advisoryOnly !== true) reasons.push('product_value_pressure_must_be_advisory_only');
  if (product.productScopeAuthorized === true) reasons.push('product_value_pressure_cannot_authorize_product_scope');
  if (!V127_SKILL_ROI.has(skill.roiStatus)) reasons.push('skill_roi_status_invalid');
  if (skill.mandatorySafetySkill === true && skill.roiStatus === 'negative') reasons.push('mandatory_safety_skill_cannot_be_roi_disabled');
  if (skill.roiStatus === 'neutral' && skill.disabledAfterTwoNeutralSamples === true) reasons.push('neutral_skill_not_disabled_after_two_samples');
  return reasons.length ? fail(reasons) : pass({ recovery: blocker.recovery, productValueDelta: product.productValueDelta });
}

export function validateSkillContextRouting(routing = {}) {
  const reasons = [];
  const taskProfile = TASK_PROFILES.has(routing.taskProfile) ? routing.taskProfile : 'routine';
  const budget = READ_BUDGET_BY_TASK_PROFILE[taskProfile];
  const selectedSkills = Array.isArray(routing.selectedSkills) ? routing.selectedSkills : [];
  const mdFilesRead = Array.isArray(routing.mdFilesRead) ? routing.mdFilesRead : [];
  const selectedSkillsMax = Number(routing.selectedSkillsMax || budget.selectedSkillsMax);
  const mdFilesReadMax = Number(routing.mdFilesReadMax || budget.mdFilesReadMax);
  const effectiveSelectedSkillsMax = Math.min(selectedSkillsMax, budget.selectedSkillsMax);
  const effectiveMdFilesReadMax = Math.min(mdFilesReadMax, budget.mdFilesReadMax);
  const authority = routing.activeAuthorityTuple || {};
  const blockers = new Set(routing.blockerClasses || []);
  if (!['1.2.2', '1.2.3', '1.2.4', '1.2.5', '1.2.6', '1.2.7'].includes(routing.schemaVersion)) reasons.push('skill_context_routing_schema_invalid');
  if (!TASK_PROFILES.has(routing.taskProfile)) reasons.push('task_profile_invalid');
  if (selectedSkillsMax > budget.selectedSkillsMax) reasons.push('selected_skills_max_cannot_override_task_profile_budget');
  if (mdFilesReadMax > budget.mdFilesReadMax) reasons.push('md_files_read_max_cannot_override_task_profile_budget');
  if (selectedSkills.length > effectiveSelectedSkillsMax) reasons.push('selected_skills_over_task_profile_budget');
  if (selectedSkills.length >= 3) {
    if (budget.selectedSkillsMax < 3) reasons.push('third_skill_forbidden_by_task_profile');
    if (routing.thirdSkillAllowed !== true) reasons.push('third_skill_requires_explicit_allowance');
    if (!routing.typedJustification) reasons.push('third_skill_requires_typed_justification');
    if ((routing.tokenBudgetStatus || 'pass') !== 'pass') reasons.push('third_skill_requires_token_budget_pass');
    if (routing.safeNextAction !== 'one_action') reasons.push('third_skill_requires_one_safe_next_action');
  }
  if (mdFilesRead.length > effectiveMdFilesReadMax && !routing.typedJustification) reasons.push('md_files_read_over_budget_without_typed_justification');
  if (mdFilesRead.length > effectiveMdFilesReadMax && routing.typedJustification && routing.readBudgetStatus === 'pass') reasons.push('md_overread_requires_warn_or_blocked_status');
  if (routing.profileIdOnlyMode !== true) reasons.push('profile_id_only_mode_required');
  if (routing.repeatedForbiddenTextSuppressed !== true) reasons.push('repeated_forbidden_text_must_be_suppressed');
  if (routing.skillMisfireDetected === true) reasons.push('skill_misfire_detected');
  if (routing.fullHistoryReadAllowed === true && !routing.typedJustification) reasons.push('full_history_read_requires_typed_justification');
  if (routing.legacySpecReadAllowed === true && !['compatibility_failure', 'authority_conflict'].includes(routing.legacySpecReadReason)) reasons.push('legacy_spec_read_requires_failure_reason');
  if (!READ_BUDGET_STATUS.has(routing.readBudgetStatus)) reasons.push('read_budget_status_invalid');
  if (routing.readBudgetStatus === 'blocked') reasons.push('read_budget_blocked');
  for (const blocker of blockers) if (HARD_CONTEXT_BLOCKERS.has(blocker)) reasons.push(blocker);
  if (!['CODEX_QUALITY_HARNESS_FILE v1.2.2', 'CODEX_QUALITY_HARNESS_FILE v1.2.3', 'CODEX_QUALITY_HARNESS_FILE v1.2.4', 'CODEX_QUALITY_HARNESS_FILE v1.2.5', 'CODEX_QUALITY_HARNESS_FILE v1.2.6', 'CODEX_QUALITY_HARNESS_FILE v1.2.7'].includes(authority.agentsMarker)) reasons.push('active_authority_agents_marker_missing');
  if (!['1.2.2', '1.2.3', '1.2.4', '1.2.5', '1.2.6', '1.2.7'].includes(authority.manifestActiveHarnessVersion)) reasons.push('active_authority_manifest_version_missing');
  if (!['v122', 'v123', 'v124', 'v125', 'v126', 'v127'].includes(authority.activeSelfTestSuite)) reasons.push('active_authority_self_test_missing');
  if (!['docs/process/CODEX_V122_SPEC.md', 'docs/process/CODEX_V123_SPEC.md', 'docs/process/CODEX_V124_SPEC.md', 'docs/process/CODEX_V125_SPEC.md', 'docs/process/CODEX_V126_SPEC.md', 'docs/process/CODEX_V127_SPEC.md'].includes(authority.activeSpecPath)) reasons.push('active_authority_spec_path_missing');
  if (authority.finalAuthorityPointer !== 'v1.1.8_final_decision_kernel') reasons.push('active_authority_final_decision_pointer_missing');
  if (routing.ownerProvidedContext?.countedAsFileRead === true) reasons.push('owner_provided_context_not_file_read');
  return reasons.length ? fail(reasons) : pass({ taskProfile, selectedSkills: selectedSkills.length, mdFilesRead: mdFilesRead.length, readBudgetStatus: routing.readBudgetStatus });
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
    skillContextRoutingInternalStatus: validateSkillContextRouting(capsule.skillContextRouting || {}),
    finalDecisionClosureInternalStatus: validateFinalDecisionClosure(capsule.finalDecisionClosure || {}),
    workspaceIdentityInternalStatus: validateWorkspaceIdentityGate(capsule.workspaceIdentityGate || {}),
    activePolicyIndexInternalStatus: validateActivePolicyIndex(capsule.activePolicyIndex || {}),
    contextReadLedgerInternalStatus: validateContextReadLedger(capsule.contextReadLedger || {}),
    skillContractRegistryInternalStatus: validateSkillContractRegistry(capsule.skillContractRegistry || {}),
    skillEffectivenessLedgerInternalStatus: validateSkillEffectivenessLedger(capsule.skillEffectivenessLedger || {}),
    escalationEffectivenessLedgerInternalStatus: validateEscalationEffectivenessLedger(capsule.escalationEffectivenessLedger || {}),
    goalContractInternalStatus: validateGoalContract(capsule.goalContract || {}),
    delegationBoundaryInternalStatus: validateDelegationBoundary(capsule.delegationBoundary || {}),
    evidenceSemanticsInternalStatus: validateEvidenceSemanticsKernel(capsule.evidenceSemanticsKernel || {}),
    targetHarnessFootprintInternalStatus: validateTargetHarnessFootprintPolicy(capsule.targetHarnessFootprintPolicy || {}),
    goalShardProgressInternalStatus: validateGoalShardAndProgressEvidence(capsule.goalShardAndProgressEvidence || {}),
    evidenceLaneQGInternalStatus: validateEvidenceLaneAndQGLane(capsule.evidenceLaneAndQGLaneSemantics || {}),
    typedMonitorFanoutInternalStatus: validateTypedMonitorInboxAndFanoutGuard(capsule.typedMonitorInboxAndFanoutGuard || {}),
    skillReviewProductValueInternalStatus: validateSkillReviewProductValueYield(capsule.skillReviewProductValueYield || {}),
    observedWorkspaceOwnerReceiptCapabilityInternalStatus: validateObservedWorkspaceOwnerReceiptAndCapability(capsule.observedWorkspaceOwnerReceiptAndCapability || {}),
    checkerBuilderLoopStopCircuitInternalStatus: validateSpecFirstCheckerBuilderLoopAndStopCircuit(capsule.specFirstCheckerBuilderLoopAndStopCircuit || {}),
    evidenceLaneStateMachineSafeFailureInternalStatus: validateEvidenceLaneStateMachineAndSafeFailureCapsule(capsule.evidenceLaneStateMachineAndSafeFailureCapsule || {}),
    contextSkillValidationBudgetRouterInternalStatus: validateContextSkillValidationBudgetRouter(capsule.contextSkillValidationBudgetRouter || {}),
    skillReviewProductValueEffectivenessInternalStatus: validateSkillReviewProductValueEffectiveness(capsule.skillReviewProductValueEffectiveness || {}),
    typedOwnerProcessReceiptContinuationInternalStatus: validateTypedOwnerProcessReceiptAndContinuationKernel(capsule.typedOwnerProcessReceiptAndContinuationKernel || {}),
    decisionEvidenceEnvelopeSameHeadInternalStatus: validateDecisionEvidenceEnvelopeAndSameHeadBinder(capsule.decisionEvidenceEnvelopeAndSameHeadBinder || {}),
    validationDagEvidenceReuseInternalStatus: validateValidationDagAndContentAddressedReuse(capsule.validationDagAndContentAddressedReuse || {}),
    tokenEconomyOwnerInterruptInternalStatus: validateContextOutputOwnerInterruptTokenBudget(capsule.contextOutputOwnerInterruptTokenBudget || {}),
    v127PermissionGrantReceiptCoherenceInternalStatus: validateV127PermissionGrantReceiptCoherence(capsule),
    blockerClosureProductValueInternalStatus: validateBlockerClosureAndProductValuePressure(capsule.blockerClosureAndProductValuePressure || {}),
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
