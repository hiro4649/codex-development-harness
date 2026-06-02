#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor, readJson, readText } from './codex-v080-lib.mjs';

export function parseJson(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return { invalidInput: true }; }
}
export function parseBool(value) { return value === true || value === '1' || value === 'true' || value === 'yes'; }
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
function statusOf(value) { return value?.status || value?.productVerificationEvidenceStatus?.status || value?.remoteProductBaselineStatus?.status || value?.remoteNpmDiagnosticStatus?.status || ''; }
function isPassLike(value) { return ['pass', 'superseded_by_formal_evidence'].includes(statusOf(value)); }
function isFailLike(value) { return statusOf(value) === 'fail'; }
function isPlaceholder(value) {
  if (!value || typeof value !== 'object') return false;
  const type = String(value.evidenceType || value.baselineType || value.diagnosticType || '').toLowerCase();
  return value.placeholder === true || value.status === 'pending' || type === 'placeholder';
}
function parseChangeClassification(env = process.env) {
  const parsed = parseJson(env.CODEX_CHANGE_CLASSIFICATION_JSON);
  return parsed?.changeClassificationStatus || parsed || {};
}
function productRelevantFromInput(input, env = process.env) {
  if (input.productRelevant !== undefined) return parseBool(input.productRelevant);
  const classified = parseChangeClassification(env);
  return Boolean(classified.productRelevantChanged || classified.packageOrLockfileChanged || classified.runtimeReadinessClaimed);
}
function hasText(file, pattern) {
  const text = readText(file) || '';
  return typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text);
}
function activeSelfTestStatusKey(version) {
  const normalized = String(version || HARNESS_VERSION).replace(/\./g, '');
  return `v${normalized}SelfTestStatus`;
}
function activeSelfTestFile(version) {
  const normalized = String(version || HARNESS_VERSION).replace(/\./g, '');
  return `scripts/codex-v${normalized}-self-test.mjs`;
}

export function buildFormalEvidencePrecedenceReport(input = parseJson(process.env.CODEX_FORMAL_EVIDENCE_PRECEDENCE_JSON) || {}) {
  const productRelevant = productRelevantFromInput(input);
  const force = parseBool(input.forceCheck);
  const evidence = input.formalEvidence || input.productEvidence || parseJson(process.env.CODEX_PRODUCT_VERIFICATION_EVIDENCE_JSON) || readMaybeJson(input.evidencePath || process.env.CODEX_PRODUCT_VERIFICATION_EVIDENCE_PATH);
  const baseline = input.formalBaseline || input.remoteBaseline || parseJson(process.env.CODEX_REMOTE_PRODUCT_BASELINE_JSON) || readMaybeJson(input.baselinePath || process.env.CODEX_REMOTE_PRODUCT_BASELINE_PATH);
  const diagnostic = input.formalDiagnostic || input.remoteNpmDiagnostic || parseJson(process.env.CODEX_REMOTE_NPM_DIAGNOSTIC_JSON) || readMaybeJson(input.diagnosticPath || process.env.CODEX_NPM_TEST_SAFE_SUMMARY_PATH);
  if (!force && !productRelevant && !evidence && !baseline && !diagnostic) return notApplicable('formalEvidencePrecedenceStatus', 'formal_evidence_precedence_not_applicable');
  const reasonCodes = [];
  const evidencePresent = parseBool(input.formalEvidencePresent) || Boolean(evidence);
  const baselinePresent = parseBool(input.remoteBaselinePresent) || Boolean(baseline);
  const diagnosticPresent = parseBool(input.remoteNpmDiagnosticPresent) || Boolean(diagnostic);
  const sameHead = input.sameHeadMatch === undefined ? !parseBool(input.sameHeadMismatch) : parseBool(input.sameHeadMatch);
  const npmFailure = parseBool(input.npmFailure) || Number(input.npmExitCode ?? 0) !== 0 || Number(diagnostic?.npmExitCode ?? 0) !== 0;
  const formalPass = evidencePresent && baselinePresent && diagnosticPresent && isPassLike(evidence) && isPassLike(baseline) && isPassLike(diagnostic) && sameHead && !npmFailure;
  if (!evidencePresent || parseBool(input.productEvidenceMissing)) reasonCodes.push('formal_evidence_precedence_failed');
  if (!baselinePresent || parseBool(input.remoteBaselineMissing)) reasonCodes.push('formal_evidence_precedence_failed');
  if (!diagnosticPresent || parseBool(input.remoteNpmDiagnosticMissing)) reasonCodes.push('formal_evidence_precedence_failed');
  if (isFailLike(evidence) || isFailLike(baseline) || isFailLike(diagnostic) || parseBool(input.formalEvidenceFail)) reasonCodes.push('formal_evidence_precedence_failed');
  if (!sameHead) reasonCodes.push('same_head_evidence_refresh_failed');
  const placeholderSuperseded = formalPass && parseBool(input.placeholderSupersededByFormalEvidence);
  if ((isPlaceholder(evidence) || isPlaceholder(baseline) || isPlaceholder(diagnostic) || parseBool(input.placeholderUsedAsPass)) && !placeholderSuperseded) reasonCodes.push('placeholder_only_evidence_forbidden');
  if (parseBool(input.lifeboatOnly) || parseBool(input.lifeboatOnlyWithoutNormalSummary)) reasonCodes.push('lifeboat_only_pass_forbidden');
  if (input.normalSafeSummaryPresent === false || parseBool(input.normalSafeSummaryMissing)) reasonCodes.push('safe_artifact_bundle_completeness_failed');
  if (parseBool(input.targetSummaryMissing)) reasonCodes.push('target_quality_blocker_digest_missing');
  if (parseBool(input.reasonSummaryMissing)) reasonCodes.push('safe_artifact_bundle_completeness_failed');
  if (npmFailure) reasonCodes.push('remote_npm_diagnostic_normalization_failed');
  return safe('formalEvidencePrecedenceStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, productRelevant, formalEvidencePresent: evidencePresent, lifeboatMode: parseBool(input.standbyLifeboatPresent) ? 'standby' : 'none' });
}

export function buildLifeboatSemanticsReport(input = parseJson(process.env.CODEX_LIFEBOAT_SEMANTICS_JSON) || {}) {
  const reasonCodes = [];
  if (parseBool(input.normalBundleFailedBecauseLifeboatPresent)) reasonCodes.push('normal_bundle_lifeboat_standby_misclassified');
  if (parseBool(input.lifeboatOnly) || parseBool(input.lifeboatOnlyPass)) reasonCodes.push('lifeboat_only_pass_forbidden');
  if (parseBool(input.safeBundleMissing)) reasonCodes.push('lifeboat_semantics_failed');
  if (parseBool(input.realBlockerPresent) || parseBool(input.realBlockerHidden)) reasonCodes.push('lifeboat_semantics_failed');
  const state = parseBool(input.lifeboatOnly) ? 'lifeboat_only' : parseBool(input.standbyLifeboatPresent) ? 'normal_safe_bundle_present' : 'normal_safe_bundle_present';
  return safe('lifeboatSemanticsStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, state });
}

export function buildPlaceholderOnlyEvidenceReport(input = parseJson(process.env.CODEX_PLACEHOLDER_ONLY_EVIDENCE_JSON) || {}) {
  const productRelevant = productRelevantFromInput(input);
  const reasonCodes = [];
  const formalEvidencePresent = parseBool(input.formalEvidencePresent) || isPassLike(input.formalEvidence);
  if (productRelevant && !formalEvidencePresent && (parseBool(input.onlyPlaceholderEvidence) || parseBool(input.placeholderProductEvidence) || parseBool(input.placeholderBaseline) || parseBool(input.placeholderDiagnostic))) reasonCodes.push('placeholder_only_evidence_forbidden');
  if (parseBool(input.placeholderUsedForProductVerificationPass) || parseBool(input.placeholderBaselineUsedForBaselinePass) || parseBool(input.placeholderDiagnosticUsedAsFinalPass) || parseBool(input.manualConfirmationOverridesPlaceholderOnly)) reasonCodes.push('placeholder_only_evidence_forbidden');
  return safe('placeholderOnlyEvidenceStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, productRelevant, formalEvidencePresent });
}

export function buildRemoteNpmDiagnosticNormalizationReport(input = parseJson(process.env.CODEX_REMOTE_NPM_DIAGNOSTIC_NORMALIZATION_JSON) || {}) {
  const productRelevant = productRelevantFromInput(input);
  if (!parseBool(input.forceCheck) && !productRelevant) return notApplicable('remoteNpmDiagnosticNormalizationStatus', 'remote_npm_diagnostic_normalization_not_applicable');
  const reasonCodes = [];
  const npmExecuted = parseBool(input.npmExecuted);
  const npmExitCode = Number(input.npmExitCode ?? 0);
  if (productRelevant && !npmExecuted) reasonCodes.push('remote_npm_not_executed_for_product_pr');
  if (npmExitCode !== 0 || parseBool(input.npmFailMarkedPass)) reasonCodes.push('remote_npm_diagnostic_normalization_failed');
  if (parseBool(input.diagnosticPendingFinalPass) || parseBool(input.diagnosticMissingNoFormalEvidence) || parseBool(input.remoteNpmNotExecutedEmittedDespiteExecuted)) reasonCodes.push('remote_npm_diagnostic_normalization_failed');
  return safe('remoteNpmDiagnosticNormalizationStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, productRelevant, npmExecuted, npmExitCode });
}

export function buildLegacySelfTestAdvisoryReport(input = parseJson(process.env.CODEX_LEGACY_SELF_TEST_ADVISORY_JSON) || {}) {
  const reasonCodes = [];
  const version = String(input.harnessVersion || HARNESS_VERSION);
  const activeKey = input.activeStatusKey || activeSelfTestStatusKey(version);
  const activeFile = input.activeSelfTestFile || activeSelfTestFile(version);
  const filePresent = input.selfTestFilePresent ?? fs.existsSync(activeFile);
  const localGateHasStatus = input.localGateHasStatus ?? hasText('scripts/codex-local-quality-gate.mjs', activeKey);
  if (version === '0.9.9' && activeKey !== 'v099SelfTestStatus') reasonCodes.push('legacy_self_test_advisory_failed');
  if (!parseBool(filePresent) || !parseBool(localGateHasStatus)) reasonCodes.push('legacy_self_test_advisory_failed');
  if (parseBool(input.legacyFailureBlocksTargetQuality)) reasonCodes.push('legacy_self_test_advisory_failed');
  if (parseBool(input.activeV099Failure) || parseBool(input.activeFailureDowngraded)) reasonCodes.push('legacy_self_test_advisory_failed');
  return safe('legacySelfTestAdvisoryStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, activeStatusKey: activeKey, registeredVersion: version });
}

export function buildAuthSurfaceClassifierRefinementReport(input = parseJson(process.env.CODEX_AUTH_SURFACE_CLASSIFIER_REFINEMENT_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.authRelevant) && !parseBool(input.queryOnly) && !parseBool(input.actualAuthChange)) return notApplicable('authSurfaceClassifierRefinementStatus', 'auth_surface_classifier_not_applicable');
  const reasonCodes = [];
  const warnings = [];
  const classification = String(input.classification || (parseBool(input.queryOnly) ? 'query_filter_only' : parseBool(input.actualAuthChange) ? 'auth_surface' : 'unknown_requires_review'));
  if (parseBool(input.actualAuthChange) && classification !== 'auth_surface') reasonCodes.push('auth_surface_classifier_false_positive');
  if ((parseBool(input.tokenChange) || parseBool(input.sessionChange) || parseBool(input.adminChange) || parseBool(input.cookieChange) || parseBool(input.permissionChange)) && classification === 'query_filter_only') reasonCodes.push('auth_surface_classifier_false_positive');
  if (parseBool(input.queryOnly) && classification === 'auth_surface' && !parseBool(input.evidenceProvided)) reasonCodes.push('auth_surface_classifier_false_positive');
  if (classification === 'unknown_requires_review' && parseBool(input.securityFileAllowedWithoutReview)) reasonCodes.push('auth_surface_classifier_false_positive');
  if (parseBool(input.ambiguousSecurityWording)) warnings.push('auth_surface_manual_review_needed');
  return safe('authSurfaceClassifierRefinementStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings, classification });
}

export function buildTargetQualityBlockerDigestReport(input = parseJson(process.env.CODEX_TARGET_QUALITY_BLOCKER_DIGEST_JSON) || {}) {
  const reasonCodes = [];
  const targetFail = parseBool(input.targetQualityFail);
  const blockerClass = String(input.blockerClass || '');
  if (targetFail && !input.topBlocker) reasonCodes.push('target_quality_blocker_digest_missing');
  if (parseBool(input.productBlockerBodyOnly) || parseBool(input.remoteInfraAsProduct) || parseBool(input.legacyAdvisoryBlocking) || parseBool(input.unknownMergeReady)) reasonCodes.push('target_quality_blocker_digest_missing');
  if (targetFail && !['product','body','harness','manual','remote_infra','safe_artifact','legacy_advisory','classifier_false_positive','unknown'].includes(blockerClass)) reasonCodes.push('target_quality_blocker_digest_missing');
  return safe('targetQualityBlockerDigestStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, topBlocker: input.topBlocker || 'none', blockerClass: blockerClass || 'none', safeReasonCodes: Array.isArray(input.safeReasonCodes) ? input.safeReasonCodes.slice(0, 5) : [], nextAction: input.nextAction || 'continue_when_unblocked' });
}

export function buildPrEvidenceAutoRepairHintReport(input = parseJson(process.env.CODEX_PR_EVIDENCE_AUTO_REPAIR_HINT_JSON) || {}) {
  const reasonCodes = [];
  if (parseBool(input.bodyOnlyIssueCodeChangeRecommended) || parseBool(input.productFailureBodyOnly) || parseBool(input.staleEvidenceMergeReady)) reasonCodes.push('pr_evidence_auto_repair_hint_failed');
  return safe('prEvidenceAutoRepairHintStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, repairClass: input.repairClass || (parseBool(input.bodyOnlyIssue) ? 'body_only' : 'none'), safeSuggestedPatchOnly: true });
}

export function buildActionsBlockerRecoveryReport(input = parseJson(process.env.CODEX_ACTIONS_BLOCKER_RECOVERY_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !input.failureClass) return notApplicable('actionsBlockerRecoveryStatus', 'actions_blocker_recovery_not_applicable');
  const reasonCodes = [];
  const failureClass = String(input.failureClass || 'remote_quality_gate_unknown');
  const blockerClass = String(input.blockerClass || '');
  if (parseBool(input.billingClassifiedAsProduct) || (failureClass === 'remote_quality_gate_blocked_account_billing' && blockerClass === 'product')) reasonCodes.push('remote_infra_failure_misclassified_as_product');
  if (parseBool(input.productFailureClassifiedAsInfra)) reasonCodes.push('product_failure_misclassified_as_infra');
  if (parseBool(input.rerun404NoSafeAction) || parseBool(input.mergeAllowedWithoutSameHeadRemotePass) || parseBool(input.workflowDispatchUsedAsPrEvidence)) reasonCodes.push('actions_blocker_recovery_failed');
  return safe('actionsBlockerRecoveryStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, failureClass, safeAction: input.safeAction || 'block_merge_until_pass' });
}

export function buildPrContextRerunAssistantReport(input = parseJson(process.env.CODEX_PR_CONTEXT_RERUN_ASSISTANT_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !input.rerunContext) return notApplicable('prContextRerunAssistantStatus', 'pr_context_rerun_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.blindRerunForStaleHead) || parseBool(input.emptyCommitDespiteProductFailure) || parseBool(input.mergeAllowedAfterWorkflowDispatchOnly) || parseBool(input.prBodyHeadShaStaleAfterEmptyCommit)) reasonCodes.push('pr_context_rerun_assistant_failed');
  return safe('prContextRerunAssistantStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, safeAction: input.safeAction || 'wait_for_same_head_remote_pass' });
}

export function buildSameHeadEvidenceRefreshReport(input = parseJson(process.env.CODEX_SAME_HEAD_EVIDENCE_REFRESH_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.evidenceRefreshRelevant)) return notApplicable('sameHeadEvidenceRefreshStatus', 'same_head_refresh_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.headShaStale) || parseBool(input.baseShaStale) || parseBool(input.runIdStale) || parseBool(input.artifactIdStale) || parseBool(input.manualConfirmationStale) || parseBool(input.olderHeadEvidenceReused) || parseBool(input.sameHeadMismatchHiddenByBodyOnlyUpdate)) reasonCodes.push('same_head_evidence_refresh_failed');
  return safe('sameHeadEvidenceRefreshStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, refreshRequired: parseBool(input.refreshRequired) });
}

export function buildSafeArtifactBundleCompletenessReport(input = parseJson(process.env.CODEX_SAFE_ARTIFACT_BUNDLE_COMPLETENESS_JSON) || {}) {
  const productRelevant = productRelevantFromInput(input);
  const reasonCodes = [];
  if (parseBool(input.normalSafeSummaryMissing) || parseBool(input.targetFinalSummaryMissing) || parseBool(input.reasonSummaryMissing) || parseBool(input.safeArtifactIndexMissing) || parseBool(input.lifeboatOnlyPass) || parseBool(input.normalBundlePresentButUnchecked)) reasonCodes.push('safe_artifact_bundle_completeness_failed');
  if (productRelevant && (parseBool(input.productEvidenceMissing) || parseBool(input.remoteBaselineMissing) || parseBool(input.remoteNpmDiagnosticMissing))) reasonCodes.push('safe_artifact_bundle_completeness_failed');
  return safe('safeArtifactBundleCompletenessStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, productRelevant });
}

export function buildDatasetAuditV2P0SchemaReport(input = parseJson(process.env.CODEX_DATASET_AUDIT_V2_P0_SCHEMA_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.datasetAuditRelevant)) return notApplicable('datasetAuditV2P0SchemaStatus', 'dataset_audit_v2_p0_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.rawToken) || parseBool(input.endpoint) || parseBool(input.privatePath) || parseBool(input.candidateDirectExecution) || parseBool(input.adapterBoundaryViolation) || parseBool(input.fixtureMarkedProductionReady) || parseBool(input.evalDataContamination) || parseBool(input.autoFixAllowed) || input.classificationOnly === false) reasonCodes.push('dataset_audit_v2_p0_schema_failed');
  return safe('datasetAuditV2P0SchemaStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, classificationOnly: input.classificationOnly !== false });
}

export function buildGameToolAdapterFixtureReadinessReport(input = parseJson(process.env.CODEX_GAME_TOOL_ADAPTER_FIXTURE_READINESS_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.gameToolRelevant)) return notApplicable('gameToolAdapterFixtureReadinessStatus', 'game_tool_adapter_fixture_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.candidateDirectHandoff) || parseBool(input.approvedActionEvidenceMissing) || parseBool(input.rawWorldCommandLeak) || parseBool(input.endpointLeak) || parseBool(input.tokenLeak) || parseBool(input.staleObservationCandidate) || parseBool(input.fixturePassRealReady)) reasonCodes.push('game_tool_adapter_fixture_readiness_failed');
  return safe('gameToolAdapterFixtureReadinessStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildBelovedAvatarSafetyReadinessReport(input = parseJson(process.env.CODEX_BELOVED_AVATAR_SAFETY_READINESS_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.avatarSafetyRelevant)) return notApplicable('belovedAvatarSafetyReadinessStatus', 'beloved_avatar_safety_readiness_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.memoryPrivacyViolation) || parseBool(input.monetizationPressureUnsafe) || parseBool(input.personaPersistenceWithoutEvidence) || parseBool(input.parasocialDependencyEncouragement) || parseBool(input.exclusiveRelationshipPressure) || parseBool(input.minorContextIntimateBehavior)) reasonCodes.push('beloved_avatar_safety_readiness_failed');
  return safe('belovedAvatarSafetyReadinessStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function runV099GateCli(metaUrl, argvOne, builder, envName) {
  if (argvOne && fileURLToPath(metaUrl) === argvOne) {
    const report = builder();
    writeJsonReport(report, envName);
    exitFor(report);
  }
}
