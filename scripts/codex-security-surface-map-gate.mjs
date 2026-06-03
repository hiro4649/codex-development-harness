#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildSecuritySurfaceMapReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildSecuritySurfaceMapReport };

runV100GateCli(import.meta.url, process.argv[1], buildSecuritySurfaceMapReport, 'CODEX_SECURITY_SURFACE_MAP_REPORT');
