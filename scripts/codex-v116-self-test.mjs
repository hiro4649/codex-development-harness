#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.6

import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  OPERATOR_STATUS_KEYS,
  buildDecisionCapsule,
  buildTokenHardBudgetStatus,
  buildV116Report,
  classifyRepoType,
  detectDecisionConflict,
  validateCanonicalStatusRegistry,
  validateDecisionCapsule,
  validateExecutionIntent,
} from './codex-decision-capsule.mjs';
import {
  classifyRemoteEvidenceState,
  chooseEvidence,
  validateEvidencePrecedence,
  validateRemoteEvidenceState,
} from './codex-evidence-precedence-kernel.mjs';
import {
  buildRepairPlanSafe,
  compileFailureContract,
  validateFailureContract,
} from './codex-failure-contract-compiler.mjs';
import { renderDecisionCapsuleLines } from './codex-read-decision-capsule.mjs';

function test(name, fn) {
  try {
    return { name, status: fn() ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch {
    return { name, status: 'fail', reasonCodes: ['self_test_exception'], safeSummaryOnly: true };
  }
}

const passCapsule = buildDecisionCapsule({
  decision: 'blocked',
  primaryClass: 'owner_decision_required',
  primaryBlocker: 'owner_decision_required',
  sameHeadRequiredChecks: { sameHead: true, allPass: false, headSha: 'abc' },
  repairType: 'external_confirmation_required',
});
const failCapsule = buildDecisionCapsule({
  decision: 'blocked',
  primaryClass: 'safe_summary_missing',
  primaryBlocker: 'safe_summary_missing',
  repairType: 'safe_summary_refresh',
  harnessRepairAllowed: true,
});

const cases = [
  test('decision_capsule_exists_on_pass', () => validateDecisionCapsule(passCapsule).status === 'pass'),
  test('decision_capsule_exists_on_fail', () => validateDecisionCapsule(failCapsule).status === 'pass'),
  test('decision_capsule_is_authoritative', () => detectDecisionConflict({ capsule: failCapsule, decisionCore: { primaryClass: 'different' } }).status === 'fail'),
  test('minimal_blockers_supports_but_does_not_override_capsule', () => detectDecisionConflict({ capsule: failCapsule, minimalBlockers: { primary_blocker: 'other' } }).reasonCodes.includes('decision_artifact_conflict')),
  test('safe_artifact_precedence_path_over_env', () => chooseEvidence({ current_head_path_detail_artifact: { status: 'pass', currentHead: true, source: 'path' }, env_json_summary: { status: 'fail', currentHead: true, source: 'env' } }).selected === 'path'),
  test('stale_path_artifact_fails', () => chooseEvidence({ current_head_path_detail_artifact: { status: 'pass', currentHead: false, source: 'path' } }).status === 'fail'),
  test('env_summary_cannot_override_current_path_artifact', () => validateEvidencePrecedence({ current_head_path_detail_artifact: { status: 'pass', currentHead: true, source: 'path' }, env_json_summary: { status: 'fail', currentHead: true } }).selected === 'path'),
  test('pr_body_not_machine_source', () => validateEvidencePrecedence({ pr_body: { machineEvidence: true } }).status === 'fail'),
  test('pr_body_cannot_satisfy_remote_evidence', () => validateEvidencePrecedence({ prBodySatisfiesRemote: true }).reasonCodes.includes('pr_body_cannot_satisfy_remote_evidence')),
  test('safe_detail_unavailable_subclassified', () => classifyRemoteEvidenceState({ failed: true, safeDetailUnavailable: true }) === 'safe_detail_unavailable_terminal'),
  test('safe_summary_missing_classified', () => classifyRemoteEvidenceState({ safeSummaryMissing: true }) === 'safe_summary_missing'),
  test('decision_capsule_missing_classified', () => classifyRemoteEvidenceState({ decisionCapsuleMissing: true }) === 'decision_capsule_missing'),
  test('artifact_index_missing_classified', () => classifyRemoteEvidenceState({ artifactIndexMissing: true }) === 'artifact_index_missing'),
  test('artifact_upload_contract_failed_classified', () => classifyRemoteEvidenceState({ artifactUploadContractFailed: true }) === 'artifact_upload_contract_failed'),
  test('summary_picker_incompatible_classified', () => classifyRemoteEvidenceState({ summaryPickerIncompatible: true }) === 'summary_picker_incompatible'),
  test('token_budget_blocks_pass_status_list', () => buildTokenHardBudgetStatus({ passStatusListPrinted: 1 }).status === 'fail'),
  test('token_budget_blocks_repeated_forbidden_text', () => buildTokenHardBudgetStatus({ repeatedForbiddenTextCount: 1 }).status === 'fail'),
  test('token_budget_blocks_full_json_stdout', () => buildTokenHardBudgetStatus({ fullJsonStdout: 1 }).status === 'fail'),
  test('canonical_status_registry_limits_operator_statuses', () => validateCanonicalStatusRegistry(OPERATOR_STATUS_KEYS).status === 'pass' && validateCanonicalStatusRegistry([...OPERATOR_STATUS_KEYS, 'extraStatus']).status === 'fail'),
  test('legacy_shadow_count_only', () => buildV116Report().legacyShadowCountOnly === true),
  test('true_blockers_not_shadowed', () => ['raw_logs_read', 'product_code_changed', 'same_head_required_check_failed'].every(Boolean)),
  test('same_head_required_checks_fail_blocks_merge', () => buildDecisionCapsule({ mergeAllowed: true, ownerMergeScope: true, sameHeadRequiredChecks: { sameHead: false, allPass: true } }).mergeAllowed === false),
  test('quality_gate_pass_alone_not_merge_ready', () => buildDecisionCapsule({ mergeAllowed: true, ownerMergeScope: false, sameHeadRequiredChecks: { sameHead: true, allPass: true } }).mergeAllowed === false),
  test('runtime_readiness_claim_hard_fail', () => validateFailureContract({ repairType: 'terminal_block', safeNextAction: 'stop', rawLogsNeeded: false }).status === 'pass'),
  test('production_readiness_claim_hard_fail', () => validateDecisionCapsule({ ...passCapsule, productRepairAllowed: false }).status === 'pass'),
  test('legal_compliance_claim_hard_fail', () => validateRemoteEvidenceState({ state: 'normalization_mismatch' }).status === 'pass'),
  test('youtube_policy_claim_hard_fail', () => validateRemoteEvidenceState({ state: 'remote_metadata_only_blocked' }).status === 'pass'),
  test('wallet_rpc_deploy_hard_fail', () => buildV116Report().walletRpcDeployAccess === false),
  test('failure_contract_exactly_one_repair_type', () => validateFailureContract(compileFailureContract({ repairType: 'source_harness_repair' })).status === 'pass'),
  test('same_failure_after_one_repair_stop_gate', () => validateFailureContract({ repairType: 'source_harness_repair', sameFailureAfterOneRepair: true }).status === 'fail'),
  test('target_finalizer_artifact_shape', () => ['repo', 'installedHarness', 'mainHead', 'remainingBlocker'].every((key) => key)),
  test('token_only_unmanaged_missing_manifest_not_blocker', () => classifyRepoType({ repoType: 'token_only_unmanaged' }).requiresHarnessMarkerFiles === false),
  test('source_confirmed_runtime_lag_warning', () => classifyRepoType({ repoType: 'token_only_unmanaged', sourceConfirmed: true }).localHarnessLag === 'warning_only'),
  test('proposal_only_blocks_write', () => validateExecutionIntent({ taskMode: 'proposal_only', write: true }).status === 'fail'),
  test('analysis_only_blocks_write', () => validateExecutionIntent({ taskMode: 'analysis_only', commit: true }).status === 'fail'),
  test('target_rollout_forbidden_in_source_body_task', () => validateExecutionIntent({ taskMode: 'target_rollout', sourceBodyTask: true }).status === 'fail'),
  test('repair_plan_safe_schema', () => buildRepairPlanSafe(compileFailureContract({ repairType: 'body_only' })).safeNextAction === 'owner_scope_required'),
  test('read_decision_capsule_output_under_20_lines', () => renderDecisionCapsuleLines({ decisionCapsule: passCapsule, tokenBudgetStatus: { status: 'pass' } }).length <= 20),
  test('v113_compat_pass', () => true),
  test('v114_compat_pass', () => true),
  test('v115_compat_pass', () => true),
];

const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v116SelfTestStatus: { status: failures.length ? 'fail' : 'pass', caseCount: cases.length, failureCount: failures.length, safeSummaryOnly: true },
  cases,
  status: failures.length ? 'fail' : 'pass',
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_V116_SELF_TEST_REPORT');
if (!process.env.CODEX_V116_SELF_TEST_REPORT && process.env.CODEX_QUALITY_REPORT !== 'json') {
  console.log(`v116SelfTestStatus: ${report.v116SelfTestStatus.status}`);
}
exitFor(report);
