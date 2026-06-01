#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { runV103GateCli, buildStaleAuditInputReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildStaleAuditInputReport, 'CODEX_STALE_AUDIT_INPUT_REPORT');
