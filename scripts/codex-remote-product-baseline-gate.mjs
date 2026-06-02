#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { fileURLToPath } from 'node:url';
import {
  HARNESS_VERSION,
  isPrContext,
  readJson,
  scanObjectForUnsafe,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';
import { classifyChange, changedFiles } from './codex-change-classification-gate.mjs';

const MAX_BASELINE_AGE_DAYS = 14;

function parseInlineJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return { __invalid: true };
  }
}

function baselineInput(env = process.env) {
  if (env.CODEX_REMOTE_PRODUCT_BASELINE_JSON) return parseInlineJson(env.CODEX_REMOTE_PRODUCT_BASELINE_JSON);
  if (env.CODEX_REMOTE_PRODUCT_BASELINE_PATH) {
    const parsed = readJson(env.CODEX_REMOTE_PRODUCT_BASELINE_PATH);
    return parsed.ok ? parsed.value : { __missing: parsed.reasonCode === 'file_missing', __invalid: parsed.reasonCode !== 'file_missing' };
  }
  return null;
}

function dateExpired(value, now = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? true : date.getTime() < now.getTime();
}

function dateTooOld(value, now = new Date()) {
  if (!value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return true;
  return now.getTime() - date.getTime() > MAX_BASELINE_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function validateBaseline(input, env = process.env) {
  const failures = [];
  const baseline = input?.codexRemoteProductBaseline || input;
  if (!baseline || typeof baseline !== 'object') return { status: 'missing', baseline: null, failures: ['remote_product_baseline_missing'] };
  const requiredFields = [
    'schemaVersion',
    'harnessVersion',
    'repository',
    'baseSha',
    'baselineType',
    'commands',
    'result',
    'date',
    'source',
    'safeSummary',
    'knownFailures',
    'expiresAt',
    'rawValuesStored',
    'safeSummaryOnly',
  ];
  for (const field of requiredFields) {
    if (baseline[field] === undefined || baseline[field] === null || baseline[field] === '') failures.push('remote_product_baseline_invalid');
  }
  if (scanObjectForUnsafe(baseline).length) failures.push('remote_product_baseline_invalid');
  if (baseline.rawValuesStored !== false || baseline.safeSummaryOnly !== true) failures.push('remote_product_baseline_invalid');
  if (baseline.schemaVersion && baseline.schemaVersion !== '0.8.3') failures.push('remote_product_baseline_invalid');
  if (baseline.harnessVersion && baseline.harnessVersion !== HARNESS_VERSION) failures.push('remote_product_baseline_invalid');
  if (env.CODEX_REPOSITORY && baseline.repository !== env.CODEX_REPOSITORY) failures.push('remote_product_baseline_invalid');
  if (env.CODEX_PR_BASE_SHA && baseline.baseSha !== env.CODEX_PR_BASE_SHA) failures.push('remote_product_baseline_invalid');
  if (!Array.isArray(baseline.commands) || !Array.isArray(baseline.knownFailures)) failures.push('remote_product_baseline_invalid');
  if (!['pass', 'fail', 'warning'].includes(String(baseline.result || ''))) failures.push('remote_product_baseline_invalid');
  if (dateExpired(baseline.expiresAt) || dateTooOld(baseline.date)) failures.push('remote_product_baseline_stale');
  return {
    status: failures.length ? 'fail' : 'pass',
    baseline,
    failures: [...new Set(failures)],
  };
}

export function buildRemoteProductBaselineReport(env = process.env) {
  const classified = classifyChange(changedFiles(env), env);
  const c = classified.classification || {};
  const required = Boolean(
    classified.productRelevantChanged ||
    classified.packageOrLockfileChanged ||
    classified.runtimeReadinessClaimed ||
    c.performanceClaimed,
  );
  if (!required) {
    return simpleStatus('remoteProductBaselineStatus', 'not_applicable', {
      baselineRequired: false,
      reasonCodes: ['remote_product_baseline_not_required'],
    });
  }

  const input = baselineInput(env);
  if (!input || input.__missing) {
    return simpleStatus('remoteProductBaselineStatus', isPrContext(env) ? 'fail' : 'manual_confirmation_required', {
      baselineRequired: true,
      reasonCodes: ['remote_product_baseline_missing'],
    });
  }
  if (input.__invalid) {
    return simpleStatus('remoteProductBaselineStatus', 'fail', {
      baselineRequired: true,
      reasonCodes: ['remote_product_baseline_invalid'],
    });
  }

  const validated = validateBaseline(input, env);
  if (validated.failures.length) {
    return simpleStatus('remoteProductBaselineStatus', 'fail', {
      baselineRequired: true,
      reasonCodes: validated.failures,
    });
  }
  if (validated.baseline.result === 'fail') {
    return simpleStatus('remoteProductBaselineStatus', 'manual_confirmation_required', {
      baselineRequired: true,
      baselineResult: 'fail',
      reasonCodes: ['remote_product_baseline_failing'],
      knownFailures: Array.isArray(validated.baseline.knownFailures) ? validated.baseline.knownFailures.slice(0, 10) : [],
    });
  }

  return simpleStatus('remoteProductBaselineStatus', 'pass', {
    baselineRequired: true,
    baselineResult: validated.baseline.result,
    baselineType: String(validated.baseline.baselineType || 'product_verification').slice(0, 80),
    reasonCodes: [],
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildRemoteProductBaselineReport();
    writeJsonReport(report, 'CODEX_REMOTE_PRODUCT_BASELINE_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('remoteProductBaselineStatus', 'fail', { reasonCodes: ['remote_product_baseline_invalid'] });
    writeJsonReport(report, 'CODEX_REMOTE_PRODUCT_BASELINE_REPORT');
    process.exit(1);
  }
}
