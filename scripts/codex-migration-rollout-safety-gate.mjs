#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildMigrationRolloutSafetyReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildMigrationRolloutSafetyReport };

runV096GateCli(import.meta.url, process.argv[1], buildMigrationRolloutSafetyReport, 'CODEX_MIGRATION_ROLLOUT_SAFETY_REPORT');