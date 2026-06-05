#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { runV103GateCli, buildPrBodyLiveFetchReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildPrBodyLiveFetchReport, 'CODEX_PR_BODY_LIVE_FETCH_REPORT');
