#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { runV102GateCli, buildSplitScoreModelReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildSplitScoreModelReport, 'CODEX_SPLIT_SCORE_MODEL_REPORT');
