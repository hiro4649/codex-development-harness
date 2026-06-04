#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildOpenPrRebaseReadinessReport, runV098GateCli } from './codex-v098-gate-lib.mjs';

export { buildOpenPrRebaseReadinessReport };

runV098GateCli(import.meta.url, process.argv[1], buildOpenPrRebaseReadinessReport, 'CODEX_OPEN_PR_REBASE_READINESS_REPORT', {});
