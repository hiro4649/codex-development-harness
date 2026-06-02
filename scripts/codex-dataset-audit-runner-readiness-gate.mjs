#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildDatasetAuditRunnerReadinessReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildDatasetAuditRunnerReadinessReport };

runV097GateCli(import.meta.url, process.argv[1], buildDatasetAuditRunnerReadinessReport, 'CODEX_DATASET_AUDIT_RUNNER_READINESS_REPORT');
