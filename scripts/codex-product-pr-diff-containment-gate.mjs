#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { runV102GateCli, buildProductPrDiffContainmentReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildProductPrDiffContainmentReport, 'CODEX_PRODUCT_PR_DIFF_CONTAINMENT_REPORT');
