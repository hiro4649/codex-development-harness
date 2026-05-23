#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.8.0
import fs from 'node:fs';
import {
  HARNESS_VERSION,
  marker,
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

function buildReport(env = process.env) {
  const manifest = readJson('CODEX_SOURCE_HARNESS_MANIFEST.json');
  const reasonCodes = [];
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
  const status = reasonCodes.length ? 'fail' : 'pass';
  return simpleStatus('genericHarnessCoreStatus', status, {
    mode,
    profileCompatibilityMode: profileMode,
    reasonCodes: [...new Set(reasonCodes)],
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
