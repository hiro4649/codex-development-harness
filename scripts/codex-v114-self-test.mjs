#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.4

import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  V114_STATUS_KEYS,
  buildLoopBudget,
  buildLoopHandoff,
  buildLoopNextAction,
  buildLoopState,
  buildTerminalCloseout,
  buildV114Report,
  classifyLoopFailure,
  evaluateLoopExit,
  loopTypes,
  validateLoopGuardrails,
  validateNoSpeculativeRepair,
} from './codex-v114-loop-kernel.mjs';
import { classifyGuardrailOperation, validateHookGuardrailRegistry } from './codex-v114-guardrail-registry.mjs';

function test(name, fn) {
  try {
    return { name, status: fn() ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch {
    return { name, status: 'fail', reasonCodes: ['self_test_exception'], safeSummaryOnly: true };
  }
}

const report = buildV114Report();
const unknown = classifyLoopFailure({ unknownFailure: true });
const timeout = classifyLoopFailure({ timedOut: true });
const missingDetail = classifyLoopFailure({ safeDetailUnavailable: true });
const requiredFail = evaluateLoopExit(buildLoopState(), { requiredChecksPass: false, qualityGatePass: true, ownerMergeInstruction: true });
const qgOnly = evaluateLoopExit(buildLoopState(), { requiredChecksPass: false, qualityGatePass: true, ownerMergeInstruction: false });
const nextAction = buildLoopNextAction({ safeNextAction: ['one', 'two'], reasonCodes: ['a', 'b', 'c', 'd'] });
const compactBudget = buildLoopBudget({ operatorVisibleStatusCount: 7, topReasonCodeCount: 3 });
const largeBudget = buildLoopBudget({ operatorVisibleStatusCount: 11 });
const handoff = buildLoopHandoff({ currentBlocker: 'state_delta_required' });
const terminal = buildTerminalCloseout({ classification: 'separate_owner_scope_preserved' });

const cases = [
  test('all_v114_status_keys_default_pass', () => V114_STATUS_KEYS.every((key) => report[key]?.status === 'pass')),
  test('v114_report_passes', () => report.status === 'pass'),
  test('loop_types_registered', () => ['preflight_loop', 'implementation_loop', 'local_validation_loop', 'remote_validation_loop', 'failure_triage_loop', 'repair_scope_loop', 'closeout_loop'].every((item) => loopTypes.includes(item))),
  test('unknown_failure_forbids_product_repair', () => unknown.primaryFailureClass === 'unknown_failure' && unknown.productRepairAllowed === false),
  test('timeout_forbids_product_repair', () => timeout.productRepairAllowed === false && timeout.mergeAllowed === false),
  test('safe_detail_unavailable_forbids_product_repair', () => missingDetail.primaryFailureClass === 'safe_detail_unavailable' && missingDetail.productRepairAllowed === false),
  test('same_head_required_checks_fail_blocks_merge', () => requiredFail.mergeAllowed === false && requiredFail.reasonCodes.includes('required_checks_not_pass')),
  test('quality_gate_pass_alone_not_merge_ready', () => qgOnly.mergeAllowed === false && qgOnly.qualityGatePassAloneAllowsMerge === false),
  test('safe_next_action_must_be_singular', () => nextAction.safeNextAction === 'one' && nextAction.safeNextActionCount === 1),
  test('loop_exit_criteria_required', () => evaluateLoopExit(buildLoopState(), { requiredChecksPass: true, qualityGatePass: true, ownerMergeInstruction: true }).mergeAllowed === true),
  test('eight_session_default_fail', () => validateLoopGuardrails({ eightSessionUsed: true }).status === 'fail'),
  test('raw_log_command_blocked', () => classifyGuardrailOperation('raw_log_command').allowed === false),
  test('scope_mixing_blocked', () => classifyGuardrailOperation('runtime_scope_violation').status === 'fail'),
  test('token_budget_pass_when_compact', () => compactBudget.status === 'pass'),
  test('token_budget_fail_when_oversized', () => largeBudget.status === 'fail'),
  test('stop_resume_handoff_minimal', () => handoff.status === 'pass' && handoff.lineBudget <= 12),
  test('terminal_closeout_classifies_separate_owner_scope', () => terminal.classification === 'separate_owner_scope_preserved'),
  test('loop_state_compact_output', () => JSON.stringify(buildLoopState()).split(/\r?\n/).length === 1),
  test('no_speculative_repair_blocks_unknown_product_repair', () => validateNoSpeculativeRepair({ unknownFailure: true, productRepairAttempted: true }).status === 'fail'),
  test('hook_guardrail_registry_blocks_forbidden_operations', () => validateHookGuardrailRegistry().status === 'pass'),
  test('raw_output_never_printed', () => report.rawLogsRead === false && report.eightSessionUsed === false && report.walletRpcDeployAccess === false),
  test('source_only_non_goals_preserved', () => report.targetRollout === 'not_started' && report.targetReposTouched === false && report.productCodeChanged === false),
];

const failures = cases.filter((item) => item.status !== 'pass');
const selfTestReport = {
  v114SelfTestStatus: { status: failures.length ? 'fail' : 'pass', caseCount: cases.length, failureCount: failures.length, safeSummaryOnly: true },
  cases,
  status: failures.length ? 'fail' : 'pass',
  safeSummaryOnly: true,
};

writeJsonReport(selfTestReport, 'CODEX_V114_SELF_TEST_REPORT');
if (!process.env.CODEX_V114_SELF_TEST_REPORT) console.log(`v114SelfTestStatus: ${selfTestReport.v114SelfTestStatus.status}`);
exitFor(selfTestReport);
