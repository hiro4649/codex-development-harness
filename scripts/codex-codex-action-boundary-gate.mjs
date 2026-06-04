#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { runV103GateCli, buildCodexActionBoundaryReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildCodexActionBoundaryReport, 'CODEX_CODEX_ACTION_BOUNDARY_REPORT');
