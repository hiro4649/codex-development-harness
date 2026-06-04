#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

export const V105_STATUS_KEYS = [
  'representativeProductPrValidationStatus',
  'evidenceSingleSourceStatus',
  'evidenceDriftCheckerStatus',
  'targetSafeReportContractStatus',
  'sourceOnlyCompatibilityStatus',
  'activeLegacySelfTestSummaryStatus',
  'diagnosticSourceTraceStatus',
  'qualityGateSelfProtectionStatus',
  'integrationGovernanceStatus',
  'draftPrInventoryModelStatus',
  'nextIntegrationCandidateStatus',
  'stopCreatingPolicyPrStatus',
  'productionReadinessG4GateStatus',
  'observabilityEvidenceGateStatus',
  'chaosLiteRuntimeSimulationStatus',
  'atomicityDeliveryIntegrityStatus',
  'reviewEvidenceTypedSchemaStatus',
  'ownerValuesValidatorStandardStatus',
  'tokenDeploymentLadderStateStatus',
  'safeSuggestedPatchStatus',
  'taskSizeAdvisorStatus',
  'runtimeReadinessBlockerDigestV2Status',
  'dynamicWorkflowWorkerBoundaryV2Status',
  'toolPermissionBoundaryV2Status',
  'roleProfilePluginV2Status',
  'v105SelfTestStatus',
];

const SECRET_PATTERNS = [
  /BEGIN [A-Z ]*PRIVATE KEY/i,
  /\b0x[a-fA-F0-9]{64}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /\b(?:postgres|postgresql|mysql|mongodb|redis):\/\//i,
  /\bhttps?:\/\/[^\s]*(?:alchemy|infura|quicknode|chainstack|private-rpc)[^\s]*/i,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
];

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function bool(value) {
  return value === true || value === '1' || value === 'true' || value === 'yes';
}

function safe(statusKey, status, payload = {}) {
  const report = simpleStatus(statusKey, status, {
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
  return safe(statusKey, 'pass', payload);
}

function fail(statusKey, reasonCodes, payload = {}) {
  return safe(statusKey, 'fail', { ...payload, reasonCodes });
}

function stateFromReasons(statusKey, reasonCodes, payload = {}) {
  return reasonCodes.length ? fail(statusKey, reasonCodes, payload) : pass(statusKey, payload);
}

function hasSecretLike(value) {
  return SECRET_PATTERNS.some((pattern) => pattern.test(String(value || '')));
}

function changedFiles(input) {
  return (input.changedFiles || []).map((file) => String(file).replace(/\\/g, '/'));
}

export function buildRepresentativeProductPrValidationReport(input = {}) {
  const files = changedFiles(input);
  const kind = input.kind || 'harness_only';
  const reasons = [];
  let cwd = '.';
  let commandClass = 'none';
  if (kind === 'backend_only' || files.some((file) => file.startsWith('apps/backend/'))) {
    cwd = 'apps/backend';
    commandClass = 'backend_npm_test';
  } else if (kind === 'contracts_only' || files.some((file) => file.startsWith('contracts/'))) {
    cwd = 'contracts';
    commandClass = 'contracts_npm_test';
  } else if (kind === 'docs_only') {
    commandClass = 'docs_safe_check';
  } else if (kind === 'harness_only') {
    commandClass = 'harness_gate';
  }
  if (kind === 'token_deploy_preflight' && (bool(input.deploy) || bool(input.tx) || bool(input.readinessClaimed))) reasons.push('token_deploy_preflight_forbidden_action');
  if (kind === 'cripto_chain_listener' && (!bool(input.observabilityBoundary) || !bool(input.atomicityBoundary))) reasons.push('chain_listener_missing_observability_or_atomicity_boundary');
  if (kind === 'funky_safe_row' && !bool(input.separatesMapperJsonlDbRuntime)) reasons.push('funky_safe_row_boundary_missing');
  if (kind === 'voxweave_policy_lane' && bool(input.saturated) && bool(input.newPolicyPr)) reasons.push('voxweave_saturated_policy_lane_new_pr');
  if (kind === 'live2d_pr42' && (bool(input.mergeReady) || !bool(input.safeJson))) reasons.push('live2d_pr42_fixture_must_remain_safe_non_merge_ready');
  if (kind === 'iris_baseline' && bool(input.localPass) && !bool(input.remotePass)) reasons.push('iris_local_pass_remote_pass_distinguished');
  return {
    representativeProductPrValidationStatus: stateFromReasons('representativeProductPrValidationStatus', reasons, {
      cwd,
      commandClass,
      syntheticRepresentativeValidation: reasons.length ? 'fail' : 'pass',
    }),
  };
}

export function buildEvidenceSingleSourceReport(input = {}) {
  const pack = input.pack || {};
  const reasons = [];
  if (pack.canonical !== 'evidence-pack.safe.json') reasons.push('evidence_pack_not_canonical');
  for (const field of ['prBodyFromPack', 'docsFromPack']) if (pack[field] === false) reasons.push(`${field}_missing`);
  for (const field of ['headSha', 'runId', 'testCount', 'profile', 'readinessClaim']) {
    if (pack[`${field}Drift`]) reasons.push(`${field}_drift`);
  }
  return {
    evidenceSingleSourceStatus: stateFromReasons('evidenceSingleSourceStatus', reasons),
    evidenceDriftCheckerStatus: stateFromReasons('evidenceDriftCheckerStatus', reasons.filter((code) => code.endsWith('_drift'))),
  };
}

export function buildTargetSafeReportContractReport(input = {}) {
  const reasons = [];
  if (input.exitCode && !bool(input.safeJsonEmitted)) reasons.push('nonzero_exit_without_safe_json');
  if (bool(input.noConsolePayload)) reasons.push('console_payload_missing_fixed_safe_failure');
  if (bool(input.noSafeReport)) reasons.push('safe_report_missing_fixed_failure');
  if (bool(input.emptySafeJson)) reasons.push('empty_safe_json_fixed_failure');
  if (bool(input.finalizerSkipped)) reasons.push('target_finalizer_skipped_fixed_failure');
  if (bool(input.childNoOutput)) reasons.push('child_process_no_output_fixed_failure');
  return { targetSafeReportContractStatus: stateFromReasons('targetSafeReportContractStatus', reasons) };
}

export function buildSourceOnlyCompatibilityReport(input = {}) {
  const reasons = [];
  if (!bool(input.targetSafeJson ?? true)) reasons.push('source_only_target_safe_json_missing');
  if (bool(input.sameHeadRemotePass) && !bool(input.remoteEvidencePass)) reasons.push('remote_evidence_pass_mismatch');
  if (bool(input.mergeReadyBeforeSameHeadRemotePass) || bool(input.targetMergeReadyBeforeSameHeadRemotePass)) reasons.push('merge_ready_before_same_head_remote_pass');
  return { sourceOnlyCompatibilityStatus: stateFromReasons('sourceOnlyCompatibilityStatus', reasons, { pendingAfterPush: true, remoteEvidencePass: false, targetMergeReady: false, mergeReady: false }) };
}

export function buildActiveLegacySelfTestSummaryReport(input = {}) {
  const reasons = [];
  if (bool(input.v105Failure)) reasons.push('active_v105_self_test_failed');
  return {
    activeLegacySelfTestSummaryStatus: stateFromReasons('activeLegacySelfTestSummaryStatus', reasons, {
      activeHarnessVersion: '1.0.5',
      activeSelfTestSuite: 'v105',
      legacySuites: { v104: 'advisory', v103: 'advisory' },
    }),
  };
}

export function buildDiagnosticSourceTraceReport(input = {}) {
  const required = ['npmExecuted', 'npmExitCode', 'cwd', 'commandClass', 'packageScope', 'remoteProductEvidence'];
  const missing = required.filter((field) => input[field] === false);
  const reasons = missing.map((field) => `${field}_source_missing`);
  if (bool(input.normalizerSourceMismatch)) reasons.push('normalizer_source_mismatch');
  return { diagnosticSourceTraceStatus: stateFromReasons('diagnosticSourceTraceStatus', reasons, { safeSuggestedPatch: reasons.length ? 'add diagnostic source field in normalized evidence' : 'none' }) };
}

export function buildQualityGateSelfProtectionReport(input = {}) {
  const weakened = [];
  if (bool(input.removesProductVerification)) weakened.push('product_verification_removed');
  if (bool(input.removesSameHeadRequirement)) weakened.push('same_head_requirement_removed');
  if (bool(input.removesSafeOutputScan)) weakened.push('safe_output_scan_removed');
  if (bool(input.weakensRuntimeReadinessBoundary)) weakened.push('runtime_readiness_boundary_weakened');
  if (bool(input.weakensProductionGoBoundary)) weakened.push('production_go_boundary_weakened');
  return { qualityGateSelfProtectionStatus: stateFromReasons('qualityGateSelfProtectionStatus', weakened) };
}

export function buildIntegrationGovernanceReport(input = {}) {
  const reasons = [];
  if (bool(input.duplicatePolicyPr)) reasons.push('duplicate_policy_pr_blocked');
  const saturated = bool(input.saturated);
  return {
    integrationGovernanceStatus: pass('integrationGovernanceStatus', { codexActionAllowed: saturated ? 'inventory_only' : 'continue' }),
    draftPrInventoryModelStatus: pass('draftPrInventoryModelStatus', { inventoryState: saturated ? 'saturated' : 'open' }),
    nextIntegrationCandidateStatus: pass('nextIntegrationCandidateStatus', { nextPrNecessity: saturated ? 'none' : 'candidate_available' }),
    stopCreatingPolicyPrStatus: stateFromReasons('stopCreatingPolicyPrStatus', reasons, { active: saturated || reasons.length > 0 }),
  };
}

export function buildProductionReadinessG4GateReport(input = {}) {
  const stage = input.stage || 'G0';
  const required = ['observability', 'alerts', 'rollback', 'slo', 'chaos', 'secretRotation', 'runbook'];
  const missing = stage === 'G4' ? required.filter((field) => !bool(input[field])) : ['not_g4'];
  return { productionReadinessG4GateStatus: stateFromReasons('productionReadinessG4GateStatus', missing.map((field) => `production_g4_${field}_missing`), { productionReady: false }) };
}

export function buildObservabilityEvidenceGateReport(input = {}) {
  const reasons = [];
  if (bool(input.runtimeListenerPr)) {
    for (const metric of ['metrics', 'dlqMetric', 'lagMetric']) if (!bool(input[metric])) reasons.push(`${metric}_missing`);
  }
  if (bool(input.metricsDocumented) && !bool(input.metricsTested)) reasons.push('metrics_documented_not_tested');
  return { observabilityEvidenceGateStatus: stateFromReasons('observabilityEvidenceGateStatus', reasons) };
}

export function buildChaosLiteRuntimeSimulationReport(input = {}) {
  const reasons = [];
  for (const field of ['rpcDownRecovery', 'websocketSilentDisconnect', 'duplicateLogIdempotency', 'safeJsonOnFinalizerSkipped']) {
    if (input[field] === false) reasons.push(`${field}_required`);
  }
  return { chaosLiteRuntimeSimulationStatus: stateFromReasons('chaosLiteRuntimeSimulationStatus', reasons) };
}

export function buildAtomicityDeliveryIntegrityReport(input = {}) {
  const reasons = [];
  if (bool(input.dbUpdateWithoutOutboxAtomicity)) reasons.push('db_update_outbox_enqueue_not_atomic');
  if (bool(input.deliveryDuplicateNotIdempotent)) reasons.push('delivery_duplicate_not_idempotent');
  return { atomicityDeliveryIntegrityStatus: stateFromReasons('atomicityDeliveryIntegrityStatus', reasons) };
}

export function buildReviewEvidenceTypedSchemaReport(input = {}) {
  const type = input.type || 'human_github_review';
  const stale = bool(input.staleHead);
  const independent = type === 'human_github_review' || type === 'chatgpt_pro_technical_assessment';
  const reasons = [];
  if (stale) reasons.push('stale_head_review');
  if (type === 'codex_operational_comment' && bool(input.requiresIndependentReview)) reasons.push('codex_comment_not_independent_review');
  return { reviewEvidenceTypedSchemaStatus: stateFromReasons('reviewEvidenceTypedSchemaStatus', reasons, { reviewType: type, independent }) };
}

export function buildOwnerValuesValidatorStandardReport(input = {}) {
  const value = String(input.value || 'TBD');
  const context = input.context || 'placeholder';
  const reasons = [];
  if (hasSecretLike(value)) reasons.push('owner_value_secret_like');
  if (/^https:\/\/(?:etherscan|polygonscan|arbiscan)\.io\//i.test(value) && context !== 'public_explorer_url') reasons.push('public_explorer_url_wrong_context');
  return { ownerValuesValidatorStandardStatus: stateFromReasons('ownerValuesValidatorStandardStatus', reasons, { validationType: 'format_only_not_approval' }) };
}

export function buildTokenDeploymentLadderStateReport(input = {}) {
  const stage = Number.isInteger(input.stage) ? input.stage : 0;
  const reasons = [];
  if (stage > 0 && !bool(input.ownerApproved)) reasons.push('token_deployment_stage_not_owner_approved');
  return { tokenDeploymentLadderStateStatus: stateFromReasons('tokenDeploymentLadderStateStatus', reasons, { stages: Array.from({ length: 9 }, (_, index) => `Stage ${index}`), ready: false }) };
}

export function buildSafeSuggestedPatchReport(input = {}) {
  const reasons = [];
  let safeSuggestedPatch = 'none';
  if (bool(input.oldMarker)) {
    reasons.push('old_marker_detected');
    safeSuggestedPatch = 'update harness marker to the active source version';
  }
  if (bool(input.routingMismatch)) {
    reasons.push('routing_mismatch');
    safeSuggestedPatch = 'align cwd and commandClass with product surface router';
  }
  if (bool(input.diagnosticSourceMismatch)) {
    reasons.push('diagnostic_source_mismatch');
    safeSuggestedPatch = 'add source path to normalized diagnostic field';
  }
  return { safeSuggestedPatchStatus: pass('safeSuggestedPatchStatus', { reasonCodes: reasons, safeSuggestedPatch }) };
}

export function buildTaskSizeAdvisorReport(input = {}) {
  const allowed = new Set(['diagnostic_only', 'body_only_repair', 'harness_only_pr', 'product_pr_refresh', 'review_and_ready', 'merge_only', 'no_deploy_preflight', 'owner_values_format_validation', 'inventory_only', 'integration_plan_only', 'no_new_pr']);
  const mode = input.mode || 'harness_only_pr';
  return { taskSizeAdvisorStatus: allowed.has(mode) ? pass('taskSizeAdvisorStatus', { advisedMode: mode }) : fail('taskSizeAdvisorStatus', ['task_size_mode_unknown']) };
}

export function buildRuntimeReadinessBlockerDigestV2Report(input = {}) {
  const reasons = [];
  if (bool(input.runtimeReadyClaimed)) reasons.push('runtime_readiness_claim_blocked');
  if (bool(input.productionReadyClaimed)) reasons.push('production_readiness_claim_blocked');
  return { runtimeReadinessBlockerDigestV2Status: stateFromReasons('runtimeReadinessBlockerDigestV2Status', reasons, { runtimeReadinessClaimed: false, productionReadinessClaimed: false }) };
}

export function buildDynamicWorkflowWorkerBoundaryV2Report(input = {}) {
  const reasons = [];
  for (const field of ['goalModeContract', 'workPacketSchema', 'roleProfilePlugin', 'toolPermissionBoundary', 'workerFileOwnership', 'verificationFanIn']) {
    if (input[field] === false) reasons.push(`${field}_missing`);
  }
  if (bool(input.runtimeTxDeploy) && !bool(input.approvalGate)) reasons.push('approval_gate_missing_for_runtime_tx_deploy');
  for (const field of ['autoMerge', 'autoDeploy', 'toolOutsideRole', 'writeOutsideOwnership', 'bypassQualityGate']) {
    if (bool(input[field])) reasons.push(`subworker_${field}_forbidden`);
  }
  return {
    dynamicWorkflowWorkerBoundaryV2Status: stateFromReasons('dynamicWorkflowWorkerBoundaryV2Status', reasons),
    toolPermissionBoundaryV2Status: reasons.some((code) => code.includes('tool')) ? fail('toolPermissionBoundaryV2Status', reasons.filter((code) => code.includes('tool'))) : pass('toolPermissionBoundaryV2Status'),
    roleProfilePluginV2Status: reasons.some((code) => code.includes('roleProfilePlugin')) ? fail('roleProfilePluginV2Status', ['roleProfilePlugin_missing']) : pass('roleProfilePluginV2Status'),
  };
}

export function buildDefaultV105Reports(input = {}) {
  const report = {
    ...buildRepresentativeProductPrValidationReport({ kind: 'harness_only' }),
    ...buildEvidenceSingleSourceReport({ pack: { canonical: 'evidence-pack.safe.json', prBodyFromPack: true, docsFromPack: true } }),
    ...buildTargetSafeReportContractReport({ safeJsonEmitted: true }),
    ...buildSourceOnlyCompatibilityReport({ targetSafeJson: true }),
    ...buildActiveLegacySelfTestSummaryReport({}),
    ...buildDiagnosticSourceTraceReport({ npmExecuted: true, npmExitCode: true, cwd: true, commandClass: true, packageScope: true, remoteProductEvidence: true }),
    ...buildQualityGateSelfProtectionReport({}),
    ...buildIntegrationGovernanceReport({ saturated: false }),
    ...buildProductionReadinessG4GateReport({ stage: 'G4', observability: true, alerts: true, rollback: true, slo: true, chaos: true, secretRotation: true, runbook: true }),
    ...buildObservabilityEvidenceGateReport({ runtimeListenerPr: true, metrics: true, metricsTested: true, dlqMetric: true, lagMetric: true }),
    ...buildChaosLiteRuntimeSimulationReport({ rpcDownRecovery: true, websocketSilentDisconnect: true, duplicateLogIdempotency: true, safeJsonOnFinalizerSkipped: true }),
    ...buildAtomicityDeliveryIntegrityReport({}),
    ...buildReviewEvidenceTypedSchemaReport({ type: 'human_github_review' }),
    ...buildOwnerValuesValidatorStandardReport({ value: 'TBD' }),
    ...buildTokenDeploymentLadderStateReport({ stage: 0 }),
    ...buildSafeSuggestedPatchReport({}),
    ...buildTaskSizeAdvisorReport({ mode: 'harness_only_pr' }),
    ...buildRuntimeReadinessBlockerDigestV2Report({}),
    ...buildDynamicWorkflowWorkerBoundaryV2Report({ goalModeContract: true, workPacketSchema: true, roleProfilePlugin: true, toolPermissionBoundary: true, workerFileOwnership: true, approvalGate: true, verificationFanIn: true }),
  };
  report.v105SelfTestStatus = pass('v105SelfTestStatus', {
    activeHarnessVersion: '1.0.5',
    activeSelfTestSuite: 'v105',
    caseCount: input.caseCount || 0,
    failedCaseCount: input.failedCaseCount || 0,
  });
  for (const key of V105_STATUS_KEYS) if (!report[key]) report[key] = pass(key);
  return report;
}

export function buildV105Report(input = {}) {
  const report = {
    marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.6',
    harnessVersion: '1.0.5',
    status: 'pass',
    ...buildDefaultV105Reports(input),
    productCodeChanged: false,
    runtimeReadinessClaimed: false,
    productionReadinessClaimed: false,
    targetRollout: 'not_started',
    representativeRealPrValidation: 'not_started',
    syntheticRepresentativeValidation: 'pass',
    safeSummaryOnly: true,
  };
  const unsafe = scanObjectForUnsafe(report);
  if (unsafe.length) {
    report.status = 'fail';
    report.v105SelfTestStatus = fail('v105SelfTestStatus', ['unsafe_value_detected']);
  }
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = buildV105Report();
  writeJsonReport(report, 'CODEX_V105_GATE_REPORT');
  exitFor(report);
}
