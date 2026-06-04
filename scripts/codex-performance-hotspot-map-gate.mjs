#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildPerformanceHotspotMapReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildPerformanceHotspotMapReport };

runV100GateCli(import.meta.url, process.argv[1], buildPerformanceHotspotMapReport, 'CODEX_PERFORMANCE_HOTSPOT_MAP_REPORT');
