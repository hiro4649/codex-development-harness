#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildDatasetAuditReadinessReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildDatasetAuditReadinessReport };

runV096GateCli(import.meta.url, process.argv[1], buildDatasetAuditReadinessReport, 'CODEX_DATASET_AUDIT_READINESS_REPORT');