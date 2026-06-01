#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  isPrContext,
  scanObjectForUnsafe,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';

const PHASES = new Set([
  'pre_checkout',
  'workflow_started',
  'preflight_started',
  'quality_gate_started',
  'quality_gate_failed',
  'workflow_runner_failed',
  'artifact_upload_started',
  'artifact_uploaded',
  'unknown',
]);

function sanitizeReasonCodes(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[\s,]+/);
  return [...new Set(list.map((item) => String(item || '').replace(/[^A-Za-z0-9_.:-]/g, '_')).filter(Boolean))].slice(0, 10);
}

function phase(env = process.env) {
  const value = env.CODEX_LIFEBOAT_PHASE || env.CODEX_WORKFLOW_PHASE || 'workflow_started';
  return PHASES.has(value) ? value : 'unknown';
}

function artifactPath(env = process.env) {
  return env.CODEX_LIFEBOAT_PATH || 'codex-minimal-safe-failure.json';
}

function mirrorPath(env = process.env) {
  return env.CODEX_LIFEBOAT_MIRROR_PATH || '';
}

function safeArtifactLabel(file) {
  if (!file) return 'not_configured';
  return String(file).replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'configured';
}

function nextAction(reasonCodes) {
  if (reasonCodes.includes('classification_unknown_file')) return 'Update classification registry or narrow changed files.';
  if (reasonCodes.includes('missing_human_confirmation')) return 'Add current-head project-owner confirmation.';
  if (reasonCodes.includes('artifact_lifeboat_missing')) return 'Re-run workflow after lifeboat step is available.';
  if (reasonCodes.includes('remote_changed_files_mismatch')) return 'Compare safe changed-file summaries.';
  return 'Review safe reason codes and rerun after the smallest correction.';
}

export function buildArtifactLifeboat(env = process.env) {
  const reasonCodes = sanitizeReasonCodes(env.CODEX_LAST_KNOWN_REASON_CODES);
  const payload = {
    schemaVersion: '0.9.0',
    phase: phase(env),
    status: 'fail',
    lastKnownGate: String(env.CODEX_LAST_KNOWN_GATE || 'not_started').replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80),
    lastKnownReasonCodes: reasonCodes,
    safeNextAction: String(env.CODEX_SAFE_NEXT_ACTION || nextAction(reasonCodes)).slice(0, 180),
    safeSummaryOnly: true,
  };
  const unsafe = scanObjectForUnsafe(payload);
  const shouldWrite = env.CODEX_LIFEBOAT_WRITE !== '0';
  let artifactCreated = false;
  let mirrorCreated = false;
  const writeFailures = [];
  const primaryPath = artifactPath(env);
  const secondaryPath = mirrorPath(env);
  if (!unsafe.length && shouldWrite) {
    try {
      fs.writeFileSync(primaryPath, `${JSON.stringify(payload, null, 2)}\n`);
      artifactCreated = true;
    } catch {
      writeFailures.push('artifact_lifeboat_missing');
    }
    if (secondaryPath) {
      try {
        fs.writeFileSync(secondaryPath, `${JSON.stringify(payload, null, 2)}\n`);
        mirrorCreated = true;
      } catch {
        writeFailures.push('lifeboat_upload_missing');
      }
    }
  }
  const status = unsafe.length ? 'fail' : (artifactCreated || !isPrContext(env) ? 'pass' : 'fail');
  return simpleStatus('artifactLifeboatStatus', status, {
    phase: payload.phase,
    artifactCreated,
    mirrorCreated,
    artifactPath: safeArtifactLabel(primaryPath),
    mirrorPath: secondaryPath ? safeArtifactLabel(secondaryPath) : 'not_configured',
    lastKnownGate: payload.lastKnownGate,
    lastKnownReasonCodes: reasonCodes,
    safeNextAction: payload.safeNextAction,
    reasonCodes: [
      ...(unsafe.length ? ['artifact_lifeboat_unsafe'] : []),
      ...(!artifactCreated && isPrContext(env) ? ['artifact_lifeboat_missing'] : []),
      ...writeFailures,
    ],
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildArtifactLifeboat();
    writeJsonReport(report, 'CODEX_ARTIFACT_LIFEBOAT_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('artifactLifeboatStatus', 'fail', {
      phase: 'unknown',
      artifactCreated: false,
      lastKnownGate: 'artifact_lifeboat',
      lastKnownReasonCodes: ['artifact_lifeboat_missing'],
      safeNextAction: 'Re-run workflow after lifeboat step is available.',
      reasonCodes: ['artifact_lifeboat_missing'],
    });
    writeJsonReport(report, 'CODEX_ARTIFACT_LIFEBOAT_REPORT');
    process.exit(1);
  }
}
