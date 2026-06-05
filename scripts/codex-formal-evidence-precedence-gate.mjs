#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildFormalEvidencePrecedenceReport, runV099GateCli } from './codex-v099-gate-lib.mjs';

export { buildFormalEvidencePrecedenceReport };

runV099GateCli(import.meta.url, process.argv[1], buildFormalEvidencePrecedenceReport, 'CODEX_FORMAL_EVIDENCE_PRECEDENCE_REPORT');
