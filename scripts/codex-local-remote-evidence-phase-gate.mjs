#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildLocalRemoteEvidencePhaseReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildLocalRemoteEvidencePhaseReport };

runV097GateCli(import.meta.url, process.argv[1], buildLocalRemoteEvidencePhaseReport, 'CODEX_LOCAL_REMOTE_EVIDENCE_PHASE_REPORT');
