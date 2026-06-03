#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import fs from 'node:fs';
import { HARNESS_VERSION, marker, readText, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function buildReport() {
  const reasonCodes = [];
  const docs = [
    readText('README.md') || '',
    readText('AGENTS.md') || '',
    readText('docs/process/CODEX_ENVIRONMENT_READINESS_POLICY.md') || '',
  ].join('\n');
  const hasPackage = fs.existsSync('package.json');
  const nodeDocumented = /Node\.?js|node-version|Node version/i.test(docs);
  const startupGuidance = /startup|setup|environment|quality gate|node scripts\/codex-local-quality-gate/i.test(docs);
  if (!nodeDocumented) reasonCodes.push('environment_readiness_missing');
  if (!startupGuidance) reasonCodes.push('environment_readiness_missing');
  const status = reasonCodes.length ? 'fail' : 'pass';
  return simpleStatus('environmentReadinessStatus', status, {
    reasonCodes: [...new Set(reasonCodes)],
    packageFiles: hasPackage ? 'present' : 'absent',
    npmVerification: hasPackage ? 'available_if_configured' : 'not_applicable_no_package_json',
    internetRequired: false,
  });
}

try {
  const report = buildReport();
  writeJsonReport(report, 'CODEX_ENVIRONMENT_READINESS_REPORT');
  exitFor(report);
} catch {
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    environmentReadinessStatus: { status: 'fail', reasonCodes: ['unexpected_error'], safeSummaryOnly: true },
    valuesPrinted: false,
    status: 'fail',
  };
  writeJsonReport(report, 'CODEX_ENVIRONMENT_READINESS_REPORT');
  process.exit(1);
}
