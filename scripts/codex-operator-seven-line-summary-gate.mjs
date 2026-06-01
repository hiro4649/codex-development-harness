#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { runV102GateCli, buildOperatorSevenLineSummaryReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildOperatorSevenLineSummaryReport, 'CODEX_OPERATOR_SEVEN_LINE_SUMMARY_REPORT');
