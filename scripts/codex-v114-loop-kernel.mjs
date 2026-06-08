#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.4

import fs from 'node:fs';
import path from 'node:path';
import { writeJsonReport, exitFor, scanObjectForUnsafe } from './codex-v080-lib.mjs';
import { classifyGuardrailOperation, validateHookGuardrailRegistry } from './codex-v114-guardrail-registry.mjs';

export const HARNESS_VERSION = '1.1.4';
export const MARKER = 'CODEX_QUALITY_HARNESS_FILE v1.1.4';

export const loopTypes = [
  'preflight_loop',
  'implementation_loop',
  'local_validation_loop',
  'remote_validation_loop',
  'failure_triage_loop',
  'repair_scope_loop',
  'closeout_loop',
];

export const V114_STATUS_KEYS = [
  'v114SelfTestStatus',
  'loopKernelStatus',
  'loopStateMachineStatus',
  'loopExitCriteriaStatus',
  'loopBudgetStatus',
  'loopGuardrailStatus',
  'loopFailureClassifierStatus',
  'noSpeculativeRepairStatus',
  'loopHandoffStatus',
  'loopTerminalCloseoutStatus',
  'hookGuardrailRegistryStatus',
];

function pass(extra = {}) {
  return { status: 'pass', reasonCodes: [], safeSummaryOnly: true, ...extra };
}

function fail(reasonCodes, extra = {}) {
  return {
    status: 'fail',
    reasonCodes: Array.isArray(reasonCodes) ? reasonCodes : [reasonCodes],
    safeSummaryOnly: true,
    ...extra,
  };
}

function singular(value, fallback) {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
}

export function buildLoopState(input = {}) {
  const loopType = loopTypes.includes(input.loopType) ? input.loopType : 'preflight_loop';
  const state = {
    loopType,
    iteration: Math.max(0, Number(input.iteration || 0)),
    headSha: input.headSha || 'unknown',
    requiredChecksPass: input.requiredChecksPass === true,
    qualityGatePass: input.qualityGatePass === true,
    ownerMergeInstruction: input.ownerMergeInstruction === true,
    productRepairAllowed: input.productRepairAllowed === true,
    rawLogsRead: false,
    eightSessionUsed: false,
    safeSummaryOnly: true,
  };
  return state;
}

export function classifyLoopFailure(input = {}) {
  if (input.sameHeadRequiredCheckFailed === true || input.requiredChecksPass === false) {
    return {
      primaryFailureClass: 'same_head_required_check_failed',
      productRepairAllowed: false,
      mergeAllowed: false,
      safeNextAction: 'wait_for_state_delta_or_owner_scope',
      safeSummaryOnly: true,
    };
  }
  if (input.timedOut === true || input.timeoutClass) {
    return {
      primaryFailureClass: input.timeoutClass || 'timeout',
      productRepairAllowed: false,
      mergeAllowed: false,
      safeNextAction: 'classify_timeout_with_safe_artifact',
      safeSummaryOnly: true,
    };
  }
  if (input.safeDetailUnavailable === true) {
    return {
      primaryFailureClass: 'safe_detail_unavailable',
      productRepairAllowed: false,
      mergeAllowed: false,
      safeNextAction: 'wait_for_safe_artifact_or_owner_scope',
      safeSummaryOnly: true,
    };
  }
  if (input.unknownFailure === true || !input.primaryFailureClass) {
    return {
      primaryFailureClass: 'unknown_failure',
      productRepairAllowed: false,
      mergeAllowed: false,
      safeNextAction: 'emit_minimal_blockers_artifact',
      safeSummaryOnly: true,
    };
  }
  return {
    primaryFailureClass: String(input.primaryFailureClass),
    productRepairAllowed: input.productRepairAllowed === true,
    mergeAllowed: input.requiredChecksPass === true && input.ownerMergeInstruction === true,
    safeNextAction: singular(input.safeNextAction, 'follow_classified_owner_scope'),
    safeSummaryOnly: true,
  };
}

export function evaluateLoopExit(state = {}, input = {}) {
  const requiredChecksPass = input.requiredChecksPass ?? state.requiredChecksPass;
  const qualityGatePass = input.qualityGatePass ?? state.qualityGatePass;
  const ownerMergeInstruction = input.ownerMergeInstruction ?? state.ownerMergeInstruction;
  const sameHead = input.sameHead !== false;
  const mergeAllowed = sameHead && requiredChecksPass === true && qualityGatePass === true && ownerMergeInstruction === true;
  const reasonCodes = [];
  if (!sameHead) reasonCodes.push('same_head_evidence_missing');
  if (requiredChecksPass !== true) reasonCodes.push('required_checks_not_pass');
  if (qualityGatePass !== true) reasonCodes.push('quality_gate_not_pass');
  if (ownerMergeInstruction !== true) reasonCodes.push('owner_merge_instruction_absent');
  return {
    status: mergeAllowed ? 'pass' : 'fail',
    mergeAllowed,
    exitAllowed: mergeAllowed || input.closeoutOnly === true,
    qualityGatePassAloneAllowsMerge: false,
    reasonCodes: mergeAllowed ? [] : reasonCodes.slice(0, 3),
    safeNextAction: mergeAllowed ? 'owner_authorized_merge' : 'continue_classified_loop_or_stop',
    safeSummaryOnly: true,
  };
}

export function buildLoopNextAction(input = {}) {
  const action = singular(input.safeNextAction, 'continue_classified_loop_or_stop');
  return {
    safeNextAction: action,
    safeNextActionCount: 1,
    reasonCodes: (input.reasonCodes || []).slice(0, 3),
    safeSummaryOnly: true,
  };
}

export function buildLoopBudget(input = {}) {
  const budget = {
    operatorVisibleStatusMax: input.operatorVisibleStatusMax ?? 10,
    operatorVisibleStatusCount: input.operatorVisibleStatusCount ?? 7,
    topReasonCodeMax: input.topReasonCodeMax ?? 3,
    topReasonCodeCount: input.topReasonCodeCount ?? 3,
    passStatusesCountOnly: input.passStatusesCountOnly !== false,
    fullJsonStdout: input.fullJsonStdout === true,
    completedTargetDetailsReprinted: input.completedTargetDetailsReprinted === true,
    longForbiddenListProfileId: input.longForbiddenListProfileId || 'STANDARD_HARNESS_ONLY_NO_RUNTIME_NO_PRODUCT_V114',
    safeSummaryOnly: true,
  };
  const reasonCodes = [];
  if (budget.operatorVisibleStatusCount > budget.operatorVisibleStatusMax) reasonCodes.push('operator_visible_status_budget_exceeded');
  if (budget.topReasonCodeCount > budget.topReasonCodeMax) reasonCodes.push('top_reason_code_budget_exceeded');
  if (budget.fullJsonStdout) reasonCodes.push('full_json_stdout_forbidden');
  if (budget.completedTargetDetailsReprinted) reasonCodes.push('completed_target_details_reprinted');
  if (budget.passStatusesCountOnly !== true) reasonCodes.push('pass_statuses_not_count_only');
  return { ...budget, status: reasonCodes.length ? 'fail' : 'pass', reasonCodes };
}

export function validateNoSpeculativeRepair(input = {}) {
  const failure = classifyLoopFailure(input);
  const speculative = input.productRepairAttempted === true
    && (failure.productRepairAllowed !== true || input.ownerProductRepairScope !== true);
  return speculative
    ? fail('speculative_product_repair_forbidden', { productRepairAllowed: false, primaryFailureClass: failure.primaryFailureClass })
    : pass({ productRepairAllowed: failure.productRepairAllowed === true, primaryFailureClass: failure.primaryFailureClass });
}

export function validateLoopGuardrails(input = {}) {
  const blocked = [
    input.rawLogCommand ? classifyGuardrailOperation('raw_log_command') : null,
    input.eightSessionUsed ? classifyGuardrailOperation('eight_session_operation') : null,
    input.selfApproval ? classifyGuardrailOperation('self_approval') : null,
    input.selfMerge ? classifyGuardrailOperation('self_merge') : null,
    input.walletRpcDeployAccess ? classifyGuardrailOperation('wallet_rpc_deploy_access') : null,
  ].filter(Boolean);
  const registry = validateHookGuardrailRegistry();
  return blocked.length
    ? fail(blocked.map((item) => item.reasonCode), { blockedCount: blocked.length, registryStatus: registry.status })
    : pass({ eightSessionDefault: 'fail', rawLogCommandBlocked: true, registryStatus: registry.status });
}

export function buildLoopHandoff(input = {}) {
  return {
    status: 'pass',
    loopType: input.loopType || 'closeout_loop',
    headSha: input.headSha || 'unknown',
    stateCapsule: {
      currentBlocker: input.currentBlocker || 'none',
      safeNextAction: singular(input.safeNextAction, 'none_until_state_delta'),
      targetReposTouched: false,
      productCodeChanged: false,
    },
    lineBudget: input.lineBudget ?? 12,
    safeSummaryOnly: true,
  };
}

export function buildTerminalCloseout(input = {}) {
  return {
    status: 'pass',
    terminal: input.terminal !== false,
    classification: input.classification || 'separate_owner_scope_preserved',
    safeNextAction: singular(input.safeNextAction, 'none_within_current_scope'),
    targetReposTouched: false,
    productCodeChanged: false,
    runtimeReadinessClaimed: false,
    productionReadinessClaimed: false,
    safeSummaryOnly: true,
  };
}

export function buildV114Report(input = {}) {
  const state = buildLoopState(input.state || {});
  const failure = classifyLoopFailure(input.failure || { primaryFailureClass: 'none', requiredChecksPass: true, ownerMergeInstruction: false });
  const exit = evaluateLoopExit(state, input.exit || { requiredChecksPass: false, qualityGatePass: true, ownerMergeInstruction: false });
  const budget = buildLoopBudget(input.budget || {});
  const guardrails = validateLoopGuardrails(input.guardrails || {});
  const noSpeculative = validateNoSpeculativeRepair(input.noSpeculative || { unknownFailure: true });
  const handoff = buildLoopHandoff(input.handoff || {});
  const terminal = buildTerminalCloseout(input.terminal || {});
  const registry = validateHookGuardrailRegistry();
  const statuses = {
    v114SelfTestStatus: pass({ suite: 'v114' }),
    loopKernelStatus: loopTypes.length === 7 ? pass({ loopTypes }) : fail('loop_type_registry_incomplete'),
    loopStateMachineStatus: loopTypes.includes(state.loopType) ? pass({ loopType: state.loopType }) : fail('loop_state_invalid'),
    loopExitCriteriaStatus: exit.qualityGatePassAloneAllowsMerge === false ? pass({ mergeAllowed: exit.mergeAllowed }) : fail('quality_gate_pass_alone_allowed_merge'),
    loopBudgetStatus: budget.status === 'pass' ? pass({ operatorVisibleStatusMax: budget.operatorVisibleStatusMax }) : budget,
    loopGuardrailStatus: guardrails,
    loopFailureClassifierStatus: failure.primaryFailureClass ? pass({ primaryFailureClass: failure.primaryFailureClass }) : fail('primary_failure_class_missing'),
    noSpeculativeRepairStatus: noSpeculative,
    loopHandoffStatus: handoff.status === 'pass' && handoff.lineBudget <= 12 ? pass({ lineBudget: handoff.lineBudget }) : fail('loop_handoff_not_compact'),
    loopTerminalCloseoutStatus: terminal.terminal ? pass({ classification: terminal.classification }) : fail('terminal_closeout_missing'),
    hookGuardrailRegistryStatus: registry.status === 'pass' ? pass({ registeredCount: registry.registeredCount }) : registry,
  };
  const artifacts = {
    loopState: state,
    loopExit: exit,
    loopBudget: budget,
    loopGuardrail: guardrails,
    loopNextAction: buildLoopNextAction({ safeNextAction: failure.safeNextAction, reasonCodes: [failure.primaryFailureClass] }),
    loopHandoff: handoff,
    noSpeculativeRepair: noSpeculative,
    loopTerminalCloseout: terminal,
  };
  const unsafe = scanObjectForUnsafe(artifacts);
  if (unsafe.length) statuses.loopKernelStatus = fail('unsafe_loop_artifact_detected');
  const failing = Object.entries(statuses).filter(([, value]) => value.status === 'fail');
  return {
    ...statuses,
    artifacts,
    targetRollout: 'not_started',
    targetReposTouched: false,
    productCodeChanged: false,
    runtimeReadinessClaimed: false,
    productionReadinessClaimed: false,
    rawLogsRead: false,
    eightSessionUsed: false,
    walletRpcDeployAccess: false,
    status: failing.length ? 'fail' : 'pass',
    safeSummaryOnly: true,
  };
}

export function writeLoopArtifacts(report = buildV114Report(), outputDir = '.codex') {
  fs.mkdirSync(outputDir, { recursive: true });
  const files = {
    'loop-state.safe.json': report.artifacts.loopState,
    'loop-exit.safe.json': report.artifacts.loopExit,
    'loop-budget.safe.json': report.artifacts.loopBudget,
    'loop-guardrail.safe.json': report.artifacts.loopGuardrail,
    'loop-next-action.safe.json': report.artifacts.loopNextAction,
    'loop-handoff.safe.json': report.artifacts.loopHandoff,
    'no-speculative-repair.safe.json': report.artifacts.noSpeculativeRepair,
    'loop-terminal-closeout.safe.json': report.artifacts.loopTerminalCloseout,
  };
  for (const [name, artifact] of Object.entries(files)) {
    fs.writeFileSync(path.join(outputDir, name), `${JSON.stringify(artifact, null, 2)}\n`);
  }
  return { status: 'pass', written: Object.keys(files), safeSummaryOnly: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = buildV114Report();
  writeJsonReport(report, 'CODEX_V114_LOOP_KERNEL_REPORT');
  if (!process.env.CODEX_V114_LOOP_KERNEL_REPORT) console.log(`v114Status: ${report.status}`);
  exitFor(report);
}
