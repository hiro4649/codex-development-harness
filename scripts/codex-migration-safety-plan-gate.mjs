#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildMigrationSafetyPlanReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildMigrationSafetyPlanReport };

runV100GateCli(import.meta.url, process.argv[1], buildMigrationSafetyPlanReport, 'CODEX_MIGRATION_SAFETY_PLAN_REPORT');
