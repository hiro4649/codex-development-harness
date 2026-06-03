#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildSameHeadEvidenceRefreshReport, runV099GateCli } from './codex-v099-gate-lib.mjs';

export { buildSameHeadEvidenceRefreshReport };

runV099GateCli(import.meta.url, process.argv[1], buildSameHeadEvidenceRefreshReport, 'CODEX_SAME_HEAD_EVIDENCE_REFRESH_REPORT');
