#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildWorkerFileOwnershipReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildWorkerFileOwnershipReport };

runV100GateCli(import.meta.url, process.argv[1], buildWorkerFileOwnershipReport, 'CODEX_WORKER_FILE_OWNERSHIP_REPORT');
