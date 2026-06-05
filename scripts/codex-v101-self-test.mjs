#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { scanObjectForUnsafe, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import * as gates from './codex-v101-gate-lib.mjs';

const CASES = [
  ['parent_v100_required_for_v101_pass', gates.buildParentHarnessPreflightReport, { parentVersion: '1.0.0' }, 'parentHarnessPreflightStatus', 'pass'],
  ['v100_self_test_preserved_pass', gates.buildHarnessSourceGatePreconditionReport, { v100SelfTestFail: false }, 'harnessSourceGatePreconditionStatus', 'pass'],
  ['v101_self_test_registered_pass', gates.buildV101SelfTestRegistrationReport, {}, 'v101SelfTestStatus', 'pass'],

  ['local_gate_json_parseable_pass', gates.buildJsonReportShapeReport, {}, 'jsonReportShapeStatus', 'pass'],
  ['local_gate_json_empty_fails', gates.buildJsonReportShapeReport, { empty: true }, 'jsonReportShapeStatus', 'fail'],
  ['local_gate_json_missing_fails', gates.buildLocalGateReportContractReport, { stdoutBytes: 0 }, 'localGateReportContractStatus', 'fail'],
  ['local_gate_timeout_no_output_fails', gates.buildLocalGateReportContractReport, { timeout: true, stdoutBytes: 0, stdoutStderrEmptyTimeout: true }, 'localGateReportContractStatus', 'fail'],
  ['local_gate_human_text_mixed_with_json_fails', gates.buildJsonReportShapeReport, { humanTextMixed: true }, 'jsonReportShapeStatus', 'fail'],
  ['local_gate_side_effect_tracked_file_fails', gates.buildLocalGateSideEffectReport, { trackedFileSideEffect: true }, 'localGateSideEffectStatus', 'fail'],
  ['local_gate_branch_mutation_fails', gates.buildLocalGateSideEffectReport, { branchMutation: true }, 'localGateSideEffectStatus', 'fail'],
  ['local_gate_head_mutation_fails', gates.buildLocalGateSideEffectReport, { headMutation: true }, 'localGateSideEffectStatus', 'fail'],

  ['local_branch_main_pass', gates.buildLocalBranchInvariantReport, { pilotRelevant: true, branch: 'main' }, 'localBranchInvariantStatus', 'pass'],
  ['local_branch_non_main_fails', gates.buildLocalBranchInvariantReport, { pilotRelevant: true, branch: 'feature' }, 'localBranchInvariantStatus', 'fail'],
  ['target_head_origin_main_pass', gates.buildTargetHeadInvariantReport, { pilotRelevant: true, head: 'a', originMain: 'a' }, 'targetHeadInvariantStatus', 'pass'],
  ['target_head_mismatch_fails', gates.buildTargetHeadInvariantReport, { pilotRelevant: true, head: 'a', originMain: 'b' }, 'targetHeadInvariantStatus', 'fail'],
  ['origin_main_drift_requires_same_head_quality_gate', gates.buildOriginMainDriftReport, { originMainDrifted: true, sameHeadMainQualityGateSuccess: false }, 'originMainDriftStatus', 'fail'],
  ['same_head_main_quality_gate_missing_fails', gates.buildSameHeadMainQualityGateReport, { required: true, sameHeadMainQualityGateSuccess: false }, 'sameHeadMainQualityGateStatus', 'fail'],

  ['toolchain_node_missing_fails', gates.buildNodeAvailabilityReport, { nodeOk: false }, 'nodeAvailabilityStatus', 'fail'],
  ['toolchain_npm_missing_fails', gates.buildNpmAvailabilityReport, { npmOk: false }, 'npmAvailabilityStatus', 'fail'],
  ['toolchain_gh_missing_fails', gates.buildGithubCliAvailabilityReport, { ghOk: false }, 'githubCliAvailabilityStatus', 'fail'],
  ['github_auth_missing_fails', gates.buildGithubAuthReport, { authOk: false, tokenPresent: false }, 'githubAuthStatus', 'fail'],

  ['pilot_input_clean_main_pass', gates.buildPilotInputCleanlinessReport, {}, 'pilotInputCleanlinessStatus', 'pass'],
  ['pilot_input_dirty_fails', gates.buildPilotInputCleanlinessReport, { dirty: true }, 'pilotInputCleanlinessStatus', 'fail'],
  ['pilot_input_wrong_branch_fails', gates.buildPilotInputCleanlinessReport, { wrongBranch: true }, 'pilotInputCleanlinessStatus', 'fail'],
  ['tracked_generated_artifact_fails', gates.buildTrackedGeneratedArtifactReport, { trackedGeneratedArtifact: true }, 'trackedGeneratedArtifactStatus', 'fail'],
  ['current_head_evidence_fields_required', gates.buildCurrentHeadEvidenceReport, {}, 'currentHeadEvidenceField', 'fail'],

  ['prime_directive_present_pass', gates.buildPrimeDirectiveReport, { text: 'Truth, trust, security, maintainability, product value, and the smallest correct change.' }, 'primeDirectiveStatus', 'pass'],
  ['prime_directive_rule_dump_fails', gates.buildPrimeDirectiveReport, { text: 'Rules only.', ruleDumpOnly: true }, 'primeDirectiveStatus', 'fail'],
  ['outcome_contract_product_behavior_pass', gates.buildOutcomeContractReport, { productBehaviorChange: true, replacedBehavior: 'old', expectedOutcome: 'new', sourceOfTruthOwner: 'owner', oldPathDisposition: 'redirect', doneEvidence: 'operator_visible_delta' }, 'outcomeContractStatus', 'pass'],
  ['outcome_contract_missing_for_product_change_fails', gates.buildOutcomeContractReport, { productBehaviorChange: true }, 'outcomeContractStatus', 'fail'],
  ['source_of_truth_duplicate_owner_fails', gates.buildSourceOfTruthOwnershipReport, { duplicateOwner: true }, 'sourceOfTruthOwnershipStatus', 'fail'],
  ['plan_reviewer_aligned_pass', gates.buildPlanReviewerWorkerReport, { reviewers: ['owner_reviewer', 'cutover_reviewer', 'evidence_reviewer'] }, 'planReviewerWorkerStatus', 'pass'],
  ['plan_reviewer_wrong_owner_fails', gates.buildPlanReviewerWorkerReport, { reviewers: ['owner_reviewer', 'cutover_reviewer', 'evidence_reviewer'], wrongOwner: true }, 'planReviewerWorkerStatus', 'fail'],
  ['plan_reviewer_missing_cutover_fails', gates.buildPlanReviewerWorkerReport, { reviewers: ['owner_reviewer', 'cutover_reviewer', 'evidence_reviewer'], missingCutover: true }, 'planReviewerWorkerStatus', 'fail'],
  ['plan_reviewer_weak_evidence_fails', gates.buildPlanReviewerWorkerReport, { reviewers: ['owner_reviewer', 'cutover_reviewer', 'evidence_reviewer'], weakEvidence: true }, 'planReviewerWorkerStatus', 'fail'],
  ['anti_accretion_dual_active_path_fails', gates.buildAntiAccretionReport, { disposition: 'redirect', dualActivePath: true }, 'antiAccretionStatus', 'fail'],
  ['visible_acceptance_evidence_before_after_pass', gates.buildVisibleAcceptanceEvidenceReport, { beforeUserVisibleBehavior: 'before', afterUserVisibleBehavior: 'after', whatUserSaw: 'delta', whatUserReceived: 'result', whatUserCouldDo: 'continue', evidenceType: 'operator_visible_delta', evidenceLocation: 'report', limitations: 'not runtime readiness' }, 'visibleAcceptanceEvidenceStatus', 'pass'],
  ['visible_acceptance_evidence_test_only_fails', gates.buildVisibleAcceptanceEvidenceReport, { productBehaviorChange: true, beforeUserVisibleBehavior: 'before', afterUserVisibleBehavior: 'after', whatUserSaw: 'delta', whatUserReceived: 'result', whatUserCouldDo: 'continue', evidenceType: 'unit_test', evidenceLocation: 'test', limitations: 'test only' }, 'visibleAcceptanceEvidenceStatus', 'fail'],

  ['small_product_pr_fast_path_pass', gates.buildSmallProductPrFastPathReport, { changedFiles: 2 }, 'smallProductPrFastPathStatus', 'pass'],
  ['small_product_pr_runtime_claim_fails', gates.buildSmallProductPrFastPathReport, { runtimeReadinessClaimed: true }, 'smallProductPrFastPathStatus', 'fail'],
  ['small_product_pr_no_remote_evidence_fails', gates.buildSmallProductPrFastPathReport, { noRemoteEvidence: true }, 'smallProductPrFastPathStatus', 'fail'],
  ['self_test_fixture_isolation_pass', gates.buildSelfTestFixtureIsolationReport, {}, 'selfTestFixtureIsolationStatus', 'pass'],
  ['self_test_fixture_tracked_file_side_effect_fails', gates.buildSelfTestFixtureIsolationReport, { trackedFileSideEffect: true }, 'selfTestFixtureIsolationStatus', 'fail'],
  ['authoritative_product_evidence_pass', gates.buildAuthoritativeProductEvidenceReport, { sameHeadFormalPass: true, staleDiagnosticPresent: true }, 'authoritativeProductEvidenceStatus', 'pass'],
  ['placeholder_only_still_fails', gates.buildAuthoritativeProductEvidenceReport, { placeholderOnly: true }, 'authoritativeProductEvidenceStatus', 'fail'],
  ['lifeboat_only_still_fails', gates.buildAuthoritativeProductEvidenceReport, { lifeboatOnly: true }, 'authoritativeProductEvidenceStatus', 'fail'],
  ['target_quality_owner_action_product_fix', gates.buildTargetQualityOwnerActionReport, { action: 'product_fix_required' }, 'targetQualityOwnerActionStatus', 'pass'],
  ['target_quality_owner_action_body_only', gates.buildTargetQualityOwnerActionReport, { action: 'body_only_required' }, 'targetQualityOwnerActionStatus', 'pass'],
  ['target_quality_owner_action_harness_fix', gates.buildTargetQualityOwnerActionReport, { action: 'harness_fix_required' }, 'targetQualityOwnerActionStatus', 'pass'],
  ['target_quality_owner_action_remote_infra', gates.buildTargetQualityOwnerActionReport, { action: 'remote_infra_required' }, 'targetQualityOwnerActionStatus', 'pass'],
  ['runtime_adoption_sequence_pass', gates.buildRuntimeAdoptionSequenceReport, { steps: ['foundation', 'claim', 'persistence', 'reconciliation', 'worker', 'runtime_readiness', 'production_go'] }, 'runtimeAdoptionSequenceStatus', 'pass'],
  ['runtime_adoption_sequence_out_of_order_fails', gates.buildRuntimeAdoptionSequenceReport, { steps: ['foundation', 'worker', 'claim'] }, 'runtimeAdoptionSequenceStatus', 'fail'],
];

const results = CASES.map(([name, builder, input, key, expected]) => {
  const report = builder(input);
  const actual = report[key]?.status || report.status;
  return {
    name,
    status: actual === expected ? 'pass' : 'fail',
    expected,
    actual,
    safeSummaryOnly: true,
  };
});

const failures = results.filter((item) => item.status !== 'pass');
const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.7',
  status: failures.length ? 'fail' : 'pass',
  v101SelfTestStatus: {
    status: failures.length ? 'fail' : 'pass',
    caseCount: results.length,
    failures,
    safeSummaryOnly: true,
  },
  cases: results,
  safeSummaryOnly: true,
};

if (scanObjectForUnsafe(report).length) {
  report.status = 'fail';
  report.v101SelfTestStatus = { status: 'fail', reasonCodes: ['unsafe_value_detected'], safeSummaryOnly: true };
}

writeJsonReport(report, 'CODEX_V101_SELF_TEST_REPORT');
exitFor(report);
