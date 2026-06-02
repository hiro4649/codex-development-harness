#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildServiceCostMapReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildServiceCostMapReport };

runV100GateCli(import.meta.url, process.argv[1], buildServiceCostMapReport, 'CODEX_SERVICE_COST_MAP_REPORT');
