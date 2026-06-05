#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import fs from 'node:fs';
import path from 'node:path';
import { HARNESS_VERSION, marker, readJson, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

const reportPath = path.join('.codex', 'curator-report.json');
const allowedActions = new Set(['keep', 'patch_candidate', 'merge_candidate', 'archive_candidate', 'pin_candidate', 'no_action']);

function buildReport() {
  if (!fs.existsSync(reportPath)) {
    return simpleStatus('curatorReportStatus', 'not_applicable', { reasonCodes: ['curator_not_enabled'] });
  }
  const parsed = readJson(reportPath);
  const reasonCodes = [];
  if (!parsed.ok) reasonCodes.push('curator_report_invalid');
  else {
    const report = parsed.value;
    if (report.autoApply === true || report.autoCommit === true || report.autoPush === true) reasonCodes.push('curator_auto_apply_forbidden');
    const actions = Array.isArray(report.actions) ? report.actions : [];
    for (const action of actions) {
      if (!allowedActions.has(action.action)) reasonCodes.push('curator_report_invalid');
    }
    if (scanObjectForUnsafe(report).length) reasonCodes.push('curator_report_invalid');
  }
  const status = reasonCodes.length ? 'fail' : 'pass';
  return simpleStatus('curatorReportStatus', status, { reasonCodes: [...new Set(reasonCodes)] });
}

try {
  const report = buildReport();
  writeJsonReport(report, 'CODEX_CURATOR_REPORT');
  exitFor(report);
} catch {
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    curatorReportStatus: { status: 'fail', reasonCodes: ['unexpected_error'], safeSummaryOnly: true },
    valuesPrinted: false,
    status: 'fail',
  };
  writeJsonReport(report, 'CODEX_CURATOR_REPORT');
  process.exit(1);
}
