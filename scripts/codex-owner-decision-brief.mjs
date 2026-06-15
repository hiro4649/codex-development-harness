#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.4

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { pass, fail } from './codex-outcome-contract.mjs';

function bounded(values = [], limit = 8) {
  return Array.isArray(values) ? values.slice(0, limit).map(String) : [];
}

const DELEGATED_CONTINUATION_ACTIONS = new Set(['commit', 'push', 'createPr', 'rerunCi', 'fixCi', 'merge']);
const NON_DELEGABLE_ACTIONS = new Set(['release', 'publish', 'secretAccess', 'walletRpcDeployAccess', 'deploy', 'fundedTransaction', 'governanceTransaction', 'bscScanVerification']);
const RECOMMENDATIONS = new Set(['merge', 'repair', 'preserve', 'stop', 'owner_merge_decision_only_after_same_head_remote_pass']);
const CLOSURE_REASONS = new Set(['phase_create_pr_only', 'remote_gate_missing', 'owner_merge_decision_missing', 'delegated_scope_missing', 'decision_closure_inconsistent', 'merge_allowed', 'preserve_only', 'none']);
const OWNER_AUTHORITY_STATES = new Set(['not_required_for_current_scope', 'required', 'already_delegated_current_only']);
const SAFE_LEARNING_SOURCES = new Set(['safe_artifacts_only', 'owner_approved_summary']);

function escalationSummary(input = {}) {
  return {
    typedBlocker: input.typedBlocker || 'none',
    highestTierUsed: input.highestTierUsed === true,
    reviewerCount: Math.min(Number(input.reviewerCount || 0), 3),
    highTierRepairPlanAvailable: input.highTierRepairPlanAvailable === true,
    deEscalationReady: input.deEscalationReady === true,
  };
}

function ownerBurdenMetrics(input = {}) {
  return {
    metricsVersion: '1',
    ownerQuestionCount: Math.max(0, Number(input.ownerQuestionCount || 0)),
    ownerQuestionCountReduced: input.ownerQuestionCountReduced === true,
    remainingOwnerOnlyChoicesCount: Math.min(Number(input.remainingOwnerOnlyChoicesCount || 1), 3),
    safeNextAction: input.ownerBurdenSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function decisionCompressionMetrics(input = {}) {
  const finalReportLineCount = Math.max(0, Number(input.finalReportLineCount || 0));
  const safeArtifactReadCount = Math.max(0, Number(input.safeArtifactReadCount || 0));
  const finalReportLineCountTarget = Math.max(1, Number(input.finalReportLineCountTarget || 14));
  const safeArtifactReadCountTarget = Math.max(1, Number(input.safeArtifactReadCountTarget || 4));
  return {
    metricsVersion: '1',
    finalReportLineCount,
    safeArtifactReadCount,
    finalReportLineCountTarget,
    safeArtifactReadCountTarget,
    finalReportLineCountAboveTarget: finalReportLineCount > finalReportLineCountTarget,
    safeArtifactReadCountAboveTarget: safeArtifactReadCount > safeArtifactReadCountTarget,
    passStatusDetail: 'count_only',
    routineProgressOutput: 'silent',
    safeNextAction: input.decisionCompressionSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function mergeDecisionIntegrity(input = {}) {
  return {
    integrityVersion: '1',
    terminalAction: input.terminalAction || 'create_pr_only',
    ownerDecisionRequired: input.ownerDecisionRequired !== false,
    sameHeadRemoteRequired: input.sameHeadRemoteRequired !== false,
    finalDecisionRequired: true,
    githubApprovalReviewSubmitted: false,
    selfApproval: false,
    safeNextAction: input.mergeIntegritySafeNextAction || input.safeNextAction || 'one_action',
  };
}

function finalDecisionClosureSummary(input = {}) {
  return {
    summaryVersion: '1.2.3',
    phase: input.phase || 'create_pr_only',
    terminalAction: input.terminalAction || 'create_pr_only',
    mergeAllowed: input.mergeAllowed === true,
    closureStatus: input.closureStatus || 'pass',
    singleClosureReason: CLOSURE_REASONS.has(input.singleClosureReason) ? input.singleClosureReason : 'phase_create_pr_only',
    ownerDecisionCreatesAuthority: false,
    reviewerCreatesAuthority: false,
    safeNextAction: input.finalDecisionClosureSafeNextAction || input.safeNextAction || 'one_action',
  };
}

function finalDecisionClosureAdapter(input = {}) {
  return {
    adapterVersion: '1.2.4',
    finalAuthority: input.finalAuthority || 'v1.1.8_final_decision_kernel',
    ownerAuthorityState: OWNER_AUTHORITY_STATES.has(input.ownerAuthorityState) ? input.ownerAuthorityState : 'required',
    createsFinalAuthority: false,
    ownerAuthorityCreatedByAI: false,
    ownerOnlyAuthorityBypassed: false,
    explainsContradiction: input.explainsContradiction !== false,
    singleClosureReasonRequired: true,
    safeNextAction: input.adapterSafeNextAction || input.safeNextAction || 'owner_merge_decision_only',
  };
}

function ownerBurdenReducer(input = {}) {
  return {
    reducerVersion: '1.2.4',
    exactChoicesMax: Math.min(Number(input.exactChoicesMax || 3), 3),
    oneSafeNextAction: input.oneSafeNextAction !== false,
    ownerQuestionCompression: input.ownerQuestionCompression || 'max_three_exact_choices',
    ownerOnlyBoundaryPreserved: input.ownerOnlyBoundaryPreserved !== false,
    technicalAgentsDecideNonOwnerScopeOnly: true,
    safeNextAction: input.reducerSafeNextAction || input.safeNextAction || 'owner_merge_decision_only',
  };
}

function safeSessionLearningProposal(input = {}) {
  return {
    proposalVersion: '1.2.4',
    enabled: input.enabled === true,
    source: SAFE_LEARNING_SOURCES.has(input.source) ? input.source : 'safe_artifacts_only',
    rawLogsRead: false,
    rawTranscriptMining: false,
    autoApplyAllowed: false,
    ownerApprovalRequired: true,
    proposalOnly: true,
    safeNextAction: input.learningSafeNextAction || input.safeNextAction || 'owner_review_required_before_apply',
  };
}

function repoSpecificVisualProofSurface(input = {}) {
  return {
    surfaceVersion: '1.2.4',
    enabled: input.enabled === true,
    repoSpecificOnly: true,
    privateImageRedactionRequired: input.enabled === true ? input.privateImageRedactionRequired !== false : true,
    requiredForGenericHarness: false,
    safeNextAction: input.visualProofSafeNextAction || input.safeNextAction || 'not_required_unless_repo_profile_requires',
  };
}

export function buildOwnerDecisionBrief(input = {}) {
  return {
    ownerDecisionBriefVersion: '1',
    decisionReady: input.decisionReady === true,
    itemUrl: input.itemUrl || null,
    whatChanges: input.whatChanges || 'source_harness_v124_goal_scoped_delegated_autonomy_evidence_semantics_body_only',
    whoBenefits: input.whoBenefits || 'maintainer_owner_burden_reduction_and_safer_long_running_agent_loops',
    whyOwnerDecisionNeededNow: input.whyOwnerDecisionNeededNow || 'owner_merge_instruction_not_provided',
    proofCompleted: bounded(input.proofCompleted, 8),
    proofMissing: bounded(input.proofMissing || ['same_head_remote_quality_gate'], 8),
    residualRisks: bounded(input.residualRisks || ['owner_merge_instruction_required'], 3),
    recommendation: input.recommendation || 'owner_merge_decision_only_after_same_head_remote_pass',
    exactChoices: bounded(input.exactChoices || ['approve_merge_after_same_head_pass', 'request_narrow_repair', 'leave_pr_open'], 3),
    escalationSummary: escalationSummary(input.escalationSummary || input),
    remainingOwnerOnlyChoices: bounded(input.remainingOwnerOnlyChoices || ['merge_after_same_head_pass'], 3),
    ownerBurdenMetrics: ownerBurdenMetrics(input.ownerBurdenMetrics || input),
    decisionCompressionMetrics: decisionCompressionMetrics(input.decisionCompressionMetrics || input),
    mergeDecisionIntegrity: mergeDecisionIntegrity(input.mergeDecisionIntegrity || input),
    finalDecisionClosureSummary: finalDecisionClosureSummary(input.finalDecisionClosureSummary || input),
    finalDecisionClosureAdapter: finalDecisionClosureAdapter(input.finalDecisionClosureAdapter || input),
    ownerBurdenReducer: ownerBurdenReducer(input.ownerBurdenReducer || input),
    safeSessionLearningProposal: safeSessionLearningProposal(input.safeSessionLearningProposal || input),
    repoSpecificVisualProofSurface: repoSpecificVisualProofSurface(input.repoSpecificVisualProofSurface || input),
    ownerOnlyDecision: true,
    nextImplementableSlice: {
      available: input.nextImplementableSliceAvailable === true,
      summary: input.nextImplementableSliceSummary || 'none',
      requiresOwnerScope: input.nextImplementableSliceRequiresOwnerScope !== false,
    },
    delegatedContinuation: {
      enabled: input.delegatedContinuationEnabled === true,
      delegateRole: input.delegateRole || 'technical_reviewer',
      technicalAcceptance: input.technicalAcceptance === true,
      autoContinueAllowed: input.autoContinueAllowed === true,
      allowedActions: bounded(input.delegatedAllowedActions || [], 8),
      blockedActions: bounded(input.delegatedBlockedActions || ['release', 'publish', 'walletRpcDeployAccess', 'secretAccess'], 8),
      remainingOwnerOnlyChoices: bounded(input.remainingOwnerOnlyChoices || ['release', 'publish', 'walletRpcDeployAccess', 'secretAccess'], 3),
      safeNextAction: input.delegatedSafeNextAction || 'owner_delegation_or_owner_decision_required',
    },
    safeNextAction: input.safeNextAction || 'owner_merge_decision_only',
    rawLogsRead: false,
    eightSessionUsed: false,
    safeSummaryOnly: true,
  };
}

export function validateOwnerDecisionBrief(brief = {}) {
  const reasons = [];
  if (brief.ownerOnlyDecision !== true) reasons.push('owner_decision_brief_owner_only_required');
  if (!RECOMMENDATIONS.has(brief.recommendation)) reasons.push('owner_decision_brief_recommendation_invalid');
  if (!Array.isArray(brief.exactChoices) || brief.exactChoices.length > 3) reasons.push('owner_decision_brief_max_three_choices');
  if (!Array.isArray(brief.residualRisks) || brief.residualRisks.length > 3) reasons.push('owner_decision_brief_max_three_risks');
  if (!Array.isArray(brief.remainingOwnerOnlyChoices) || brief.remainingOwnerOnlyChoices.length > 3) reasons.push('owner_decision_brief_max_three_remaining_owner_choices');
  if (!Array.isArray(brief.proofCompleted) || brief.proofCompleted.length > 8 || !Array.isArray(brief.proofMissing) || brief.proofMissing.length > 8) reasons.push('owner_decision_brief_max_eight_proof_items');
  if (!brief.whatChanges || !brief.whyOwnerDecisionNeededNow || !brief.recommendation) reasons.push('owner_decision_brief_required_before_owner_question');
  const burden = brief.ownerBurdenMetrics || {};
  const compression = brief.decisionCompressionMetrics || {};
  const integrity = brief.mergeDecisionIntegrity || {};
  const closure = brief.finalDecisionClosureSummary || {};
  const adapter = brief.finalDecisionClosureAdapter || {};
  const reducer = brief.ownerBurdenReducer || {};
  const learning = brief.safeSessionLearningProposal || {};
  const visual = brief.repoSpecificVisualProofSurface || {};
  if (burden.metricsVersion !== '1') reasons.push('owner_burden_metrics_version_invalid');
  if (Number(burden.ownerQuestionCount || 0) > 3) reasons.push('owner_question_count_should_stay_bounded');
  if (Number(burden.remainingOwnerOnlyChoicesCount || 0) > 3) reasons.push('owner_only_choice_count_max_three');
  if (compression.metricsVersion !== '1') reasons.push('decision_compression_metrics_version_invalid');
  if (compression.passStatusDetail !== 'count_only') reasons.push('decision_brief_pass_status_count_only');
  if (compression.routineProgressOutput !== 'silent') reasons.push('decision_brief_routine_progress_silent');
  if (Number(compression.finalReportLineCount || 0) > 70) reasons.push('decision_brief_final_report_too_long');
  if (integrity.integrityVersion !== '1') reasons.push('merge_decision_integrity_version_invalid');
  if (integrity.finalDecisionRequired !== true || integrity.ownerDecisionRequired !== true || integrity.sameHeadRemoteRequired !== true) reasons.push('merge_decision_requires_final_owner_same_head_remote');
  if (integrity.githubApprovalReviewSubmitted === true || integrity.selfApproval === true) reasons.push('owner_brief_cannot_self_approve_or_submit_approval_review');
  if (closure.summaryVersion !== '1.2.3') reasons.push('final_decision_closure_summary_version_invalid');
  if (!CLOSURE_REASONS.has(closure.singleClosureReason)) reasons.push('final_decision_closure_summary_reason_invalid');
  if (closure.closureStatus === 'inconsistent') reasons.push('final_decision_closure_summary_inconsistent');
  if (closure.ownerDecisionCreatesAuthority === true || closure.reviewerCreatesAuthority === true) reasons.push('final_decision_closure_summary_cannot_create_authority');
  if (adapter.adapterVersion !== '1.2.4') reasons.push('final_decision_closure_adapter_version_invalid');
  if (adapter.finalAuthority !== 'v1.1.8_final_decision_kernel') reasons.push('final_decision_closure_adapter_authority_changed');
  if (!OWNER_AUTHORITY_STATES.has(adapter.ownerAuthorityState)) reasons.push('final_decision_closure_adapter_owner_authority_state_invalid');
  if (adapter.createsFinalAuthority === true || adapter.ownerAuthorityCreatedByAI === true || adapter.ownerOnlyAuthorityBypassed === true) reasons.push('final_decision_closure_adapter_cannot_create_authority');
  if (adapter.singleClosureReasonRequired !== true || adapter.explainsContradiction !== true) reasons.push('final_decision_closure_adapter_requires_single_reason');
  if (reducer.reducerVersion !== '1.2.4') reasons.push('owner_burden_reducer_version_invalid');
  if (Number(reducer.exactChoicesMax || 0) > 3) reasons.push('owner_burden_reducer_max_three_choices');
  if (reducer.oneSafeNextAction !== true) reasons.push('owner_burden_reducer_requires_one_safe_next_action');
  if (reducer.ownerOnlyBoundaryPreserved !== true || reducer.technicalAgentsDecideNonOwnerScopeOnly !== true) reasons.push('owner_burden_reducer_owner_boundary_required');
  if (learning.proposalVersion !== '1.2.4') reasons.push('safe_session_learning_version_invalid');
  if (!SAFE_LEARNING_SOURCES.has(learning.source)) reasons.push('safe_session_learning_source_invalid');
  if (learning.rawLogsRead === true || learning.rawTranscriptMining === true) reasons.push('safe_session_learning_forbids_raw_logs_or_transcript_mining');
  if (learning.autoApplyAllowed === true || learning.ownerApprovalRequired !== true || learning.proposalOnly !== true) reasons.push('safe_session_learning_must_be_proposal_only');
  if (visual.surfaceVersion !== '1.2.4') reasons.push('repo_visual_proof_surface_version_invalid');
  if (visual.enabled === true && visual.privateImageRedactionRequired !== true) reasons.push('repo_visual_proof_requires_redaction');
  if (visual.requiredForGenericHarness === true || visual.repoSpecificOnly !== true) reasons.push('repo_visual_proof_surface_must_be_repo_specific_optional');
  const delegated = brief.delegatedContinuation || {};
  if (delegated.enabled === true) {
    if (delegated.autoContinueAllowed === true && delegated.technicalAcceptance !== true) reasons.push('delegated_auto_continue_requires_technical_acceptance');
    if (!Array.isArray(delegated.remainingOwnerOnlyChoices) || delegated.remainingOwnerOnlyChoices.length > 3) reasons.push('delegated_continuation_remaining_owner_choices_required');
    for (const action of delegated.allowedActions || []) {
      if (!DELEGATED_CONTINUATION_ACTIONS.has(action)) reasons.push(`delegated_continuation_action_not_allowed_${action}`);
      if (NON_DELEGABLE_ACTIONS.has(action)) reasons.push(`delegated_continuation_forbidden_${action}`);
    }
  }
  if (brief.rawLogsRead === true) reasons.push('raw_logs_forbidden_in_owner_decision_brief');
  return reasons.length ? fail(reasons) : pass({ decisionReady: brief.decisionReady === true });
}

export function buildOwnerDecisionBriefReport(input = {}) {
  const brief = buildOwnerDecisionBrief(input);
  return {
    ownerDecisionBrief: brief,
    ownerDecisionBriefStatus: validateOwnerDecisionBrief(brief),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildOwnerDecisionBriefReport();
  if (process.env.CODEX_OWNER_DECISION_BRIEF_PATH) {
    fs.writeFileSync(process.env.CODEX_OWNER_DECISION_BRIEF_PATH, JSON.stringify(report.ownerDecisionBrief, null, 2));
  }
  writeJsonReport({ ...report, status: report.ownerDecisionBriefStatus.status, safeSummaryOnly: true }, 'CODEX_OWNER_DECISION_BRIEF_REPORT');
  exitFor({ status: report.ownerDecisionBriefStatus.status });
}
