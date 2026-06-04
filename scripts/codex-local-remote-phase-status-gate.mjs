#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildLocalRemotePhaseStatusReport, runV098GateCli } from './codex-v098-gate-lib.mjs';

export { buildLocalRemotePhaseStatusReport };

runV098GateCli(import.meta.url, process.argv[1], buildLocalRemotePhaseStatusReport, 'CODEX_LOCAL_REMOTE_PHASE_STATUS_REPORT', {});
