#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import {
  HARNESS_VERSION,
  marker,
  listFiles,
  normalizePath,
  readJson,
  readText,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';

const coreFiles = [
  'CODEX_SOURCE_HARNESS_MANIFEST.json',
  'scripts/codex-local-quality-gate.mjs',
  '.github/workflows/quality-gate.yml',
  '.github/workflows/weekly-health-check.yml',
];

const couplingRoots = [
  'scripts',
  '.github/workflows',
  'docs/process',
];

const projectNamePattern = /\b(IRIS-live2d-renderer|iris-live2d-renderer|FUNKY|funky|IRIS|iris|renderer)\b/;
const requiredCouplingPattern = /\b(required|requiredPass|blocking|must pass|must run|mergeReady|qualityScore|source harness pass|source harness quality)\b/i;

function isAllowedCompatibilityLine(file, line) {
  const normalized = normalizePath(file);
  if (normalized === 'CODEX_SOURCE_HARNESS_MANIFEST.json') {
    return /"profiles"|"compatibleProfileTemplateVersions"|"profileTemplateVersion"|profileCompatibility/i.test(line);
  }
  if (normalized.endsWith('CODEX_PROJECT_AUTHORITY_REGISTRY.json')) {
    return true;
  }
  return /\b(optional|compatibility|compatible|historical|downstream|profile template|residual risk)\b/i.test(line) &&
    !/\b(required|requiredPass|must pass|blocking)\b/i.test(line);
}

function scanProjectCoupling() {
  const files = [
    'CODEX_SOURCE_HARNESS_MANIFEST.json',
    ...couplingRoots.flatMap((root) => listFiles(root)),
  ].filter((file) => {
    const normalized = normalizePath(file);
    return normalized === 'CODEX_SOURCE_HARNESS_MANIFEST.json' ||
      normalized.endsWith('.mjs') ||
      normalized.endsWith('.yml') ||
      normalized.endsWith('.yaml') ||
      normalized.endsWith('.md') ||
      normalized.endsWith('.json');
  });
  const findings = [];
  for (const file of files) {
    const text = readText(file);
    if (text === null) continue;
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!projectNamePattern.test(line)) return;
      if (!requiredCouplingPattern.test(line)) return;
      if (isAllowedCompatibilityLine(file, line)) return;
      findings.push({ file: normalizePath(file), line: index + 1 });
    });
  }
  return findings;
}

function buildReport(env = process.env) {
  const manifest = readJson('CODEX_SOURCE_HARNESS_MANIFEST.json');
  const reasonCodes = [];
  const findings = [];
  const mode = env.CODEX_HARNESS_MODE || 'compat';
  const profileMode = env.CODEX_PROFILE_COMPAT_MODE || (mode === 'core' ? 'optional' : 'on');
  if (!manifest.ok) reasonCodes.push('generic_core_manifest_missing');
  else {
    const value = manifest.value;
    if (value.harnessVersion !== HARNESS_VERSION || value.sourceHarnessVersion !== HARNESS_VERSION) {
      reasonCodes.push('generic_core_version_mismatch');
    }
    if (!value.genericCore || value.genericCore.profileCompatibility !== 'optional') {
      reasonCodes.push('generic_core_project_coupling');
    }
    if (!Array.isArray(value.compatibleProfileTemplateVersions) || !value.compatibleProfileTemplateVersions.includes('0.7.0')) {
      reasonCodes.push('generic_core_profile_template_compatibility_missing');
    }
  }
  if (mode === 'core' && !['off', 'optional'].includes(profileMode)) reasonCodes.push('profile_required_in_core_mode');
  for (const file of coreFiles) {
    const text = readText(file);
    if (text === null) {
      reasonCodes.push('generic_core_required_file_missing');
      continue;
    }
    if (mode === 'core' && /CODEX_RUN_PROFILE_REQUIRED_CHECKS\s*=\s*["']?1|profile governance required/i.test(text)) {
      reasonCodes.push('profile_required_in_core_mode');
    }
  }
  if (mode === 'core') {
    findings.push(...scanProjectCoupling());
    if (findings.length) reasonCodes.push('generic_core_project_coupling');
  }
  const status = reasonCodes.length ? 'fail' : 'pass';
  return simpleStatus('genericHarnessCoreStatus', status, {
    mode,
    profileCompatibilityMode: profileMode,
    reasonCodes: [...new Set(reasonCodes)],
    projectCouplingFindingsCount: findings.length,
  });
}

try {
  const report = buildReport();
  writeJsonReport(report, 'CODEX_GENERIC_CORE_REPORT');
  exitFor(report);
} catch {
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    genericHarnessCoreStatus: {
      status: 'fail',
      reasonCodes: ['unexpected_error'],
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
    status: 'fail',
  };
  writeJsonReport(report, 'CODEX_GENERIC_CORE_REPORT');
  process.exit(1);
}
