#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildPrEvidenceAutoRepairHintReport, runV099GateCli } from './codex-v099-gate-lib.mjs';

export { buildPrEvidenceAutoRepairHintReport };

runV099GateCli(import.meta.url, process.argv[1], buildPrEvidenceAutoRepairHintReport, 'CODEX_PR_EVIDENCE_AUTO_REPAIR_HINT_REPORT');
