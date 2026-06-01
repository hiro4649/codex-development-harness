#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, parseArgs, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

export function buildInvalidReportRecoverySummary(options = {}) {
  const reportPresent = Boolean(options.reportPresent);
  const jsonParseStatus = options.jsonParseStatus || 'fail';
  const reason = options.reasonCode || (reportPresent ? 'workflow_runner_invalid_report' : 'workflow_runner_invalid_report');
  return {
    schemaVersion: '0.8.4',
    harnessVersion: HARNESS_VERSION,
    reportPresent,
    jsonParseStatus,
    safeInvalidReportReason: reason,
    safeInvalidReportPathLabels: ['unknown_invalid_report_path'],
    safeInvalidReportFindingCount: jsonParseStatus === 'pass' ? 0 : 1,
    fallbackArtifactsWritten: Boolean(options.fallbackArtifactsWritten),
    rawReportStored: false,
    rawValuesStored: false,
    safeSummaryOnly: true,
  };
}

export function buildInvalidReportRecoveryReport(env = process.env, argv = process.argv) {
  const args = parseArgs(argv);
  const file = args.report || env.CODEX_INVALID_REPORT_PATH || env.CODEX_WORKFLOW_REPORT_PATH || '';
  let present = false;
  let parseStatus = 'not_applicable';
  if (file) {
    present = fs.existsSync(file);
    if (present) {
      try {
        JSON.parse(fs.readFileSync(file, 'utf8'));
        parseStatus = 'pass';
      } catch {
        parseStatus = 'fail';
      }
    }
  }
  const summary = buildInvalidReportRecoverySummary({ reportPresent: present, jsonParseStatus: parseStatus });
  const status = parseStatus === 'fail' ? 'pass' : 'not_applicable';
  return simpleStatus('invalidReportRecoveryStatus', status, {
    reasonCodes: parseStatus === 'fail' ? [] : ['invalid_report_recovery_not_needed'],
    summary,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildInvalidReportRecoveryReport();
    if (process.argv.includes('--write-artifact')) {
      fs.writeFileSync('codex-invalid-report-recovery-summary.json', JSON.stringify(report.invalidReportRecoveryStatus.summary, null, 2));
    }
    writeJsonReport(report, 'CODEX_INVALID_REPORT_RECOVERY_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('invalidReportRecoveryStatus', 'fail', { reasonCodes: ['invalid_report_recovery_failed'] });
    writeJsonReport(report, 'CODEX_INVALID_REPORT_RECOVERY_REPORT');
    process.exit(1);
  }
}
