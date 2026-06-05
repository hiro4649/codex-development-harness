#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildOwnerSummaryCompactReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildOwnerSummaryCompactReport };

runV096GateCli(import.meta.url, process.argv[1], buildOwnerSummaryCompactReport, 'CODEX_OWNER_SUMMARY_COMPACT_REPORT');