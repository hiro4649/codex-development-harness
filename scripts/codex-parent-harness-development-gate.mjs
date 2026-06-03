#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildParentHarnessDevelopmentReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildParentHarnessDevelopmentReport };

runV100GateCli(import.meta.url, process.argv[1], buildParentHarnessDevelopmentReport, 'CODEX_PARENT_HARNESS_DEVELOPMENT_REPORT');
