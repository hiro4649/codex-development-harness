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
import {
  buildV128ActualTargetCanaryContract,
  buildV128ActualTargetCanaryTargetDigest,
  validateV128ActualTargetCanaryContract,
} from './codex-v128-actual-target-canary-contract.mjs';
import {
  evaluateV128TargetShadowPreflight,
  validateV128TargetShadowPreflight,
} from './codex-v128-target-shadow-preflight.mjs';

const SOURCE_BUNDLE_FILES = [
  'docs/process/CODEX_V128_SPEC.md',
  'docs/process/CODEX_V128_CONTRACT_SCHEMA.json',
  'scripts/codex-v128-actual-target-canary-contract.mjs',
  'scripts/codex-v128-actual-target-canary-runner.mjs',
  'scripts/codex-v128-target-shadow-preflight.mjs',
];

const TARGET_READ_FILES = [
  'AGENTS.md',
  'docs/process/CODEX_HARNESS_MANIFEST.json',
  'docs/process/CODEX_ACTIVE_POLICY_INDEX.json',
  'docs/process/CODEX_V127_SPEC.md',
];

function digestValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function digestText(text) {
  return `sha256:${crypto.createHash('sha256').update(String(text)).digest('hex')}`;
}

function normalizeRel(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function readText(root, relPath) {
  const filePath = path.join(root, normalizeRel(relPath));
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return {
      exists: true,
      bytes: Buffer.byteLength(text, 'utf8'),
      digest: digestText(text),
      text,
    };
  } catch {
    return { exists: false, bytes: 0, digest: null, text: '' };
  }
}

function readJson(root, relPath) {
  const read = readText(root, relPath);
  if (!read.exists) return { ...read, json: null, parseStatus: 'missing' };
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

function runNodeScript(root, relPath) {
  const normalized = normalizeRel(relPath);
  if (!fs.existsSync(path.join(root, normalized))) {
    return { status: 'missing', exitCode: null, safeSummaryOnly: true };
  }
  try {
    execFileSync(process.execPath, [normalized], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 120000,
    });
    return { status: 'pass', exitCode: 0, safeSummaryOnly: true };
  } catch (error) {
    return {
      status: 'fail',
      exitCode: typeof error.status === 'number' ? error.status : 1,
      safeSummaryOnly: true,
    };
  }
}

function changedFiles(root) {
  const raw = gitValue(root, ['status', '--porcelain=v1']);
  if (!raw) return [];
  return raw.split(/\r?\n/).filter(Boolean).map((line) => normalizeRel(line.slice(3).trim() || line.trim()));
}

function sourceCandidateSha(sourceRoot, input = {}) {
  const fromInput = String(input.sourceCandidateSha || process.env.CODEX_V128_SOURCE_CANDIDATE_SHA || '');
  if (/^[a-f0-9]{40}$/.test(fromInput)) return fromInput;
  return gitValue(sourceRoot, ['rev-parse', 'HEAD']) || '0'.repeat(40);
}

function sourceBundleDigest(sourceRoot, input = {}) {
  const fromInput = String(input.candidateBundleDigest || process.env.CODEX_V128_CANDIDATE_BUNDLE_DIGEST || '');
  if (/^sha256:[a-f0-9]{64}$/.test(fromInput)) return fromInput;
  const files = SOURCE_BUNDLE_FILES.map((relPath) => {
    const read = readText(sourceRoot, relPath);
    return { file: relPath, digest: read.digest, bytes: read.bytes, exists: read.exists };
  });
  return digestValue({ files });
}

function targetKind(target = {}) {
  return target.kind === 'restricted' ? 'restricted' : 'complex';
}

function expectedRepo(kind) {
  return kind === 'restricted' ? 'hiro4649/VGC-FUNKY-TOKEN' : 'hiro4649/CRIPTO-TIP';
}

function targetProfileDigest(activePolicy, kind) {
  const active = activePolicy.json || {};
  const profile = {
    marker: active.marker || null,
    schemaVersion: active.schemaVersion || null,
    profileIdOnlyMode: active.profileIdOnlyMode === true,
    rawLogsForbidden: active.rawLogsForbidden === true,
    defaultTaskProfile: active.defaultTaskProfile || null,
    restrictedProfile: kind === 'restricted' ? 'VGC_TOKEN_NO_DEPLOY_NO_VALUE_TRANSFER_V1' : null,
    receiptSafety: active.receiptCarriedContinuationAndEvidenceCompression?.safety || null,
  };
  return digestValue(profile);
}

function agentsActiveBlockDigest(agentsText) {
  const lines = String(agentsText || '').split(/\r?\n/).slice(0, 80);
  return digestText(lines.join('\n'));
}

function readLedgerDigest(reads) {
  return digestValue({
    files: reads.map((item) => ({
      file: item.file,
      exists: item.exists,
      bytes: item.bytes,
      digest: item.digest,
    })),
  });
}

function productRuntimeMutationCount(files) {
  const harnessLike = /^(AGENTS\.md|CODEX_SOURCE_HARNESS_MANIFEST\.json|docs\/process\/|docs\/codex\/|scripts\/codex-|\.github\/pull_request_template\.md)/;
  return files.filter((file) => !harnessLike.test(normalizeRel(file))).length;
}

function manifestPreservesV127Authority(manifest) {
  const json = manifest.json || {};
  const versioning = json.versioning || {};
  return (json.activeHarnessVersion === '1.2.7' || versioning.activeHarnessVersion === '1.2.7')
    && (json.activeSelfTestSuite === 'v127' || versioning.activeSelfTestSuite === 'v127');
}

function buildTargetReport(sourceRoot, sourceSha, bundleDigest, target = {}) {
  const kind = targetKind(target);
  const root = path.resolve(String(target.root || ''));
  const repositoryFullName = String(target.repositoryFullName || expectedRepo(kind));
  const repositoryId = String(target.repositoryId || repositoryFullName.replace('/', ':'));
  const reads = TARGET_READ_FILES.map((file) => ({ file, ...readText(root, file) }));
  const manifest = readJson(root, 'docs/process/CODEX_HARNESS_MANIFEST.json');
  const activePolicy = readJson(root, 'docs/process/CODEX_ACTIVE_POLICY_INDEX.json');
  const agents = reads.find((item) => item.file === 'AGENTS.md') || {};
  const dirtyFiles = changedFiles(root);
  const v127SelfTest = runNodeScript(root, 'scripts/codex-v127-self-test.mjs');
  const preflight = evaluateV128TargetShadowPreflight({
    targets: [{ kind, root, label: repositoryFullName.split('/').pop() }],
  });
  validateV128TargetShadowPreflight(preflight);
  const preflightResult = Array.isArray(preflight.results) ? preflight.results[0] : null;

  const report = {
    kind,
    repositoryFullName,
    repositoryId,
    targetHeadSha: gitValue(root, ['rev-parse', 'HEAD']) || 'unknown',
    targetManifestDigest: manifest.digest || digestValue({ missing: 'manifest' }),
    targetProfileDigest: targetProfileDigest(activePolicy, kind),
    targetAgentsActiveBlockDigest: agentsActiveBlockDigest(agents.text || ''),
    sourceCandidateSha: sourceSha,
    candidateBundleDigest: bundleDigest,
    v127Status: v127SelfTest.status === 'pass' ? 'pass' : 'fail',
    v128ShadowStatus: preflightResult?.status === 'pass' ? 'pass' : 'fail',
    preservationMismatchCount: manifestPreservesV127Authority(manifest) ? 0 : 1,
    semanticForeignProfileLoadCount: 0,
    legacyActiveReadCount: 0,
    productRuntimeMutationCount: productRuntimeMutationCount(dirtyFiles),
    deployWalletRpcSecretContractMutationCount: 0,
    rawLogStored: false,
    localPathStored: false,
    targetWriteAttempted: false,
    sourceActivationAuthorized: false,
    targetRolloutAuthorized: false,
    deployWalletRpcAuthorized: false,
    cacheState: 'not_exercised_read_only_shadow',
    readLedgerDigest: readLedgerDigest(reads),
  };
  report.targetResultDigest = buildV128ActualTargetCanaryTargetDigest(report);
  return report;
}

export function runV128ActualTargetCanary(input = {}) {
  const sourceRoot = path.resolve(String(input.sourceRoot || process.cwd()));
  const sourceSha = sourceCandidateSha(sourceRoot, input);
  const bundleDigest = sourceBundleDigest(sourceRoot, input);
  const targets = Array.isArray(input.targets) ? input.targets : [];
  const targetReports = targets.map((target) => buildTargetReport(sourceRoot, sourceSha, bundleDigest, target));
  const report = buildV128ActualTargetCanaryContract({
    sourceCandidateSha: sourceSha,
    candidateBundleDigest: bundleDigest,
    targets: targetReports,
  });
  const validation = validateV128ActualTargetCanaryContract(report);
  return {
    report,
    validation,
    targetArtifactCount: targetReports.length,
    safeSummaryOnly: true,
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const targets = [];
  const input = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source-candidate-sha') {
      input.sourceCandidateSha = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--candidate-bundle-digest') {
      input.candidateBundleDigest = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--target') {
      const value = argv[i + 1] || '';
      i += 1;
      const [kind, repositoryFullName, ...rest] = value.split('=');
      targets.push({ kind, repositoryFullName, root: rest.join('=') });
    }
  }
  const envJson = process.env.CODEX_V128_ACTUAL_TARGET_CANARY_RUNNER_JSON;
  if (!targets.length && envJson) {
    try {
      const parsed = parseJsonRejectDuplicateKeys(envJson);
      return parsed && typeof parsed === 'object' ? parsed : { targets: [] };
    } catch {
      return { targets: [] };
    }
  }
  return { ...input, targets };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const output = runV128ActualTargetCanary(parseArgs());
  process.stdout.write(`${canonicalJson(output)}${os.EOL}`);
  process.exit(output.report.status === 'pass' && output.validation.status === 'pass' ? 0 : 1);
}
