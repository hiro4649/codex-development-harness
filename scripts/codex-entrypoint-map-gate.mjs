#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildEntrypointMapReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildEntrypointMapReport };

runV100GateCli(import.meta.url, process.argv[1], buildEntrypointMapReport, 'CODEX_ENTRYPOINT_MAP_REPORT');
