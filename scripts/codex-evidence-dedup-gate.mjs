#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildEvidenceDedupReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildEvidenceDedupReport };

runV095GateCli(import.meta.url, process.argv[1], buildEvidenceDedupReport, 'CODEX_EVIDENCE_DEDUP_REPORT');
