#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { runV103GateCli, buildReceiptFetcherNoSecretPreflightReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildReceiptFetcherNoSecretPreflightReport, 'CODEX_RECEIPT_FETCHER_NO_SECRET_PREFLIGHT_REPORT');
