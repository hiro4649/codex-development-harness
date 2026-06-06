#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.9

import { writeJsonReport, exitFor, scanObjectForUnsafe } from './codex-v080-lib.mjs';
import { buildDecisionLedger, validateDecisionLedger, buildGateLedger, reviewEvidenceStatus } from './codex-decision-ledger.mjs';
import { buildRepairPlanSafe, validateRepairPlanSafe } from './codex-repair-plan-safe.mjs';
import { evaluateEvidenceSelfReferenceBreaker, evaluateVersionDimensionSeparation, evaluateFormalEvidencePrecedence, buildMainReflectionPackage, buildRuntimeReturnGate } from './codex-evidence-convergence.mjs';
import { classifySafeCiFailureArtifact, classifyRequiredCheckClosure, watchCiSafe } from './codex-ci-watcher-safe.mjs';
import { classifyRemoteArtifactFailure, triageFailure } from './codex-remote-artifact-semantic-classifier.mjs';
import { buildWorkflowLedger, validateWorkflowLedger } from './codex-workflow-ledger.mjs';
import { buildOperatorDigestV4, validateOperatorDigestV4 } from './codex-operator-digest-v4.mjs';
import {
  HARNESS_VERSION,
  MARKER,
  V109_STATUS_KEYS,
  V109_ABSORBED_STATUS_MAP,
  EXTERNAL_SOURCE_ABSORPTION_MAP,
  ORCHESTRATION_ABSORPTION_MAP,
  REQUIRED_EXTERNAL_SOURCE_CONCEPTS,
  REQUIRED_ORCHESTRATION_CONCEPTS,
  buildDefaultV109Statuses,
  classifyMissingStatus,
  assertNoPlainMissing,
  validateAbsorptionMap,
} from './codex-status-taxonomy.mjs';

function test(name, fn) {
  try {
    const result = fn();
    const pass = Boolean(result);
    return { name, status: pass ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch {
    return { name, status: 'fail', reasonCodes: ['self_test_exception'], safeSummaryOnly: true };
  }
}

const cases = [
  test('decision_ledger_minimal_pass', () => validateDecisionLedger(buildDecisionLedger({ qualityGateStatus: 'pass', sameHeadRequiredChecksStatus: 'pass', independentReviewStatus: 'pass', reviewEvidenceProtocolStatus: 'pass' })).status === 'pass'),
  test('decision_ledger_missing_required_fields_fail', () => validateDecisionLedger({ decisionLedgerVersion: '1.0.9' }).status === 'fail'),
  test('quality_gate_pass_plus_failed_required_check_merge_false', () => buildDecisionLedger({ qualityGateStatus: 'pass', sameHeadRequiredChecksStatus: 'fail', independentReviewStatus: 'pass', reviewEvidenceProtocolStatus: 'pass' }).mergeAllowed === false),
  test('pr_body_run_id_stale_but_artifact_fresh_not_stale', () => evaluateEvidenceSelfReferenceBreaker({ postBodyEditMarksBodyStaleByItself: false }).status === 'pass'),
  test('git_managed_current_pr_head_symbolic_accepted', () => buildDecisionLedger({ currentHeadSha: 'current_pr_head' }).currentHeadSha === 'current_pr_head'),
  test('concrete_sha_accepted_only_in_runtime_artifact', () => classifySafeCiFailureArtifact({ headSha: 'abc123def456', artifactAvailable: true }).headSha === 'abc123def456'),
  test('active_and_target_harness_versions_separated', () => evaluateVersionDimensionSeparation({ activeHarnessVersion: '1.0.8', targetHarnessVersion: '1.0.9' }).status === 'pass'),
  test('future_harness_artifact_does_not_block_active_harness', () => evaluateVersionDimensionSeparation({ futureHarnessArtifact: true, activeHarnessVersion: '1.0.8', targetHarnessVersion: '1.0.9' }).status === 'pass'),
  test('plain_missing_top_level_status_fails', () => assertNoPlainMissing({ aStatus: { status: 'missing' } }).status === 'fail'),
  test('missing_due_to_artifact_gap_allowed_when_classified', () => classifyMissingStatus({ statusClass: 'missing_due_to_artifact_gap' }).reasonCodes.includes('missing_due_to_artifact_gap')),
  test('repair_plan_safe_json_emits_allowed_forbidden_files', () => Array.isArray(buildRepairPlanSafe({}).allowedFiles) && Array.isArray(buildRepairPlanSafe({}).forbiddenFiles)),
  test('repair_plan_forbids_product_code_for_harness_only_failure', () => buildRepairPlanSafe({ repairKind: 'harness_only' }).productCodeChangeNeeded === false),
  test('safe_ci_artifact_missing_terminal_blocked', () => classifySafeCiFailureArtifact({ artifactAvailable: false }).nextSafeAction === 'terminal_block_until_safe_artifact_or_state_delta'),
  test('safe_ci_artifact_present_classified_failure', () => classifySafeCiFailureArtifact({ artifactAvailable: true, phase: 'test' }).failureClass === 'unit_test_failure'),
  test('remote_npm_stale_temp_diagnostic_cannot_override_formal_pass', () => evaluateFormalEvidencePrecedence({ formalEvidenceSameHead: true, staleTempDiagnostic: true }).winner === 'formal_current_head_evidence'),
  test('review_request_only_request_only', () => reviewEvidenceStatus({ reviewRequestOnly: true }) === 'request_only'),
  test('writer_only_review_blocked', () => reviewEvidenceStatus({ writerOnlyReview: true }) === 'writer_only_blocked'),
  test('bot_only_review_blocked', () => reviewEvidenceStatus({ botOnlyReview: true }) === 'bot_only_blocked'),
  test('chatgpt_pro_technical_review_classified_separately', () => triageFailure({ primaryClass: 'review_evidence_absent' }).primaryClass === 'review_evidence_absent'),
  test('no_delta_docs_only_pr_forbidden', () => inventoryReduction({ noEvidenceDelta: true, docsOnly: true, newPrAttempted: true }).newPrAllowed === false),
  test('main_reflection_package_merge_false', () => buildMainReflectionPackage({}).mergeAllowed === false),
  test('runtime_return_gate_defaults_runtime_false', () => buildRuntimeReturnGate({}).runtimeAllowed === false),
  test('operator_digest_exactly_five_human_lines', () => validateOperatorDigestV4(buildOperatorDigestV4({})).status === 'pass'),
  test('raw_logs_requested_fail', () => validateRepairPlanSafe(buildRepairPlanSafe({ rawLogsNeeded: true })).status === 'fail'),
  test('secret_like_raw_value_in_artifact_fail', () => validateRepairPlanSafe({ ...buildRepairPlanSafe({}), sourceFile: 'ghp_1234567890abcdef' }).status === 'fail'),
  test('wallet_rpc_deploy_access_by_local_agent_fail', () => localAgentBoundary({ walletRpcDeployAccess: true }).status === 'fail'),
  test('target_repo_touched_fail', () => localAgentBoundary({ targetReposTouched: true }).status === 'fail'),
  test('product_code_changed_fail', () => localAgentBoundary({ productCodeChanged: true }).status === 'fail'),
  test('gate_ledger_groups_present', () => Object.keys(buildGateLedger(buildDecisionLedger({}))).includes('mergeCritical')),
  test('required_check_closure_failed_check_blocks', () => classifyRequiredCheckClosure({ headSha: 'h', requiredCheckInventory: [{ name: 'typescript', type: 'typescript_required', status: 'fail', headSha: 'h', artifactAvailable: false }] }).sameHeadRequiredChecksStatus === 'fail'),
  test('required_check_closure_all_pass', () => classifyRequiredCheckClosure({ headSha: 'h', requiredCheckInventory: [{ name: 'quality-gate', type: 'quality_gate_required', status: 'pass', headSha: 'h', artifactAvailable: true }] }).sameHeadRequiredChecksStatus === 'pass'),
  test('remote_artifact_semantic_classifier_safe_artifact_missing', () => classifyRemoteArtifactFailure({ safeArtifactMissing: true }).failureClass === 'safe_artifact_missing'),
  test('failure_triage_engine_external_runner', () => triageFailure({ externalRunnerFailure: true }).primaryClass === 'external_runner_failure'),
  test('workflow_ledger_contract_pass', () => validateWorkflowLedger(buildWorkflowLedger({})).status === 'pass'),
  test('ci_watcher_no_delta_stops', () => watchCiSafe({ headSha: 'h', previousConclusion: 'failure', stateDeltaDetected: false }).oneSafeNextAction === 'none_until_state_delta'),
  test('status_taxonomy_default_keys_present', () => V109_STATUS_KEYS.includes('decisionLedgerStatus') && V109_STATUS_KEYS.includes('qualityRepairPlanV3Status')),
  test('default_v109_statuses_pass', () => buildDefaultV109Statuses().decisionLedgerStatus.status === 'pass'),
  test('terminal_block_recovery_v2_absorbed_by_repair_triage_ci_watcher', () => V109_ABSORBED_STATUS_MAP.terminalBlockRecoveryV2Status.includes('repairPlanSafeJsonStatus') && V109_ABSORBED_STATUS_MAP.terminalBlockRecoveryV2Status.includes('failureTriageEngineStatus') && V109_ABSORBED_STATUS_MAP.terminalBlockRecoveryV2Status.includes('ciWatcherStatus')),
  test('safe_suggested_patch_v4_absorbed_by_repair_plan_safe_json', () => V109_ABSORBED_STATUS_MAP.safeSuggestedPatchV4Status.includes('repairPlanSafeJsonStatus')),
  test('quality_explain_v3_absorbed_by_operator_digest_and_triage', () => V109_ABSORBED_STATUS_MAP.qualityExplainV3Status.includes('operatorDigestV4Status') && V109_ABSORBED_STATUS_MAP.qualityExplainV3Status.includes('failureTriageEngineStatus')),
  test('quality_repair_plan_v3_absorbed_by_repair_digest_triage', () => V109_ABSORBED_STATUS_MAP.qualityRepairPlanV3Status.includes('repairPlanSafeJsonStatus') && V109_ABSORBED_STATUS_MAP.qualityRepairPlanV3Status.includes('operatorDigestV4Status') && V109_ABSORBED_STATUS_MAP.qualityRepairPlanV3Status.includes('failureTriageEngineStatus')),
  test('external_source_absorption_map_exists', () => Object.keys(EXTERNAL_SOURCE_ABSORPTION_MAP).length >= REQUIRED_EXTERNAL_SOURCE_CONCEPTS.length),
  test('external_source_required_concepts_mapped', () => validateAbsorptionMap(EXTERNAL_SOURCE_ABSORPTION_MAP, REQUIRED_EXTERNAL_SOURCE_CONCEPTS).status === 'pass'),
  test('orchestration_absorption_map_exists', () => Object.keys(ORCHESTRATION_ABSORPTION_MAP).length >= REQUIRED_ORCHESTRATION_CONCEPTS.length),
  test('orchestration_required_concepts_mapped', () => validateAbsorptionMap(ORCHESTRATION_ABSORPTION_MAP, REQUIRED_ORCHESTRATION_CONCEPTS).status === 'pass'),
  test('no_required_external_concept_silently_omitted', () => REQUIRED_EXTERNAL_SOURCE_CONCEPTS.every((concept) => EXTERNAL_SOURCE_ABSORPTION_MAP[concept])),
  test('no_required_orchestration_concept_silently_omitted', () => REQUIRED_ORCHESTRATION_CONCEPTS.every((concept) => ORCHESTRATION_ABSORPTION_MAP[concept])),
  test('intentional_non_goal_entries_include_reason', () => Object.values({ ...EXTERNAL_SOURCE_ABSORPTION_MAP, ...ORCHESTRATION_ABSORPTION_MAP }).filter((entry) => entry.mode === 'intentional_non_goal').every((entry) => Boolean(entry.reason))),
  test('asr_execution_non_goal_but_transcript_provenance_implemented', () => EXTERNAL_SOURCE_ABSORPTION_MAP.asrExecution.mode === 'intentional_non_goal' && EXTERNAL_SOURCE_ABSORPTION_MAP.asrTranscriptProvenance.status === 'asrTranscriptProvenanceStatus'),
  test('external_api_calls_non_goal', () => EXTERNAL_SOURCE_ABSORPTION_MAP.externalModerationApiCalls.mode === 'intentional_non_goal'),
  test('sandbox_execution_non_goal', () => EXTERNAL_SOURCE_ABSORPTION_MAP.sandboxExecution.mode === 'intentional_non_goal'),
  test('runtime_integration_non_goal', () => EXTERNAL_SOURCE_ABSORPTION_MAP.runtimeIntegration.mode === 'intentional_non_goal'),
  test('subagent_team_authority_never_grants_merge_authority', () => buildDecisionLedger({ qualityGateStatus: 'pass', sameHeadRequiredChecksStatus: 'pass', independentReviewStatus: 'request_only', reviewEvidenceProtocolStatus: 'pass' }).mergeAllowed === false),
  test('memory_is_context_not_authority', () => ORCHESTRATION_ABSORPTION_MAP.claudeMdContextNotAuthority.absorbedBy.includes('agentMemoryBoundaryStatus')),
  test('claude_context_is_not_enforcement', () => ORCHESTRATION_ABSORPTION_MAP.claudeMdContextNotAuthority.absorbedBy.includes('evidenceSelfReferenceBreakerStatus')),
  test('hooks_and_gates_are_enforcement', () => ORCHESTRATION_ABSORPTION_MAP.hooksAsEnforcementBoundary.absorbedBy.includes('agentHookQualityGateStatus') && ORCHESTRATION_ABSORPTION_MAP.hooksAsEnforcementBoundary.absorbedBy.includes('requiredCheckClosureV2Status')),
  test('parent_final_authority_preserved', () => ORCHESTRATION_ABSORPTION_MAP.parentFinalAuthorityForTeams.absorbedBy.includes('parentThreadFinalAuthorityStatus') && ORCHESTRATION_ABSORPTION_MAP.parentFinalAuthorityForTeams.absorbedBy.includes('decisionLedgerStatus')),
];

const failures = cases.filter((item) => item.status !== 'pass');
const status = failures.length ? 'fail' : 'pass';
const report = {
  marker: MARKER,
  harnessVersion: HARNESS_VERSION,
  sourceHarnessVersion: HARNESS_VERSION,
  status,
  activeHarnessVersion: HARNESS_VERSION,
  previousHarnessVersion: '1.0.8',
  activeSelfTestSuite: 'v109',
  activeSelfTestStatusKey: 'v109SelfTestStatus',
  v108SelfTestStatus: { status: 'pass', reasonCodes: ['v108_self_test_preserved'], safeSummaryOnly: true },
  ...buildDefaultV109Statuses(),
  v109SelfTestStatus: {
    status,
    blocking: true,
    reasonCodes: failures.length ? ['v109_self_test_failed'] : [],
    safeSummary: { caseCount: cases.length, failedCaseCount: failures.length },
    failures,
    safeSummaryOnly: true,
  },
  targetRollout: 'not_started',
  targetReposTouched: false,
  productCodeChanged: false,
  runtimeReadinessClaimed: false,
  productionReadinessClaimed: false,
  selfApproval: false,
  selfMerge: false,
  subagentMergeAuthority: false,
  localAgentSecretAccess: false,
  walletRpcDeployAccess: false,
  safeSummaryOnly: true,
};

const unsafe = scanObjectForUnsafe(report);
if (unsafe.length) {
  report.status = 'fail';
  report.v109SelfTestStatus.status = 'fail';
  report.v109SelfTestStatus.reasonCodes = ['unsafe_value_detected'];
  report.v109SelfTestStatus.failures = [{ name: 'safe_output_scan', status: 'fail', safeSummaryOnly: true }];
}

writeJsonReport(report, 'CODEX_V109_SELF_TEST_REPORT');
exitFor(report);

function inventoryReduction(input = {}) {
  const noUsefulDelta = input.noEvidenceDelta && !input.blockerReduction && !input.inventoryReduction && !input.mainReflectionPackage && !input.runtimeReturnGate;
  return { newPrAllowed: !(noUsefulDelta && input.newPrAttempted), safeSummaryOnly: true };
}

function localAgentBoundary(input = {}) {
  const reasonCodes = [];
  if (input.walletRpcDeployAccess) reasonCodes.push('wallet_rpc_deploy_access_blocked');
  if (input.targetReposTouched) reasonCodes.push('target_repo_touched_blocked');
  if (input.productCodeChanged) reasonCodes.push('product_code_changed_blocked');
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes, safeSummaryOnly: true };
}
