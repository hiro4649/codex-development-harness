#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildDatasetAuditV2SchemaReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildDatasetAuditV2SchemaReport };

runV097GateCli(import.meta.url, process.argv[1], buildDatasetAuditV2SchemaReport, 'CODEX_DATASET_AUDIT_V2_SCHEMA_REPORT');
