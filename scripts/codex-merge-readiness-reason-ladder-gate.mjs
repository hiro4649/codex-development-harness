#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { runV103GateCli, buildMergeReadinessReasonLadderReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildMergeReadinessReasonLadderReport, 'CODEX_MERGE_READINESS_REASON_LADDER_REPORT');
