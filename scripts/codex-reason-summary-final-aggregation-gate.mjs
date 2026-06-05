#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { runV103GateCli, buildReasonSummaryFinalAggregationReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildReasonSummaryFinalAggregationReport, 'CODEX_REASON_SUMMARY_FINAL_AGGREGATION_REPORT');
