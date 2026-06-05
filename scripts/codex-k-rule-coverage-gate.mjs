#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildKRuleCoverageReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildKRuleCoverageReport };

runV096GateCli(import.meta.url, process.argv[1], buildKRuleCoverageReport, 'CODEX_K_RULE_COVERAGE_REPORT');