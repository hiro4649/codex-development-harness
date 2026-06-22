#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from './codex-v128-integrity-lib.mjs';
import { parseJsonRejectDuplicateKeys } from './codex-v128-projection-reader.mjs';

const REQUIRED_TARGETS = [
  { kind: 'complex', repositoryFullName: 'hiro4649/CRIPTO-TIP' },
  { kind: 'restricted', repositoryFullName: 'hiro4649/VGC-FUNKY-TOKEN' },
];

const SHA_RE = /^[a-f0-9]{40}$/;
const DIGEST_RE = /^sha256:[a-f0-9]{64}$/;

function digestValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function isSha(value) {
  return SHA_RE.test(String(value || ''));
}

function isDigest(value) {
  return DIGEST_RE.test(String(value || ''));
}

function normalizeRepo(value) {
  return String(value || '').trim();
}

export function buildV128ActualTargetCanaryTargetDigest(target) {
  return digestValue({
    repositoryFullName: target.repositoryFullName,
    repositoryId: target.repositoryId,
    targetHeadSha: target.targetHeadSha,
    targetManifestDigest: target.targetManifestDigest,
    targetProfileDigest: target.targetProfileDigest,
    targetAgentsActiveBlockDigest: target.targetAgentsActiveBlockDigest,
    sourceCandidateSha: target.sourceCandidateSha,
    candidateBundleDigest: target.candidateBundleDigest,
    v127Status: target.v127Status,
    v128ShadowStatus: target.v128ShadowStatus,
    preservationMismatchCount: target.preservationMismatchCount,
    semanticForeignProfileLoadCount: target.semanticForeignProfileLoadCount,
    legacyActiveReadCount: target.legacyActiveReadCount,
    productRuntimeMutationCount: target.productRuntimeMutationCount,
    deployWalletRpcSecretContractMutationCount: target.deployWalletRpcSecretContractMutationCount,
    cacheState: target.cacheState,
    readLedgerDigest: target.readLedgerDigest,
  });
}

function validateTarget(target = {}, context = {}) {
  const reasonCodes = [];
  const repo = normalizeRepo(target.repositoryFullName);
  const expected = REQUIRED_TARGETS.find((item) => item.kind === target.kind);

  if (!expected) reasonCodes.push('actual_target_canary_kind_invalid');
  if (expected && repo !== expected.repositoryFullName) reasonCodes.push('actual_target_canary_unexpected_repository');
  if (!repo) reasonCodes.push('actual_target_canary_repository_missing');
  if (!String(target.repositoryId || '').trim()) reasonCodes.push('actual_target_canary_repository_id_missing');
  if (!isSha(target.targetHeadSha)) reasonCodes.push('actual_target_canary_target_head_missing');
  if (!isSha(target.sourceCandidateSha)) reasonCodes.push('actual_target_canary_source_candidate_missing');
  if (context.sourceCandidateSha && target.sourceCandidateSha !== context.sourceCandidateSha) {
    reasonCodes.push('actual_target_canary_source_candidate_mismatch');
  }
  for (const key of [
    'targetManifestDigest',
    'targetProfileDigest',
    'targetAgentsActiveBlockDigest',
    'candidateBundleDigest',
    'readLedgerDigest',
  ]) {
    if (!isDigest(target[key])) reasonCodes.push(`actual_target_canary_${key}_invalid`);
  }
  if (context.candidateBundleDigest && target.candidateBundleDigest !== context.candidateBundleDigest) {
    reasonCodes.push('actual_target_canary_candidate_bundle_mismatch');
  }
  if (target.v127Status !== 'pass') reasonCodes.push('actual_target_canary_v127_not_pass');
  if (target.v128ShadowStatus !== 'pass') reasonCodes.push('actual_target_canary_v128_shadow_not_pass');
  if (Number(target.preservationMismatchCount || 0) !== 0) reasonCodes.push('actual_target_canary_preservation_mismatch');
  if (Number(target.semanticForeignProfileLoadCount || 0) !== 0) reasonCodes.push('actual_target_canary_foreign_profile_loaded');
  if (Number(target.legacyActiveReadCount || 0) !== 0) reasonCodes.push('actual_target_canary_legacy_active_read');
  if (Number(target.productRuntimeMutationCount || 0) !== 0) reasonCodes.push('actual_target_canary_product_runtime_mutation');
  if (Number(target.deployWalletRpcSecretContractMutationCount || 0) !== 0) {
    reasonCodes.push('actual_target_canary_forbidden_capability_mutation');
  }
  if (target.rawLogStored === true) reasonCodes.push('actual_target_canary_raw_log_stored');
  if (target.localPathStored === true) reasonCodes.push('actual_target_canary_local_path_stored');
  if (target.targetWriteAttempted === true) reasonCodes.push('actual_target_canary_target_write_attempted');
  if (target.sourceActivationAuthorized === true) reasonCodes.push('actual_target_canary_source_activation_forbidden');
  if (target.targetRolloutAuthorized === true) reasonCodes.push('actual_target_canary_rollout_forbidden');
  if (target.deployWalletRpcAuthorized === true) reasonCodes.push('actual_target_canary_deploy_wallet_rpc_forbidden');

  const computedDigest = buildV128ActualTargetCanaryTargetDigest(target);
  if (!isDigest(target.targetResultDigest)) {
    reasonCodes.push('actual_target_canary_target_result_digest_missing');
  } else if (target.targetResultDigest !== computedDigest) {
    reasonCodes.push('actual_target_canary_target_result_digest_mismatch');
  }

  return {
    kind: target.kind || 'unknown',
    repositoryFullName: repo || 'missing',
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    targetHeadSha: target.targetHeadSha || 'missing',
    sourceCandidateSha: target.sourceCandidateSha || 'missing',
    targetResultDigest: computedDigest,
    safeSummaryOnly: true,
  };
}

export function buildV128ActualTargetCanaryContract(input = {}) {
  const sourceCandidateSha = String(input.sourceCandidateSha || '');
  const candidateBundleDigest = String(input.candidateBundleDigest || '');
  const targets = Array.isArray(input.targets) ? input.targets : [];
  const context = { sourceCandidateSha, candidateBundleDigest };
  const targetResults = targets.map((target) => validateTarget(target, context));
  const reasonCodes = [];

  if (!isSha(sourceCandidateSha)) reasonCodes.push('actual_target_canary_source_candidate_missing');
  if (!isDigest(candidateBundleDigest)) reasonCodes.push('actual_target_canary_candidate_bundle_missing');
  if (targets.length !== REQUIRED_TARGETS.length) reasonCodes.push('actual_target_canary_target_count_invalid');
  for (const required of REQUIRED_TARGETS) {
    const matching = targetResults.filter((item) => item.kind === required.kind
      && item.repositoryFullName === required.repositoryFullName
      && item.status === 'pass');
    if (matching.length !== 1) reasonCodes.push(`actual_target_canary_${required.kind}_target_missing`);
  }
  for (const result of targetResults) {
    for (const reason of result.reasonCodes || []) reasonCodes.push(`${result.repositoryFullName}:${reason}`);
  }

  const status = reasonCodes.length ? 'fail' : 'pass';
  return {
    schemaVersion: '1.2.8',
    canaryKind: 'v128_actual_remote_target_canary',
    executionAuthority: 'remote_read_only',
    status,
    reasonCodes: [...new Set(reasonCodes)],
    sourceCandidateSha,
    candidateBundleDigest,
    requiredTargetCount: REQUIRED_TARGETS.length,
    targetCount: targets.length,
    passCount: targetResults.filter((item) => item.status === 'pass').length,
    sourceActivationAuthorized: false,
    targetRolloutAuthorized: false,
    deployWalletRpcAuthorized: false,
    rawLogsAllowed: false,
    localPathsAllowed: false,
    targetWritesAllowed: false,
    targetResults,
    resultDigest: digestValue({ sourceCandidateSha, candidateBundleDigest, targetResults }),
    safeSummaryOnly: true,
  };
}

export function validateV128ActualTargetCanaryContract(report = {}) {
  const reasons = [];
  if (report.schemaVersion !== '1.2.8') reasons.push('actual_target_canary_schema_invalid');
  if (report.canaryKind !== 'v128_actual_remote_target_canary') reasons.push('actual_target_canary_kind_invalid');
  if (report.executionAuthority !== 'remote_read_only') reasons.push('actual_target_canary_execution_authority_invalid');
  if (!isSha(report.sourceCandidateSha)) reasons.push('actual_target_canary_source_candidate_missing');
  if (!isDigest(report.candidateBundleDigest)) reasons.push('actual_target_canary_candidate_bundle_missing');
  if (report.sourceActivationAuthorized !== false) reasons.push('actual_target_canary_source_activation_forbidden');
  if (report.targetRolloutAuthorized !== false) reasons.push('actual_target_canary_rollout_forbidden');
  if (report.deployWalletRpcAuthorized !== false) reasons.push('actual_target_canary_deploy_wallet_rpc_forbidden');
  if (report.rawLogsAllowed !== false) reasons.push('actual_target_canary_raw_logs_forbidden');
  if (report.localPathsAllowed !== false) reasons.push('actual_target_canary_local_paths_forbidden');
  if (report.targetWritesAllowed !== false) reasons.push('actual_target_canary_target_writes_forbidden');
  if (!Array.isArray(report.targetResults) || report.targetResults.length !== REQUIRED_TARGETS.length) {
    reasons.push('actual_target_canary_target_results_invalid');
  }
  if (!isDigest(report.resultDigest)) reasons.push('actual_target_canary_result_digest_invalid');
  if (report.status === 'pass' && (report.reasonCodes || []).length > 0) {
    reasons.push('actual_target_canary_pass_with_reasons');
  }
  if (report.status === 'pass' && Number(report.passCount || 0) !== REQUIRED_TARGETS.length) {
    reasons.push('actual_target_canary_pass_count_invalid');
  }
  return reasons.length ? { status: 'fail', reasonCodes: [...new Set(reasons)], safeSummaryOnly: true } : {
    status: 'pass',
    targetCount: report.targetCount,
    passCount: report.passCount,
    resultDigest: report.resultDigest,
    safeSummaryOnly: true,
  };
}

function parseArgs() {
  const envJson = process.env.CODEX_V128_ACTUAL_TARGET_CANARY_JSON;
  if (!envJson) return {};
  try {
    return parseJsonRejectDuplicateKeys(envJson);
  } catch {
    return {};
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildV128ActualTargetCanaryContract(parseArgs());
  const validation = validateV128ActualTargetCanaryContract(report);
  process.stdout.write(`${canonicalJson({ report, validation })}${os.EOL}`);
  process.exit(report.status === 'pass' && validation.status === 'pass' ? 0 : 1);
}
