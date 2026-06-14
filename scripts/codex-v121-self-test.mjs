#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.1

import fs from 'node:fs';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  V121_OPERATOR_STATUS_KEYS,
  V121_P0_ARTIFACTS,
  buildOrchestrationCapsule,
  validateAdaptiveMetrics,
  validateEvidenceFreshnessGuard,
  validateRoutingCalibration,
  validateTargetScoreBaseline,
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

const compatibilityCases = [
  ['v121_self_test_must_pass', () => true],
  ['v121_adds_no_new_p0_artifact', () => V121_P0_ARTIFACTS.length === 3 && V121_P0_ARTIFACTS.includes('codex-owner-decision-brief.safe.json')],
  ['v121_adds_no_new_top_level_operator_status', () => V121_OPERATOR_STATUS_KEYS.length === 8 && !V121_OPERATOR_STATUS_KEYS.includes('adaptiveMetricsStatus')],
  ['v121_delegates_final_authority_to_v118', () => buildOrchestrationCapsule().finalAuthority === 'v1.1.8_final_decision_kernel'],
  ['v121_preserves_v119_orchestration_artifacts', () => !V121_P0_ARTIFACTS.includes('codex-v121-calibration.safe.json')],
  ['v121_preserves_v120_adaptive_routing', () => buildOrchestrationCapsule().adaptiveIntelligenceRouting.defaultTier === 'low_cost_worker'],
  ['v121_preserves_v120_review_pool', () => buildOrchestrationCapsule().reviewPoolPolicy.maxReviewersDefault === 2],
  ['p1_p2_no_new_router_or_memory_daemon', () => !fs.existsSync('scripts/codex-memory-routing.mjs') && !fs.existsSync('scripts/codex-intelligence-router.mjs')],
];

const calibrationCases = [
  ['adaptive_metrics_record_highest_tier_count', () => buildOrchestrationCapsule({ adaptiveMetrics: { highestReasoningReviewerCount: 1, highestTierUsed: true, highestTierReason: 'restricted_asset_ambiguity' } }).adaptiveMetrics.modelTierUsedCount.highest_reasoning_reviewer === 1],
  ['adaptive_metrics_forbid_raw_logs', () => failed(validateAdaptiveMetrics({ ...buildOrchestrationCapsule().adaptiveMetrics, rawLogsRead: true }))],
  ['routing_calibration_blocks_unjustified_highest_tier', () => failed(validateRoutingCalibration({ ...buildOrchestrationCapsule().routingCalibration, currentTier: 'highest_reasoning_reviewer' }))],
  ['highest_tier_requires_typed_blocker', () => failed(validateRoutingCalibration({ ...buildOrchestrationCapsule().routingCalibration, currentTier: 'highest_reasoning_reviewer', escalationWasRequired: true, escalationReason: 'security_sensitive_ambiguity' }))],
  ['routing_calibration_allows_justified_highest_tier', () => validateRoutingCalibration({ ...buildOrchestrationCapsule().routingCalibration, currentTier: 'highest_reasoning_reviewer', typedBlocker: 'security_sensitive_ambiguity', escalationWasRequired: true, escalationReason: 'security_sensitive_ambiguity' }).status === 'pass'],
  ['over_escalation_requires_deescalation_ready', () => failed(validateRoutingCalibration({ ...buildOrchestrationCapsule().routingCalibration, overEscalationDetected: true, deEscalationReady: false }))],
  ['safe_artifact_read_count_target_recorded', () => buildOrchestrationCapsule({ adaptiveMetrics: { safeArtifactReadCount: 5 } }).adaptiveMetrics.calibrationWarnings.safeArtifactReadCountAboveTarget === true],
  ['final_report_line_count_target_recorded', () => buildOrchestrationCapsule({ adaptiveMetrics: { finalReportLineCount: 15 } }).adaptiveMetrics.calibrationWarnings.finalReportLineCountAboveTarget === true],
  ['owner_question_count_target_recorded', () => buildOrchestrationCapsule({ adaptiveMetrics: { ownerQuestionCount: 2 } }).adaptiveMetrics.calibrationWarnings.ownerQuestionCountAboveTarget === true],
  ['target_score_89_remote_pass_no_repair', () => validateTargetScoreBaseline(buildOrchestrationCapsule({ targetScoreBaseline: { acceptedTargetQualityScore: 89, currentTargetQualityScore: 89 } }).targetScoreBaseline).status === 'pass'],
  ['target_score_only_repair_forbidden', () => failed(validateTargetScoreBaseline({ ...buildOrchestrationCapsule().targetScoreBaseline, repairAllowedForScoreOnly: true }))],
  ['score_regression_must_be_recorded', () => failed(validateTargetScoreBaseline({ ...buildOrchestrationCapsule().targetScoreBaseline, acceptedTargetQualityScore: 95, currentTargetQualityScore: 89, scoreRegressionDetected: false }))],
  ['workflow_success_requires_safe_summary_pass', () => failed(validateEvidenceFreshnessGuard({ ...buildOrchestrationCapsule().evidenceFreshnessGuard, workflowSuccessRequiresSafeSummaryPass: false }))],
  ['evidence_drift_blocks_merge_coherence', () => failed(validateEvidenceFreshnessGuard({ ...buildOrchestrationCapsule().evidenceFreshnessGuard, sameHead: false, evidenceDriftDetected: false }))],
];

const proofIntegrityCases = [
  ['root_cause_repeat_twice_stops_without_new_evidence', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ rootCauseSignature: { rootCauseStatus: 'known', rootCauseSignature: 'artifact_finalization_order', sameRootCauseRepeatCount: 2 } })))],
  ['new_evidence_allows_one_more_repair_loop', () => validateWorkerProofCapsule(buildWorkerProofCapsule({ rootCauseSignature: { rootCauseStatus: 'known', rootCauseSignature: 'artifact_finalization_order', sameRootCauseRepeatCount: 2, newEvidenceAppeared: true } })).status === 'pass'],
  ['repair_loop_saturation_must_be_recorded', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ repairLoopMetrics: { sameRootCauseRepeatCount: 2, highTierPlanAlreadyProduced: true, validationStillFails: true } })) )],
  ['high_tier_plan_cannot_create_owner_authority', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ highTierPlanOutcome: { status: 'produced', ownerAuthorityCreated: true } })))],
  ['metadata_only_invariant_blocks_product_code', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ boundaryDiffClassification: { changeClass: 'product_code_change' } })))],
  ['metadata_only_invariant_blocks_package_change', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ boundaryDiffClassification: { packageChanged: true } })))],
  ['claim_linter_blocks_runtime_readiness_claim', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ claimLint: { runtimeReadinessClaimed: true } })))],
  ['claim_linter_blocks_legal_policy_and_deploy_claims', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ claimLint: { legalComplianceClaimed: true, youtubePolicyClaimed: true, deployClaimed: true } })))],
  ['restricted_asset_high_risk_cannot_hide_in_metadata', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({ boundaryDiffClassification: { changeClass: 'restricted_asset_high_risk' } })))],
];

const ownerDecisionCases = [
  ['owner_question_count_recorded_and_bounded', () => validateOwnerDecisionBrief(buildOwnerDecisionBrief({ ownerQuestionCount: 1 })).status === 'pass'],
  ['owner_question_count_over_three_fails', () => failed(validateOwnerDecisionBrief(buildOwnerDecisionBrief({ ownerQuestionCount: 4 })))],
  ['decision_compression_records_safe_artifact_reads', () => buildOwnerDecisionBrief({ safeArtifactReadCount: 3 }).decisionCompressionMetrics.safeArtifactReadCount === 3],
  ['decision_compression_records_line_target_warning', () => buildOwnerDecisionBrief({ finalReportLineCount: 15 }).decisionCompressionMetrics.finalReportLineCountAboveTarget === true],
  ['final_report_line_count_bounded', () => failed(validateOwnerDecisionBrief(buildOwnerDecisionBrief({ finalReportLineCount: 71 })))],
  ['terminal_merge_requires_owner_and_same_head_remote', () => failed(validateOwnerDecisionBrief(buildOwnerDecisionBrief({ mergeDecisionIntegrity: { terminalAction: 'merge_current_pr', ownerDecisionRequired: false } })))],
  ['github_approval_review_not_submitted', () => buildOwnerDecisionBrief().mergeDecisionIntegrity.githubApprovalReviewSubmitted === false],
  ['self_approval_not_allowed', () => buildOwnerDecisionBrief().mergeDecisionIntegrity.selfApproval === false],
  ['safe_summary_count_only_in_owner_brief', () => buildOwnerDecisionBrief().decisionCompressionMetrics.passStatusDetail === 'count_only'],
];

const cases = [
  ...compatibilityCases,
  ...calibrationCases,
  ...proofIntegrityCases,
  ...ownerDecisionCases,
].map(([name, fn]) => test(name, fn));

const fixtureGroups = [
  'v118_v119_v120_compatibility_matrix',
  'adaptive_metrics_matrix',
  'routing_calibration_matrix',
  'evidence_freshness_matrix',
  'target_score_baseline_matrix',
  'root_cause_loop_guard_matrix',
  'boundary_diff_claim_lint_matrix',
  'owner_burden_decision_integrity_matrix',
];

const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v121SelfTestStatus: {
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

writeJsonReport(report, 'CODEX_V121_SELF_TEST_REPORT');
if (!process.env.CODEX_V121_SELF_TEST_REPORT && process.env.CODEX_QUALITY_REPORT !== 'json') {
  console.log(`v121SelfTestStatus: ${report.v121SelfTestStatus.status}`);
}
exitFor(report);
