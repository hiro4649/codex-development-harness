#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildParentGatePreservationReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildParentGatePreservationReport };

runV100GateCli(import.meta.url, process.argv[1], buildParentGatePreservationReport, 'CODEX_PARENT_GATE_PRESERVATION_REPORT');
