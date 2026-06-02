#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildHarnessRolloutDiffRegressionReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildHarnessRolloutDiffRegressionReport };

runV097GateCli(import.meta.url, process.argv[1], buildHarnessRolloutDiffRegressionReport, 'CODEX_HARNESS_ROLLOUT_DIFF_REGRESSION_REPORT');
