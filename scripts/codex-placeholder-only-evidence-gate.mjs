#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildPlaceholderOnlyEvidenceReport, runV099GateCli } from './codex-v099-gate-lib.mjs';

export { buildPlaceholderOnlyEvidenceReport };

runV099GateCli(import.meta.url, process.argv[1], buildPlaceholderOnlyEvidenceReport, 'CODEX_PLACEHOLDER_ONLY_EVIDENCE_REPORT');
