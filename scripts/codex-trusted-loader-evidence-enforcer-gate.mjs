#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildTrustedLoaderEvidenceEnforcerReport, runV098GateCli } from './codex-v098-gate-lib.mjs';

export { buildTrustedLoaderEvidenceEnforcerReport };

runV098GateCli(import.meta.url, process.argv[1], buildTrustedLoaderEvidenceEnforcerReport, 'CODEX_TRUSTED_LOADER_EVIDENCE_ENFORCER_REPORT', {});
