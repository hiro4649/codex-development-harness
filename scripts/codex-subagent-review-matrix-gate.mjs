#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildSubagentReviewMatrixReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildSubagentReviewMatrixReport };

runV095GateCli(import.meta.url, process.argv[1], buildSubagentReviewMatrixReport, 'CODEX_SUBAGENT_REVIEW_MATRIX_REPORT');
