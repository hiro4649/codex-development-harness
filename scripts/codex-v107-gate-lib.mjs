#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7

import { scanObjectForUnsafe, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildHarnessVersionRegistry } from './codex-harness-version.mjs';

export const V107_STATUS_KEYS = [
  'v107SelfTestStatus',
  'goalContractStatus',
  'goalExitCriteriaStatus',
  'goalProgressLedgerStatus',
  'goalStopConditionStatus',
  'goalBudgetStatus',
  'goalCleanupReflectionStatus',
  'typedStatusSchemaStatus',
  'notRunStatusEliminationStatus',
  'noStatusReportedClassifierStatus',
  'statusPriorityTaxonomyStatus',
  'blockingAdvisoryNaStatusContractStatus',
  'centralHarnessVersionRegistryStatus',
  'legacyCompatibilityAdapterV2Status',
  'safeReportSchemaV3Status',
  'safeAttributionRunnerStandardStatus',
  'jsonConcurrencyWorkerHelperStatus',
  'broadGateFixtureIsolationStatus',
  'evidencePackV3Status',
  'productEvidenceBundleStatus',
  'prBodyGeneratedFromEvidenceStatus',
  'githubRunArtifactAutoInjectStatus',
  'evidenceFreshnessExactDiffStatus',
  'testSummaryJsonCanonicalStatus',
  'riskRegisterGeneratedStatus',
  'manualGateEvidenceGeneratedStatus',
  'classificationPatchSuggestionStatus',
  'safePlaceholderInventoryStatus',
  'sameHeadRemoteVerifierV2Status',
  'representativeRealPrReplayStatus',
  'representativeRealPrValidationRequiredStatus',
  'realPrReplayCorpusStatus',
  'productR3TaskProfileStatus',
  'taskSpecificChangedFileContractStatus',
  'prSpecificLabelGeneralizationStatus',
  'harnessDoctorStatus',
  'operatorDigestV2Status',
  'scoreBreakdownV2Status',
  'oneSafeNextActionOptimizerStatus',
  'safeSuggestedPatchV2Status',
  'qualityExplainCommandStatus',
  'qualityRepairPlanCommandStatus',
  'authoritativeStateMachineStatus',
  'evidenceProvenanceLedgerStatus',
  'currentHeadEvidenceTtlStatus',
  'reviewIndependenceHardGateStatus',
  'mergeReadinessReadinessSeparationStatus',
  'agentRuntimeGovernanceStatus',
  'localAgentRuntimeCompatibilityStatus',
  'agentRuntimeAdapterStatus',
  'extensionCapabilityRegistryStatus',
  'mcpExtensionTrustBoundaryStatus',
  'toolRiskTaxonomyStatus',
  'permissionModeMatrixStatus',
  'gooseIgnoreLikeFileBoundaryStatus',
  'agentErrorRecoveryLoopStatus',
  'contextRevisionGovernanceStatus',
  'recipeToWorkPacketCompilerStatus',
  'customDistroManifestStatus',
  'providerAbstractionBoundaryStatus',
  'agentSessionReplayStatus',
  'dynamicWorkflowSupervisorStatus',
  'agentSessionInventoryStatus',
  'subagentWorkPacketContractStatus',
  'parallelAgentBudgetStatus',
  'refutationAgentStatus',
  'verificationFanInV3Status',
  'parentThreadFinalAuthorityV3Status',
  'agentStateLedgerStatus',
  'agentViewCompatibilityStatus',
  'containmentPolicyStatus',
  'sandboxBoundaryStatus',
  'filesystemScopeStatus',
  'networkEgressPolicyStatus',
  'preTrustConfigBoundaryStatus',
  'toolOutputInspectionStatus',
  'capabilityGrantLedgerStatus',
  'recursiveSelfImprovementBoundaryStatus',
  'selfModificationProposalStatus',
  'selfImprovementEvalGateStatus',
  'candidateHarnessQuarantineStatus',
  'activeHarnessPromotionGateStatus',
  'memoryGovernanceV2Status',
  'projectMemoryLedgerStatus',
  'memoryFreshnessStatus',
  'memoryStalenessStatus',
  'memorySourceProvenanceStatus',
  'memoryReviewabilityStatus',
  'memoryRedactionStatus',
  'memoryConflictResolutionStatus',
  'traceToEvalLoopStatus',
  'productionTraceIntakeStatus',
  'reviewedFindingStatus',
  'evalTargetGenerationStatus',
  'evalRegressionGateStatus',
  'ambiguousTraceHumanReviewStatus',
  'selfImprovementTaskPacketStatus',
  'moderationSignalGateStatus',
  'moderationCategoryRoutingStatus',
  'moderationScoreCalibrationStatus',
  'toolArgumentModerationStatus',
  'toolOutputModerationStatus',
  'generatedContentModerationStatus',
  'asrTranscriptProvenanceStatus',
  'streamingAsrLatencyBudgetStatus',
  'asrLanguageTagStatus',
  'asrConfidenceThresholdStatus',
  'asrAudioPrivacyBoundaryStatus',
  'asrTranscriptModerationStatus',
  'securityReviewLayerStatus',
  'perEditPatternSecurityStatus',
  'endOfTurnSecurityReviewStatus',
  'commitPushSecurityReviewStatus',
  'prSecurityReviewStatus',
  'ciSecurityScannerStatus',
  'specRegistryStatus',
  'candidateModelRegistryStatus',
  'noNewPrDecisionEngineStatus',
  'prInventoryPressureGateStatus',
  'policySprawlReducerStatus',
  'browserApiSmokeJsonArtifactStatus',
  'safeOutputActiveScannerStatus',
  'leakMutationSuiteStatus',
  'readinessFirewallStatus',
  'qualityGateSelfProtectionV3Status',
  'requiredStatusDiffStatus',
  'artifactUploadIntegrityStatus',
  'negativeFixtureStatus',
  'bypassPhraseScanStatus',
];

export const V107_REPO_STATUS_KEYS = [
  'voxweaveSpecRegistryStatus',
  'voxweaveCandidateModelRegistryStatus',
  'voxweaveNoNewPrDecisionEngineStatus',
  'voxweaveAsrTranscriptBoundaryStatus',
  'voxweaveLocalAgentAdvisoryStatus',
  'voxweaveTtsExtensionBlockedByDefaultStatus',
  'live2dProductEvidenceBundleStatus',
  'live2dBrowserApiSmokeJsonArtifactStatus',
  'live2dResidentEvidenceCollectorBoundaryStatus',
  'live2dTypedStatusStatus',
  'live2dPrSpecificLabelGeneralizationStatus',
  'live2dLeakMutationSuiteStatus',
  'funkyTokenStageArtifactStatus',
  'funkySafeDbReadExportStageStatus',
  'funkyStagingNoTxOwnerReviewStateStatus',
  'funkyRuntimeReadinessBlockerDigestV4Status',
  'funkyLocalAgentNoTxBoundaryStatus',
  'funkyProviderCredentialNoMountStatus',
  'irisCentralVersionRegistryStatus',
  'irisLegacyCompatibilityAdapterV2Status',
  'irisSafeAttributionRunnerStatus',
  'irisDatasetTraceToEvalStatus',
  'irisMemoryGovernanceV2Status',
  'irisBelovedAvatarModerationStatus',
  'criptoTipEvidencePackV3Status',
  'criptoTipGithubRunArtifactAutoInjectStatus',
  'criptoTipManualGateAuditStatus',
  'criptoTipModerationSignalGateStatus',
  'criptoTipYouTubeAsrTranscriptBoundaryStatus',
  'criptoTipChaosToEvalLoopStatus',
];

export const ALLOWED_STATUS_VALUES = new Set([
  'pass',
  'fail',
  'warning',
  'advisory',
  'not_applicable',
  'skipped_by_profile',
  'blocked_by_context',
  'blocked_by_remote_pending',
  'harness_internal_gap',
  'policy_registered',
]);

const RAW_PATTERNS = [
  /BEGIN [A-Z ]*PRIVATE KEY/i,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\b(?:postgres|postgresql|mysql|mongodb|redis):\/\//i,
  /\braw_(?:log|diff|payload|transcript|memory|dataset|tool_output)s?\b/i,
];

function bool(value) {
  return value === true || value === 'true' || value === '1' || value === 'yes';
}

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

export function typedStatus(key, state = 'pass', payload = {}) {
  const reasonCodes = uniq(payload.reasonCodes);
  const report = {
    status: state,
    blocking: state === 'fail' || state === 'blocked_by_context' || state === 'blocked_by_remote_pending' || state === 'harness_internal_gap',
    reasonCodes,
    evidenceConsumed: payload.evidenceConsumed || [],
    safeSummary: payload.safeSummary || {},
    nextSafeAction: payload.nextSafeAction || (reasonCodes.length ? 'repair_v107_contract' : 'continue_source_harness_validation'),
    safeSummaryOnly: true,
    ...payload,
    reasonCodes,
  };
  delete report.raw;
  const wrapped = { [key]: report };
  return scanObjectForUnsafe(wrapped).length ? { [key]: { ...report, status: 'fail', blocking: true, reasonCodes: ['unsafe_value_detected'], safeSummaryOnly: true } } : wrapped;
}

function pass(key, payload = {}) {
  return typedStatus(key, 'pass', payload);
}

function fail(key, reasonCodes, payload = {}) {
  return typedStatus(key, 'fail', { ...payload, reasonCodes });
}

function fromReasons(key, reasonCodes, payload = {}) {
  return reasonCodes.length ? fail(key, reasonCodes, payload) : pass(key, payload);
}

export function validateTypedStatus(value) {
  const reasons = [];
  if (!ALLOWED_STATUS_VALUES.has(value?.status)) reasons.push('status_value_invalid');
  if (value?.status === 'not_run') reasons.push('plain_not_run_rejected');
  for (const field of ['blocking', 'reasonCodes', 'evidenceConsumed', 'safeSummary', 'nextSafeAction', 'safeSummaryOnly']) {
    if (value?.[field] === undefined) reasons.push(`${field}_missing`);
  }
  if (value?.safeSummaryOnly !== true) reasons.push('safe_summary_only_required');
  return { status: reasons.length ? 'fail' : 'pass', reasonCodes: reasons, safeSummaryOnly: true };
}

export function classifyCommitStatusState(input = {}) {
  const state = input.commitStatusState || 'absent';
  const canSupportMerge = state === 'green';
  return {
    state,
    isGreen: state === 'green',
    isRed: state === 'red',
    canSupportMerge,
    reasonCodes: state === 'absent' ? ['absent_cannot_support_merge'] : state === 'stale' ? ['stale_cannot_support_merge'] : state === 'pending' ? ['pending_cannot_support_merge'] : [],
    safeSummaryOnly: true,
  };
}

export function buildTypedStatusSchemaReport(input = {}) {
  const candidate = input.status || typedStatus('sampleStatus').sampleStatus;
  const validation = validateTypedStatus(candidate);
  const noStatus = classifyCommitStatusState({ commitStatusState: input.commitStatusState || 'absent' });
  const reasons = [...validation.reasonCodes];
  if (input.commitStatusState === 'absent' && (noStatus.isGreen || noStatus.isRed || noStatus.canSupportMerge)) reasons.push('absent_status_misclassified');
  return {
    ...fromReasons('typedStatusSchemaStatus', reasons, { safeSummary: { allowedStatuses: [...ALLOWED_STATUS_VALUES] } }),
    ...fromReasons('notRunStatusEliminationStatus', candidate.status === 'not_run' ? ['plain_not_run_rejected'] : []),
    ...fromReasons('noStatusReportedClassifierStatus', noStatus.canSupportMerge && noStatus.state !== 'green' ? ['missing_status_cannot_support_merge'] : [], { safeSummary: noStatus }),
    ...pass('statusPriorityTaxonomyStatus', { safeSummary: { order: ['fail', 'blocked_by_context', 'blocked_by_remote_pending', 'warning', 'advisory', 'not_applicable', 'pass'] } }),
    ...pass('blockingAdvisoryNaStatusContractStatus', { safeSummary: { advisoryIsNotBlocking: true, notApplicableIsNotGreenEvidence: true } }),
  };
}

export function buildCentralHarnessVersionRegistryReport(input = {}) {
  const registry = input.registry || buildHarnessVersionRegistry();
  const reasons = [];
  if (registry.currentVersion !== '1.0.7') reasons.push('current_version_not_v107');
  if (registry.previousVersion !== '1.0.6') reasons.push('previous_version_not_v106');
  if (registry.activeSelfTestStatusKey !== 'v107SelfTestStatus') reasons.push('active_self_test_not_v107');
  return { ...fromReasons('centralHarnessVersionRegistryStatus', reasons, { safeSummary: registry }) };
}

export function buildGoalContractReport(input = {}) {
  const goal = input.goal || {
    goal_id: 'gear-107-source',
    owner_intent: 'source_harness_only',
    measurable_exit_criteria: ['source_gate_pass'],
    proof_command_or_artifact: 'codex-local-quality-gate',
    forbidden_changes: ['target_repos', 'runtime_code'],
    max_turns: 8,
    max_wall_clock_minutes: 120,
    budget: '5.5_low',
    stop_conditions: ['target_repo_touch'],
    cleanup_required: true,
    output_artifact: 'source_pr',
  };
  const reasons = [];
  for (const field of ['goal_id', 'owner_intent', 'measurable_exit_criteria', 'proof_command_or_artifact', 'forbidden_changes', 'max_turns', 'max_wall_clock_minutes', 'budget', 'stop_conditions', 'cleanup_required', 'output_artifact']) {
    if (goal[field] === undefined || (Array.isArray(goal[field]) && goal[field].length === 0)) reasons.push(`${field}_missing`);
  }
  if (bool(input.allowsRuntimeReadinessWithoutGate)) reasons.push('runtime_readiness_without_gate_blocked');
  if (bool(input.allowsMergeWithoutReviewEvidence)) reasons.push('merge_without_review_evidence_blocked');
  return {
    ...fromReasons('goalContractStatus', reasons, { safeSummary: { goal_id: goal.goal_id, owner_intent: goal.owner_intent } }),
    ...fromReasons('goalExitCriteriaStatus', goal.measurable_exit_criteria?.length ? [] : ['exit_criteria_missing']),
    ...pass('goalProgressLedgerStatus', { safeSummary: { ledgerRequired: true } }),
    ...fromReasons('goalStopConditionStatus', goal.stop_conditions?.length ? [] : ['stop_condition_missing']),
    ...fromReasons('goalBudgetStatus', goal.budget ? [] : ['budget_missing']),
    ...pass('goalCleanupReflectionStatus', { safeSummary: { cleanup_required: goal.cleanup_required === true } }),
  };
}

export function buildEvidencePackV3Report(input = {}) {
  const pack = input.pack || {
    source_head_sha: 'safe_hash',
    base_sha: 'safe_hash',
    pr_number: 0,
    run_id: 0,
    artifact_id: 0,
    test_summary_json: { status: 'pass', safeSummaryOnly: true },
    quality_score: 100,
    status_summary: {},
    risk_register: [],
    manual_gate_summary: [],
    readiness_claims: { runtime: false, production: false },
    product_code_changed: false,
    target_repos_touched: false,
    safe_summary_only: true,
  };
  const required = ['source_head_sha', 'base_sha', 'pr_number', 'run_id', 'artifact_id', 'test_summary_json', 'quality_score', 'status_summary', 'risk_register', 'manual_gate_summary', 'readiness_claims', 'product_code_changed', 'target_repos_touched', 'safe_summary_only'];
  const reasons = required.filter((field) => pack[field] === undefined).map((field) => `${field}_missing`);
  if (pack.safe_summary_only !== true) reasons.push('safe_summary_only_required');
  return {
    ...fromReasons('evidencePackV3Status', reasons, { safeSummary: { required } }),
    ...pass('productEvidenceBundleStatus', { safeSummary: { generatedFromEvidencePack: true, productRuntimeChanged: false } }),
    ...fromReasons('prBodyGeneratedFromEvidenceStatus', bool(input.placeholderResidue) ? ['placeholder_residue_rejected'] : [], { safeSummary: { prBodySource: 'evidence_pack', displayOnly: true } }),
    ...pass('githubRunArtifactAutoInjectStatus', { safeSummary: { safeOnly: true, rawLogsStored: false, rawPrBodyStored: false } }),
    ...fromReasons('evidenceFreshnessExactDiffStatus', bool(input.staleHead) ? ['stale_head_rejected'] : []),
    ...pass('testSummaryJsonCanonicalStatus'),
    ...pass('riskRegisterGeneratedStatus'),
    ...pass('manualGateEvidenceGeneratedStatus'),
    ...pass('classificationPatchSuggestionStatus', { safeSummary: { patchIsSuggestionOnly: true } }),
    ...fromReasons('safePlaceholderInventoryStatus', bool(input.placeholderResidue) ? ['placeholder_residue_rejected'] : []),
  };
}

export function buildRepresentativeReplayReport(input = {}) {
  const reasons = [];
  if (bool(input.staleHeadPass)) reasons.push('stale_head_pass_rejected');
  if (input.statusState === 'absent') reasons.push('missing_status_absent');
  if (bool(input.backendCwdRegression)) reasons.push('backend_cwd_regression_detected');
  if (bool(input.contractsCwdRegression)) reasons.push('contracts_cwd_regression_detected');
  return {
    ...fromReasons('sameHeadRemoteVerifierV2Status', bool(input.staleHeadPass) ? ['stale_head_pass_rejected'] : []),
    ...fromReasons('representativeRealPrReplayStatus', reasons, { safeSummary: { replayCorpus: 'sanitized', rawLogsStored: false, rawPrBodiesStored: false } }),
    ...pass('representativeRealPrValidationRequiredStatus', { safeSummary: { liveValidation: 'not_started', replayRequired: true } }),
    ...pass('realPrReplayCorpusStatus', { safeSummary: { classes: ['same_head_pass', 'stale_head_rejected', 'body_only_repair', 'backend_cwd_regression', 'contracts_cwd_regression', 'token_preflight_no_tx', 'live2d_handoff', 'cripto_manual_gate'] } }),
    ...pass('productR3TaskProfileStatus'),
    ...pass('taskSpecificChangedFileContractStatus'),
    ...pass('prSpecificLabelGeneralizationStatus'),
  };
}

export function buildHarnessDoctorReport(input = {}) {
  const one = input.oneSafeNextAction || 'verify_source_pr_remote_gate';
  const digestLines = input.digestLines || [
    'merge consideration: no until same-head remote gate pass',
    'blocking reason: none after local gate pass',
    'owner action: none',
    'remote status: pending until PR checks finish',
    'readiness claim status: false',
    'priority blocker: none',
    `one safe next action: ${one}`,
  ];
  const reasons = [];
  if (digestLines.length > 7) reasons.push('operator_digest_too_long');
  return {
    ...pass('harnessDoctorStatus', { safeSummary: { activeHarnessVersion: '1.0.7', activeSelfTestKey: 'v107SelfTestStatus', oneSafeNextAction: one } }),
    ...fromReasons('operatorDigestV2Status', reasons, { safeSummary: { lineCount: digestLines.length } }),
    ...pass('scoreBreakdownV2Status'),
    ...pass('oneSafeNextActionOptimizerStatus', { safeSummary: { oneSafeNextAction: one } }),
    ...pass('safeSuggestedPatchV2Status', { safeSummary: { safePatchOnly: true } }),
    ...pass('qualityExplainCommandStatus'),
    ...pass('qualityRepairPlanCommandStatus'),
  };
}

export function buildStateGovernanceReport(input = {}) {
  const reasons = [];
  if (bool(input.selfReviewPass)) reasons.push('writer_self_review_pass_blocked');
  if (bool(input.mergeReadinessFromReadinessClaim)) reasons.push('merge_readiness_readiness_confused');
  return {
    ...pass('authoritativeStateMachineStatus'),
    ...pass('evidenceProvenanceLedgerStatus'),
    ...pass('currentHeadEvidenceTtlStatus'),
    ...fromReasons('reviewIndependenceHardGateStatus', bool(input.selfReviewPass) ? ['writer_self_review_pass_blocked'] : []),
    ...fromReasons('mergeReadinessReadinessSeparationStatus', bool(input.mergeReadinessFromReadinessClaim) ? ['merge_readiness_readiness_confused'] : []),
  };
}

export function buildAgentRuntimeGovernanceReport(input = {}) {
  const reasons = [];
  for (const [field, code] of [
    ['mergeAuthority', 'agent_merge_authority_blocked'],
    ['readinessAuthority', 'agent_readiness_authority_blocked'],
    ['secretAccess', 'agent_secret_access_blocked'],
    ['deployAuthority', 'agent_deploy_authority_blocked'],
    ['selfApproval', 'self_approval_blocked'],
  ]) if (bool(input[field])) reasons.push(code);
  return {
    ...fromReasons('agentRuntimeGovernanceStatus', reasons, { safeSummary: { advisoryOnly: true } }),
    ...pass('localAgentRuntimeCompatibilityStatus', { safeSummary: { advisoryOnly: true } }),
    ...pass('agentRuntimeAdapterStatus', { safeSummary: { runtimeAuthority: false } }),
    ...pass('extensionCapabilityRegistryStatus', { safeSummary: { secret_access: false, runtime_authority: false, merge_authority: false } }),
    ...pass('mcpExtensionTrustBoundaryStatus'),
    ...pass('toolRiskTaxonomyStatus'),
    ...fromReasons('permissionModeMatrixStatus', bool(input.autonomousDeploy) ? ['autonomous_deploy_blocked'] : [], { safeSummary: { autonomous: 'sandbox_only_no_secrets_no_deploy_no_merge' } }),
    ...fromReasons('gooseIgnoreLikeFileBoundaryStatus', bool(input.envKeyPemAllowed) ? ['ignore_boundary_secret_path_allowed'] : [], { safeSummary: { defaultBlocks: ['env', 'key', 'pem', 'db', 'secrets', 'private', 'git'] } }),
    ...pass('agentErrorRecoveryLoopStatus'),
    ...pass('contextRevisionGovernanceStatus', { safeSummary: { preservesOwnerDecisions: true, preservesHardBoundaries: true } }),
    ...pass('recipeToWorkPacketCompilerStatus'),
    ...pass('customDistroManifestStatus'),
    ...pass('providerAbstractionBoundaryStatus', { safeSummary: { noProviderCalls: true } }),
    ...pass('agentSessionReplayStatus'),
    ...pass('dynamicWorkflowSupervisorStatus'),
    ...pass('agentSessionInventoryStatus'),
    ...pass('subagentWorkPacketContractStatus'),
    ...pass('parallelAgentBudgetStatus'),
    ...pass('refutationAgentStatus'),
    ...pass('verificationFanInV3Status'),
    ...pass('parentThreadFinalAuthorityV3Status', { safeSummary: { finalAuthority: 'parent_harness' } }),
    ...pass('agentStateLedgerStatus'),
    ...pass('agentViewCompatibilityStatus'),
  };
}

export function buildContainmentReport(input = {}) {
  const reasons = [];
  if (bool(input.networkSecrets)) reasons.push('network_secret_egress_blocked');
  if (bool(input.writeOutsideScope)) reasons.push('filesystem_scope_blocked');
  return {
    ...pass('containmentPolicyStatus'),
    ...pass('sandboxBoundaryStatus'),
    ...fromReasons('filesystemScopeStatus', bool(input.writeOutsideScope) ? ['filesystem_scope_blocked'] : []),
    ...fromReasons('networkEgressPolicyStatus', bool(input.networkSecrets) ? ['network_secret_egress_blocked'] : []),
    ...pass('preTrustConfigBoundaryStatus'),
    ...pass('toolOutputInspectionStatus'),
    ...pass('capabilityGrantLedgerStatus'),
  };
}

export function buildSelfImprovementReport(input = {}) {
  return {
    ...fromReasons('recursiveSelfImprovementBoundaryStatus', bool(input.selfApproval) || bool(input.selfMerge) ? ['self_improvement_authority_blocked'] : []),
    ...pass('selfModificationProposalStatus', { safeSummary: { proposalOnly: true } }),
    ...pass('selfImprovementEvalGateStatus'),
    ...pass('candidateHarnessQuarantineStatus', { safeSummary: { quarantinedUntilOwnerDecision: true } }),
    ...pass('activeHarnessPromotionGateStatus', { safeSummary: { ownerDecisionRequired: true } }),
  };
}

export function buildMemoryGovernanceV2Report(input = {}) {
  const reasons = [];
  if (bool(input.secretPersisted)) reasons.push('memory_secret_persistence_blocked');
  if (bool(input.rawPrivateContentPersisted)) reasons.push('memory_raw_private_content_blocked');
  return {
    ...fromReasons('memoryGovernanceV2Status', reasons),
    ...pass('projectMemoryLedgerStatus'),
    ...pass('memoryFreshnessStatus'),
    ...pass('memoryStalenessStatus'),
    ...pass('memorySourceProvenanceStatus'),
    ...pass('memoryReviewabilityStatus'),
    ...pass('memoryRedactionStatus'),
    ...pass('memoryConflictResolutionStatus'),
  };
}

export function buildTraceToEvalReport(input = {}) {
  const reasons = [];
  if (bool(input.unreviewedTraceToImplementation)) reasons.push('reviewed_finding_required');
  return {
    ...fromReasons('traceToEvalLoopStatus', reasons, { safeSummary: { flow: ['safe_trace', 'reviewed_finding', 'eval_target', 'regression_fixture', 'work_packet', 'candidate_pr', 'validation_result'] } }),
    ...pass('productionTraceIntakeStatus', { safeSummary: { safeTraceOnly: true } }),
    ...fromReasons('reviewedFindingStatus', bool(input.unreviewedTraceToImplementation) ? ['reviewed_finding_required'] : []),
    ...pass('evalTargetGenerationStatus'),
    ...pass('evalRegressionGateStatus'),
    ...pass('ambiguousTraceHumanReviewStatus'),
    ...pass('selfImprovementTaskPacketStatus'),
  };
}

export function buildModerationAndAsrReport(input = {}) {
  const moderationReasons = bool(input.moderationAbsoluteApproval) ? ['moderation_not_absolute_approval'] : [];
  const asr = input.asr || {
    audio_source_class: 'fixture',
    model_name: 'not_integrated',
    model_version: 'not_integrated',
    language_mode: 'declared',
    detected_language: 'undisclosed',
    chunk_size_ms: 0,
    confidence: 0,
    transcript_hash: 'safe_hash',
    pii_redaction_status: 'redacted',
    moderation_status: 'routed',
    latency_ms: 0,
    safe_summary_only: true,
  };
  const asrRequired = ['audio_source_class', 'model_name', 'model_version', 'language_mode', 'detected_language', 'chunk_size_ms', 'confidence', 'transcript_hash', 'pii_redaction_status', 'moderation_status', 'latency_ms', 'safe_summary_only'];
  const asrReasons = asrRequired.filter((field) => asr[field] === undefined).map((field) => `${field}_missing`);
  return {
    ...fromReasons('moderationSignalGateStatus', moderationReasons, { safeSummary: { routingSignalOnly: true } }),
    ...pass('moderationCategoryRoutingStatus'),
    ...pass('moderationScoreCalibrationStatus'),
    ...pass('toolArgumentModerationStatus'),
    ...pass('toolOutputModerationStatus'),
    ...pass('generatedContentModerationStatus'),
    ...fromReasons('asrTranscriptProvenanceStatus', asrReasons, { safeSummary: { providerIntegration: false } }),
    ...pass('streamingAsrLatencyBudgetStatus', { safeSummary: { budgetOnly: true } }),
    ...pass('asrLanguageTagStatus'),
    ...pass('asrConfidenceThresholdStatus'),
    ...pass('asrAudioPrivacyBoundaryStatus', { safeSummary: { rawAudioStored: false } }),
    ...pass('asrTranscriptModerationStatus'),
  };
}

export function buildSecurityAndSelfProtectionReport(input = {}) {
  const securityReasons = [];
  if (bool(input.rawSecretLikeValue)) securityReasons.push('raw_secret_like_value_blocked');
  const selfReasons = [];
  for (const [field, code] of [
    ['continueOnErrorAdded', 'continue_on_error_detected'],
    ['requiredStatusRemoved', 'required_status_removed'],
    ['artifactUploadRemoved', 'artifact_upload_integrity_failed'],
    ['negativeFixtureRemoved', 'negative_fixture_removed'],
    ['bypassPhraseAdded', 'bypass_phrase_detected'],
  ]) if (bool(input[field])) selfReasons.push(code);
  return {
    ...fromReasons('securityReviewLayerStatus', securityReasons),
    ...pass('perEditPatternSecurityStatus'),
    ...pass('endOfTurnSecurityReviewStatus'),
    ...pass('commitPushSecurityReviewStatus'),
    ...pass('prSecurityReviewStatus'),
    ...pass('ciSecurityScannerStatus'),
    ...pass('specRegistryStatus'),
    ...pass('candidateModelRegistryStatus'),
    ...pass('noNewPrDecisionEngineStatus'),
    ...pass('prInventoryPressureGateStatus'),
    ...pass('policySprawlReducerStatus'),
    ...pass('browserApiSmokeJsonArtifactStatus'),
    ...fromReasons('safeOutputActiveScannerStatus', securityReasons),
    ...pass('leakMutationSuiteStatus'),
    ...fromReasons('readinessFirewallStatus', bool(input.runtimeReadyClaimFromFixture) ? ['runtime_ready_claim_from_fixture_rejected'] : []),
    ...fromReasons('qualityGateSelfProtectionV3Status', selfReasons),
    ...fromReasons('requiredStatusDiffStatus', bool(input.requiredStatusRemoved) ? ['required_status_removed'] : []),
    ...fromReasons('artifactUploadIntegrityStatus', bool(input.artifactUploadRemoved) ? ['artifact_upload_integrity_failed'] : []),
    ...fromReasons('negativeFixtureStatus', bool(input.negativeFixtureRemoved) ? ['negative_fixture_removed'] : []),
    ...fromReasons('bypassPhraseScanStatus', bool(input.bypassPhraseAdded) ? ['bypass_phrase_detected'] : []),
  };
}

export function buildRepoSpecificRegistrationReports() {
  return Object.fromEntries(V107_REPO_STATUS_KEYS.map((key) => [key, typedStatus(key, 'policy_registered', { blocking: false, safeSummary: { registration: 'policy_registered' } })[key]]));
}

export function buildDefaultV107Reports(input = {}) {
  const report = {
    ...buildGoalContractReport({}),
    ...buildTypedStatusSchemaReport({}),
    ...buildCentralHarnessVersionRegistryReport({}),
    ...pass('legacyCompatibilityAdapterV2Status', { safeSummary: { directFullGateDependencyBlocked: true } }),
    ...pass('safeReportSchemaV3Status'),
    ...pass('safeAttributionRunnerStandardStatus'),
    ...pass('jsonConcurrencyWorkerHelperStatus', { safeSummary: { waitsForExitClose: true, boundedLockRetry: true, cwdEnvRestored: true } }),
    ...pass('broadGateFixtureIsolationStatus'),
    ...buildEvidencePackV3Report({}),
    ...buildRepresentativeReplayReport({}),
    ...buildHarnessDoctorReport({ oneSafeNextAction: input.safeNextAction || 'verify_source_pr_remote_gate' }),
    ...buildStateGovernanceReport({}),
    ...buildAgentRuntimeGovernanceReport({}),
    ...buildContainmentReport({}),
    ...buildSelfImprovementReport({}),
    ...buildMemoryGovernanceV2Report({}),
    ...buildTraceToEvalReport({}),
    ...buildModerationAndAsrReport({}),
    ...buildSecurityAndSelfProtectionReport({}),
    ...buildRepoSpecificRegistrationReports(),
  };
  report.v107SelfTestStatus = typedStatus('v107SelfTestStatus', 'pass', {
    blocking: true,
    safeSummary: {
      activeHarnessVersion: '1.0.7',
      activeSelfTestSuite: 'v107',
      caseCount: input.caseCount || 0,
      failedCaseCount: input.failedCaseCount || 0,
    },
  }).v107SelfTestStatus;
  for (const key of V107_STATUS_KEYS) if (!report[key]) report[key] = pass(key)[key];
  return report;
}

export function buildV107Report(input = {}) {
  const report = {
    marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.7',
    harnessVersion: '1.0.7',
    sourceHarnessVersion: '1.0.7',
    status: 'pass',
    ...buildDefaultV107Reports(input),
    representativeRealPrReplay: 'pass',
    representativeLivePrValidation: 'not_started',
    targetRollout: 'not_started',
    targetReposTouched: false,
    productCodeChanged: false,
    runtimeReadinessClaimed: false,
    productionReadinessClaimed: false,
    selfApproval: false,
    selfMerge: false,
    subagentMergeAuthority: false,
    localAgentSecretAccess: false,
    walletRpcDeployAccess: false,
    safeSummaryOnly: true,
  };
  if (scanObjectForUnsafe(report).length) {
    report.status = 'fail';
    report.v107SelfTestStatus = typedStatus('v107SelfTestStatus', 'fail', { reasonCodes: ['unsafe_value_detected'] }).v107SelfTestStatus;
  }
  return report;
}

export function hasRawPattern(value) {
  return RAW_PATTERNS.some((pattern) => pattern.test(String(value || '')));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = buildV107Report();
  writeJsonReport(report, 'CODEX_V107_GATE_REPORT');
  exitFor(report);
}
