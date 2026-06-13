#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.0

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

function escalationSummary(input = {}) {
  return {
    typedBlocker: input.typedBlocker || 'none',
    highestTierUsed: input.highestTierUsed === true,
    reviewerCount: Math.min(Number(input.reviewerCount || 0), 3),
    highTierRepairPlanAvailable: input.highTierRepairPlanAvailable === true,
    deEscalationReady: input.deEscalationReady === true,
  };
}

export function buildOwnerDecisionBrief(input = {}) {
  return {
    ownerDecisionBriefVersion: '1',
    decisionReady: input.decisionReady === true,
    itemUrl: input.itemUrl || null,
    whatChanges: input.whatChanges || 'source_harness_v120_body_only',
    whoBenefits: input.whoBenefits || 'maintainer_and_worker_context_reduction',
    whyOwnerDecisionNeededNow: input.whyOwnerDecisionNeededNow || 'owner_merge_instruction_not_provided',
    proofCompleted: bounded(input.proofCompleted, 8),
    proofMissing: bounded(input.proofMissing || ['same_head_remote_quality_gate'], 8),
    residualRisks: bounded(input.residualRisks || ['owner_merge_instruction_required'], 3),
    recommendation: input.recommendation || 'owner_merge_decision_only_after_same_head_remote_pass',
    exactChoices: bounded(input.exactChoices || ['approve_merge_after_same_head_pass', 'request_narrow_repair', 'leave_pr_open'], 3),
    escalationSummary: escalationSummary(input.escalationSummary || input),
    remainingOwnerOnlyChoices: bounded(input.remainingOwnerOnlyChoices || ['merge_after_same_head_pass'], 3),
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
