#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildDeadCodeCandidateReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildDeadCodeCandidateReport };

runV100GateCli(import.meta.url, process.argv[1], buildDeadCodeCandidateReport, 'CODEX_DEAD_CODE_CANDIDATE_REPORT');
