#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildStructuredSolvabilityFieldsReport, runV098GateCli } from './codex-v098-gate-lib.mjs';

export { buildStructuredSolvabilityFieldsReport };

runV098GateCli(import.meta.url, process.argv[1], buildStructuredSolvabilityFieldsReport, 'CODEX_STRUCTURED_SOLVABILITY_FIELDS_REPORT', {});
