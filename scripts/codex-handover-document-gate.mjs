#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildHandoverDocumentReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildHandoverDocumentReport };

runV100GateCli(import.meta.url, process.argv[1], buildHandoverDocumentReport, 'CODEX_HANDOVER_DOCUMENT_REPORT');
