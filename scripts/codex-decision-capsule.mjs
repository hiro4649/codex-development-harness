#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.6

import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';

export const HARNESS_VERSION = '1.1.6';
export const OPERATOR_STATUS_KEYS = [
  'decisionCapsuleStatus',
  'sameHeadStatus',
  'safeArtifactStatus',
  'scopeBoundaryStatus',
  'tokenBudgetStatus',
  'validationTierStatus',
  'continuationStatus',
];

export const DECISION_VALUES = new Set(['allowed', 'blocked', 'owner_decision_required']);
export const REPAIR_TYPES = new Set([
  'body_only',
  'artifact_index_refresh',
  'safe_summary_refresh',
  'source_harness_repair',
  'target_workflow_artifact_contract',
  'target_harness_refresh',
  'product_scope_required',
  'external_confirmation_required',
  'no_safe_route',
  'terminal_block',
]);

export function pass(extra = {}) {
  return { status: 'pass', reasonCodes: [], safeSummaryOnly: true, ...extra };
}

export function fail(reasonCodes, extra = {}) {
  return {
    status: 'fail',
    reasonCodes: [...new Set((Array.isArray(reasonCodes) ? reasonCodes : [reasonCodes]).filter(Boolean))].slice(0, 3),
    safeSummaryOnly: true,
    ...extra,
  };
}

export function one(value, fallback = 'owner_decision_or_state_delta') {
  if (Array.isArray(value)) return value.filter(Boolean)[0] || fallback;
  return value || fallback;
}

export function buildSameHeadRequiredChecks(input = {}) {
  return {
    required: input.required !== false,
    sameHead: input.sameHead !== false,
    allPass: input.allPass === true,
    headSha: input.headSha || 'unknown',
  };
}

export function buildDecisionCapsule(input = {}) {
  const sameHeadRequiredChecks = buildSameHeadRequiredChecks(input.sameHeadRequiredChecks || input);
  const repairType = REPAIR_TYPES.has(input.repairType) ? input.repairType : 'external_confirmation_required';
  const mergeAllowed = input.mergeAllowed === true
    && sameHeadRequiredChecks.required === true
    && sameHeadRequiredChecks.sameHead === true
    && sameHeadRequiredChecks.allPass === true
    && input.ownerMergeScope === true;
  return {
    harnessVersion: input.harnessVersion || HARNESS_VERSION,
    repo: input.repo || 'hiro4649/codex-development-harness',
    headSha: input.headSha || sameHeadRequiredChecks.headSha || 'unknown',
    decision: input.decision || (mergeAllowed ? 'allowed' : 'blocked'),
    mergeAllowed,
    primaryClass: input.primaryClass || 'owner_decision_required',
    primaryBlocker: input.primaryBlocker || input.primaryClass || 'owner_decision_required',
    safeNextAction: one(input.safeNextAction, mergeAllowed ? 'owner_authorized_merge_after_same_head_checks' : 'owner_decision_or_state_delta'),
    sameHeadRequiredChecks,
    scopeProfile: input.scopeProfile || 'source_harness',
    permissionProfile: input.permissionProfile || 'harness_implementation',
    repairType,
    repairAllowedInCurrentScope: input.repairAllowedInCurrentScope === true,
    productRepairAllowed: input.productRepairAllowed === true,
    harnessRepairAllowed: input.harnessRepairAllowed === true || repairType === 'source_harness_repair',
    rawLogsRead: false,
    eightSessionUsed: false,
    detailsRef: input.detailsRef || 'codex-decision-capsule.safe.json',
    safeSummaryOnly: true,
  };
}

export function validateDecisionCapsule(input = {}) {
  const capsule = input.harnessVersion ? input : buildDecisionCapsule(input);
  const reasonCodes = [];
  if (capsule.harnessVersion !== HARNESS_VERSION) reasonCodes.push('decision_capsule_version_mismatch');
  if (!DECISION_VALUES.has(capsule.decision)) reasonCodes.push('decision_capsule_unknown_decision');
  if (capsule.decision === 'allowed' && capsule.mergeAllowed !== true) reasonCodes.push('allowed_with_merge_false');
  if (capsule.mergeAllowed === false && !['blocked', 'owner_decision_required'].includes(capsule.decision)) reasonCodes.push('merge_false_requires_blocked_decision');
  if (!capsule.primaryClass || !capsule.primaryBlocker) reasonCodes.push('decision_capsule_required_field_missing');
  if (!capsule.safeNextAction || Array.isArray(capsule.safeNextAction)) reasonCodes.push('safe_next_action_count_invalid');
  if (!REPAIR_TYPES.has(capsule.repairType)) reasonCodes.push('repair_type_invalid');
  if (capsule.rawLogsRead !== false) reasonCodes.push('raw_logs_read');
  if (capsule.eightSessionUsed !== false) reasonCodes.push('eight_session_used');
  if (capsule.mergeAllowed && capsule.sameHeadRequiredChecks?.allPass !== true) reasonCodes.push('merge_without_same_head_required_checks');
  if (capsule.productRepairAllowed && capsule.scopeProfile === 'source_harness') reasonCodes.push('product_repair_in_source_harness_scope');
  return reasonCodes.length ? fail(reasonCodes, { capsule }) : pass({ capsule });
}

export function buildDecisionCapsuleArtifactIndex(capsule = buildDecisionCapsule()) {
  return {
    status: 'pass',
    artifactIndexed: true,
    firstReadArtifact: 'codex-decision-capsule.safe.json',
    artifacts: [
      { artifactName: 'codex-decision-capsule.safe.json', status: 'present', loadBearing: true },
      { artifactName: 'codex-decision-core.safe.json', status: 'supporting' },
      { artifactName: 'codex-minimal-blockers.safe.json', status: 'supporting' },
      { artifactName: 'codex-safe-artifact-index.safe.json', status: 'supporting' },
    ],
    decisionCapsuleHashSource: [capsule.harnessVersion, capsule.repo, capsule.headSha, capsule.decision, capsule.primaryClass].join('|'),
    safeSummaryOnly: true,
  };
}

export function detectDecisionConflict({ capsule = {}, decisionCore = {}, minimalBlockers = {}, safeArtifactIndex = {} } = {}) {
  const reasonCodes = [];
  if (decisionCore.primaryClass && decisionCore.primaryClass !== capsule.primaryClass) reasonCodes.push('decision_artifact_conflict');
  if (minimalBlockers.primary_blocker && minimalBlockers.primary_blocker !== capsule.primaryBlocker) reasonCodes.push('decision_artifact_conflict');
  if (safeArtifactIndex.decision && safeArtifactIndex.decision !== capsule.decision) reasonCodes.push('decision_artifact_conflict');
  return reasonCodes.length ? fail(reasonCodes, { capsule }) : pass({ capsule });
}

export function buildTokenHardBudgetStatus(input = {}) {
  const mode = input.mode || 'normal';
  const finalLimit = mode === 'rollout' ? 20 : (mode === 'failure' ? 14 : 10);
  const metrics = {
    finalLines: Number(input.finalLines || 0),
    prBodyBytes: Number(input.prBodyBytes || 0),
    safeArtifactReads: Number(input.safeArtifactReads || 0),
    operatorVisibleStatuses: Number(input.operatorVisibleStatuses || 0),
    reasonCodes: Number(input.reasonCodes || 0),
    repeatedForbiddenTextCount: Number(input.repeatedForbiddenTextCount || 0),
    passStatusListPrinted: Number(input.passStatusListPrinted || 0),
    fullJsonStdout: Number(input.fullJsonStdout || 0),
  };
  const reasonCodes = [];
  if (metrics.finalLines > finalLimit) reasonCodes.push('token_budget_blocked');
  if (metrics.prBodyBytes > 6144) reasonCodes.push('token_budget_blocked');
  if (metrics.safeArtifactReads > 3) reasonCodes.push('token_budget_blocked');
  if (metrics.operatorVisibleStatuses > 7) reasonCodes.push('token_budget_blocked');
  if (metrics.reasonCodes > 3) reasonCodes.push('token_budget_blocked');
  if (metrics.repeatedForbiddenTextCount !== 0) reasonCodes.push('token_budget_blocked');
  if (metrics.passStatusListPrinted !== 0) reasonCodes.push('token_budget_blocked');
  if (metrics.fullJsonStdout !== 0) reasonCodes.push('token_budget_blocked');
  return reasonCodes.length ? fail(reasonCodes, { metrics }) : pass({ metrics });
}

export function validateCanonicalStatusRegistry(statusKeys = OPERATOR_STATUS_KEYS) {
  const keys = [...new Set(statusKeys)];
  const invalid = keys.filter((key) => !OPERATOR_STATUS_KEYS.includes(key));
  if (keys.length > 7 || invalid.length) return fail('canonical_status_registry_violation', { keys, invalid });
  return pass({ keys, count: keys.length });
}

export function classifyRepoType(input = {}) {
  const repoType = input.repoType || 'source_harness';
  if (repoType === 'token_only_unmanaged') {
    return pass({
      repoType,
      requiresHarnessMarkerFiles: false,
      missingAGENTSBlocker: false,
      missingManifestBlocker: false,
      localHarnessLag: input.sourceConfirmed === true ? 'warning_only' : 'unknown',
      sourceHarnessAuthority: 'upstream_source',
    });
  }
  return pass({ repoType, requiresHarnessMarkerFiles: repoType !== 'external_runtime' });
}

export function validateExecutionIntent(input = {}) {
  const taskMode = input.taskMode || 'analysis_only';
  const writes = input.write === true || input.commit === true || input.push === true || input.pr === true || input.merge === true;
  if (['analysis_only', 'proposal_only'].includes(taskMode) && writes) return fail(`${taskMode}_write_forbidden`, { taskMode });
  if (taskMode === 'safe_triage_only' && (writes || input.rawLogsRead === true)) return fail('safe_triage_only_boundary_violation', { taskMode });
  if (taskMode === 'target_rollout' && input.sourceBodyTask === true) return fail('target_rollout_forbidden_in_source_body_task', { taskMode });
  return pass({ taskMode });
}

export function validateHardSafetyClaims(input = {}) {
  const reasonCodes = [];
  if (input.runtimeReadinessClaimed === true) reasonCodes.push('runtime_readiness_claimed');
  if (input.productionReadinessClaimed === true) reasonCodes.push('production_readiness_claimed');
  if (input.legalComplianceClaimed === true) reasonCodes.push('legal_compliance_claimed');
  if (input.youtubePolicyComplianceClaimed === true) reasonCodes.push('youtube_policy_compliance_claimed');
  if (input.walletRpcDeployAccess === true) reasonCodes.push('wallet_rpc_deploy_access');
  if (input.rawLogsRead === true) reasonCodes.push('raw_logs_read');
  if (input.eightSessionUsed === true) reasonCodes.push('eight_session_used');
  return reasonCodes.length ? fail(reasonCodes) : pass();
}

export function validateLegacyShadow(input = {}) {
  if (input.trueBlocker === true && input.shadowAttemptsHide === true) return fail('true_blocker_not_shadowable');
  return pass({ shadowCountOnly: true });
}

export function buildV116Report(input = {}) {
  const capsule = buildDecisionCapsule(input);
  const decisionCapsuleStatus = validateDecisionCapsule(capsule);
  const tokenBudgetStatus = buildTokenHardBudgetStatus(input.tokenBudget || { operatorVisibleStatuses: OPERATOR_STATUS_KEYS.length });
  const canonical = validateCanonicalStatusRegistry(input.operatorVisibleStatuses || OPERATOR_STATUS_KEYS);
  const conflict = detectDecisionConflict({ capsule, ...(input.supportingEvidence || {}) });
  const sameHeadStatus = capsule.sameHeadRequiredChecks.sameHead ? pass({ state: capsule.sameHeadRequiredChecks.allPass ? 'pass' : 'source-local-not-remote-yet' }) : fail('same_head_required_checks_failed');
  const decisionCapsuleArtifactIndex = buildDecisionCapsuleArtifactIndex(capsule);
  const safeArtifactStatus = input.safeArtifactMissing === true ? fail('missing_load_bearing_artifact') : pass({
    firstRead: 'codex-decision-capsule.safe.json',
    artifactName: 'codex-decision-capsule.safe.json',
    indexed: true,
  });
  const scopeBoundaryStatus = validateExecutionIntent({ taskMode: input.taskMode || 'harness_implementation', sourceBodyTask: true });
  const validationTierStatus = pass({ maxTier: 'tier4', remoteRequiredBeforeMerge: true });
  const continuationStatus = input.sameFailureAfterOneRepair === true ? fail('same_failure_after_one_repair') : pass({ safeNextAction: capsule.safeNextAction });
  const statuses = {
    decisionCapsuleStatus: [decisionCapsuleStatus, conflict].some((item) => item.status === 'fail') ? fail('decision_artifact_conflict', { capsule }) : decisionCapsuleStatus,
    sameHeadStatus,
    safeArtifactStatus,
    scopeBoundaryStatus,
    tokenBudgetStatus,
    validationTierStatus,
    continuationStatus,
  };
  return {
    v116SelfTestStatus: pass({ version: HARNESS_VERSION }),
    ...statuses,
    decisionCapsule: capsule,
    safeArtifactIndex: decisionCapsuleArtifactIndex,
    canonicalStatusRegistrySupport: canonical,
    operatorVisibleStatusCount: OPERATOR_STATUS_KEYS.length,
    legacyShadowCountOnly: true,
    passStatusesPrinted: 0,
    rawLogsRead: false,
    eightSessionUsed: false,
    walletRpcDeployAccess: false,
    status: Object.values(statuses).some((item) => item.status === 'fail') ? 'fail' : 'pass',
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildV116Report({ primaryClass: 'owner_decision_required' });
  writeJsonReport(report, 'CODEX_V116_DECISION_CAPSULE_REPORT');
  exitFor(report);
}
