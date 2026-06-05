#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildApiSurfaceMapReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildApiSurfaceMapReport };

runV100GateCli(import.meta.url, process.argv[1], buildApiSurfaceMapReport, 'CODEX_API_SURFACE_MAP_REPORT');
