#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  isPrContext,
  normalizePath,
  readText,
  scanObjectForUnsafe,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';

function safeJson(env, name) {
  if (!env[name]) return null;
  try {
    return JSON.parse(env[name]);
  } catch {
    return null;
  }
}

function list(value) {
  if (Array.isArray(value)) return value.map(normalizePath).filter(Boolean).sort();
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed)) return parsed.map(normalizePath).filter(Boolean).sort();
  } catch {
    // Fall through.
  }
  return String(value).split(/[\r\n,]+/).map((item) => normalizePath(item.trim())).filter(Boolean).sort();
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex').slice(0, 16);
}

function registryHash(env = process.env) {
  const text = readText(env.CODEX_CLASSIFICATION_REGISTRY_PATH || 'docs/process/CODEX_CLASSIFICATION_REGISTRY.json') || '';
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

export function buildRemoteLocalParityReport(env = process.env) {
  const localContext = safeJson(env, 'CODEX_LOCAL_CONTEXT_JSON') || {
    changedFiles: list(env.CODEX_CHANGED_FILES),
    classificationCoverageStatus: safeJson(env, 'CODEX_CLASSIFICATION_COVERAGE_JSON') || {},
  };
  const remoteContext = safeJson(env, 'CODEX_REMOTE_CONTEXT_JSON') || null;
  const reasonCodes = [];
  const localFiles = list(localContext.changedFiles || env.CODEX_CHANGED_FILES);
  const remoteFiles = remoteContext ? list(remoteContext.changedFiles) : localFiles;
  if (remoteContext && JSON.stringify(localFiles) !== JSON.stringify(remoteFiles)) reasonCodes.push('remote_changed_files_mismatch');
  const localRegistryHash = env.CODEX_LOCAL_REGISTRY_HASH || registryHash(env);
  const remoteRegistryHash = remoteContext?.registryHash || env.CODEX_REMOTE_REGISTRY_HASH || localRegistryHash;
  if (remoteRegistryHash !== localRegistryHash) reasonCodes.push('remote_registry_hash_mismatch');
  const localRulesVersion = env.CODEX_LOCAL_RULES_VERSION || env.CODEX_RULES_VERSION || '0.9.0';
  const remoteRulesVersion = remoteContext?.rulesVersion || env.CODEX_REMOTE_RULES_VERSION || localRulesVersion;
  if (remoteRulesVersion !== localRulesVersion) reasonCodes.push('remote_classification_context_mismatch');
  const localUnknown = new Set(localContext.classificationCoverageStatus?.unknownClasses || []);
  const remoteUnknown = new Set(remoteContext?.classificationCoverageStatus?.unknownClasses || []);
  const remoteOnlyUnknown = [...remoteUnknown].filter((file) => !localUnknown.has(file));
  if (remoteOnlyUnknown.length) reasonCodes.push('remote_unknown_file_not_seen_locally');
  if (!remoteContext && isPrContext(env) && env.CODEX_REMOTE_CONTEXT_REQUIRED === '1') reasonCodes.push('remote_local_parity_failed');
  const payload = {
    localContextHash: hash(localContext),
    remoteContextHash: remoteContext ? hash(remoteContext) : hash(localContext),
    registryHash: localRegistryHash,
    rulesVersion: localRulesVersion,
    mismatchReasons: [...new Set(reasonCodes)],
    safeNextAction: reasonCodes.length ? 'Compare safe remote and local classification summaries.' : 'No parity action required.',
    reasonCodes: [...new Set(reasonCodes)],
  };
  if (scanObjectForUnsafe(payload).length) payload.reasonCodes.push('remote_local_parity_failed');
  let status = payload.reasonCodes.length ? 'fail' : 'pass';
  if (!isPrContext(env) && !remoteContext) status = 'not_applicable';
  return simpleStatus('remoteLocalParityStatus', status, payload);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildRemoteLocalParityReport();
    writeJsonReport(report, 'CODEX_REMOTE_LOCAL_PARITY_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('remoteLocalParityStatus', 'fail', {
      localContextHash: '',
      remoteContextHash: '',
      registryHash: '',
      rulesVersion: '0.9.0',
      mismatchReasons: ['remote_local_parity_failed'],
      safeNextAction: 'Re-run with safe parity context.',
      reasonCodes: ['remote_local_parity_failed'],
    });
    writeJsonReport(report, 'CODEX_REMOTE_LOCAL_PARITY_REPORT');
    process.exit(1);
  }
}
