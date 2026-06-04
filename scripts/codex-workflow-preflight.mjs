#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  HARNESS_VERSION,
  marker,
  scanObjectForUnsafe,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';
import { classifyChange, changedFiles } from './codex-change-classification-gate.mjs';

function mode(env = process.env) {
  if (env.CODEX_HARNESS_MODE === 'target') return 'target';
  if (env.CODEX_HARNESS_SOURCE_REPO === '1' || fs.existsSync('CODEX_SOURCE_HARNESS_MANIFEST.json')) return 'source';
  if (fs.existsSync('docs/process/CODEX_HARNESS_MANIFEST.json')) return 'target';
  return env.CODEX_HARNESS_MODE || 'legacy';
}

function packageManagerPresence() {
  return {
    packageJsonPresent: fs.existsSync('package.json'),
    packageLockPresent: fs.existsSync('package-lock.json'),
    yarnLockPresent: fs.existsSync('yarn.lock'),
    pnpmLockPresent: fs.existsSync('pnpm-lock.yaml'),
  };
}

export function buildWorkflowPreflight(env = process.env) {
  const currentMode = mode(env);
  const classified = classifyChange(changedFiles(env), env);
  const required = [
    'scripts/codex-local-quality-gate.mjs',
    'scripts/codex-workflow-quality-runner.mjs',
    currentMode === 'source' ? 'CODEX_SOURCE_HARNESS_MANIFEST.json' : 'docs/process/CODEX_HARNESS_MANIFEST.json',
  ];
  const missing = required.filter((file) => !fs.existsSync(file));
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const shouldAttemptProductNpm = Boolean(
    currentMode === 'target' &&
    (classified.productRelevantChanged || classified.packageOrLockfileChanged || classified.runtimeReadinessClaimed) &&
    !env.CODEX_SKIP_NPM,
  );
  const preflight = {
    marker,
    harnessVersion: HARNESS_VERSION,
    mode: currentMode,
    nodeMajor,
    expectedNodeMajor: 20,
    nodeMajorOk: nodeMajor >= 20,
    packageManagerPresence: packageManagerPresence(),
    requiredFilesMissing: missing,
    productNpmAttemptRecommended: shouldAttemptProductNpm,
    reasonCodes: [
      ...(missing.length ? ['workflow_preflight_missing_required_file'] : []),
      ...(nodeMajor < 20 ? ['workflow_preflight_failed'] : []),
    ],
    safeSummaryOnly: true,
  };
  const status = preflight.reasonCodes.length || scanObjectForUnsafe(preflight).length ? 'fail' : 'pass';
  return simpleStatus('workflowPreflightStatus', status, { ...preflight });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildWorkflowPreflight();
    if (process.argv.includes('--write-artifact')) {
      fs.writeFileSync('codex-workflow-preflight.safe.json', JSON.stringify(report.workflowPreflightStatus, null, 2));
    }
    writeJsonReport(report, 'CODEX_WORKFLOW_PREFLIGHT_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('workflowPreflightStatus', 'fail', { reasonCodes: ['workflow_preflight_failed'] });
    writeJsonReport(report, 'CODEX_WORKFLOW_PREFLIGHT_REPORT');
    process.exit(1);
  }
}
