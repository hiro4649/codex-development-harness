#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildMigrationRuntimeCompatReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildMigrationRuntimeCompatReport };

runV096GateCli(import.meta.url, process.argv[1], buildMigrationRuntimeCompatReport, 'CODEX_MIGRATION_RUNTIME_COMPAT_REPORT');