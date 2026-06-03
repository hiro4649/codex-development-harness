#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { runV103GateCli, buildUserManualWorkProhibitedReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildUserManualWorkProhibitedReport, 'CODEX_USER_MANUAL_WORK_PROHIBITED_REPORT');
