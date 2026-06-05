#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildEvidenceMinimalityReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildEvidenceMinimalityReport };

runV095GateCli(import.meta.url, process.argv[1], buildEvidenceMinimalityReport, 'CODEX_EVIDENCE_MINIMALITY_REPORT');
