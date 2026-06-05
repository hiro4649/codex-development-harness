#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildObsoleteOpenPrReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildObsoleteOpenPrReport };

runV096GateCli(import.meta.url, process.argv[1], buildObsoleteOpenPrReport, 'CODEX_OBSOLETE_OPEN_PR_REPORT');