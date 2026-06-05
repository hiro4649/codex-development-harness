#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildLive2DDatasetRowAuditReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildLive2DDatasetRowAuditReport };

runV097GateCli(import.meta.url, process.argv[1], buildLive2DDatasetRowAuditReport, 'CODEX_LIVE2D_DATASET_ROW_AUDIT_REPORT');
