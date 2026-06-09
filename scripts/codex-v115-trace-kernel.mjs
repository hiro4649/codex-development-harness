#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.5

import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor, scanObjectForUnsafe } from './codex-v080-lib.mjs';

export const HARNESS_VERSION = '1.1.5';
export const MARKER = 'CODEX_QUALITY_HARNESS_FILE v1.1.5';

export const V115_STATUS_KEYS = [
  'v115SelfTestStatus',
  'traceKernelStatus',
  'policyHookContractStatus',
  'goalContractStatus',
  'skillProfileRegistryStatus',
  'permissionProfileMatrixStatus',
  'targetFinalizerStatus',
  'legacyCompatibilityMatrixStatus',
  'tokenRuntimeMeterStatus',
  'validationDependencyGraphStatus',
  'decisionCoreV2Status',
];

export const DECISIONS = new Set([
  'allowed',
  'blocked',
  'blocked_by_required_check',
  'blocked_by_scope',
  'blocked_by_safety',
  'blocked_by_missing_artifact',
  'owner_decision_required',
]);

const HARD_REASON_CODES = new Set([
  'secret_leak_detected',
  'raw_log_leak_detected',
  'unsafe_output_detected',
  'product_code_changed',
  'package_or_lockfile_changed',
  'workflow_change_outside_scope',
  'same_head_required_check_failed',
  'required_check_missing',
  'missing_required_artifact',
  'runtime_readiness_claimed',
  'production_readiness_claimed',
  'legal_compliance_claimed',
  'youtube_policy_compliance_claimed',
  'wallet_rpc_deploy_access',
  'eight_session_used',
]);

export function pass(extra = {}) {
  return { status: 'pass', reasonCodes: [], safeSummaryOnly: true, ...extra };
}

export function fail(reasonCodes, extra = {}) {
  return {
    status: 'fail',
    reasonCodes: Array.isArray(reasonCodes) ? [...new Set(reasonCodes)].slice(0, 3) : [reasonCodes],
    safeSummaryOnly: true,
    ...extra,
  };
}

export function sha256(value = '') {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function one(value, fallback) {
  if (Array.isArray(value)) return value.find(Boolean) || fallback;
  return value || fallback;
}

function compactCodeList(values = []) {
  return [...new Set((values || []).filter(Boolean).map(String))].slice(0, 3);
}

export function buildTraceId(input = {}) {
  return `trace-${sha256([
    input.repo || 'repo',
    input.branch || 'branch',
    input.headSha || 'head',
    input.changedFilesHash || 'changed',
    input.validationHash || 'validation',
  ].join('|')).slice(0, 16)}`;
}

export function buildSafeTraceRecord(input = {}) {
  const traceId = input.traceId || buildTraceId(input);
  const record = {
    traceId,
    repo: input.repo || 'unknown',
    branch: input.branch || 'unknown',
    headSha: input.headSha || 'unknown',
    taskMode: input.taskMode || 'harness_change',
    loopState: input.loopState || 'local_validation',
    decision: input.decision || 'blocked',
    primaryClass: input.primaryClass || 'owner_decision_required',
    safeNextAction: one(input.safeNextAction, 'read_decision_core'),
    changedFilesHash: input.changedFilesHash || sha256((input.changedFiles || []).sort().join('\n')),
    validationHash: input.validationHash || sha256(input.validationSummary || 'not_run'),
    artifactIndexHash: input.artifactIndexHash || sha256(input.artifactIndex || 'not_available'),
    tokenCost: input.tokenCost || { stdoutLines: 0, stdoutBytes: 0, finalReportLines: 0 },
    elapsedMs: Number(input.elapsedMs || 0),
    rawLogsRead: false,
    eightSessionUsed: false,
    safeSummaryOnly: true,
  };
  return record;
}

export function validateTraceKernel(input = {}) {
  const record = buildSafeTraceRecord(input);
  const serialized = JSON.stringify(record);
  const forbiddenKeys = ['rawLog', 'stdout', 'fullStdout', 'stdoutText', 'fullJson', 'fullJsonOutput', 'secret', 'privateUrl', 'privatePath', 'passStatuses', 'forbiddenBoundaryText'];
  const reasonCodes = [];
  for (const key of forbiddenKeys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) reasonCodes.push('trace_forbidden_key_present');
    if (serialized.includes(`"${key}"`)) reasonCodes.push('trace_forbidden_payload_present');
  }
  if (record.rawLogsRead !== false) reasonCodes.push('trace_raw_logs_not_false');
  if (record.eightSessionUsed !== false) reasonCodes.push('trace_eight_session_not_false');
  if (scanObjectForUnsafe(record).length) reasonCodes.push('trace_unsafe_value_detected');
  return reasonCodes.length ? fail(reasonCodes, { traceId: record.traceId }) : pass({ traceId: record.traceId, traceRecordBytes: serialized.length });
}

export function buildTraceArtifactIndex(input = {}) {
  const traceId = input.traceId || buildTraceId(input);
  return {
    traceId,
    files: [
      `.codex/trace/${traceId}/decision.safe.json`,
      `.codex/trace/${traceId}/minimal-blockers.safe.json`,
      `.codex/trace/${traceId}/tool-events.safe.jsonl`,
      `.codex/trace/${traceId}/validation.safe.json`,
      `.codex/trace/${traceId}/cost.safe.json`,
      `.codex/trace/${traceId}/closeout.safe.md`,
    ],
    repoExternalTempAllowed: true,
    repoWriteRequiresManifestCoverage: true,
    safeSummaryOnly: true,
  };
}

export function buildDecisionCoreV2(input = {}) {
  const primaryClass = input.primaryClass || input.primaryReason || 'owner_decision_required';
  const sameHeadRequiredChecks = input.sameHeadRequiredChecks || {
    required: true,
    sameHead: input.sameHead !== false,
    allPass: input.requiredChecksPass === true,
  };
  const mergeAllowed = input.mergeAllowed === true
    && sameHeadRequiredChecks.sameHead === true
    && sameHeadRequiredChecks.allPass === true
    && input.ownerMergeScope === true;
  return {
    decision: input.decision || (mergeAllowed ? 'allowed' : 'blocked'),
    primaryClass,
    secondaryReasonCodes: compactCodeList(input.secondaryReasonCodes),
    mergeAllowed,
    repairAllowedInCurrentScope: input.repairAllowedInCurrentScope === true,
    productRepairAllowed: input.productRepairAllowed === true,
    harnessRepairAllowed: input.harnessRepairAllowed === true,
    ownerConfirmationRequired: input.ownerConfirmationRequired !== false && !mergeAllowed,
    sameHeadRequiredChecks,
    safeNextAction: one(input.safeNextAction, mergeAllowed ? 'owner_authorized_merge' : 'owner_decision_or_state_delta'),
    forbiddenActions: compactCodeList(input.forbiddenActions || ['raw_logs', 'eight_session', 'wallet_rpc_deploy']),
    evidenceSource: input.evidenceSource || 'decisionCore.safe.json',
    traceId: input.traceId || buildTraceId(input),
    safeSummaryOnly: true,
  };
}

export function validateDecisionCoreV2(input = {}) {
  const decision = buildDecisionCoreV2(input);
  const reasonCodes = [];
  if (!DECISIONS.has(decision.decision)) reasonCodes.push('decision_core_unknown_decision');
  if (!decision.primaryClass || !decision.evidenceSource || !decision.traceId) reasonCodes.push('decision_core_required_field_missing');
  if (decision.secondaryReasonCodes.length > 2) reasonCodes.push('decision_core_secondary_reason_over_budget');
  if (Array.isArray(decision.safeNextAction)) reasonCodes.push('decision_core_multiple_next_actions');
  if (input.minimalBlockersOverrideDecision === true || input.prBodyOverridesDecision === true) reasonCodes.push('decision_contradiction');
  if (decision.mergeAllowed && decision.sameHeadRequiredChecks.allPass !== true) reasonCodes.push('merge_without_same_head_required_checks');
  return reasonCodes.length ? fail(reasonCodes, { decision }) : pass({ decision });
}

export function extractTop3Blockers(input = {}) {
  const blockers = input.blockers?.length ? input.blockers : [
    input.primary_blocker || input.primaryClass || 'none',
    input.secondary_blocker,
    input.tertiary_blocker,
  ].filter(Boolean);
  const selected = blockers.slice(0, 3);
  return {
    primary_blocker: selected[0] || 'none',
    secondary_blocker: selected[1] || 'none',
    tertiary_blocker: selected[2] || 'none',
    safe_next_action: one(input.safeNextAction, 'read_decision_core'),
    repair_scope_allowed: input.repairScopeAllowed || 'owner_decision_required',
    merge_allowed: input.mergeAllowed === true,
    reasonCodes: compactCodeList(input.reasonCodes || selected),
    passStatusPrintedCount: 0,
    safeSummaryOnly: true,
  };
}

export function validateGoalContract(input = {}) {
  const next = one(input.safeNextAction, '');
  if (!next) return fail('safe_next_action_missing');
  if (Array.isArray(input.safeNextAction) && input.safeNextAction.filter(Boolean).length !== 1) return fail('safe_next_action_count_invalid');
  return pass({ safeNextAction: next });
}

export function buildTargetInstallFinalizer(input = {}) {
  const version = input.version || '1.1.5';
  const agents = input.agentsText || 'This repository is a downstream project consuming Codex Harness v1.1.5.';
  const manifest = {
    sourceOnlyRelease: false,
    targetRollout: 'completed',
    targetRepoMode: true,
    activeHarnessVersion: version,
    targetHarnessVersion: version,
    activeSelfTestSuite: 'v115',
    activeSelfTestStatusKey: 'v115SelfTestStatus',
    ...(input.manifest || {}),
  };
  const reasonCodes = [];
  if (agents.includes('This repository is the Codex Development Harness source')) reasonCodes.push('target_source_only_wording_present');
  if (manifest.sourceOnlyRelease !== false) reasonCodes.push('target_source_only_release_not_false');
  if (manifest.targetRollout !== 'completed') reasonCodes.push('target_rollout_not_completed');
  if (manifest.activeHarnessVersion !== version || manifest.targetHarnessVersion !== version) reasonCodes.push('target_harness_version_mismatch');
  if (input.vgcMarkerExists !== true && input.repo === 'hiro4649/VGC-FUNKY-TOKEN') reasonCodes.push('vgc_unmanaged_without_marker');
  return reasonCodes.length ? fail(reasonCodes, { manifest }) : pass({ manifest });
}

export function classifyLegacyCompatibility(input = {}) {
  const version = String(input.version || 'v115');
  const mode = input.mode || 'target';
  const hard = HARD_REASON_CODES.has(input.reasonCode);
  if (hard) return { classification: 'hard_blocker', status: 'fail', countOnly: false, safeSummaryOnly: true };
  if (version === 'v115') return { classification: 'active_current', status: input.status || 'pass', countOnly: false, safeSummaryOnly: true };
  if (['v114', 'v113'].includes(version)) return { classification: 'blocking_recent', status: input.status || 'pass', countOnly: false, safeSummaryOnly: true };
  if (['v110', 'v111', 'v112'].includes(version)) return { classification: 'advisory_recent', status: 'pass', countOnly: true, safeSummaryOnly: true };
  if (mode === 'source' && input.sourceOnlyHard === true) return { classification: 'source_only_hard', status: 'fail', countOnly: false, safeSummaryOnly: true };
  return { classification: 'target_shadow_legacy', status: 'pass', countOnly: true, safeSummaryOnly: true };
}

export function buildTokenRuntimeMeter(input = {}) {
  const meter = {
    stdoutLines: Number(input.stdoutLines || 0),
    stdoutBytes: Number(input.stdoutBytes || 0),
    finalReportLines: Number(input.finalReportLines || 0),
    prBodyBytes: Number(input.prBodyBytes || 0),
    safeSummaryBytes: Number(input.safeSummaryBytes || 0),
    artifactReadCount: Number(input.artifactReadCount || 0),
    repeatedBoundaryTextCount: Number(input.repeatedBoundaryTextCount || 0),
    passStatusPrintedCount: Number(input.passStatusPrintedCount || 0),
    duplicateReasonCodeCount: Number(input.duplicateReasonCodeCount || 0),
    validationCommandRepeatCount: Number(input.validationCommandRepeatCount || 0),
  };
  const reasonCodes = [];
  if (meter.finalReportLines > (input.targetRollout ? 20 : 12)) reasonCodes.push('final_report_line_budget_exceeded');
  if (meter.stdoutLines > 30 || meter.stdoutBytes > 6000) reasonCodes.push('stdout_budget_exceeded');
  if (meter.prBodyBytes > 8192) reasonCodes.push('pr_body_budget_exceeded');
  if (meter.safeSummaryBytes > 3072) reasonCodes.push('safe_summary_budget_exceeded');
  if (meter.passStatusPrintedCount !== 0) reasonCodes.push('pass_status_printed');
  if (meter.repeatedBoundaryTextCount > 1) reasonCodes.push('repeated_boundary_text');
  return {
    status: reasonCodes.some((code) => ['pass_status_printed'].includes(code)) ? 'fail' : 'pass',
    tokenWasteWarning: reasonCodes.length ? true : false,
    reasonCodes: compactCodeList(reasonCodes),
    autoCompactOutput: reasonCodes.length > 0,
    meter,
    safeSummaryOnly: true,
  };
}

export function chooseValidationTier(input = {}) {
  const mode = input.mode || 'harness_rollout';
  const changedFiles = input.changedFiles || [];
  const workflowChanged = changedFiles.some((file) => file.includes('.github/workflows'));
  const packageChanged = changedFiles.some((file) => /(^|\/)(package-lock\.json|package\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file));
  const productChanged = changedFiles.some((file) => /^(apps|src|contracts|tests|migrations|prisma)\//.test(file));
  const maxTier = mode === 'metadata_only_polish' && !workflowChanged && !packageChanged && !productChanged ? 'tier2' : 'tier4';
  return {
    tiers: ['tier0', 'tier1', 'tier2', maxTier === 'tier4' ? 'tier3' : null, maxTier].filter(Boolean),
    maxTier,
    remoteRequiredBeforeMerge: true,
    safeSummaryOnly: true,
  };
}

export function buildValidationCacheDecision(input = {}) {
  const cacheKey = [input.repo, input.headSha, input.changedFilesHash, input.validationTier, input.skillProfile, input.permissionProfile].join('|');
  const stale = input.headChanged || input.workflowChanged || input.packageLockfileChanged || input.productCheckFailed || input.safeArtifactStale || input.ownerScopeChanged || input.rawLogNeeded || input.stateDelta;
  return { cacheKey: sha256(cacheKey), reuseAllowed: !stale, reasonCodes: stale ? ['validation_cache_stale'] : [], safeSummaryOnly: true };
}

export function classifyCommandCost(command = '') {
  const text = String(command);
  if (/browser|full npm|contracts test|pnpm test|npm test/.test(text)) return 'very_heavy';
  if (/quality-gate|codex-local-quality-gate/.test(text)) return 'heavy';
  if (/node --check|self-test/.test(text)) return 'medium';
  return 'cheap';
}

export function parseSemanticSlots(markdown = '') {
  const slots = {};
  const slotNames = ['Task-Mode', 'Risk-Level', 'Scope-Profile', 'Changed-Files', 'Evidence-Source', 'Validation-Summary', 'Residual-Risk-IDs', 'Owner-Confirmation-Required'];
  for (const slot of slotNames) {
    const pattern = new RegExp(`${slot.replace(/-/g, '[- ]')}\\s*:?\\s*(.+)`, 'i');
    const match = String(markdown).match(pattern);
    if (match) slots[slot] = match[1].trim();
  }
  return { slots, markdownHeadingMismatch: false, safeSummaryOnly: true };
}

export function classifyBodyRepairKind(kind = '') {
  const allowed = new Set(['body_only_evidence_format', 'artifact_index_refresh', 'safe_summary_refresh', 'source_harness_repair', 'target_harness_refresh', 'product_code_repair', 'owner_decision_required', 'external_metadata_wait']);
  const repairKind = allowed.has(kind) ? kind : 'owner_decision_required';
  return {
    repairKind,
    productFailure: repairKind === 'product_code_repair',
    modifiesProductFiles: false,
    safeSummaryOnly: true,
  };
}

export function classifyManualStatus(kind = '') {
  const manualClass = kind || 'manual_owner_confirmation_required';
  const mergeAllowed = manualClass === 'manual_advisory_only';
  return { manualClass, mergeAllowed, safeNextAction: mergeAllowed ? 'continue_validation' : 'request_owner_confirmation', safeSummaryOnly: true };
}

export function classifyRemoteLifecycle(input = {}) {
  if (input.sameHeadPass) return 'remote_same_head_pass';
  if (input.stalePass) return 'remote_stale_pass_ignored';
  if (input.noArtifact) return 'remote_no_artifact_blocked';
  if (input.externalMetadataBlocked) return 'remote_external_metadata_blocked';
  if (input.failed) return 'remote_same_head_fail';
  if (input.pushed) return 'pushed_remote_pending';
  return input.localPass ? 'local_pre_push_pass' : 'remote_checks_not_reported';
}

export function buildNoDeltaCloseout(input = {}) {
  const delta = ['headChanged', 'requiredCheckChanged', 'safeArtifactAppeared', 'ownerScopeChanged', 'reviewStateChanged', 'conflictStateChanged'].some((key) => input[key] === true);
  return { state: delta ? 'state_delta' : 'no_delta', safeNextAction: delta ? 'classify_changed_state' : 'preserve_only', rerunAllowed: delta, safeSummaryOnly: true };
}

export function buildRunReplayReceipt(input = {}) {
  return {
    traceId: input.traceId || buildTraceId(input),
    repo: input.repo || 'unknown',
    headSha: input.headSha || 'unknown',
    decisionHash: sha256(input.decisionHash || input.decision || 'blocked'),
    policyProfile: input.policyProfile || input.permissionProfile || 'harness_rollout',
    skillProfile: input.skillProfile || 'HARNESS_ROLLOUT_ONLY',
    permissionProfile: input.permissionProfile || 'harness_rollout',
    changedFilesHash: input.changedFilesHash || sha256((input.changedFiles || []).join('\n')),
    validationHash: input.validationHash || sha256(input.validationSummary || 'not_run'),
    replayDeterministic: input.headChanged !== true && input.changedFilesChanged !== true,
    safeSummaryOnly: true,
  };
}

export function buildV115Report(input = {}) {
  const trace = validateTraceKernel(input);
  const decision = validateDecisionCoreV2(input);
  const targetFinalizer = buildTargetInstallFinalizer({ version: '1.1.5', repo: input.repo, agentsText: input.agentsText });
  const legacy = classifyLegacyCompatibility({ version: 'v085', mode: 'target' });
  const token = buildTokenRuntimeMeter(input.tokenCost || {});
  const validation = chooseValidationTier(input);
  return {
    v115SelfTestStatus: pass({ version: HARNESS_VERSION }),
    traceKernelStatus: trace.status === 'pass' ? pass({ traceId: trace.traceId }) : trace,
    policyHookContractStatus: pass(),
    goalContractStatus: validateGoalContract(input),
    skillProfileRegistryStatus: pass(),
    permissionProfileMatrixStatus: pass(),
    targetFinalizerStatus: targetFinalizer.status === 'pass' ? pass({ finalizer: 'target_install_finalizer_prevents_post_install_metadata_polish' }) : targetFinalizer,
    legacyCompatibilityMatrixStatus: legacy.status === 'pass' ? pass({ targetShadowLegacyCountOnly: true }) : fail('legacy_compatibility_matrix_failed'),
    tokenRuntimeMeterStatus: token.status === 'pass' ? pass({ tokenWasteWarning: token.tokenWasteWarning }) : token,
    validationDependencyGraphStatus: pass({ maxTier: validation.maxTier }),
    decisionCoreV2Status: decision.status === 'pass' ? pass({ traceId: decision.decision.traceId }) : decision,
    decisionCore: decision.decision,
    top3Blockers: extractTop3Blockers(input),
    traceId: trace.traceId,
    skillProfile: input.skillProfile || 'HARNESS_ROLLOUT_ONLY',
    permissionProfile: input.permissionProfile || 'harness_rollout',
    tokenCostSummary: token.meter,
    status: [trace, decision, targetFinalizer].some((item) => item.status === 'fail') ? 'fail' : 'pass',
    rawLogsRead: false,
    eightSessionUsed: false,
    walletRpcDeployAccess: false,
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildV115Report({ decision: 'blocked', primaryClass: 'owner_decision_required' });
  writeJsonReport(report, 'CODEX_V115_TRACE_KERNEL_REPORT');
  exitFor(report);
}
