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
  'evaluationAbsorptionStatus',
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

export function validateOneSafeNextAction(input = {}) {
  const actions = Array.isArray(input.safeNextAction) ? input.safeNextAction : [input.safeNextAction || 'continue_classified_loop_or_stop'];
  return actions.filter(Boolean).length === 1 ? pass({ safeNextAction: actions[0] }) : fail('safe_next_action_count_invalid');
}

export function buildDecisionCore(input = {}) {
  const failure = classifyLoopFailure(input);
  const exit = evaluateLoopExit(buildLoopState(input), input);
  const primaryClass = input.primaryClass || failure.primaryFailureClass || 'none';
  return {
    decision: input.decision || (exit.mergeAllowed ? 'allowed' : 'blocked'),
    loop: loopTypes.includes(input.loop) ? input.loop : (input.loopType || 'failure_triage_loop'),
    primaryClass,
    mergeAllowed: exit.mergeAllowed === true,
    repairAllowedInCurrentScope: failure.productRepairAllowed === true && input.ownerProductRepairScope === true,
    ownerDecisionRequired: input.ownerDecisionRequired !== false && exit.mergeAllowed !== true,
    safeNextAction: singular(input.safeNextAction || failure.safeNextAction, 'owner_decision_or_state_delta'),
    artifactPointer: input.artifactPointer || 'codex-decision-core.safe.json',
    safeSummaryOnly: true,
  };
}

export function validateDecisionCoreAuthoritative(input = {}) {
  const decision = buildDecisionCore(input);
  const reasonCodes = [];
  if (!decision.decision || !decision.loop || !decision.primaryClass) reasonCodes.push('decision_core_required_field_missing');
  if (Array.isArray(decision.safeNextAction)) reasonCodes.push('decision_core_multiple_next_actions');
  if (input.prBodyOverridesSafeArtifact === true) reasonCodes.push('pr_body_overrode_safe_artifact');
  if (input.supportingArtifactOverridesDecision === true) reasonCodes.push('supporting_artifact_overrode_decision_core');
  return reasonCodes.length ? fail(reasonCodes, { decision }) : pass({ decision });
}

export function buildMinimalBlockerEntry(input = {}) {
  const entry = {
    primaryBlocker: input.primaryBlocker || input.primaryClass || 'none',
    blockingGate: input.blockingGate || 'quality-gate',
    reasonCode: input.reasonCode || input.primaryClass || 'none',
    scope: input.scope || 'owner_decision_required',
    minimalFix: input.minimalFix || 'read_decision_core',
    commitRequired: input.commitRequired === true,
    bodyOnlyRepair: input.bodyOnlyRepair === true,
    artifactPointer: input.artifactPointer || 'codex-decision-core.safe.json',
    safeSummaryOnly: true,
  };
  return entry;
}

export function classifyStatusSurfaceTier(statusName = '') {
  const name = String(statusName);
  if (['v114SelfTestStatus', 'loopKernelStatus', 'loopExitCriteriaStatus', 'noSpeculativeRepairStatus', 'evaluationAbsorptionStatus'].includes(name)) return 'critical_now';
  if (name.includes('Evidence') || name.includes('Artifact') || name.includes('Guardrail') || name.includes('Budget')) return 'evidence_critical';
  return 'compatibility_shadow';
}

export function classifyRenderedOutputFailure(input = {}) {
  if (input.prBodyTreatedAsSourceOfTruth === true) return fail('pr_body_treated_as_source_of_truth', { productFailure: false });
  if (input.prBodyFailure === true) return pass({ classification: 'rendered_output_failure', productFailure: false });
  return pass({ classification: 'not_applicable', productFailure: false });
}

export function classifyRemoteEvidenceState(input = {}) {
  const required = input.remoteNpmRequired === true;
  const executed = input.remoteNpmExecuted === true;
  const artifact = input.remoteNpmArtifactPresent === true;
  const normalized = input.remoteNpmNormalized === true;
  let result = input.remoteNpmResult || 'not_run';
  let blockingReason = 'not_required';
  if (required && !executed) blockingReason = 'execution_missing';
  else if (required && executed && !artifact) blockingReason = 'artifact_missing';
  else if (required && executed && artifact && !normalized) blockingReason = 'normalization_shape_mismatch';
  else if (required && result === 'timeout') blockingReason = 'npm_timeout';
  else if (required && result === 'fail') blockingReason = 'npm_failed';
  else if (required && result === 'pass') blockingReason = 'not_required';
  if (!['pass', 'fail', 'timeout', 'not_run'].includes(result)) result = 'not_run';
  return {
    remote_npm_required: required ? 'yes' : 'no',
    remote_npm_executed: executed ? 'yes' : 'no',
    remote_npm_artifact_present: artifact ? 'yes' : 'no',
    remote_npm_result: result,
    remote_npm_normalized: normalized ? 'yes' : 'no',
    blocking_reason: blockingReason,
    safeSummaryOnly: true,
  };
}

export function buildValidationDependencyGraph(input = {}) {
  const changedFiles = input.changedFiles || [];
  const requiresFullReplay = changedFiles.some((file) => file.startsWith('scripts/codex-local-quality-gate') || file.includes('workflow'));
  return {
    tiers: ['syntax', 'active_self_test', requiresFullReplay ? 'source_local_gate' : 'changed_file_gate', 'same_head_remote_required_checks'],
    avoidsRedundantFullReplay: requiresFullReplay === false,
    cacheAllowed: true,
    cacheMergeAuthority: false,
    safeSummaryOnly: true,
  };
}

export function buildSafeValidationCacheKey(input = {}) {
  const parts = [input.headSha || 'unknown', input.inputHash || 'unknown', (input.changedFiles || []).join('|')];
  return {
    cacheKey: parts.join(':'),
    cacheAllowed: true,
    mergeAuthority: false,
    safeSummaryOnly: true,
  };
}

export function classifyForbiddenScopeSet(scopeId = '') {
  const allowed = new Set([
    'CRIPTO_TIP_CORE_BOUNDARY_V1',
    'VGC_SAFE_NO_DEPLOY_CONTRACT_V1',
    'FUNKY_D8_SAFE_DB_EXPORT_BOUNDARY_V1',
    'LIVE2D_SAFE_BOUNDARY_V1',
    'IRIS_PRIORITY1_NO_PRODUCTION_GO_V1',
    'VOXWEAVE_NO_RUNTIME_TTS_READINESS_V1',
  ]);
  return allowed.has(scopeId) ? pass({ scopeId }) : fail('unknown_forbidden_scope_set_id', { scopeId });
}

export function classifyReadinessClaim(input = {}) {
  const type = input.type || 'negative_boundary';
  const allowed = ['negative_boundary', 'owner_pending_status', 'test_reason_code_vocabulary', 'manual_review_item'].includes(type);
  return allowed ? pass({ type, allowed: true }) : fail('affirmative_readiness_claim_forbidden', { type, allowed: false });
}

export function classifyManualGateReceipt(input = {}) {
  if (input.ownerValues === true && input.typedDeployReceipt !== true) return fail('owner_values_not_deploy_approval');
  return input.typedDeployReceipt === true ? pass({ deployApproval: true }) : pass({ deployApproval: false });
}

export function classifyRealEvidenceBoundary(input = {}) {
  if (input.priority1ClearedByFixture || input.productionGoByFixture || input.productionGoByLocalPass || input.productionGoByRemotePass) {
    return fail('fixture_or_local_remote_pass_not_real_evidence');
  }
  return pass({ fixturePassIsRealEvidence: false, productionGo: false });
}

export function classifyTargetProcessGuard(input = {}) {
  const reasonCodes = [];
  if (input.targetBranchMutated) reasonCodes.push('target_branch_mutation');
  if (input.externalWorkspaceProcess) reasonCodes.push('external_workspace_process');
  if (input.orphanChildProcess) reasonCodes.push('orphan_child_process');
  if (input.timeoutUnclassified) reasonCodes.push('timeout_not_safely_classified');
  return reasonCodes.length ? fail(reasonCodes) : pass();
}

export function classifyInventoryCloseout(input = {}) {
  const classification = input.classification || 'separate_owner_scope';
  const allowed = ['active_blocker', 'close_candidate', 'freeze_candidate', 'preserve_reference', 'fresh_rebuild_candidate', 'separate_owner_scope'].includes(classification);
  if (input.sameTargetSameBlockerSameEvidenceSameNextAction === true) return fail('duplicate_inventory_pr', { newPrAllowed: false, classification });
  return allowed ? pass({ classification, newPrAllowed: true }) : fail('inventory_classification_invalid', { classification });
}

export function buildTokenCostLedger(input = {}) {
  const ledger = {
    operatorVisibleLines: input.operatorVisibleLines ?? 12,
    safeSummaryBytes: input.safeSummaryBytes ?? 1200,
    artifactCountRead: input.artifactCountRead ?? 3,
    duplicatedReasonCodes: input.duplicatedReasonCodes ?? 0,
    duplicatedBoundaryText: input.duplicatedBoundaryText ?? 0,
    prBodyBytes: input.prBodyBytes ?? 1200,
    repeatedValidationCommands: input.repeatedValidationCommands ?? 0,
    toolOutputBytes: input.toolOutputBytes ?? 1500,
    estimatedOperatorReadTokens: input.estimatedOperatorReadTokens ?? 500,
    avoidableTokenWaste: input.avoidableTokenWaste ?? 0,
    safeSummaryOnly: true,
  };
  const reasonCodes = [];
  if (ledger.operatorVisibleLines > 12) reasonCodes.push('operator_visible_lines_exceeded');
  if (ledger.duplicatedReasonCodes > 2) reasonCodes.push('duplicated_reason_codes_exceeded');
  if (ledger.duplicatedBoundaryText > 0) reasonCodes.push('duplicated_boundary_text_present');
  if (ledger.repeatedValidationCommands > 1) reasonCodes.push('repeated_validation_commands_present');
  return { ...ledger, status: reasonCodes.length ? 'fail' : 'pass', reasonCodes };
}

export function validateFinalReportBudget(input = {}) {
  const reasonCodes = [];
  if ((input.lines ?? 12) > (input.releaseTerminalReport ? 25 : 12)) reasonCodes.push('final_report_line_budget_exceeded');
  if ((input.primaryClassCount ?? 1) !== 1) reasonCodes.push('primary_class_count_invalid');
  if ((input.secondaryReasonCount ?? 0) > 2) reasonCodes.push('secondary_reason_count_exceeded');
  if ((input.artifactPointerCount ?? 1) > 5) reasonCodes.push('artifact_pointer_count_exceeded');
  if (input.completedTargetDetailsReprinted === true) reasonCodes.push('completed_target_details_reprinted');
  return reasonCodes.length ? fail(reasonCodes) : pass();
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
  const decisionCore = buildDecisionCore(input.decisionCore || { requiredChecksPass: false, qualityGatePass: true });
  const decisionCoreStatus = validateDecisionCoreAuthoritative(input.decisionCore || {});
  const minimalBlocker = buildMinimalBlockerEntry(input.minimalBlocker || { primaryClass: decisionCore.primaryClass });
  const remoteEvidence = classifyRemoteEvidenceState(input.remoteEvidence || { remoteNpmRequired: true, remoteNpmExecuted: true, remoteNpmArtifactPresent: true, remoteNpmNormalized: true, remoteNpmResult: 'pass' });
  const validationGraph = buildValidationDependencyGraph(input.validationGraph || {});
  const cacheKey = buildSafeValidationCacheKey(input.cache || {});
  const readiness = classifyReadinessClaim(input.readiness || {});
  const manualGate = classifyManualGateReceipt(input.manualGate || {});
  const realEvidence = classifyRealEvidenceBoundary(input.realEvidence || {});
  const targetProcess = classifyTargetProcessGuard(input.targetProcess || {});
  const inventory = classifyInventoryCloseout(input.inventory || {});
  const tokenCost = buildTokenCostLedger(input.tokenCost || {});
  const finalReport = validateFinalReportBudget(input.finalReport || {});
  const renderedOutput = classifyRenderedOutputFailure(input.renderedOutput || {});
  const scopeSet = classifyForbiddenScopeSet(input.scopeSet || 'VOXWEAVE_NO_RUNTIME_TTS_READINESS_V1');
  const statusTiers = Object.fromEntries(V114_STATUS_KEYS.map((key) => [key, classifyStatusSurfaceTier(key)]));
  const absorptionInputs = [decisionCoreStatus, remoteEvidence, validationGraph, cacheKey, readiness, manualGate, realEvidence, targetProcess, inventory, tokenCost, finalReport, renderedOutput, scopeSet];
  const absorptionFailures = absorptionInputs.filter((item) => item.status === 'fail');
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
    evaluationAbsorptionStatus: absorptionFailures.length ? fail(absorptionFailures.flatMap((item) => item.reasonCodes || []).slice(0, 3)) : pass({ decisionCore: 'authoritative', minimalBlocker: 'single_entry', statusTiers }),
  };
  const artifacts = {
    decisionCore,
    minimalBlocker,
    remoteEvidence,
    validationGraph,
    safeValidationCacheKey: cacheKey,
    tokenCostLedger: tokenCost,
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
