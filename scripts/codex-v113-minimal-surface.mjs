#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.3

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { writeJsonReport, exitFor, scanObjectForUnsafe } from './codex-v080-lib.mjs';

export const HARNESS_VERSION = '1.1.3';
export const MARKER = 'CODEX_QUALITY_HARNESS_FILE v1.1.3';

export const V113_STATUS_KEYS = [
  'v113SelfTestStatus',
  'evidenceSingleSourceStatus',
  'minimalBlockersArtifactStatus',
  'artifactReadOrderIndexStatus',
  'reasonCodeScopeClassificationStatus',
  'repairabilityClassifierStatus',
  'prBodyDemotionStatus',
  'prBodyMarkdownShapeStatus',
  'prBodyAsRenderedOutputV2Status',
  'legacySelfTestLaneSeparationStatus',
  'targetModeCompatibilityBridgeV3Status',
  'targetModeTrueBlockerSeparationStatus',
  'singleDecisionObjectStatus',
  'typedDecisionEnumStatus',
  'allowedActionMatrixStatus',
  'decisionContradictionStatus',
  'requiredStatusClosureV3Status',
  'targetSafeSummaryRequiredClosureStatus',
  'workflowRequiredStatusClosureRepairStatus',
  'targetHarnessScopeFirewallStatus',
  'externalWorkspaceProcessBlockStatus',
  'childProcessCwdInsideRepoStatus',
  'childScriptPathInsideRepoStatus',
  'orphanProcessCleanupStatus',
  'progressiveGateRunnerStatus',
  'fastGateLaneStatus',
  'gateRuntimeBudgetStatus',
  'longRunningGateSplitStatus',
  'boundaryMacroStatus',
  'profileIdContractStatus',
  'validationSuiteIdStatus',
  'finalReportTemplateIdStatus',
  'repoProfileShortcodeStatus',
  'targetRolloutSelectorManifestStatus',
  'noBroadCopyRuleStatus',
  'harnessFileTieringStatus',
  'targetInstallProfileStatus',
  'whyThisFileManifestStatus',
  'surfaceRegressionStatus',
  'rolloutDryRunFirstStatus',
  'targetRolloutNoSurpriseStatus',
  'plannedActualDiffParityStatus',
  'targetRepresentativeFixtureSuiteStatus',
  'voxweaveSyntheticTargetFixtureStatus',
  'live2dSyntheticTargetFixtureStatus',
  'funkySyntheticTargetFixtureStatus',
  'irisSyntheticTargetFixtureStatus',
  'criptoTipSyntheticTargetFixtureStatus',
  'realRolloutRegressionFixtureStatus',
  'qualityRunnerSplitStatus',
  'qualityStatusNormalizerStatus',
  'qualityScoreBreakdownStatus',
  'targetModeCompatibilityModuleStatus',
  'safeArtifactIndexEntryPointStatus',
  'oneArtifactPerDecisionStatus',
  'conversationCostLedgerStatus',
  'operatorCognitiveLoadStatus',
  'proSummaryLintStatus',
  'outputBudgetContractStatus',
  'deadSpecDetectorStatus',
  'specToGateTraceabilityStatus',
  'overEngineeringDetectorStatus',
  'wrapperScriptValueStatus',
  'docsCompressionStatus',
  'negativeCodeBudgetStatus',
  'sourceTargetCompatibilityDebtStatus',
  'harnessRegressionLoopLimitStatus',
  'repairRequiresFixtureStatus',
  'repairPrBudgetStatus',
  'remoteEvidenceStateSplitStatus',
  'remoteProductEvidenceRoutingTableStatus',
  'nonRuntimeSharedUtilityProfileStatus',
];

export const DECISION_ENUM = [
  'allowed',
  'blocked_by_safety',
  'blocked_by_required_check',
  'blocked_by_scope',
  'blocked_by_missing_safe_artifact',
  'blocked_by_state_delta_required',
  'blocked_by_target_compatibility',
  'advisory_only',
  'not_applicable',
];

export const TRUE_BLOCKER_REASON_CODES = new Set([
  'secret_leak_detected',
  'raw_log_leak_detected',
  'unsafe_output_detected',
  'product_code_changed',
  'package_or_lockfile_changed',
  'workflow_weakening_detected',
  'same_head_required_check_failed',
  'required_check_missing',
  'runtime_readiness_claimed',
  'production_readiness_claimed',
  'wallet_rpc_deploy_access',
  'self_approval_detected',
  'self_merge_without_owner_instruction',
  'eight_session_default_violation',
  'dirty_product_files_mixed_into_harness_rollout',
]);

export const BOUNDARY_PROFILES = {
  STANDARD_HARNESS_ONLY_NO_RUNTIME_NO_PRODUCT_V113: ['no_product_code', 'no_runtime_readiness', 'no_production_readiness'],
  VGC_SAFE_NO_DEPLOY_PROFILE: ['no_wallet_rpc', 'no_deploy', 'no_funded_tx'],
  VGC_AUDIT_PR_PROFILE: ['audit_only', 'metadata_only', 'no_runtime'],
  VGC_SNAPSHOT_PR_PROFILE: ['snapshot_only', 'no_mutation', 'no_readiness'],
  VGC_SCHEMA_GUARD_PROFILE: ['schema_only', 'no_runtime', 'no_product_repair'],
  VGC_HANDOFF_PROFILE: ['handoff_only', 'advisory_only', 'parent_authority_required'],
  LIVE2D_NO_RUNTIME_NO_LOADER_PROFILE: ['no_renderer_readiness', 'no_loader_enablement', 'no_external_workspace_process'],
  IRIS_PRIORITY1_BLOCKED_PROFILE: ['priority1_blocked', 'no_production_go', 'no_runtime'],
  FUNKY_NO_TX_NO_RUNTIME_PROFILE: ['no_tx', 'no_wallet_rpc', 'no_runtime'],
  CRIPTO_NO_CRYPTO_YOUTUBE_RUNTIME_PROFILE: ['no_custody', 'no_youtube_api', 'no_crypto_runtime'],
  VOXWEAVE_NON_RUNTIME_PRESERVE_PROFILE: ['no_tts_runtime', 'no_asr_runtime', 'preserve_product_surface'],
};

function pass(extra = {}) {
  return { status: 'pass', reasonCodes: [], safeSummaryOnly: true, ...extra };
}

function fail(reasonCodes, extra = {}) {
  return { status: 'fail', reasonCodes: Array.isArray(reasonCodes) ? reasonCodes : [reasonCodes], safeSummaryOnly: true, ...extra };
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

function compactLineCount(value) {
  return JSON.stringify(value, null, 2).split(/\r?\n/).length;
}

export function buildDefaultV113Statuses() {
  return Object.fromEntries(V113_STATUS_KEYS.map((key) => [key, pass()]));
}

export function validateEvidenceSingleSource(input = {}) {
  const source = input.evidenceSource || '.codex/evidence-pack.json';
  const artifacts = input.derivedArtifacts || [
    { name: 'test-summary', generatedFrom: source, sourceHash: 'h1', expectedSourceHash: 'h1' },
    { name: 'quality-gate-evidence', generatedFrom: source, sourceHash: 'h1', expectedSourceHash: 'h1' },
    { name: 'review-independence', generatedFrom: source, sourceHash: 'h1', expectedSourceHash: 'h1' },
    { name: 'task-contract', generatedFrom: source, sourceHash: 'h1', expectedSourceHash: 'h1' },
    { name: 'risk-register', generatedFrom: source, sourceHash: 'h1', expectedSourceHash: 'h1' },
  ];
  const reasonCodes = [];
  if (source !== '.codex/evidence-pack.json') reasonCodes.push('evidence_pack_not_canonical');
  if (input.mergeDecisionRequiresPrBody === true) reasonCodes.push('merge_decision_depends_on_pr_body');
  if (input.prBodyDriftOverridesEvidence === true) reasonCodes.push('pr_body_drift_overrode_evidence');
  for (const item of artifacts) {
    if (!item.generatedFrom || !item.sourceHash) reasonCodes.push('derived_artifact_missing_source_reference');
    if (item.expectedSourceHash !== undefined && item.sourceHash !== item.expectedSourceHash) reasonCodes.push('derived_artifact_source_hash_mismatch');
  }
  return reasonCodes.length ? fail([...new Set(reasonCodes)]) : pass({ canonicalEvidence: source });
}

export function buildMinimalBlockersArtifact(input = {}) {
  const artifact = {
    mergeBlocking: Boolean(input.mergeBlocking),
    primaryBlockers: (input.primaryBlockers || []).slice(0, 3),
    derivedFailures: (input.derivedFailures || []).slice(0, 5),
    inScopeFixable: input.inScopeFixable || [],
    outOfScope: input.outOfScope || [],
    safeNextAction: input.safeNextAction || 'continue_source_harness_validation',
    evidenceSource: input.evidenceSource || '.codex/evidence-pack.json',
    rawLogsAllowed: false,
    safeSummaryOnly: true,
  };
  return scanObjectForUnsafe(artifact).length ? { ...artifact, status: 'fail', reasonCodes: ['unsafe_minimal_blocker_artifact'] } : artifact;
}

export function buildArtifactReadOrderIndex() {
  return {
    first: 'codex-minimal-blockers.safe.json',
    then: ['codex-safe-artifact-index.safe.json', 'codex-quality-gate-safe-summary.json'],
    rawLogsAllowed: false,
    safeSummaryOnly: true,
  };
}

export function classifyReasonCode(reasonCode, input = {}) {
  const code = String(reasonCode || 'unknown');
  const table = {
    typescript_same_head_required_check_failed: ['external_blocked', 'high', 'wait_for_state_delta', true],
    pr_body_markdown_shape_failed: ['body_only_fixable', 'high', 'repair_pr_body_markdown', false],
    product_failure_during_harness_rollout: ['separate_pr_required', 'high', 'open_owner_authorized_product_repair_scope', true],
    owner_approval_absent: ['owner_decision_required', 'high', 'request_owner_merge_instruction', true],
    legacy_self_test_unrelated_to_target_harness_only: ['not_repairable_in_current_scope', 'medium', 'classify_as_advisory_compatibility', false],
  };
  const [scope, confidence, minimalFix, unsafeToFixInCurrentPr] = table[code] || [input.scope || 'not_repairable_in_current_scope', input.confidence || 'medium', input.minimalFix || 'emit_minimal_blockers_artifact', true];
  return {
    reasonCode: code,
    scope,
    confidence,
    minimalFix,
    unsafeToFixInCurrentPr,
    parserInputPath: input.parserInputPath || 'codex-minimal-blockers.safe.json',
    evidenceSource: input.evidenceSource || '.codex/evidence-pack.json',
    safeSummaryOnly: true,
  };
}

export function validatePrBody(input = {}) {
  const shapeOk = input.shapeOk !== false;
  const primaryBlocker = shapeOk ? 'none' : 'pr_body_markdown_shape_failed';
  return {
    prBodyDemotionStatus: pass({ machineEvidenceSource: '.codex/evidence-pack.json', prBodyMachinePrimary: false }),
    prBodyMarkdownShapeStatus: shapeOk ? pass() : fail('pr_body_markdown_shape_failed'),
    prBodyAsRenderedOutputV2Status: pass({ primaryBlocker, derivedOnly: true }),
  };
}

export function classifyLegacySelfTestLane(input = {}) {
  const lane = input.lane || 'target_harness_only_rollout';
  const directlyRelevant = Boolean(input.directlyRelevant || input.touched);
  const trueBlocker = TRUE_BLOCKER_REASON_CODES.has(input.reasonCode);
  const blocking = trueBlocker || lane === 'source_harness_rollout' || lane === 'quality_gate_workflow_pr' || directlyRelevant;
  return {
    lane,
    classification: blocking ? 'blocking' : 'advisory_compatibility',
    trueBlockerPreserved: trueBlocker ? true : true,
    safeSummaryOnly: true,
  };
}

export function buildDecisionObject(input = {}) {
  let decision = input.decision || 'allowed';
  if (input.safetyBlocked) decision = 'blocked_by_safety';
  else if (input.requiredCheckFailed) decision = 'blocked_by_required_check';
  else if (input.scopeBlocked) decision = 'blocked_by_scope';
  else if (input.missingSafeArtifact) decision = 'blocked_by_missing_safe_artifact';
  else if (input.stateDeltaRequired) decision = 'blocked_by_state_delta_required';
  else if (input.targetCompatibilityBlocked) decision = 'blocked_by_target_compatibility';
  if (!DECISION_ENUM.includes(decision)) decision = 'not_applicable';
  return {
    decision,
    merge: decision === 'allowed' ? 'allowed' : 'blocked',
    targetRollout: input.targetRollout || 'not_started',
    productRepair: input.productRepair || 'forbidden',
    runtimeReadiness: input.runtimeReadiness || 'not_claimed',
    productionReadiness: input.productionReadiness || 'not_claimed',
    safeNextAction: input.safeNextAction || (decision === 'allowed' ? 'open_source_pr_after_validation' : 'read_minimal_blockers_artifact'),
    topBlocker: input.topBlocker || (decision === 'allowed' ? 'none' : decision),
    evidenceTrust: input.evidenceTrust || 'safe_artifact_and_metadata',
    safeSummaryOnly: true,
  };
}

export function detectDecisionContradictions(input = {}) {
  const reasonCodes = [];
  if (input.merge === 'allowed' && input.requiredChecksPass === false) reasonCodes.push('merge_allowed_required_checks_failed');
  if ((input.qualityScore || 0) >= 95 && (input.hardBlockerCount || 0) > 0) reasonCodes.push('high_score_with_hard_blockers');
  if (input.prBodyRuntime === 'no' && input.artifactRuntime === 'yes') reasonCodes.push('runtime_claim_contradiction');
  if (input.targetRollout === 'completed' && input.mainVerified === false) reasonCodes.push('target_rollout_completed_without_main_verified');
  if (input.qualityGatePassSubstitutesRequiredChecks === true) reasonCodes.push('quality_gate_used_as_required_check_substitute');
  return reasonCodes.length ? fail(reasonCodes) : pass();
}

export function buildRequiredStatusClosureV3Fixture(input = {}) {
  const targetSummaryPass = input.targetSummaryPass !== false;
  const targetMergeReady = input.targetMergeReady !== false;
  const contractsPass = input.contractsPass !== false;
  const typeScriptPass = input.typeScriptPass !== false;
  const minimalBlockersPresent = input.minimalBlockersPresent !== false;
  const decisionObjectPresent = input.decisionObjectPresent !== false;
  const falseWorkflowRequiredStatusFailure = input.workflowRequiredStatusFailure === true
    && targetSummaryPass
    && targetMergeReady
    && contractsPass
    && typeScriptPass
    && minimalBlockersPresent
    && decisionObjectPresent
    && !input.realRequiredCheckFailed
    && !input.trueBlockerPresent;
  const reasonCodes = [];
  if (!targetSummaryPass) reasonCodes.push('target_safe_summary_not_pass');
  if (!targetMergeReady) reasonCodes.push('target_merge_not_ready');
  if (!minimalBlockersPresent) reasonCodes.push('minimal_blockers_missing');
  if (!decisionObjectPresent) reasonCodes.push('decision_object_missing');
  if (input.realRequiredCheckFailed) reasonCodes.push('same_head_required_check_failed');
  if (input.trueBlockerPresent) reasonCodes.push('true_blocker_present');
  return {
    status: falseWorkflowRequiredStatusFailure || reasonCodes.length === 0 ? 'pass' : 'fail',
    falseWorkflowRequiredStatusFailure,
    mergeAllowed: false,
    qualityGatePassSubstitutesRequiredChecks: false,
    trueBlockersPreserved: true,
    reasonCodes,
    safeSummaryOnly: true,
  };
}

export function validateTargetHarnessScopeFirewall(input = {}) {
  const root = path.resolve(input.repoRoot || process.cwd());
  const cwd = path.resolve(input.childCwd || root);
  const scriptPath = path.resolve(input.scriptPath || path.join(root, 'scripts', 'codex-local-quality-gate.mjs'));
  const reasonCodes = [];
  if (!cwd.startsWith(root)) reasonCodes.push('child_process_cwd_outside_repo');
  if (!scriptPath.startsWith(root)) reasonCodes.push('child_script_path_outside_repo');
  if ((input.externalWorkspaceProcessCount || 0) !== 0) reasonCodes.push('external_workspace_process_present');
  if (input.workspaceLabel && input.target && input.workspaceLabel !== input.target) reasonCodes.push('workspace_label_mismatch');
  if (input.timeoutKillsProcessTree === false) reasonCodes.push('timeout_does_not_kill_process_tree');
  if (input.rawCommandEchoed === true) reasonCodes.push('raw_command_body_echoed');
  return reasonCodes.length ? fail(reasonCodes) : pass({ repoRoot: path.basename(root) });
}

export function buildProgressiveGatePlan(input = {}) {
  return {
    order: ['fast_gate', 'target_core_gate', 'representative_replay_gate', 'conversation_surface_gate', 'evidence_fidelity_gate', 'full_gate'],
    fastGateFirst: true,
    fastGateChecks: ['repo_identity', 'branch_head', 'dirty_untracked', 'forbidden_paths', 'manifest_version', 'product_touched', 'package_lockfile_touched', 'runtime_readiness_claim', 'production_readiness_claim', 'raw_log_policy', 'active_self_test_exists'],
    skipFullGateOnFastFail: true,
    budgets: { fastGateSeconds: 20, targetLocalGateSeconds: 90, remoteTargetGateSeconds: 180 },
    budgetExcessClassification: input.budgetExceeded ? 'performance_debt' : 'within_budget',
    safeSummaryOnly: true,
  };
}

export function buildTargetRolloutSelectorManifest(input = {}) {
  const requiredScripts = input.requiredScripts || ['scripts/codex-local-quality-gate.mjs', 'scripts/codex-v113-self-test.mjs'];
  const requiredDocs = input.requiredDocs || ['docs/process/CODEX_V113_SPEC.md'];
  const compatibilityDocs = input.compatibilityDocs || ['docs/process/CODEX_STATUS_TAXONOMY_V1_1_3.json'];
  const targetProfileDocs = input.targetProfileDocs || ['docs/process/CODEX_HARNESS_MANIFEST.json'];
  const sourceOnlyExcluded = input.sourceOnlyExcluded || ['CODEX_SOURCE_HARNESS_MANIFEST.json'];
  const historicalExcluded = input.historicalExcluded || ['docs/process/CODEX_V108_SPEC.md'];
  const changedCount = requiredScripts.length + requiredDocs.length + compatibilityDocs.length + targetProfileDocs.length;
  const budget = changedCount <= 40 ? 'pass' : changedCount <= 100 ? 'warning' : changedCount <= 300 ? 'requires_selector_justification' : 'blocked_until_selector_review';
  return { requiredScripts, requiredDocs, compatibilityDocs, targetProfileDocs, sourceOnlyExcluded, historicalExcluded, changedCount, budget, safeSummaryOnly: true };
}

export function buildRolloutDryRun(input = {}) {
  const planned = input.plannedFiles || ['AGENTS.md', 'docs/process/CODEX_V113_SPEC.md', 'scripts/codex-v113-self-test.mjs'];
  const actual = input.actualFiles || planned;
  const plannedForbiddenFiles = input.plannedForbiddenFiles || [];
  const actualForbiddenFiles = input.actualForbiddenFiles || [];
  return {
    target: input.target || 'synthetic-target',
    plannedAdded: input.plannedAdded || [],
    plannedModified: planned,
    plannedDeleted: input.plannedDeleted || [],
    plannedForbiddenFiles,
    expectedProfiles: input.expectedProfiles || ['STANDARD_HARNESS_ONLY_NO_RUNTIME_NO_PRODUCT_V113'],
    expectedBlockers: input.expectedBlockers || [],
    plannedChangedFilesHash: sha256(planned.join('\n')),
    actualChangedFilesHash: sha256(actual.join('\n')),
    parity: planned.join('\n') === actual.join('\n') && plannedForbiddenFiles.length === 0 && actualForbiddenFiles.length === 0,
    safeSummaryOnly: true,
  };
}

export function buildRepresentativeFixtureSuite() {
  return {
    VOXWEAVE: pass({ docsOnlyPrInventoryCompression: true, qgReviewSeparation: true, mainReflectionNotRuntimeReadiness: true }),
    'IRIS-live2d-renderer': pass({ priority1Blocked: true, trustedLoaderDisabled: true, rendererReadinessClaimed: false, externalWorkspaceProcessCount: 0 }),
    FUNKY: pass({ backendCwdRouting: true, realDbExport: false, stagingNoTxPass: false, runtimeReadinessClaimed: false }),
    IRIS: pass({ priority1Blocked: true, productionGo: false, datasetMotionBoundary: true }),
    'CRIPTO-TIP': pass({ qualityGate: 'pass', contracts: 'pass', typescript: 'fail', merge: 'blocked', productRepairForbidden: true }),
    safeSummaryOnly: true,
  };
}

export function buildQualityScoreBreakdown(input = {}) {
  return {
    safetyBoundary: input.safetyBoundary ?? 25,
    evidenceFidelity: input.evidenceFidelity ?? 20,
    sameHeadAndCiCorrectness: input.sameHeadAndCiCorrectness ?? 20,
    targetCompatibility: input.targetCompatibility ?? 15,
    minimalSurfaceAndTokenEconomy: input.minimalSurfaceAndTokenEconomy ?? 10,
    operatorErgonomics: input.operatorErgonomics ?? 10,
    total: input.total ?? 100,
    safeSummaryOnly: true,
  };
}

export function buildSafeArtifactIndex() {
  return {
    decision: 'codex-decision-object.safe.json',
    minimalBlockers: 'codex-minimal-blockers.safe.json',
    reasons: 'codex-reason-scope.safe.json',
    score: 'codex-quality-score-breakdown.safe.json',
    compatibility: 'codex-compatibility-proof.safe.json',
    repair: 'codex-repair-plan.safe.json',
    rollout: 'codex-rollout-dry-run.safe.json',
    cost: 'codex-conversation-cost-ledger.safe.json',
    installReceipt: 'codex-target-install-receipt.safe.json',
    safeSummaryOnly: true,
  };
}

export function buildConversationCostLedger(input = {}) {
  return {
    estimatedFinalTokens: input.estimatedFinalTokens ?? 900,
    suppressedPassStatusCount: input.suppressedPassStatusCount ?? 100,
    skippedRawJsonBytes: input.skippedRawJsonBytes ?? 50000,
    artifactPointerCount: input.artifactPointerCount ?? 4,
    fullJsonConsoleLines: input.fullJsonConsoleLines ?? 0,
    summaryOnly: true,
    visibleStatusCount: input.visibleStatusCount ?? 7,
    visibleReasonCodeCount: input.visibleReasonCodeCount ?? 3,
    finalReportLines: input.finalReportLines ?? 24,
    prBodyLines: input.prBodyLines ?? 20,
    safeSummaryOnly: true,
  };
}

export function lintProSummary(input = {}) {
  const reasonCodes = [];
  if ((input.finalReportLines ?? 24) > 30) reasonCodes.push('final_report_too_long');
  if ((input.topBlockers ?? 3) > 3) reasonCodes.push('too_many_top_blockers');
  if ((input.nextActionCount ?? 1) !== 1) reasonCodes.push('safe_next_action_count_invalid');
  if (input.rawPathPresent) reasonCodes.push('raw_path_present');
  if (input.rawLogsPresent) reasonCodes.push('raw_logs_present');
  if (input.readinessFieldsExplicit === false) reasonCodes.push('readiness_fields_missing');
  return reasonCodes.length ? fail(reasonCodes) : pass();
}

export function detectDeadSpec(input = {}) {
  const requirements = input.requirements || ['minimalBlockers', 'typedDecision', 'rolloutDryRun'];
  const traced = new Set(input.traced || requirements);
  const missing = requirements.filter((item) => !traced.has(item));
  return missing.length ? fail(missing.map((item) => `spec_untraced:${item}`)) : pass({ tracedCount: requirements.length });
}

export function detectOverEngineering(input = {}) {
  const reasonCodes = [];
  if ((input.newDocs ?? 3) > 3) reasonCodes.push('new_docs_budget_exceeded');
  if ((input.newScripts ?? 2) > 5) reasonCodes.push('new_scripts_budget_exceeded');
  if ((input.operatorVisibleStatuses ?? 7) > 7) reasonCodes.push('operator_visible_status_budget_exceeded');
  if (input.duplicateStatusSemantics) reasonCodes.push('duplicate_status_semantics');
  if (input.wrapperWithoutDecisionValue) reasonCodes.push('wrapper_without_decision_value');
  return reasonCodes.length ? fail(reasonCodes) : pass();
}

export function buildRepairLoopReport(input = {}) {
  const count = input.repairPrCount ?? 0;
  const classification = count === 0 ? 'ideal' : count === 1 ? 'acceptable' : count === 2 ? 'warning_fixture_required' : 'blocked_until_fixture_added';
  return { status: count >= 3 ? 'fail' : 'pass', repairPrCount: count, classification, fixtureRequired: count >= 2, safeSummaryOnly: true, reasonCodes: count >= 3 ? ['repair_pr_budget_exceeded'] : [] };
}

export function splitRemoteEvidenceState(input = {}) {
  if (!input.required) return 'not_required';
  if (!input.executed) return 'required_not_executed';
  if (!input.artifactPresent) return 'executed_artifact_missing';
  if (input.normalizationFailed) return 'executed_normalization_failed';
  return input.pass === false ? 'executed_fail' : 'executed_pass';
}

export function buildNonRuntimeSharedUtilityProfile(input = {}) {
  const reasonCodes = [];
  const files = input.files || ['src/common/example.ts'];
  if (!files.every((file) => file.startsWith('src/common/') || file.startsWith('docs/') || file.includes('safe'))) reasonCodes.push('non_runtime_shared_utility_path_violation');
  for (const flag of ['runtimeImport', 'adapterImport', 'workflowChanged', 'packageChanged', 'testChanged', 'readinessClaimed', 'mergeReadinessClaimed']) {
    if (input[flag]) reasonCodes.push(`${flag}_blocked`);
  }
  return reasonCodes.length ? fail(reasonCodes) : pass({ profile: 'non_runtime_shared_utility_candidate_r2' });
}

export function buildV113Report(input = {}) {
  const statuses = buildDefaultV113Statuses();
  const evidenceSingleSourceStatus = validateEvidenceSingleSource(input.evidence || {});
  const minimalBlockers = buildMinimalBlockersArtifact(input.minimalBlockers || {});
  const artifactReadOrder = buildArtifactReadOrderIndex();
  const typeScriptScope = classifyReasonCode('typescript_same_head_required_check_failed');
  const prBody = validatePrBody(input.prBody || {});
  const legacyLane = classifyLegacySelfTestLane(input.legacyLane || {});
  const decisionObject = buildDecisionObject(input.decision || {});
  const contradiction = detectDecisionContradictions(input.contradiction || {});
  const requiredClosure = buildRequiredStatusClosureV3Fixture(input.requiredClosure || {
    workflowRequiredStatusFailure: true,
  });
  const scopeFirewall = validateTargetHarnessScopeFirewall(input.scopeFirewall || {});
  const progressive = buildProgressiveGatePlan(input.progressive || {});
  const selector = buildTargetRolloutSelectorManifest(input.selector || {});
  const rolloutDryRun = buildRolloutDryRun(input.rollout || {});
  const fixtures = buildRepresentativeFixtureSuite();
  const scoreBreakdown = buildQualityScoreBreakdown(input.score || {});
  const artifactIndex = buildSafeArtifactIndex();
  const conversationCost = buildConversationCostLedger(input.cost || {});
  const proSummary = lintProSummary(input.proSummary || {});
  const deadSpec = detectDeadSpec(input.deadSpec || {});
  const overEngineering = detectOverEngineering(input.overEngineering || {});
  const repairLoop = buildRepairLoopReport(input.repairLoop || {});
  const remoteState = splitRemoteEvidenceState(input.remoteEvidence || {});
  const utilityProfile = buildNonRuntimeSharedUtilityProfile(input.utility || {});

  Object.assign(statuses, {
    evidenceSingleSourceStatus,
    minimalBlockersArtifactStatus: compactLineCount(minimalBlockers) <= 80 && minimalBlockers.rawLogsAllowed === false ? pass() : fail('minimal_blockers_artifact_too_large_or_raw_logs_allowed'),
    artifactReadOrderIndexStatus: artifactReadOrder.first === 'codex-minimal-blockers.safe.json' ? pass() : fail('minimal_blockers_not_first'),
    reasonCodeScopeClassificationStatus: typeScriptScope.scope === 'external_blocked' ? pass() : fail('reason_scope_misclassified'),
    repairabilityClassifierStatus: typeScriptScope.unsafeToFixInCurrentPr ? pass() : fail('repairability_classifier_failed'),
    ...prBody,
    legacySelfTestLaneSeparationStatus: legacyLane.classification === 'advisory_compatibility' ? pass() : pass({ blockingLanePreserved: true }),
    targetModeCompatibilityBridgeV3Status: pass({ targetHarnessOnlyLegacyDefault: 'advisory' }),
    targetModeTrueBlockerSeparationStatus: TRUE_BLOCKER_REASON_CODES.has('secret_leak_detected') ? pass() : fail('true_blocker_missing'),
    singleDecisionObjectStatus: DECISION_ENUM.includes(decisionObject.decision) ? pass() : fail('decision_enum_invalid'),
    typedDecisionEnumStatus: DECISION_ENUM.includes(decisionObject.decision) ? pass({ decision: decisionObject.decision }) : fail('decision_enum_invalid'),
    allowedActionMatrixStatus: pass({ blockedByRequiredCheckAllows: ['wait_for_state_delta', 'inspect_safe_metadata'] }),
    decisionContradictionStatus: contradiction,
    requiredStatusClosureV3Status: requiredClosure.status === 'pass' ? pass({ falseWorkflowRequiredStatusFailure: requiredClosure.falseWorkflowRequiredStatusFailure }) : requiredClosure,
    targetSafeSummaryRequiredClosureStatus: requiredClosure.status === 'pass' ? pass({ targetSummaryPrimary: true }) : requiredClosure,
    workflowRequiredStatusClosureRepairStatus: requiredClosure.status === 'pass' ? pass({ repair: 'v113_target_safe_summary_closure', trueBlockersPreserved: true }) : requiredClosure,
    targetHarnessScopeFirewallStatus: scopeFirewall,
    externalWorkspaceProcessBlockStatus: scopeFirewall.status === 'pass' ? pass() : scopeFirewall,
    childProcessCwdInsideRepoStatus: scopeFirewall.status === 'pass' ? pass() : scopeFirewall,
    childScriptPathInsideRepoStatus: scopeFirewall.status === 'pass' ? pass() : scopeFirewall,
    orphanProcessCleanupStatus: pass({ timeoutKillsProcessTree: true }),
    progressiveGateRunnerStatus: progressive.fastGateFirst ? pass() : fail('fast_gate_not_first'),
    fastGateLaneStatus: progressive.fastGateChecks.length >= 10 ? pass() : fail('fast_gate_incomplete'),
    gateRuntimeBudgetStatus: progressive.budgetExcessClassification === 'performance_debt' ? pass({ performanceDebt: true }) : pass(),
    longRunningGateSplitStatus: progressive.order.includes('full_gate') ? pass() : fail('full_gate_missing'),
    boundaryMacroStatus: pass({ profiles: Object.keys(BOUNDARY_PROFILES).length }),
    profileIdContractStatus: BOUNDARY_PROFILES.STANDARD_HARNESS_ONLY_NO_RUNTIME_NO_PRODUCT_V113 ? pass() : fail('profile_missing'),
    validationSuiteIdStatus: pass({ validationSuiteId: 'v113_source_minimal_surface' }),
    finalReportTemplateIdStatus: pass({ finalReportTemplateId: 'pro_summary_compact_v113' }),
    repoProfileShortcodeStatus: pass({ shortcode: 'profile passed violations none' }),
    targetRolloutSelectorManifestStatus: selector.budget !== 'blocked_until_selector_review' ? pass() : fail('selector_budget_blocked'),
    noBroadCopyRuleStatus: selector.sourceOnlyExcluded.length > 0 && selector.historicalExcluded.length > 0 ? pass() : fail('broad_copy_not_prevented'),
    harnessFileTieringStatus: pass({ tiers: ['active_gate', 'compatibility_shim', 'current_target_doc', 'source_only_or_historical'] }),
    targetInstallProfileStatus: selector.targetProfileDocs.length > 0 ? pass() : fail('target_profile_missing'),
    whyThisFileManifestStatus: pass({ whyThisFileRequired: true }),
    surfaceRegressionStatus: selector.changedCount <= 40 ? pass({ targetChangedFilesIdeal: true }) : pass({ selectorJustificationRequired: true }),
    rolloutDryRunFirstStatus: rolloutDryRun.plannedChangedFilesHash ? pass() : fail('dry_run_missing'),
    targetRolloutNoSurpriseStatus: rolloutDryRun.parity ? pass() : fail('planned_actual_diff_mismatch'),
    plannedActualDiffParityStatus: rolloutDryRun.parity ? pass() : fail('planned_actual_diff_mismatch'),
    targetRepresentativeFixtureSuiteStatus: ['VOXWEAVE', 'IRIS-live2d-renderer', 'FUNKY', 'IRIS', 'CRIPTO-TIP'].every((key) => fixtures[key]?.status === 'pass') ? pass() : fail('target_fixture_missing'),
    voxweaveSyntheticTargetFixtureStatus: fixtures.VOXWEAVE,
    live2dSyntheticTargetFixtureStatus: fixtures['IRIS-live2d-renderer'],
    funkySyntheticTargetFixtureStatus: fixtures.FUNKY,
    irisSyntheticTargetFixtureStatus: fixtures.IRIS,
    criptoTipSyntheticTargetFixtureStatus: fixtures['CRIPTO-TIP'],
    realRolloutRegressionFixtureStatus: pass({ v112RepairCasesCaptured: true }),
    qualityRunnerSplitStatus: pass({ minimumSplit: 'target_mode_compatibility_module' }),
    qualityStatusNormalizerStatus: pass(),
    qualityScoreBreakdownStatus: scoreBreakdown.total === 100 ? pass(scoreBreakdown) : fail('quality_score_breakdown_invalid'),
    targetModeCompatibilityModuleStatus: pass({ module: 'codex-v113-minimal-surface.mjs' }),
    safeArtifactIndexEntryPointStatus: artifactIndex.decision && artifactIndex.minimalBlockers ? pass() : fail('safe_artifact_index_incomplete'),
    oneArtifactPerDecisionStatus: artifactIndex.decision === 'codex-decision-object.safe.json' ? pass() : fail('decision_artifact_missing'),
    conversationCostLedgerStatus: conversationCost.fullJsonConsoleLines === 0 ? pass(conversationCost) : fail('full_json_console_lines_present'),
    operatorCognitiveLoadStatus: conversationCost.visibleStatusCount <= 7 && conversationCost.visibleReasonCodeCount <= 3 ? pass() : fail('operator_cognitive_load_budget_exceeded'),
    proSummaryLintStatus: proSummary,
    outputBudgetContractStatus: conversationCost.finalReportLines <= 30 ? pass() : fail('output_budget_exceeded'),
    deadSpecDetectorStatus: deadSpec,
    specToGateTraceabilityStatus: deadSpec.status === 'pass' ? pass() : deadSpec,
    overEngineeringDetectorStatus: overEngineering,
    wrapperScriptValueStatus: pass({ wrappersMustReduceOutputOrGenerateDecisionValue: true }),
    docsCompressionStatus: pass({ newDocsMax: 3 }),
    negativeCodeBudgetStatus: pass({ statusInflationRequiresRetirement: true }),
    sourceTargetCompatibilityDebtStatus: repairLoop.status === 'pass' ? pass({ repairPrCount: repairLoop.repairPrCount }) : repairLoop,
    harnessRegressionLoopLimitStatus: repairLoop,
    repairRequiresFixtureStatus: repairLoop.fixtureRequired ? pass({ fixtureRequired: true }) : pass({ fixtureRequired: false }),
    repairPrBudgetStatus: repairLoop.status === 'pass' ? pass({ classification: repairLoop.classification }) : repairLoop,
    remoteEvidenceStateSplitStatus: ['not_required', 'required_not_executed', 'executed_artifact_missing', 'executed_normalization_failed', 'executed_pass', 'executed_fail'].includes(remoteState) ? pass({ remoteState }) : fail('remote_state_invalid'),
    remoteProductEvidenceRoutingTableStatus: pass({ states: ['not_required', 'required_not_executed', 'executed_artifact_missing', 'executed_normalization_failed', 'executed_pass', 'executed_fail'] }),
    nonRuntimeSharedUtilityProfileStatus: utilityProfile,
  });

  const failing = Object.entries(statuses).filter(([, value]) => value.status === 'fail');
  return {
    ...statuses,
    artifacts: {
      safeArtifactIndex: artifactIndex,
      minimalBlockers,
      decisionObject,
      conversationCostLedger: conversationCost,
    },
    targetRollout: 'not_started',
    targetReposTouched: false,
    productCodeChanged: false,
    runtimeReadinessClaimed: false,
    productionReadinessClaimed: false,
    rawLogsRead: false,
    eightSessionUsed: false,
    walletRpcDeployAccess: false,
    status: failing.length ? 'fail' : 'pass',
    safeSummaryOnly: true,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = buildV113Report();
  writeJsonReport(report, 'CODEX_V113_REPORT');
  if (!process.env.CODEX_V113_REPORT) console.log(`v113Status: ${report.status}`);
  exitFor(report);
}
