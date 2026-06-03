#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { fileURLToPath } from 'node:url';
import { isPrContext, normalizePath, readJson, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function envJson(env, name) {
  if (!env[name]) return null;
  try {
    return JSON.parse(env[name]);
  } catch {
    return null;
  }
}

function splitChangedFiles(value) {
  if (Array.isArray(value)) return value.map(normalizePath).filter(Boolean);
  const text = String(value || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(normalizePath).filter(Boolean);
  } catch {
    // Fall through.
  }
  return text.split(/[\n,]+/).map((item) => normalizePath(item.trim())).filter(Boolean);
}

function productRelevant(files, classification = {}) {
  const status = classification.changeClassificationStatus || classification;
  return Boolean(
    status.productRelevantChanged ||
    status.productSourceChanged ||
    status.packageOrLockfileChanged ||
    status.runtimeReadinessClaimed ||
    files.some((file) => /^(src|apps|contracts)\//.test(file) || /^(package\.json|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(file))
  );
}

function statusOf(value) {
  return value?.status || value?.remoteProductBaselineStatus?.status || value?.remoteNpmDiagnosticStatus?.status || 'missing';
}

export function buildBaselineHealthReport(env = process.env) {
  const files = splitChangedFiles(env.CODEX_CHANGED_FILES);
  const classification = envJson(env, 'CODEX_CHANGE_CLASSIFICATION_JSON') || {};
  const baseline = envJson(env, 'CODEX_REMOTE_PRODUCT_BASELINE_JSON') || envJson(env, 'CODEX_REMOTE_PRODUCT_BASELINE_REPORT') || {};
  const npmDiagnostic = envJson(env, 'CODEX_REMOTE_NPM_DIAGNOSTIC_JSON') || envJson(env, 'CODEX_REMOTE_NPM_DIAGNOSTIC_REPORT') || {};
  const productRelevantChange = productRelevant(files, classification);
  const baselineStatus = statusOf(baseline);
  const npmStatus = statusOf(npmDiagnostic);
  const reasonCodes = [];
  if (!productRelevantChange) {
    const result = simpleStatus('baselineHealthStatus', 'not_applicable', {
      baselineRequired: false,
      baselinePresent: baselineStatus !== 'missing',
      baselineFresh: baselineStatus === 'pass',
      baselineResult: baselineStatus,
      productRelevantSkipOnly: false,
      reasonCodes: ['baseline_not_required_for_harness_only'],
    });
    return result;
  }
  if (env.CODEX_SKIP_NPM === '1') reasonCodes.push('product_skip_npm_without_verification');
  if (baselineStatus === 'missing' || baselineStatus === 'not_applicable') reasonCodes.push('baseline_evidence_missing');
  if (/stale/i.test(JSON.stringify(baseline))) reasonCodes.push('baseline_evidence_stale');
  if (baselineStatus === 'fail' && npmStatus === 'fail') reasonCodes.push('baseline_candidate_regression_not_separated');
  if (baselineStatus === 'pass' && npmStatus === 'fail' && /diagnostic/i.test(JSON.stringify(npmDiagnostic))) {
    reasonCodes.push('baseline_candidate_regression_not_separated');
  }
  const status = reasonCodes.length ? 'fail' : 'pass';
  const payload = {
    baselineRequired: true,
    baselinePresent: baselineStatus !== 'missing',
    baselineFresh: baselineStatus === 'pass',
    baselineResult: baselineStatus,
    productRelevantSkipOnly: env.CODEX_SKIP_NPM === '1',
    reasonCodes: [...new Set(reasonCodes)],
  };
  if (scanObjectForUnsafe(payload).length) payload.reasonCodes.push('baseline_health_failed');
  return simpleStatus('baselineHealthStatus', payload.reasonCodes.length ? 'fail' : status, payload);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildBaselineHealthReport();
    writeJsonReport(report, 'CODEX_BASELINE_HEALTH_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('baselineHealthStatus', 'fail', { reasonCodes: ['baseline_health_failed'] });
    writeJsonReport(report, 'CODEX_BASELINE_HEALTH_REPORT');
    process.exit(1);
  }
}
