#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildLive2DDatasetRowAuditRunnerReport, runV098GateCli } from './codex-v098-gate-lib.mjs';

export { buildLive2DDatasetRowAuditRunnerReport };

runV098GateCli(import.meta.url, process.argv[1], buildLive2DDatasetRowAuditRunnerReport, 'CODEX_LIVE2D_DATASET_ROW_AUDIT_RUNNER_REPORT', {});
