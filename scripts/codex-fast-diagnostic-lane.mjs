#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.8

import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildFastDiagnosticReport } from './codex-v108-gate-lib.mjs';

const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.8',
  status: 'pass',
  ...buildFastDiagnosticReport({
    remoteNpmWiring: process.env.CODEX_FAST_REMOTE_NPM_WIRING === '1',
    branchContamination: process.env.CODEX_FAST_BRANCH_CONTAMINATION === '1',
    classificationUnknown: process.env.CODEX_FAST_CLASSIFICATION_UNKNOWN === '1',
    bodyOnlyRepair: process.env.CODEX_FAST_BODY_ONLY_REPAIR === '1',
  }),
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_FAST_DIAGNOSTIC_LANE_REPORT');
exitFor(report);
