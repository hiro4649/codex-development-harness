#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildWorkerReadinessSequenceReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildWorkerReadinessSequenceReport };

runV095GateCli(import.meta.url, process.argv[1], buildWorkerReadinessSequenceReport, 'CODEX_WORKER_READINESS_SEQUENCE_REPORT');
