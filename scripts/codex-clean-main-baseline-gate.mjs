#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { runV102GateCli, buildCleanMainBaselineStabilityReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildCleanMainBaselineStabilityReport, 'CODEX_CLEAN_MAIN_BASELINE_REPORT');
