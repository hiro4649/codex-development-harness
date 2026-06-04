#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildDataFlowMapReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildDataFlowMapReport };

runV100GateCli(import.meta.url, process.argv[1], buildDataFlowMapReport, 'CODEX_DATA_FLOW_MAP_REPORT');
