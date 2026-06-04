#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildDatasetAuditV2P0SchemaReport, runV099GateCli } from './codex-v099-gate-lib.mjs';

export { buildDatasetAuditV2P0SchemaReport };

runV099GateCli(import.meta.url, process.argv[1], buildDatasetAuditV2P0SchemaReport, 'CODEX_DATASET_AUDIT_V2_P0_SCHEMA_REPORT');
