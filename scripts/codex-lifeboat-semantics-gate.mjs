#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildLifeboatSemanticsReport, runV099GateCli } from './codex-v099-gate-lib.mjs';

export { buildLifeboatSemanticsReport };

runV099GateCli(import.meta.url, process.argv[1], buildLifeboatSemanticsReport, 'CODEX_LIFEBOAT_SEMANTICS_REPORT');
