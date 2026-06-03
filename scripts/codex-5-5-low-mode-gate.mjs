#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { runV103GateCli, buildFiveFiveLowModeReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildFiveFiveLowModeReport, 'CODEX_5_5_LOW_MODE_REPORT');
