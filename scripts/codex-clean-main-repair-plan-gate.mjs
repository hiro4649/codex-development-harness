#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { runV102GateCli, buildCleanMainRepairPlanReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildCleanMainRepairPlanReport, 'CODEX_CLEAN_MAIN_REPAIR_PLAN_REPORT');
