#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildEvalTraceHarvestReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildEvalTraceHarvestReport };

runV095GateCli(import.meta.url, process.argv[1], buildEvalTraceHarvestReport, 'CODEX_EVAL_TRACE_HARVEST_REPORT');
