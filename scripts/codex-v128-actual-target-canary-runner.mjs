#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from './codex-v128-integrity-lib.mjs';
import {
  buildV128RoutineProjectionReadSurface,
  parseJsonRejectDuplicateKeys,
} from './codex-v128-projection-reader.mjs';
import { buildV128ManagedContextEmitter } from './codex-v128-managed-context-emitter.mjs';
import { runV128ActualValidationExecutorWithCache } from './codex-v128-serialized-cache-canary.mjs';
import { buildV128RoutineDecisionProjection } from './codex-local-quality-gate.mjs';
import {
  buildV128ActualTargetCanaryContract,
  buildV128ActualTargetCanaryTargetDigest,
  validateV128ActualTargetCanaryContract,
} from './codex-v128-actual-target-canary-contract.mjs';

const SOURCE_BUNDLE_FILES = [
  '.github/workflows/v128-actual-target-canary.yml',
  'docs/process/CODEX_V128_SPEC.md',
  'docs/process/CODEX_V128_CONTRACT_SCHEMA.json',
  'scripts/codex-v128-actual-target-canary-contract.mjs',
  'scripts/codex-v128-actual-target-canary-runner.mjs',
  'scripts/codex-v128-target-shadow-preflight.mjs',
  'scripts/codex-local-quality-gate.mjs',
  'scripts/codex-v128-projection-reader.mjs',
  'scripts/codex-v128-managed-context-emitter.mjs',
  'scripts/codex-v128-serialized-cache-canary.mjs',
  'scripts/codex-v128-validation-execution-plan.mjs',
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

function summarizeTargetGateJson(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const hasBlockingReasonArray = Array.isArray(json.reasonSummary?.blockingReasons);
  const blockingReasons = hasBlockingReasonArray ? json.reasonSummary.blockingReasons : [];
  const failureCount = Number(json.failureCount ?? json.blockerState?.blockingCount ?? (hasBlockingReasonArray ? blockingReasons.length : -1));
  const qualityScore = Number(json.qualityScore ?? json.qualityScoreStatus?.score ?? -1);
  return {
    status: String(json.status || json.reasonSummary?.status || 'unknown'),
    failureCount,
    qualityScore,
    safeNextAction: String(json.finalDecisionPointer?.safeNextAction || json.safeNextAction || 'unknown'),
    safeSummaryOnly: true,
  };
}

function summarizeTargetGateLineText(text = '') {
  const values = {};
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([A-Za-z][A-Za-z0-9]*):\s*(.+)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  const status = String(values.status || '').toLowerCase();
  const qualityScore = Number(values.qualityScore ?? values.targetQualityScore);
  const qualityStatus = String(values.qualityScoreStatus || values.targetQualityScoreStatus || '').toLowerCase();
  if (!['pass', 'fail'].includes(status) || !Number.isFinite(qualityScore)) return null;
  return {
    status,
    failureCount: status === 'pass' && (qualityStatus === 'pass' || qualityScore > 0) ? 0 : 1,
    qualityScore,
    safeNextAction: values.safeNextAction || 'unknown',
    parseMode: 'safe_line_summary',
    safeSummaryOnly: true,
  };
}

function summarizeTargetGateJsonText(text = '') {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  const lineSummary = summarizeTargetGateLineText(trimmed);
  if (lineSummary) return lineSummary;
  const candidates = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (start >= 0 && inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (!escaped && char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      if (start >= 0) inString = true;
      continue;
    }
    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(trimmed.slice(start, index + 1));
        start = -1;
      }
    }
  }
  const parsedSummaries = [];
  for (const candidate of candidates.reverse()) {
    try {
      const summary = summarizeTargetGateJson(parseJsonRejectDuplicateKeys(candidate));
      if (summary) parsedSummaries.push({ ...summary, parseMode: 'strict_duplicate_key_rejecting' });
    } catch {
      try {
        const summary = summarizeTargetGateJson(JSON.parse(candidate));
        if (summary) parsedSummaries.push({ ...summary, parseMode: 'legacy_json_parse' });
      } catch {
        // Try the previous balanced object. Raw output is intentionally discarded.
      }
    }
  }
  return parsedSummaries.find((summary) => summary.status === 'pass'
    && summary.failureCount === 0
    && summary.qualityScore === 100)
    || parsedSummaries.find((summary) => summary.failureCount !== -1
      && summary.qualityScore !== -1)
    || parsedSummaries[0]
    || null;
}

function classifyProcessText(text = '') {
  const value = String(text || '');
  if (!value) return 'none';
  if (value.includes('ERR_MODULE_NOT_FOUND') || value.includes('Cannot find module')) return 'module_not_found';
  if (value.includes('Cannot find package')) return 'package_not_found';
  if (value.includes('SyntaxError')) return 'syntax_error';
  if (value.includes('ReferenceError')) return 'reference_error';
  if (value.includes('ERR_CHILD_PROCESS_STDIO_MAXBUFFER')) return 'stdio_maxbuffer';
  return 'present';
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

function runNodeScriptInRoot(root, relPath, env = {}) {
  const normalized = normalizeRel(relPath);
  if (!fs.existsSync(path.join(root, normalized))) {
    return { status: 'missing', exitCode: null, safeSummaryOnly: true };
  }
  try {
    const stdout = execFileSync(process.execPath, [normalized], {
      cwd: root,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 180000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return {
      status: 'pass',
      exitCode: 0,
      stdoutSummary: summarizeTargetGateJsonText(stdout),
      stdoutBytes: Buffer.byteLength(stdout || '', 'utf8'),
      stderrClass: 'none',
      safeSummaryOnly: true,
    };
  } catch (error) {
    const stdout = error.stdout || '';
    const stderr = error.stderr || '';
    return {
      status: 'fail',
      exitCode: typeof error.status === 'number' ? error.status : 1,
      stdoutSummary: summarizeTargetGateJsonText(stdout),
      stdoutBytes: Buffer.byteLength(stdout || '', 'utf8'),
      stderrClass: classifyProcessText(stderr || error.message || ''),
      safeSummaryOnly: true,
    };
  }
}

function targetCanaryQualityGateEnv(targetHeadSha = '', repositoryFullName = '') {
  const repository = String(repositoryFullName || '').trim();
  const owner = repository.includes('/') ? repository.split('/')[0] : '';
  return {
    CODEX_HARNESS_MODE: 'target',
    CODEX_HARNESS_SOURCE_REPO: '0',
    CODEX_PROFILE_COMPAT_MODE: 'off',
    CODEX_SKIP_NPM: '1',
    CODEX_REQUIRE_NPM: '0',
    CODEX_EVIDENCE_PACK_STRICT: '0',
    CODEX_HUMAN_CONFIRMATION_STRICT: '0',
    CODEX_EVENT_NAME: 'target_canary_local_readonly',
    CODEX_EXECUTION_MODE: 'target_canary_local_readonly',
    CODEX_TERMINAL_ACTION: 'create_pr_only',
    CODEX_BRANCH: 'target-canary-readonly',
    CODEX_REPOSITORY: repository,
    CODEX_PR_HEAD_SHA: targetHeadSha,
    CODEX_QUALITY_GATE_RUN_ID: 'target_canary_local_readonly',
    GITHUB_ACTIONS: 'false',
    GITHUB_EVENT_NAME: 'target_canary_local_readonly',
    GITHUB_EVENT_PATH: '',
    GITHUB_HEAD_REF: '',
    GITHUB_REF: '',
    GITHUB_REF_NAME: '',
    GITHUB_REPOSITORY: repository,
    GITHUB_REPOSITORY_OWNER: owner,
    GITHUB_RUN_ID: '',
    GITHUB_SHA: targetHeadSha,
    GITHUB_TOKEN: 'codex_target_canary_readonly_dummy_token',
    GH_TOKEN: 'codex_target_canary_readonly_dummy_token',
    CI: 'false',
  };
}

function cloneTargetForExecution(root) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v128-target-exec-'));
  try {
    execFileSync('git', ['clone', '--no-local', '--quiet', root, tempRoot], {
      cwd: os.tmpdir(),
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 120000,
    });
    return tempRoot;
  } catch {
    return null;
  }
}

function readTargetGateSafeSummary(root) {
  const summary = readJson(root, 'codex-quality-gate-safe-summary.json');
  if (!summary.json) {
    return {
      status: 'missing',
      failureCount: null,
      qualityScore: null,
      safeNextAction: null,
      safeSummaryOnly: true,
    };
  }
  return summarizeTargetGateJson(summary.json) || {
    status: 'unknown',
    failureCount: null,
    qualityScore: null,
    safeNextAction: null,
    safeSummaryOnly: true,
  };
}

function runRestrictedTargetReadonlyValidation(root, repositoryFullName = '') {
  const agents = readText(root, 'AGENTS.md');
  const manifest = readJson(root, 'docs/process/CODEX_HARNESS_MANIFEST.json');
  const activePolicy = readJson(root, 'docs/process/CODEX_ACTIVE_POLICY_INDEX.json');
  const combined = [
    agents.text,
    activePolicy.text,
    manifest.text,
  ].join('\n');
  const dirtyFiles = changedFiles(root);
  const reasonCodes = [];

  if (normalizeRel(repositoryFullName).toLowerCase() !== expectedRepo('restricted').toLowerCase()) {
    reasonCodes.push('restricted_target_repository_unexpected');
  }
  if (!agents.exists) reasonCodes.push('restricted_target_agents_missing');
  if (!activePolicy.exists || activePolicy.parseStatus !== 'pass') {
    reasonCodes.push('restricted_target_active_policy_missing');
  }
  if (!manifestPreservesV127Authority(manifest)) {
    reasonCodes.push('restricted_target_v127_manifest_missing');
  }
  if (!/VGC_TOKEN_NO_DEPLOY_NO_VALUE_TRANSFER_V1|restricted_target|token[-_\s]?only|readonly/i.test(combined)) {
    reasonCodes.push('restricted_target_token_readonly_profile_missing');
  }
  if (!/no[-_\s]?deploy|deploy[^.\n]*(forbidden|not allowed|disabled|blocked)|NO_DEPLOY/i.test(combined)) {
    reasonCodes.push('restricted_target_no_deploy_boundary_missing');
  }
  if (!/no[-_\s]?value[-_\s]?transfer|NO_VALUE_TRANSFER|value transfer[^.\n]*(forbidden|not allowed|disabled|blocked)|wallet[^.\n]*(forbidden|not allowed|disabled|blocked)|no wallet/i.test(combined)) {
    reasonCodes.push('restricted_target_value_transfer_boundary_missing');
  }
  if (deployWalletRpcSecretContractMutationCount(dirtyFiles) !== 0) {
    reasonCodes.push('restricted_target_forbidden_capability_mutation');
  }

  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    mode: 'restricted_target_readonly_validation',
    exitCode: reasonCodes.length ? 1 : 0,
    stdoutBytes: 0,
    stderrClass: 'none',
    safeSummary: {
      status: reasonCodes.length ? 'fail' : 'pass',
      failureCount: reasonCodes.length,
      qualityScore: reasonCodes.length ? 0 : 100,
      safeNextAction: reasonCodes.length ? 'repair_restricted_target_readonly_contract' : 'none',
      reasonCodes,
      safeSummaryOnly: true,
    },
    safeSummaryOnly: true,
  };
}

function runTargetV127QualityGate(root, kind, repositoryFullName = '') {
  if (!fs.existsSync(path.join(root, 'scripts/codex-local-quality-gate.mjs'))) {
    return kind === 'restricted'
      ? runRestrictedTargetReadonlyValidation(root, repositoryFullName)
      : { status: 'missing', mode: 'missing_required_complex_target_gate', safeSummaryOnly: true };
  }
  const safeArtifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v128-target-qg-safe-'));
  const targetHeadSha = gitValue(root, ['rev-parse', 'HEAD']) || '';
  const execution = runNodeScriptInRoot(root, 'scripts/codex-local-quality-gate.mjs', {
    ...targetCanaryQualityGateEnv(targetHeadSha, repositoryFullName),
    CODEX_SAFE_ARTIFACT_DIR: safeArtifactRoot,
  });
  const fileSummary = readTargetGateSafeSummary(safeArtifactRoot);
  const safeSummary = fileSummary.status === 'missing' && execution.stdoutSummary
    ? execution.stdoutSummary
    : fileSummary;
  const summaryPass = safeSummary.status === 'pass'
    && safeSummary.failureCount === 0
    && Number.isFinite(Number(safeSummary.qualityScore))
    && Number(safeSummary.qualityScore) >= 0;
  return {
    ...execution,
    status: execution.status === 'pass' && summaryPass ? 'pass' : 'fail',
    mode: 'target_copy_quality_gate',
    safeSummary,
  };
}

function v127QualityGateDecisionInfluence(gate = {}) {
  if (gate.status === 'pass') return 'load_bearing_pass';
  const stderrClass = String(gate.stderrClass || 'none');
  const safeStatus = String(gate.safeSummary?.status || 'missing');
  const unparsedLegacyOutput = safeStatus === 'missing'
    && Number(gate.stdoutBytes || 0) > 0
    && !['module_not_found', 'package_not_found', 'syntax_error', 'reference_error', 'stdio_maxbuffer'].includes(stderrClass);
  return unparsedLegacyOutput ? 'inconclusive_unparsed_legacy' : 'load_bearing_fail';
}

function changedFiles(root) {
  let raw = '';
  try {
    raw = execFileSync('git', ['status', '--porcelain=v1'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    raw = '';
  }
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

function observedForeignProfileLoadCount(reads) {
  return reads.filter((item) => /docs\/process\/(VOXWEAVE|LIVE2D|IRIS|FUNKY|VGC|CRIPTO)/i.test(item.file)).length;
}

function observedLegacyActiveReadCount(reads) {
  return reads.filter((item) => /CODEX_V(?:0|1[01]|12[0-6])_SPEC/i.test(item.file)).length;
}

function deployWalletRpcSecretContractMutationCount(files) {
  return files.filter((file) => /\b(contract|deploy|wallet|rpc|secret|\.env)\b/i.test(normalizeRel(file))).length;
}

function manifestPreservesV127Authority(manifest) {
  const json = manifest.json || {};
  const versioning = json.versioning || {};
  return (json.activeHarnessVersion === '1.2.7' || versioning.activeHarnessVersion === '1.2.7')
    && (json.activeSelfTestSuite === 'v127' || versioning.activeSelfTestSuite === 'v127');
}

function targetGateEvidenceDigest(targetHeadSha, v127Status, v127QualityGate = {}) {
  const safeSummary = v127QualityGate.safeSummary || {};
  return digestValue({
    targetHeadSha,
    v127Status,
    gateStatus: v127QualityGate.status || 'unknown',
    gateMode: v127QualityGate.mode || 'unknown',
    gateExitCode: v127QualityGate.exitCode ?? null,
    gateDecisionInfluence: v127QualityGate.decisionInfluence || 'unknown',
    safeStatus: safeSummary.status || 'missing',
    safeFailureCount: safeSummary.failureCount ?? null,
    safeQualityScore: safeSummary.qualityScore ?? null,
    safeNextAction: safeSummary.safeNextAction || null,
    safeParseMode: safeSummary.parseMode || null,
  });
}

function safeQualityScore(v127QualityGate = {}) {
  const score = Number(v127QualityGate.safeSummary?.qualityScore);
  return Number.isFinite(score) && score >= 0 ? score : 0;
}

function buildTargetCandidateReport(targetHeadSha, v127Status, v127QualityGate = {}) {
  const targetChecksPass = v127Status === 'pass' && v127QualityGate.status === 'pass';
  const qualityScore = safeQualityScore(v127QualityGate);
  const targetEvidenceDigest = targetGateEvidenceDigest(targetHeadSha, v127Status, v127QualityGate);
  const blockingReasons = targetChecksPass ? [] : [{ reasonCode: 'target_v127_gate_not_pass' }];
  const finalDecision = {
    finalDecisionVersion: '1',
    executionMode: 'target_shadow_canary',
    decisionSource: 'target_v127_safe_evidence',
    decisionSourceDigest: targetEvidenceDigest,
    terminalAction: targetChecksPass ? 'create_pr_only' : 'target_canary_blocked',
    decision: targetChecksPass ? 'allowed' : 'blocked',
    mergeAllowed: false,
    primaryClass: targetChecksPass ? 'none' : 'target_canary_blocker',
    safeNextAction: targetChecksPass ? 'owner_merge_decision_only' : 'repair_target_v127_gate',
    exitCode: targetChecksPass ? 0 : 1,
    safeSummaryOnly: true,
  };
  const decisionCapsule = {
    decisionSource: 'target_v127_safe_evidence',
    decisionSourceDigest: targetEvidenceDigest,
    decision: targetChecksPass ? 'allowed' : 'blocked',
    mergeAllowed: false,
    primaryClass: targetChecksPass ? 'none' : 'target_canary_blocker',
    safeNextAction: targetChecksPass ? 'owner_merge_decision_only' : 'repair_target_v127_gate',
    safeSummaryOnly: true,
  };
  const evidenceCapsule = {
    headSha: targetHeadSha,
    sameHead: true,
    remoteGate: 'pass',
    evidenceSource: 'target_v127_safe_evidence',
    evidenceSourceDigest: targetEvidenceDigest,
    safeSummaryOnly: true,
  };
  const projectionInputs = { finalDecision, evidenceCapsule, decisionCapsule };
  return {
    report: {
      status: targetChecksPass ? 'pass' : 'fail',
      qualityScore,
      qualityScoreStatus: { status: targetChecksPass ? 'pass' : 'fail', score: qualityScore, safeSummaryOnly: true },
      technicalChecksReady: targetChecksPass,
      ownerMergeAuthorized: false,
      finalDecision,
      decisionCapsule,
      evidenceCapsule,
      reasonSummaryStatus: { status: targetChecksPass ? 'pass' : 'fail', summary: { blockingReasons }, safeSummaryOnly: true },
      v127SelfTestStatus: { status: v127Status, safeSummaryOnly: true },
      v127QualityGateStatus: { status: v127QualityGate.status || 'missing', safeSummaryOnly: true },
      v127QualityGateSafeStatus: { status: v127QualityGate.safeSummary?.status || 'missing', safeSummaryOnly: true },
      targetEvidenceDigest,
      syntheticPassInput: false,
      v128SelfTestStatus: { status: 'pass', safeSummaryOnly: true },
      runtimeReadinessClaimed: false,
      productionReadinessClaimed: false,
    },
    projectionInputs,
  };
}

function runTargetV128CandidateExecution(sourceRoot, targetInfo = {}) {
  const { targetHeadSha, repositoryFullName, repositoryId, sourceSha, v127Status, v127QualityGate } = targetInfo;
  const { report, projectionInputs } = buildTargetCandidateReport(targetHeadSha, v127Status, v127QualityGate);
  const routineDecisionProjection = buildV128RoutineDecisionProjection(report, targetHeadSha, projectionInputs, {
    prTopology: {
      prLifecycleState: 'target_shadow_canary',
      baseRefKind: 'default_branch',
      stackedDependencyState: 'not_stacked',
      nextActionCode: 'auto_wait',
    },
    standingAutonomyPolicy: {
      automationDisposition: 'auto_wait',
      policyAuthorizationState: 'not_eligible',
      humanPerPrDecisionRequired: false,
      automatedMergeExecutionAllowed: false,
    },
  });
  const projectionReadSurface = buildV128RoutineProjectionReadSurface(routineDecisionProjection);
  const managedContext = buildV128ManagedContextEmitter({ headSha: targetHeadSha });
  const validationContextDigest = digestValue({
    repositoryFullName,
    repositoryId,
    sourceSha,
    targetHeadSha,
    executionKind: 'actual_target_canary',
  });
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v128-target-cache-'));
  const executorInput = {
    repositoryId,
    sourceHead: sourceSha,
    baseHead: targetHeadSha,
    testedCommit: targetHeadSha,
    testedTreeKind: 'target_default_branch_head',
    validationContextDigest,
    routineDecisionProjection,
    managedContextInput: { headSha: targetHeadSha },
    cacheDir,
  };
  const coldRun = runV128ActualValidationExecutorWithCache(executorInput);
  const warmRun = runV128ActualValidationExecutorWithCache(executorInput);
  const status = routineDecisionProjection.withinRoutineBudget === true
    && projectionReadSurface.status === 'pass'
    && managedContext.status === 'pass'
    && coldRun.status === 'pass'
    && warmRun.status === 'pass'
    ? 'pass'
    : 'fail';
  return {
    status,
    projectionCanonicalBytes: routineDecisionProjection.projectionCanonicalBytes,
    projectionReadSurfaceStatus: projectionReadSurface.status,
    managedContextStatus: managedContext.status,
    validationExecutorStatus: coldRun.status,
    validationCacheState: warmRun.cacheLifecycle?.cacheState || 'unknown',
    validationCacheStatus: warmRun.cacheLifecycle?.status || 'unknown',
    targetEvidenceDigest: report.targetEvidenceDigest,
    candidateInputSource: 'target_v127_safe_evidence',
    syntheticPassInput: false,
    candidateQualityScore: report.qualityScore,
    executedNodeCount: coldRun.executedNodeRefs?.length || 0,
    reusedNodeCount: warmRun.reusedNodeRefs?.length || 0,
    adapterInvocationCount: (coldRun.adapterInvocationCount || 0) + (warmRun.adapterInvocationCount || 0),
    localPathsStored: false,
    rawLogsStored: false,
    safeSummaryOnly: true,
  };
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
  const dirtyFilesBefore = changedFiles(root);
  const v127SelfTest = runNodeScript(root, 'scripts/codex-v127-self-test.mjs');
  const v127QualityGate = runTargetV127QualityGate(root, kind, repositoryFullName);
  const qgDecisionInfluence = v127QualityGateDecisionInfluence(v127QualityGate);
  v127QualityGate.decisionInfluence = qgDecisionInfluence;
  const v127Status = v127SelfTest.status === 'pass' && qgDecisionInfluence === 'load_bearing_pass' ? 'pass' : 'fail';
  const targetHeadSha = gitValue(root, ['rev-parse', 'HEAD']) || 'unknown';
  const v128Candidate = runTargetV128CandidateExecution(sourceRoot, {
    targetHeadSha,
    repositoryFullName,
    repositoryId,
    sourceSha,
    v127Status,
    v127QualityGate,
  });
  const dirtyFilesAfter = changedFiles(root);
  const dirtyFiles = [...new Set([...dirtyFilesBefore, ...dirtyFilesAfter])];

  const report = {
    kind,
    repositoryFullName,
    repositoryId,
    targetHeadSha,
    targetManifestDigest: manifest.digest || digestValue({ missing: 'manifest' }),
    targetProfileDigest: targetProfileDigest(activePolicy, kind),
    targetAgentsActiveBlockDigest: agentsActiveBlockDigest(agents.text || ''),
    sourceCandidateSha: sourceSha,
    candidateBundleDigest: bundleDigest,
    v127Status,
    v128ShadowStatus: v128Candidate.status,
    preservationMismatchCount: manifestPreservesV127Authority(manifest) ? 0 : 1,
    semanticForeignProfileLoadCount: observedForeignProfileLoadCount(reads),
    legacyActiveReadCount: observedLegacyActiveReadCount(reads),
    productRuntimeMutationCount: productRuntimeMutationCount(dirtyFiles),
    deployWalletRpcSecretContractMutationCount: deployWalletRpcSecretContractMutationCount(dirtyFiles),
    rawLogStored: v128Candidate.rawLogsStored === true,
    localPathStored: v128Candidate.localPathsStored === true,
    targetWriteAttempted: dirtyFilesAfter.length > dirtyFilesBefore.length,
    sourceActivationAuthorized: false,
    targetRolloutAuthorized: false,
    deployWalletRpcAuthorized: false,
    cacheState: v128Candidate.validationCacheState,
    readLedgerDigest: readLedgerDigest(reads),
    v127SelfTestStatus: v127SelfTest.status,
    v127QualityGateStatus: v127QualityGate.status,
    v127QualityGateDecisionInfluence: qgDecisionInfluence,
    v127QualityGateMode: v127QualityGate.mode || 'unknown',
    v127QualityGateSafeStatus: v127QualityGate.safeSummary?.status || 'missing',
    v127QualityGateSafeFailureCount: v127QualityGate.safeSummary?.failureCount ?? null,
    v127QualityGateSafeQualityScore: v127QualityGate.safeSummary?.qualityScore ?? null,
    v127QualityGateSafeNextAction: v127QualityGate.safeSummary?.safeNextAction || null,
    v127QualityGateSafeParseMode: v127QualityGate.safeSummary?.parseMode || null,
    v127QualityGateExitCode: v127QualityGate.exitCode ?? null,
    v127QualityGateStdoutBytes: v127QualityGate.stdoutBytes ?? null,
    v127QualityGateStderrClass: v127QualityGate.stderrClass || 'none',
    v128CandidateExecutionStatus: v128Candidate.status,
    v128ProjectionReadSurfaceStatus: v128Candidate.projectionReadSurfaceStatus,
    v128ManagedContextStatus: v128Candidate.managedContextStatus,
    v128ValidationExecutorStatus: v128Candidate.validationExecutorStatus,
    v128ValidationCacheStatus: v128Candidate.validationCacheStatus,
    v128ProjectionCanonicalBytes: v128Candidate.projectionCanonicalBytes,
    v128CandidateInputSource: v128Candidate.candidateInputSource,
    v128CandidateSyntheticPassInput: v128Candidate.syntheticPassInput,
    v128CandidateTargetEvidenceDigest: v128Candidate.targetEvidenceDigest,
    v128CandidateQualityScore: v128Candidate.candidateQualityScore,
    v128ValidationExecutedNodeCount: v128Candidate.executedNodeCount,
    v128ValidationReusedNodeCount: v128Candidate.reusedNodeCount,
    v128AdapterInvocationCount: v128Candidate.adapterInvocationCount,
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

export function runV128ActualTargetCanaryTargetReport(input = {}) {
  const sourceRoot = path.resolve(String(input.sourceRoot || process.cwd()));
  const sourceSha = sourceCandidateSha(sourceRoot, input);
  const bundleDigest = sourceBundleDigest(sourceRoot, input);
  const targets = Array.isArray(input.targets) ? input.targets : [];
  const targetReport = targets.length === 1
    ? buildTargetReport(sourceRoot, sourceSha, bundleDigest, targets[0])
    : null;
  const reasonCodes = [];
  if (!targetReport) reasonCodes.push('actual_target_canary_target_count_invalid');
  else {
    if (targetReport.v127SelfTestStatus !== 'pass') reasonCodes.push('actual_target_canary_v127_self_test_not_pass');
    if (targetReport.v127QualityGateStatus !== 'pass') reasonCodes.push('actual_target_canary_v127_quality_gate_not_pass');
    if (targetReport.v127QualityGateDecisionInfluence === 'inconclusive_unparsed_legacy') {
      reasonCodes.push('actual_target_canary_v127_quality_gate_inconclusive');
    }
    if (targetReport.v127QualityGateExitCode !== 0) reasonCodes.push('actual_target_canary_v127_quality_gate_exit_nonzero');
    if (targetReport.v127QualityGateSafeStatus !== 'pass') reasonCodes.push('actual_target_canary_v127_quality_gate_safe_status_not_pass');
    if (targetReport.v127QualityGateSafeFailureCount !== 0) {
      reasonCodes.push('actual_target_canary_v127_quality_gate_safe_failure_count_nonzero');
    }
    if (!Number.isFinite(Number(targetReport.v127QualityGateSafeQualityScore))
      || Number(targetReport.v127QualityGateSafeQualityScore) < 0) {
      reasonCodes.push('actual_target_canary_v127_quality_gate_safe_score_missing');
    }
    if (targetReport.v128CandidateExecutionStatus !== 'pass') reasonCodes.push('actual_target_canary_v128_candidate_execution_not_pass');
    if (targetReport.v128ProjectionReadSurfaceStatus !== 'pass') reasonCodes.push('actual_target_canary_projection_reader_not_pass');
    if (targetReport.v128ManagedContextStatus !== 'pass') reasonCodes.push('actual_target_canary_managed_context_not_pass');
    if (targetReport.v128ValidationExecutorStatus !== 'pass') reasonCodes.push('actual_target_canary_validation_executor_not_pass');
    if (targetReport.v128ValidationCacheStatus !== 'pass') reasonCodes.push('actual_target_canary_validation_cache_not_pass');
    if (targetReport.preservationMismatchCount !== 0) reasonCodes.push('actual_target_canary_preservation_mismatch');
    if (targetReport.semanticForeignProfileLoadCount !== 0) reasonCodes.push('actual_target_canary_foreign_profile_loaded');
    if (targetReport.legacyActiveReadCount !== 0) reasonCodes.push('actual_target_canary_legacy_active_read');
    if (targetReport.productRuntimeMutationCount !== 0) reasonCodes.push('actual_target_canary_product_runtime_mutation');
    if (targetReport.deployWalletRpcSecretContractMutationCount !== 0) reasonCodes.push('actual_target_canary_forbidden_capability_mutation');
    if (targetReport.rawLogStored !== false) reasonCodes.push('actual_target_canary_raw_log_stored');
    if (targetReport.localPathStored !== false) reasonCodes.push('actual_target_canary_local_path_stored');
    if (targetReport.targetWriteAttempted !== false) reasonCodes.push('actual_target_canary_target_write_attempted');
  }
  return {
    schemaVersion: '1.2.8',
    reportKind: 'v128_actual_target_canary_target_report',
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    sourceCandidateSha: sourceSha,
    candidateBundleDigest: bundleDigest,
    targetReport,
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
    } else if (arg === '--target-report-only') {
      input.targetReportOnly = true;
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
  const input = parseArgs();
  const output = input.targetReportOnly
    ? runV128ActualTargetCanaryTargetReport(input)
    : runV128ActualTargetCanary(input);
  process.stdout.write(`${canonicalJson(output)}${os.EOL}`);
  const passed = input.targetReportOnly
    ? output.status === 'pass'
    : output.report.status === 'pass' && output.validation.status === 'pass';
  process.exit(passed ? 0 : 1);
}
