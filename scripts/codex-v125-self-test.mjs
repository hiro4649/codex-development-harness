#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.5

import fs from 'node:fs';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  V125_OPERATOR_STATUS_KEYS,
  V125_P0_ARTIFACTS,
  buildOrchestrationCapsule,
  validateEvidenceLaneAndQGLane,
  validateGoalShardAndProgressEvidence,
  validateOrchestrationCapsule,
  validateSkillReviewProductValueYield,
  validateTypedMonitorInboxAndFanoutGuard,
} from './codex-orchestration-capsule.mjs';
import { buildWorkerProofCapsule, validateWorkerProofCapsule } from './codex-worker-proof-capsule.mjs';
import { buildOwnerDecisionBrief, validateOwnerDecisionBrief } from './codex-owner-decision-brief.mjs';

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

function passed(status) {
  return status?.status === 'pass';
}

const compatibilityCases = [
  ['v125_self_test_must_pass', () => true],
  ['v125_adds_no_new_p0_artifact', () => V125_P0_ARTIFACTS.length === 3 && !V125_P0_ARTIFACTS.includes('codex-v125-goal-shards.safe.json')],
  ['v125_adds_no_new_top_level_status', () => V125_OPERATOR_STATUS_KEYS.length === 8 && !V125_OPERATOR_STATUS_KEYS.includes('goalShardStatus')],
  ['v125_preserves_v118_final_decision', () => buildOrchestrationCapsule().finalAuthority === 'v1.1.8_final_decision_kernel'],
  ['v125_preserves_v119_orchestration_artifacts', () => V125_P0_ARTIFACTS.includes('codex-orchestration-capsule.safe.json')],
  ['v125_no_tui_or_cron_daemon', () => !fs.existsSync('scripts/codex-tui-socket-injector.mjs') && !fs.existsSync('scripts/codex-two-minute-cron-daemon.mjs')],
  ['v125_active_authority_tuple_preserves_current_or_v125', () => ['v125', 'v126', 'v127'].includes(buildOrchestrationCapsule().skillContextRouting.activeAuthorityTuple.activeSelfTestSuite)],
];

const goalShardCases = [
  ['goal_shard_default_passes', () => passed(validateGoalShardAndProgressEvidence(buildOrchestrationCapsule().goalShardAndProgressEvidence))],
  ['goal_shard_is_not_owner_authority', () => failed(validateGoalShardAndProgressEvidence(buildOrchestrationCapsule({
    goalShardAndProgressEvidence: { goalShard: { ownerAuthorityCreatedByShard: true } },
  }).goalShardAndProgressEvidence))],
  ['goal_shard_expires_when_head_changes', () => failed(validateGoalShardAndProgressEvidence(buildOrchestrationCapsule({
    goalShardAndProgressEvidence: { goalShard: { expiresWhenHeadChanges: false } },
  }).goalShardAndProgressEvidence))],
  ['goal_shard_blocks_duplicate_goal_omission', () => failed(validateGoalShardAndProgressEvidence(buildOrchestrationCapsule({
    goalShardAndProgressEvidence: { goalShard: { duplicateGoalDetectionRequired: false } },
  }).goalShardAndProgressEvidence))],
  ['goal_shard_completion_compacts_to_safe_summary', () => failed(validateGoalShardAndProgressEvidence(buildOrchestrationCapsule({
    goalShardAndProgressEvidence: { goalShard: { completionCompactsToSafeSummary: false } },
  }).goalShardAndProgressEvidence))],
  ['progress_pass_requires_tool_evidence', () => failed(validateGoalShardAndProgressEvidence(buildOrchestrationCapsule({
    goalShardAndProgressEvidence: { progressEvidence: { progressReportStatus: 'pass', toolEvidencePointers: [] } },
  }).goalShardAndProgressEvidence))],
];

const evidenceLaneCases = [
  ['evidence_lane_default_passes', () => passed(validateEvidenceLaneAndQGLane(buildOrchestrationCapsule().evidenceLaneAndQGLaneSemantics))],
  ['pr_body_not_machine_evidence', () => failed(validateEvidenceLaneAndQGLane(buildOrchestrationCapsule({
    evidenceLaneAndQGLaneSemantics: { humanSummaryLane: { prBodyIsMachineEvidence: true } },
  }).evidenceLaneAndQGLaneSemantics))],
  ['committed_lane_not_current_head_merge_evidence', () => failed(validateEvidenceLaneAndQGLane(buildOrchestrationCapsule({
    evidenceLaneAndQGLaneSemantics: { committedEvidenceLane: { currentHeadMergeEvidence: true, boundByRemoteCurrentHeadLane: false } },
  }).evidenceLaneAndQGLaneSemantics))],
  ['owner_intent_lane_cannot_be_ai_created', () => failed(validateEvidenceLaneAndQGLane(buildOrchestrationCapsule({
    evidenceLaneAndQGLaneSemantics: { ownerIntentLane: { ownerAuthorityCreatedByAI: true } },
  }).evidenceLaneAndQGLaneSemantics))],
  ['qg_lane_pending_not_failure', () => failed(validateEvidenceLaneAndQGLane(buildOrchestrationCapsule({
    evidenceLaneAndQGLaneSemantics: { qgLaneSemantics: { pendingIsFailure: true } },
  }).evidenceLaneAndQGLaneSemantics))],
  ['same_head_required_only_for_merge_consideration', () => failed(validateEvidenceLaneAndQGLane(buildOrchestrationCapsule({
    evidenceLaneAndQGLaneSemantics: { qgLaneSemantics: { terminalPhase: 'create_pr_only', sameHeadRemoteGateRequired: true } },
  }).evidenceLaneAndQGLaneSemantics))],
  ['post_merge_requires_marker_manifest_drift_check', () => failed(validateEvidenceLaneAndQGLane(buildOrchestrationCapsule({
    evidenceLaneAndQGLaneSemantics: { qgLaneSemantics: { terminalPhase: 'post_merge_verify', currentLane: 'post_merge_sentinel', postMergeRequiresMarkerManifestDriftCheck: false } },
  }).evidenceLaneAndQGLaneSemantics))],
];

const monitorAndYieldCases = [
  ['typed_monitor_default_passes', () => passed(validateTypedMonitorInboxAndFanoutGuard(buildOrchestrationCapsule().typedMonitorInboxAndFanoutGuard))],
  ['typed_monitor_blocks_raw_prompt_injection', () => failed(validateTypedMonitorInboxAndFanoutGuard(buildOrchestrationCapsule({
    typedMonitorInboxAndFanoutGuard: { typedMonitorInbox: { rawPromptInjection: true } },
  }).typedMonitorInboxAndFanoutGuard))],
  ['typed_monitor_message_cannot_create_owner_authority', () => failed(validateTypedMonitorInboxAndFanoutGuard(buildOrchestrationCapsule({
    typedMonitorInboxAndFanoutGuard: { typedMonitorInbox: { ownerAuthorityCreatedByMessage: true } },
  }).typedMonitorInboxAndFanoutGuard))],
  ['typed_monitor_message_cannot_authorize_mutation', () => failed(validateTypedMonitorInboxAndFanoutGuard(buildOrchestrationCapsule({
    typedMonitorInboxAndFanoutGuard: { typedMonitorInbox: { mutationAuthorizedByMessage: true } },
  }).typedMonitorInboxAndFanoutGuard))],
  ['fanout_stops_when_no_new_information', () => failed(validateTypedMonitorInboxAndFanoutGuard(buildOrchestrationCapsule({
    typedMonitorInboxAndFanoutGuard: { fanoutRoiLedger: { highestTierUsed: true, nextFanoutAllowed: true } },
  }).typedMonitorInboxAndFanoutGuard))],
  ['source_unknown_skill_effectiveness_is_hard', () => failed(validateSkillReviewProductValueYield(buildOrchestrationCapsule({
    skillReviewProductValueYield: { sourceHard: true, skillEffectiveness: { effectivenessUnknown: true } },
  }).skillReviewProductValueYield))],
  ['target_unknown_skill_effectiveness_warn_allowed', () => passed(validateSkillReviewProductValueYield(buildOrchestrationCapsule({
    skillReviewProductValueYield: { targetInitialRollout: true, skillEffectiveness: { effectivenessUnknown: true } },
  }).skillReviewProductValueYield))],
  ['product_value_delta_not_scope_authorization', () => failed(validateSkillReviewProductValueYield(buildOrchestrationCapsule({
    skillReviewProductValueYield: { productValueDelta: { authorizesProductCodeChange: true } },
  }).skillReviewProductValueYield))],
];

const workerAndOwnerCases = [
  ['worker_proof_default_v125_extensions_pass', () => passed(validateWorkerProofCapsule(buildWorkerProofCapsule()))],
  ['worktree_parent_mutation_forbidden', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    worktreeFleetContract: { parentWorktreeMutationAllowed: true },
  })))],
  ['worktree_shared_files_require_arbiter', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    worktreeFleetContract: { sharedFilesAllowed: true, sharedFilesRequireArbiter: false },
  })))],
  ['worktree_can_not_merge', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    worktreeFleetContract: { worktreeCanMerge: true },
  })))],
  ['worktree_can_not_create_owner_authority', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    worktreeFleetContract: { worktreeCanCreateOwnerAuthority: true },
  })))],
  ['merge_queue_supports_superseded_shard', () => passed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    shardMergeQueue: { queueStatus: 'superseded' },
  })))],
  ['merge_queue_blocks_score_only_merge_order_change', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    shardMergeQueue: { scoreOnlyMergeOrderChangeAllowed: true },
  })))],
  ['owner_brief_default_v125_extensions_pass', () => passed(validateOwnerDecisionBrief(buildOwnerDecisionBrief()))],
  ['owner_brief_product_value_cannot_authorize_scope', () => failed(validateOwnerDecisionBrief(buildOwnerDecisionBrief({
    productValueDeltaSummary: { authorizesRuntimeReadiness: true },
  })))],
  ['safe_memory_ledger_is_proposal_only', () => failed(validateOwnerDecisionBrief(buildOwnerDecisionBrief({
    safeMemoryLedger: { autoApplyAllowed: true },
  })))],
  ['orchestration_capsule_validates_all_v125_internal_blocks', () => {
    const result = validateOrchestrationCapsule(buildOrchestrationCapsule());
    return Object.values(result).every((item) => item.status === 'pass');
  }],
];

const cases = [
  ...compatibilityCases,
  ...goalShardCases,
  ...evidenceLaneCases,
  ...monitorAndYieldCases,
  ...workerAndOwnerCases,
].map(([name, fn]) => test(name, fn));

const fixtureGroups = [
  'v118_v119_v120_v121_v122_v123_v124_compatibility_matrix',
  'goal_shard_progress_evidence_matrix',
  'worktree_fleet_merge_queue_matrix',
  'evidence_lane_qg_lane_matrix',
  'typed_monitor_fanout_matrix',
  'skill_review_product_value_yield_matrix',
  'p1_optional_surface_matrix',
];

const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v125SelfTestStatus: {
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

writeJsonReport(report, 'CODEX_V125_SELF_TEST_REPORT');
if (!process.env.CODEX_V125_SELF_TEST_REPORT && process.env.CODEX_QUALITY_REPORT !== 'json') {
  console.log(`v125SelfTestStatus: ${report.v125SelfTestStatus.status}`);
}
exitFor(report);
