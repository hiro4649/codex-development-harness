#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  HARNESS_VERSION,
  marker,
  isPrContext,
  prBodyText,
  readJson,
  scanObjectForUnsafe,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';
import { classifyChange, changedFiles } from './codex-change-classification-gate.mjs';
import { buildRemoteProductBaselineReport } from './codex-remote-product-baseline-gate.mjs';

function parseJsonSource(env) {
  const file = env.CODEX_PRODUCT_VERIFICATION_EVIDENCE_PATH;
  if (!file) return null;
  const parsed = readJson(file);
  if (!parsed.ok) return { error: parsed.reasonCode };
  if (scanObjectForUnsafe(parsed.value).length || hasUnsafeEvidenceKeys(parsed.value)) {
    return { error: 'product_verification_evidence_unsafe' };
  }
  return parsed.value;
}

function hasUnsafeEvidenceKeys(value) {
  if (!value || typeof value !== 'object') return false;
  const unsafe = /raw(?:Logs?|Payload|Diff|Output)|secret|token|endpointValue|privatePath|productionData|personalData/i;
  const safeAbsence = /^(rawLogsIncluded|rawLogIncluded|rawDiffIncluded|rawDiffsIncluded|rawPayloadIncluded|rawOutputIncluded|rawValuesStored)$/i;
  const visit = (node) => {
    if (!node || typeof node !== 'object') return false;
    return Object.entries(node).some(([key, nested]) => {
      if (safeAbsence.test(key) && nested === false) return false;
      return unsafe.test(key) || visit(nested);
    });
  };
  return visit(value);
}

function bodyEvidence(body) {
  const commands = [];
  const safe = String(body || '');
  for (const line of safe.split(/\r?\n/)) {
    const match = line.match(/\b(npm test|npm run test|npm run build|node scripts\/run-tests(?:\.js)?)\b/i);
    if (match) {
      commands.push({
        name: match[1],
        required: false,
        result: /\bpass(?:ed)?\b/i.test(line) ? 'pass' : 'not_run',
        source: 'local',
        durationMs: null,
        testCount: null,
        safeSummary: 'command mentioned in PR evidence',
      });
    }
  }
  return commands;
}

function envCommands(env) {
  if (!env.CODEX_PRODUCT_VERIFICATION_COMMANDS) return [];
  return String(env.CODEX_PRODUCT_VERIFICATION_COMMANDS).split(/\r?\n|,/).map((name) => ({
    name: name.trim(),
    required: true,
    result: env.CODEX_PRODUCT_VERIFICATION_RESULT || 'pass',
    source: env.CODEX_PRODUCT_VERIFICATION_SOURCE || 'local',
    durationMs: null,
    testCount: null,
    safeSummary: 'command supplied through safe environment evidence',
  })).filter((item) => item.name);
}

function hasNamedProductEvidence(commands) {
  return commands.some((item) => ['pass', 'fail', 'not_run'].includes(item.result));
}

export function normalizeProductVerificationEvidence(env = process.env) {
  const body = prBodyText(env);
  const classified = classifyChange(changedFiles(env), env);
  const baseline = buildRemoteProductBaselineReport(env).remoteProductBaselineStatus;
  const c = classified.classification;
  const fileEvidence = parseJsonSource(env);
  if (fileEvidence?.error) {
    return {
      status: 'fail',
      reasonCodes: [fileEvidence.error === 'product_verification_evidence_unsafe' ? 'product_verification_evidence_unsafe' : 'product_verification_evidence_invalid'],
      normalized: null,
    };
  }
  const commands = [
    ...bodyEvidence(body),
    ...envCommands(env),
    ...(Array.isArray(fileEvidence?.commands) ? fileEvidence.commands : []),
  ].map((item) => ({
    name: String(item.name || 'unnamed command').slice(0, 80),
    required: Boolean(item.required),
    result: ['not_run', 'pass', 'fail'].includes(item.result) ? item.result : 'not_run',
    source: ['local', 'remote', 'not_applicable'].includes(item.source) ? item.source : 'local',
    durationMs: Number.isFinite(Number(item.durationMs)) ? Number(item.durationMs) : null,
    testCount: Number.isFinite(Number(item.testCount)) ? Number(item.testCount) : null,
    safeSummary: String(item.safeSummary || 'safe command summary').slice(0, 160),
  }));
  const skipNpm = env.CODEX_SKIP_NPM === '1';
  const skipAllowed = Boolean(c.harnessOnly && !c.runtimeReadinessClaimed) ||
    Boolean(c.docsOnly && !c.runtimeReadinessClaimed && (env.CODEX_NPM_SKIP_REASON || /\bskip reason\s*:\s*\S+/i.test(body)));
  const skipReason = c.harnessOnly && !c.runtimeReadinessClaimed
    ? 'harness_only_no_runtime_claim'
    : c.docsOnly && !c.runtimeReadinessClaimed
      ? 'docs_only_with_skip_reason'
      : skipAllowed ? 'allowed_by_policy' : '';

  const reasonCodes = [...classified.reasonCodes.filter((item) => item !== 'no_pr_context')];
  const requiredEvidenceMissing = [];
  if (classified.productRelevantChanged) {
    if (skipNpm) reasonCodes.push('npm_skip_not_allowed_for_product_change');
    if (!hasNamedProductEvidence(commands)) requiredEvidenceMissing.push('product_verification_commands');
    if (commands.some((item) => item.required && item.result === 'fail')) reasonCodes.push('remote_product_evidence_runner_failed');
  }
  if (classified.runtimeReadinessClaimed) {
    if (skipNpm) reasonCodes.push('runtime_claim_requires_product_checks');
    if (!hasNamedProductEvidence(commands)) requiredEvidenceMissing.push('runtime_or_smoke_verification');
  }
  if (classified.packageOrLockfileChanged) {
    if (!hasNamedProductEvidence(commands)) {
      reasonCodes.push('package_change_requires_package_verification');
      requiredEvidenceMissing.push('package_verification');
    }
  }
  if (requiredEvidenceMissing.length) reasonCodes.push('product_verification_evidence_missing');

  const normalized = {
    schemaVersion: '0.8.3',
    harnessVersion: HARNESS_VERSION,
    mode: env.CODEX_HARNESS_SOURCE_REPO === '1' ? 'source' : (env.CODEX_HARNESS_MODE || 'target'),
    repository: env.CODEX_REPOSITORY || '',
    prNumber: env.CODEX_PR_NUMBER || '',
    headSha: env.CODEX_PR_HEAD_SHA || '',
    classification: {
      harnessOnly: Boolean(c.harnessOnly),
      docsOnly: Boolean(c.docsOnly),
      productRelevantChanged: Boolean(classified.productRelevantChanged),
      runtimeReadinessClaimed: Boolean(classified.runtimeReadinessClaimed),
      packageOrLockfileChanged: Boolean(classified.packageOrLockfileChanged),
    },
    skipNpm,
    skipAllowed,
    skipReason,
    commands,
    baseline: {
      status: baseline.status,
      required: Boolean(baseline.baselineRequired),
      result: baseline.baselineResult || null,
      reasonCodes: baseline.reasonCodes || [],
    },
    requiredEvidenceMissing: [...new Set(requiredEvidenceMissing)],
    safeSummaryOnly: true,
  };

  if (scanObjectForUnsafe(normalized).length) {
    reasonCodes.push('product_verification_evidence_unsafe');
  }
  const status = classified.status === 'not_applicable' && !isPrContext(env)
    ? 'not_applicable'
    : reasonCodes.length ? 'fail' : 'pass';
  return {
    status,
    reasonCodes: [...new Set(reasonCodes)],
    normalized,
  };
}

export function buildProductVerificationEvidenceReport(env = process.env) {
  const result = normalizeProductVerificationEvidence(env);
  return simpleStatus('productVerificationEvidenceStatus', result.status, {
    reasonCodes: result.reasonCodes,
    normalizedEvidence: result.normalized,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildProductVerificationEvidenceReport();
    if (process.argv.includes('--write-artifact')) {
      fs.writeFileSync('codex-product-verification-evidence.normalized.json', JSON.stringify(report.productVerificationEvidenceStatus.normalizedEvidence, null, 2));
    }
    writeJsonReport(report, 'CODEX_PRODUCT_VERIFICATION_EVIDENCE_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('productVerificationEvidenceStatus', 'fail', { reasonCodes: ['product_verification_evidence_invalid'] });
    writeJsonReport(report, 'CODEX_PRODUCT_VERIFICATION_EVIDENCE_REPORT');
    process.exit(1);
  }
}
