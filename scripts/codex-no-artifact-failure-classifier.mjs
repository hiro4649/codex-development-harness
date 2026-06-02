#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isPrContext,
  scanObjectForUnsafe,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';

const phases = new Set([
  'before_lifeboat',
  'preflight_failed',
  'quality_gate_failed_before_summary',
  'workflow_runner_failed',
  'upload_step_skipped',
  'upload_step_failed',
  'artifact_api_unavailable',
  'unknown',
]);

function artifactFound(env = process.env) {
  if (env.CODEX_ARTIFACT_FOUND === '1') return true;
  if (env.CODEX_ARTIFACT_FOUND === '0') return false;
  const runnerTempLifeboat = env.RUNNER_TEMP ? path.join(env.RUNNER_TEMP, 'codex-minimal-safe-failure.json') : '';
  const candidates = [
    env.CODEX_LIFEBOAT_PATH || 'codex-minimal-safe-failure.json',
    env.CODEX_LIFEBOAT_MIRROR_PATH,
    env.CODEX_RUNNER_TEMP_LIFEBOAT_PATH,
    runnerTempLifeboat,
    'codex-quality-gate-safe-summary.json',
    'codex-diagnostic-consolidated-summary.json',
  ];
  return candidates.some((file) => file && fs.existsSync(file));
}

export function buildNoArtifactFailureReport(env = process.env) {
  const expected = env.CODEX_ARTIFACT_EXPECTED === '1' || isPrContext(env);
  const found = artifactFound(env);
  const failurePhase = phases.has(env.CODEX_NO_ARTIFACT_FAILURE_PHASE) ? env.CODEX_NO_ARTIFACT_FAILURE_PHASE : 'unknown';
  const reasonCodes = [];
  if (expected && !found) reasonCodes.push('no_artifact_failure_unclassified');
  if (expected && !found && isPrContext(env)) reasonCodes.push('artifact_lifeboat_missing');
  if (env.CODEX_ARTIFACT_API_UNAVAILABLE === '1' && !found) reasonCodes.push('lifeboat_upload_missing');
  const payload = {
    artifactExpected: expected,
    artifactFound: found,
    failurePhase,
    reasonCodes: [...new Set(reasonCodes)],
    safeNextAction: found ? 'Inspect safe artifact summary.' : 'Re-run with lifeboat artifact enabled before quality gate.',
  };
  if (scanObjectForUnsafe(payload).length) payload.reasonCodes.push('no_artifact_failure_unclassified');
  let status = payload.reasonCodes.length ? 'fail' : 'pass';
  if (!expected) status = 'not_applicable';
  if (env.CODEX_ARTIFACT_API_UNAVAILABLE === '1' && !found && !isPrContext(env)) status = 'warning';
  return simpleStatus('noArtifactFailureStatus', status, payload);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildNoArtifactFailureReport();
    writeJsonReport(report, 'CODEX_NO_ARTIFACT_FAILURE_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('noArtifactFailureStatus', 'fail', {
      artifactExpected: true,
      artifactFound: false,
      failurePhase: 'unknown',
      reasonCodes: ['no_artifact_failure_unclassified'],
      safeNextAction: 'Re-run with lifeboat artifact enabled before quality gate.',
    });
    writeJsonReport(report, 'CODEX_NO_ARTIFACT_FAILURE_REPORT');
    process.exit(1);
  }
}
