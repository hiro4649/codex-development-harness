#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { runV102GateCli, buildCurrentBranchRegressionReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildCurrentBranchRegressionReport, 'CODEX_CURRENT_BRANCH_REGRESSION_REPORT');
