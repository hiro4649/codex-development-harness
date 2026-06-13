#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.0

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
