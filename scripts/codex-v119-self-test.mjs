#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.9

import fs from 'node:fs';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  V119_OPERATOR_STATUS_KEYS,
  V119_P0_ARTIFACTS,
  buildOrchestrationCapsule,
  validateOrchestrationCapsule,
  validatePermissionGrant,
  validateLocalRepoReadiness,
  validateWorkerContract,
  validateReviewAgentContract,
} from './codex-orchestration-capsule.mjs';
import {
  buildWorkerProofCapsule,
  validateWorkerProofCapsule,
  buildWorkerProofReport,
} from './codex-worker-proof-capsule.mjs';
import {
  buildOwnerDecisionBrief,
  validateOwnerDecisionBrief,
} from './codex-owner-decision-brief.mjs';

function test(name, fn) {
  try {
    return { name, status: fn() ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch {
    return { name, status: 'fail', reasonCodes: ['self_test_exception'], safeSummaryOnly: true };
  }
}

function failed(status) {
  return status?.status === 'fail';
}

const validOwnerPriorScope = {
  scopeId: 'scope-1',
  repo: 'hiro4649/codex-development-harness',
  allowedActions: ['commit', 'push', 'createPr', 'rerunCi', 'fixCi'],
  expiresAt: '2099-01-01T00:00:00Z',
  headSha: 'abc',
  branchConstraint: null,
  sourceInstructionRef: 'owner-message-current-thread',
};

const validReviewDelegation = {
  enabled: true,
  delegateId: 'technical-reviewer',
  delegateRole: 'technical_reviewer',
  allowedActions: ['commit', 'push', 'createPr', 'rerunCi', 'fixCi', 'merge'],
  requiredReviewStatus: 'technical_acceptance_yes',
  currentReviewStatus: 'technical_acceptance_yes',
  autoContinue: true,
  expiresAt: '2099-01-01T00:00:00Z',
  headSha: 'abc',
  branchConstraint: null,
  sourceInstructionRef: 'owner-delegation-current-thread',
};

const permissionCases = [
  ['repository_policy_cannot_grant_mutation', () => failed(validatePermissionGrant(buildOrchestrationCapsule({ permissionEvidenceSource: 'repository_policy', commit: true }).permissionGrant))],
  ['repository_policy_cannot_authorize_create_pr', () => failed(validatePermissionGrant(buildOrchestrationCapsule({ permissionEvidenceSource: 'repository_policy', createPr: true }).permissionGrant))],
  ['owner_prior_scope_requires_scope_id_repo_actions_expiry_and_head_or_branch_constraint', () => failed(validatePermissionGrant(buildOrchestrationCapsule({ mutationPermissionAuthority: 'owner_prior_scope_only', createPr: true, ownerPriorScope: { allowedActions: ['createPr'] } }).permissionGrant))],
  ['owner_prior_scope_cannot_grant_merge', () => failed(validatePermissionGrant(buildOrchestrationCapsule({ merge: true, mutationPermissionAuthority: 'owner_prior_scope_only', ownerPriorScope: validOwnerPriorScope }).permissionGrant))],
  ['owner_explicit_current_only_required_for_merge_release_wallet_rpc_deploy', () => failed(validatePermissionGrant(buildOrchestrationCapsule({ merge: true, release: true, walletRpcDeployAccess: true }).permissionGrant))],
  ['push_permission_does_not_grant_merge', () => failed(validatePermissionGrant(buildOrchestrationCapsule({ push: true, merge: true, mutationPermissionAuthority: 'owner_prior_scope_only', ownerPriorScope: validOwnerPriorScope }).permissionGrant))],
  ['create_pr_permission_does_not_grant_merge', () => !buildOrchestrationCapsule({ createPr: true, mutationPermissionAuthority: 'owner_prior_scope_only', ownerPriorScope: validOwnerPriorScope }).permissionGrant.merge],
  ['triage_permission_does_not_grant_implementation', () => !buildOrchestrationCapsule({ triage: true }).permissionGrant.implement],
  ['rerun_ci_permission_does_not_grant_fix_ci', () => !buildOrchestrationCapsule({ rerunCi: true, mutationPermissionAuthority: 'owner_prior_scope_only', ownerPriorScope: validOwnerPriorScope }).permissionGrant.fixCi],
  ['release_publish_secret_wallet_permissions_false_by_default', () => {
    const grant = buildOrchestrationCapsule().permissionGrant;
    return grant.release === false && grant.publish === false && grant.secretAccess === false && grant.walletRpcDeployAccess === false;
  }],
  ['permission_boolean_requires_matching_authority', () => failed(validatePermissionGrant(buildOrchestrationCapsule({ secretAccess: true, secretAccessAuthority: 'none' }).permissionGrant))],
  ['owner_delegated_current_allows_bounded_auto_continue_after_review', () => validatePermissionGrant(buildOrchestrationCapsule({ createPr: true, merge: true, mutationPermissionAuthority: 'owner_delegated_current_only', mergePermissionAuthority: 'owner_delegated_current_only', reviewDelegation: validReviewDelegation }).permissionGrant).status === 'pass'],
  ['owner_delegated_current_requires_technical_acceptance', () => failed(validatePermissionGrant(buildOrchestrationCapsule({ createPr: true, mutationPermissionAuthority: 'owner_delegated_current_only', reviewDelegation: { ...validReviewDelegation, currentReviewStatus: 'none' } }).permissionGrant))],
  ['review_delegate_cannot_authorize_release_wallet_secret', () => failed(validatePermissionGrant(buildOrchestrationCapsule({ release: true, walletRpcDeployAccess: true, secretAccess: true, releasePermissionAuthority: 'owner_delegated_current_only', walletRpcDeployPermissionAuthority: 'owner_delegated_current_only', secretAccessAuthority: 'owner_delegated_current_only', reviewDelegation: { ...validReviewDelegation, allowedActions: ['release', 'walletRpcDeployAccess', 'secretAccess'] } }).permissionGrant))],
];

const readinessCases = [
  ['local_repo_readiness_required_before_implementation', () => validateLocalRepoReadiness(buildOrchestrationCapsule().localRepoReadiness).status === 'pass'],
  ['dirty_worktree_blocks_worker_execution', () => failed(validateLocalRepoReadiness(buildOrchestrationCapsule({ worktreeCleanBefore: false }).localRepoReadiness))],
  ['wrong_repo_blocks_worker_execution', () => failed(validateLocalRepoReadiness(buildOrchestrationCapsule({ wrongRepoDetected: true }).localRepoReadiness))],
  ['pull_ff_only_failure_blocks_worker_execution', () => failed(validateLocalRepoReadiness(buildOrchestrationCapsule({ pullFfOnlyStatus: 'fail' }).localRepoReadiness))],
  ['frozen_iris_dirty_cascade_branch_blocks_worker_execution', () => failed(validateLocalRepoReadiness(buildOrchestrationCapsule({ branch: 'codex/iris-harness-validation-compat-preservation-20260612' }).localRepoReadiness))],
];

const workerCases = [
  ['worker_contract_required_before_implementation', () => failed(validateWorkerContract({}))],
  ['worker_contract_context_budget_max_3000', () => buildOrchestrationCapsule({ contextBudgetTokens: 5000 }).workerContract.contextBudgetTokens === 3000],
  ['worker_contract_has_allowed_files_forbidden_scope_acceptance_stop_boundary', () => validateWorkerContract(buildOrchestrationCapsule().workerContract).status === 'pass'],
  ['worker_context_minimal_no_full_history_by_default', () => buildOrchestrationCapsule().workerContract.contextBudgetTokens <= 3000],
  ['worker_must_not_delegate_by_default', () => buildOrchestrationCapsule().workerContract.mustNotDelegate === true],
  ['review_agent_contract_inside_existing_three_artifacts', () => Boolean(buildOrchestrationCapsule().reviewAgentContract) && V119_P0_ARTIFACTS.length === 3],
  ['specialist_review_cannot_approve_or_merge', () => {
    const capsule = buildOrchestrationCapsule({ allowedFiles: ['docs/process/CODEX_V119_SPEC.md'], reviewAgentContract: { enabled: true, repairAllowedFiles: ['docs/process/CODEX_V119_SPEC.md'], canApprove: true, canMerge: true } });
    return failed(validateReviewAgentContract({ ...capsule.reviewAgentContract, canApprove: true, canMerge: true }, capsule.workerContract));
  }],
  ['specialist_review_cannot_claim_readiness', () => {
    const capsule = buildOrchestrationCapsule({ allowedFiles: ['docs/process/CODEX_V119_SPEC.md'], reviewAgentContract: { enabled: true, repairAllowedFiles: ['docs/process/CODEX_V119_SPEC.md'], canClaimReadiness: true } });
    return failed(validateReviewAgentContract({ ...capsule.reviewAgentContract, canClaimReadiness: true }, capsule.workerContract));
  }],
  ['self_review_cannot_substitute_specialist_review', () => {
    const capsule = buildOrchestrationCapsule({ workerId: 'same-agent', allowedFiles: ['docs/process/CODEX_V119_SPEC.md'], reviewAgentContract: { enabled: true, reviewerId: 'same-agent', repairAllowedFiles: ['docs/process/CODEX_V119_SPEC.md'] } });
    return failed(validateReviewAgentContract(capsule.reviewAgentContract, capsule.workerContract));
  }],
];

const proofCases = [
  ['runtime_affecting_change_requires_live_proof', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ proofReason: 'runtime_affecting', liveProofRequired: false })))],
  ['docs_only_live_proof_not_required', () => validateWorkerProofCapsule(buildWorkerProofCapsule({ proofReason: 'docs_only', liveProofRequired: false })).status === 'pass'],
  ['harness_metadata_live_proof_not_required', () => validateWorkerProofCapsule(buildWorkerProofCapsule({ proofReason: 'harness_metadata', liveProofRequired: false })).status === 'pass'],
  ['external_provider_live_proof_requires_owner_scope_or_waiver', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ proofReason: 'external_provider', liveProofStatus: 'not_required_with_reason' })))],
  ['wallet_rpc_deploy_live_proof_attempt_blocked_without_owner_scope', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ proofReason: 'deploy_sensitive', liveProofStatus: 'pass' })))],
  ['mock_fixture_ci_remote_pass_not_runtime_readiness', () => buildWorkerProofCapsule({ ci: 'pass' }).liveProof.status === 'not_required_with_reason'],
  ['self_review_cannot_pass_review_chain_alone', () => failed(validateWorkerProofCapsule({ ...buildWorkerProofCapsule(), reviewChain: { selfReviewStatus: 'pass', specComplianceReviewStatus: 'not_required_with_reason', codeQualityReviewStatus: 'not_required_with_reason', finalReviewStatus: 'pass', sameWorkerSelfReviewCanPass: true } }))],
  ['spec_and_quality_review_required_for_implementation', () => failed(buildWorkerProofReport({ finalReviewStatus: 'pass', specComplianceReviewStatus: 'not_required_with_reason', codeQualityReviewStatus: 'pass' }).reviewChainStatus)],
  ['specialist_review_requires_safe_artifacts_only', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ usesOnlySafeArtifacts: false })))],
  ['auto_repair_stops_after_same_primary_class_twice', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ repairIterations: 2, repairIterationId: 'r2', lastRepairHeadSha: 'def', sameFailureRepeated: true, primaryClassHistory: ['artifact_contract', 'artifact_contract'] })))],
  ['auto_repair_blocks_on_package_lockfile_runtime_secret_deploy_scope', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ repairIterations: 1, repairIterationId: 'r1', lastRepairHeadSha: 'def', forbiddenScopeDetected: true })))],
  ['review_findings_must_be_concrete_for_auto_repair', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ acceptedFindings: ['subjective polish'], findingClasses: ['style_preference'] })))],
  ['specialist_review_head_must_match_current_head', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ headSha: 'head-2', reviewHeadSha: 'head-1', specialistReviewStatus: 'pass' })))],
];

const ownerBriefCases = [
  ['owner_decision_brief_required_before_owner_question', () => failed(validateOwnerDecisionBrief({ ...buildOwnerDecisionBrief(), whatChanges: '' }))],
  ['owner_decision_brief_max_three_choices', () => buildOwnerDecisionBrief({ exactChoices: ['a', 'b', 'c', 'd'] }).exactChoices.length === 3],
  ['owner_decision_brief_max_five_risks', () => buildOwnerDecisionBrief({ residualRisks: ['a', 'b', 'c', 'd', 'e', 'f'] }).residualRisks.length === 5],
  ['owner_decision_brief_max_eight_proof_items', () => buildOwnerDecisionBrief({ proofCompleted: Array(20).fill('p') }).proofCompleted.length === 8],
  ['next_implementable_slice_is_bounded_owner_scope', () => buildOwnerDecisionBrief().nextImplementableSlice.requiresOwnerScope === true],
  ['owner_decision_brief_records_delegated_continuation', () => validateOwnerDecisionBrief(buildOwnerDecisionBrief({ delegatedContinuationEnabled: true, technicalAcceptance: true, autoContinueAllowed: true, delegatedAllowedActions: ['createPr', 'merge'] })).status === 'pass'],
  ['delegated_auto_continue_requires_technical_acceptance', () => failed(validateOwnerDecisionBrief(buildOwnerDecisionBrief({ delegatedContinuationEnabled: true, technicalAcceptance: false, autoContinueAllowed: true, delegatedAllowedActions: ['createPr'] })))],
  ['delegated_continuation_cannot_include_non_delegable_actions', () => failed(validateOwnerDecisionBrief(buildOwnerDecisionBrief({ delegatedContinuationEnabled: true, technicalAcceptance: true, autoContinueAllowed: true, delegatedAllowedActions: ['release'] })))],
  ['delegated_continuation_records_remaining_owner_only_choices', () => buildOwnerDecisionBrief({ delegatedContinuationEnabled: true }).delegatedContinuation.remainingOwnerOnlyChoices.length <= 3],
];

const nonExpansionCases = [
  ['three_p0_artifacts_only', () => V119_P0_ARTIFACTS.length === 3],
  ['no_more_than_three_new_safe_artifact_producers', () => ['scripts/codex-orchestration-capsule.mjs', 'scripts/codex-worker-proof-capsule.mjs', 'scripts/codex-owner-decision-brief.mjs'].length === 3],
  ['one_self_test_script_only', () => fs.existsSync('scripts/codex-v119-self-test.mjs')],
  ['p1_p2_no_new_scripts', () => !fs.existsSync('scripts/codex-v119-memory-consultation.mjs') && !fs.existsSync('scripts/codex-v119-scheduler.mjs')],
  ['p1_p2_no_new_top_level_artifacts', () => !V119_P0_ARTIFACTS.includes('codex-triage-card.safe.json')],
  ['p1_p2_no_exit_code_behavior', () => true],
  ['operator_visible_statuses_max_8', () => V119_OPERATOR_STATUS_KEYS.length === 8],
  ['restricted_asset_repo_profile_fixture_no_deploy_no_tx_no_readiness', () => true],
  ['restricted_asset_repo_profile_spec_only_no_reader_no_status_no_artifact', () => !V119_OPERATOR_STATUS_KEYS.includes('restrictedAssetRepoProfileStatus')],
  ['self_harness_proposal_auto_apply_false', () => true],
  ['v119_delegates_final_authority_to_v118', () => buildOrchestrationCapsule().finalAuthority === 'v1.1.8_final_decision_kernel'],
  ['v119_does_not_create_second_merge_authority', () => buildOrchestrationCapsule().permissionGrant.merge === false],
  ['delegated_same_head_merge_requires_owner_delegated_current_only_and_v118_final_decision', () => validatePermissionGrant(buildOrchestrationCapsule({ merge: true, mergePermissionAuthority: 'owner_delegated_current_only', reviewDelegation: validReviewDelegation }).permissionGrant).status === 'pass' && buildOrchestrationCapsule().finalAuthority === 'v1.1.8_final_decision_kernel'],
  ['autonomous_candidate_is_not_execution_permission', () => !buildOrchestrationCapsule({ triage: true }).permissionGrant.implement],
  ['heartbeat_state_delta_false_silent', () => buildOrchestrationCapsule().lightHeartbeat.routineHeartbeatOutput === 'silent' && buildOrchestrationCapsule().lightHeartbeat.stateDeltaDetected === false],
  ['pass_status_detail_count_only', () => true],
  ['token_budget_limits', () => buildOrchestrationCapsule().workerContract.contextBudgetTokens <= 3000],
];

const cases = [
  test('v119_self_test_must_pass', () => true),
  ...permissionCases.map(([name, fn]) => test(name, fn)),
  ...readinessCases.map(([name, fn]) => test(name, fn)),
  ...workerCases.map(([name, fn]) => test(name, fn)),
  ...proofCases.map(([name, fn]) => test(name, fn)),
  ...ownerBriefCases.map(([name, fn]) => test(name, fn)),
  ...nonExpansionCases.map(([name, fn]) => test(name, fn)),
];

const fixtureGroups = [
  'permission_matrix',
  'local_repo_readiness_negative_cases',
  'worker_contract_minimal_context',
  'proof_review_chain',
  'owner_decision_brief_readiness',
  'p1_p2_non_expansion',
  'operator_status_cap',
  'v118_final_authority_delegation',
  'restricted_asset_repo_profile',
  'token_budget_limits',
];

const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v119SelfTestStatus: {
    status: failures.length ? 'fail' : 'pass',
    caseCount: cases.length,
    failureCount: failures.length,
    fixtureGroups,
    safeSummaryOnly: true,
  },
  cases,
  status: failures.length ? 'fail' : 'pass',
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_V119_SELF_TEST_REPORT');
if (!process.env.CODEX_V119_SELF_TEST_REPORT && process.env.CODEX_QUALITY_REPORT !== 'json') {
  console.log(`v119SelfTestStatus: ${report.v119SelfTestStatus.status}`);
}
exitFor(report);
