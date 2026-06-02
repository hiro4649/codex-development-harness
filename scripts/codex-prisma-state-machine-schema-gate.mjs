#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildPrismaStateMachineSchemaReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildPrismaStateMachineSchemaReport };

runV095GateCli(import.meta.url, process.argv[1], buildPrismaStateMachineSchemaReport, 'CODEX_PRISMA_STATE_MACHINE_SCHEMA_REPORT');
