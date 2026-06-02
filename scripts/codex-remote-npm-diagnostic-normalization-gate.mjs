#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildRemoteNpmDiagnosticNormalizationReport, runV099GateCli } from './codex-v099-gate-lib.mjs';

export { buildRemoteNpmDiagnosticNormalizationReport };

runV099GateCli(import.meta.url, process.argv[1], buildRemoteNpmDiagnosticNormalizationReport, 'CODEX_REMOTE_NPM_DIAGNOSTIC_NORMALIZATION_REPORT');
