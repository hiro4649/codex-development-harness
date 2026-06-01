#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildProductEvidenceConsumptionReport, runV098GateCli } from './codex-v098-gate-lib.mjs';

export { buildProductEvidenceConsumptionReport };

runV098GateCli(import.meta.url, process.argv[1], buildProductEvidenceConsumptionReport, 'CODEX_PRODUCT_EVIDENCE_CONSUMPTION_REPORT', {});
