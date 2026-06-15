#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.4

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { pass, fail } from './codex-outcome-contract.mjs';

const VALID_PROOF_REASONS = new Set(['docs_only', 'harness_metadata', 'test_only', 'runtime_affecting', 'external_provider', 'deploy_sensitive', 'restricted_asset_sensitive']);
const VALID_LIVE_STATUSES = new Set(['pass', 'fail', 'not_required_with_reason', 'blocked_owner_scope', 'waived_explicitly']);
const VALID_SPECIALIST_REVIEW_STATUSES = new Set(['pass', 'fail', 'not_required_with_reason', 'needs_review', 'blocked_owner_scope']);
const CONCRETE_FINDING_CLASSES = new Set(['concrete_machine_blocker', 'spec_violation', 'scope_violation', 'test_failure']);
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
const ROOT_CAUSE_SIGNATURES = new Set([
  'artifact_finalization_order',
  'permission_boundary_gap',
  'local_remote_shape_mismatch',
  'profile_mapping_gap',
  'token_budget_overrun',
  'claim_evidence_drift',
  'unknown',
]);
const ROOT_CAUSE_STATUSES = new Set(['known', 'unknown', 'disputed']);
const BOUNDARY_CHANGE_CLASSES = new Set(['metadata_only', 'harness_change', 'workflow_change', 'product_code_change', 'runtime_change', 'restricted_asset_high_risk', 'unknown']);
const REVIEWER_ROLES = new Set(['none', 'scope_security', 'test_correctness', 'false_positive', 'adversarial', 'verifier']);
const INDEPENDENCE_STATUSES = new Set(['pass', 'warn', 'blocked']);
const REVIEW_LOOP_STATUSES = new Set(['pass', 'warn', 'blocked']);
const REVIEW_RISK_PROFILES = new Set(['docs_only', 'metadata_light', 'harness_source', 'product', 'runtime', 'security', 'restricted_asset']);
const EXPERT_ROLES = new Set(['planner', 'scope_security', 'test_verifier', 'evidence_verifier', 'skeptic', 'inventory', 'value_pressure', 'arbiter']);
const LOOP_EXIT_REASONS = new Set(['goal_met', 'owner_boundary', 'no_new_evidence', 'same_root_cause_repeated', 'budget_exceeded', 'validation_regressed', 'none']);
const SKEPTIC_TRIGGERS = new Set(['none', 'repeated_failure', 'evidence_contradiction', 'scope_boundary', 'security_sensitive_ambiguity', 'restricted_asset_ambiguity', 'runtime_readiness_boundary']);
const REPAIR_SCOPES = new Set(['none', 'harness_only', 'docs_only', 'product_requires_owner_scope', 'stop_only']);

function list(values = [], limit = 50) {
  return Array.isArray(values) ? values.slice(0, limit).map(String) : [];
}

function tier(value, fallback = 'low_cost_worker') {
  return MODEL_TIERS.has(value) ? value : fallback;
}

function typedBlocker(value) {
  return TYPED_BLOCKERS.has(value) ? value : 'none';
}

function highTierRepairPlan(input = {}) {
  return {
    rootCauseClass: input.rootCauseClass || 'none',
    typedBlocker: typedBlocker(input.typedBlocker),
    allowedFiles: list(input.allowedFiles, 50),
    exactRepairSteps: list(input.exactRepairSteps, 5),
    validationCommand: input.validationCommand || 'not_required_with_reason',
    stopCondition: input.stopCondition || 'owner_only_boundary_or_repeated_blocker',
    deEscalationTarget: tier(input.deEscalationTarget, 'low_cost_worker'),
  };
}

function defaultRootCauseSignature(input = {}) {
  return {
    status: ROOT_CAUSE_STATUSES.has(input.rootCauseStatus) ? input.rootCauseStatus : 'unknown',
    signature: ROOT_CAUSE_SIGNATURES.has(input.rootCauseSignature) ? input.rootCauseSignature : 'unknown',
    sameRootCauseRepeatCount: Math.max(0, Number(input.sameRootCauseRepeatCount || 0)),
    samePrimaryClassRepeatCount: Math.max(0, Number(input.samePrimaryClassRepeatCount || 0)),
    rootCauseChanged: input.rootCauseChanged === true,
    newEvidenceAppeared: input.newEvidenceAppeared === true,
    loopSaturation: input.loopSaturation === true,
    safeNextAction: input.rootCauseSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultRepairLoopMetrics(input = {}) {
  return {
    metricsVersion: '1',
    repairIterationCount: Math.max(0, Number(input.repairIterationCount || input.repairIterations || 0)),
    sameRootCauseRepeatCount: Math.max(0, Number(input.sameRootCauseRepeatCount || 0)),
    samePrimaryClassRepeatCount: Math.max(0, Number(input.samePrimaryClassRepeatCount || 0)),
    highTierPlanAlreadyProduced: input.highTierPlanAlreadyProduced === true,
    validationStillFails: input.validationStillFails === true,
    repairLoopSaturation: input.repairLoopSaturation === true,
    safeNextAction: input.repairLoopSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultHighTierPlanOutcome(input = {}) {
  return {
    status: input.highTierPlanOutcomeStatus || (input.highestTierUsed === true ? 'produced' : 'not_used'),
    reducedRepairLoop: input.reducedRepairLoop === true,
    returnedToLowCostWorker: input.returnedToLowCostWorker !== false,
    ownerAuthorityCreated: input.ownerAuthorityCreated === true,
    safeNextAction: input.highTierOutcomeSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultReviewerCalibration(input = {}) {
  return {
    calibrationVersion: '1',
    reviewerCount: Math.min(Number(input.reviewerCount || 0), 3),
    reviewerIndependenceSatisfied: input.independentReviewSatisfied === true,
    overReviewDetected: input.overReviewDetected === true,
    findingClassified: input.findingClassified !== false,
    safeNextAction: input.reviewerCalibrationSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultBoundaryDiffClassification(input = {}) {
  const changeClass = BOUNDARY_CHANGE_CLASSES.has(input.changeClass) ? input.changeClass : 'metadata_only';
  return {
    classificationVersion: '1',
    changeClass,
    productCodeChanged: input.productCodeChanged === true || changeClass === 'product_code_change',
    packageChanged: input.packageChanged === true,
    lockfileChanged: input.lockfileChanged === true,
    runtimeChanged: input.runtimeChanged === true || changeClass === 'runtime_change',
    workflowChanged: input.workflowChanged === true || changeClass === 'workflow_change',
    restrictedAssetTouched: input.restrictedAssetTouched === true || changeClass === 'restricted_asset_high_risk',
    safeNextAction: input.boundaryDiffSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultClaimLint(input = {}) {
  return {
    lintVersion: '1',
    unsafeClaimDetected: input.unsafeClaimDetected === true,
    runtimeReadinessClaimed: input.runtimeReadinessClaimed === true,
    productionReadinessClaimed: input.productionReadinessClaimed === true,
    legalComplianceClaimed: input.legalComplianceClaimed === true,
    youtubePolicyClaimed: input.youtubePolicyClaimed === true,
    deployClaimed: input.deployClaimed === true,
    mergeReadyClaimed: input.mergeReadyClaimed === true,
    safeNextAction: input.claimLintSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultReviewerIndependenceProof(input = {}) {
  const sameWorkerReview = input.sameWorkerReview === true;
  const reviewerSawRawLogs = input.reviewerSawRawLogs === true;
  const reviewerCanApproveOwnerDecision = input.reviewerCanApproveOwnerDecision === true;
  const reviewerCanSubmitGitHubApprovalReview = input.reviewerCanSubmitGitHubApprovalReview === true;
  const reviewerCanClaimReadiness = input.reviewerCanClaimReadiness === true;
  const blocked = sameWorkerReview && input.treatedAsIndependent === true
    || reviewerSawRawLogs
    || reviewerCanApproveOwnerDecision
    || reviewerCanSubmitGitHubApprovalReview
    || reviewerCanClaimReadiness;
  const warn = !blocked && input.sameScratchpadAccess !== false && input.independentReviewUsed === true;
  return {
    proofVersion: '1.2.3',
    independentReviewUsed: input.independentReviewUsed === true,
    sameWorkerReview,
    treatedAsIndependent: input.treatedAsIndependent === true,
    sameScratchpadAccess: input.sameScratchpadAccess === true ? true : (input.sameScratchpadAccess === false ? false : 'unknown'),
    boundedContextPacketUsed: input.boundedContextPacketUsed !== false,
    reviewerSawFullConversation: input.reviewerSawFullConversation === true,
    reviewerSawRawLogs,
    reviewerRole: REVIEWER_ROLES.has(input.reviewerRole) ? input.reviewerRole : 'none',
    reviewerFindingHasPrimaryClass: input.reviewerFindingHasPrimaryClass !== false,
    reviewerCanApproveOwnerDecision,
    reviewerCanSubmitGitHubApprovalReview,
    reviewerCanClaimReadiness,
    independenceStatus: blocked ? 'blocked' : (warn ? 'warn' : 'pass'),
  };
}

function defaultReviewLoopVerification(input = {}) {
  const riskProfile = REVIEW_RISK_PROFILES.has(input.reviewRiskProfile) ? input.reviewRiskProfile : 'harness_source';
  const reviewerCount = Math.max(0, Number(input.reviewerCount || 0));
  const negativeFindingsCount = Math.max(0, Number(input.negativeFindingsCount || 0));
  const negativeRequired = reviewerCount > 0 && ['harness_source', 'product', 'runtime', 'security', 'restricted_asset'].includes(riskProfile);
  const blocked = input.sameRootCauseRepeated === true || input.sameFindingRepeated === true || (negativeRequired && negativeFindingsCount === 0);
  const warn = !blocked && reviewerCount > 0 && riskProfile === 'metadata_light' && negativeFindingsCount === 0;
  return {
    verificationVersion: '1.2.3',
    reviewRiskProfile: riskProfile,
    loopCount: Math.max(0, Number(input.loopCount || 0)),
    reviewerCount,
    findingsCount: Math.max(0, Number(input.findingsCount || 0)),
    acceptedFindingsCount: Math.max(0, Number(input.acceptedFindingsCount || 0)),
    rejectedFindingsCount: Math.max(0, Number(input.rejectedFindingsCount || 0)),
    negativeFindingsCount,
    reviewerDisagreement: input.reviewerDisagreement === true,
    sameRootCauseRepeated: input.sameRootCauseRepeated === true,
    sameFindingRepeated: input.sameFindingRepeated === true,
    adversarialReviewUsed: input.adversarialReviewUsed === true,
    loopSaturation: input.loopSaturation === true || blocked,
    reviewLoopStatus: blocked ? 'blocked' : (warn ? 'warn' : 'pass'),
  };
}

function defaultBoundedExpertLoop(input = {}) {
  const loopCycleCount = Math.max(0, Number(input.loopCycleCount || 0));
  const repairIterationCount = Math.max(0, Number(input.repairIterationCount || input.repairIterations || 0));
  const sameRootCauseRepeatCount = Math.max(0, Number(input.sameRootCauseRepeatCount || 0));
  const highTierUseCount = Math.max(0, Number(input.highTierUseCount || (input.highestTierUsed === true ? 1 : 0)));
  const maxLoopCycles = Math.min(Math.max(1, Number(input.maxLoopCycles || 4)), 4);
  const maxRepairIterations = Math.min(Math.max(1, Number(input.maxRepairIterations || 3)), 3);
  const maxSameRootCauseRepeats = Math.min(Math.max(1, Number(input.maxSameRootCauseRepeats || 2)), 2);
  const maxHighTierUses = Math.min(Math.max(0, Number(input.maxHighTierUses || 1)), 1);
  const newEvidenceAvailable = input.newEvidenceAvailable === true;
  const validationDeltaAvailable = input.validationDeltaAvailable === true;
  const loopContinuationRequested = input.loopContinuationRequested === true;
  const saturated = loopCycleCount >= maxLoopCycles
    || repairIterationCount >= maxRepairIterations
    || sameRootCauseRepeatCount >= maxSameRootCauseRepeats
    || highTierUseCount > maxHighTierUses;
  const lacksSignal = loopContinuationRequested && !newEvidenceAvailable && !validationDeltaAvailable;
  const loopContinuationAllowed = input.loopContinuationAllowed === true && !saturated && !lacksSignal;
  return {
    loopVersion: '1.2.4',
    loopCycleCount,
    maxLoopCycles,
    repairIterationCount,
    maxRepairIterations,
    sameRootCauseRepeatCount,
    maxSameRootCauseRepeats,
    highTierUseCount,
    maxHighTierUses,
    continueRequiresNewEvidence: true,
    continueRequiresValidationDelta: true,
    newEvidenceAvailable,
    validationDeltaAvailable,
    loopContinuationRequested,
    loopContinuationAllowed,
    loopExitReason: LOOP_EXIT_REASONS.has(input.loopExitReason) ? input.loopExitReason : (saturated ? 'budget_exceeded' : (lacksSignal ? 'no_new_evidence' : 'none')),
    loopStatus: saturated || lacksSignal ? 'blocked' : (input.loopStatus || 'pass'),
    safeNextAction: input.boundedLoopSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function normalizeExpertRoles(values = []) {
  const defaultRoles = [
    { roleId: 'planner', active: true },
    { roleId: 'test_verifier', active: true },
    { roleId: 'arbiter', active: true },
  ];
  const source = Array.isArray(values) && values.length ? values : defaultRoles;
  return source.slice(0, 8).map((role) => ({
    roleId: EXPERT_ROLES.has(role?.roleId) ? role.roleId : 'planner',
    active: role?.active !== false,
    abnormalTrigger: SKEPTIC_TRIGGERS.has(role?.abnormalTrigger) ? role.abnormalTrigger : 'none',
    inputContextPacket: role?.inputContextPacket || 'safe_artifacts_only',
    independentChecklist: role?.independentChecklist !== false,
    canAuthorizeOwnerDecision: role?.canAuthorizeOwnerDecision === true,
    canMerge: role?.canMerge === true,
    canRelease: role?.canRelease === true,
    canModifyProductCode: role?.canModifyProductCode === true,
    canModifyPackageOrRuntime: role?.canModifyPackageOrRuntime === true,
    canClaimReadiness: role?.canClaimReadiness === true,
    outputKind: role?.outputKind || 'technical_finding_or_safe_next_action',
  }));
}

function defaultExpertRoleLedger(input = {}) {
  const roles = normalizeExpertRoles(input.roles);
  const activeRoleCount = roles.filter((role) => role.active).length;
  return {
    ledgerVersion: '1.2.4',
    roles,
    activeRoleCount,
    maxActiveRoles: Math.min(Math.max(1, Number(input.maxActiveRoles || 5)), 5),
    skepticAbnormalOnly: true,
    inventoryAdvisoryOnly: true,
    valuePressureAdvisoryOnly: true,
    expertCannotCreateOwnerAuthority: true,
    expertCannotSubmitGithubApprovalReview: true,
    roleLedgerStatus: input.roleLedgerStatus || 'pass',
    safeNextAction: input.expertRoleSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function defaultSafeFailureDigest(input = {}) {
  return {
    digestVersion: '1.2.4',
    primaryClass: input.primaryClass || input.typedBlocker || 'none',
    onePrimaryClass: input.onePrimaryClass !== false,
    safeNextAction: input.failureDigestSafeNextAction || input.safeNextAction || 'one_action',
    repairScope: REPAIR_SCOPES.has(input.repairScope) ? input.repairScope : 'harness_only',
    failureDigestUsesSafeArtifacts: input.failureDigestUsesSafeArtifacts !== false,
    rawLogsRead: false,
    rawDiffRead: false,
    productRepairAllowed: input.productRepairAllowed === true,
    packageRuntimeRepairAllowed: input.packageRuntimeRepairAllowed === true,
    ownerOnlyEscalationRequired: input.ownerOnlyEscalationRequired === true,
    maxDigestLines: Math.min(Math.max(1, Number(input.maxDigestLines || 12)), 12),
  };
}

export function buildWorkerProofCapsule(input = {}) {
  const changedFiles = list(input.changedFiles, 50);
  const findings = list(input.specialistFindings || input.findings, 8);
  const acceptedFindings = list(input.acceptedFindings, 8);
  return {
    workerProofVersion: '1',
    workerId: input.workerId || 'single_worker',
    repo: input.repo || 'hiro4649/codex-development-harness',
    headSha: input.headSha || null,
    changedFiles,
    changedFilesListedCount: changedFiles.length,
    changedFilesTruncated: Array.isArray(input.changedFiles) && input.changedFiles.length > changedFiles.length,
    proofRequirement: {
      liveProofRequired: input.liveProofRequired === true,
      reason: input.proofReason || 'harness_metadata',
      waiverAllowed: input.waiverAllowed === true,
      waiverExplicit: input.waiverExplicit === true,
    },
    testEvidence: {
      focusedTests: input.focusedTests || 'needs_run',
      fullTests: input.fullTests || 'not_required_with_reason',
      ci: input.ci || 'needs_run',
    },
    liveProof: {
      status: input.liveProofStatus || 'not_required_with_reason',
      proofType: input.proofType || 'none',
      proofObserved: 'safe_summary_only',
      rawLogsRead: false,
    },
    reviewChain: {
      selfReviewStatus: input.selfReviewStatus || 'not_required_with_reason',
      specComplianceReviewStatus: input.specComplianceReviewStatus || 'not_required_with_reason',
      codeQualityReviewStatus: input.codeQualityReviewStatus || 'not_required_with_reason',
      finalReviewStatus: input.finalReviewStatus || 'not_required_with_reason',
      sameWorkerSelfReviewCanPass: false,
      fixIterations: Number(input.fixIterations || 0),
      sameFailureRepeated: input.sameFailureRepeated === true,
    },
    specialistReview: {
      status: input.specialistReviewStatus || 'not_required_with_reason',
      reviewerRole: input.reviewerRole || 'specialist_review_agent',
      findings,
      acceptedFindings,
      rejectedFindings: list(input.rejectedFindings, 8),
      findingClasses: list(input.findingClasses, 8),
      repairIterations: Number(input.repairIterations || 0),
      repairIterationId: input.repairIterationId || null,
      sameFailureRepeated: input.sameFailureRepeated === true,
      primaryClassHistory: list(input.primaryClassHistory, 2),
      reviewHeadSha: input.reviewHeadSha || input.headSha || null,
      lastRepairHeadSha: input.lastRepairHeadSha || null,
      focusedValidationCommand: input.focusedValidationCommand || 'not_required_with_reason',
      forbiddenScopeDetected: input.forbiddenScopeDetected === true,
      testsWorsened: input.testsWorsened === true,
      usesOnlySafeArtifacts: input.usesOnlySafeArtifacts !== false,
      rawLogsRead: false,
    },
    modelTierTrace: {
      defaultTier: 'low_cost_worker',
      currentTier: tier(input.currentTier),
      highestTierUsed: input.highestTierUsed === true,
      highestTierUsedForOwnerAuthority: false,
      escalationCount: Math.min(Number(input.escalationCount || 0), 2),
      deEscalationCount: Math.min(Number(input.deEscalationCount || 0), 4),
      fullConversationAllowedForHighTier: false,
      rawLogsAllowedForHighTier: false,
      secretValuesAllowedForHighTier: false,
      unrelatedRepoHistoryAllowedForHighTier: false,
    },
    reviewerPoolTrace: {
      reviewerCount: Math.min(Number(input.reviewerCount || 0), 3),
      maxReviewersDefault: 2,
      maxReviewersHard: 3,
      reviewerMode: input.reviewerMode || 'none',
      independentReviewSatisfied: input.independentReviewSatisfied === true,
      sameWorkerSelfReviewCanPass: false,
      sameRepairLoopCanSelfAccept: false,
      consensus: input.reviewConsensus || 'not_required_with_reason',
    },
    escalationReason: ESCALATION_REASONS.has(input.escalationReason) ? input.escalationReason : 'none',
    typedBlocker: typedBlocker(input.typedBlocker),
    repairPlanFromHighTier: input.highTierRepairPlan ? highTierRepairPlan(input.highTierRepairPlan) : highTierRepairPlan(input),
    rootCauseSignature: defaultRootCauseSignature(input.rootCauseSignature || input),
    repairLoopMetrics: defaultRepairLoopMetrics(input.repairLoopMetrics || input),
    highTierPlanOutcome: defaultHighTierPlanOutcome(input.highTierPlanOutcome || input),
    reviewerCalibration: defaultReviewerCalibration(input.reviewerCalibration || input),
    boundaryDiffClassification: defaultBoundaryDiffClassification(input.boundaryDiffClassification || input),
    claimLint: defaultClaimLint(input.claimLint || input),
    reviewerIndependenceProof: defaultReviewerIndependenceProof(input.reviewerIndependenceProof || input),
    reviewLoopVerification: defaultReviewLoopVerification(input.reviewLoopVerification || input),
    boundedExpertLoop: defaultBoundedExpertLoop(input.boundedExpertLoop || input),
    expertRoleLedger: defaultExpertRoleLedger(input.expertRoleLedger || input),
    safeFailureDigest: defaultSafeFailureDigest(input.safeFailureDigest || input),
    deEscalationReady: input.deEscalationReady === true,
    reviewConsensus: input.reviewConsensus || 'not_required_with_reason',
    sameFailureRepeated: input.sameFailureRepeated === true,
    missingProofReason: input.missingProofReason || 'not_required_with_reason',
    waiverStatus: input.waiverExplicit === true ? 'waived_explicitly' : 'not_required_with_reason',
    safeNextAction: input.safeNextAction || 'run_required_validation_or_owner_decision',
    rawLogsRead: false,
    eightSessionUsed: false,
    safeSummaryOnly: true,
  };
}

export function validateWorkerProofCapsule(capsule = {}) {
  const reasons = [];
  const proofRequirement = capsule.proofRequirement || {};
  const liveProof = capsule.liveProof || {};
  const reviewChain = capsule.reviewChain || {};
  const specialistReview = capsule.specialistReview || {};
  if (!VALID_PROOF_REASONS.has(proofRequirement.reason)) reasons.push('proof_requirement_reason_invalid');
  if (!VALID_LIVE_STATUSES.has(liveProof.status)) reasons.push('live_proof_status_invalid');
  if (specialistReview.status && !VALID_SPECIALIST_REVIEW_STATUSES.has(specialistReview.status)) reasons.push('specialist_review_status_invalid');
  if (proofRequirement.reason === 'runtime_affecting' && proofRequirement.liveProofRequired !== true) reasons.push('runtime_affecting_change_requires_live_proof');
  if (['docs_only', 'harness_metadata'].includes(proofRequirement.reason) && proofRequirement.liveProofRequired === true) reasons.push('docs_or_harness_metadata_live_proof_not_required');
  if (proofRequirement.reason === 'external_provider' && !['blocked_owner_scope', 'waived_explicitly', 'pass'].includes(liveProof.status)) reasons.push('external_provider_live_proof_requires_owner_scope_or_waiver');
  if (['deploy_sensitive', 'restricted_asset_sensitive'].includes(proofRequirement.reason) && liveProof.status === 'pass') reasons.push('wallet_rpc_deploy_live_proof_attempt_blocked_without_owner_scope');
  if (reviewChain.sameWorkerSelfReviewCanPass !== false) reasons.push('self_review_cannot_pass_review_chain_alone');
  if (reviewChain.finalReviewStatus === 'pass' && (reviewChain.specComplianceReviewStatus !== 'pass' || reviewChain.codeQualityReviewStatus !== 'pass')) reasons.push('spec_and_quality_review_required_for_implementation');
  if (specialistReview.usesOnlySafeArtifacts !== true) reasons.push('specialist_review_requires_safe_artifacts_only');
  if (specialistReview.rawLogsRead === true) reasons.push('raw_logs_forbidden_in_specialist_review');
  if (specialistReview.status === 'pass' && capsule.headSha && specialistReview.reviewHeadSha && specialistReview.reviewHeadSha !== capsule.headSha) reasons.push('specialist_review_head_must_match_current_head');
  if (Number(specialistReview.repairIterations || 0) > 2) reasons.push('auto_repair_iteration_limit_exceeded');
  if (specialistReview.sameFailureRepeated === true && Number(specialistReview.repairIterations || 0) >= 2) reasons.push('auto_repair_stops_after_same_primary_class_twice');
  if ((specialistReview.acceptedFindings || []).length && !(specialistReview.findingClasses || []).some((item) => CONCRETE_FINDING_CLASSES.has(item))) reasons.push('review_findings_must_be_concrete_for_auto_repair');
  if (Number(specialistReview.repairIterations || 0) > 0 && !specialistReview.repairIterationId) reasons.push('auto_repair_requires_repair_iteration_id');
  if (Number(specialistReview.repairIterations || 0) > 0 && !specialistReview.lastRepairHeadSha) reasons.push('auto_repair_requires_last_repair_head');
  if (Number(specialistReview.repairIterations || 0) > 0 && !specialistReview.focusedValidationCommand) reasons.push('auto_repair_requires_focused_validation_path');
  if (specialistReview.forbiddenScopeDetected === true) reasons.push('auto_repair_blocks_on_package_lockfile_runtime_secret_deploy_scope');
  if (specialistReview.testsWorsened === true) reasons.push('auto_repair_stops_when_tests_worsen');
  const modelTierTrace = capsule.modelTierTrace || {};
  const reviewerPoolTrace = capsule.reviewerPoolTrace || {};
  if (modelTierTrace.defaultTier !== 'low_cost_worker') reasons.push('low_cost_worker_default_required');
  if (!MODEL_TIERS.has(modelTierTrace.currentTier)) reasons.push('model_tier_trace_current_tier_invalid');
  if (modelTierTrace.highestTierUsedForOwnerAuthority === true) reasons.push('highest_reviewer_cannot_owner_approve');
  if (modelTierTrace.fullConversationAllowedForHighTier !== false) reasons.push('high_tier_context_packet_excludes_full_history');
  if (modelTierTrace.rawLogsAllowedForHighTier !== false) reasons.push('high_tier_context_packet_excludes_raw_logs');
  if (modelTierTrace.secretValuesAllowedForHighTier !== false) reasons.push('high_tier_context_packet_excludes_secrets');
  if (Number(reviewerPoolTrace.maxReviewersDefault || 0) > 2) reasons.push('review_pool_default_max_two');
  if (Number(reviewerPoolTrace.maxReviewersHard || 0) > 3) reasons.push('review_pool_hard_max_three');
  if (reviewerPoolTrace.sameWorkerSelfReviewCanPass !== false) reasons.push('same_worker_self_review_cannot_pass');
  if (reviewerPoolTrace.sameRepairLoopCanSelfAccept !== false) reasons.push('same_repair_loop_cannot_self_accept');
  if (!TYPED_BLOCKERS.has(capsule.typedBlocker)) reasons.push('typed_blocker_invalid');
  if (!ESCALATION_REASONS.has(capsule.escalationReason)) reasons.push('escalation_reason_invalid');
  if (capsule.sameFailureRepeated === true && modelTierTrace.highestTierUsed === true) reasons.push('auto_repair_stops_after_same_primary_class_after_escalation');
  if (capsule.reviewConsensus === 'failed') reasons.push('review_pool_consensus_failed');
  const plan = capsule.repairPlanFromHighTier || {};
  if (modelTierTrace.highestTierUsed === true && (!plan.rootCauseClass || !Array.isArray(plan.exactRepairSteps) || plan.exactRepairSteps.length > 5)) reasons.push('high_tier_repair_plan_required');
  const rootCause = capsule.rootCauseSignature || {};
  const loop = capsule.repairLoopMetrics || {};
  const highTierOutcome = capsule.highTierPlanOutcome || {};
  const boundary = capsule.boundaryDiffClassification || {};
  const claimLint = capsule.claimLint || {};
  const reviewerIndependence = capsule.reviewerIndependenceProof || {};
  const reviewLoop = capsule.reviewLoopVerification || {};
  const boundedLoop = capsule.boundedExpertLoop || {};
  const expertLedger = capsule.expertRoleLedger || {};
  const failureDigest = capsule.safeFailureDigest || {};
  if (!ROOT_CAUSE_STATUSES.has(rootCause.status)) reasons.push('root_cause_status_invalid');
  if (!ROOT_CAUSE_SIGNATURES.has(rootCause.signature)) reasons.push('root_cause_signature_invalid');
  if (Number(rootCause.sameRootCauseRepeatCount || 0) >= 2 && rootCause.newEvidenceAppeared !== true) reasons.push('same_root_cause_repeat_requires_stop_or_new_evidence');
  if (Number(rootCause.samePrimaryClassRepeatCount || 0) >= 2 && rootCause.rootCauseChanged !== true && rootCause.newEvidenceAppeared !== true) reasons.push('same_primary_class_repeat_requires_root_cause_change_or_stop');
  if (loop.metricsVersion !== '1') reasons.push('repair_loop_metrics_version_invalid');
  if (loop.highTierPlanAlreadyProduced === true && loop.validationStillFails === true && Number(loop.sameRootCauseRepeatCount || 0) >= 2 && loop.repairLoopSaturation !== true) reasons.push('repair_loop_saturation_must_be_recorded');
  if (highTierOutcome.ownerAuthorityCreated === true) reasons.push('high_tier_plan_cannot_create_owner_authority');
  if (highTierOutcome.returnedToLowCostWorker !== true && highTierOutcome.status !== 'not_used') reasons.push('high_tier_plan_must_return_to_worker_after_plan');
  if (!BOUNDARY_CHANGE_CLASSES.has(boundary.changeClass)) reasons.push('boundary_diff_class_invalid');
  if (boundary.productCodeChanged === true || boundary.packageChanged === true || boundary.lockfileChanged === true || boundary.runtimeChanged === true || boundary.workflowChanged === true || boundary.restrictedAssetTouched === true) reasons.push('boundary_diff_outside_metadata_or_harness_scope');
  for (const key of ['unsafeClaimDetected', 'runtimeReadinessClaimed', 'productionReadinessClaimed', 'legalComplianceClaimed', 'youtubePolicyClaimed', 'deployClaimed', 'mergeReadyClaimed']) {
    if (claimLint[key] === true) reasons.push(`claim_lint_forbidden_${key}`);
  }
  if (reviewerIndependence.proofVersion !== '1.2.3') reasons.push('reviewer_independence_proof_version_invalid');
  if (!INDEPENDENCE_STATUSES.has(reviewerIndependence.independenceStatus)) reasons.push('reviewer_independence_status_invalid');
  if (!REVIEWER_ROLES.has(reviewerIndependence.reviewerRole)) reasons.push('reviewer_role_invalid');
  if (reviewerIndependence.sameWorkerReview === true && reviewerIndependence.treatedAsIndependent === true) reasons.push('same_worker_review_cannot_count_as_independent');
  if (reviewerIndependence.reviewerSawRawLogs === true) reasons.push('reviewer_raw_logs_forbidden');
  if (reviewerIndependence.reviewerCanApproveOwnerDecision === true) reasons.push('reviewer_cannot_approve_owner_decision');
  if (reviewerIndependence.reviewerCanSubmitGitHubApprovalReview === true) reasons.push('reviewer_cannot_submit_github_approval_review');
  if (reviewerIndependence.reviewerCanClaimReadiness === true) reasons.push('reviewer_cannot_claim_readiness');
  if (reviewerIndependence.independentReviewUsed === true && reviewerIndependence.reviewerFindingHasPrimaryClass !== true) reasons.push('reviewer_finding_requires_primary_class');
  if (reviewerIndependence.independenceStatus === 'blocked') reasons.push('reviewer_independence_blocked');
  if (reviewLoop.verificationVersion !== '1.2.3') reasons.push('review_loop_verification_version_invalid');
  if (!REVIEW_LOOP_STATUSES.has(reviewLoop.reviewLoopStatus)) reasons.push('review_loop_status_invalid');
  if (!REVIEW_RISK_PROFILES.has(reviewLoop.reviewRiskProfile)) reasons.push('review_risk_profile_invalid');
  if (reviewLoop.sameRootCauseRepeated === true) reasons.push('review_loop_same_root_cause_repeated');
  if (reviewLoop.sameFindingRepeated === true) reasons.push('review_loop_same_finding_repeated');
  if (Number(reviewLoop.reviewerCount || 0) > 0
    && ['harness_source', 'product', 'runtime', 'security', 'restricted_asset'].includes(reviewLoop.reviewRiskProfile)
    && Number(reviewLoop.negativeFindingsCount || 0) === 0) reasons.push('review_loop_negative_finding_required_by_risk');
  if (reviewLoop.reviewLoopStatus === 'blocked') reasons.push('review_loop_blocked');
  if (boundedLoop.loopVersion !== '1.2.4') reasons.push('bounded_expert_loop_version_invalid');
  if (Number(boundedLoop.maxLoopCycles || 0) > 4) reasons.push('bounded_expert_loop_cycle_cap_exceeded');
  if (Number(boundedLoop.maxRepairIterations || 0) > 3) reasons.push('bounded_expert_loop_repair_cap_exceeded');
  if (Number(boundedLoop.maxSameRootCauseRepeats || 0) > 2) reasons.push('bounded_expert_loop_root_cause_cap_exceeded');
  if (Number(boundedLoop.maxHighTierUses || 0) > 1) reasons.push('bounded_expert_loop_high_tier_cap_exceeded');
  if (boundedLoop.continueRequiresNewEvidence !== true) reasons.push('bounded_expert_loop_requires_new_evidence');
  if (boundedLoop.continueRequiresValidationDelta !== true) reasons.push('bounded_expert_loop_requires_validation_delta');
  if (!LOOP_EXIT_REASONS.has(boundedLoop.loopExitReason)) reasons.push('bounded_expert_loop_exit_reason_invalid');
  if (boundedLoop.loopContinuationAllowed === true && boundedLoop.newEvidenceAvailable !== true && boundedLoop.validationDeltaAvailable !== true) reasons.push('bounded_expert_loop_continue_requires_signal');
  if (boundedLoop.loopContinuationAllowed === true && Number(boundedLoop.loopCycleCount || 0) >= Number(boundedLoop.maxLoopCycles || 0)) reasons.push('bounded_expert_loop_continue_after_cycle_cap');
  if (boundedLoop.loopContinuationAllowed === true && Number(boundedLoop.repairIterationCount || 0) >= Number(boundedLoop.maxRepairIterations || 0)) reasons.push('bounded_expert_loop_continue_after_repair_cap');
  if (boundedLoop.loopContinuationAllowed === true && Number(boundedLoop.sameRootCauseRepeatCount || 0) >= Number(boundedLoop.maxSameRootCauseRepeats || 0)) reasons.push('bounded_expert_loop_continue_after_root_cause_cap');
  if (boundedLoop.loopStatus === 'blocked') reasons.push('bounded_expert_loop_blocked');
  if (expertLedger.ledgerVersion !== '1.2.4') reasons.push('expert_role_ledger_version_invalid');
  if (Number(expertLedger.activeRoleCount || 0) > Number(expertLedger.maxActiveRoles || 0) || Number(expertLedger.maxActiveRoles || 0) > 5) reasons.push('expert_role_ledger_active_role_cap_exceeded');
  if (expertLedger.skepticAbnormalOnly !== true) reasons.push('skeptic_must_be_abnormal_only');
  if (expertLedger.inventoryAdvisoryOnly !== true) reasons.push('inventory_must_be_advisory_only');
  if (expertLedger.valuePressureAdvisoryOnly !== true) reasons.push('value_pressure_must_be_advisory_only');
  if (expertLedger.expertCannotCreateOwnerAuthority !== true) reasons.push('expert_cannot_create_owner_authority');
  if (expertLedger.expertCannotSubmitGithubApprovalReview !== true) reasons.push('expert_cannot_submit_github_approval_review');
  for (const role of expertLedger.roles || []) {
    if (!EXPERT_ROLES.has(role.roleId)) reasons.push('expert_role_invalid');
    if (role.active === true && role.inputContextPacket !== 'safe_artifacts_only') reasons.push('expert_role_requires_safe_artifacts_only');
    if (role.roleId === 'skeptic' && role.active === true && role.abnormalTrigger === 'none') reasons.push('skeptic_agent_requires_abnormal_trigger');
    if (['inventory', 'value_pressure'].includes(role.roleId) && (role.canModifyProductCode === true || role.canModifyPackageOrRuntime === true || role.canMerge === true || role.canClaimReadiness === true)) reasons.push(`${role.roleId}_cannot_authorize_scope_expansion`);
    if (role.canAuthorizeOwnerDecision === true || role.canMerge === true || role.canRelease === true || role.canClaimReadiness === true) reasons.push('expert_role_forbidden_authority');
  }
  if (expertLedger.roleLedgerStatus === 'blocked') reasons.push('expert_role_ledger_blocked');
  if (failureDigest.digestVersion !== '1.2.4') reasons.push('safe_failure_digest_version_invalid');
  if (failureDigest.onePrimaryClass !== true) reasons.push('safe_failure_digest_requires_one_primary_class');
  if (failureDigest.failureDigestUsesSafeArtifacts !== true) reasons.push('safe_failure_digest_requires_safe_artifacts');
  if (failureDigest.rawLogsRead === true || failureDigest.rawDiffRead === true) reasons.push('safe_failure_digest_forbids_raw_logs_or_raw_diff');
  if (!REPAIR_SCOPES.has(failureDigest.repairScope)) reasons.push('safe_failure_digest_repair_scope_invalid');
  if (failureDigest.productRepairAllowed === true || failureDigest.packageRuntimeRepairAllowed === true) reasons.push('safe_failure_digest_forbids_product_package_runtime_repair');
  if (failureDigest.repairScope === 'product_requires_owner_scope' && failureDigest.ownerOnlyEscalationRequired !== true) reasons.push('product_repair_scope_requires_owner_escalation');
  if (Number(failureDigest.maxDigestLines || 0) > 12) reasons.push('safe_failure_digest_too_long');
  if (capsule.rawLogsRead === true) reasons.push('raw_logs_forbidden_in_worker_proof');
  return reasons.length ? fail(reasons) : pass({ changedFilesListedCount: capsule.changedFilesListedCount || 0 });
}

export function buildWorkerProofReport(input = {}) {
  const capsule = buildWorkerProofCapsule(input);
  const workerProofStatus = validateWorkerProofCapsule(capsule);
  const reviewChain = capsule.reviewChain || {};
  const specialistReview = capsule.specialistReview || {};
  const reviewOk = reviewChain.finalReviewStatus === 'pass'
    ? (reviewChain.specComplianceReviewStatus === 'pass' && reviewChain.codeQualityReviewStatus === 'pass')
    : reviewChain.finalReviewStatus === 'not_required_with_reason';
  return {
    workerProofCapsule: capsule,
    workerProofStatus,
    reviewChainStatus: reviewOk ? pass({ finalReviewStatus: reviewChain.finalReviewStatus }) : fail('review_chain_incomplete'),
    specialistReviewStatus: specialistReview.status === 'fail' ? fail('specialist_review_failed') : pass({ status: specialistReview.status }),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildWorkerProofReport();
  if (process.env.CODEX_WORKER_PROOF_CAPSULE_PATH) {
    fs.writeFileSync(process.env.CODEX_WORKER_PROOF_CAPSULE_PATH, JSON.stringify(report.workerProofCapsule, null, 2));
  }
  const status = report.workerProofStatus.status === 'pass' && report.reviewChainStatus.status === 'pass' ? 'pass' : 'fail';
  writeJsonReport({ ...report, status, safeSummaryOnly: true }, 'CODEX_WORKER_PROOF_REPORT');
  exitFor({ status });
}
