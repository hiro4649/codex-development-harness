#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildMergeSequenceReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildMergeSequenceReport };

runV100GateCli(import.meta.url, process.argv[1], buildMergeSequenceReport, 'CODEX_MERGE_SEQUENCE_REPORT');
