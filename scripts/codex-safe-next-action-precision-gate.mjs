#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { runV103GateCli, buildSafeNextActionPrecisionReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildSafeNextActionPrecisionReport, 'CODEX_SAFE_NEXT_ACTION_PRECISION_REPORT');
