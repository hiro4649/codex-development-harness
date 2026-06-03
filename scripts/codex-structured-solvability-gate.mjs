#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildStructuredSolvabilityReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildStructuredSolvabilityReport };

runV097GateCli(import.meta.url, process.argv[1], buildStructuredSolvabilityReport, 'CODEX_STRUCTURED_SOLVABILITY_REPORT');
