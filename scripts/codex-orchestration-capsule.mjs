#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.4

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
    agentsMarker: input.agentsMarker || 'CODEX_QUALITY_HARNESS_FILE v1.2.4',
    manifestActiveHarnessVersion: input.manifestActiveHarnessVersion || '1.2.4',
    activeSelfTestSuite: input.activeSelfTestSuite || 'v124',
    activeSpecPath: input.activeSpecPath || 'docs/process/CODEX_V124_SPEC.md',
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
    schemaVersion: input.schemaVersion || '1.2.4',
    taskProfile,
    selectedSkills,
    rejectedSkills: truncateList(input.rejectedSkills || [], 10),
    mdFilesRead,
    mdFilesRejected: truncateList(input.mdFilesRejected || [], 20),
    requiredFirstReads: truncateList(input.requiredFirstReads || ['AGENTS.md', 'docs/process/CODEX_HARNESS_MANIFEST.json', 'docs/process/CODEX_V124_SPEC.md'], 8),
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
    workspaceIdentityVersion: '1.2.4',
    expectedRepo: input.expectedRepo || input.repo || 'hiro4649/codex-development-harness',
    actualRemoteUrl: input.actualRemoteUrl || 'safe_url_or_hash',
    defaultBranch: input.defaultBranch || 'main',
    currentBranch: input.currentBranch || input.branch || 'unknown',
    headSha: input.headSha || null,
    agentsMarker: input.agentsMarker || 'CODEX_QUALITY_HARNESS_FILE v1.2.4',
    manifestActiveHarnessVersion: input.manifestActiveHarnessVersion || '1.2.4',
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
    schemaVersion: '1.2.4',
    indexPath: input.indexPath || 'docs/process/CODEX_ACTIVE_POLICY_INDEX.json',
    taskProfile: TASK_PROFILES.has(input.taskProfile) ? input.taskProfile : 'routine',
    requiredReads: truncateList(input.requiredReads || ['AGENTS.md', 'docs/process/CODEX_HARNESS_MANIFEST.json', 'docs/process/CODEX_V124_SPEC.md'], 8),
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
    forbiddenScopeProfile: input.forbiddenScopeProfile || 'SOURCE_HARNESS_BODY_ONLY_V124',
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
    activeHarnessVersion: input.activeHarnessVersion || '1.2.4',
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
    authorityBoundary: {
      conflictPrecedence: [
        'v1.1.8_final_decision_over_v1.1.9_v1.2.0_v1.2.1_v1.2.2_v1.2.3_and_v1.2.4',
        'v1.1.9_orchestration_over_v1.2.0_routing_v1.2.1_calibration_v1.2.2_context_routing_v1.2.3_observed_evidence_and_v1.2.4_delegated_autonomy',
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
  if (!['1.2.3', '1.2.4'].includes(gate.workspaceIdentityVersion)) reasons.push('workspace_identity_version_invalid');
  if (!['CODEX_QUALITY_HARNESS_FILE v1.2.3', 'CODEX_QUALITY_HARNESS_FILE v1.2.4'].includes(gate.agentsMarker)) reasons.push('workspace_identity_agents_marker_invalid');
  if (!['1.2.3', '1.2.4'].includes(gate.manifestActiveHarnessVersion)) reasons.push('workspace_identity_manifest_version_invalid');
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
  if (!['1.2.3', '1.2.4'].includes(index.schemaVersion)) reasons.push('active_policy_index_schema_invalid');
  if (index.indexPath !== 'docs/process/CODEX_ACTIVE_POLICY_INDEX.json') reasons.push('active_policy_index_path_invalid');
  for (const item of ['AGENTS.md', 'docs/process/CODEX_HARNESS_MANIFEST.json']) {
    if (!Array.isArray(index.requiredReads) || !index.requiredReads.includes(item)) reasons.push(`active_policy_index_missing_${item}`);
  }
  if (!Array.isArray(index.requiredReads) || !index.requiredReads.some((item) => ['docs/process/CODEX_V123_SPEC.md', 'docs/process/CODEX_V124_SPEC.md'].includes(item))) reasons.push('active_policy_index_missing_active_spec');
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
  if (!['1.2.2', '1.2.3', '1.2.4'].includes(routing.schemaVersion)) reasons.push('skill_context_routing_schema_invalid');
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
  if (!['CODEX_QUALITY_HARNESS_FILE v1.2.2', 'CODEX_QUALITY_HARNESS_FILE v1.2.3', 'CODEX_QUALITY_HARNESS_FILE v1.2.4'].includes(authority.agentsMarker)) reasons.push('active_authority_agents_marker_missing');
  if (!['1.2.2', '1.2.3', '1.2.4'].includes(authority.manifestActiveHarnessVersion)) reasons.push('active_authority_manifest_version_missing');
  if (!['v122', 'v123', 'v124'].includes(authority.activeSelfTestSuite)) reasons.push('active_authority_self_test_missing');
  if (!['docs/process/CODEX_V122_SPEC.md', 'docs/process/CODEX_V123_SPEC.md', 'docs/process/CODEX_V124_SPEC.md'].includes(authority.activeSpecPath)) reasons.push('active_authority_spec_path_missing');
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
