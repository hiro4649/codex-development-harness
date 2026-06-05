#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor, readText } from './codex-v080-lib.mjs';

export function parseJson(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return { invalidInput: true }; }
}
export function parseBool(value) { return value === true || value === '1' || value === 'true' || value === 'yes'; }
export function parseList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || '').split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean);
}
function uniq(values) { return [...new Set((values || []).filter(Boolean))]; }
function safe(statusKey, status, payload = {}) {
  const out = simpleStatus(statusKey, status, { ...payload, reasonCodes: uniq(payload.reasonCodes), warnings: uniq(payload.warnings), safeSummaryOnly: true });
  return scanObjectForUnsafe(out).length ? simpleStatus(statusKey, 'fail', { reasonCodes: ['unsafe_value_detected'], safeSummaryOnly: true }) : out;
}
function notApplicable(statusKey, reasonCode) { return safe(statusKey, 'not_applicable', { reasonCodes: [reasonCode] }); }
function hasText(file, pattern) { const text = readText(file) || ''; return typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text); }
function activeStatusKeyFor(version) {
  const normalized = String(version || HARNESS_VERSION).replace(/\./g, '');
  return `v${normalized}SelfTestStatus`;
}
function activeSelfTestFileFor(version) {
  const normalized = String(version || HARNESS_VERSION).replace(/\./g, '');
  return `scripts/codex-v${normalized}-self-test.mjs`;
}
function defaultActiveStatusKey(version = HARNESS_VERSION) {
  const key = activeStatusKeyFor(version);
  return hasText('scripts/codex-local-quality-gate.mjs', key) ? key : 'missing';
}

export const REQUIRED_WORKFLOW_PRODUCT_STEPS = ['Prepare target product verification','remote product checks','remote product baseline','remote npm diagnostic','product verification evidence remote generation','safe artifact upload'];
export const REQUIRED_REMOTE_PRODUCT_ARTIFACTS = ['codex-remote-product-checks.safe.json','codex-remote-product-baseline.json','codex-product-verification-evidence.remote.json','codex-remote-npm-diagnostic.safe.json'];

export function buildActiveSelfTestRegistryReport(input = parseJson(process.env.CODEX_ACTIVE_SELF_TEST_REGISTRY_JSON) || {}) {
  const reasonCodes = [];
  const version = String(input.harnessVersion || HARNESS_VERSION);
  const expectedStatusKey = activeStatusKeyFor(version);
  const expectedSelfTestFile = activeSelfTestFileFor(version);
  const activeStatusKey = input.activeStatusKey || defaultActiveStatusKey(version);
  const selfTestFilePresent = input.selfTestFilePresent ?? fs.existsSync(expectedSelfTestFile);
  const manifestText = readText('CODEX_SOURCE_HARNESS_MANIFEST.json') || '';
  const manifestHasSelfTest = input.manifestHasSelfTest ?? manifestText.includes(expectedSelfTestFile.replace('scripts/', ''));
  const localGateHasStatus = input.localGateHasStatus ?? hasText('scripts/codex-local-quality-gate.mjs', expectedStatusKey);
  if (input.invalidInput) reasonCodes.push('active_self_test_registry_missing');
  if (activeStatusKey !== expectedStatusKey) reasonCodes.push('active_self_test_registry_missing');
  if (!parseBool(selfTestFilePresent)) reasonCodes.push('active_self_test_registry_missing');
  if (!parseBool(manifestHasSelfTest)) reasonCodes.push('active_self_test_registry_missing');
  if (!parseBool(localGateHasStatus)) reasonCodes.push('active_self_test_registry_missing');
  if (parseBool(input.legacyActive) || parseBool(input.legacyFailureBlockingActive)) reasonCodes.push('legacy_self_test_misclassified');
  return safe('activeSelfTestRegistryStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, activeStatusKey, registeredVersion: version });
}

export function buildWorkflowProductVerificationInvariantReport(input = parseJson(process.env.CODEX_WORKFLOW_PRODUCT_VERIFICATION_INVARIANT_JSON) || {}) {
  const reasonCodes = [];
  const workflowText = input.workflowText ?? readText('.github/workflows/quality-gate.yml') ?? '';
  const missingSteps = parseList(input.missingSteps);
  for (const step of REQUIRED_WORKFLOW_PRODUCT_STEPS) if (missingSteps.includes(step)) reasonCodes.push('workflow_product_verification_step_missing');
  if (parseBool(input.stepRemoved) || parseBool(input.prepareStepMissing) || (parseBool(input.forceWorkflowTextCheck) && !workflowText.includes('Prepare target product verification'))) reasonCodes.push('workflow_product_verification_step_missing');
  if (parseBool(input.remoteChecksBeforeGateMissing)) reasonCodes.push('workflow_product_verification_step_missing');
  const removedArtifacts = parseList(input.removedArtifacts);
  for (const artifact of REQUIRED_REMOTE_PRODUCT_ARTIFACTS) if (removedArtifacts.includes(artifact)) reasonCodes.push('remote_product_artifact_upload_missing');
  if (parseBool(input.remoteProductArtifactUploadRemoved) || parseBool(input.productEvidenceUploadRemoved)) reasonCodes.push('remote_product_artifact_upload_missing');
  if (parseBool(input.productRelevant) && parseBool(input.skipNpmOnly)) reasonCodes.push('skip_npm_product_bypass');
  if (parseBool(input.workflowDispatchSubstitute)) reasonCodes.push('workflow_dispatch_not_pr_substitute');
  return safe('workflowProductVerificationInvariantStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, requiredStepCount: REQUIRED_WORKFLOW_PRODUCT_STEPS.length, requiredArtifactCount: REQUIRED_REMOTE_PRODUCT_ARTIFACTS.length });
}

export function buildTargetHotfixRegressionReport(input = parseJson(process.env.CODEX_TARGET_HOTFIX_REGRESSION_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.targetRollout) && !parseBool(input.hotfixRelevant)) return notApplicable('targetHotfixRegressionStatus', 'target_hotfix_regression_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.patchManifestEntryMissing) || parseBool(input.expectedMarkerMissing) || parseBool(input.prepareProductVerificationRemoved) || parseBool(input.artifactUploadRemoved) || parseBool(input.targetSpecificWorkflowStepRemoved) || parseBool(input.productVerificationRouteRemoved)) reasonCodes.push('target_hotfix_regression_detected');
  return safe('targetHotfixRegressionStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildHarnessRolloutDiffRegressionReport(input = parseJson(process.env.CODEX_HARNESS_ROLLOUT_DIFF_REGRESSION_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.rolloutDiffRelevant)) return notApplicable('harnessRolloutDiffRegressionStatus', 'harness_rollout_diff_not_applicable');
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.workflowStepDeletedWithoutReason) || parseBool(input.productVerificationStepDeleted) || parseBool(input.artifactUploadPathDeleted) || parseBool(input.targetPatchManifestDiffLost) || parseBool(input.remoteBaselineGenerationPathDeleted) || parseBool(input.activeSelfTestMappingDeleted)) reasonCodes.push('harness_rollout_diff_regression_detected');
  if (parseBool(input.largeDocsBulkUpdate)) warnings.push('harness_rollout_diff_large_docs_update');
  return safe('harnessRolloutDiffRegressionStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildBlockerRootCauseClassifierReport(input = parseJson(process.env.CODEX_BLOCKER_ROOT_CAUSE_CLASSIFIER_JSON) || {}) {
  const reasonCodes = [];
  const rootCause = String(input.rootCause || 'none');
  if (parseBool(input.failurePresent) && (!input.rootCause || rootCause === 'none')) reasonCodes.push('blocker_root_cause_missing');
  if (parseBool(input.productEvidenceMissing) && rootCause === 'body_only_repair') reasonCodes.push('blocker_root_cause_missing');
  if (parseBool(input.workflowStepMissing) && rootCause === 'rerun') reasonCodes.push('blocker_root_cause_missing');
  if (parseBool(input.activeSelfTestRegistryMissing) && (rootCause === 'warning' || !rootCause)) reasonCodes.push('blocker_root_cause_missing');
  return safe('blockerRootCauseClassifierStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, rootCause });
}

export function buildLocalRemoteEvidencePhaseReport(input = parseJson(process.env.CODEX_LOCAL_REMOTE_EVIDENCE_PHASE_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !input.remoteEvidencePhase) return notApplicable('localRemoteEvidencePhaseStatus', 'local_remote_evidence_phase_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.beforePushRemoteMissingAsFailure) || parseBool(input.afterPushRemoteMissingPass) || parseBool(input.workflowDispatchEvidenceAsPr) || parseBool(input.productionReadinessClaimedWhilePending)) reasonCodes.push('local_remote_evidence_phase_conflict');
  return safe('localRemoteEvidencePhaseStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, phase: input.remoteEvidencePhase || 'local_pre_push_pass' });
}

export function buildStructuredSolvabilityReport(input = parseJson(process.env.CODEX_STRUCTURED_SOLVABILITY_JSON) || {}) {
  const reasonCodes = [];
  if (parseBool(input.localRemoteMixed) || parseBool(input.solvabilityConflict) || (parseBool(input.mergeReady) && String(input.remoteEvidencePhase || '') === 'pending') || (parseBool(input.productionReadinessClaimed) && !parseBool(input.oraclePresent)) || parseBool(input.proseOnlySolvability)) reasonCodes.push('structured_solvability_conflict');
  return safe('structuredSolvabilityStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, remoteEvidencePhase: input.remoteEvidencePhase || 'not_required' });
}

export function buildLive2DDatasetRowAuditReport(input = parseJson(process.env.CODEX_LIVE2D_DATASET_ROW_AUDIT_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.datasetRowRelevant)) return notApplicable('live2dDatasetRowAuditStatus', 'live2d_dataset_row_audit_not_applicable');
  const reasonCodes = [];
  const warnings = [];
  const required = ['row_id','dataset_version','split','source_hash','source_line','motion_label','expression_label','gaze_label','breath_label','body_label','camera_label','timing','intensity','recovery_plan','visibility_guard','comfort_guard','runtime_readiness_claimed'];
  if (parseBool(input.requireFields)) for (const field of required) if (!parseBool(input[field] ?? true)) reasonCodes.push('live2d_dataset_row_audit_failed');
  if (parseBool(input.rawPath) || parseBool(input.token) || parseBool(input.endpoint) || parseBool(input.rawCommand) || parseBool(input.candidate) || parseBool(input.worldCommand) || parseBool(input.futureLabelRuntimeExecutable) || parseBool(input.strongMotionWithoutRecovery) || parseBool(input.fixtureEvidenceMarkedRealReady) || parseBool(input.modelPathLeak) || parseBool(input.unsupportedCuePass)) reasonCodes.push('live2d_dataset_row_audit_failed');
  if (parseBool(input.timingTooLong) || parseBool(input.cooldownMissing) || parseBool(input.viewerComfortMissing) || parseBool(input.subtitleObstructionRisk)) warnings.push('live2d_dataset_row_needs_review');
  return safe('live2dDatasetRowAuditStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings, verdict: reasonCodes.length ? 'reject' : warnings.length ? 'needs_review' : 'pass' });
}

export function buildMotionAllowlistSyncReport(input = parseJson(process.env.CODEX_MOTION_ALLOWLIST_SYNC_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.motionRelevant)) return notApplicable('motionAllowlistSyncStatus', 'motion_allowlist_sync_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.futureLabelRuntimeExecutable) || parseBool(input.allowlistOutsideLabelPass) || parseBool(input.futurePhaseExecutable) || parseBool(input.unsupportedMotionNotRejected)) reasonCodes.push('motion_allowlist_sync_failed');
  return safe('motionAllowlistSyncStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildTrustedLoaderEvidenceReport(input = parseJson(process.env.CODEX_TRUSTED_LOADER_EVIDENCE_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.loaderRelevant) && !parseBool(input.rendererReady)) return notApplicable('trustedLoaderEvidenceStatus', 'trusted_loader_evidence_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.browserSelfAssertedReady) || parseBool(input.cubismCoreOnly) || parseBool(input.manifestOnly) || parseBool(input.assetRouteOnly) || parseBool(input.sseConnectedOnly) || parseBool(input.fakeLoaderFixture) || parseBool(input.staleHeartbeat) || parseBool(input.modelIdMismatch) || parseBool(input.sceneIdMismatch)) reasonCodes.push('trusted_loader_evidence_missing');
  if (parseBool(input.forceCheck) && !parseBool(input.allowlistedEvidence) && !parseBool(input.loaderEvidencePresent)) reasonCodes.push('trusted_loader_evidence_missing');
  return safe('trustedLoaderEvidenceStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, rendererReadyTrusted: !reasonCodes.length && (parseBool(input.allowlistedEvidence) || parseBool(input.loaderEvidencePresent)) });
}

export function buildLive2DEvidenceCollectorContractReport(input = parseJson(process.env.CODEX_LIVE2D_EVIDENCE_COLLECTOR_CONTRACT_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.live2dEvidenceRelevant)) return notApplicable('live2dEvidenceCollectorContractStatus', 'live2d_evidence_collector_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.rawCueIncluded) || parseBool(input.rawMotionCommandIncluded) || parseBool(input.rawModelPathIncluded) || parseBool(input.forbiddenValueIncluded)) reasonCodes.push('live2d_evidence_collector_contract_failed');
  if (parseBool(input.fixtureEvidenceMarkedReal) || parseBool(input.runtimeReadinessClaimedFromFixture) || parseBool(input.sameHeadMismatch)) reasonCodes.push('live2d_evidence_collector_contract_failed');
  return safe('live2dEvidenceCollectorContractStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildAvatarUxSafetyReport(input = parseJson(process.env.CODEX_AVATAR_UX_SAFETY_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.avatarUxRelevant)) return notApplicable('avatarUxSafetyStatus', 'avatar_ux_safety_not_applicable');
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.rapidFlashing) || parseBool(input.excessiveCameraShake) || parseBool(input.longCloseup) || parseBool(input.gameUiObstruction) || parseBool(input.surpriseScreamSpam) || parseBool(input.happyDanceSpam) || parseBool(input.donationScaledCloseup) || parseBool(input.romanticPressureCloseup) || parseBool(input.minorContextIntimateMotion)) reasonCodes.push('avatar_ux_safety_failed');
  if (parseBool(input.subtitleObstruction) || parseBool(input.gazePressure) || parseBool(input.motionCooldownFatigue)) warnings.push('avatar_ux_safety_needs_review');
  return safe('avatarUxSafetyStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildRuntimeLatencyMeasurementReport(input = parseJson(process.env.CODEX_RUNTIME_LATENCY_MEASUREMENT_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.latencyMeasurementRelevant)) return notApplicable('runtimeLatencyMeasurementStatus', 'runtime_latency_measurement_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.rawCueBodyIncluded) || parseBool(input.endpointIncluded) || parseBool(input.privatePathIncluded) || parseBool(input.tokenIncluded) || parseBool(input.rawBrowserLogIncluded) || parseBool(input.duplicateDeliveryUnsafe) || parseBool(input.queueDrainBeforeReady)) reasonCodes.push('runtime_latency_measurement_failed');
  return safe('runtimeLatencyMeasurementStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, metricCount: Number(input.metricCount || 0) });
}

export function buildBrowserSmokeJsonArtifactReport(input = parseJson(process.env.CODEX_BROWSER_SMOKE_JSON_ARTIFACT_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.browserSmokeRequired) && !parseBool(input.artifactPresent)) return notApplicable('browserSmokeJsonArtifactStatus', 'browser_smoke_json_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.requiredFieldsMissing) || (parseBool(input.forceCheck) && !parseBool(input.requiredFieldsPresent))) reasonCodes.push('browser_smoke_json_artifact_failed');
  if (parseBool(input.rawConsoleLogsIncluded) || parseBool(input.rawPayloadIncluded)) reasonCodes.push('browser_smoke_json_artifact_failed');
  if (parseBool(input.rendererReady) && !parseBool(input.trustedEvidencePresent)) reasonCodes.push('browser_smoke_json_artifact_failed');
  if (parseBool(input.sameHeadMismatch)) reasonCodes.push('browser_smoke_json_artifact_failed');
  return safe('browserSmokeJsonArtifactStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildOwnerDecisionDigestReport(input = parseJson(process.env.CODEX_OWNER_DECISION_DIGEST_JSON) || {}) {
  const reasonCodes = [];
  const required = parseBool(input.required) || parseBool(input.r3);
  if (required && !parseBool(input.digestPresent)) reasonCodes.push('owner_decision_digest_missing');
  if (parseBool(input.readinessClaimAmbiguous) || parseBool(input.residualRiskMissing) || parseBool(input.nextActionMissing) || (parseBool(input.longPrBody) && !parseBool(input.compactSummaryPresent))) reasonCodes.push('owner_decision_digest_missing');
  return safe('ownerDecisionDigestStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildObsoletePrAutoRecommendReport(input = parseJson(process.env.CODEX_OBSOLETE_PR_AUTO_RECOMMEND_JSON) || {}) {
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.obsoletePrMergeCandidate) || parseBool(input.reuseObsoletePr) || parseBool(input.oldPrMixedIntoCurrentRollout)) reasonCodes.push('obsolete_pr_reuse_forbidden');
  if (parseBool(input.obsoletePrOpen)) warnings.push('obsolete_pr_close_recommended');
  return safe('obsoletePrAutoRecommendStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildDatasetAuditV2SchemaReport(input = parseJson(process.env.CODEX_DATASET_AUDIT_V2_SCHEMA_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.datasetAuditRelevant)) return notApplicable('datasetAuditV2SchemaStatus', 'dataset_audit_v2_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.rawToken) || parseBool(input.endpoint) || parseBool(input.privatePath) || parseBool(input.candidate) || parseBool(input.worldCommand)) reasonCodes.push('dataset_audit_v2_schema_failed');
  if (parseBool(input.autoFixAllowed)) reasonCodes.push('dataset_audit_auto_fix_forbidden');
  if (parseBool(input.auditorSchemaMissing) || parseBool(input.privacyAuditorMissing) || parseBool(input.adapterBoundaryAuditorMissing) || parseBool(input.productionReadinessSweeteningAuditorMissing)) reasonCodes.push('dataset_audit_v2_schema_failed');
  return safe('datasetAuditV2SchemaStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildDatasetAuditRunnerReadinessReport(input = parseJson(process.env.CODEX_DATASET_AUDIT_RUNNER_READINESS_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.runnerRelevant)) return notApplicable('datasetAuditRunnerReadinessStatus', 'dataset_audit_runner_not_applicable');
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.runnerPlannedWithoutSchema) || parseBool(input.runnerPlannedWithAutoFix) || parseBool(input.runnerPlannedWithoutRedLines) || parseBool(input.runnerWouldExposeRawRows)) reasonCodes.push('dataset_audit_v2_schema_failed');
  if (parseBool(input.futureWork)) warnings.push('dataset_audit_runner_future_work');
  return safe('datasetAuditRunnerReadinessStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildGameToolAdapterContractFixtureV097Report(input = parseJson(process.env.CODEX_GAME_TOOL_ADAPTER_CONTRACT_FIXTURE_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.gameToolRelevant)) return notApplicable('gameToolAdapterContractFixtureStatus', 'game_tool_adapter_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.candidateDirectHandoff) || (!parseBool(input.approvedAction) && parseBool(input.handoffAttempted)) || parseBool(input.rawWorldCommandLeak) || parseBool(input.endpointLeak) || parseBool(input.tokenLeak) || parseBool(input.staleObservationCandidate) || parseBool(input.fixturePassMarkedRealReady)) reasonCodes.push('game_tool_adapter_contract_failed');
  return safe('gameToolAdapterContractFixtureStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildBelovedAvatarSafetyAuditV097Report(input = parseJson(process.env.CODEX_BELOVED_AVATAR_SAFETY_AUDIT_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.avatarRelevant)) return notApplicable('belovedAvatarSafetyAuditStatus', 'beloved_avatar_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.memoryPrivacyViolation) || parseBool(input.monetizationPressureUnsafe) || parseBool(input.personaClaimsPersistenceWithoutEvidence) || parseBool(input.parasocialDependencyEncouragement)) reasonCodes.push('beloved_avatar_safety_failed');
  return safe('belovedAvatarSafetyAuditStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function runV097GateCli(metaUrl, argvOne, builder, envName) {
  if (argvOne && fileURLToPath(metaUrl) === argvOne) {
    const report = builder();
    writeJsonReport(report, envName);
    exitFor(report);
  }
}
