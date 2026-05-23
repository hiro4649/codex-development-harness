#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.2
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHumanConfirmationStatus } from './codex-production-readiness-gate.mjs';
import { buildEvidencePackReport } from './codex-evidence-pack-validate.mjs';
import { scanSafeOutput } from './codex-safe-output-scan.mjs';

export const HARNESS_VERSION = '0.7.2';
export const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;

const defaultConfirmationPath = path.join('.codex', 'manual-confirmation.json');
const nonOverridable = [
  'secretScanFailure',
  'blockedPaths',
  'highConfidenceSecret',
  'implementationHarnessMixing',
  'profileRequiredFailure',
  'openaiMethodGateFailure',
  'unsafeOutput',
  'staleEvidence',
];

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch {
    return null;
  }
}

function readJson(file) {
  const text = readText(file);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { __invalid: true };
  }
}

function confirmationPath(env = process.env) {
  if (env.CODEX_MANUAL_CONFIRMATION_PATH) return env.CODEX_MANUAL_CONFIRMATION_PATH;
  return fs.existsSync(defaultConfirmationPath) ? defaultConfirmationPath : '';
}

function expectedHead(env = process.env) {
  return env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || '';
}

function normalizeBoolean(value) {
  if (value === true || value === 'true' || value === 'yes' || value === 'pass') return true;
  if (value === false || value === 'false' || value === 'no' || value === 'fail') return false;
  return null;
}

export function validateHumanConfirmationObject(object = {}, env = process.env) {
  const reasonCodes = [];
  const missingFields = [];
  const required = [
    'target',
    'repository',
    'prNumber',
    'headSha',
    'riskLevel',
    'confirmedByRole',
    'confirmedAt',
    'reviewedItems',
    'residualRisks',
    'qualityGateNotWeakened',
    'riskLevelNotLowered',
    'nonOverridableFailuresAcknowledged',
  ];
  for (const field of required) {
    if (!(field in object)) missingFields.push(field);
  }
  if (missingFields.length) reasonCodes.push('human_confirmation_incomplete');
  if (object.__invalid) reasonCodes.push('manual_confirmation_invalid');

  const wanted = expectedHead(env);
  if (!object.headSha) reasonCodes.push('missing_head_sha');
  else if (wanted && String(object.headSha).toLowerCase() !== String(wanted).toLowerCase()) reasonCodes.push('head_sha_mismatch');

  if (!Array.isArray(object.reviewedItems) || object.reviewedItems.length === 0) reasonCodes.push('human_confirmation_incomplete');
  if (!Array.isArray(object.residualRisks) || object.residualRisks.length === 0) reasonCodes.push('human_confirmation_incomplete');
  if (normalizeBoolean(object.qualityGateNotWeakened) !== true) reasonCodes.push('manual_confirmation_invalid');
  if (normalizeBoolean(object.riskLevelNotLowered) !== true) reasonCodes.push('manual_confirmation_invalid');
  if (normalizeBoolean(object.nonOverridableFailuresAcknowledged) !== true) reasonCodes.push('non_overridable_failure_present');

  if (Array.isArray(object.nonOverridableFailures) && object.nonOverridableFailures.length) {
    reasonCodes.push('non_overridable_failure_present');
  }

  const unsafe = scanSafeOutput(object);
  reasonCodes.push(...unsafe.findings.map((item) => item.reasonCode));

  const status = reasonCodes.length ? 'fail' : 'pass';
  return {
    status,
    reasonCodes: [...new Set(reasonCodes)],
    missingFields: [...new Set(missingFields)],
    source: 'structured_object',
    normalized: {
      targetPresent: Boolean(object.target),
      repositoryPresent: Boolean(object.repository),
      prNumberPresent: Boolean(object.prNumber),
      headShaStatus: reasonCodes.includes('head_sha_mismatch') ? 'mismatch' : object.headSha ? 'present' : 'missing',
      reviewedItemCount: Array.isArray(object.reviewedItems) ? object.reviewedItems.length : 0,
      residualRiskCount: Array.isArray(object.residualRisks) ? object.residualRisks.length : 0,
      qualityGateNotWeakened: normalizeBoolean(object.qualityGateNotWeakened) === true,
      riskLevelNotLowered: normalizeBoolean(object.riskLevelNotLowered) === true,
      nonOverridableFailuresAcknowledged: normalizeBoolean(object.nonOverridableFailuresAcknowledged) === true,
    },
  };
}

function confirmationFromEvidencePack(env) {
  const packReport = buildEvidencePackReport(env);
  const packPath = env.CODEX_EVIDENCE_PACK_PATH || (fs.existsSync(path.join('.codex', 'evidence-pack.json')) ? path.join('.codex', 'evidence-pack.json') : '');
  if (!packPath || packReport.status === 'fail') return null;
  const pack = readJson(packPath);
  return pack?.humanConfirmation || null;
}

export function buildHumanConfirmationObjectReport(env = process.env) {
  const file = confirmationPath(env);
  let object = null;
  let source = 'none';
  if (file) {
    object = readJson(file);
    source = 'manual_confirmation_file';
  }
  if (!object) {
    object = confirmationFromEvidencePack(env);
    if (object) source = 'evidence_pack_human_confirmation';
  }

  if (object) {
    const validation = validateHumanConfirmationObject(object, env);
    return {
      marker,
      harnessVersion: HARNESS_VERSION,
      humanConfirmationObjectStatus: {
        status: validation.status,
        source,
        reasonCodes: validation.reasonCodes,
        missingFields: validation.missingFields,
        safeSummaryOnly: true,
      },
      normalizedHumanConfirmation: validation.normalized,
      valuesPrinted: false,
      status: validation.status,
    };
  }

  const fallback = buildHumanConfirmationStatus(env).humanConfirmationStatus;
  const status = fallback.status === 'fail' ? 'fail'
    : fallback.status === 'manual_confirmation_required' ? 'manual_confirmation_required'
      : fallback.status === 'pass' ? 'pass'
        : 'not_required';
  const reasonCodes = [];
  if (status === 'manual_confirmation_required') reasonCodes.push('missing_human_confirmation');
  if (status === 'fail') reasonCodes.push(...(fallback.failures || ['manual_confirmation_invalid']));

  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    humanConfirmationObjectStatus: {
      status,
      source: fallback.status === 'not_required' ? 'not_required' : 'pr_body_fallback',
      reasonCodes: [...new Set(reasonCodes)],
      missingFields: fallback.missingEvidence || [],
      safeSummaryOnly: true,
    },
    normalizedHumanConfirmation: {
      fallbackStatus: fallback.status,
      headShaStatus: fallback.evidence?.headShaStatus || 'not_applicable',
    },
    valuesPrinted: false,
    status,
  };
}

function printReport(report) {
  const jsonMode = process.env.CODEX_HUMAN_CONFIRMATION_REPORT === 'json' ||
    process.env.CODEX_QUALITY_REPORT === 'json' ||
    process.argv.includes('--json');
  if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    console.log(`humanConfirmationObjectStatus: ${report.humanConfirmationObjectStatus.status}`);
    console.log(report.status === 'pass' ? 'Human confirmation validation passed.' : 'Human confirmation validation did not pass.');
  }
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMain()) {
  try {
    const report = buildHumanConfirmationObjectReport();
    printReport(report);
    process.exit(report.status === 'fail' ? 1 : 0);
  } catch {
    const report = {
      marker,
      harnessVersion: HARNESS_VERSION,
      humanConfirmationObjectStatus: {
        status: 'fail',
        reasonCodes: ['unexpected_error'],
        safeSummaryOnly: true,
      },
      normalizedHumanConfirmation: null,
      valuesPrinted: false,
      status: 'fail',
    };
    printReport(report);
    process.exit(1);
  }
}
