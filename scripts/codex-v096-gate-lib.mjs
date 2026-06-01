#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { fileURLToPath } from 'node:url';
import { scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

export function parseJson(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return { invalidInput: true }; }
}

export function parseBool(value) {
  return value === true || value === '1' || value === 'true' || value === 'yes';
}

export function parseList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || '').split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean);
}

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function safe(statusKey, status, payload = {}) {
  const out = simpleStatus(statusKey, status, {
    ...payload,
    reasonCodes: uniq(payload.reasonCodes),
    warnings: uniq(payload.warnings),
    safeSummaryOnly: true,
  });
  return scanObjectForUnsafe(out).length
    ? simpleStatus(statusKey, 'fail', { reasonCodes: ['unsafe_value_detected'], safeSummaryOnly: true })
    : out;
}

function notApplicable(statusKey, reasonCode) {
  return safe(statusKey, 'not_applicable', { reasonCodes: [reasonCode] });
}

function riskClasses(input) {
  return parseList(input.riskClasses || input.riskProfile || input.changedFileClasses);
}

export function buildKRuleCoverageReport(input = parseJson(process.env.CODEX_K_RULE_COVERAGE_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.kRuleRelevant) && !parseBool(input.live2dKRuleRelevant)) {
    return notApplicable('kRuleCoverageStatus', 'k_rule_coverage_not_applicable');
  }
  const reasonCodes = [];
  const warnings = [];
  if (input.invalidInput) reasonCodes.push('k_rule_coverage_missing');
  if (!parseBool(input.allowlistPresent)) reasonCodes.push('k_rule_coverage_missing');
  if (!parseBool(input.coverageTestPresent)) reasonCodes.push('k_rule_coverage_missing');
  if (parseBool(input.staleCoverageManifest)) reasonCodes.push('k_rule_coverage_stale');
  if (parseBool(input.manualOnlyCoverage)) warnings.push('k_rule_coverage_manual_review');
  return safe('kRuleCoverageStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildLive2DSpecSyncReport(input = parseJson(process.env.CODEX_LIVE2D_SPEC_SYNC_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.live2dSpecRelevant)) {
    return notApplicable('live2dSpecSyncStatus', 'live2d_spec_not_applicable');
  }
  const reasonCodes = [];
  if (input.invalidInput) reasonCodes.push('live2d_spec_sync_failed');
  if (parseBool(input.futurePhaseMixed)) reasonCodes.push('live2d_spec_future_phase_mixed');
  if (parseBool(input.phaseOrderBroken)) reasonCodes.push('live2d_spec_phase_order_failed');
  if (parseBool(input.rawCueIncluded) || parseBool(input.rawMotionCommandIncluded) || parseBool(input.rawModelPathIncluded)) reasonCodes.push('live2d_spec_safe_artifact_failed');
  return safe('live2dSpecSyncStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildRuntimeLatencyBudgetReport(input = parseJson(process.env.CODEX_RUNTIME_LATENCY_BUDGET_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.runtimeRelevant) && !parseBool(input.latencyRelevant)) {
    return notApplicable('runtimeLatencyBudgetStatus', 'runtime_latency_not_applicable');
  }
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.duplicateDeliveryRisk)) reasonCodes.push('runtime_latency_duplicate_delivery');
  if (parseBool(input.queueDrainBeforeReady)) reasonCodes.push('runtime_latency_queue_drain_before_ready');
  if (parseBool(input.unboundedInterval)) reasonCodes.push('runtime_latency_budget_missing');
  if (parseBool(input.manualOnlyLatency)) warnings.push('runtime_latency_manual_review');
  return safe('runtimeLatencyBudgetStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildObsoleteOpenPrReport(input = parseJson(process.env.CODEX_OBSOLETE_OPEN_PR_JSON) || {}) {
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.reuseOldPr)) reasonCodes.push('obsolete_open_pr_reuse_forbidden');
  if (parseBool(input.oldHarnessOpenPr)) warnings.push('obsolete_open_pr_old_harness');
  return safe('obsoleteOpenPrStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildOwnerSummaryCompactReport(input = parseJson(process.env.CODEX_OWNER_SUMMARY_COMPACT_JSON) || {}) {
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.required) && !parseBool(input.present)) reasonCodes.push('owner_summary_missing');
  if (Number(input.lineCount || 0) > 7) reasonCodes.push('owner_summary_too_large');
  if (parseBool(input.rawLogsIncluded) || parseBool(input.rawDiffsIncluded) || parseBool(input.privatePathIncluded)) reasonCodes.push('owner_summary_unsafe');
  if (Number(input.lineCount || 0) === 7) warnings.push('owner_summary_at_limit');
  return safe('ownerSummaryCompactStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildBrowserSmokeArtifactReport(input = parseJson(process.env.CODEX_BROWSER_SMOKE_ARTIFACT_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.browserSmokeRequired) && !parseBool(input.artifactPresent)) {
    return notApplicable('browserSmokeArtifactStatus', 'browser_smoke_not_applicable');
  }
  const reasonCodes = [];
  const warnings = [];
  if (parseBool(input.browserSmokeRequired) && !parseBool(input.artifactPresent)) reasonCodes.push('browser_smoke_artifact_missing');
  if (parseBool(input.rawConsoleLogIncluded) || parseBool(input.rawProductionDataIncluded)) reasonCodes.push('browser_smoke_raw_output_forbidden');
  if (parseBool(input.runtimeReadyClaimedFromSmoke)) reasonCodes.push('browser_smoke_runtime_ready_overclaim');
  if (parseBool(input.browserUnavailable)) warnings.push('browser_smoke_unavailable');
  return safe('browserSmokeArtifactStatus', reasonCodes.length ? 'fail' : warnings.length ? 'warning' : 'pass', { reasonCodes, warnings });
}

export function buildFailureToRepairPlanReport(input = parseJson(process.env.CODEX_FAILURE_TO_REPAIR_PLAN_JSON) || {}) {
  const reasonCodes = [];
  if (parseBool(input.failurePresent) && !parseBool(input.planPresent)) reasonCodes.push('failure_to_repair_plan_missing');
  if (parseBool(input.productEvidenceMissing) && parseBool(input.bodyOnlyRepair)) reasonCodes.push('failure_to_repair_plan_invalid');
  if (parseBool(input.runtimeReadinessGap) && parseBool(input.bodyOnlyRepair)) reasonCodes.push('failure_to_repair_plan_invalid');
  return safe('failureToRepairPlanStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildRuntimeStateAdoptionReport(input = parseJson(process.env.CODEX_RUNTIME_STATE_ADOPTION_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.runtimeStateRelevant) && !parseBool(input.runtimeReadinessClaimed)) {
    return notApplicable('runtimeStateAdoptionStatus', 'runtime_state_adoption_not_applicable');
  }
  const reasonCodes = [];
  if (parseBool(input.runtimeReadinessClaimed) && parseBool(input.schemaOnly)) reasonCodes.push('runtime_state_adoption_missing');
  if (parseBool(input.runtimeReadinessClaimed) && !parseBool(input.helperUsed)) reasonCodes.push('runtime_state_adoption_missing');
  if (parseBool(input.rawRuntimeLogIncluded)) reasonCodes.push('runtime_state_adoption_unsafe_artifact');
  return safe('runtimeStateAdoptionStatus', reasonCodes.length ? 'fail' : 'pass', {
    reasonCodes,
    runtimeReadinessProven: parseBool(input.runtimeReadinessClaimed) && !reasonCodes.length,
  });
}

export function buildClaimTransitionReport(input = parseJson(process.env.CODEX_CLAIM_TRANSITION_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.claimRelevant)) return notApplicable('claimTransitionStatus', 'claim_transition_not_applicable');
  const reasonCodes = [];
  if (!parseBool(input.atomicClaimPresent)) reasonCodes.push('claim_transition_atomic_missing');
  if (parseBool(input.processedBooleanOnly)) reasonCodes.push('claim_transition_atomic_missing');
  return safe('claimTransitionStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildTimeoutAdoptionReport(input = parseJson(process.env.CODEX_TIMEOUT_ADOPTION_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.timeoutRelevant) && !parseBool(input.txWaitPath)) return notApplicable('timeoutAdoptionStatus', 'timeout_adoption_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.txWaitPath) && !parseBool(input.timeoutPolicyPresent)) reasonCodes.push('timeout_adoption_missing');
  if (parseBool(input.unboundedWait)) reasonCodes.push('timeout_adoption_missing');
  return safe('timeoutAdoptionStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildTxReconciliationServiceReport(input = parseJson(process.env.CODEX_TX_RECONCILIATION_SERVICE_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.txRelevant)) return notApplicable('txReconciliationServiceStatus', 'tx_reconciliation_not_applicable');
  const reasonCodes = [];
  if (!parseBool(input.servicePresent)) reasonCodes.push('tx_reconciliation_service_missing');
  if (parseBool(input.receiptPath) && !parseBool(input.resumePolicyPresent)) reasonCodes.push('tx_reconciliation_service_missing');
  return safe('txReconciliationServiceStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildTxHashBeforeWaitReport(input = parseJson(process.env.CODEX_TXHASH_BEFORE_WAIT_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.txWaitRelevant)) return notApplicable('txHashBeforeWaitStatus', 'txhash_before_wait_not_applicable');
  const reasonCodes = [];
  if (!parseBool(input.txHashPersistedBeforeWait)) reasonCodes.push('txhash_before_wait_missing');
  if (parseBool(input.waitBeforePersistence)) reasonCodes.push('txhash_before_wait_missing');
  return safe('txHashBeforeWaitStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildReceiptResumeBoundaryReport(input = parseJson(process.env.CODEX_RECEIPT_RESUME_BOUNDARY_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.receiptRelevant)) return notApplicable('receiptResumeBoundaryStatus', 'receipt_resume_not_applicable');
  const reasonCodes = [];
  if (!parseBool(input.resumeBoundaryPresent)) reasonCodes.push('receipt_resume_boundary_missing');
  if (parseBool(input.rawReceiptLogIncluded)) reasonCodes.push('receipt_resume_boundary_unsafe');
  return safe('receiptResumeBoundaryStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildMigrationRolloutSafetyReport(input = parseJson(process.env.CODEX_MIGRATION_ROLLOUT_SAFETY_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.migrationRelevant)) return notApplicable('migrationRolloutSafetyStatus', 'migration_rollout_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.destructiveMigration) && !parseBool(input.rollbackPlanPresent)) reasonCodes.push('migration_rollout_safety_failed');
  if (parseBool(input.nonNullableWithoutDefault)) reasonCodes.push('migration_rollout_safety_failed');
  if (parseBool(input.productCommandAutoRun)) reasonCodes.push('migration_rollout_safety_failed');
  return safe('migrationRolloutSafetyStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildMigrationRuntimeCompatReport(input = parseJson(process.env.CODEX_MIGRATION_RUNTIME_COMPAT_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.migrationRelevant)) return notApplicable('migrationRuntimeCompatStatus', 'migration_runtime_compat_not_applicable');
  const reasonCodes = [];
  if (!parseBool(input.compatEvidencePresent)) reasonCodes.push('migration_runtime_compat_missing');
  if (parseBool(input.runtimeReadinessClaimed) && !parseBool(input.compatEvidencePresent)) reasonCodes.push('migration_runtime_compat_missing');
  return safe('migrationRuntimeCompatStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildHumanReviewDigestReport(input = parseJson(process.env.CODEX_HUMAN_REVIEW_DIGEST_JSON) || {}) {
  const classes = riskClasses(input);
  const digestRequired = parseBool(input.r3) || classes.includes('R3') || classes.includes('harness_workflow_r3') || parseBool(input.digestRequired);
  const reasonCodes = [];
  if (digestRequired && !parseBool(input.digestPresent)) reasonCodes.push('human_review_digest_missing');
  if (Number(input.lineCount || 0) > 12) reasonCodes.push('human_review_digest_too_large');
  if (parseBool(input.rawLogsIncluded) || parseBool(input.rawDiffsIncluded)) reasonCodes.push('human_review_digest_unsafe');
  return safe('humanReviewDigestStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes, digestRequired });
}

export function buildDatasetAuditReadinessReport(input = parseJson(process.env.CODEX_DATASET_AUDIT_READINESS_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.datasetAuditRelevant)) return notApplicable('datasetAuditReadinessStatus', 'dataset_audit_not_applicable');
  const reasonCodes = [];
  if (!parseBool(input.schemaPresent)) reasonCodes.push('dataset_audit_readiness_missing');
  if (parseBool(input.autoFixEnabled)) reasonCodes.push('dataset_audit_auto_fix_forbidden');
  if (parseBool(input.rawDatasetIncluded) || parseBool(input.personalDataIncluded)) reasonCodes.push('raw_production_data_forbidden');
  return safe('datasetAuditReadinessStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildGameToolAdapterContractFixtureReport(input = parseJson(process.env.CODEX_GAME_TOOL_ADAPTER_CONTRACT_FIXTURE_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.gameToolRelevant)) return notApplicable('gameToolAdapterContractFixtureStatus', 'game_tool_adapter_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.candidateDirectHandoff)) reasonCodes.push('game_tool_adapter_direct_handoff');
  if (!parseBool(input.approvedAction) && !parseBool(input.contractFixturePresent)) reasonCodes.push('game_tool_adapter_contract_missing');
  return safe('gameToolAdapterContractFixtureStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function buildBelovedAvatarSafetyAuditReport(input = parseJson(process.env.CODEX_BELOVED_AVATAR_SAFETY_AUDIT_JSON) || {}) {
  if (!parseBool(input.forceCheck) && !parseBool(input.avatarRelevant)) return notApplicable('belovedAvatarSafetyAuditStatus', 'beloved_avatar_not_applicable');
  const reasonCodes = [];
  if (parseBool(input.memoryPrivacyViolation)) reasonCodes.push('beloved_avatar_memory_privacy_violation');
  if (parseBool(input.rawCueIncluded) || parseBool(input.rawMotionCommandIncluded) || parseBool(input.personalDataIncluded)) reasonCodes.push('beloved_avatar_safety_artifact_failed');
  return safe('belovedAvatarSafetyAuditStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes });
}

export function runV096GateCli(metaUrl, argvOne, builder, envName) {
  if (argvOne && fileURLToPath(metaUrl) === argvOne) {
    const report = builder();
    writeJsonReport(report, envName);
    exitFor(report);
  }
}
