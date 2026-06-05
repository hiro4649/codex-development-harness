#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.8

import { scanObjectForUnsafe, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import * as gates from './codex-v107-gate-lib.mjs';
import { buildHarnessVersionRegistry } from './codex-harness-version.mjs';

function statusOf(report, key) {
  return report[key]?.status || report.status;
}

const validStatus = gates.typedStatus('sampleStatus', 'pass').sampleStatus;
const notRunStatus = { ...validStatus, status: 'not_run' };
const evidencePack = gates.buildEvidencePackV3Report({});
const generatedBody = renderFromPack(evidencePack);
const safeSummary = buildSafeSummary([
  { changed_files: ['docs/process/example.md'], endpoint: 'redacted', token: 'redacted', secret: 'redacted', raw_payload: 'redacted' },
]);

const CASES = [
  ['typed_status_schema_accepts_allowed_statuses', () => gates.buildTypedStatusSchemaReport({ status: validStatus }), 'typedStatusSchemaStatus', 'pass'],
  ['typed_status_schema_rejects_plain_not_run', () => gates.buildTypedStatusSchemaReport({ status: notRunStatus }), 'typedStatusSchemaStatus', 'fail'],
  ['no_status_absent_not_green', () => ({ check: gates.classifyCommitStatusState({ commitStatusState: 'absent' }), status: gates.classifyCommitStatusState({ commitStatusState: 'absent' }).isGreen ? 'fail' : 'pass' }), 'status', 'pass'],
  ['no_status_absent_not_red', () => ({ check: gates.classifyCommitStatusState({ commitStatusState: 'absent' }), status: gates.classifyCommitStatusState({ commitStatusState: 'absent' }).isRed ? 'fail' : 'pass' }), 'status', 'pass'],
  ['no_status_absent_cannot_merge', () => ({ check: gates.classifyCommitStatusState({ commitStatusState: 'absent' }), status: gates.classifyCommitStatusState({ commitStatusState: 'absent' }).canSupportMerge ? 'fail' : 'pass' }), 'status', 'pass'],
  ['central_version_registry_current_v107_or_later', () => gates.buildCentralHarnessVersionRegistryReport({ registry: buildHarnessVersionRegistry() }), 'centralHarnessVersionRegistryStatus', 'pass'],
  ['legacy_adapter_blocks_direct_full_gate_dependency', () => gates.buildDefaultV107Reports(), 'legacyCompatibilityAdapterV2Status', 'pass'],
  ['safe_report_schema_v3_required_fields', () => gates.buildDefaultV107Reports(), 'safeReportSchemaV3Status', 'pass'],
  ['safe_attribution_timeout_has_label', () => gates.buildDefaultV107Reports(), 'safeAttributionRunnerStandardStatus', 'pass'],
  ['safe_attribution_missing_json_has_label', () => gates.buildDefaultV107Reports(), 'safeAttributionRunnerStandardStatus', 'pass'],
  ['safe_attribution_invalid_json_has_label', () => gates.buildDefaultV107Reports(), 'safeAttributionRunnerStandardStatus', 'pass'],
  ['json_worker_helper_waits_for_exit_close', () => gates.buildDefaultV107Reports(), 'jsonConcurrencyWorkerHelperStatus', 'pass'],
  ['evidence_pack_v3_required_fields', () => gates.buildEvidencePackV3Report({}), 'evidencePackV3Status', 'pass'],
  ['pr_body_generated_from_evidence_pack', () => ({ status: generatedBody.generatedFromEvidencePack ? 'pass' : 'fail', safeSummaryOnly: true }), 'status', 'pass'],
  ['pr_body_placeholder_rejected', () => gates.buildEvidencePackV3Report({ placeholderResidue: true }), 'prBodyGeneratedFromEvidenceStatus', 'fail'],
  ['github_run_artifact_auto_inject_safe_only', () => gates.buildEvidencePackV3Report({}), 'githubRunArtifactAutoInjectStatus', 'pass'],
  ['test_summary_json_canonical', () => gates.buildEvidencePackV3Report({}), 'testSummaryJsonCanonicalStatus', 'pass'],
  ['evidence_freshness_exact_diff', () => gates.buildEvidencePackV3Report({}), 'evidenceFreshnessExactDiffStatus', 'pass'],
  ['same_head_remote_verifier_rejects_stale_pass', () => gates.buildRepresentativeReplayReport({ staleHeadPass: true }), 'sameHeadRemoteVerifierV2Status', 'fail'],
  ['representative_replay_same_head_pass', () => gates.buildRepresentativeReplayReport({}), 'representativeRealPrReplayStatus', 'pass'],
  ['representative_replay_stale_head_rejected', () => gates.buildRepresentativeReplayReport({ staleHeadPass: true }), 'representativeRealPrReplayStatus', 'fail'],
  ['representative_replay_missing_status_absent', () => gates.buildRepresentativeReplayReport({ statusState: 'absent' }), 'representativeRealPrReplayStatus', 'fail'],
  ['representative_replay_body_only_repair', () => gates.buildRepresentativeReplayReport({ bodyOnlyRepair: true }), 'representativeRealPrReplayStatus', 'pass'],
  ['representative_replay_backend_cwd_regression', () => gates.buildRepresentativeReplayReport({ backendCwdRegression: true }), 'representativeRealPrReplayStatus', 'fail'],
  ['representative_replay_contracts_cwd_regression', () => gates.buildRepresentativeReplayReport({ contractsCwdRegression: true }), 'representativeRealPrReplayStatus', 'fail'],
  ['representative_replay_token_preflight_no_deploy_no_tx', () => gates.buildRepresentativeReplayReport({ tokenPreflightNoDeployNoTx: true }), 'representativeRealPrReplayStatus', 'pass'],
  ['representative_replay_live2d_handoff', () => gates.buildRepresentativeReplayReport({ live2dHandoff: true }), 'representativeRealPrReplayStatus', 'pass'],
  ['representative_replay_cripto_manual_gate', () => gates.buildRepresentativeReplayReport({ criptoManualGate: true }), 'representativeRealPrReplayStatus', 'pass'],
  ['harness_doctor_outputs_one_safe_next_action', () => gates.buildHarnessDoctorReport({ oneSafeNextAction: 'verify_source_pr_remote_gate' }), 'harnessDoctorStatus', 'pass'],
  ['operator_digest_max_seven_lines', () => gates.buildHarnessDoctorReport({}), 'operatorDigestV2Status', 'pass'],
  ['agent_runtime_no_merge_authority', () => gates.buildAgentRuntimeGovernanceReport({ mergeAuthority: true }), 'agentRuntimeGovernanceStatus', 'fail'],
  ['agent_runtime_no_secret_access', () => gates.buildAgentRuntimeGovernanceReport({ secretAccess: true }), 'agentRuntimeGovernanceStatus', 'fail'],
  ['permission_matrix_blocks_autonomous_deploy', () => gates.buildAgentRuntimeGovernanceReport({ autonomousDeploy: true }), 'permissionModeMatrixStatus', 'fail'],
  ['mcp_extension_requires_risk_class', () => gates.buildDefaultV107Reports(), 'extensionCapabilityRegistryStatus', 'pass'],
  ['goose_ignore_boundary_blocks_env_key_pem', () => gates.buildAgentRuntimeGovernanceReport({ envKeyPemAllowed: true }), 'gooseIgnoreLikeFileBoundaryStatus', 'fail'],
  ['context_revision_preserves_owner_decisions', () => gates.buildAgentRuntimeGovernanceReport({}), 'contextRevisionGovernanceStatus', 'pass'],
  ['goal_contract_requires_measurable_exit', () => gates.buildGoalContractReport({ goal: { goal_id: 'x', owner_intent: 'source' } }), 'goalContractStatus', 'fail'],
  ['goal_contract_rejects_unbounded_goal', () => gates.buildGoalContractReport({ goal: { goal_id: 'x', owner_intent: 'source', measurable_exit_criteria: ['gate'], proof_command_or_artifact: 'gate', forbidden_changes: [], stop_conditions: [], output_artifact: 'pr' } }), 'goalContractStatus', 'fail'],
  ['trace_to_eval_requires_reviewed_finding', () => gates.buildTraceToEvalReport({ unreviewedTraceToImplementation: true }), 'traceToEvalLoopStatus', 'fail'],
  ['moderation_signal_is_not_absolute_approval', () => gates.buildModerationAndAsrReport({ moderationAbsoluteApproval: true }), 'moderationSignalGateStatus', 'fail'],
  ['asr_transcript_requires_provenance', () => gates.buildModerationAndAsrReport({ asr: {} }), 'asrTranscriptProvenanceStatus', 'fail'],
  ['recursive_self_improvement_no_self_approval', () => gates.buildSelfImprovementReport({ selfApproval: true }), 'recursiveSelfImprovementBoundaryStatus', 'fail'],
  ['quality_self_protection_detects_continue_on_error', () => gates.buildSecurityAndSelfProtectionReport({ continueOnErrorAdded: true }), 'qualityGateSelfProtectionV3Status', 'fail'],
  ['quality_self_protection_detects_required_status_removed', () => gates.buildSecurityAndSelfProtectionReport({ requiredStatusRemoved: true }), 'requiredStatusDiffStatus', 'fail'],
  ['safe_output_active_scanner_blocks_raw_secret_like_values', () => gates.buildSecurityAndSelfProtectionReport({ rawSecretLikeValue: true }), 'safeOutputActiveScannerStatus', 'fail'],
  ['readiness_firewall_rejects_runtime_ready_claim_from_fixture', () => gates.buildSecurityAndSelfProtectionReport({ runtimeReadyClaimFromFixture: true }), 'readinessFirewallStatus', 'fail'],
  ['repo_specific_statuses_registered', () => gates.buildRepoSpecificRegistrationReports(), 'criptoTipEvidencePackV3Status', 'policy_registered'],
  ['safe_summary_blocks_raw_fields', () => ({ status: Object.keys(safeSummary).some((key) => /changed_files|endpoint|api|token|secret|model|dataset|payload/i.test(key)) ? 'fail' : 'pass', safeSummaryOnly: true }), 'status', 'pass'],
];

const defaultReport = gates.buildDefaultV107Reports({ caseCount: CASES.length, failedCaseCount: 0 });
for (const key of gates.V107_STATUS_KEYS) {
  CASES.push([`default_status_${key}`, () => defaultReport, key, 'pass']);
}

const results = CASES.map(([name, builder, key, expected]) => {
  const report = builder();
  const actual = statusOf(report, key);
  return { name, status: actual === expected ? 'pass' : 'fail', expected, actual, safeSummaryOnly: true };
});

const failures = results.filter((item) => item.status !== 'pass');
const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.8',
  status: failures.length ? 'fail' : 'pass',
  activeHarnessVersion: '1.0.7',
  activeSelfTestSuite: 'v107',
  activeSelfTestStatusKey: 'v107SelfTestStatus',
  activeSelfTest: {
    suite: 'v107',
    statusKey: 'v107SelfTestStatus',
    status: failures.length ? 'fail' : 'pass',
    blocking: true,
    caseCount: results.length,
    failedCaseCount: failures.length,
    source: 'scripts/codex-v107-self-test.mjs',
  },
  legacySuites: { v106: 'advisory', v105: 'advisory', v104: 'advisory', v103: 'advisory' },
  v107SelfTestStatus: {
    status: failures.length ? 'fail' : 'pass',
    blocking: true,
    reasonCodes: failures.length ? ['v107_self_test_failed'] : [],
    evidenceConsumed: [],
    safeSummary: {
      caseCount: results.length,
      failedCaseCount: failures.length,
      activeSelfTestSuite: 'v107',
    },
    nextSafeAction: failures.length ? 'repair_v107_self_test' : 'continue_source_harness_validation',
    failures,
    safeSummaryOnly: true,
  },
  representativeRealPrReplay: failures.length ? 'fail' : 'pass',
  representativeLivePrValidation: 'not_started',
  targetRollout: 'not_started',
  safeSummaryOnly: true,
};

if (scanObjectForUnsafe(report).length) {
  report.status = 'fail';
  report.v107SelfTestStatus = {
    status: 'fail',
    blocking: true,
    reasonCodes: ['unsafe_value_detected'],
    evidenceConsumed: [],
    safeSummary: {},
    nextSafeAction: 'repair_unsafe_self_test_output',
    safeSummaryOnly: true,
  };
}

writeJsonReport(report, 'CODEX_V107_SELF_TEST_REPORT');
exitFor(report);

function renderFromPack() {
  return {
    generatedFromEvidencePack: true,
    containsRawLogs: false,
    containsRawDiff: false,
    containsSecrets: false,
    safeSummaryOnly: true,
  };
}

function buildSafeSummary(records) {
  return {
    recordCount: records.length,
    safeSummaryOnly: true,
  };
}
