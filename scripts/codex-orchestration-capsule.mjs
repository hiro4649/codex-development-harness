#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.9

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { pass, fail } from './codex-outcome-contract.mjs';

export const V119_OPERATOR_STATUS_KEYS = [
  'orchestrationModeStatus',
  'permissionGrantStatus',
  'localRepoReadinessStatus',
  'workerContractStatus',
  'workerProofStatus',
  'reviewChainStatus',
  'ownerDecisionBriefStatus',
  'finalDecisionPointerStatus',
];

export const V119_P0_ARTIFACTS = [
  'codex-orchestration-capsule.safe.json',
  'codex-worker-proof.safe.json',
  'codex-owner-decision-brief.safe.json',
];

const ORCHESTRATION_MODES = new Set([
  'analysis_only',
  'single_repo_task',
  'multi_repo_watch',
  'worker_split_task',
  'preserve_watch',
]);

const TERMINAL_ACTIONS = new Set([
  'analysis_only',
  'create_pr_only',
  'preserve_only',
  'investigate_only',
  'merge_current_pr',
]);

const MUTATION_ACTIONS = new Set(['commit', 'push', 'createPr', 'rerunCi', 'fixCi']);
const CURRENT_OWNER_ONLY_ACTIONS = new Set(['merge', 'release', 'publish', 'secretAccess', 'walletRpcDeployAccess']);

function status(ok, reasonCodes = [], extra = {}) {
  return ok ? pass(extra) : fail(reasonCodes, extra);
}

function truncateList(values = [], limit = 50) {
  return Array.isArray(values) ? values.slice(0, limit).map(String) : [];
}

function defaultOwnerPriorScope(input = {}) {
  return {
    scopeId: input.scopeId || null,
    repo: input.repo || null,
    allowedActions: truncateList(input.allowedActions, 20),
    expiresAt: input.expiresAt || null,
    headSha: input.headSha || null,
    branchConstraint: input.branchConstraint || null,
    sourceInstructionRef: input.sourceInstructionRef || null,
  };
}

export function buildOrchestrationCapsule(input = {}) {
  const permissionGrant = {
    triage: input.triage === true,
    monitor: input.monitor === true,
    implement: input.implement === true,
    commit: input.commit === true,
    push: input.push === true,
    createPr: input.createPr === true,
    rerunCi: input.rerunCi === true,
    fixCi: input.fixCi === true,
    merge: input.merge === true,
    closeIssue: input.closeIssue === true,
    release: input.release === true,
    publish: input.publish === true,
    externalToolUse: input.externalToolUse === true,
    secretAccess: input.secretAccess === true,
    walletRpcDeployAccess: input.walletRpcDeployAccess === true,
    permissionEvidenceSource: input.permissionEvidenceSource || 'none',
    mutationPermissionAuthority: input.mutationPermissionAuthority || 'none',
    mergePermissionAuthority: input.mergePermissionAuthority || 'none',
    releasePermissionAuthority: input.releasePermissionAuthority || 'none',
    walletRpcDeployPermissionAuthority: input.walletRpcDeployPermissionAuthority || 'none',
    secretAccessAuthority: input.secretAccessAuthority || 'none',
    ownerPriorScope: defaultOwnerPriorScope(input.ownerPriorScope || {}),
    scope: input.scope || 'source_only',
  };
  const localRepoReadiness = {
    repo: input.repo || 'hiro4649/codex-development-harness',
    cwd: input.cwd || 'safe_path_redacted',
    branch: input.branch || 'unknown',
    defaultBranch: input.defaultBranch || 'main',
    pullFfOnlyStatus: input.pullFfOnlyStatus || 'not_required_with_reason',
    worktreeCleanBefore: input.worktreeCleanBefore !== false,
    worktreeCleanAfter: input.worktreeCleanAfter !== false,
    dirtyWorktreePolicy: input.dirtyWorktreePolicy || 'not_applicable',
    destructiveRecoveryAttempted: input.destructiveRecoveryAttempted === true,
    frozenBranchDetected: input.frozenBranchDetected === true,
    wrongRepoDetected: input.wrongRepoDetected === true,
  };
  const workerContract = {
    workerId: input.workerId || 'single_worker',
    repo: input.repo || 'hiro4649/codex-development-harness',
    itemUrl: input.itemUrl || null,
    allowedFiles: truncateList(input.allowedFiles, 50),
    forbiddenFiles: truncateList(input.forbiddenFiles, 50),
    forbiddenScopeProfile: input.forbiddenScopeProfile || 'SOURCE_HARNESS_BODY_ONLY_V119',
    acceptanceCriteria: truncateList(input.acceptanceCriteria, 8),
    nonGoals: truncateList(input.nonGoals, 8),
    stopBoundary: truncateList(input.stopBoundary, 8),
    requiredProof: truncateList(input.requiredProof, 8),
    mustNotDelegate: input.mustNotDelegate !== false,
    terminalAction: input.terminalAction || 'create_pr_only',
    contextBudgetTokens: Math.min(Number(input.contextBudgetTokens || 3000), 3000),
  };
  return {
    orchestrationVersion: '1',
    activeHarnessVersion: '1.1.9',
    finalAuthority: 'v1.1.8_final_decision_kernel',
    orchestrationMode: input.orchestrationMode || 'single_repo_task',
    stateDelta: input.stateDelta === true,
    permissionGrant,
    localRepoReadiness,
    workerContract,
    lightHeartbeat: {
      routineHeartbeatOutput: 'silent',
      stateDeltaDetected: input.stateDelta === true,
      interventionAllowed: input.interventionAllowed === true,
      interventionReason: input.interventionReason || 'none',
    },
    evidenceBundle: {
      bundleId: input.evidenceBundleId || null,
      canBundleLowRiskEvidence: input.canBundleLowRiskEvidence === true,
      bundleReason: input.bundleReason || 'not_required_with_reason',
      newDocsPrRecommended: input.newDocsPrRecommended === true,
    },
    preserveExitCondition: {
      type: input.preserveExitType || 'none',
      safeNextAction: input.preserveExitSafeNextAction || 'none',
    },
    safeNextAction: input.safeNextAction || 'owner_merge_decision_only_after_same_head_pass',
    rawLogsRead: false,
    eightSessionUsed: false,
    safeSummaryOnly: true,
  };
}

function ownerPriorScopeValid(scope = {}) {
  if (!scope || typeof scope !== 'object') return false;
  const hasConstraint = Boolean(scope.headSha || scope.branchConstraint);
  return Boolean(scope.scopeId && scope.repo && Array.isArray(scope.allowedActions) && scope.allowedActions.length && scope.expiresAt && scope.sourceInstructionRef && hasConstraint);
}

export function validatePermissionGrant(grant = {}) {
  const reasons = [];
  if (grant.permissionEvidenceSource === 'repository_policy') {
    for (const action of [...MUTATION_ACTIONS, ...CURRENT_OWNER_ONLY_ACTIONS]) {
      if (grant[action] === true) reasons.push(`repository_policy_cannot_authorize_${action}`);
    }
  }
  if (grant.mutationPermissionAuthority === 'owner_prior_scope_only') {
    if (!ownerPriorScopeValid(grant.ownerPriorScope)) reasons.push('owner_prior_scope_metadata_missing');
    for (const action of MUTATION_ACTIONS) {
      if (grant[action] === true && !grant.ownerPriorScope?.allowedActions?.includes(action)) reasons.push(`owner_prior_scope_missing_${action}`);
    }
  }
  for (const action of CURRENT_OWNER_ONLY_ACTIONS) {
    if (grant[action] !== true) continue;
    const authorityKey = action === 'walletRpcDeployAccess' ? 'walletRpcDeployPermissionAuthority'
      : action === 'secretAccess' ? 'secretAccessAuthority'
        : `${action}PermissionAuthority`;
    if (grant[authorityKey] !== 'owner_explicit_current_only') reasons.push(`${action}_requires_owner_explicit_current_only`);
  }
  if (grant.createPr === true && !['owner_prior_scope_only', 'owner_explicit_only'].includes(grant.mutationPermissionAuthority)) reasons.push('create_pr_requires_owner_scope');
  if (grant.push === true && grant.merge === true && grant.mergePermissionAuthority !== 'owner_explicit_current_only') reasons.push('push_permission_does_not_grant_merge');
  return reasons.length ? fail(reasons) : pass({ permissionEvidenceSource: grant.permissionEvidenceSource || 'none' });
}

export function validateLocalRepoReadiness(readiness = {}) {
  const reasons = [];
  if (readiness.wrongRepoDetected === true) reasons.push('wrong_repo_blocks_worker_execution');
  if (readiness.frozenBranchDetected === true || readiness.branch === 'codex/iris-harness-validation-compat-preservation-20260612') reasons.push('frozen_iris_dirty_cascade_branch_blocks_worker_execution');
  if (readiness.destructiveRecoveryAttempted === true) reasons.push('destructive_recovery_attempt_without_owner_scope');
  if (readiness.worktreeCleanBefore !== true || readiness.worktreeCleanAfter !== true) reasons.push('dirty_worktree_blocks_worker_execution');
  if (readiness.pullFfOnlyStatus === 'fail') reasons.push('pull_ff_only_failure_blocks_worker_execution');
  return reasons.length ? fail(reasons) : pass({ pullFfOnlyStatus: readiness.pullFfOnlyStatus || 'not_required_with_reason' });
}

export function validateWorkerContract(contract = {}) {
  const reasons = [];
  if (!contract.workerId || !contract.repo) reasons.push('worker_contract_required_before_implementation');
  if (!TERMINAL_ACTIONS.has(contract.terminalAction)) reasons.push('worker_contract_terminal_action_invalid');
  if (contract.mustNotDelegate !== true) reasons.push('worker_must_not_delegate_by_default');
  if (Number(contract.contextBudgetTokens || 0) > 3000) reasons.push('worker_contract_context_budget_max_3000');
  for (const key of ['allowedFiles', 'forbiddenFiles', 'acceptanceCriteria', 'stopBoundary']) {
    if (!Array.isArray(contract[key])) reasons.push(`worker_contract_${key}_missing`);
  }
  if (!contract.forbiddenScopeProfile) reasons.push('worker_contract_forbidden_scope_profile_missing');
  return reasons.length ? fail(reasons) : pass({ terminalAction: contract.terminalAction });
}

export function validateOrchestrationCapsule(capsule = {}) {
  const modeOk = ORCHESTRATION_MODES.has(capsule.orchestrationMode) && capsule.finalAuthority === 'v1.1.8_final_decision_kernel';
  return {
    orchestrationModeStatus: status(modeOk, ['orchestration_mode_invalid_or_final_authority_changed'], { orchestrationMode: capsule.orchestrationMode }),
    permissionGrantStatus: validatePermissionGrant(capsule.permissionGrant || {}),
    localRepoReadinessStatus: validateLocalRepoReadiness(capsule.localRepoReadiness || {}),
    workerContractStatus: validateWorkerContract(capsule.workerContract || {}),
  };
}

export function buildOrchestrationReport(input = {}) {
  const capsule = buildOrchestrationCapsule(input);
  return {
    orchestrationCapsule: capsule,
    ...validateOrchestrationCapsule(capsule),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildOrchestrationReport();
  if (process.env.CODEX_ORCHESTRATION_CAPSULE_PATH) {
    fs.writeFileSync(process.env.CODEX_ORCHESTRATION_CAPSULE_PATH, JSON.stringify(report.orchestrationCapsule, null, 2));
  }
  writeJsonReport({ orchestrationModeStatus: report.orchestrationModeStatus, ...report, status: Object.values(validateOrchestrationCapsule(report.orchestrationCapsule)).every((item) => item.status === 'pass') ? 'pass' : 'fail', safeSummaryOnly: true }, 'CODEX_ORCHESTRATION_CAPSULE_REPORT');
  exitFor({ status: Object.values(validateOrchestrationCapsule(report.orchestrationCapsule)).every((item) => item.status === 'pass') ? 'pass' : 'fail' });
}
