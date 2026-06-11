#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.8

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { pass, fail } from './codex-outcome-contract.mjs';

export const FINAL_DECISION_VERSION = '1';
export const EXECUTION_MODES = new Set(['source_pr', 'source_main', 'target_pr', 'target_main', 'preserve_watch', 'analysis_only']);
export const TERMINAL_ACTIONS = new Set(['create_pr_only', 'merge_current_pr', 'investigate_only', 'preserve_only', 'stop']);

export function normalizeExecutionMode(value = '') {
  return EXECUTION_MODES.has(value) ? value : 'source_pr';
}

export function normalizeTerminalAction(value = '') {
  return TERMINAL_ACTIONS.has(value) ? value : 'create_pr_only';
}

function statusOf(value) {
  if (typeof value === 'string') return value;
  return value?.status || value?.statusCode || 'unknown';
}

function hasPrimaryClass(value) {
  return Boolean(value && value !== 'none' && value !== 'none_or_one_code');
}

function safetyViolation(safetyClaims = {}) {
  if (safetyClaims.rawLogsRead === true) return 'raw_logs_read';
  if (safetyClaims.eightSessionUsed === true) return 'eight_session_used';
  if (safetyClaims.runtimeReadinessClaimed === true) return 'runtime_readiness_claimed';
  if (safetyClaims.productionReadinessClaimed === true) return 'production_readiness_claimed';
  return '';
}

function evidenceReadyForMerge(evidenceCapsule = {}, requiredChecks = {}) {
  const current = evidenceCapsule.currentHeadEvidence || {};
  return evidenceCapsule.fresh === true &&
    current.qualityGateRunId &&
    current.qualityGateRunId !== 'needs_run' &&
    current.artifactId &&
    current.artifactId !== 'needs_run' &&
    requiredChecks.sameHead !== false &&
    requiredChecks.allPass === true;
}

export function reconcileFinalSafeDecision(input = {}) {
  const executionMode = normalizeExecutionMode(input.executionMode);
  const terminalAction = normalizeTerminalAction(input.terminalAction);
  const decisionCapsule = input.decisionCapsule || {};
  const evidenceCapsule = input.evidenceCapsule || {};
  const artifactConsistency = input.artifactConsistency || {};
  const minimalBlockers = input.minimalBlockers || {};
  const convergenceState = input.convergenceState || {};
  const tokenBudget = input.tokenBudget || {};
  const requiredChecks = input.requiredChecks || {};
  const safetyClass = safetyViolation(input.safetyClaims || {});
  const contradictedEvidence = [];
  let decision = 'blocked';
  let mergeAllowed = false;
  let primaryClass = minimalBlockers.primary_blocker || decisionCapsule.primaryClass || 'none';
  let safeNextAction = minimalBlockers.safe_next_action || decisionCapsule.safeNextAction || 'owner_merge_decision_after_same_head_remote_pass';
  let exitCode = 1;

  if (!EXECUTION_MODES.has(input.executionMode)) primaryClass = 'execution_mode_required';
  if (!TERMINAL_ACTIONS.has(input.terminalAction)) primaryClass = 'terminal_action_required';
  if (safetyClass) primaryClass = safetyClass;
  if (statusOf(artifactConsistency.artifactConsistencyStatus || artifactConsistency) === 'fail') {
    primaryClass = artifactConsistency.artifactConsistencyStatus?.primaryClass || artifactConsistency.primaryClass || 'artifact_consistency_failed';
  }
  if (statusOf(tokenBudget) === 'fail') primaryClass = 'token_budget_exceeded';
  if (convergenceState.continueAllowed === false) primaryClass = convergenceState.currentPrimaryClass || 'convergence_gate_stopped';

  const localCreatePrNeedsRun = terminalAction === 'create_pr_only' &&
    (evidenceCapsule.currentHeadEvidence?.qualityGateRunId === 'needs_run' ||
      evidenceCapsule.currentHeadEvidence?.artifactId === 'needs_run');
  const canCreatePr = terminalAction === 'create_pr_only' &&
    !safetyClass &&
    statusOf(artifactConsistency.artifactConsistencyStatus || artifactConsistency) !== 'fail' &&
    statusOf(tokenBudget) !== 'fail' &&
    convergenceState.continueAllowed !== false;
  const canPreserve = terminalAction === 'preserve_only' && !safetyClass;
  const canInvestigate = terminalAction === 'investigate_only' && !safetyClass;
  const canStop = terminalAction === 'stop' && !safetyClass;

  if (terminalAction === 'merge_current_pr') {
    const mergeEvidenceReady = evidenceReadyForMerge(evidenceCapsule, requiredChecks);
    const ownerMergeInstruction = input.ownerMergeInstruction === true || input.ownerReceipt?.ownerMergeInstruction === true;
    if (!mergeEvidenceReady) primaryClass = 'merge_current_pr_remote_evidence_required';
    else if (!ownerMergeInstruction) primaryClass = 'owner_merge_instruction_required';
    else if (!hasPrimaryClass(primaryClass) || primaryClass === 'owner_decision_required') {
      decision = 'allowed';
      mergeAllowed = true;
      primaryClass = 'none';
      safeNextAction = 'merge_current_pr';
      exitCode = 0;
    }
  } else if (canCreatePr) {
    decision = 'allowed';
    mergeAllowed = false;
    primaryClass = hasPrimaryClass(primaryClass) && !localCreatePrNeedsRun ? primaryClass : 'none';
    safeNextAction = localCreatePrNeedsRun ? 'run_same_head_remote_quality_gate' : 'owner_merge_decision_after_same_head_remote_pass';
    exitCode = 0;
  } else if (canPreserve) {
    decision = 'preserve_only';
    mergeAllowed = false;
    primaryClass = 'none';
    safeNextAction = 'stop_until_external_trigger';
    exitCode = 0;
  } else if (canInvestigate) {
    decision = 'investigate_only';
    mergeAllowed = false;
    primaryClass = 'none';
    safeNextAction = 'stop';
    exitCode = 0;
  } else if (canStop) {
    decision = 'stop';
    mergeAllowed = false;
    safeNextAction = 'stop';
    exitCode = 0;
  }

  if (decisionCapsule.decision === 'allowed' && exitCode !== 0 && !hasPrimaryClass(primaryClass)) {
    primaryClass = 'final_decision_contradiction_detected';
    contradictedEvidence.push({ artifact: 'codex-decision-capsule.safe.json', field: 'decision', value: 'allowed' });
  }
  if (decisionCapsule.decision === 'allowed' && decision !== 'allowed' && hasPrimaryClass(primaryClass)) {
    contradictedEvidence.push({ artifact: 'codex-decision-capsule.safe.json', field: 'decision', value: 'allowed' });
  }
  if (mergeAllowed === true && hasPrimaryClass(primaryClass)) {
    mergeAllowed = false;
    decision = 'blocked';
    exitCode = 1;
    contradictedEvidence.push({ artifact: 'codex-final-decision.safe.json', field: 'mergeAllowed', value: true });
  }
  if (requiredChecks.allPass === false && mergeAllowed === true) {
    mergeAllowed = false;
    decision = 'blocked';
    primaryClass = 'required_check_failure';
    exitCode = 1;
  }

  const finalDecision = {
    finalDecisionVersion: FINAL_DECISION_VERSION,
    executionMode,
    terminalAction,
    decision,
    mergeAllowed,
    primaryClass,
    safeNextAction,
    exitCode,
    contradictedEvidence,
    rawLogsRead: false,
    eightSessionUsed: false,
    runtimeReadinessClaimed: false,
    productionReadinessClaimed: false,
    artifactName: 'codex-final-decision.safe.json',
    safeSummaryOnly: true,
  };
  return finalDecision;
}

export function validateFinalDecisionKernel(input = {}) {
  const decision = input.finalDecisionVersion ? input : reconcileFinalSafeDecision(input);
  const reasonCodes = [];
  if (decision.finalDecisionVersion !== FINAL_DECISION_VERSION) reasonCodes.push('final_decision_version_mismatch');
  if (!EXECUTION_MODES.has(decision.executionMode)) reasonCodes.push('execution_mode_required');
  if (!TERMINAL_ACTIONS.has(decision.terminalAction)) reasonCodes.push('terminal_action_required');
  if (decision.mergeAllowed === true && hasPrimaryClass(decision.primaryClass)) reasonCodes.push('merge_allowed_with_primary_class');
  if (decision.rawLogsRead !== false) reasonCodes.push('raw_logs_read');
  if (decision.eightSessionUsed !== false) reasonCodes.push('eight_session_used');
  if (decision.runtimeReadinessClaimed !== false) reasonCodes.push('runtime_readiness_claimed');
  if (decision.productionReadinessClaimed !== false) reasonCodes.push('production_readiness_claimed');
  if (!decision.safeNextAction || String(decision.safeNextAction).split(/\s*,\s*/).length > 1) reasonCodes.push('safe_next_action_not_singular');
  return reasonCodes.length ? fail(reasonCodes, { finalDecision: decision }) : pass({ finalDecision: decision });
}

function readJson(file) {
  try {
    if (!file || !fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const input = process.argv[2] ? readJson(process.argv[2]) : {};
  const finalDecision = reconcileFinalSafeDecision(input);
  const report = {
    finalDecisionStatus: validateFinalDecisionKernel(finalDecision),
    finalDecision,
    status: finalDecision.exitCode === 0 ? 'pass' : 'fail',
    safeSummaryOnly: true,
  };
  writeJsonReport(report, 'CODEX_FINAL_DECISION_REPORT');
  if (process.env.CODEX_FINAL_DECISION_WRITE_ARTIFACT === '1') {
    fs.writeFileSync('codex-final-decision.safe.json', JSON.stringify(finalDecision, null, 2));
  }
  exitFor(report);
}
