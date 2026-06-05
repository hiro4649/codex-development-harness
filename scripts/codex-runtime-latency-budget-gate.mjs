#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildRuntimeLatencyBudgetReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildRuntimeLatencyBudgetReport };

runV096GateCli(import.meta.url, process.argv[1], buildRuntimeLatencyBudgetReport, 'CODEX_RUNTIME_LATENCY_BUDGET_REPORT');