#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HARNESS_VERSION,
  marker,
  isPrContext,
  normalizePath,
  prBodyText,
  readJson,
  simpleStatus,
  writeJsonReport,
  exitFor,
  scanObjectForUnsafe,
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

function globToRegExp(pattern) {
  let out = '^';
  const text = normalizePath(pattern);
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '*' && next === '*') {
      out += '.*';
      i += 1;
    } else if (ch === '*') {
      out += '[^/]*';
    } else {
      out += ch.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`${out}$`);
}

function matches(file, patterns = []) {
  return patterns.some((pattern) => {
    const normalized = normalizePath(pattern);
    if (!normalized) return false;
    if (normalized.includes('*')) return globToRegExp(normalized).test(file);
    if (normalized.endsWith('/')) return file.startsWith(normalized);
    return file === normalized || file.startsWith(`${normalized}/`);
  });
}

const defaultRules = {
  harnessFiles: [
    'AGENTS.md',
    '.github/pull_request_template.md',
    '.github/workflows/quality-gate.yml',
    '.github/workflows/weekly-health-check.yml',
    'CODEX_SOURCE_HARNESS_MANIFEST.json',
    'docs/process/',
    'docs/codex/',
    'scripts/codex-*',
    '.agents/skills/',
    '.codex/',
  ],
  docsFiles: ['README.md', 'docs/'],
  productSourceFiles: ['src/', 'apps/', 'contracts/', 'packages/', 'lib/', 'server/', 'client/'],
  testFiles: ['test/', 'tests/', '__tests__/', 'scripts/run-tests.js'],
  specFiles: ['specs/', 'docs/specs/'],
  packageFiles: ['package.json', 'npm-shrinkwrap.json'],
  lockFiles: ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
  workflowFiles: ['.github/workflows/'],
  runtimeAssetFiles: ['public/', 'assets/', 'runtime/'],
  configFiles: ['tsconfig.json', 'vite.config.*', 'next.config.*', 'webpack.config.*', 'eslint.config.*', '.env*'],
  authorityFiles: ['IRIS_SPEC_AUTHORITY.md', '*_SPEC_AUTHORITY.md', 'docs/process/*AUTHORITY*.md'],
  unknownPolicy: 'fail_in_pr_context',
};

function safeStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateRules(value) {
  const required = [
    'harnessFiles',
    'docsFiles',
    'productSourceFiles',
    'testFiles',
    'specFiles',
    'packageFiles',
    'lockFiles',
    'workflowFiles',
    'runtimeAssetFiles',
    'configFiles',
    'authorityFiles',
  ];
  if (!value || typeof value !== 'object') return false;
  if (scanObjectForUnsafe(value).length) return false;
  return required.every((key) => safeStringArray(value[key]));
}

export function loadClassificationRules(env = process.env) {
  const explicit = env.CODEX_CHANGE_CLASSIFICATION_RULES_PATH;
  const basePath = explicit || path.join('docs', 'process', 'CODEX_CHANGE_CLASSIFICATION_RULES.json');
  const base = readJson(basePath);
  if (!base.ok) {
    return {
      ok: false,
      reasonCode: base.reasonCode === 'file_missing' ? 'classification_rules_missing' : 'classification_rules_invalid',
      rules: defaultRules,
      source: basePath,
    };
  }
  if (!validateRules(base.value)) {
    return { ok: false, reasonCode: 'classification_rules_invalid', rules: defaultRules, source: basePath };
  }
  let rules = { ...defaultRules, ...base.value };
  const localPath = path.join('docs', 'process', 'CODEX_CHANGE_CLASSIFICATION_RULES.local.json');
  if (env.CODEX_ALLOW_CLASSIFICATION_LOCAL_OVERRIDE !== '0') {
    const local = readJson(localPath);
    if (local.ok) {
      if (!validateRules({ ...rules, ...local.value })) {
        return { ok: false, reasonCode: 'classification_rules_invalid', rules, source: localPath };
      }
      rules = { ...rules, ...local.value };
    }
  }
  return { ok: true, reasonCode: null, rules, source: basePath };
}

function runtimeClaimed(body) {
  return String(body || '').split(/\r?\n/).some((line) =>
    /\b(runtime ready|production ready|deployment ready|release ready|smoke passed|live verified|runtime readiness claimed\s*:\s*yes)\b/i.test(line) &&
    !/\b(runtime readiness claimed|runtime ready|production ready|deployment ready|release ready)\s*:\s*(no|not applicable|none)\b/i.test(line));
}

function performanceClaimed(body) {
  const claimPattern = /\b(faster|optimized|optimised|lower latency|lower memory|reduced memory|reduced cost|more efficient|performance improvement|speedup)\b/i;
  return String(body || '').split(/\r?\n/).some((line) =>
    claimPattern.test(line) &&
    !/\b(no|not|without)\b.{0,80}\b(performance|faster|latency|memory|efficient|optimized|optimised|cost|speedup|claim)\b/i.test(line) &&
    !/\b(performance claim|performance evidence)\s*:\s*(not applicable|none|no)\b/i.test(line));
}

export function classifyChange(files = changedFiles(), env = process.env) {
  const body = prBodyText(env);
  const loaded = loadClassificationRules(env);
  const rules = loaded.rules;
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
    const harness = matches(file, rules.harnessFiles);
    const docs = matches(file, rules.docsFiles);
    const workflow = matches(file, rules.workflowFiles);
    const product = matches(file, rules.productSourceFiles);
    const test = matches(file, rules.testFiles);
    const spec = matches(file, rules.specFiles);
    const authority = matches(file, rules.authorityFiles);
    const packageFile = matches(file, rules.packageFiles);
    const lockfile = matches(file, rules.lockFiles);
    const runtimeAsset = matches(file, rules.runtimeAssetFiles);
    const config = matches(file, rules.configFiles) || /\bconfig\b/i.test(file);
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
  flags.harnessOnly = files.length > 0 && files.every((file) => matches(normalizePath(file), rules.harnessFiles));
  flags.docsOnly = files.length > 0 && !productRelevantChanged && files.every((file) => matches(normalizePath(file), rules.docsFiles) || matches(normalizePath(file), rules.harnessFiles));
  flags.unknownRisk = unknownFiles.length > 0;

  const reasonCodes = [];
  if (!loaded.ok) reasonCodes.push(loaded.reasonCode);
  if (flags.unknownRisk) {
    reasonCodes.push('change_classification_unknown');
    if (isPrContext(env)) reasonCodes.push('classification_unknown_in_pr_context');
  }
  if (!files.length && !isPrContext(env)) reasonCodes.push('no_pr_context');
  const status = reasonCodes.includes('classification_rules_missing') || reasonCodes.includes('classification_rules_invalid')
    ? (isPrContext(env) ? 'fail' : 'warning')
    : reasonCodes.includes('change_classification_unknown')
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
    rulesSource: loaded.source,
    unknownFiles: unknownFiles.length,
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
