#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildTargetHotfixRegressionReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildTargetHotfixRegressionReport };

runV097GateCli(import.meta.url, process.argv[1], buildTargetHotfixRegressionReport, 'CODEX_TARGET_HOTFIX_REGRESSION_REPORT');
