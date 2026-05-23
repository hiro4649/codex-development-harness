#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.8.1
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  HARNESS_VERSION,
  marker,
  isPrContext,
  normalizePath,
  prBodyText,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';

function gitLines(args) {
  const result = spawnSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  if (result.status !== 0) return [];
  return String(result.stdout || '').split(/\r?\n/).map(normalizePath).filter(Boolean);
}

export function changedFiles(env = process.env) {
  if (env.CODEX_CHANGED_FILES) {
    return [...new Set(String(env.CODEX_CHANGED_FILES).split(/\r?\n|,/).map(normalizePath).filter(Boolean))].sort();
  }
  return [...new Set([
    ...gitLines(['diff', '--name-only', 'origin/main...HEAD']),
    ...gitLines(['diff', '--name-only']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ])].sort();
}

function matches(file, patterns) {
  return patterns.some((pattern) => {
    if (pattern.endsWith('/')) return file.startsWith(pattern);
    if (pattern.endsWith('/**')) return file.startsWith(pattern.slice(0, -2));
    if (pattern.endsWith('*')) return file.startsWith(pattern.slice(0, -1));
    return file === pattern || file.startsWith(`${pattern}/`);
  });
}

const harnessPatterns = [
  'AGENTS.md',
  '.github/pull_request_template.md',
  '.github/workflows/quality-gate.yml',
  '.github/workflows/weekly-health-check.yml',
  'CODEX_SOURCE_HARNESS_MANIFEST.json',
  'docs/process/',
  'docs/codex/',
  'scripts/codex-*',
  '.codex/',
];

const docsPatterns = ['README.md', 'docs/'];
const productPatterns = ['src/', 'apps/', 'contracts/', 'packages/', 'lib/', 'server/', 'client/', 'public/', 'assets/', 'runtime/'];
const testPatterns = ['test/', 'tests/', '__tests__/'];
const specPatterns = ['specs/', 'docs/specs/', 'IRIS_SPEC_AUTHORITY.md'];
const packagePatterns = ['package.json', 'npm-shrinkwrap.json'];
const lockPatterns = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
const workflowPatterns = ['.github/workflows/'];
const configPatterns = ['tsconfig.json', 'vite.config.', 'next.config.', 'webpack.config.', 'eslint.config.', '.env'];

function runtimeClaimed(body) {
  return String(body || '').split(/\r?\n/).some((line) =>
    /\b(runtime ready|production ready|deployment ready|release ready|smoke passed|live verified|runtime readiness claimed\s*:\s*yes)\b/i.test(line) &&
    !/\b(runtime readiness claimed|runtime ready|production ready|deployment ready|release ready)\s*:\s*(no|not applicable|none)\b/i.test(line));
}

function performanceClaimed(body) {
  return /\b(faster|optimized|optimised|lower latency|lower memory|reduced memory|reduced cost|more efficient|performance)\b/i.test(body);
}

export function classifyChange(files = changedFiles(), env = process.env) {
  const body = prBodyText(env);
  const flags = {
    harnessOnly: false,
    docsOnly: false,
    productSourceChanged: false,
    testsChanged: false,
    specsChanged: false,
    packageChanged: false,
    lockfileChanged: false,
    workflowChanged: false,
    runtimeAssetsChanged: false,
    configChanged: false,
    authorityChanged: false,
    runtimeReadinessClaimed: runtimeClaimed(body),
    performanceClaimed: performanceClaimed(body),
    unknownRisk: false,
  };

  const unknownFiles = [];
  for (const raw of files) {
    const file = normalizePath(raw);
    const harness = matches(file, harnessPatterns);
    const docs = matches(file, docsPatterns);
    const workflow = matches(file, workflowPatterns);
    const product = matches(file, productPatterns);
    const test = matches(file, testPatterns);
    const spec = matches(file, specPatterns);
    const authority = file === 'IRIS_SPEC_AUTHORITY.md';
    const packageFile = matches(file, packagePatterns);
    const lockfile = matches(file, lockPatterns);
    const runtimeAsset = /^(assets|public|runtime)\//.test(file);
    const config = matches(file, configPatterns) || /\bconfig\b/i.test(file);
    if (workflow) flags.workflowChanged = true;
    if (product) flags.productSourceChanged = true;
    if (test) flags.testsChanged = true;
    if (spec) flags.specsChanged = true;
    if (authority) flags.authorityChanged = true;
    if (packageFile) flags.packageChanged = true;
    if (lockfile) flags.lockfileChanged = true;
    if (runtimeAsset) flags.runtimeAssetsChanged = true;
    if (config) flags.configChanged = true;
    if (!harness && !docs && !workflow && !product && !test && !spec && !authority &&
      !packageFile && !lockfile && !runtimeAsset && !config) {
      unknownFiles.push(file);
    }
  }

  const productRelevantChanged = flags.productSourceChanged || flags.testsChanged || flags.specsChanged ||
    flags.packageChanged || flags.lockfileChanged || flags.runtimeAssetsChanged || flags.configChanged ||
    flags.authorityChanged;
  flags.harnessOnly = files.length > 0 && files.every((file) => matches(normalizePath(file), harnessPatterns));
  flags.docsOnly = files.length > 0 && !productRelevantChanged && files.every((file) => matches(normalizePath(file), docsPatterns) || matches(normalizePath(file), harnessPatterns));
  flags.unknownRisk = unknownFiles.length > 0;

  const reasonCodes = [];
  if (flags.unknownRisk) reasonCodes.push('change_classification_unknown');
  if (!files.length && !isPrContext(env)) reasonCodes.push('no_pr_context');
  const status = reasonCodes.includes('change_classification_unknown')
    ? (isPrContext(env) ? 'fail' : 'warning')
    : reasonCodes.includes('no_pr_context') ? 'not_applicable' : 'pass';

  return {
    status,
    classification: flags,
    changedFileCount: files.length,
    productRelevantChanged,
    runtimeReadinessClaimed: flags.runtimeReadinessClaimed,
    packageOrLockfileChanged: flags.packageChanged || flags.lockfileChanged,
    reasonCodes,
  };
}

export function buildChangeClassificationReport(env = process.env) {
  const classified = classifyChange(changedFiles(env), env);
  return simpleStatus('changeClassificationStatus', classified.status, {
    classification: classified.classification,
    changedFileCount: classified.changedFileCount,
    productRelevantChanged: classified.productRelevantChanged,
    runtimeReadinessClaimed: classified.runtimeReadinessClaimed,
    packageOrLockfileChanged: classified.packageOrLockfileChanged,
    reasonCodes: classified.reasonCodes,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildChangeClassificationReport();
    writeJsonReport(report, 'CODEX_CHANGE_CLASSIFICATION_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('changeClassificationStatus', 'fail', { reasonCodes: ['unexpected_error'] });
    writeJsonReport(report, 'CODEX_CHANGE_CLASSIFICATION_REPORT');
    process.exit(1);
  }
}
