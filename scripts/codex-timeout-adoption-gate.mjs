#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildTimeoutAdoptionReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildTimeoutAdoptionReport };

runV096GateCli(import.meta.url, process.argv[1], buildTimeoutAdoptionReport, 'CODEX_TIMEOUT_ADOPTION_REPORT');