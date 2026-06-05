#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildTxReconciliationServiceReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildTxReconciliationServiceReport };

runV096GateCli(import.meta.url, process.argv[1], buildTxReconciliationServiceReport, 'CODEX_TX_RECONCILIATION_SERVICE_REPORT');