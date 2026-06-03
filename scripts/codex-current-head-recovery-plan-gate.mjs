#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { runV102GateCli, buildCurrentHeadRecoveryPlanReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildCurrentHeadRecoveryPlanReport, 'CODEX_CURRENT_HEAD_RECOVERY_PLAN_REPORT');
