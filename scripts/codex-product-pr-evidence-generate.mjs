#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { runV102GateCli, buildProductPrEvidenceGeneratorReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildProductPrEvidenceGeneratorReport, 'CODEX_PRODUCT_PR_EVIDENCE_GENERATOR_REPORT');
