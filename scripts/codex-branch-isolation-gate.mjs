#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildBranchIsolationReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildBranchIsolationReport };

runV100GateCli(import.meta.url, process.argv[1], buildBranchIsolationReport, 'CODEX_BRANCH_ISOLATION_REPORT');
