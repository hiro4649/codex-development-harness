#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildRuntimeStateAdoptionReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildRuntimeStateAdoptionReport };

runV096GateCli(import.meta.url, process.argv[1], buildRuntimeStateAdoptionReport, 'CODEX_RUNTIME_STATE_ADOPTION_REPORT');