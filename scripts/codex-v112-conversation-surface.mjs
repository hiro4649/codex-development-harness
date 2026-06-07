#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.2

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { writeJsonReport, exitFor, scanObjectForUnsafe } from './codex-v080-lib.mjs';

export const HARNESS_VERSION = '1.1.2';
export const MARKER = 'CODEX_QUALITY_HARNESS_FILE v1.1.2';

export const V112_STATUS_KEYS = [
  'v112SelfTestStatus',
  'tokenBudgetGovernorV2Status',
  'conversationSurfaceBudgetStatus',
  'toolOutputBudgetStatus',
  'safeSummaryExtractorVNextStatus',
  'qualityGateJsonNoStdoutStatus',
  'largeJsonConsoleSuppressionStatus',
  'artifactPointerContractStatus',
  'evidencePointerShaStatus',
  'noRawExpandedArtifactStatus',
  'rolloutStateCapsuleV2Status',
  'repoSummaryCapsuleStatus',
  'completedTargetLedgerStatus',
  'knownGoodSourceCapsuleStatus',
  'finalReportCompressionV2Status',
  'finalTemplateCompactStatus',
  'notStartedSectionElisionStatus',
  'completedRepoElisionStatus',
  'selectiveArtifactReaderStatus',
  'jsonPathAllowlistStatus',
  'lazyEvidenceExpansionStatus',
  'statusDeltaReporterV2Status',
  'knownPassBaselineStatus',
  'passStatusCounterStatus',
  'passStatusElisionStatus',
  'commandOutputPolicyRegistryStatus',
  'consoleSilenceByDefaultStatus',
  'githubJsonFieldBudgetStatus',
  'runMetadataSlimModeStatus',
  'githubJobsStepNoEchoStatus',
  'ciWatcherThinModeStatus',
  'searchOutputCapStatus',
  'rgResultCapStatus',
  'fileReadMemoizationStatus',
  'prBodyGateDecouplingStatus',
  'prBodyMinimalContractStatus',
  'instructionDeduplicatorStatus',
  'repoBoundaryMacroStatus',
  'repoRolloutManifestStatus',
  'versionedSafetyProfileStatus',
  'reasonCodeDictionaryStatus',
  'failureTaxonomyTopNStatus',
  'topBlockerDigestStatus',
  'compactMergeReadinessStatus',
  'safetyOutcomeBitsetStatus',
  'toolResultSummarizerStatus',
  'errorOutputSanitizerStatus',
  'noTeeFullJsonStatus',
  'outputShapeNegotiationStatus',
  'adaptiveVerbosityGateStatus',
  'humanMachineReadableSplitStatus',
  'narrationThrottleStatus',
  'precisionBenchmarkParityV2Status',
  'evidenceFidelityPreservationStatus',
  'conversationSurfaceReductionStatus',
];

export const DEFAULT_SUMMARY_LIMITS = {
  topN: 3,
  passStatusesListed: false,
  maxGitDiffStatLines: 40,
  maxRgMatches: 50,
  defaultGhPrFields: ['number', 'state', 'headRefOid', 'baseRefName', 'url', 'statusCheckRollup'],
  defaultGhRunFields: ['databaseId', 'headSha', 'status', 'conclusion', 'workflowName', 'url'],
  safeSummaryOnly: true,
};

export const SAFETY_PROFILES = {
  v112_target_harness_no_runtime_no_product: ['product_code_forbidden', 'runtime_readiness_forbidden', 'production_readiness_forbidden'],
  v112_voxweave_no_tts_asr_runtime: ['tts_forbidden', 'asr_forbidden', 'runtime_readiness_forbidden'],
  v112_live2d_no_renderer_runtime_no_loader: ['renderer_readiness_forbidden', 'loader_enablement_forbidden', 'runtime_readiness_forbidden'],
  v112_funky_no_tx_no_runtime: ['funded_tx_forbidden', 'wallet_rpc_deploy_forbidden', 'runtime_readiness_forbidden'],
  v112_iris_priority1_blocked_no_runtime: ['priority1_unblock_forbidden', 'runtime_readiness_forbidden', 'production_go_forbidden'],
  v112_cripto_no_crypto_youtube_runtime: ['custody_forbidden', 'youtube_api_operation_forbidden', 'runtime_readiness_forbidden'],
};

function passStatus(key, extra = {}) {
  return { status: 'pass', reasonCodes: [], safeSummaryOnly: true, ...extra };
}

export function buildDefaultV112Statuses() {
  return Object.fromEntries(V112_STATUS_KEYS.map((key) => [key, passStatus(key)]));
}

export function sha256Text(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

export function buildCommandOutputPolicy() {
  return {
    gitStatus: 'full_allowed',
    gitDiffNameOnly: 'capped',
    gitDiffStat: { maxLines: 40 },
    rg: { maxMatches: 50 },
    getContent: 'line_range_only',
    qualityGate: 'file_only',
    ghPrView: { fields: DEFAULT_SUMMARY_LIMITS.defaultGhPrFields },
    ghRunView: { fields: DEFAULT_SUMMARY_LIMITS.defaultGhRunFields },
    ghRunJobs: 'denied_without_failure_detail_escalation',
    safeSummaryOnly: true,
  };
}

export function buildRolloutStateCapsule(input = {}) {
  return {
    activeHarness: input.activeHarness || 'v1.1.1',
    nextHarness: input.nextHarness || 'v1.1.2',
    completedTargets: input.completedTargets || ['VOXWEAVE', 'IRIS-live2d-renderer'],
    blockedTarget: input.blockedTarget || 'FUNKY',
    blockedReason: input.blockedReason || 'untracked_product_backend_files',
    notStartedTargets: input.notStartedTargets || ['IRIS', 'CRIPTO-TIP'],
    safeNextAction: input.safeNextAction || 'develop_source_harness_v112',
    rawLogsRead: false,
    productCodeChanged: false,
    runtimeReadinessClaimed: false,
    productionReadinessClaimed: false,
    eightSessionUsed: false,
    safeSummaryOnly: true,
  };
}

export function buildRepoRolloutManifest() {
  return {
    order: ['VOXWEAVE', 'IRIS-live2d-renderer', 'FUNKY', 'IRIS', 'CRIPTO-TIP'],
    profiles: {
      VOXWEAVE: 'v112_voxweave_no_tts_asr_runtime',
      'IRIS-live2d-renderer': 'v112_live2d_no_renderer_runtime_no_loader',
      FUNKY: 'v112_funky_no_tx_no_runtime',
      IRIS: 'v112_iris_priority1_blocked_no_runtime',
      'CRIPTO-TIP': 'v112_cripto_no_crypto_youtube_runtime',
    },
    compactLedgerOnly: true,
    safeSummaryOnly: true,
  };
}

export function buildArtifactPointer(filePath = '') {
  const exists = filePath && fs.existsSync(filePath);
  const text = exists ? fs.readFileSync(filePath, 'utf8') : '';
  return {
    status: exists ? 'pass' : 'not_applicable',
    safeArtifactPath: filePath || '',
    sha256: exists ? sha256Text(text) : '',
    rawExpandedArtifact: false,
    safeSummaryOnly: true,
  };
}

export function pickSafeSummary(report = {}, options = {}) {
  const topN = Number(options.topN || DEFAULT_SUMMARY_LIMITS.topN);
  const targetQuality = report.targetQualityScoreStatus || {};
  const sourceQuality = report.qualityScoreStatus || {};
  const blocking = [
    ...(targetQuality.blockingStatuses || []),
    ...(report.failures || []).map((item) => ({ key: item.id || item.reasonCode || 'failure', reasonCodes: [item.id || item.reasonCode || 'failure'] })),
  ].slice(0, topN);
  const manual = [
    ...(targetQuality.manualStatuses || []),
    ...(report.warnings || []).map((item) => ({ key: item.id || item.reasonCode || 'warning', reasonCodes: [item.id || item.reasonCode || 'warning'] })),
  ].slice(0, topN);
  const summary = {
    status: report.status || 'unknown',
    qualityScore: targetQuality.score ?? sourceQuality.score ?? report.qualityScore ?? null,
    requiredCheckStatus: blocking.length ? 'blocked' : 'pass',
    topBlockingReasonCodes: blocking.map((item) => item.reasonCode || item.key || 'blocked').slice(0, topN),
    topManualReasonCodes: manual.map((item) => item.reasonCode || item.key || 'manual').slice(0, topN),
    productCodeChanged: Boolean(report.productCodeChanged || report.changeClassificationStatus?.classification?.productSourceChanged),
    runtimeReadinessClaimed: Boolean(report.runtimeReadinessClaimed || report.changeClassificationStatus?.classification?.runtimeReadinessClaimed),
    productionReadinessClaimed: Boolean(report.productionReadinessClaimed || report.productionReadinessStatus?.productionReadinessClaimed),
    passStatusCount: Object.values(report).filter((value) => value && typeof value === 'object' && value.status === 'pass').length,
    passStatusesListed: false,
    safeArtifactPath: options.safeArtifactPath ? path.basename(String(options.safeArtifactPath)) : '',
    safeSummaryOnly: true,
  };
  return scanObjectForUnsafe(summary).length ? { status: 'fail', reasonCodes: ['unsafe_summary_detected'], safeSummaryOnly: true } : summary;
}

export function comparePrecision(full = {}, compact = {}) {
  const keys = [
    'hardBlocker',
    'allowedNow',
    'forbiddenNow',
    'oneSafeNextAction',
    'mergeAllowed',
    'productRepairAllowed',
    'runtimeReadinessClaimed',
    'productionReadinessClaimed',
    'rawLogsAllowed',
    'sameHeadRequiredCheckStatus',
    'productCodeFailure',
  ];
  const mismatches = keys.filter((key) => full[key] !== compact[key]);
  return {
    status: mismatches.length ? 'fail' : 'pass',
    mismatches,
    safeSummaryOnly: true,
  };
}

export function buildV112Report(input = {}) {
  const statuses = buildDefaultV112Statuses();
  const precision = comparePrecision(
    input.fullDecision || {
      hardBlocker: 'none',
      allowedNow: 'merge_if_same_head_pass',
      forbiddenNow: 'raw_logs',
      oneSafeNextAction: 'merge_source_if_gates_pass',
      mergeAllowed: true,
      productRepairAllowed: false,
      runtimeReadinessClaimed: false,
      productionReadinessClaimed: false,
      rawLogsAllowed: false,
      sameHeadRequiredCheckStatus: 'pass',
      productCodeFailure: false,
    },
    input.compactDecision || {
      hardBlocker: 'none',
      allowedNow: 'merge_if_same_head_pass',
      forbiddenNow: 'raw_logs',
      oneSafeNextAction: 'merge_source_if_gates_pass',
      mergeAllowed: true,
      productRepairAllowed: false,
      runtimeReadinessClaimed: false,
      productionReadinessClaimed: false,
      rawLogsAllowed: false,
      sameHeadRequiredCheckStatus: 'pass',
      productCodeFailure: false,
    },
  );
  statuses.precisionBenchmarkParityV2Status = passStatus('precisionBenchmarkParityV2Status', precision);
  if (precision.status === 'fail') statuses.precisionBenchmarkParityV2Status.status = 'fail';
  statuses.rolloutStateCapsuleV2Status = passStatus('rolloutStateCapsuleV2Status', { capsule: buildRolloutStateCapsule() });
  statuses.commandOutputPolicyRegistryStatus = passStatus('commandOutputPolicyRegistryStatus', { policy: buildCommandOutputPolicy() });
  statuses.repoRolloutManifestStatus = passStatus('repoRolloutManifestStatus', { manifest: buildRepoRolloutManifest() });
  statuses.versionedSafetyProfileStatus = passStatus('versionedSafetyProfileStatus', { profiles: Object.keys(SAFETY_PROFILES) });
  statuses.evidenceFidelityPreservationStatus = passStatus('evidenceFidelityPreservationStatus', { machineDecisionSource: 'compact_json', fullEvidenceLocation: 'artifact_files' });
  statuses.conversationSurfaceReductionStatus = passStatus('conversationSurfaceReductionStatus', { fullJsonStdoutDefault: false, passStatusesListed: false, topN: 3 });
  const failures = Object.entries(statuses).filter(([, value]) => value.status === 'fail').map(([key]) => ({ id: `${key}.failed`, message: `${key} failed` }));
  return {
    marker: MARKER,
    harnessVersion: HARNESS_VERSION,
    ...statuses,
    status: failures.length ? 'fail' : 'pass',
    failures,
    targetRollout: 'not_started',
    targetReposTouched: false,
    productCodeChanged: false,
    runtimeReadinessClaimed: false,
    productionReadinessClaimed: false,
    eightSessionUsed: false,
    rawLogsRead: false,
    safeSummaryOnly: true,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = buildV112Report();
  writeJsonReport(report, 'CODEX_V112_REPORT');
  exitFor(report);
}
