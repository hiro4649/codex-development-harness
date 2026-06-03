#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildTrustedLoaderEvidenceReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildTrustedLoaderEvidenceReport };

runV097GateCli(import.meta.url, process.argv[1], buildTrustedLoaderEvidenceReport, 'CODEX_TRUSTED_LOADER_EVIDENCE_REPORT');
