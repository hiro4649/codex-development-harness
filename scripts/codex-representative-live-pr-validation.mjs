#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.8

import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildRepresentativeLivePrValidationReport } from './codex-v108-gate-lib.mjs';

const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.8',
  status: 'pass',
  ...buildRepresentativeLivePrValidationReport({
    externalBlocked: process.env.CODEX_REPRESENTATIVE_LIVE_EXTERNAL_BLOCKED === '1',
  }),
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_REPRESENTATIVE_LIVE_PR_VALIDATION_REPORT');
exitFor(report);
