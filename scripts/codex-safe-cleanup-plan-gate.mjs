#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildSafeCleanupPlanReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildSafeCleanupPlanReport };

runV100GateCli(import.meta.url, process.argv[1], buildSafeCleanupPlanReport, 'CODEX_SAFE_CLEANUP_PLAN_REPORT');
