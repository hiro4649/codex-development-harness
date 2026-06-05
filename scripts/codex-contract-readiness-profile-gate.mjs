#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { runV103GateCli, buildContractReadinessProfileReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildContractReadinessProfileReport, 'CODEX_CONTRACT_READINESS_PROFILE_REPORT');
