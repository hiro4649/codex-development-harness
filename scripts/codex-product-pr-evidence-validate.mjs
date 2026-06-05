#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { runV102GateCli, buildProductPrEvidenceValidatorReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildProductPrEvidenceValidatorReport, 'CODEX_PRODUCT_PR_EVIDENCE_VALIDATOR_REPORT');
