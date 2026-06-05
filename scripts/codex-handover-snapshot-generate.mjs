#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildDefaultHandoverSnapshot, buildHandoverSnapshotReport } from './codex-v102-gate-lib.mjs';
const snapshot = buildDefaultHandoverSnapshot();
const status = buildHandoverSnapshotReport({ snapshot }).handoverSnapshotStatus;
const report = { marker: 'CODEX_QUALITY_HARNESS_FILE v1.0.7', status: status.status, handoverSnapshotStatus: status, snapshot, safeSummaryOnly: true };
writeJsonReport(report, 'CODEX_HANDOVER_SNAPSHOT_GENERATE_REPORT');
exitFor(report);
