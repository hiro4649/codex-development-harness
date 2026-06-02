#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { runV103GateCli, buildRemoteNpmDiagnosticTruthReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildRemoteNpmDiagnosticTruthReport, 'CODEX_REMOTE_NPM_DIAGNOSTIC_TRUTH_REPORT');
