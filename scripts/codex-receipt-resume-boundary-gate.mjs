#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildReceiptResumeBoundaryReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildReceiptResumeBoundaryReport };

runV096GateCli(import.meta.url, process.argv[1], buildReceiptResumeBoundaryReport, 'CODEX_RECEIPT_RESUME_BOUNDARY_REPORT');