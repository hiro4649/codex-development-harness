#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildModuleBoundaryReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildModuleBoundaryReport };

runV100GateCli(import.meta.url, process.argv[1], buildModuleBoundaryReport, 'CODEX_MODULE_BOUNDARY_REPORT');
