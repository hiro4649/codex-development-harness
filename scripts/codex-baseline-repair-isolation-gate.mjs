#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { runV102GateCli, buildBaselineRepairIsolationReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildBaselineRepairIsolationReport, 'CODEX_BASELINE_REPAIR_ISOLATION_REPORT');
