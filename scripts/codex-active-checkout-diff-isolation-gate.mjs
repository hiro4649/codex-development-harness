#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { runV102GateCli, buildActiveCheckoutDiffIsolationReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildActiveCheckoutDiffIsolationReport, 'CODEX_ACTIVE_CHECKOUT_DIFF_ISOLATION_REPORT');
