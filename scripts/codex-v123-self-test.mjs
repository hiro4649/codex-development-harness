#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.3

import fs from 'node:fs';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  V123_OPERATOR_STATUS_KEYS,
  V123_P0_ARTIFACTS,
  buildOrchestrationCapsule,
  validateActivePolicyIndex,
  validateContextReadLedger,
  validateEscalationEffectivenessLedger,
  validateFinalDecisionClosure,
  validateOrchestrationCapsule,
  validateSkillContractRegistry,
  validateSkillContextRouting,
  validateSkillEffectivenessLedger,
  validateWorkspaceIdentityGate,
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

const validSkillContract = {
  schemaVersion: 'skill-contract-v2',
  skillId: 'repo-quickcheck',
  allowed_repo_profiles: ['source_harness', 'harness_workflow_r3'],
  forbidden_repo_profiles: ['token_only_restricted'],
  task_profiles: ['routine', 'harness_source_body'],
  max_context_tokens: 1200,
  when_to_use: ['starting clean repo audit'],
  when_not_to_use: ['owner-only decision'],
  required_artifacts: ['codex-orchestration-capsule.safe.json'],
  forbidden_actions: ['raw_logs', 'wallet_rpc_deploy', 'readiness_claim'],
  artifact_pointer_first: true,
  raw_logs_forbidden: true,
  owner_decision_boundary: true,
  output_contract: { format: 'compact_safe_summary', max_lines: 8 },
};

const compatibilityCases = [
  ['v123_self_test_must_pass', () => true],
  ['v123_adds_no_new_p0_artifact', () => V123_P0_ARTIFACTS.length === 3 && !V123_P0_ARTIFACTS.includes('codex-v123-decision-closure.safe.json')],
  ['v123_adds_no_new_top_level_status', () => V123_OPERATOR_STATUS_KEYS.length === 8 && !V123_OPERATOR_STATUS_KEYS.includes('finalDecisionClosureStatus')],
  ['v123_preserves_v118_final_decision', () => buildOrchestrationCapsule().finalAuthority === 'v1.1.8_final_decision_kernel'],
  ['v123_preserves_v119_orchestration', () => buildOrchestrationCapsule().authorityBoundary.reviewPoolConsensusCreatesMergePermission === false],
  ['v123_preserves_v122_skill_context_routing', () => validateSkillContextRouting(buildOrchestrationCapsule().skillContextRouting).status === 'pass'],
  ['v123_no_new_skill_daemon', () => !fs.existsSync('scripts/codex-skill-daemon.mjs')],
  ['operator_visible_statuses_max_8', () => V123_OPERATOR_STATUS_KEYS.length === 8],
];

const closureCases = [
  ['final_decision_closure_default_passes_create_pr_phase', () => passed(validateFinalDecisionClosure(buildOrchestrationCapsule().finalDecisionClosure))],
  ['final_decision_closure_fails_when_reason_missing', () => failed(validateFinalDecisionClosure({
    ...buildOrchestrationCapsule().finalDecisionClosure,
    phase: 'merge_consideration',
    terminalAction: 'merge_current_pr',
    targetQualityStatus: 'pass',
    blockingReasonsCount: 0,
    sameHeadRemoteGate: 'pass',
    ownerOrDelegatedMergeScope: 'valid',
    mergeAllowed: false,
    singleClosureReason: 'none',
  }))],
  ['create_pr_only_allowed_before_remote_gate', () => passed(validateFinalDecisionClosure({
    ...buildOrchestrationCapsule().finalDecisionClosure,
    phase: 'create_pr_only',
    terminalAction: 'create_pr_only',
    sameHeadRemoteGate: 'not_required',
    ownerOrDelegatedMergeScope: 'not_required_for_phase',
    singleClosureReason: 'phase_create_pr_only',
  }))],
  ['merge_current_pr_requires_same_head_remote_gate', () => failed(validateFinalDecisionClosure({
    ...buildOrchestrationCapsule().finalDecisionClosure,
    phase: 'merge_consideration',
    terminalAction: 'merge_current_pr',
    targetQualityStatus: 'pass',
    blockingReasonsCount: 0,
    sameHeadRemoteGate: 'pending',
    ownerOrDelegatedMergeScope: 'valid',
    mergeAllowed: true,
    singleClosureReason: 'merge_allowed',
  }))],
  ['merge_consideration_block_requires_single_reason', () => failed(validateFinalDecisionClosure({
    ...buildOrchestrationCapsule().finalDecisionClosure,
    phase: 'merge_consideration',
    terminalAction: 'create_pr_only',
    targetQualityStatus: 'pending',
    blockingReasonsCount: 0,
    sameHeadRemoteGate: 'pending',
    ownerOrDelegatedMergeScope: 'missing',
    mergeAllowed: false,
    singleClosureReason: 'none',
  }))],
];

const workspaceAndPolicyCases = [
  ['workspace_identity_default_passes', () => passed(validateWorkspaceIdentityGate(buildOrchestrationCapsule().workspaceIdentityGate))],
  ['workspace_identity_blocks_wrong_repo', () => failed(validateWorkspaceIdentityGate(buildOrchestrationCapsule({ workspaceIdentityGate: { wrongRepo: true } }).workspaceIdentityGate))],
  ['workspace_identity_read_only_wrong_repo_warns_not_blocks', () => {
    const gate = buildOrchestrationCapsule({ workspaceIdentityGate: { wrongRepo: true, readOnlyAudit: true } }).workspaceIdentityGate;
    return gate.workspaceIdentityStatus === 'warn' && passed(validateWorkspaceIdentityGate(gate));
  }],
  ['workspace_identity_blocks_unresolvable_remote_for_mutation', () => failed(validateWorkspaceIdentityGate(buildOrchestrationCapsule({ workspaceIdentityGate: { mutationTask: true, repoResolvableOnGitHub: false } }).workspaceIdentityGate))],
  ['active_policy_index_required', () => passed(validateActivePolicyIndex(buildOrchestrationCapsule().activePolicyIndex))],
  ['active_policy_index_keeps_required_reads_small', () => buildOrchestrationCapsule().activePolicyIndex.requiredReads.length <= 3],
  ['active_policy_index_blocks_legacy_required_read', () => failed(validateActivePolicyIndex({
    ...buildOrchestrationCapsule().activePolicyIndex,
    requiredReads: ['AGENTS.md', 'docs/process/CODEX_HARNESS_MANIFEST.json', 'docs/process/CODEX_V123_SPEC.md', 'legacy_specs'],
  }))],
];

const contextAndSkillCases = [
  ['observed_context_read_ledger_default_passes', () => passed(validateContextReadLedger(buildOrchestrationCapsule().contextReadLedger))],
  ['observed_context_blocks_raw_logs', () => failed(validateContextReadLedger(buildOrchestrationCapsule({
    contextReadLedger: { observedToolReads: [{ sourceType: 'rawLog', pathOrRef: 'logs', readReason: 'owner_requested' }] },
  }).contextReadLedger))],
  ['observed_legacy_spec_without_reason_blocks', () => failed(validateContextReadLedger(buildOrchestrationCapsule({
    contextReadLedger: { observedToolReads: [{ sourceType: 'legacySpec', pathOrRef: 'docs/process/CODEX_V118_SPEC.md', readReason: 'not_recorded' }] },
  }).contextReadLedger))],
  ['observed_pr_history_without_pointer_blocks', () => failed(validateContextReadLedger(buildOrchestrationCapsule({
    contextReadLedger: { observedToolReads: [{ sourceType: 'prHistory', pathOrRef: 'PR history', readReason: 'not_recorded' }] },
  }).contextReadLedger))],
  ['unobserved_declared_context_warns_not_blocks', () => {
    const ledger = buildOrchestrationCapsule({
      contextReadLedger: { unobservedDeclaredUse: ['repo-quickcheck'] },
    }).contextReadLedger;
    return ledger.contextLedgerStatus === 'warn' && passed(validateContextReadLedger(ledger));
  }],
  ['skill_contract_v2_required_for_selected_skill', () => failed(validateSkillContractRegistry(buildOrchestrationCapsule({
    skillContractRegistry: { selectedSkillIds: ['repo-quickcheck'], contracts: [] },
  }).skillContractRegistry))],
  ['skill_contract_v2_valid_contract_passes', () => passed(validateSkillContractRegistry(buildOrchestrationCapsule({
    skillContractRegistry: { selectedSkillIds: ['repo-quickcheck'], contracts: [validSkillContract] },
  }).skillContractRegistry))],
  ['skill_contract_blocks_missing_when_not_to_use', () => failed(validateSkillContractRegistry(buildOrchestrationCapsule({
    skillContractRegistry: { selectedSkillIds: ['repo-quickcheck'], contracts: [{ ...validSkillContract, when_not_to_use: [] }] },
  }).skillContractRegistry))],
  ['skill_contract_blocks_forbidden_repo_profile', () => failed(validateSkillContractRegistry(buildOrchestrationCapsule({
    skillContractRegistry: {
      currentRepoProfile: 'token_only_restricted',
      selectedSkillIds: ['repo-quickcheck'],
      contracts: [validSkillContract],
    },
  }).skillContractRegistry))],
  ['skill_effectiveness_unknown_warns_on_target', () => buildOrchestrationCapsule({
    skillEffectivenessLedger: { skillUseRecords: [{ skillId: 'repo-quickcheck', contribution: 'unknown', decisionImpact: 'unknown' }] },
  }).skillEffectivenessLedger.skillEffectivenessStatus === 'warn'],
  ['skill_effectiveness_unknown_blocks_source_hard', () => failed(validateSkillEffectivenessLedger(buildOrchestrationCapsule({
    skillEffectivenessLedger: { sourceHard: true, skillUseRecords: [{ skillId: 'repo-quickcheck', contribution: 'unknown', decisionImpact: 'unknown' }] },
  }).skillEffectivenessLedger))],
  ['skill_misfire_hard_fails_for_forbidden_action', () => failed(validateSkillEffectivenessLedger(buildOrchestrationCapsule({
    skillEffectivenessLedger: { skillUseRecords: [{ skillId: 'product-change-safety', contribution: 'harmful', decisionImpact: 'blocked_forbidden_action', forbiddenActionRecommended: true }] },
  }).skillEffectivenessLedger))],
];

const escalationAndReviewCases = [
  ['escalation_not_used_passes', () => passed(validateEscalationEffectivenessLedger(buildOrchestrationCapsule().escalationEffectivenessLedger))],
  ['escalation_effective_when_new_finding_or_validation_improved', () => passed(validateEscalationEffectivenessLedger(buildOrchestrationCapsule({
    escalationEffectivenessLedger: { escalatedAgentRole: 'highest_reasoning_reviewer', escalationReason: 'root_cause_unclear', beforeEscalationBlocker: 'unclear_root_cause', newFindingProduced: true },
  }).escalationEffectivenessLedger))],
  ['escalation_neutral_when_no_new_finding_below_high_tier', () => {
    const ledger = buildOrchestrationCapsule({
      escalationEffectivenessLedger: { escalatedAgentRole: 'specialist_reviewer', escalationReason: 'reviewer_cannot_classify', beforeEscalationBlocker: 'reviewer_disagreement' },
    }).escalationEffectivenessLedger;
    return ledger.effectivenessStatus === 'neutral' && passed(validateEscalationEffectivenessLedger(ledger));
  }],
  ['escalation_stops_when_no_new_information_after_high_tier', () => failed(validateEscalationEffectivenessLedger(buildOrchestrationCapsule({
    escalationEffectivenessLedger: { escalatedAgentRole: 'highest_reasoning_reviewer', escalationReason: 'root_cause_unclear', beforeEscalationBlocker: 'unclear_root_cause' },
  }).escalationEffectivenessLedger))],
  ['escalation_stops_same_root_cause_after_high_tier', () => failed(validateEscalationEffectivenessLedger(buildOrchestrationCapsule({
    escalationEffectivenessLedger: { escalatedAgentRole: 'highest_reasoning_reviewer', escalationReason: 'same_primary_class_repeated', beforeEscalationBlocker: 'repeated_failure', sameRootCauseRepeatCount: 2 },
  }).escalationEffectivenessLedger))],
  ['reviewer_independence_blocks_same_worker_independent_review', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    reviewerIndependenceProof: { independentReviewUsed: true, sameWorkerReview: true, treatedAsIndependent: true, reviewerRole: 'scope_security' },
  })))],
  ['reviewer_independence_same_scratchpad_unknown_warns', () => {
    const capsule = buildWorkerProofCapsule({
      reviewerIndependenceProof: { independentReviewUsed: true, reviewerRole: 'scope_security' },
    });
    return capsule.reviewerIndependenceProof.independenceStatus === 'warn' && passed(validateWorkerProofCapsule(capsule));
  }],
  ['reviewer_independence_blocks_raw_logs', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    reviewerIndependenceProof: { independentReviewUsed: true, reviewerSawRawLogs: true, reviewerRole: 'scope_security' },
  })))],
  ['review_loop_blocks_repeated_same_finding', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    reviewLoopVerification: { reviewerCount: 1, reviewRiskProfile: 'harness_source', negativeFindingsCount: 1, sameFindingRepeated: true },
  })))],
  ['review_loop_negative_finding_required_by_risk', () => failed(validateWorkerProofCapsule(buildWorkerProofCapsule({
    reviewLoopVerification: { reviewerCount: 1, reviewRiskProfile: 'restricted_asset', negativeFindingsCount: 0 },
  })))],
  ['owner_brief_contains_final_decision_closure_summary', () => passed(validateOwnerDecisionBrief(buildOwnerDecisionBrief()))],
  ['owner_brief_blocks_inconsistent_closure_summary', () => failed(validateOwnerDecisionBrief(buildOwnerDecisionBrief({
    finalDecisionClosureSummary: { closureStatus: 'inconsistent', singleClosureReason: 'decision_closure_inconsistent' },
  })))],
  ['orchestration_capsule_validates_all_v123_internal_ledgers', () => {
    const result = validateOrchestrationCapsule(buildOrchestrationCapsule());
    return Object.values(result).every((item) => item.status === 'pass');
  }],
];

const cases = [
  ...compatibilityCases,
  ...closureCases,
  ...workspaceAndPolicyCases,
  ...contextAndSkillCases,
  ...escalationAndReviewCases,
].map(([name, fn]) => test(name, fn));

const fixtureGroups = [
  'v118_v119_v120_v121_v122_compatibility_matrix',
  'final_decision_closure_matrix',
  'workspace_identity_matrix',
  'active_policy_index_matrix',
  'observed_context_read_matrix',
  'skill_contract_v2_matrix',
  'skill_effectiveness_matrix',
  'escalation_effectiveness_matrix',
  'reviewer_independence_matrix',
  'review_loop_verification_matrix',
];

const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v123SelfTestStatus: {
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

writeJsonReport(report, 'CODEX_V123_SELF_TEST_REPORT');
if (!process.env.CODEX_V123_SELF_TEST_REPORT && process.env.CODEX_QUALITY_REPORT !== 'json') {
  console.log(`v123SelfTestStatus: ${report.v123SelfTestStatus.status}`);
}
exitFor(report);
