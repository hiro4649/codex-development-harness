#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildFailureToRepairPlanReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildFailureToRepairPlanReport };

runV096GateCli(import.meta.url, process.argv[1], buildFailureToRepairPlanReport, 'CODEX_FAILURE_TO_REPAIR_PLAN_REPORT');