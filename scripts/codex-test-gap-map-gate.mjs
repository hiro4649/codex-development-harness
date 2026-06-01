#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildTestGapMapReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildTestGapMapReport };

runV100GateCli(import.meta.url, process.argv[1], buildTestGapMapReport, 'CODEX_TEST_GAP_MAP_REPORT');
