#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { runV102GateCli, buildV085CheckoutDiffIsolationReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildV085CheckoutDiffIsolationReport, 'CODEX_V085_CHECKOUT_DIFF_ISOLATION_REPORT');
