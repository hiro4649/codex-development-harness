#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildTraceToEvalCandidateReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildTraceToEvalCandidateReport };

runV095GateCli(import.meta.url, process.argv[1], buildTraceToEvalCandidateReport, 'CODEX_TRACE_TO_EVAL_CANDIDATE_REPORT');
