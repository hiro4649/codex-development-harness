#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { runV102GateCli, buildSupportFileBoundaryReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildSupportFileBoundaryReport, 'CODEX_SUPPORT_FILE_BOUNDARY_REPORT');
