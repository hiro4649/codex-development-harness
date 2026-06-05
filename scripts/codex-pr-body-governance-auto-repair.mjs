#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { runV103GateCli, buildPrBodyGovernanceAutoRepairReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildPrBodyGovernanceAutoRepairReport, 'CODEX_PR_BODY_GOVERNANCE_AUTO_REPAIR_REPORT');
