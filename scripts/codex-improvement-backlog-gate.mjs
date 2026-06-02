#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildImprovementBacklogReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildImprovementBacklogReport };

runV100GateCli(import.meta.url, process.argv[1], buildImprovementBacklogReport, 'CODEX_IMPROVEMENT_BACKLOG_REPORT');
