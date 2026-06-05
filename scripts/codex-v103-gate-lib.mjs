#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor, readText } from './codex-v080-lib.mjs';

export const V103_STATUS_KEYS = [
  'reasonSummaryFinalAggregationStatus',
  'remoteNpmDiagnosticTruthStatus',
  'localRemoteFailureDeltaClassifierStatus',
  'productSurfaceRouterStatus',
  'activeSelfTestArtifactSourceStatus',
  'prBodyGovernanceAutoRepairStatus',
  'reviewEvidenceTaxonomyStatus',
  'contractReadinessProfileStatus',
  'staleAuditInputStatus',
  'githubEventPayloadFreshnessStatus',
  'prBodyLiveFetchStatus',
  'safeArtifactHeadMatchStatus',
  'eventPayloadVsLivePrBodyDiffStatus',
  'rerunUsesStaleEventPayloadStatus',
  'mergeReadinessReasonLadderStatus',
  'codexActionBoundaryStatus',
  'userManualWorkProhibitedStatus',
  'safeNextActionPrecisionStatus',
  'designOnlyPrStatus',
  'implementationDeferredStatus',
  'fiveFiveLowModeStatus',
  'dynamicWorkflowDecisionStatus',
  'workflowGoalContractStatus',
  'workflowArtifactStatus',
  'workPacketSchemaStatus',
  'workerRoleMatrixStatus',
  'workerFileOwnershipV2Status',
  'parallelWorkerBudgetStatus',
  'approvalGateStatus',
  'simulatedSubagentFallbackStatus',
  'subagentRunnerAvailabilityStatus',
  'workPacketResultStatus',
  'integrationConflictStatus',
  'adversarialReviewStatus',
  'verificationFanInStatus',
  'workflowResumeCheckpointStatus',
  'workflowCostBudgetStatus',
  'workflowContextBudgetStatus',
  'workflowFinalReportStatus',
  'funkyRuntimeAdoptionSequenceStatus',
  'receiptFetcherNoSecretPreflightStatus',
  'stagingNoTxEvidenceStatus',
  'runtimeReadinessBlockerDigestStatus',
  'funkySafeRowExportStatus',
  'datasetAuditV2SpecStatus',
  'gameToolAdapterFixturePackStatus',
  'belovedAvatarSafetyAuditSpecStatus',
  'vgcFunkyReleaseLadderStatus',
  'v103SelfTestStatus',
];

export const V103_REASON_CODES = [
  'reason_summary_final_aggregation_inconsistent',
  'target_quality_pass_but_report_fail',
  'legacy_advisory_promoted_to_failure',
  'stale_blocking_reason_not_removed',
  'remote_npm_truth_missing',
  'remote_npm_executed_but_normalizer_missing',
  'remote_npm_executed_but_stale_head',
  'remote_npm_profile_mismatch',
  'local_remote_failure_delta_unknown',
  'product_surface_router_missing',
  'command_scope_mismatch',
  'command_cwd_missing',
  'active_self_test_artifact_mismatch',
  'legacy_artifact_used_as_active',
  'pr_body_governance_safe_patch_missing',
  'review_evidence_taxonomy_missing',
  'writer_self_review_detected',
  'chatgpt_pro_review_not_human_independent',
  'codex_operational_comment_informational_only',
  'contract_readiness_profile_missing',
  'stale_audit_input_detected',
  'github_event_payload_stale',
  'pr_body_live_fetch_missing',
  'safe_artifact_head_mismatch',
  'event_payload_live_body_diff',
  'rerun_uses_stale_event_payload',
  'merge_readiness_reason_ladder_missing',
  'codex_action_boundary_missing',
  'user_manual_work_pushed_back',
  'safe_next_action_not_precise',
  'design_only_pr_misclassified_as_implementation',
  'implementation_deferred_not_respected',
  'five_five_low_mode_violation',
  'dynamic_workflow_overused',
  'simulated_subagent_misrepresented',
  'worker_file_ownership_conflict_v2',
  'v103_self_test_missing',
];

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function bool(value) {
  return value === true || value === '1' || value === 'true' || value === 'yes';
}

function status(statusKey, state, payload = {}) {
  const report = simpleStatus(statusKey, state, {
    ...payload,
    reasonCodes: uniq(payload.reasonCodes),
    warnings: uniq(payload.warnings),
    safeSummaryOnly: true,
  });
  return scanObjectForUnsafe(report).length
    ? simpleStatus(statusKey, 'fail', { reasonCodes: ['unsafe_value_detected'], safeSummaryOnly: true })
    : report;
}

function pass(statusKey, payload = {}) {
  return status(statusKey, 'pass', payload);
}

function fail(statusKey, reasonCodes, payload = {}) {
  return status(statusKey, 'fail', { ...payload, reasonCodes });
}

function notApplicable(statusKey, reasonCodes = ['not_relevant_for_task_mode'], payload = {}) {
  return status(statusKey, 'not_applicable', { ...payload, reasonCodes });
}

function hasAny(input, keys) {
  return keys.some((key) => bool(input[key]));
}

function oneLine(value) {
  return typeof value === 'string' && value.trim() && !value.includes('\n');
}

function isVague(value) {
  return /if needed|as needed|maybe|必要なら|確認してください|later/i.test(String(value || ''));
}

export function buildReasonSummaryFinalAggregationReport(input = {}) {
  const reasons = [];
  if (input.targetQualityScoreStatus === 'pass' && input.reportStatus === 'fail' && !input.activeBlockingReasons?.length) {
    reasons.push('target_quality_pass_but_report_fail');
  }
  if (bool(input.legacyAdvisoryPromotedToFailure)) reasons.push('legacy_advisory_promoted_to_failure');
  if (bool(input.staleBlockingReasonRemains)) reasons.push('stale_blocking_reason_not_removed');
  if (hasAny(input, ['productVerificationFail', 'safeOutputFail', 'targetQualityFail', 'runtimeReadinessViolation', 'productionGoViolation'])) {
    return fail('reasonSummaryFinalAggregationStatus', ['reason_summary_final_aggregation_inconsistent'], { blockingPreserved: true });
  }
  return reasons.length ? fail('reasonSummaryFinalAggregationStatus', reasons) : pass('reasonSummaryFinalAggregationStatus');
}

export function buildRemoteNpmDiagnosticTruthReport(input = {}) {
  const reasons = [];
  const executed = bool(input.remoteProductEvidenceNpmExecuted || input.remoteNpmDiagnosticNpmExecuted || input.remoteProductBaselineNpmExecuted);
  if (bool(input.requiresProductVerification) && !executed) reasons.push('remote_npm_truth_missing');
  if (executed && input.classification === 'remote_npm_not_executed') reasons.push('remote_npm_truth_missing');
  if (bool(input.normalizerMissingField)) reasons.push('remote_npm_executed_but_normalizer_missing');
  if (bool(input.staleHead)) reasons.push('remote_npm_executed_but_stale_head');
  if (bool(input.profileMismatch)) reasons.push('remote_npm_profile_mismatch');
  if (bool(input.bodyGovernanceMissing)) reasons.push('pr_body_governance_safe_patch_missing');
  return reasons.length ? fail('remoteNpmDiagnosticTruthStatus', reasons) : pass('remoteNpmDiagnosticTruthStatus', {
    classification: input.classification || (executed ? 'remote_npm_executed_current_head' : 'remote_npm_not_required'),
    commandClass: input.commandClass || 'not_applicable',
    commandCwd: input.commandCwd || 'not_applicable',
  });
}

export function buildLocalRemoteFailureDeltaClassifierReport(input = {}) {
  const classification = input.classification || 'local_pass_remote_pass';
  if (classification === 'unknown') return fail('localRemoteFailureDeltaClassifierStatus', ['local_remote_failure_delta_unknown']);
  if (bool(input.localPassRemoteFailNoAction)) return fail('localRemoteFailureDeltaClassifierStatus', ['safe_next_action_not_precise']);
  return pass('localRemoteFailureDeltaClassifierStatus', { classification });
}

export function routeProductSurface(files = [], options = {}) {
  const changedFiles = Array.isArray(files) ? files : [];
  const surfaces = [];
  const add = (surface) => {
    if (!surfaces.some((item) => item.commandClass === surface.commandClass && item.commandCwd === surface.commandCwd)) surfaces.push(surface);
  };
  for (const file of changedFiles) {
    if (file.startsWith('apps/backend/')) add({ commandClass: 'backend_npm_test', commandCwd: 'apps/backend' });
    else if (file.startsWith('contracts/')) add({ commandClass: 'contracts_npm_test', commandCwd: 'contracts' });
    else if (file.startsWith('apps/frontend/')) add({ commandClass: 'frontend_build_or_test', commandCwd: 'apps/frontend' });
    else if (file === 'scripts/run-tests.js') add({ commandClass: 'product_test_surface', commandCwd: '.' });
    else if (file === 'package.json') add({ commandClass: 'package_surface', commandCwd: '.' });
    else if ((file.startsWith('src/') || file.startsWith('test/')) && bool(options.rootPackageExists)) add({ commandClass: 'root_npm_test', commandCwd: '.' });
  }
  return surfaces;
}

export function buildProductSurfaceRouterReport(input = {}) {
  const surfaces = input.surfaces || routeProductSurface(input.changedFiles || [], input);
  const reasons = [];
  if (bool(input.rootPackageMissingButRootNpm)) reasons.push('command_scope_mismatch');
  if (bool(input.wrongSurfaceOnly) || bool(input.contractsOnlyRanBackend) || bool(input.backendOnlyRanRoot)) reasons.push('command_scope_mismatch');
  if (bool(input.commandCwdMissing) || surfaces.some((surface) => !surface.commandCwd)) reasons.push('command_cwd_missing');
  if (bool(input.commandClassMissing) || surfaces.some((surface) => !surface.commandClass)) reasons.push('product_surface_router_missing');
  if (surfaces.length > 1 && !bool(input.multiSurfaceEvidence)) reasons.push('product_surface_router_missing');
  return reasons.length ? fail('productSurfaceRouterStatus', reasons, { surfaces }) : pass('productSurfaceRouterStatus', { surfaces });
}

export function buildActiveSelfTestArtifactSourceReport(input = {}) {
  const active = input.activeSelfTest || {
    version: '1.0.3',
    statusKey: 'v103SelfTestStatus',
    reportEnv: 'CODEX_V103_SELF_TEST_REPORT',
    suite: 'v103',
    artifact: 'codex-self-test-cases.safe.json',
  };
  const reasons = [];
  if (active.version !== '1.0.3' || active.statusKey !== 'v103SelfTestStatus' || active.reportEnv !== 'CODEX_V103_SELF_TEST_REPORT') reasons.push('active_self_test_artifact_mismatch');
  if (bool(input.legacyArtifactUsedAsActive)) reasons.push('legacy_artifact_used_as_active');
  if (bool(input.activeArtifactMissing)) reasons.push('active_self_test_artifact_mismatch');
  return reasons.length ? fail('activeSelfTestArtifactSourceStatus', reasons, { activeSelfTest: active }) : pass('activeSelfTestArtifactSourceStatus', { activeSelfTest: active });
}

export function buildPrBodyGovernanceAutoRepairReport(input = {}) {
  const missingSections = input.missingSections || [];
  const missingEvidenceFields = input.missingEvidenceFields || [];
  const safeSuggestedPatch = input.safeSuggestedPatch || (missingSections.length || missingEvidenceFields.length ? 'add_missing_safe_evidence_sections' : 'none');
  if (bool(input.implementationFailureHiddenAsBodyOnly)) return fail('prBodyGovernanceAutoRepairStatus', ['pr_body_governance_safe_patch_missing']);
  if ((missingSections.length || missingEvidenceFields.length) && !safeSuggestedPatch) return fail('prBodyGovernanceAutoRepairStatus', ['pr_body_governance_safe_patch_missing']);
  return pass('prBodyGovernanceAutoRepairStatus', {
    missingSections,
    missingEvidenceFields,
    safeSuggestedPatch,
    bodyOnlyRepairAllowed: !bool(input.implementationRepairRequired),
    implementationRepairRequired: bool(input.implementationRepairRequired),
    manualOwnerDecisionRequired: bool(input.manualOwnerDecisionRequired),
  });
}

export function buildReviewEvidenceTaxonomyReport(input = {}) {
  const type = input.type || 'human_independent_review';
  if (type === 'writer_self_review') return fail('reviewEvidenceTaxonomyStatus', ['writer_self_review_detected']);
  if (type === 'stale_review' || bool(input.headMismatch)) return fail('reviewEvidenceTaxonomyStatus', ['stale_audit_input_detected']);
  if (type === 'unknown_review') return fail('reviewEvidenceTaxonomyStatus', ['review_evidence_taxonomy_missing']);
  const satisfiesHumanIndependence = type === 'human_independent_review';
  return pass('reviewEvidenceTaxonomyStatus', { type, satisfiesHumanIndependence });
}

export function buildContractReadinessProfileReport(input = {}) {
  const reasons = [];
  if (bool(input.contractSourceChanged) && !bool(input.contractsTestRun)) reasons.push('contract_readiness_profile_missing');
  if (bool(input.deployScriptChanged) && !bool(input.escalatedProfile)) reasons.push('contract_readiness_profile_missing');
  if (hasAny(input, ['fundedTxClaimed', 'governanceTxClaimed', 'chainReadinessClaimed'])) reasons.push('contract_readiness_profile_missing');
  return reasons.length ? fail('contractReadinessProfileStatus', reasons) : pass('contractReadinessProfileStatus', { profile: 'contract_readiness_test_r2', noDeploy: true });
}

export function buildGithubEventPayloadFreshnessReport(input = {}) {
  return bool(input.eventPayloadStale) ? fail('githubEventPayloadFreshnessStatus', ['github_event_payload_stale']) : pass('githubEventPayloadFreshnessStatus');
}

export function buildPrBodyLiveFetchReport(input = {}) {
  return bool(input.liveFetchMissing) ? fail('prBodyLiveFetchStatus', ['pr_body_live_fetch_missing']) : pass('prBodyLiveFetchStatus');
}

export function buildSafeArtifactHeadMatchReport(input = {}) {
  return bool(input.headMismatch) ? fail('safeArtifactHeadMatchStatus', ['safe_artifact_head_mismatch']) : pass('safeArtifactHeadMatchStatus');
}

export function buildEventPayloadVsLivePrBodyDiffReport(input = {}) {
  return bool(input.diffFound) && !bool(input.safeSummaryPresent)
    ? fail('eventPayloadVsLivePrBodyDiffStatus', ['event_payload_live_body_diff'])
    : pass('eventPayloadVsLivePrBodyDiffStatus');
}

export function buildRerunUsesStaleEventPayloadReport(input = {}) {
  return bool(input.rerunUsesStaleEventPayload)
    ? fail('rerunUsesStaleEventPayloadStatus', ['rerun_uses_stale_event_payload'])
    : pass('rerunUsesStaleEventPayloadStatus');
}

export function buildStaleAuditInputReport(input = {}) {
  const reasons = [];
  if (bool(input.eventPayloadStale)) reasons.push('github_event_payload_stale');
  if (bool(input.liveFetchMissing)) reasons.push('pr_body_live_fetch_missing');
  if (bool(input.artifactHeadMismatch)) reasons.push('safe_artifact_head_mismatch');
  if (bool(input.rerunUsesStaleEventPayload)) reasons.push('rerun_uses_stale_event_payload');
  return reasons.length ? fail('staleAuditInputStatus', reasons) : pass('staleAuditInputStatus');
}

export function buildMergeReadinessReasonLadderReport(input = {}) {
  const reason = input.blockingReason || 'merge_ready';
  const allowed = [
    'non_overridable_failure',
    'product_failure',
    'runtime_or_production_readiness_violation',
    'same_head_remote_missing',
    'review_independence_missing',
    'external_blocked',
    'body_governance_missing',
    'stale_input',
    'manual_owner_decision_required',
    'ready_for_owner_confirmation',
    'merge_ready',
  ];
  if (!allowed.includes(reason) || bool(input.externalBlockedMergeReady) || !oneLine(input.nextAction || 'merge_when_gates_pass')) {
    return fail('mergeReadinessReasonLadderStatus', ['merge_readiness_reason_ladder_missing']);
  }
  return pass('mergeReadinessReasonLadderStatus', {
    blockingReason: reason,
    whyBlocked: input.whyBlocked || 'none',
    nextAction: input.nextAction || 'merge_when_gates_pass',
    doNotDo: input.doNotDo || 'do_not_claim_readiness',
    mergeReadiness: reason === 'merge_ready' ? 'yes' : 'no',
  });
}

export function buildCodexActionBoundaryReport(input = {}) {
  const state = input.state || 'codex_action_allowed';
  const allowed = [
    'codex_action_allowed',
    'codex_body_only_repair_allowed',
    'codex_safe_artifact_triage_allowed',
    'codex_waiting_for_external_review',
    'codex_waiting_for_github_event_freshness',
    'codex_waiting_for_owner_decision',
    'codex_blocked_non_overridable',
  ];
  return allowed.includes(state) ? pass('codexActionBoundaryStatus', { state }) : fail('codexActionBoundaryStatus', ['codex_action_boundary_missing']);
}

export function buildUserManualWorkProhibitedReport(input = {}) {
  return bool(input.codexWorkPushedToUser) || bool(input.codexSubstitutedExternalReview)
    ? fail('userManualWorkProhibitedStatus', ['user_manual_work_pushed_back'])
    : pass('userManualWorkProhibitedStatus');
}

export function buildSafeNextActionPrecisionReport(input = {}) {
  const action = input.safeNextAction || 'verify_source_pr_remote_gate';
  return oneLine(action) && !isVague(action)
    ? pass('safeNextActionPrecisionStatus', { safeNextAction: action })
    : fail('safeNextActionPrecisionStatus', ['safe_next_action_not_precise']);
}

export function buildDesignOnlyPrReport(input = {}) {
  return hasAny(input, ['runtimeBehaviorChanged', 'designClaimedAsImplementation'])
    ? fail('designOnlyPrStatus', ['design_only_pr_misclassified_as_implementation'])
    : pass('designOnlyPrStatus');
}

export function buildImplementationDeferredReport(input = {}) {
  return bool(input.implementationStarted)
    ? fail('implementationDeferredStatus', ['implementation_deferred_not_respected'])
    : pass('implementationDeferredStatus');
}

export function buildFiveFiveLowModeReport(input = {}) {
  return hasAny(input, ['multiPr', 'multiRepo', 'largeRefactor', 'rawLogRead', 'rawDiffRead', 'multipleSafeNextActions', 'backgroundPromises'])
    ? fail('fiveFiveLowModeStatus', ['five_five_low_mode_violation'])
    : pass('fiveFiveLowModeStatus', { mode: input.mode || '5.5_low' });
}

export function buildDynamicWorkflowDecisionReport(input = {}) {
  return bool(input.smallPrForcedWorkflow)
    ? fail('dynamicWorkflowDecisionStatus', ['dynamic_workflow_overused'])
    : pass('dynamicWorkflowDecisionStatus', { decision: input.decision || 'not_required_for_small_patch' });
}

export function buildWorkflowGoalContractReport(input = {}) {
  return input.goal && input.doneCriteria ? pass('workflowGoalContractStatus') : pass('workflowGoalContractStatus', { defaulted: true });
}

export function buildWorkflowArtifactReport(input = {}) {
  return bool(input.productReadyFromWorkflowArtifact)
    ? fail('workflowArtifactStatus', ['dynamic_workflow_overused'])
    : pass('workflowArtifactStatus');
}

export function buildWorkPacketSchemaReport(input = {}) {
  const packet = input.packet || { goal: 'classify', files: [], forbiddenScope: [], expectedOutput: 'safe_summary', verification: 'self_test' };
  const missing = ['goal', 'files', 'forbiddenScope', 'expectedOutput', 'verification'].filter((key) => packet[key] === undefined);
  return missing.length ? fail('workPacketSchemaStatus', ['dynamic_workflow_overused'], { missing }) : pass('workPacketSchemaStatus');
}

export function buildWorkerRoleMatrixReport(input = {}) {
  return bool(input.roleMissing) ? fail('workerRoleMatrixStatus', ['dynamic_workflow_overused']) : pass('workerRoleMatrixStatus');
}

export function buildWorkerFileOwnershipV2Report(input = {}) {
  return bool(input.fileOwnershipConflict)
    ? fail('workerFileOwnershipV2Status', ['worker_file_ownership_conflict_v2'])
    : pass('workerFileOwnershipV2Status');
}

export function buildParallelWorkerBudgetV103Report(input = {}) {
  return bool(input.unboundedWorkers) ? fail('parallelWorkerBudgetStatus', ['dynamic_workflow_overused']) : pass('parallelWorkerBudgetStatus');
}

export function buildApprovalGateReport(input = {}) {
  return hasAny(input, ['txWithoutApproval', 'deployWithoutApproval', 'migrationWithoutApproval'])
    ? fail('approvalGateStatus', ['dynamic_workflow_overused'])
    : pass('approvalGateStatus');
}

export function buildSimulatedSubagentFallbackReport(input = {}) {
  return bool(input.claimedExecuted)
    ? fail('simulatedSubagentFallbackStatus', ['simulated_subagent_misrepresented'])
    : pass('simulatedSubagentFallbackStatus');
}

export function buildSubagentRunnerAvailabilityReport(input = {}) {
  return bool(input.runnerRequired) && !bool(input.runnerAvailable)
    ? notApplicable('subagentRunnerAvailabilityStatus', ['subagent_runner_not_available'])
    : pass('subagentRunnerAvailabilityStatus');
}

export function buildWorkPacketResultReport(input = {}) {
  return bool(input.resultMissing) ? fail('workPacketResultStatus', ['dynamic_workflow_overused']) : pass('workPacketResultStatus');
}

export function buildIntegrationConflictReport(input = {}) {
  return bool(input.conflict) ? fail('integrationConflictStatus', ['worker_file_ownership_conflict_v2']) : pass('integrationConflictStatus');
}

export function buildAdversarialReviewReport(input = {}) {
  return bool(input.missing) ? fail('adversarialReviewStatus', ['dynamic_workflow_overused']) : pass('adversarialReviewStatus');
}

export function buildVerificationFanInReport(input = {}) {
  return hasAny(input, ['conflictingPacketResults', 'evidenceMissing', 'scopeLeak'])
    ? fail('verificationFanInStatus', ['dynamic_workflow_overused'])
    : pass('verificationFanInStatus');
}

export function buildWorkflowResumeCheckpointReport(input = {}) {
  return bool(input.checkpointMissing) ? fail('workflowResumeCheckpointStatus', ['dynamic_workflow_overused']) : pass('workflowResumeCheckpointStatus');
}

export function buildWorkflowCostBudgetV103Report(input = {}) {
  return bool(input.unboundedCost) ? fail('workflowCostBudgetStatus', ['dynamic_workflow_overused']) : pass('workflowCostBudgetStatus');
}

export function buildWorkflowContextBudgetReport(input = {}) {
  return bool(input.contextOverflow) ? fail('workflowContextBudgetStatus', ['dynamic_workflow_overused']) : pass('workflowContextBudgetStatus');
}

export function buildWorkflowFinalReportReport(input = {}) {
  return bool(input.finalReportMissing) ? fail('workflowFinalReportStatus', ['dynamic_workflow_overused']) : pass('workflowFinalReportStatus');
}

export function buildFunkyRuntimeAdoptionSequenceReport(input = {}) {
  return bool(input.sequenceSkipped) ? fail('funkyRuntimeAdoptionSequenceStatus', ['dynamic_workflow_overused']) : pass('funkyRuntimeAdoptionSequenceStatus');
}

export function buildReceiptFetcherNoSecretPreflightReport(input = {}) {
  return hasAny(input, ['rpcEnvRead', 'providerCreated', 'rawReceiptStored', 'rawProviderErrorPrinted'])
    ? fail('receiptFetcherNoSecretPreflightStatus', ['remote_npm_truth_missing'])
    : pass('receiptFetcherNoSecretPreflightStatus');
}

export function buildStagingNoTxEvidenceReport(input = {}) {
  return hasAny(input, ['fundedTx', 'mintTx', 'governanceTx', 'privateKey', 'realRpcSecret', 'runtimeReadinessClaimed'])
    ? fail('stagingNoTxEvidenceStatus', ['contract_readiness_profile_missing'])
    : pass('stagingNoTxEvidenceStatus');
}

export function buildRuntimeReadinessBlockerDigestReport(input = {}) {
  return bool(input.readinessClaimedWithoutOracle)
    ? fail('runtimeReadinessBlockerDigestStatus', ['contract_readiness_profile_missing'])
    : pass('runtimeReadinessBlockerDigestStatus');
}

export function buildFunkySafeRowExportReport(input = {}) {
  return bool(input.unsafeFieldExported) ? fail('funkySafeRowExportStatus', ['remote_npm_truth_missing']) : pass('funkySafeRowExportStatus');
}

export function buildDatasetAuditV2SpecReport(input = {}) {
  return bool(input.runnerImplemented) ? fail('datasetAuditV2SpecStatus', ['implementation_deferred_not_respected']) : pass('datasetAuditV2SpecStatus');
}

export function buildGameToolAdapterFixturePackReport(input = {}) {
  return bool(input.runtimeImplemented) ? fail('gameToolAdapterFixturePackStatus', ['implementation_deferred_not_respected']) : pass('gameToolAdapterFixturePackStatus');
}

export function buildBelovedAvatarSafetyAuditSpecReport(input = {}) {
  return bool(input.runnerImplemented) ? fail('belovedAvatarSafetyAuditSpecStatus', ['implementation_deferred_not_respected']) : pass('belovedAvatarSafetyAuditSpecStatus');
}

export function buildVgcFunkyReleaseLadderReport(input = {}) {
  return bool(input.stageSkipped) ? fail('vgcFunkyReleaseLadderStatus', ['contract_readiness_profile_missing']) : pass('vgcFunkyReleaseLadderStatus');
}

export function buildV103SelfTestRegistrationReport(input = {}) {
  const reasons = [];
  if (!fs.existsSync('scripts/codex-v103-self-test.mjs') || bool(input.selfTestMissing)) reasons.push('v103_self_test_missing');
  if (!readText('scripts/codex-local-quality-gate.mjs')?.includes('v103SelfTestStatus')) reasons.push('v103_self_test_missing');
  if (!readText('CODEX_SOURCE_HARNESS_MANIFEST.json')?.includes('codex-v103-self-test.mjs')) reasons.push('v103_self_test_missing');
  return reasons.length ? fail('v103SelfTestStatus', reasons) : pass('v103SelfTestStatus');
}

export function buildDefaultV103Reports(context = {}) {
  const safeNextAction = context.safeNextAction || 'verify_source_pr_remote_gate';
  return {
    reasonSummaryFinalAggregationStatus: buildReasonSummaryFinalAggregationReport(),
    remoteNpmDiagnosticTruthStatus: buildRemoteNpmDiagnosticTruthReport(),
    localRemoteFailureDeltaClassifierStatus: buildLocalRemoteFailureDeltaClassifierReport(),
    productSurfaceRouterStatus: buildProductSurfaceRouterReport({ changedFiles: [], rootPackageExists: fs.existsSync('package.json'), multiSurfaceEvidence: true }),
    activeSelfTestArtifactSourceStatus: buildActiveSelfTestArtifactSourceReport(),
    prBodyGovernanceAutoRepairStatus: buildPrBodyGovernanceAutoRepairReport(),
    reviewEvidenceTaxonomyStatus: buildReviewEvidenceTaxonomyReport(),
    contractReadinessProfileStatus: buildContractReadinessProfileReport(),
    staleAuditInputStatus: buildStaleAuditInputReport(),
    githubEventPayloadFreshnessStatus: buildGithubEventPayloadFreshnessReport(),
    prBodyLiveFetchStatus: buildPrBodyLiveFetchReport(),
    safeArtifactHeadMatchStatus: buildSafeArtifactHeadMatchReport(),
    eventPayloadVsLivePrBodyDiffStatus: buildEventPayloadVsLivePrBodyDiffReport(),
    rerunUsesStaleEventPayloadStatus: buildRerunUsesStaleEventPayloadReport(),
    mergeReadinessReasonLadderStatus: buildMergeReadinessReasonLadderReport({ nextAction: safeNextAction }),
    codexActionBoundaryStatus: buildCodexActionBoundaryReport(),
    userManualWorkProhibitedStatus: buildUserManualWorkProhibitedReport(),
    safeNextActionPrecisionStatus: buildSafeNextActionPrecisionReport({ safeNextAction }),
    designOnlyPrStatus: buildDesignOnlyPrReport(),
    implementationDeferredStatus: buildImplementationDeferredReport(),
    fiveFiveLowModeStatus: buildFiveFiveLowModeReport(),
    dynamicWorkflowDecisionStatus: buildDynamicWorkflowDecisionReport(),
    workflowGoalContractStatus: buildWorkflowGoalContractReport({ goal: 'v103_source', doneCriteria: 'source_remote_gate_pass' }),
    workflowArtifactStatus: buildWorkflowArtifactReport(),
    workPacketSchemaStatus: buildWorkPacketSchemaReport(),
    workerRoleMatrixStatus: buildWorkerRoleMatrixReport(),
    workerFileOwnershipV2Status: buildWorkerFileOwnershipV2Report(),
    parallelWorkerBudgetStatus: buildParallelWorkerBudgetV103Report(),
    approvalGateStatus: buildApprovalGateReport(),
    simulatedSubagentFallbackStatus: buildSimulatedSubagentFallbackReport(),
    subagentRunnerAvailabilityStatus: buildSubagentRunnerAvailabilityReport(),
    workPacketResultStatus: buildWorkPacketResultReport(),
    integrationConflictStatus: buildIntegrationConflictReport(),
    adversarialReviewStatus: buildAdversarialReviewReport(),
    verificationFanInStatus: buildVerificationFanInReport(),
    workflowResumeCheckpointStatus: buildWorkflowResumeCheckpointReport(),
    workflowCostBudgetStatus: buildWorkflowCostBudgetV103Report(),
    workflowContextBudgetStatus: buildWorkflowContextBudgetReport(),
    workflowFinalReportStatus: buildWorkflowFinalReportReport(),
    funkyRuntimeAdoptionSequenceStatus: buildFunkyRuntimeAdoptionSequenceReport(),
    receiptFetcherNoSecretPreflightStatus: buildReceiptFetcherNoSecretPreflightReport(),
    stagingNoTxEvidenceStatus: buildStagingNoTxEvidenceReport(),
    runtimeReadinessBlockerDigestStatus: buildRuntimeReadinessBlockerDigestReport(),
    funkySafeRowExportStatus: buildFunkySafeRowExportReport(),
    datasetAuditV2SpecStatus: buildDatasetAuditV2SpecReport(),
    gameToolAdapterFixturePackStatus: buildGameToolAdapterFixturePackReport(),
    belovedAvatarSafetyAuditSpecStatus: buildBelovedAvatarSafetyAuditSpecReport(),
    vgcFunkyReleaseLadderStatus: buildVgcFunkyReleaseLadderReport(),
    v103SelfTestStatus: buildV103SelfTestRegistrationReport(),
  };
}

export function readV103Input(envName) {
  const candidates = [
    process.env.CODEX_V103_INPUT_JSON,
    envName ? process.env[`${envName}_INPUT_JSON`] : '',
  ];
  for (const text of candidates) {
    if (!text) continue;
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return { invalidInputJson: true };
    }
  }
  return {};
}

export function runV103GateCli(metaUrl, argvOne, builder, envName) {
  if (argvOne && fileURLToPath(metaUrl) === argvOne) {
    const report = builder(readV103Input(envName));
    writeJsonReport(report, envName);
    exitFor(report);
  }
}
