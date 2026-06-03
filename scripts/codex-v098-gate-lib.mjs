#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor, readJson } from './codex-v080-lib.mjs';
import { classifyChange, changedFiles } from './codex-change-classification-gate.mjs';

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
function readMaybeJson(file) {
  if (!file) return null;
  const parsed = readJson(file);
  return parsed.ok ? parsed.value : null;
}
function evidencePathPresent(file) { return Boolean(file && fs.existsSync(file)); }
function inputPathOrEnv(input, field, envName, env = process.env) {
  return Object.prototype.hasOwnProperty.call(input, field) ? input[field] : env[envName];
}
function isPlaceholder(value) {
  if (!value || typeof value !== 'object') return false;
  const type = String(value.evidenceType || value.baselineType || value.diagnosticType || '').toLowerCase();
  return value.placeholder === true || value.status === 'pending' || type === 'placeholder';
}
function productRelevantFromInput(input, env = process.env) {
  if (input.productRelevant !== undefined) return parseBool(input.productRelevant);
  if (input.productRelevantChanged !== undefined) return parseBool(input.productRelevantChanged);
  const classified = classifyChange(changedFiles(env), env);
  return Boolean(classified.productRelevantChanged || classified.packageOrLockfileChanged || classified.runtimeReadinessClaimed);
}
function isPullRequest(input, env = process.env) {
  return parseBool(input.isPullRequest) || String(input.eventName || env.CODEX_EVENT_NAME || '') === 'pull_request' || Boolean(input.prNumber || env.CODEX_PR_NUMBER);
}
function targetMode(input, env = process.env) {
  return parseBool(input.targetRepoMode) || String(input.mode || env.CODEX_HARNESS_MODE || '') === 'target';
}

export function buildRemoteProductEvidenceExecutionReport(input = parseJson(process.env.CODEX_REMOTE_PRODUCT_EVIDENCE_EXECUTION_JSON) || {}) {
  const productRelevant = productRelevantFromInput(input);
  const pr = isPullRequest(input);
  const target = targetMode(input);
  if (!parseBool(input.forceCheck) && (!productRelevant || !pr || !target)) return notApplicable('remoteProductEvidenceExecutionStatus', 'remote_product_evidence_execution_not_required');
  const reasonCodes = [];
  const warnings = [];
  const skipNpm = input.skipNpm !== undefined ? parseBool(input.skipNpm) : process.env.CODEX_SKIP_NPM === '1';
  const npmExecuted = parseBool(input.npmExecuted) || process.env.CODEX_REMOTE_NPM_EXECUTED === '1';
  const evidencePath = inputPathOrEnv(input, 'evidencePath', 'CODEX_PRODUCT_VERIFICATION_EVIDENCE_PATH');
  const baselinePath = inputPathOrEnv(input, 'baselinePath', 'CODEX_REMOTE_PRODUCT_BASELINE_PATH');
  const diagnosticPath = inputPathOrEnv(input, 'diagnosticPath', 'CODEX_NPM_TEST_SAFE_SUMMARY_PATH');
  const evidence = input.evidence || readMaybeJson(evidencePath);
  const baseline = input.baseline || readMaybeJson(baselinePath);
  const diagnostic = input.diagnostic || readMaybeJson(diagnosticPath);
  if (productRelevant && skipNpm) reasonCodes.push('remote_npm_not_executed_for_product_pr');
  if (productRelevant && !npmExecuted) reasonCodes.push('remote_npm_not_executed_for_product_pr');
  if (productRelevant && !(parseBool(input.evidencePresent) || evidencePathPresent(evidencePath) || evidence)) reasonCodes.push('remote_product_evidence_execution_missing');
  if (productRelevant && !(parseBool(input.baselinePresent) || evidencePathPresent(baselinePath) || baseline)) reasonCodes.push('remote_product_evidence_execution_missing');
  if (productRelevant && !(parseBool(input.diagnosticPresent) || evidencePathPresent(diagnosticPath) || diagnostic)) reasonCodes.push('remote_product_evidence_execution_missing');
  if (isPlaceholder(evidence) || isPlaceholder(baseline) || isPlaceholder(diagnostic) || parseBool(input.pendingPlaceholderUsedAsPass)) reasonCodes.push('pending_placeholder_used_as_pass');
  if (productRelevant && (Number(input.npmExitCode ?? 0) !== 0 || evidence?.status === 'fail' || Number(diagnostic?.npmExitCode ?? 0) !== 0)) reasonCodes.push('remote_product_evidence_runner_failed');
  if (parseBool(input.manualConfirmationOverridesProductFail)) reasonCodes.push('manual_confirmation_overrode_product_verification');
  if (parseBool(input.workflowDispatchUsedAsPrEvidence) || String(input.eventName || '') === 'workflow_dispatch') reasonCodes.push('workflow_dispatch_not_pr_substitute');
  if (parseBool(input.qualityGateDoesNotReadEvidence)) reasonCodes.push('quality_gate_ignored_product_evidence');
  if (productRelevant && !parseBool(input.sameHeadEvidencePresent) && input.sameHeadEvidencePresent !== undefined) reasonCodes.push('same_head_artifact_missing');
  if (String(input.remoteEvidencePhase || '') === 'remote_evidence_pending_before_push') warnings.push('remote_evidence_pending_before_push');
  return safe('remoteProductEvidenceExecutionStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings, productRelevant, npmExecuted });
}

export function buildRemoteProductEvidenceRunnerReport(input = parseJson(process.env.CODEX_REMOTE_PRODUCT_EVIDENCE_RUNNER_JSON) || {}) {
  const productRelevant = productRelevantFromInput(input);
  if (!parseBool(input.forceCheck) && !productRelevant) return notApplicable('remoteProductEvidenceRunnerStatus', 'remote_product_evidence_runner_not_required');
  const reasonCodes = [];
  const npmExitCode = Number(input.npmExitCode ?? process.env.CODEX_NPM_EXIT_CODE ?? 0);
  const npmExecuted = parseBool(input.npmExecuted) || process.env.CODEX_REMOTE_NPM_EXECUTED === '1';
  const runnerStatus = npmExitCode === 0 ? 'pass' : 'fail';
  if (scanObjectForUnsafe(input).length || parseBool(input.rawLogsIncluded) || parseBool(input.rawStdoutIncluded) || parseBool(input.rawStderrIncluded)) reasonCodes.push('remote_product_evidence_runner_failed');
  if (productRelevant && !npmExecuted) reasonCodes.push('remote_npm_not_executed_for_product_pr');
  if (productRelevant && input.headSha === '') reasonCodes.push('remote_product_evidence_runner_failed');
  if (productRelevant && npmExitCode !== 0 && parseBool(input.reportedPass)) reasonCodes.push('remote_product_evidence_runner_failed');
  return safe('remoteProductEvidenceRunnerStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, productRelevant, npmExecuted, npmExitCode, runnerStatus });
}

export function buildRemoteProductSafeArtifacts(input = parseJson(process.env.CODEX_REMOTE_PRODUCT_EVIDENCE_RUNNER_JSON) || {}, env = process.env) {
  const productRelevant = productRelevantFromInput(input, env);
  const npmExitCode = Number(input.npmExitCode ?? env.CODEX_NPM_EXIT_CODE ?? (productRelevant ? 1 : 0));
  const npmExecuted = parseBool(input.npmExecuted) || env.CODEX_REMOTE_NPM_EXECUTED === '1' || productRelevant;
  const now = new Date();
  const headSha = String(input.headSha || env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || '').slice(0, 80);
  const baseSha = String(input.baseSha || env.CODEX_PR_BASE_SHA || '').slice(0, 80);
  const repository = String(input.repository || env.CODEX_REPOSITORY || '').slice(0, 120);
  const evidenceStatus = !productRelevant ? 'not_applicable' : npmExitCode === 0 ? 'pass' : 'fail';
  const failureClass = npmExitCode === 0 ? '' : String(input.failureClass || 'unknown_npm_failure').slice(0, 80);
  const command = String(input.command || 'npm test').slice(0, 80);
  const evidence = {
    schemaVersion: '0.8.3', harnessVersion: HARNESS_VERSION, headSha, baseSha,
    eventName: String(input.eventName || env.CODEX_EVENT_NAME || '').slice(0, 60),
    isPullRequest: isPullRequest(input, env), productRelevant, npmExecuted, npmExitCode,
    status: evidenceStatus, evidenceType: productRelevant ? 'remote_npm_test' : 'not_applicable',
    commands: productRelevant ? [{ name: command, required: true, result: evidenceStatus === 'pass' ? 'pass' : 'fail', source: 'remote', durationMs: null, testCount: null, safeSummary: evidenceStatus === 'pass' ? 'remote npm test completed' : 'remote npm test failed with safe diagnostic' }] : [],
    failureClass: failureClass || undefined, safeReasonCodes: failureClass ? [failureClass] : [],
    rawLogsIncluded: false, safeSummaryOnly: true,
  };
  const diagnostic = {
    schemaVersion: '0.8.3', harnessVersion: HARNESS_VERSION,
    npmExitCode: productRelevant ? npmExitCode : null,
    nodeMajor: Number(env.CODEX_NODE_MAJOR || process.versions.node.split('.')[0]),
    platform: String(input.platform || env.RUNNER_OS || process.platform || 'unknown').slice(0, 60),
    os: String(input.os || process.platform || 'unknown').slice(0, 60),
    packageManager: 'npm', commandClass: 'npm_test',
    safeFailureCategory: npmExitCode === 0 ? 'test_assertion_failure' : failureClass || 'unknown_npm_failure',
    safeMarkerCount: null, testCountDetected: null, durationMs: null, knownBaselineMatched: false,
    rawLogUploaded: false, rawValuesStored: false,
    diagnosticType: productRelevant ? 'remote_npm_diagnostic' : 'not_applicable', safeSummaryOnly: true,
  };
  const baseline = {
    schemaVersion: '0.8.3', harnessVersion: HARNESS_VERSION, repository, baseSha,
    baselineType: productRelevant ? 'remote_product_verification' : 'not_applicable',
    commands: productRelevant ? [command] : [], result: evidenceStatus === 'not_applicable' ? 'pass' : evidenceStatus,
    date: now.toISOString(), source: 'remote_workflow',
    safeSummary: productRelevant ? 'remote product baseline generated from safe npm result' : 'baseline not required for harness-only change',
    knownFailures: evidenceStatus === 'fail' ? [failureClass || 'unknown_npm_failure'] : [],
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    rawValuesStored: false, safeSummaryOnly: true,
  };
  return { evidence, diagnostic, baseline };
}

export function writeRemoteProductSafeArtifacts(input = parseJson(process.env.CODEX_REMOTE_PRODUCT_EVIDENCE_RUNNER_JSON) || {}, env = process.env) {
  const dir = env.CODEX_REMOTE_PRODUCT_EVIDENCE_OUT_DIR || env.RUNNER_TEMP || process.cwd();
  fs.mkdirSync(dir, { recursive: true });
  const artifacts = buildRemoteProductSafeArtifacts(input, env);
  fs.writeFileSync(path.join(dir, 'codex-product-verification-evidence.remote.json'), JSON.stringify(artifacts.evidence, null, 2));
  fs.writeFileSync(path.join(dir, 'codex-remote-product-baseline.json'), JSON.stringify(artifacts.baseline, null, 2));
  fs.writeFileSync(path.join(dir, 'codex-remote-npm-diagnostic.safe.json'), JSON.stringify(artifacts.diagnostic, null, 2));
  return artifacts;
}

export function buildProductEvidenceConsumptionReport(input = parseJson(process.env.CODEX_PRODUCT_EVIDENCE_CONSUMPTION_JSON) || {}) {
  const reasonCodes = [];
  const productRelevant = productRelevantFromInput(input);
  const evidence = input.productVerificationEvidenceStatus || parseJson(process.env.CODEX_PRODUCT_VERIFICATION_EVIDENCE_JSON) || null;
  const baseline = input.remoteProductBaselineStatus || parseJson(process.env.CODEX_REMOTE_PRODUCT_BASELINE_JSON) || null;
  const diagnostic = input.remoteNpmDiagnosticStatus || parseJson(process.env.CODEX_REMOTE_NPM_DIAGNOSTIC_JSON) || null;
  const evidenceGenerated = parseBool(input.evidenceGenerated) || Boolean(process.env.CODEX_PRODUCT_VERIFICATION_EVIDENCE_PATH);
  const baselineGenerated = parseBool(input.baselineGenerated) || Boolean(process.env.CODEX_REMOTE_PRODUCT_BASELINE_PATH);
  const diagnosticGenerated = parseBool(input.diagnosticGenerated) || Boolean(process.env.CODEX_NPM_TEST_SAFE_SUMMARY_PATH);
  if (parseBool(input.generatedButNotConsumed)) reasonCodes.push('product_evidence_not_consumed');
  if (evidenceGenerated && !evidence) reasonCodes.push('product_evidence_not_consumed');
  if (baselineGenerated && !baseline) reasonCodes.push('product_evidence_not_consumed');
  if (diagnosticGenerated && !diagnostic) reasonCodes.push('product_evidence_not_consumed');
  if (parseBool(input.qualityGateUsesPlaceholder) || parseBool(input.targetQualityScorePassWhileMissing) || parseBool(input.productVerificationEvidencePassWhileMissing)) reasonCodes.push('quality_gate_ignored_product_evidence');
  if (productRelevant && evidence?.productVerificationEvidenceStatus?.status === 'not_applicable') reasonCodes.push('product_evidence_not_consumed');
  return safe('productEvidenceConsumptionStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, productRelevant });
}

export function buildPlaceholderEvidenceForbiddenReport(input = parseJson(process.env.CODEX_PLACEHOLDER_EVIDENCE_FORBIDDEN_JSON) || {}) {
  const productRelevant = productRelevantFromInput(input);
  const reasonCodes = [];
  const evidence = input.evidence || readMaybeJson(input.evidencePath || process.env.CODEX_PRODUCT_VERIFICATION_EVIDENCE_PATH);
  const baseline = input.baseline || readMaybeJson(input.baselinePath || process.env.CODEX_REMOTE_PRODUCT_BASELINE_PATH);
  const diagnostic = input.diagnostic || readMaybeJson(input.diagnosticPath || process.env.CODEX_NPM_TEST_SAFE_SUMMARY_PATH);
  if (productRelevant && (isPlaceholder(evidence) || isPlaceholder(baseline) || isPlaceholder(diagnostic) || parseBool(input.placeholderUsedAsPass))) reasonCodes.push('placeholder_evidence_forbidden');
  if (parseBool(input.generatedBeforeNpmNoFinal)) reasonCodes.push('pending_placeholder_used_as_pass');
  return safe('placeholderEvidenceForbiddenStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, productRelevant });
}

export function buildLocalRemotePhaseStatusReport(input = parseJson(process.env.CODEX_LOCAL_REMOTE_PHASE_STATUS_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !input.remoteEvidencePhase) return notApplicable('localRemotePhaseStatus', 'local_remote_phase_not_applicable');
  const phase = String(input.remoteEvidencePhase || 'local_pre_push_pass');
  const reasonCodes = [];
  if (parseBool(input.beforePushRemoteMissingAsFailure) || parseBool(input.afterPushRemoteMissingPass) || parseBool(input.workflowDispatchEvidenceAsPr) || parseBool(input.mergeReadyWhilePending) || parseBool(input.productionReadinessClaimedWhilePending)) reasonCodes.push('local_remote_phase_conflict');
  if (phase === 'remote_evidence_required_after_push' && parseBool(input.remoteEvidenceMissing)) reasonCodes.push('remote_product_evidence_execution_missing');
  return safe('localRemotePhaseStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, phase });
}

export function buildStructuredSolvabilityFieldsReport(input = parseJson(process.env.CODEX_STRUCTURED_SOLVABILITY_FIELDS_JSON) || {}) {
  const reasonCodes = [];
  const required = ['localImplementationSolvability','externalServicesRequiredForLocalValidation','remoteEvidencePhase','mergeReadiness','productionReadinessClaimed','runtimeReadinessClaimed','priority1Status'];
  if (parseBool(input.requireFields)) for (const field of required) if (input[field] === undefined) reasonCodes.push('structured_solvability_field_conflict');
  if (parseBool(input.localRemoteMixed) || parseBool(input.solvabilityConflict) || (parseBool(input.mergeReady) && String(input.remoteEvidencePhase || '') === 'pending') || (parseBool(input.productionReadinessClaimed) && !parseBool(input.oraclePresent)) || (parseBool(input.runtimeReadinessClaimed) && !parseBool(input.runtimeArtifactPresent)) || (parseBool(input.priority1Relevant) && !input.priority1Status) || parseBool(input.proseOnlySolvability)) reasonCodes.push('structured_solvability_field_conflict');
  return safe('structuredSolvabilityFieldsStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, remoteEvidencePhase: input.remoteEvidencePhase || 'not_required' });
}

export function buildLive2DDatasetRowAuditRunnerReport(input = parseJson(process.env.CODEX_LIVE2D_DATASET_ROW_AUDIT_RUNNER_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.datasetRowRelevant)) return notApplicable('live2dDatasetRowAuditRunnerStatus', 'live2d_dataset_row_audit_runner_not_applicable');
  const reasonCodes = [];
  const warnings = [];
  const required = ['row_id','dataset_version','split','source_hash','source_line','motion_label','expression_label','gaze_label','breath_label','body_label','camera_label','timing','intensity','recovery_plan','visibility_guard','comfort_guard','adapter_validation_required','runtime_readiness_claimed'];
  if (parseBool(input.requireFields)) for (const field of required) if (!parseBool(input[field] ?? true)) reasonCodes.push('live2d_dataset_row_audit_runner_failed');
  if (parseBool(input.rowIdMissing) || parseBool(input.splitMissing) || parseBool(input.sourceHashMissing) || parseBool(input.runtimeAllowlistMismatch) || parseBool(input.strongMotionWithoutRecovery) || parseBool(input.rawPath) || parseBool(input.token) || parseBool(input.endpoint) || parseBool(input.rawCommand) || parseBool(input.candidate) || parseBool(input.worldCommand) || parseBool(input.fixtureMarkedRealReady)) reasonCodes.push('live2d_dataset_row_audit_runner_failed');
  if (parseBool(input.subtitleObstructionRisk) || parseBool(input.viewerComfortMissing)) warnings.push('live2d_dataset_row_needs_review');
  return safe('live2dDatasetRowAuditRunnerStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildMotionAllowlistDiffReport(input = parseJson(process.env.CODEX_MOTION_ALLOWLIST_DIFF_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.motionRelevant)) return notApplicable('motionAllowlistDiffStatus', 'motion_allowlist_diff_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.futureLabelRuntimeExecutable) || parseBool(input.unsupportedLabelPass) || parseBool(input.microReactionBeforePhase) || parseBool(input.motionPackSkipsTrustedLoaderGate) || parseBool(input.allowlistOutsideRendererImplementationPasses)) reasonCodes.push('motion_allowlist_diff_failed');
  return safe('motionAllowlistDiffStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildTrustedLoaderEvidenceEnforcerReport(input = parseJson(process.env.CODEX_TRUSTED_LOADER_EVIDENCE_ENFORCER_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.loaderRelevant) && !parseBool(input.rendererReady)) return notApplicable('trustedLoaderEvidenceEnforcerStatus', 'trusted_loader_evidence_enforcer_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.loaderKindUnknown) || parseBool(input.policyGateMissing) || parseBool(input.browserSelfAssertedReadyTrusted) || parseBool(input.cubismCoreOnlyReady) || parseBool(input.manifestOnlyReady) || parseBool(input.assetRouteOnlyReady) || parseBool(input.fakeLoaderFixtureReady) || parseBool(input.staleHeartbeatReady) || parseBool(input.modelIdMismatchIgnored) || parseBool(input.sceneIdMismatchIgnored)) reasonCodes.push('trusted_loader_evidence_enforcer_failed');
  return safe('trustedLoaderEvidenceEnforcerStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildAvatarUxSafetyRunnerReport(input = parseJson(process.env.CODEX_AVATAR_UX_SAFETY_RUNNER_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.avatarUxRelevant)) return notApplicable('avatarUxSafetyRunnerStatus', 'avatar_ux_safety_runner_not_applicable');
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.rapidFlashing) || parseBool(input.excessiveCameraShake) || parseBool(input.longCloseup) || parseBool(input.gameUiObstruction) || parseBool(input.surpriseScreamSpam) || parseBool(input.happyDanceSpam) || parseBool(input.donationScaledCloseup) || parseBool(input.romanticPressureCloseup) || parseBool(input.minorContextIntimateMotion)) reasonCodes.push('avatar_ux_safety_runner_failed');
  if (parseBool(input.subtitleObstruction) || parseBool(input.gazePressure) || parseBool(input.motionCooldownFatigue)) warnings.push('avatar_ux_safety_needs_review');
  return safe('avatarUxSafetyRunnerStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildRuntimeLatencySafeMetricReport(input = parseJson(process.env.CODEX_RUNTIME_LATENCY_SAFE_METRIC_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.latencyMetricRelevant)) return notApplicable('runtimeLatencySafeMetricStatus', 'runtime_latency_safe_metric_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.rawCueBodyIncluded) || parseBool(input.endpointIncluded) || parseBool(input.privatePathIncluded) || parseBool(input.tokenIncluded) || parseBool(input.rawBrowserLogIncluded) || parseBool(input.duplicateDeliveryUnsafe) || parseBool(input.queueDrainBeforeReady)) reasonCodes.push('runtime_latency_safe_metric_failed');
  return safe('runtimeLatencySafeMetricStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildBrowserSmokeVisualSafetyArtifactReport(input = parseJson(process.env.CODEX_BROWSER_SMOKE_VISUAL_SAFETY_ARTIFACT_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.browserSmokeRequired) && !parseBool(input.artifactPresent)) return notApplicable('browserSmokeVisualSafetyArtifactStatus', 'browser_smoke_visual_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.requiredFieldsMissing) || (parseBool(input.forceCheck) && !parseBool(input.requiredFieldsPresent))) reasonCodes.push('browser_smoke_visual_safety_artifact_failed');
  if (parseBool(input.rawConsoleLogsIncluded) || parseBool(input.rawPayloadIncluded)) reasonCodes.push('browser_smoke_visual_safety_artifact_failed');
  if (parseBool(input.rendererReady) && !parseBool(input.trustedEvidencePresent)) reasonCodes.push('browser_smoke_visual_safety_artifact_failed');
  if (parseBool(input.sameHeadMismatch)) reasonCodes.push('browser_smoke_visual_safety_artifact_failed');
  return safe('browserSmokeVisualSafetyArtifactStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildOpenPrRebaseReadinessReport(input = parseJson(process.env.CODEX_OPEN_PR_REBASE_READINESS_JSON) || {}) {
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.obsoletePrReused) || parseBool(input.oldBaseMergedWithoutCurrentHeadEvidence) || parseBool(input.productPrContinuesBeforeEvidenceFix) || parseBool(input.sameObjectiveNewerMergedOldMergeCandidate)) reasonCodes.push('open_pr_rebase_readiness_failed');
  if (parseBool(input.openPrStale) || parseBool(input.manualOwnerCleanupRecommended)) warnings.push('open_pr_rebase_or_close_recommended');
  return safe('openPrRebaseReadinessStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings, classification: input.classification || (warnings.length ? 'rebase_or_merge_main_needed' : 'safe_to_continue') });
}

export function buildFiveLineOwnerDigestReport(input = parseJson(process.env.CODEX_FIVE_LINE_OWNER_DIGEST_JSON) || {}) {
  const reasonCodes = [];
  if (parseBool(input.digestMissing) || parseBool(input.runtimeChangedAmbiguous) || parseBool(input.verificationMissing) || parseBool(input.blockersMissing) || parseBool(input.nextRiskMissing) || (parseBool(input.longPrBody) && !parseBool(input.fiveLineDigestPresent))) reasonCodes.push('five_line_owner_digest_missing');
  return safe('fiveLineOwnerDigestStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function runV098GateCli(metaUrl, argvOne, builder, envName, options = {}) {
  if (argvOne && fileURLToPath(metaUrl) === argvOne) {
    if (options.writeArtifacts && (process.argv.includes('--write-artifacts') || process.env.CODEX_REMOTE_PRODUCT_EVIDENCE_WRITE === '1')) writeRemoteProductSafeArtifacts();
    const report = builder();
    writeJsonReport(report, envName);
    exitFor(report);
  }
}
