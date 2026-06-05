#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildEvidenceAggregationReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildEvidenceAggregationReport };

runV100GateCli(import.meta.url, process.argv[1], buildEvidenceAggregationReport, 'CODEX_EVIDENCE_AGGREGATION_REPORT');
