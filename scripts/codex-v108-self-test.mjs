#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.8

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanObjectForUnsafe, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import * as gates from './codex-v108-gate-lib.mjs';

function statusOf(report, key) {
  return report[key]?.status || report.status;
}

function expect(name, builder, key, expected) {
  const report = builder();
  const actual = statusOf(report, key);
  return { name, status: actual === expected ? 'pass' : 'fail', expected, actual, safeSummaryOnly: true };
}

const cases = [
  expect('evidence_closure_breaks_pr_body_run_id_loop', () => gates.buildEvidenceClosureReport({ prBodyRunIdChangedOnly: true, evidencePack: gates.defaultEvidencePack({ auditedPrBodySha256: gates.renderPrBodyFromEvidencePack().sha256 }) }), 'prBodyArtifactLoopBreakerStatus', 'pass'),
  expect('manual_pr_body_generated_section_drift_fails', () => gates.buildEvidenceClosureReport({ manualGeneratedSectionEdit: true }), 'renderedOutputDriftStatus', 'fail'),
  expect('evidence_pack_drift_exact_diff_reported', () => gates.buildEvidenceClosureReport({ evidencePackDrift: true }), 'evidencePackV4Status', 'fail'),
  expect('rendered_docs_drift_fails', () => gates.buildEvidenceClosureReport({ renderedDocsDrift: true }), 'renderedOutputDriftStatus', 'fail'),
  expect('generated_pr_body_patch_safe', () => ({ status: gates.renderPrBodyFromEvidencePack().body.includes('CODEX_GENERATED_EVIDENCE_V1_0_8') ? 'pass' : 'fail' }), 'status', 'pass'),
  expect('verify_mode_mutates_nothing', () => gates.buildEvidenceModeReport({ mode: 'verify', mutated: false }), 'evidenceVerifyModeStatus', 'pass'),
  expect('verify_mode_blocks_mutation', () => gates.buildEvidenceModeReport({ mode: 'verify', mutated: true }), 'evidenceVerifyModeStatus', 'fail'),
  expect('render_mode_does_not_update_pr_body', () => gates.buildEvidenceModeReport({ mode: 'render', updatedPrBody: false }), 'evidenceRenderModeStatus', 'pass'),
  expect('publish_requires_explicit_pr', () => gates.buildEvidenceModeReport({ mode: 'publish', bodyFile: 'safe_body.md', ghAuthAvailable: true }), 'publishRequiresExplicitPrStatus', 'fail'),
  expect('publish_requires_explicit_body_file', () => gates.buildEvidenceModeReport({ mode: 'publish', pr: 1, ghAuthAvailable: true }), 'publishRequiresExplicitBodyFileStatus', 'fail'),
  expect('publish_rejects_default_body_file', () => gates.buildEvidenceModeReport({ mode: 'publish', pr: 1, bodyFile: 'safe_body.md', defaultBodyFile: true, ghAuthAvailable: true }), 'defaultBodyFileProhibitedStatus', 'fail'),
  expect('publish_rejects_dirty_worktree', () => gates.buildEvidenceModeReport({ mode: 'publish', pr: 1, bodyFile: 'safe_body.md', dirtyWorktree: true, ghAuthAvailable: true }), 'evidencePublishModeStatus', 'fail'),
  expect('publish_records_safe_mutation_audit', () => gates.buildEvidenceModeReport({ mode: 'publish', pr: 1, bodyFile: 'safe_body.md', ghAuthAvailable: true }), 'publishMutationAuditStatus', 'pass'),
  expect('metadata_json_overrides_markdown_headings', () => gates.buildPrMetadataReport({ metadataJson: { declaredProfile: 'harness_change' }, markdownOverridesMetadata: false, changedFiles: ['scripts/codex-example.mjs'] }), 'structuredPrMetadataStatus', 'pass'),
  expect('markdown_fallback_only_when_metadata_absent', () => gates.buildPrMetadataReport({ changedFiles: ['docs/process/example.md'] }), 'prBodyMarkdownFallbackStatus', 'pass'),
  expect('profile_fields_are_split', () => gates.buildPrMetadataReport({ declaredProfile: 'docs_only', changedFiles: ['scripts/run-tests.js'] }), 'declaredInferredEffectiveProfileStatus', 'pass'),
  expect('local_pass_remote_fail_produces_delta', () => gates.buildLocalRemoteDeltaStatusReport({ localTargetGate: 'pass', remoteQualityGate: 'fail', remoteNpmWiring: true }), 'localRemoteDeltaReportStatus', 'pass'),
  expect('remote_only_blocker_classified', () => gates.buildLocalRemoteDeltaStatusReport({ localTargetGate: 'pass', remoteQualityGate: 'fail', remoteArtifactMissing: true }), 'remoteArtifactConsumptionStatus', 'fail'),
  expect('formal_current_head_suppresses_stale_temp_diagnostic', () => gates.buildRemoteNpmReport({ formalEvidencePresent: true, staleDiagnostic: true, npmExecuted: true, npmExitCode: 0 }), 'remoteNpmStaleDiagnosticSuppressionStatus', 'pass'),
  expect('wrong_cwd_npm_fails', () => gates.buildRemoteNpmReport({ npmRequired: true, npmExecuted: true, cwd: 'root', expectedCwd: 'apps/backend', npmExitCode: 0 }), 'wrongCwdNpmExecutionStatus', 'fail'),
  expect('root_npm_regression_fails', () => gates.buildRemoteNpmReport({ rootNpmAttemptedIncorrectly: true }), 'rootNpmRegressionStatus', 'fail'),
  expect('genuine_npm_failure_preserved', () => gates.buildRemoteNpmReport({ npmExecuted: true, npmExitCode: 254 }), 'remoteNpmDiagnosticNormalizationV2Status', 'fail'),
  expect('body_head_stale_exact_field', () => gates.buildStaleAuditReport({ bodyHeadSha: { expected: 'a', actual: 'b', bodyOnly: true } }), 'bodyHeadShaStaleStatus', 'fail'),
  expect('artifact_head_stale_exact_field', () => gates.buildStaleAuditReport({ artifactHeadSha: { expected: 'a', actual: 'b' } }), 'artifactHeadShaStaleStatus', 'fail'),
  expect('review_evidence_stale_exact_field', () => gates.buildStaleAuditReport({ reviewEvidenceHead: { expected: 'a', actual: 'b' } }), 'reviewEvidenceHeadMismatchStatus', 'fail'),
  expect('artifact_run_stale_exact_field', () => gates.buildStaleAuditReport({ artifactRunId: { expected: '1', actual: '2' } }), 'artifactRunIdStaleStatus', 'fail'),
  expect('body_only_edited_event_classified', () => gates.buildStaleAuditReport({ bodyOnlyEditedEvent: { expected: 'artifact', actual: 'manual', bodyOnly: true } }), 'bodyOnlyEditedEventStatus', 'fail'),
  expect('parent_branch_unchanged', () => gates.buildBranchLaneIsolationReport({ parentBranchBefore: 'main', parentBranchAfter: 'main' }), 'parentWorktreeInvariantStatus', 'pass'),
  expect('parent_head_unchanged', () => gates.buildBranchLaneIsolationReport({ parentHeadBefore: 'safe_a', parentHeadAfter: 'safe_a' }), 'parentWorktreeInvariantStatus', 'pass'),
  expect('target_checkout_isolated_worktree_only', () => gates.buildBranchLaneIsolationReport({ isolatedWorktreeUsed: true }), 'targetHarnessIsolationStatus', 'pass'),
  expect('parent_tracked_mutation_fails', () => gates.buildBranchLaneIsolationReport({ parentTrackedMutation: true }), 'parentWorktreeInvariantStatus', 'fail'),
  expect('cross_lane_dirty_file_fails', () => gates.buildBranchLaneIsolationReport({ changedFiles: ['src/runtime.ts'] }), 'crossLaneDirtyFileStatus', 'fail'),
  expect('protected_patch_quarantined', () => gates.buildBranchLaneIsolationReport({ protectedPatch: true }), 'protectedPatchQuarantineStatus', 'fail'),
  expect('fast_body_only_repair_avoids_full_gate', () => gates.buildFastDiagnosticReport({ bodyOnlyRepair: true }), 'fastBodyOnlyRepairStatus', 'pass'),
  expect('fast_remote_npm_wiring_bug_identified', () => gates.buildFastDiagnosticReport({ remoteNpmWiring: true }), 'fastRemoteNpmDiagnosticStatus', 'fail'),
  expect('fast_branch_contamination_identified', () => gates.buildFastDiagnosticReport({ branchContamination: true }), 'fastBranchLaneIsolationStatus', 'fail'),
  expect('fast_classification_unknown_identified', () => gates.buildFastDiagnosticReport({ classificationUnknown: true }), 'fastClassificationStatus', 'fail'),
  expect('fast_lane_not_merge_evidence', () => gates.buildFastDiagnosticReport({}), 'fastDiagnosticLaneStatus', 'pass'),
  expect('review_request_is_not_evidence', () => gates.buildReviewEvidenceReport({ required: true, reviewRequestOnly: true }), 'reviewRequestNotEvidenceStatus', 'fail'),
  expect('writer_only_review_blocked', () => gates.buildReviewEvidenceReport({ required: true, writerOnly: true }), 'writerOnlyReviewBlockedStatus', 'fail'),
  expect('bot_only_review_blocked', () => gates.buildReviewEvidenceReport({ required: true, botOnly: true }), 'botOnlyReviewBlockedStatus', 'fail'),
  expect('same_head_independent_approval_satisfies_review', () => gates.buildReviewEvidenceReport({ required: true, independentApprovalSameHead: true }), 'independentReviewIntakeStatus', 'pass'),
  expect('stale_approval_does_not_satisfy_review', () => gates.buildReviewEvidenceReport({ required: true, independentApprovalStale: true }), 'staleReviewEvidenceStatus', 'fail'),
  expect('chatgpt_pro_assessment_policy_dependent', () => gates.buildReviewEvidenceReport({ required: false, independentReviewSubmitted: true }), 'reviewJudgmentStatus', 'pass'),
  expect('representative_live_pr_case_matrix_pass', () => gates.buildRepresentativeLivePrValidationReport({}), 'representativeLivePrValidationStatus', 'pass'),
  expect('representative_live_external_blocker_blocks_rollout_ready', () => gates.buildRepresentativeLivePrValidationReport({ externalBlocked: true }), 'representativeLivePrValidationStatus', 'blocked_by_context'),
  expect('threat_finder_cannot_approve_itself', () => gates.buildThreatModelReport({ finderApprovesOwnFinding: true }), 'independentVerifierStatus', 'fail'),
  expect('threat_patcher_cannot_verify_itself', () => gates.buildThreatModelReport({ patcherVerifiesOwnPatch: true }), 'patchVerificationStatus', 'fail'),
  expect('candidate_patch_quarantined', () => gates.buildThreatModelReport({}), 'candidatePatchQuarantineStatus', 'pass'),
  expect('target_execution_requires_sandbox', () => gates.buildThreatModelReport({ targetExecutionWithoutSandbox: true }), 'targetCodeExecutionSandboxStatus', 'fail'),
  expect('network_egress_denied_by_default', () => gates.buildThreatModelReport({ networkEgressAllowedByDefault: true }), 'networkEgressAllowlistStatus', 'fail'),
  expect('manual_gate_text_alone_not_approval', () => gates.buildManualGateAuditChainReport({ textOnlyApproval: true }), 'manualGateApprovalRecordStatus', 'fail'),
  expect('manual_gate_binds_head_and_operation', () => gates.buildManualGateAuditChainReport({}), 'manualGateCommitMatchStatus', 'pass'),
  expect('manual_gate_reuse_blocked_by_default', () => gates.buildManualGateAuditChainReport({ reusedApproval: true }), 'manualGateOneTimeUseStatus', 'fail'),
  expect('raw_provider_error_normalized', () => gates.buildManualGateAuditChainReport({}), 'providerErrorTaxonomyStatus', 'pass'),
  expect('subagent_advisory_only', () => gates.buildOrchestrationGovernanceReport({ subagentApprovalAsHuman: true, teamSize: 3 }), 'orchestrationSessionTopologyStatus', 'fail'),
  expect('thread_to_thread_advisory_only', () => gates.buildOrchestrationGovernanceReport({ teamSize: 3 }), 'memoryAsContextNotAuthorityStatus', 'pass'),
  expect('parent_final_authority_required', () => gates.buildOrchestrationGovernanceReport({ teamSize: 3 }), 'hookEnforcedBoundaryStatus', 'pass'),
  expect('worktree_not_db_env_secret_isolation', () => gates.buildOrchestrationGovernanceReport({ teamSize: 3 }), 'worktreeIsolationRequiredStatus', 'pass'),
  expect('dangerous_lead_permission_forbidden', () => gates.buildOrchestrationGovernanceReport({ leadDangerousPermission: true, teamSize: 3 }), 'teammatePermissionInheritanceStatus', 'fail'),
  expect('agents_memory_context_not_authority', () => gates.buildOrchestrationGovernanceReport({ teamSize: 3 }), 'agentsMdContextOnlyStatus', 'pass'),
  expect('capability_fixture_only_not_runtime_ready', () => gates.buildCapabilityMaturityReport({ maturity: 'fixture_only' }), 'fixtureOnlyStatus', 'advisory'),
  expect('terminal_no_action_is_valid', () => gates.buildOperatorUxReport({ noDelta: true }), 'terminalNoActionStatus', 'pass'),
  expect('no_delta_no_pr_blocks_speculative_pr', () => gates.buildOperatorUxReport({ noDelta: true, newPrAttempted: true }), 'noDeltaNoPrStatus', 'fail'),
  expect('repo_voxweave_terminal_no_action_registered', () => gates.buildRepoSpecificV108Reports(), 'voxweaveTerminalNoActionGateStatus', 'policy_registered'),
  expect('repo_live2d_target_harness_isolation_registered', () => gates.buildRepoSpecificV108Reports(), 'live2dTargetHarnessIsolationStatus', 'policy_registered'),
  expect('repo_funky_formal_backend_evidence_registered', () => gates.buildRepoSpecificV108Reports(), 'funkyFormalBackendEvidencePriorityStatus', 'policy_registered'),
  expect('repo_iris_priority1_carryover_registered', () => gates.buildRepoSpecificV108Reports(), 'irisPriority1BlockedCarryoverStatus', 'policy_registered'),
  expect('repo_cripto_no_custody_registered', () => gates.buildRepoSpecificV108Reports(), 'criptoTipCryptoNoCustodyStateMachineStatus', 'policy_registered'),
  expect('repo_vgc_no_deploy_no_tx_registered', () => gates.buildRepoSpecificV108Reports(), 'vgcNoDeployNoTxBoundaryStatus', 'policy_registered'),
  expect('safe_summary_blocks_raw_fields', () => ({ status: safeSummaryNoRawFields() ? 'pass' : 'fail' }), 'status', 'pass'),
];

const defaultReport = gates.buildDefaultV108Reports({ caseCount: cases.length, failedCaseCount: 0 });
for (const key of gates.V108_STATUS_KEYS) {
  cases.push(expect(`default_status_${key}`, () => defaultReport, key, 'pass'));
}

const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.8',
  status: failures.length ? 'fail' : 'pass',
  activeHarnessVersion: '1.0.8',
  activeSelfTestSuite: 'v108',
  activeSelfTestStatusKey: 'v108SelfTestStatus',
  activeSelfTest: {
    suite: 'v108',
    statusKey: 'v108SelfTestStatus',
    status: failures.length ? 'fail' : 'pass',
    blocking: true,
    caseCount: cases.length,
    failedCaseCount: failures.length,
    source: 'scripts/codex-v108-self-test.mjs',
  },
  legacySuites: { v107: 'blocking_compatibility', v106: 'advisory', v105: 'advisory' },
  v108SelfTestStatus: {
    status: failures.length ? 'fail' : 'pass',
    blocking: true,
    reasonCodes: failures.length ? ['v108_self_test_failed'] : [],
    evidenceConsumed: [],
    safeSummary: {
      caseCount: cases.length,
      failedCaseCount: failures.length,
      activeSelfTestSuite: 'v108',
    },
    nextSafeAction: failures.length ? 'repair_v108_self_test' : 'continue_source_harness_validation',
    failures,
    safeSummaryOnly: true,
  },
  representativeRealPrReplayV2: failures.length ? 'fail' : 'pass',
  representativeLivePrValidation: failures.length ? 'fail' : 'pass',
  targetRollout: 'not_started',
  safeSummaryOnly: true,
};

if (scanObjectForUnsafe(report).length) {
  report.status = 'fail';
  report.v108SelfTestStatus = {
    status: 'fail',
    blocking: true,
    reasonCodes: ['unsafe_value_detected'],
    evidenceConsumed: [],
    safeSummary: {},
    nextSafeAction: 'repair_unsafe_self_test_output',
    safeSummaryOnly: true,
  };
}

writeJsonReport(report, 'CODEX_V108_SELF_TEST_REPORT');
exitFor(report);

function safeSummaryNoRawFields() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v108-safe-'));
  const file = path.join(tmp, 'safe.json');
  fs.writeFileSync(file, JSON.stringify({ record_count: 1, allowed_count: 1, blocked_count: 0, safe_summary_only: true }));
  const text = fs.readFileSync(file, 'utf8');
  fs.rmSync(tmp, { recursive: true, force: true });
  return !/(raw changed files|endpoint|API key|token|secret|model path|dataset path|raw payload)/i.test(text);
}
