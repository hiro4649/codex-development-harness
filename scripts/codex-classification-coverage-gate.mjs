#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  isPrContext,
  normalizePath,
  readJson,
  scanObjectForUnsafe,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';

const allowedClassifications = new Set([
  'harness_managed',
  'docs',
  'test',
  'workflow',
  'product_source',
  'product_relevant',
  'verification_relevant',
  'product_runtime_entrypoint',
  'dev_server_entrypoint',
  'config',
  'package',
  'lockfile',
  'unknown',
]);

function gitLines(args) {
  const result = spawnSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  if (result.status !== 0) return [];
  return String(result.stdout || '').split(/\r?\n/).map(normalizePath).filter(Boolean);
}

export function changedFiles(env = process.env) {
  if (env.CODEX_CHANGED_FILES) {
    const raw = String(env.CODEX_CHANGED_FILES).trim();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return [...new Set(parsed.map(normalizePath).filter(Boolean))].sort();
    } catch {
      // Fall through.
    }
    return [...new Set(raw.split(/[\r\n,]+/).map((item) => normalizePath(item.trim())).filter(Boolean))].sort();
  }
  return [...new Set([
    ...gitLines(['diff', '--name-only', 'origin/main...HEAD']),
    ...gitLines(['diff', '--name-only']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ])].sort();
}

function globToRegExp(pattern) {
  const text = normalizePath(pattern);
  let out = '^';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '*' && next === '*') {
      out += '.*';
      i += 1;
    } else if (ch === '*') out += '[^/]*';
    else out += ch.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }
  return new RegExp(`${out}$`);
}

function matches(pattern, file) {
  const normalized = normalizePath(pattern);
  if (!normalized) return false;
  if (normalized.includes('*')) return globToRegExp(normalized).test(file);
  if (normalized.endsWith('/')) return file.startsWith(normalized);
  return file === normalized || file.startsWith(`${normalized}/`);
}

function loadRegistry(env = process.env) {
  const file = env.CODEX_CLASSIFICATION_REGISTRY_PATH || 'docs/process/CODEX_CLASSIFICATION_REGISTRY.json';
  const parsed = readJson(file);
  if (!parsed.ok || !parsed.value || !Array.isArray(parsed.value.entries)) {
    return { ok: false, reasonCode: parsed.reasonCode === 'file_missing' ? 'classification_registry_invalid' : 'classification_registry_invalid', entries: [] };
  }
  if (scanObjectForUnsafe(parsed.value).length) return { ok: false, reasonCode: 'classification_registry_invalid', entries: [] };
  const entries = parsed.value.entries.filter((entry) =>
    entry &&
    typeof entry.pathPattern === 'string' &&
    allowedClassifications.has(entry.classification) &&
    typeof entry.surface === 'string' &&
    typeof entry.risk === 'string');
  if (entries.length !== parsed.value.entries.length) return { ok: false, reasonCode: 'classification_registry_invalid', entries };
  return { ok: true, entries };
}

export function classifyFileWithRegistry(file, entries) {
  const normalized = normalizePath(file);
  const match = entries.find((entry) => matches(entry.pathPattern, normalized));
  return match || {
    pathPattern: normalized,
    classification: 'unknown',
    surface: 'unknown',
    risk: 'unknown',
    requiresProductVerification: true,
    allowsFastPath: false,
  };
}

function suggestedEntry(file) {
  const normalized = normalizePath(file);
  if (/^scripts\/codex-/.test(normalized)) return { pathPattern: 'scripts/codex-*', classification: 'harness_managed' };
  if (/^scripts\/.*(?:server|dev|start)/i.test(normalized)) return { pathPattern: normalized, classification: 'dev_server_entrypoint' };
  if (/^(src|apps|contracts)\//.test(normalized)) return { pathPattern: normalized.split('/')[0] + '/**', classification: 'product_source' };
  if (/^\.github\/workflows\//.test(normalized)) return { pathPattern: '.github/workflows/**', classification: 'workflow' };
  if (/^docs\//.test(normalized)) return { pathPattern: 'docs/**', classification: 'docs' };
  return { pathPattern: normalized, classification: 'unknown' };
}

export function buildClassificationCoverageReport(env = process.env) {
  const files = changedFiles(env);
  const registry = loadRegistry(env);
  const reasonCodes = [];
  if (!registry.ok) reasonCodes.push(registry.reasonCode);
  const classified = files.map((file) => ({ file, entry: classifyFileWithRegistry(file, registry.entries) }));
  const unknown = classified.filter((item) => item.entry.classification === 'unknown');
  const entrypointUnknown = unknown.filter((item) => /(^scripts\/.*(?:server|dev|start)|\.mjs$|\.js$)/i.test(item.file));
  if (isPrContext(env) && unknown.length) reasonCodes.push('classification_unknown_file');
  if (entrypointUnknown.length) reasonCodes.push('entrypoint_unclassified');
  const conflicts = classified.filter((item) =>
    /^scripts\/codex-/.test(item.file) && item.entry.classification !== 'harness_managed');
  if (conflicts.length) reasonCodes.push('classification_registry_conflict');
  const payload = {
    changedFileCount: files.length,
    classifiedCount: files.length - unknown.length,
    unknownCount: unknown.length,
    unknownClasses: unknown.map((item) => item.file).slice(0, 20),
    suggestedRegistryEntries: unknown.map((item) => suggestedEntry(item.file)).slice(0, 20),
    reasonCodes: [...new Set(reasonCodes)],
  };
  const unsafe = scanObjectForUnsafe(payload);
  if (unsafe.length) payload.reasonCodes.push('classification_registry_invalid');
  let status = payload.reasonCodes.some((code) => ['classification_registry_invalid', 'classification_registry_conflict', 'classification_unknown_file', 'entrypoint_unclassified'].includes(code)) ? 'fail' : 'pass';
  if (!isPrContext(env) && unknown.length && status !== 'fail') status = 'warning';
  if (!files.length && !isPrContext(env)) status = 'pass';
  return simpleStatus('classificationCoverageStatus', status, payload);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildClassificationCoverageReport();
    writeJsonReport(report, 'CODEX_CLASSIFICATION_COVERAGE_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('classificationCoverageStatus', 'fail', {
      changedFileCount: 0,
      classifiedCount: 0,
      unknownCount: 0,
      unknownClasses: [],
      suggestedRegistryEntries: [],
      reasonCodes: ['classification_registry_invalid'],
    });
    writeJsonReport(report, 'CODEX_CLASSIFICATION_COVERAGE_REPORT');
    process.exit(1);
  }
}
