#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildVersionSuccessionReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildVersionSuccessionReport };

runV100GateCli(import.meta.url, process.argv[1], buildVersionSuccessionReport, 'CODEX_VERSION_SUCCESSION_REPORT');
