#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildProductionGoBoundaryReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildProductionGoBoundaryReport };

runV100GateCli(import.meta.url, process.argv[1], buildProductionGoBoundaryReport, 'CODEX_PRODUCTION_GO_BOUNDARY_REPORT');
