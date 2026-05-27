#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.3
import { fileURLToPath } from 'node:url';
import { normalizePath, prBodyText, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function parseInput(env = process.env) {
  if (env.CODEX_DOCKER_SMOKE_JSON) {
    try { return JSON.parse(env.CODEX_DOCKER_SMOKE_JSON); }
    catch { return { invalidInput: true }; }
  }
  return {
    dockerSmokeRequired: env.CODEX_DOCKER_SMOKE_REQUIRED === '1',
    artifactHeadSha: env.CODEX_DOCKER_SMOKE_ARTIFACT_HEAD_SHA || '',
    prHeadSha: env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || '',
    artifactPresent: env.CODEX_DOCKER_SMOKE_ARTIFACT_PRESENT === '1',
    skippedByFastPath: env.CODEX_FAST_HARNESS === '1',
    skippedBySkipNpm: env.CODEX_SKIP_NPM === '1' && env.CODEX_DOCKER_SMOKE_REQUIRED === '1',
  };
}

export function dockerSmokeRequiredForFiles(files = [], manifest = {}) {
  if (manifest.dockerSmokeRequired) return true;
  return files.map(normalizePath).some((file) => /(^|\/)Dockerfile(\.dev)?$|docker-compose\.ya?ml$|compose.*\.ya?ml$|^scripts\/.*docker/i.test(file) || file === '.github/workflows/quality-gate.yml');
}

export function buildDockerSmokeArtifactReport(input = parseInput()) {
  const required = Boolean(input.dockerSmokeRequired || dockerSmokeRequiredForFiles(input.changedFiles || [], input.manifest || {}));
  if (!required) return simpleStatus('dockerSmokeCurrentHeadArtifactStatus', 'not_applicable', { reasonCodes: ['docker_smoke_not_required'], dockerSmokeRequired: false });
  const reasonCodes = [];
  const warnings = [];
  if (input.invalidInput) reasonCodes.push('docker_smoke_artifact_missing');
  if (!input.artifactPresent && !input.artifactHeadSha) reasonCodes.push('docker_smoke_artifact_missing');
  if (input.artifactHeadSha && input.prHeadSha && input.artifactHeadSha !== input.prHeadSha) reasonCodes.push('docker_smoke_head_mismatch');
  if (input.skippedByFastPath || input.skippedBySkipNpm) reasonCodes.push('docker_smoke_fast_path_skip_forbidden');
  if (input.smokeFailed && input.targetQualityScorePass) reasonCodes.push('docker_smoke_artifact_missing');
  if (input.workflowDispatchUsedAsPrSubstitute) reasonCodes.push('workflow_dispatch_used_as_pr_substitute');
  if (input.queued) warnings.push('docker_smoke_queued');
  const status = reasonCodes.length ? 'fail' : (warnings.length ? 'warning' : 'pass');
  return simpleStatus('dockerSmokeCurrentHeadArtifactStatus', status, { reasonCodes: [...new Set(reasonCodes)], warnings, dockerSmokeRequired: true });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildDockerSmokeArtifactReport();
  writeJsonReport(report, 'CODEX_DOCKER_SMOKE_ARTIFACT_REPORT');
  exitFor(report);
}

