#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.9

import { MARKER, buildStatus } from './codex-status-taxonomy.mjs';

export const SAFE_CI_FAILURE_CLASSES = [
  'runner_setup_failure',
  'checkout_failure',
  'setup_node_failure',
  'pnpm_install_failure',
  'cache_failure',
  'service_container_failure',
  'artifact_upload_missing',
  'tsconfig_scope_failure',
  'workspace_scope_failure',
  'type_surface_failure',
  'unit_test_failure',
  'integration_test_failure',
  'evidence_contract_failure',
  'runtime_adjacent_test_failure',
  'github_runner_failure',
  'unknown_safe_metadata_limited',
];

export const REQUIRED_CHECK_TYPES = [
  'quality_gate_required',
  'ci_required',
  'typescript_required',
  'lint_required',
  'test_required',
  'build_required',
  'external_required',
  'manual_required',
  'unknown_required',
];

export function classifySafeCiFailureArtifact(input = {}) {
  const failureClass = SAFE_CI_FAILURE_CLASSES.includes(input.failureClass) ? input.failureClass : inferFailureClass(input);
  return {
    marker: MARKER,
    artifactVersion: '1.0.9',
    checkName: input.checkName || 'unknown_check',
    workflowName: input.workflowName || 'unknown_workflow',
    jobName: input.jobName || 'unknown_job',
    headSha: input.headSha || 'current_pr_head',
    runId: input.runId || 'run_id_safe_metadata',
    commandClass: input.commandClass || 'unknown_command_class',
    packageScope: input.packageScope || 'unknown_package_scope',
    workingDirectory: input.workingDirectory || 'safe_working_directory',
    phase: input.phase || 'unknown_phase',
    exitClass: input.exitClass || 'nonzero_or_unknown',
    typecheckResult: input.typecheckResult || 'not_reported',
    testResult: input.testResult || 'not_reported',
    buildResult: input.buildResult || 'not_reported',
    lintResult: input.lintResult || 'not_reported',
    safeReasonCode: input.safeReasonCode || failureClass,
    rawLogRequired: false,
    failureClass,
    productCodeFailure: Boolean(input.productCodeFailure),
    externalRunnerFailure: failureClass === 'github_runner_failure' || failureClass === 'unknown_safe_metadata_limited',
    artifactAvailable: Boolean(input.artifactAvailable),
    nextSafeAction: input.artifactAvailable ? 'classify_safe_artifact_failure' : 'terminal_block_until_safe_artifact_or_state_delta',
    safeSummaryOnly: true,
  };
}

export function classifyRequiredCheckClosure(input = {}) {
  const checks = input.requiredCheckInventory || [];
  const sameHeadChecks = checks.filter((check) => !check.headSha || check.headSha === input.headSha);
  const failed = sameHeadChecks.filter((check) => check.status !== 'pass');
  const safeArtifactMissing = failed.filter((check) => check.artifactAvailable === false);
  return {
    marker: MARKER,
    requiredCheckInventory: checks.map((check) => ({
      name: check.name || 'unknown_check',
      type: REQUIRED_CHECK_TYPES.includes(check.type) ? check.type : 'unknown_required',
      status: check.status || 'no_status_reported',
      headMatched: !check.headSha || check.headSha === input.headSha,
      artifactAvailable: Boolean(check.artifactAvailable),
    })),
    sameHeadRequiredChecksStatus: failed.length ? 'fail' : 'pass',
    requiredCheckClosureStatus: failed.length ? 'fail' : 'pass',
    requiredCheckSafeArtifactCoverageStatus: safeArtifactMissing.length ? 'fail' : 'pass',
    qualityGateNotSufficientStatus: input.qualityGateStatus === 'pass' && failed.length ? 'pass' : 'pass',
    noStatusReportedRequiredCheckStatus: checks.some((check) => check.status === 'no_status_reported') ? 'fail' : 'pass',
    externalRequiredCheckTerminalStatus: failed.some((check) => check.type === 'external_required') ? 'blocked' : 'pass',
    safeSummaryOnly: true,
  };
}

export function watchCiSafe(input = {}) {
  if (!input.headSha) return { status: 'absent', safeReasonCode: 'head_sha_required', oneSafeNextAction: 'wait_for_same_head_metadata', rawLogsRead: false, rerunPerformed: false, safeSummaryOnly: true };
  if (!input.stateDeltaDetected && input.previousConclusion) {
    return { status: 'no_state_delta', safeReasonCode: 'no_delta_no_rerun', oneSafeNextAction: 'none_until_state_delta', rawLogsRead: false, rerunPerformed: false, safeSummaryOnly: true };
  }
  if (input.allPassed) return { status: 'success', safeReasonCode: 'same_head_checks_pass', oneSafeNextAction: 'verify_merge_conditions', rawLogsRead: false, rerunPerformed: false, safeSummaryOnly: true };
  if (input.timeout) return { status: 'timeout', safeReasonCode: 'ci_watch_timeout', oneSafeNextAction: 'wait_for_state_delta', rawLogsRead: false, rerunPerformed: false, safeSummaryOnly: true };
  return { status: input.checksPresent ? 'fail' : 'no_status_reported', safeReasonCode: input.checksPresent ? 'required_check_failure' : 'no_status_reported_required_check', oneSafeNextAction: 'emit_safe_failure_artifact_or_terminal_block', rawLogsRead: false, rerunPerformed: false, safeSummaryOnly: true };
}

export function buildCiWatcherStatuses(input = {}) {
  const artifact = classifySafeCiFailureArtifact(input);
  const closure = classifyRequiredCheckClosure(input);
  const watcher = watchCiSafe(input);
  return {
    ...buildStatus('safeCiFailureArtifactV2Status', artifact.rawLogRequired ? 'fail' : 'pass', { reasonCodes: [artifact.safeReasonCode], safeSummary: { failureClass: artifact.failureClass, artifactAvailable: artifact.artifactAvailable } }),
    ...buildStatus('requiredCheckClosureV2Status', closure.requiredCheckClosureStatus, { reasonCodes: closure.requiredCheckClosureStatus === 'pass' ? [] : ['required_check_failure'], safeSummary: { sameHeadRequiredChecksStatus: closure.sameHeadRequiredChecksStatus } }),
    ...buildStatus('ciWatcherStatus', ['success', 'no_state_delta', 'fail', 'timeout', 'absent', 'no_status_reported'].includes(watcher.status) ? 'pass' : 'fail', { reasonCodes: [watcher.safeReasonCode], safeSummary: { status: watcher.status } }),
  };
}

function inferFailureClass(input) {
  if (input.artifactAvailable === false) return 'artifact_upload_missing';
  if (input.phase === 'pnpm_install') return 'pnpm_install_failure';
  if (input.phase === 'typecheck') return 'type_surface_failure';
  if (input.phase === 'test') return 'unit_test_failure';
  if (input.externalRunnerFailure) return 'github_runner_failure';
  return 'unknown_safe_metadata_limited';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(classifySafeCiFailureArtifact({ artifactAvailable: false }), null, 2));
}
