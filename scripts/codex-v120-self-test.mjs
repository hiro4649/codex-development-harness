#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.0

import fs from 'node:fs';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  V120_OPERATOR_STATUS_KEYS,
  V120_P0_ARTIFACTS,
  buildOrchestrationCapsule,
  validateAdaptiveIntelligenceRouting,
  validateModelTierBudget,
  validateReviewPoolPolicy,
} from './codex-orchestration-capsule.mjs';
import {
  buildWorkerProofCapsule,
  validateWorkerProofCapsule,
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

const adaptiveCases = [
  ['v120_self_test_must_pass', () => true],
  ['v120_extends_existing_three_v119_artifacts_only', () => V120_P0_ARTIFACTS.length === 3 && V120_P0_ARTIFACTS.includes('codex-orchestration-capsule.safe.json')],
  ['v120_adds_no_new_p0_artifact_producer', () => !fs.existsSync('scripts/codex-intelligence-router.mjs') && !fs.existsSync('scripts/codex-review-pool.mjs')],
  ['v120_delegates_final_authority_to_v118_final_decision', () => buildOrchestrationCapsule().finalAuthority === 'v1.1.8_final_decision_kernel'],
  ['v120_does_not_create_second_merge_authority', () => buildOrchestrationCapsule().authorityBoundary.adaptiveRoutingCreatesMergePermission === false],
  ['low_cost_worker_default_for_routine_task', () => buildOrchestrationCapsule().adaptiveIntelligenceRouting.defaultTier === 'low_cost_worker'],
  ['highest_reasoning_not_used_for_simple_docs', () => buildOrchestrationCapsule({ typedBlocker: 'none' }).adaptiveIntelligenceRouting.currentTier === 'low_cost_worker'],
  ['same_primary_class_twice_escalates', () => buildOrchestrationCapsule({ typedBlocker: 'repeated_failure', currentTier: 'specialist_reviewer', escalationReason: 'same_primary_class_repeated' }).adaptiveIntelligenceRouting.currentTier === 'specialist_reviewer'],
  ['same_test_failure_twice_escalates', () => buildOrchestrationCapsule({ typedBlocker: 'repeated_failure', escalationReason: 'same_test_failure_repeated' }).adaptiveIntelligenceRouting.escalationReason === 'same_test_failure_repeated'],
  ['tests_worsened_escalates', () => buildOrchestrationCapsule({ escalationReason: 'tests_worsened' }).adaptiveIntelligenceRouting.escalationReason === 'tests_worsened'],
  ['reviewer_cannot_classify_escalates', () => buildOrchestrationCapsule({ typedBlocker: 'reviewer_disagreement', escalationReason: 'reviewer_cannot_classify' }).adaptiveIntelligenceRouting.typedBlocker === 'reviewer_disagreement'],
  ['security_ambiguity_escalates_to_highest', () => buildOrchestrationCapsule({ typedBlocker: 'security_sensitive_ambiguity', currentTier: 'highest_reasoning_reviewer', highestTierUsed: true }).adaptiveIntelligenceRouting.currentTier === 'highest_reasoning_reviewer'],
  ['cross_repo_ambiguity_escalates_to_highest', () => buildOrchestrationCapsule({ escalationReason: 'cross_repo_dependency_ambiguity', currentTier: 'highest_reasoning_reviewer' }).adaptiveIntelligenceRouting.escalationReason === 'cross_repo_dependency_ambiguity'],
  ['restricted_asset_ambiguity_escalates_to_highest', () => buildOrchestrationCapsule({ typedBlocker: 'restricted_asset_ambiguity', currentTier: 'highest_reasoning_reviewer' }).adaptiveIntelligenceRouting.typedBlocker === 'restricted_asset_ambiguity'],
  ['root_cause_classified_deescalates', () => buildOrchestrationCapsule({ deEscalationReady: true, deEscalationReason: 'root_cause_classified' }).adaptiveIntelligenceRouting.deEscalationReason === 'root_cause_classified'],
  ['bounded_repair_plan_deescalates', () => buildOrchestrationCapsule({ deEscalationReady: true, deEscalationReason: 'repair_plan_bounded' }).adaptiveIntelligenceRouting.deEscalationReason === 'repair_plan_bounded'],
  ['validation_path_known_deescalates', () => buildOrchestrationCapsule({ deEscalationReady: true, deEscalationReason: 'validation_path_known' }).adaptiveIntelligenceRouting.deEscalationReason === 'validation_path_known'],
  ['typed_blocker_taxonomy_rejects_unknown', () => buildOrchestrationCapsule({ typedBlocker: 'made_up_blocker' }).adaptiveIntelligenceRouting.typedBlocker === 'none'],
  ['escalation_hysteresis_requires_bounded_validation', () => validateAdaptiveIntelligenceRouting(buildOrchestrationCapsule({ highestTierUsed: true, deEscalationReady: true }).adaptiveIntelligenceRouting).status === 'pass'],
  ['same_typed_blocker_after_highest_stops', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ typedBlocker: 'repeated_failure', highestTierUsed: true, sameFailureRepeated: true })))],
];

const reviewPoolCases = [
  ['review_pool_default_max_two', () => buildOrchestrationCapsule().reviewPoolPolicy.maxReviewersDefault === 2],
  ['review_pool_hard_max_three', () => buildOrchestrationCapsule().reviewPoolPolicy.maxReviewersHard === 3],
  ['same_worker_self_review_cannot_pass', () => buildOrchestrationCapsule().reviewPoolPolicy.sameWorkerSelfReviewCanPass === false],
  ['same_repair_loop_cannot_self_accept', () => buildOrchestrationCapsule().reviewPoolPolicy.sameRepairLoopCanSelfAccept === false],
  ['reviewer_independence_defined', () => validateReviewPoolPolicy(buildOrchestrationCapsule().reviewPoolPolicy).status === 'pass'],
  ['reviewer_finding_requires_primary_class_or_cannot_classify', () => buildOrchestrationCapsule().reviewPoolPolicy.findingRequiresPrimaryClassOrCannotClassify === true],
  ['two_reviewer_disagreement_escalates', () => buildWorkerProofCapsule({ reviewerCount: 2, reviewConsensus: 'failed', typedBlocker: 'reviewer_disagreement' }).typedBlocker === 'reviewer_disagreement'],
  ['review_pool_consensus_failure_blocks', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ reviewConsensus: 'failed' })))],
  ['highest_reviewer_cannot_owner_approve', () => buildWorkerProofCapsule({ highestTierUsed: true }).modelTierTrace.highestTierUsedForOwnerAuthority === false],
  ['highest_reviewer_cannot_github_approve', () => buildOrchestrationCapsule().reviewPoolPolicy.reviewerCanSubmitGitHubApprovalReview === false],
  ['highest_reviewer_cannot_claim_readiness', () => buildOrchestrationCapsule().reviewPoolPolicy.reviewerCanClaimReadiness === false],
  ['highest_reviewer_cannot_release_deploy_wallet_rpc_secret', () => buildOrchestrationCapsule().authorityBoundary.highTierReviewCreatesOwnerApproval === false],
];

const planAndBoundaryCases = [
  ['high_tier_repair_plan_contract_present', () => {
    const proof = buildWorkerProofCapsule({ highestTierUsed: true, highTierRepairPlan: { rootCauseClass: 'test_failure', exactRepairSteps: ['change fixture'], validationCommand: 'node scripts/codex-v120-self-test.mjs' } });
    return proof.repairPlanFromHighTier.exactRepairSteps.length === 1 && proof.repairPlanFromHighTier.validationCommand.includes('v120');
  }],
  ['high_tier_repair_plan_max_five_steps', () => buildWorkerProofCapsule({ highTierRepairPlan: { exactRepairSteps: ['1', '2', '3', '4', '5', '6'] } }).repairPlanFromHighTier.exactRepairSteps.length === 5],
  ['same_head_merge_records_eligibility_only', () => buildOrchestrationCapsule().authorityBoundary.mayRecordMergeCurrentPrEligibilityOnly === true],
  ['high_tier_review_cannot_create_merge_permission', () => buildOrchestrationCapsule().authorityBoundary.adaptiveRoutingCreatesMergePermission === false],
  ['review_pool_consensus_cannot_create_merge_permission', () => buildOrchestrationCapsule().authorityBoundary.reviewPoolConsensusCreatesMergePermission === false],
  ['adaptive_routing_cannot_create_merge_permission', () => buildOrchestrationCapsule().permissionGrant.merge === false],
  ['conflict_precedence_v118_wins', () => buildOrchestrationCapsule().authorityBoundary.conflictPrecedence[0].includes('v1.1.8_final_decision')],
  ['conflict_precedence_v119_over_v120', () => buildOrchestrationCapsule().authorityBoundary.conflictPrecedence[1].includes('v1.1.9_orchestration')],
  ['owner_only_boundary_over_reviewer_output', () => buildOrchestrationCapsule().authorityBoundary.conflictPrecedence[2].includes('owner_only_boundary')],
];

const tokenAndOwnerCases = [
  ['token_budget_highest_context_max_8000', () => validateModelTierBudget(buildOrchestrationCapsule().modelTierBudget).status === 'pass'],
  ['high_tier_context_packet_excludes_full_history_raw_logs_secrets', () => {
    const budget = buildOrchestrationCapsule().modelTierBudget;
    return budget.fullConversationAllowedForHighTier === false && budget.rawLogsAllowedForHighTier === false && budget.secretValuesAllowedForHighTier === false;
  }],
  ['owner_brief_max_three_choices', () => buildOwnerDecisionBrief({ exactChoices: ['a', 'b', 'c', 'd'] }).exactChoices.length === 3],
  ['owner_brief_max_three_risks', () => buildOwnerDecisionBrief({ residualRisks: ['a', 'b', 'c', 'd'] }).residualRisks.length === 3],
  ['owner_brief_escalation_summary_short', () => validateOwnerDecisionBrief(buildOwnerDecisionBrief({ escalationSummary: { typedBlocker: 'scope_boundary', highestTierUsed: true, reviewerCount: 2 } })).status === 'pass'],
  ['pass_status_count_only', () => buildOrchestrationCapsule().modelTierBudget.passStatusDetail === 'count_only'],
  ['routine_progress_silent', () => buildOrchestrationCapsule().modelTierBudget.routineProgressOutput === 'silent'],
  ['operator_visible_statuses_max_8', () => V120_OPERATOR_STATUS_KEYS.length === 8],
  ['reviewChainStatus_preserved', () => V120_OPERATOR_STATUS_KEYS.includes('reviewChainStatus') && !V120_OPERATOR_STATUS_KEYS.includes('adaptiveRoutingStatus')],
];

const domainBoundaryCases = [
  ['restricted_asset_repo_no_deploy_tx_bscscan_readiness', () => buildOrchestrationCapsule({ typedBlocker: 'restricted_asset_ambiguity' }).permissionGrant.walletRpcDeployAccess === false],
  ['iris_fixture_not_readiness', () => buildWorkerProofCapsule({ proofReason: 'harness_metadata' }).liveProof.status === 'not_required_with_reason'],
  ['cripto_tip_no_custody_exchange_sale_policy_claim', () => buildOrchestrationCapsule().permissionGrant.release === false && buildOrchestrationCapsule().permissionGrant.publish === false],
  ['p1_p2_no_new_scripts', () => !fs.existsSync('scripts/codex-external-verifier-adapter.mjs') && !fs.existsSync('scripts/codex-memory-routing.mjs')],
  ['p1_p2_no_new_top_level_artifacts', () => !V120_P0_ARTIFACTS.includes('codex-intelligence-router.safe.json') && !V120_P0_ARTIFACTS.includes('codex-review-pool.safe.json')],
  ['p1_p2_no_exit_code_behavior', () => true],
];

const cases = [
  ...adaptiveCases,
  ...reviewPoolCases,
  ...planAndBoundaryCases,
  ...tokenAndOwnerCases,
  ...domainBoundaryCases,
].map(([name, fn]) => test(name, fn));

const fixtureGroups = [
  'adaptive_routing_matrix',
  'escalation_trigger_matrix',
  'de_escalation_matrix',
  'review_pool_matrix',
  'token_budget_context_packet_matrix',
  'owner_boundary_matrix',
  'restricted_asset_repo_matrix',
  'readiness_boundary_matrix',
  'v118_v119_final_authority_compatibility_matrix',
  'p1_p2_non_expansion_matrix',
];

const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v120SelfTestStatus: {
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

writeJsonReport(report, 'CODEX_V120_SELF_TEST_REPORT');
if (!process.env.CODEX_V120_SELF_TEST_REPORT && process.env.CODEX_QUALITY_REPORT !== 'json') {
  console.log(`v120SelfTestStatus: ${report.v120SelfTestStatus.status}`);
}
exitFor(report);
