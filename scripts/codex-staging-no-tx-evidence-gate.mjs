#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { runV103GateCli, buildStagingNoTxEvidenceReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildStagingNoTxEvidenceReport, 'CODEX_STAGING_NO_TX_EVIDENCE_REPORT');
