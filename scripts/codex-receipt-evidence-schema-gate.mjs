#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildReceiptEvidenceSchemaReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildReceiptEvidenceSchemaReport };

runV095GateCli(import.meta.url, process.argv[1], buildReceiptEvidenceSchemaReport, 'CODEX_RECEIPT_EVIDENCE_SCHEMA_REPORT');
