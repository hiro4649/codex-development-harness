#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildRuntimeReadinessBoundaryReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildRuntimeReadinessBoundaryReport };

runV100GateCli(import.meta.url, process.argv[1], buildRuntimeReadinessBoundaryReport, 'CODEX_RUNTIME_READINESS_BOUNDARY_REPORT');
