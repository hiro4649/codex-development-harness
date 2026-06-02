#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildSubagentRoleMatrixReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildSubagentRoleMatrixReport };

runV100GateCli(import.meta.url, process.argv[1], buildSubagentRoleMatrixReport, 'CODEX_SUBAGENT_ROLE_MATRIX_REPORT');
