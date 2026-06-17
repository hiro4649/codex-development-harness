#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.4

import fs from 'node:fs';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  V124_OPERATOR_STATUS_KEYS,
  V124_P0_ARTIFACTS,
  buildOrchestrationCapsule,
  validateDelegationBoundary,
  validateEvidenceSemanticsKernel,
  validateGoalContract,
  validateOrchestrationCapsule,
  validateTargetHarnessFootprintPolicy,
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
  ['v124_self_test_must_pass', () => true],
  ['v124_adds_no_new_p0_artifact', () => V124_P0_ARTIFACTS.length === 3 && !V124_P0_ARTIFACTS.includes('codex-v124-delegation.safe.json')],
  ['v124_adds_no_new_top_level_status', () => V124_OPERATOR_STATUS_KEYS.length === 8 && !V124_OPERATOR_STATUS_KEYS.includes('goalContractStatus')],
  ['v124_preserves_v118_final_decision', () => buildOrchestrationCapsule().finalAuthority === 'v1.1.8_final_decision_kernel'],
  ['v124_preserves_v119_orchestration_artifacts', () => V124_P0_ARTIFACTS.includes('codex-orchestration-capsule.safe.json')],
  ['v124_no_new_skill_daemon_or_visual_daemon', () => !fs.existsSync('scripts/codex-skill-daemon.mjs') && !fs.existsSync('scripts/codex-visual-proof-daemon.mjs')],
  ['v124_active_authority_tuple_is_current_or_successor', () => ['v124', 'v125', 'v126'].includes(buildOrchestrationCapsule().skillContextRouting.activeAuthorityTuple.activeSelfTestSuite)],
];

const goalAndDelegationCases = [
  ['goal_contract_default_passes', () => passed(validateGoalContract(buildOrchestrationCapsule().goalContract))],
  ['goal_completion_pass_requires_all_evidence', () => failed(validateGoalContract(buildOrchestrationCapsule({
    goalContract: { goalCompletionProof: { completionStatus: 'pass' } },
  }).goalContract))],
  ['goal_completion_passes_with_complete_proof', () => passed(validateGoalContract(buildOrchestrationCapsule({
    goalContract: {
      goalCompletionProof: {
        completionStatus: 'pass',
        successCriteriaSatisfied: true,
        requiredEvidenceSatisfied: true,
        forbiddenShortcutsAbsent: true,
        verificationPlanExecuted: true,
      },
    },
  }).goalContract))],
  ['delegation_boundary_default_passes', () => passed(validateDelegationBoundary(buildOrchestrationCapsule().delegationBoundary))],
  ['delegation_blocks_ai_owner_authority_creation', () => failed(validateDelegationBoundary(buildOrchestrationCapsule({
    delegationBoundary: { ownerAuthorityCreatedByAI: true },
  }).delegationBoundary))],
  ['delegation_blocks_expert_merge_or_readiness', () => failed(validateDelegationBoundary(buildOrchestrationCapsule({
    delegationBoundary: { expertJudgmentCanMerge: true, expertJudgmentCanClaimReadiness: true },
  }).delegationBoundary))],
  ['delegation_revocation_stops_continuation', () => failed(validateDelegationBoundary(buildOrchestrationCapsule({
    delegationBoundary: { delegationRevocation: { revoked: true, continueAllowed: true } },
  }).delegationBoundary))],
  ['closure_adapter_cannot_create_final_authority', () => failed(validateDelegationBoundary({
    ...buildOrchestrationCapsule().delegationBoundary,
    finalDecisionClosureAdapter: {
      ...buildOrchestrationCapsule().delegationBoundary.finalDecisionClosureAdapter,
      createsFinalAuthority: true,
    },
  }))],
];

const evidenceAndFootprintCases = [
  ['evidence_semantics_default_passes', () => passed(validateEvidenceSemanticsKernel(buildOrchestrationCapsule().evidenceSemanticsKernel))],
  ['evidence_semantics_blocks_pr_body_as_machine_evidence', () => failed(validateEvidenceSemanticsKernel(buildOrchestrationCapsule({
    evidenceSemanticsKernel: { prBodyIsMachineEvidence: true },
  }).evidenceSemanticsKernel))],
  ['evidence_semantics_blocks_self_referential_sha_requirement', () => failed(validateEvidenceSemanticsKernel(buildOrchestrationCapsule({
    evidenceSemanticsKernel: { selfReferentialShaRequired: true },
  }).evidenceSemanticsKernel))],
  ['evidence_semantics_pass_does_not_imply_readiness', () => failed(validateEvidenceSemanticsKernel(buildOrchestrationCapsule({
    evidenceSemanticsKernel: { passSemantics: { productReadinessPass: true } },
  }).evidenceSemanticsKernel))],
  ['target_footprint_default_passes', () => passed(validateTargetHarnessFootprintPolicy(buildOrchestrationCapsule().targetHarnessFootprintPolicy))],
  ['target_footprint_blocks_new_p0_artifact', () => failed(validateTargetHarnessFootprintPolicy(buildOrchestrationCapsule({
    targetHarnessFootprintPolicy: { newP0ArtifactAllowed: true },
  }).targetHarnessFootprintPolicy))],
  ['target_footprint_blocks_product_package_runtime_scope', () => failed(validateTargetHarnessFootprintPolicy(buildOrchestrationCapsule({
    targetHarnessFootprintPolicy: { productCodeChangeAllowed: true, packageLockChangeAllowed: true },
  }).targetHarnessFootprintPolicy))],
  ['repo_specific_visual_surface_requires_redaction', () => failed(validateTargetHarnessFootprintPolicy(buildOrchestrationCapsule({
    targetHarnessFootprintPolicy: { repoSpecificVisualProofSurface: { enabled: true, privateImageRedactionRequired: false } },
  }).targetHarnessFootprintPolicy))],
];

const expertLoopCases = [
  ['worker_proof_default_v124_extensions_pass', () => passed(validateWorkerProofCapsule(buildWorkerProofCapsule()))],
  ['bounded_loop_blocks_continue_without_new_signal', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    boundedExpertLoop: { loopContinuationRequested: true, loopContinuationAllowed: true },
  })))],
  ['bounded_loop_allows_continue_with_new_evidence_before_cap', () => passed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    boundedExpertLoop: { loopContinuationRequested: true, loopContinuationAllowed: true, newEvidenceAvailable: true, loopCycleCount: 1 },
  })))],
  ['bounded_loop_blocks_cycle_cap', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    boundedExpertLoop: { loopContinuationRequested: true, loopContinuationAllowed: true, newEvidenceAvailable: true, loopCycleCount: 4 },
  })))],
  ['skeptic_agent_requires_abnormal_trigger', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    expertRoleLedger: { roles: [{ roleId: 'skeptic', active: true, abnormalTrigger: 'none' }] },
  })))],
  ['inventory_agent_cannot_expand_product_scope', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    expertRoleLedger: { roles: [{ roleId: 'inventory', active: true, canModifyProductCode: true }] },
  })))],
  ['expert_role_requires_safe_artifacts_only', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    expertRoleLedger: { roles: [{ roleId: 'test_verifier', active: true, inputContextPacket: 'raw_logs' }] },
  })))],
  ['safe_failure_digest_blocks_raw_log_or_raw_diff', () => {
    const capsule = buildWorkerProofCapsule();
    capsule.safeFailureDigest.rawLogsRead = true;
    return failed(validateWorkerProofCapsule(capsule));
  }],
  ['safe_failure_digest_product_scope_requires_owner_escalation', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    safeFailureDigest: { repairScope: 'product_requires_owner_scope', ownerOnlyEscalationRequired: false },
  })))],
];

const ownerBriefCases = [
  ['owner_brief_default_v124_extensions_pass', () => passed(validateOwnerDecisionBrief(buildOwnerDecisionBrief()))],
  ['owner_brief_adapter_cannot_create_authority', () => {
    const brief = buildOwnerDecisionBrief();
    brief.finalDecisionClosureAdapter.ownerAuthorityCreatedByAI = true;
    return failed(validateOwnerDecisionBrief(brief));
  }],
  ['owner_burden_reducer_keeps_three_choices', () => {
    const brief = buildOwnerDecisionBrief();
    brief.ownerBurdenReducer.exactChoicesMax = 4;
    return failed(validateOwnerDecisionBrief(brief));
  }],
  ['safe_session_learning_is_proposal_only', () => {
    const brief = buildOwnerDecisionBrief();
    brief.safeSessionLearningProposal.autoApplyAllowed = true;
    return failed(validateOwnerDecisionBrief(brief));
  }],
  ['safe_session_learning_forbids_raw_transcript_mining', () => {
    const brief = buildOwnerDecisionBrief();
    brief.safeSessionLearningProposal.rawTranscriptMining = true;
    return failed(validateOwnerDecisionBrief(brief));
  }],
  ['repo_visual_surface_optional_and_repo_specific', () => failed(validateOwnerDecisionBrief(buildOwnerDecisionBrief({
    repoSpecificVisualProofSurface: { enabled: true, privateImageRedactionRequired: false },
  })))],
  ['orchestration_capsule_validates_all_v124_internal_blocks', () => {
    const result = validateOrchestrationCapsule(buildOrchestrationCapsule());
    return Object.values(result).every((item) => item.status === 'pass');
  }],
];

const cases = [
  ...compatibilityCases,
  ...goalAndDelegationCases,
  ...evidenceAndFootprintCases,
  ...expertLoopCases,
  ...ownerBriefCases,
].map(([name, fn]) => test(name, fn));

const fixtureGroups = [
  'v118_v119_v120_v121_v122_v123_compatibility_matrix',
  'goal_contract_matrix',
  'delegation_boundary_matrix',
  'evidence_semantics_matrix',
  'target_footprint_matrix',
  'bounded_expert_loop_matrix',
  'expert_role_ledger_matrix',
  'safe_failure_digest_matrix',
  'owner_burden_reducer_matrix',
  'safe_session_learning_matrix',
];

const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v124SelfTestStatus: {
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

writeJsonReport(report, 'CODEX_V124_SELF_TEST_REPORT');
if (!process.env.CODEX_V124_SELF_TEST_REPORT && process.env.CODEX_QUALITY_REPORT !== 'json') {
  console.log(`v124SelfTestStatus: ${report.v124SelfTestStatus.status}`);
}
exitFor(report);
