#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.7

import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  OPERATOR_STATUS_KEYS,
  buildDecisionCapsuleV117,
  buildDefaultVerifierCapsule,
  buildV117Report,
  validateBoundaryProfileFixture,
  validateDecisionCapsuleAuthority,
  validateLegacyCompressionFixture,
  validateScopeGrantFixture,
  validateVerifierCapsule,
} from './codex-verifier-capsule.mjs';
import {
  buildDefaultOutcomeContract,
  validateOutcomeContract,
} from './codex-outcome-contract.mjs';
import {
  buildArtifactConsistencyReport,
  classifySafeDetailUnavailable,
  validateArtifactConsistency,
  validateDeltaOnlyFinalizer,
} from './codex-artifact-consistency-contract.mjs';
import {
  pickSafeFailureEvidence,
  validateSafeFailureReader,
} from './codex-read-safe-failure.mjs';
import { validateDecisionCapsule } from './codex-decision-capsule.mjs';

function test(name, fn) {
  try {
    return { name, status: fn() ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch {
    return { name, status: 'fail', reasonCodes: ['self_test_exception'], safeSummaryOnly: true };
  }
}

const goodOutcome = buildDefaultOutcomeContract({
  ownerMergeInstructionPresent: true,
  successExitCriteria: ['same_head_checks_pass', 'quality_score_100'],
});
const goodCapsule = buildDecisionCapsuleV117({
  decision: 'blocked',
  mergeAllowed: false,
  primaryClass: 'owner_decision_required',
  primaryBlocker: 'owner_decision_required',
  ownerMergeScope: false,
  sameHeadRequiredChecks: { sameHead: true, allPass: false, headSha: 'abc' },
});
const allowedCapsule = buildDecisionCapsuleV117({
  decision: 'allowed',
  mergeAllowed: true,
  ownerMergeScope: true,
  sameHeadRequiredChecks: { sameHead: true, allPass: true, headSha: 'abc' },
  primaryClass: 'owner_merge_instruction_present',
  primaryBlocker: 'none',
  safeNextAction: 'merge_after_same_head_required_checks',
});

const cases = [
  test('decision_capsule_authority_preserved', () => validateDecisionCapsuleAuthority(goodCapsule).status === 'pass'),
  test('decision_capsule_must_not_delegate_to_pr_body', () => validateDecisionCapsuleAuthority({ ...goodCapsule, prBodyMachineEvidence: true }).status === 'fail'),
  test('decision_capsule_allowed_requires_merge_allowed', () => validateDecisionCapsuleAuthority({ ...goodCapsule, decision: 'allowed', mergeAllowed: false }).reasonCodes.includes('allowed_with_merge_false')),
  test('decision_capsule_legacy_v116_guard_still_fails_allowed_merge_false', () => validateDecisionCapsule({ ...goodCapsule, harnessVersion: '1.1.6', decision: 'allowed', mergeAllowed: false }).status === 'fail'),
  test('outcome_contract_passes_with_exit_criteria_and_owner_merge_instruction', () => validateOutcomeContract(goodOutcome).status === 'pass'),
  test('outcome_contract_blocks_vague_goal', () => validateOutcomeContract({ ...goodOutcome, goalSummary: 'improve everything' }).status === 'fail'),
  test('outcome_contract_requires_verifier', () => validateOutcomeContract({ ...goodOutcome, verifierRequired: false }).reasonCodes.includes('outcome_verifier_required')),
  test('verifier_capsule_passes_independent_read_only_fixture', () => validateVerifierCapsule(buildDefaultVerifierCapsule({ decisionCapsule: allowedCapsule })).status === 'pass'),
  test('verifier_capsule_blocks_same_actor_author_merge_verify', () => validateVerifierCapsule(buildDefaultVerifierCapsule({ actorIsolation: false })).status === 'fail'),
  test('verifier_capsule_blocks_raw_log_reader', () => validateVerifierCapsule(buildDefaultVerifierCapsule({ rawLogsRead: true })).reasonCodes.includes('raw_logs_read')),
  test('artifact_consistency_requires_generated_indexed_uploaded_observed', () => buildArtifactConsistencyReport().artifactConsistencyStatus.status === 'pass'),
  test('artifact_consistency_blocks_index_without_safe_summary', () => buildArtifactConsistencyReport({ safeSummaryPresent: false }).artifactConsistencyStatus.reasonCodes.includes('safe_summary_missing')),
  test('artifact_consistency_blocks_stale_head', () => buildArtifactConsistencyReport({ remoteHeadMatches: false }).artifactConsistencyStatus.reasonCodes.includes('artifact_head_mismatch')),
  test('artifact_index_present_but_artifact_missing_fails', () => buildArtifactConsistencyReport({ artifacts: [{ artifactName: 'codex-decision-capsule.safe.json', artifactGeneratedStatus: 'fail', artifactIndexedStatus: 'pass', artifactUploadedStatus: 'pass', artifactDownloadObservedStatus: 'pass', artifactHeadMatchStatus: 'pass' }] }).artifactConsistencyStatus.primaryClass === 'artifact_index_consistency_failure'),
  test('artifact_exists_but_stale_head_fails_as_stale_head', () => buildArtifactConsistencyReport({ artifacts: [{ artifactName: 'codex-decision-capsule.safe.json', artifactGeneratedStatus: 'pass', artifactIndexedStatus: 'pass', artifactUploadedStatus: 'pass', artifactDownloadObservedStatus: 'pass', artifactHeadMatchStatus: 'fail' }] }).artifactConsistencyStatus.primaryClass === 'artifact_stale_head'),
  test('artifact_uploaded_status_is_checked', () => buildArtifactConsistencyReport({ artifacts: [{ artifactName: 'codex-decision-capsule.safe.json', artifactGeneratedStatus: 'pass', artifactIndexedStatus: 'pass', artifactUploadedStatus: 'fail', artifactDownloadObservedStatus: 'pass', artifactHeadMatchStatus: 'pass' }] }).artifactConsistencyStatus.reasonCodes.includes('artifact_index_consistency_failure')),
  test('artifact_download_observed_status_is_checked', () => buildArtifactConsistencyReport({ artifacts: [{ artifactName: 'codex-decision-capsule.safe.json', artifactGeneratedStatus: 'pass', artifactIndexedStatus: 'pass', artifactUploadedStatus: 'pass', artifactDownloadObservedStatus: 'fail', artifactHeadMatchStatus: 'pass' }] }).artifactConsistencyStatus.reasonCodes.includes('artifact_download_not_observed')),
  test('all_load_bearing_artifacts_are_checked', () => buildArtifactConsistencyReport().checkedArtifacts === 4),
  test('delta_only_finalizer_allows_changed_fields_only', () => validateDeltaOnlyFinalizer({ emittedFields: ['state', 'safeNextAction'], changedFields: ['state', 'safeNextAction'] }).status === 'pass'),
  test('delta_only_finalizer_blocks_unchanged_history', () => validateDeltaOnlyFinalizer({ emittedFields: ['oldHistory'], changedFields: ['state'] }).status === 'fail'),
  test('safe_failure_reader_prefers_decision_capsule', () => pickSafeFailureEvidence({ decisionCapsule: { decision: 'blocked' }, artifactConsistency: { primaryClass: 'other' } }).selected === 'codex-decision-capsule.safe.json'),
  test('safe_failure_reader_blocks_raw_log_fallback', () => validateSafeFailureReader({ rawLogFallbackAttempted: true }).status === 'fail'),
  test('safe_detail_unavailable_subclass_requires_real_safe_detail', () => classifySafeDetailUnavailable({ safeSummaryPresent: false }).status === 'fail'),
  test('safe_detail_unavailable_not_used_when_fallback_allowed', () => classifySafeDetailUnavailable({ safeSummaryPresent: false, fallbackSafeDetailReason: 'remote_artifact_expired' }).status === 'pass'),
  test('runtime_readiness_claim_negative_fixture', () => buildV117Report({ safetyClaims: { runtimeReadinessClaimed: true } }).safeFailureReaderStatus.status === 'fail'),
  test('production_readiness_claim_negative_fixture', () => buildV117Report({ safetyClaims: { productionReadinessClaimed: true } }).safeFailureReaderStatus.status === 'fail'),
  test('legal_compliance_claim_negative_fixture', () => buildV117Report({ safetyClaims: { legalComplianceClaimed: true } }).safeFailureReaderStatus.status === 'fail'),
  test('youtube_policy_claim_negative_fixture', () => buildV117Report({ safetyClaims: { youtubePolicyComplianceClaimed: true } }).safeFailureReaderStatus.status === 'fail'),
  test('wallet_rpc_deploy_negative_fixture', () => buildV117Report({ safetyClaims: { walletRpcDeployAccess: true } }).safeFailureReaderStatus.status === 'fail'),
  test('raw_log_access_negative_fixture', () => buildV117Report({ safetyClaims: { rawLogsRead: true } }).safeFailureReaderStatus.status === 'fail'),
  test('same_head_required_checks_failure_negative_fixture', () => buildV117Report({ sameHeadRequiredChecks: { sameHead: false, allPass: true } }).decisionCapsuleAuthorityStatus.status === 'fail'),
  test('pr_body_attempting_remote_evidence_negative_fixture', () => buildV117Report({ prBodyMachineEvidence: true }).decisionCapsuleAuthorityStatus.status === 'fail'),
  test('legacy_shadow_cannot_hide_true_blocker_fixture', () => buildV117Report({ legacyShadowAttemptsHide: true }).decisionCapsuleAuthorityStatus.status === 'fail'),
  test('scope_grant_matrix_fixture_only', () => validateScopeGrantFixture({ requestedScope: 'source_harness_body', grantedScopes: ['source_harness_body'] }).status === 'pass'),
  test('scope_grant_matrix_blocks_target_rollout_scope', () => validateScopeGrantFixture({ requestedScope: 'source_harness_body', grantedScopes: ['target_rollout'] }).status === 'fail'),
  test('legacy_compatibility_compression_fixture_only', () => validateLegacyCompressionFixture({ emittedLegacyStatuses: 0, maxLegacyStatuses: 0 }).status === 'pass'),
  test('boundary_registry_compression_fixture_only', () => validateBoundaryProfileFixture({ policyIds: ['raw_logs_no', 'eight_session_no'], repeatedForbiddenTextCount: 0 }).status === 'pass'),
  test('boundary_registry_blocks_repeated_forbidden_text', () => validateBoundaryProfileFixture({ repeatedForbiddenTextCount: 1 }).status === 'fail'),
  test('operator_visible_status_limit_under_12', () => OPERATOR_STATUS_KEYS.length <= 12),
  test('p0_status_surface_exactly_six', () => OPERATOR_STATUS_KEYS.length === 6),
  test('token_budget_status_preserved_as_metrics', () => buildV117Report({ tokenBudget: { operatorVisibleStatuses: OPERATOR_STATUS_KEYS.length, safeArtifactReads: 2 } }).tokenBudgetStatus?.metrics?.safeArtifactReads === 2),
  test('validation_fast_path_source_fixture', () => buildV117Report({ fastPathEligible: true }).validationFastPathStatus?.status === 'pass'),
  test('verified_memory_rules_spec_fixture', () => buildV117Report({ memoryConsulted: false }).verifiedMemoryRulesStatus?.status === 'pass'),
  test('repair_experiment_ledger_spec_fixture', () => buildV117Report({ repairExperimentCount: 0 }).repairExperimentLedgerStatus?.status === 'pass'),
];

const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v117SelfTestStatus: {
    status: failures.length ? 'fail' : 'pass',
    caseCount: cases.length,
    failureCount: failures.length,
    safeSummaryOnly: true,
  },
  cases,
  status: failures.length ? 'fail' : 'pass',
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_V117_SELF_TEST_REPORT');
if (!process.env.CODEX_V117_SELF_TEST_REPORT && process.env.CODEX_QUALITY_REPORT !== 'json') {
  console.log(`v117SelfTestStatus: ${report.v117SelfTestStatus.status}`);
}
exitFor(report);
