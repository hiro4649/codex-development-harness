#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.6
import { buildObsoleteOpenPrReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildObsoleteOpenPrReport };

runV096GateCli(import.meta.url, process.argv[1], buildObsoleteOpenPrReport, 'CODEX_OBSOLETE_OPEN_PR_REPORT');