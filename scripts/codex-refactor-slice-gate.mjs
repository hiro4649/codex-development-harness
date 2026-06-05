#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildRefactorSliceReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildRefactorSliceReport };

runV100GateCli(import.meta.url, process.argv[1], buildRefactorSliceReport, 'CODEX_REFACTOR_SLICE_REPORT');
