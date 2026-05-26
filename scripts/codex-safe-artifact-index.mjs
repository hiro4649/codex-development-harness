#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.0
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

const RAW_LOOKING = /raw|stdout|stderr|payload|diff|secret|token|endpoint|private/i;
const PRIMARY_HUMAN_ARTIFACTS = [
  'codex-diagnostic-consolidated-summary.json',
  'codex-quality-gate-safe-summary.json',
  'codex-failure-reasons.json',
];
const REQUIRED_ARTIFACTS = [
  'codex-diagnostic-consolidated-summary.json',
  'codex-quality-gate-safe-summary.json',
  'codex-failure-reasons.json',
  'codex-safe-artifact-index.json',
];
const DEFAULT_ARTIFACT_BUDGET = 14;

export function buildSafeArtifactIndex(artifacts = [], mode = process.env.CODEX_HARNESS_MODE || 'source', options = {}) {
  const entries = artifacts.map((item) => ({
    artifactName: String(item.artifactName || item.name || '').slice(0, 100),
    path: String(item.path || '').replace(/\\/g, '/').slice(0, 180),
    producer: String(item.producer || 'codex-workflow-quality-runner').slice(0, 80),
    status: ['present', 'missing', 'not_applicable'].includes(item.status) ? item.status : 'present',
    mode,
    safeSummaryOnly: item.safeSummaryOnly !== false,
    rawLogIncluded: false,
    containsSecrets: false,
    containsEndpointValues: false,
    nextAction: String(item.nextAction || '').slice(0, 160),
    reasonCodes: Array.isArray(item.reasonCodes) ? item.reasonCodes.slice(0, 10) : [],
  }));
  const names = entries.map((item) => item.artifactName);
  const missingArtifacts = options.enforceRequired
    ? REQUIRED_ARTIFACTS.filter((name) => !names.includes(name) && !artifacts.some((item) => item.artifactName === name && item.status === 'not_applicable'))
    : [];
  const duplicateArtifacts = names.filter((name, index) => names.indexOf(name) !== index);
  const primaryHumanArtifacts = entries.filter((item) => PRIMARY_HUMAN_ARTIFACTS.includes(item.artifactName)).map((item) => item.artifactName);
  const machineArtifacts = entries.filter((item) => !PRIMARY_HUMAN_ARTIFACTS.includes(item.artifactName)).map((item) => item.artifactName);
  const artifactBudget = {
    maxArtifacts: Number(process.env.CODEX_ARTIFACT_BUDGET || DEFAULT_ARTIFACT_BUDGET),
    maxPrimaryHumanArtifacts: 3,
    artifactCount: entries.length,
    budgetExceeded: entries.length > Number(process.env.CODEX_ARTIFACT_BUDGET || DEFAULT_ARTIFACT_BUDGET),
  };
  const unsafePath = entries.some((item) => RAW_LOOKING.test(item.path) && !/safe-summary|failure-reasons|normalized|safe\.json|final-summary|artifact-index|preflight|target-quality|diagnostic-consolidated-summary|reason-summary|test-metrics|quality-gate|self-test-cases/i.test(item.path));
  const unsafe = unsafePath || entries.some((item) => scanObjectForUnsafe(item).length || !item.safeSummaryOnly || item.rawLogIncluded || item.containsSecrets || item.containsEndpointValues);
  const requiredMissing = missingArtifacts.length > 0;
  return {
    schemaVersion: '0.8.4',
    harnessVersion: HARNESS_VERSION,
    mode,
    artifacts: entries,
    artifactBudget,
    requiredArtifacts: REQUIRED_ARTIFACTS,
    optionalArtifacts: entries.map((item) => item.artifactName).filter((name) => !REQUIRED_ARTIFACTS.includes(name)),
    missingArtifacts,
    duplicateArtifacts: [...new Set(duplicateArtifacts)],
    primaryHumanArtifacts,
    machineArtifacts,
    status: unsafe || requiredMissing ? 'fail' : artifactBudget.budgetExceeded ? 'warning' : 'pass',
    reasonCodes: [
      ...(unsafe ? ['safe_artifact_index_invalid'] : []),
      ...(requiredMissing ? ['artifact_required_missing'] : []),
      ...(artifactBudget.budgetExceeded ? ['artifact_budget_exceeded'] : []),
    ],
    safeSummaryOnly: true,
  };
}

function defaultArtifacts(mode) {
  const names = [
    'codex-diagnostic-consolidated-summary.json',
    'codex-quality-gate-safe-summary.json',
    'codex-failure-reasons.json',
    'codex-evidence-pack.normalized.json',
    'codex-self-test-cases.safe.json',
    'codex-safe-artifact-index.json',
    mode === 'target' ? 'codex-target-quality-summary.json' : 'codex-source-final-summary.json',
    mode === 'target' ? 'codex-target-final-summary.json' : '',
    'codex-workflow-preflight.safe.json',
    'codex-test-metrics.safe.json',
  ].filter(Boolean);
  return names.map((name) => ({
    artifactName: name,
    path: name,
    status: fs.existsSync(name) ? 'present' : 'missing',
    reasonCodes: fs.existsSync(name) ? [] : ['safe_artifact_missing'],
      nextAction: fs.existsSync(name) ? '' : 'Artifact was not generated in this run.',
      safeSummaryOnly: true,
    }));
}

export function buildSafeArtifactIndexReport(env = process.env) {
  const mode = env.CODEX_HARNESS_MODE || (fs.existsSync('CODEX_SOURCE_HARNESS_MANIFEST.json') ? 'source' : 'target');
  if (!env.CODEX_SAFE_ARTIFACT_INDEX_INPUT && env.CODEX_WORKFLOW_ARTIFACT_CONTEXT !== '1' && !fs.existsSync('codex-quality-gate-safe-summary.json')) {
    return simpleStatus('safeArtifactIndexStatus', 'not_applicable', { reasonCodes: ['safe_artifact_index_not_requested'] });
  }
  let artifacts = defaultArtifacts(mode);
  if (env.CODEX_SAFE_ARTIFACT_INDEX_INPUT) {
    try {
      artifacts = JSON.parse(env.CODEX_SAFE_ARTIFACT_INDEX_INPUT);
    } catch {
      return simpleStatus('safeArtifactIndexStatus', 'fail', { reasonCodes: ['safe_artifact_index_invalid'] });
    }
  }
  const index = buildSafeArtifactIndex(artifacts, mode, { enforceRequired: true });
  return simpleStatus('safeArtifactIndexStatus', index.status, {
    reasonCodes: index.reasonCodes,
    artifactCount: index.artifacts.length,
    index,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildSafeArtifactIndexReport();
    if (process.argv.includes('--write-artifact')) {
      fs.writeFileSync('codex-safe-artifact-index.json', JSON.stringify(report.safeArtifactIndexStatus.index, null, 2));
    }
    writeJsonReport(report, 'CODEX_SAFE_ARTIFACT_INDEX_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('safeArtifactIndexStatus', 'fail', { reasonCodes: ['safe_artifact_index_invalid'] });
    writeJsonReport(report, 'CODEX_SAFE_ARTIFACT_INDEX_REPORT');
    process.exit(1);
  }
}
