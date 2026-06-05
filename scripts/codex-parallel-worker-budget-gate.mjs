#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildParallelWorkerBudgetReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildParallelWorkerBudgetReport };

runV100GateCli(import.meta.url, process.argv[1], buildParallelWorkerBudgetReport, 'CODEX_PARALLEL_WORKER_BUDGET_REPORT');
