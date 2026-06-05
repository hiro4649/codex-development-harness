#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.8

import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildManualGateAuditChainReport } from './codex-v108-gate-lib.mjs';

const report = {
  marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.8',
  status: 'pass',
  ...buildManualGateAuditChainReport({
    textOnlyApproval: process.env.CODEX_MANUAL_GATE_TEXT_ONLY === '1',
    reusedApproval: process.env.CODEX_MANUAL_GATE_REUSED === '1',
    headMismatch: process.env.CODEX_MANUAL_GATE_HEAD_MISMATCH === '1',
  }),
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_MANUAL_GATE_AUDIT_CHAIN_REPORT');
exitFor(report);
