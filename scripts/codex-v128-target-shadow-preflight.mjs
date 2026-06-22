#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from './codex-v128-integrity-lib.mjs';
import { parseJsonRejectDuplicateKeys } from './codex-v128-projection-reader.mjs';

const BOUNDED_READ_FILES = [
  'AGENTS.md',
  'docs/process/CODEX_HARNESS_MANIFEST.json',
  'docs/process/CODEX_ACTIVE_POLICY_INDEX.json',
  'docs/process/CODEX_V127_SPEC.md',
];

const GENERATED_OR_HEAVY_SEGMENTS = new Set([
  '.git',
  '.next',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
]);

const BOUNDED_FILE_BYTE_LIMITS = {
  'AGENTS.md': 32768,
  'docs/process/CODEX_HARNESS_MANIFEST.json': 65536,
  'docs/process/CODEX_ACTIVE_POLICY_INDEX.json': 65536,
  'docs/process/CODEX_V127_SPEC.md': 65536,
};

function digestValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function digestText(text) {
  return `sha256:${crypto.createHash('sha256').update(String(text)).digest('hex')}`;
}

function normalizeRel(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function hasHeavySegment(file) {
  return normalizeRel(file).split('/').some((segment) => GENERATED_OR_HEAVY_SEGMENTS.has(segment));
}

function readPrefixUtf8(filePath, byteLimit) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(byteLimit + 1);
    const bytesRead = fs.readSync(fd, buffer, 0, byteLimit + 1, 0);
    const boundedBytes = Math.min(bytesRead, byteLimit);
    return {
      text: buffer.subarray(0, boundedBytes).toString('utf8'),
      bytesRead,
      overLimit: bytesRead > byteLimit,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function readBoundedText(root, relPath, byteLimit = null) {
  const normalized = normalizeRel(relPath);
  if (!BOUNDED_READ_FILES.includes(normalized)) {
    return { exists: false, read: false, reason: 'not_in_bounded_read_set' };
  }
  if (hasHeavySegment(normalized)) {
    return { exists: false, read: false, reason: 'generated_or_heavy_path_forbidden' };
  }
  const absolute = path.join(root, normalized);
  if (!fs.existsSync(absolute)) return { exists: false, read: false };
  const stat = fs.statSync(absolute);
  if (!stat.isFile()) return { exists: false, read: false };
  const limit = byteLimit || BOUNDED_FILE_BYTE_LIMITS[normalized] || 32768;
  if (stat.size > limit) {
    const prefix = readPrefixUtf8(absolute, limit);
    return {
      exists: true,
      read: false,
      bytes: stat.size,
      prefixBytesRead: prefix.bytesRead,
      digest: digestText(prefix.text),
      reason: 'bounded_file_over_byte_limit',
    };
  }
  const text = fs.readFileSync(absolute, 'utf8');
  return {
    exists: true,
    read: true,
    bytes: Buffer.byteLength(text, 'utf8'),
    digest: digestText(text),
    text,
  };
}

function readBoundedJson(root, relPath) {
  const read = readBoundedText(root, relPath);
  if (!read.read) return { ...read, json: null, parseStatus: read.exists ? 'not_read' : 'missing' };
  try {
    return { ...read, json: parseJsonRejectDuplicateKeys(read.text), parseStatus: 'pass' };
  } catch {
    return { ...read, json: null, parseStatus: 'fail' };
  }
}

function gitValue(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function changedFiles(root) {
  const raw = gitValue(root, ['status', '--porcelain=v1']);
  if (!raw) return [];
  return raw.split(/\r?\n/).filter(Boolean).map((line) => normalizeRel(line.slice(3).trim() || line.trim()));
}

function classifyMutationFiles(files = []) {
  const harnessLike = /^(AGENTS\.md|CODEX_SOURCE_HARNESS_MANIFEST\.json|docs\/process\/|docs\/codex\/|scripts\/codex-|\.github\/pull_request_template\.md)/;
  const productRuntimeFiles = files.filter((file) => !harnessLike.test(normalizeRel(file)));
  return {
    observed: true,
    productRuntimeChanged: productRuntimeFiles.length > 0,
    productRuntimeMutationFileCount: productRuntimeFiles.length,
    productRuntimeMutationDigest: digestValue({ productRuntimeFiles }),
  };
}

function deriveReadLedger(readSet = []) {
  const readFiles = readSet.filter((item) => item.read === true).map((item) => normalizeRel(item.file));
  const foreignProfileFiles = readFiles.filter((file) => /(^|\/)(VOXWEAVE|LIVE2D|FUNKY|IRIS|VGC)(\/|_|-)/i.test(file));
  const legacyActiveFiles = readFiles.filter((file) => /CODEX_V(0|1[01])[0-9]_/.test(file));
  return {
    observed: true,
    readFileCount: readFiles.length,
    foreignProfilePathReadCount: foreignProfileFiles.length,
    foreignProfilePathReadDigest: digestValue({ foreignProfileFiles }),
    legacyActivePathReadCount: legacyActiveFiles.length,
    legacyActivePathReadDigest: digestValue({ legacyActiveFiles }),
  };
}

function buildTargetObservation(root) {
  const reads = Object.fromEntries(BOUNDED_READ_FILES.map((file) => [file, readBoundedText(root, file)]));
  const manifest = readBoundedJson(root, 'docs/process/CODEX_HARNESS_MANIFEST.json');
  const activePolicy = readBoundedJson(root, 'docs/process/CODEX_ACTIVE_POLICY_INDEX.json');
  const headSha = gitValue(root, ['rev-parse', 'HEAD']) || 'unknown';
  const branch = gitValue(root, ['branch', '--show-current']) || 'unknown';
  const remoteUrl = gitValue(root, ['config', '--get', 'remote.origin.url']) || 'unknown';
  const dirtyFiles = changedFiles(root);
  return {
    rootDigest: digestValue({ repoLeaf: path.basename(root), remoteUrl, branch }),
    branch,
    headSha,
    remoteDigest: digestValue({ remoteUrl }),
    dirtyFileCount: dirtyFiles.length,
    dirtyFiles,
    dirtyFileDigest: digestValue({ dirtyFiles }),
    manifest,
    activePolicy,
    reads,
    readSet: Object.entries(reads).map(([file, value]) => ({
      file,
      exists: value.exists === true,
      read: value.read === true,
      bytes: value.bytes || 0,
      digest: value.digest || null,
    })),
  };
}

function evidenceFromText(observation) {
  const agentsText = observation.reads['AGENTS.md']?.text || '';
  const v127SpecText = observation.reads['docs/process/CODEX_V127_SPEC.md']?.text || '';
  const manifest = observation.manifest.json || {};
  const activePolicy = observation.activePolicy.json || {};
  const profileText = `${agentsText}\n${v127SpecText}\n${canonicalJson(manifest)}\n${canonicalJson(activePolicy)}`;
  return {
    agentsMarkerV127: /CODEX_QUALITY_HARNESS_FILE\s+v1\.2\.7/.test(agentsText),
    activeHarnessV127: manifest?.versioning?.activeHarnessVersion === '1.2.7'
      || manifest?.activeHarnessVersion === '1.2.7'
      || /Active target harness:\s*v1\.2\.7\s*\/\s*v127/i.test(agentsText)
      || /CODEX_QUALITY_HARNESS_FILE\s+v1\.2\.7/.test(agentsText),
    activeSelfTestV127: manifest?.versioning?.activeSelfTestSuite === 'v127'
      || manifest?.activeSelfTestSuite === 'v127'
      || /v127/i.test(agentsText),
    profileTokenRestricted: /VGC_TOKEN_NO_DEPLOY_NO_VALUE_TRANSFER_V1|token-only|token only|no value transfer/i.test(profileText),
    noDeployBoundary: /no deploy|No deploy action is allowed|no-deploy/i.test(profileText),
    noWalletRpcBoundary: /No wallet access is allowed|No secret or RPC value exposure is allowed|walletRpcDeployAccess"\s*:\s*false/i.test(profileText),
    prBodyDisplayOnly: /PR bodies are human-rendered summaries only|PR body.*display-only|body is display-only|not the PR body/i.test(profileText),
  };
}

function evaluateOneTarget(target = {}) {
  const root = path.resolve(String(target.root || ''));
  const kind = target.kind === 'restricted' ? 'restricted' : 'complex';
  const label = String(target.label || path.basename(root) || kind).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 48);
  const reasonCodes = [];
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return {
      label,
      kind,
      status: 'fail',
      reasonCodes: ['target_root_missing'],
      safeSummaryOnly: true,
    };
  }
  const observation = buildTargetObservation(root);
  const evidence = evidenceFromText(observation);
  const readBytes = observation.readSet.reduce((sum, item) => sum + item.bytes, 0);
  const heavyReads = observation.readSet.filter((item) => hasHeavySegment(item.file));

  if (heavyReads.length) reasonCodes.push('target_preflight_heavy_read_detected');
  if (!evidence.agentsMarkerV127) reasonCodes.push('target_preflight_agents_v127_missing');
  if (!evidence.activeHarnessV127) reasonCodes.push('target_preflight_active_v127_missing');
  if (!evidence.activeSelfTestV127) reasonCodes.push('target_preflight_active_self_test_v127_missing');
  if (!evidence.prBodyDisplayOnly && kind === 'complex') reasonCodes.push('target_preflight_pr_body_display_only_missing');
  if (observation.dirtyFileCount !== 0) reasonCodes.push('target_preflight_dirty_worktree');
  if (kind === 'complex') {
    if (!observation.manifest.read || observation.manifest.parseStatus !== 'pass') reasonCodes.push('target_preflight_manifest_missing');
    if (!observation.activePolicy.read || observation.activePolicy.parseStatus !== 'pass') reasonCodes.push('target_preflight_active_policy_missing');
    if (!observation.reads['docs/process/CODEX_V127_SPEC.md']?.read) reasonCodes.push('target_preflight_v127_spec_missing');
  }
  if (kind === 'restricted') {
    if (!evidence.profileTokenRestricted) reasonCodes.push('target_preflight_token_restricted_profile_missing');
    if (!evidence.noDeployBoundary) reasonCodes.push('target_preflight_no_deploy_boundary_missing');
    if (!evidence.noWalletRpcBoundary) reasonCodes.push('target_preflight_no_wallet_rpc_boundary_missing');
  }

  const status = reasonCodes.length ? 'fail' : 'pass';
  const readLedger = deriveReadLedger(observation.readSet);
  const mutation = classifyMutationFiles(observation.dirtyFiles || []);
  return {
    label,
    kind,
    status,
    reasonCodes,
    headSha: observation.headSha,
    branch: observation.branch,
    rootDigest: observation.rootDigest,
    remoteDigest: observation.remoteDigest,
    dirtyFileCount: observation.dirtyFileCount,
    dirtyFileDigest: observation.dirtyFileDigest,
    activeHarnessVersion: evidence.activeHarnessV127 ? '1.2.7' : 'unknown',
    shadowCandidateVersion: '1.2.8',
    shadowAuthority: 'non_authoritative_target_preflight',
    sourceActivationAuthorized: false,
    targetRolloutAuthorized: false,
    productRuntimeChanged: mutation.productRuntimeChanged,
    productRuntimeMutationObserved: mutation.observed,
    productRuntimeMutationFileCount: mutation.productRuntimeMutationFileCount,
    productRuntimeMutationDigest: mutation.productRuntimeMutationDigest,
    deployWalletRpcAuthorized: false,
    readLedger,
    boundedReadFileCount: observation.readSet.filter((item) => item.read).length,
    boundedReadBytes: readBytes,
    boundedReadSetDigest: digestValue({ readSet: observation.readSet }),
    generatedOrHeavyPathReadCount: heavyReads.length,
    evidence,
    safeSummaryOnly: true,
  };
}

export function evaluateV128TargetShadowPreflight(input = {}) {
  const targets = Array.isArray(input.targets) ? input.targets : [];
  const results = targets.map((target) => evaluateOneTarget(target));
  const reasonCodes = [];
  if (!results.length) reasonCodes.push('target_preflight_no_targets');
  if (!results.some((item) => item.kind === 'complex' && item.status === 'pass')) reasonCodes.push('target_preflight_complex_target_missing');
  if (!results.some((item) => item.kind === 'restricted' && item.status === 'pass')) reasonCodes.push('target_preflight_restricted_target_missing');
  for (const result of results) {
    for (const reason of result.reasonCodes || []) reasonCodes.push(`${result.label}:${reason}`);
  }
  const status = reasonCodes.length ? 'fail' : 'pass';
  const summary = {
    schemaVersion: '1.2.8',
    preflightKind: 'v128_target_shadow_preflight',
    status,
    reasonCodes,
    targetCount: results.length,
    passCount: results.filter((item) => item.status === 'pass').length,
    complexPassCount: results.filter((item) => item.kind === 'complex' && item.status === 'pass').length,
    restrictedPassCount: results.filter((item) => item.kind === 'restricted' && item.status === 'pass').length,
    sourceActivationAuthorized: false,
    targetRolloutAuthorized: false,
    activeTargetAuthority: 'v1.2.7',
    shadowCandidateAuthority: 'non_authoritative_v1.2.8_preflight',
    totalBoundedReadBytes: results.reduce((sum, item) => sum + Number(item.boundedReadBytes || 0), 0),
    generatedOrHeavyPathReadCount: results.reduce((sum, item) => sum + Number(item.generatedOrHeavyPathReadCount || 0), 0),
    foreignProfilePathReadCount: results.reduce((sum, item) => sum + Number(item.readLedger?.foreignProfilePathReadCount || 0), 0),
    legacyActivePathReadCount: results.reduce((sum, item) => sum + Number(item.readLedger?.legacyActivePathReadCount || 0), 0),
    productRuntimeMutationFileCount: results.reduce((sum, item) => sum + Number(item.productRuntimeMutationFileCount || 0), 0),
    resultDigest: digestValue({ results }),
    safeSummaryOnly: true,
  };
  return { ...summary, results };
}

export function validateV128TargetShadowPreflight(report = {}) {
  const reasons = [];
  if (report.schemaVersion !== '1.2.8') reasons.push('target_preflight_schema_invalid');
  if (report.preflightKind !== 'v128_target_shadow_preflight') reasons.push('target_preflight_kind_invalid');
  if (report.sourceActivationAuthorized !== false) reasons.push('target_preflight_source_activation_forbidden');
  if (report.targetRolloutAuthorized !== false) reasons.push('target_preflight_rollout_authority_forbidden');
  if (Number(report.generatedOrHeavyPathReadCount || 0) !== 0) reasons.push('target_preflight_heavy_path_read');
  if (Number(report.foreignProfilePathReadCount || 0) !== 0) reasons.push('target_preflight_foreign_profile_path_read');
  if (Number(report.legacyActivePathReadCount || 0) !== 0) reasons.push('target_preflight_legacy_active_path_read');
  if (Number(report.productRuntimeMutationFileCount || 0) !== 0) reasons.push('target_preflight_product_runtime_mutation');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(report.resultDigest || ''))) reasons.push('target_preflight_digest_invalid');
  if (report.status === 'pass' && (Number(report.complexPassCount || 0) < 1 || Number(report.restrictedPassCount || 0) < 1)) {
    reasons.push('target_preflight_required_target_class_missing');
  }
  if (Array.isArray(report.results)) {
    for (const result of report.results) {
      if (result.sourceActivationAuthorized !== false) reasons.push('target_preflight_result_source_activation_forbidden');
      if (result.targetRolloutAuthorized !== false) reasons.push('target_preflight_result_rollout_forbidden');
      if (result.deployWalletRpcAuthorized !== false) reasons.push('target_preflight_result_wallet_rpc_forbidden');
      if (result.productRuntimeChanged !== false) reasons.push('target_preflight_result_product_runtime_mutation');
      if (Number(result.generatedOrHeavyPathReadCount || 0) !== 0) reasons.push('target_preflight_result_heavy_read');
    }
  }
  return reasons.length ? { status: 'fail', reasonCodes: [...new Set(reasons)], safeSummaryOnly: true } : {
    status: 'pass',
    targetCount: report.targetCount,
    passCount: report.passCount,
    totalBoundedReadBytes: report.totalBoundedReadBytes,
    safeSummaryOnly: true,
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const targets = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target') {
      const value = argv[i + 1] || '';
      i += 1;
      const [kind, ...rest] = value.split('=');
      targets.push({ kind, root: rest.join('=') });
    }
  }
  const envJson = process.env.CODEX_V128_TARGET_PREFLIGHT_JSON;
  if (!targets.length && envJson) {
    try {
      const parsed = parseJsonRejectDuplicateKeys(envJson);
      return Array.isArray(parsed.targets) ? parsed : { targets: [] };
    } catch {
      return { targets: [] };
    }
  }
  return { targets };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = evaluateV128TargetShadowPreflight(parseArgs());
  const validation = validateV128TargetShadowPreflight(report);
  const output = { report, validation };
  process.stdout.write(`${canonicalJson(output)}${os.EOL}`);
  process.exit(validation.status === 'pass' && report.status === 'pass' ? 0 : 1);
}
