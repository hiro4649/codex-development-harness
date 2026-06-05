#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildTaskGraphReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildTaskGraphReport };

runV100GateCli(import.meta.url, process.argv[1], buildTaskGraphReport, 'CODEX_TASK_GRAPH_REPORT');
