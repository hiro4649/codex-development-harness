#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildWorkerBatchMapReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildWorkerBatchMapReport };

runV100GateCli(import.meta.url, process.argv[1], buildWorkerBatchMapReport, 'CODEX_WORKER_BATCH_MAP_REPORT');
