#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildOperatorVisibleDeltaReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildOperatorVisibleDeltaReport };

runV095GateCli(import.meta.url, process.argv[1], buildOperatorVisibleDeltaReport, 'CODEX_OPERATOR_VISIBLE_DELTA_REPORT');
