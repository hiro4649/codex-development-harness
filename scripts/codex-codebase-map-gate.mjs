#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildCodebaseMapReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildCodebaseMapReport };

runV100GateCli(import.meta.url, process.argv[1], buildCodebaseMapReport, 'CODEX_CODEBASE_MAP_REPORT');
