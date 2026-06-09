#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.5

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { fail, pass } from './codex-v115-trace-kernel.mjs';

export const REQUIRED_SKILL_PROFILES = [
  'VOXWEAVE_PRODUCT_MINOR_BOUNDARY',
  'LIVE2D_REAL_EVIDENCE_BOUNDARY',
  'FUNKY_D8_BACKEND_BOUNDARY',
  'IRIS_PRIORITY1_NO_PRODUCTION_GO',
  'CRIPTO_TIP_CRYPTO_YOUTUBE_BOUNDARY',
  'VGC_NO_DEPLOY_OWNER_VALUES',
  'HARNESS_ROLLOUT_ONLY',
  'METADATA_ONLY_POLISH',
  'BLOCKED_TRIAGE_READONLY',
];

export const REQUIRED_PERMISSION_PROFILES = [
  'read_only_audit',
  'harness_rollout',
  'metadata_only_polish',
  'product_minor',
  'product_repair',
  'blocked_triage',
  'owner_values_no_deploy',
  'runtime_real_evidence_scope',
];

const PRE_TOOL_BLOCKERS = [
  ['raw log fetch', /gh\s+run\s+(view|download).*--log|gh\s+run\s+logs|download.*logs/i],
  ['eight_session', /8-session|eight-session|8セッション/i],
  ['wallet_rpc_deploy', /wallet|rpc|deploy|mint|sendToWallet|governance tx/i],
  ['package_lockfile_change', /package-lock\.json|pnpm-lock\.yaml|yarn\.lock/i],
  ['workflow_change', /\.github[\\/]+workflows/i],
  ['untracked_deletion_without_preservation', /Remove-Item.*-Recurse|rm\s+-rf/i],
  ['broad_target_install_surface_expansion', /target repos|all repos|broad copy/i],
];

function readRegistry(registryPath = path.join(process.cwd(), 'docs/process/CODEX_V115_PROFILE_REGISTRY.json')) {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

export function preToolPolicy(input = {}) {
  const command = String(input.command || input.path || '');
  const reasonCodes = [];
  for (const [reason, pattern] of PRE_TOOL_BLOCKERS) {
    if (pattern.test(command)) reasonCodes.push(reason);
  }
  if (input.productFileChange === true && input.scope === 'harness_rollout') reasonCodes.push('product_file_change_during_harness_rollout');
  if (input.repoExternalWrite === true && input.explicitRepoExternalTemp !== true) reasonCodes.push('repo_external_write_without_scope');
  if (input.secretLikeFileRead === true) reasonCodes.push('secret_like_file_read');
  return reasonCodes.length ? fail(reasonCodes, { allowed: false, phase: 'preToolPolicy' }) : pass({ allowed: true, phase: 'preToolPolicy' });
}

export function postToolPolicy(input = {}) {
  const reasonCodes = [];
  if (input.changedFilesAllowed === false) reasonCodes.push('changed_files_not_allowed');
  if (Number(input.stdoutBytes || 0) > Number(input.stdoutBudget || 6000)) reasonCodes.push('stdout_budget_exceeded');
  if (Number(input.artifactCount || 0) > Number(input.artifactBudget || 12)) reasonCodes.push('artifact_count_budget_exceeded');
  if (input.fullJsonPrinted === true) reasonCodes.push('full_json_printed');
  if (!input.safeNextAction) reasonCodes.push('safe_next_action_missing');
  if (input.rawLogsRead === true) reasonCodes.push('raw_logs_read');
  if (input.eightSessionUsed === true) reasonCodes.push('eight_session_used');
  return reasonCodes.length ? fail(reasonCodes, { phase: 'postToolPolicy' }) : pass({ phase: 'postToolPolicy' });
}

export function stopPolicy(input = {}) {
  const reasonCodes = [];
  if (input.decisionCoreExists !== true) reasonCodes.push('decision_core_missing');
  if (input.blocked === true && input.minimalBlockersExists !== true) reasonCodes.push('minimal_blockers_missing_when_blocked');
  if (input.traceCloseoutExists !== true) reasonCodes.push('trace_closeout_missing');
  if (!input.safeNextAction || Array.isArray(input.safeNextAction)) reasonCodes.push('safe_next_action_count_invalid');
  if (input.tokenBudgetRespected !== true && input.compacted !== true) reasonCodes.push('token_budget_not_respected');
  if (input.rawLogsRead === true) reasonCodes.push('raw_logs_read');
  if (input.eightSessionUsed === true) reasonCodes.push('eight_session_used');
  return reasonCodes.length ? fail(reasonCodes, { phase: 'stopPolicy' }) : pass({ phase: 'stopPolicy' });
}

export function validateSkillProfileRegistry(registry = readRegistry()) {
  const reasonCodes = [];
  for (const id of REQUIRED_SKILL_PROFILES) {
    const profile = registry.skillProfiles?.[id];
    if (!profile) reasonCodes.push('skill_profile_missing');
    else for (const key of ['allowedFileClasses', 'forbiddenFileClasses', 'forbiddenClaims', 'requiredEvidence', 'defaultPermissionProfile', 'defaultValidationTier', 'defaultFinalReportBudget']) {
      if (!(key in profile)) reasonCodes.push('skill_profile_required_field_missing');
    }
  }
  return reasonCodes.length ? fail(reasonCodes) : pass({ profileCount: Object.keys(registry.skillProfiles || {}).length });
}

export function validatePermissionProfileMatrix(registry = readRegistry()) {
  const reasonCodes = [];
  for (const id of REQUIRED_PERMISSION_PROFILES) {
    const profile = registry.permissionProfiles?.[id];
    if (!profile) reasonCodes.push('permission_profile_missing');
    else for (const key of ['read', 'write', 'shell', 'githubMetadata', 'githubMerge', 'productFiles', 'packageLockfile', 'workflow', 'externalNetwork', 'walletRpcDeploy', 'rawLogs', 'ownerConfirmation', 'eightSession']) {
      if (!(key in profile)) reasonCodes.push('permission_profile_required_field_missing');
    }
    if (profile?.rawLogs !== false) reasonCodes.push('permission_profile_raw_logs_not_false');
    if (profile?.eightSession !== false) reasonCodes.push('permission_profile_eight_session_not_false');
    if (id === 'harness_rollout' && profile?.walletRpcDeploy !== false) reasonCodes.push('harness_rollout_wallet_rpc_not_false');
  }
  return reasonCodes.length ? fail(reasonCodes) : pass({ profileCount: Object.keys(registry.permissionProfiles || {}).length });
}

export function buildPolicyHookContractStatus(input = {}) {
  const pre = preToolPolicy(input.pre || {});
  const post = postToolPolicy({ safeNextAction: 'read_decision_core', ...(input.post || {}) });
  const stop = stopPolicy({
    decisionCoreExists: true,
    minimalBlockersExists: true,
    traceCloseoutExists: true,
    safeNextAction: 'read_decision_core',
    tokenBudgetRespected: true,
    ...(input.stop || {}),
  });
  const skills = validateSkillProfileRegistry(input.registry);
  const permissions = validatePermissionProfileMatrix(input.registry);
  const failed = [pre, post, stop, skills, permissions].filter((item) => item.status === 'fail');
  return failed.length ? fail(failed.flatMap((item) => item.reasonCodes || [])) : pass({ phases: ['preToolPolicy', 'postToolPolicy', 'stopPolicy'] });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = {
    policyHookContractStatus: buildPolicyHookContractStatus(),
    skillProfileRegistryStatus: validateSkillProfileRegistry(),
    permissionProfileMatrixStatus: validatePermissionProfileMatrix(),
    safeSummaryOnly: true,
  };
  report.status = Object.values(report).some((value) => value?.status === 'fail') ? 'fail' : 'pass';
  writeJsonReport(report, 'CODEX_V115_POLICY_HOOKS_REPORT');
  exitFor(report);
}
