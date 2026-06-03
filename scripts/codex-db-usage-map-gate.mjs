#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildDbUsageMapReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildDbUsageMapReport };

runV100GateCli(import.meta.url, process.argv[1], buildDbUsageMapReport, 'CODEX_DB_USAGE_MAP_REPORT');
