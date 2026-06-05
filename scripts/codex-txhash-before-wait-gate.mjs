#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildTxHashBeforeWaitReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildTxHashBeforeWaitReport };

runV096GateCli(import.meta.url, process.argv[1], buildTxHashBeforeWaitReport, 'CODEX_TXHASH_BEFORE_WAIT_REPORT');