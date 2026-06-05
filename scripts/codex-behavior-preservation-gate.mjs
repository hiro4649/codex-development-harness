#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildBehaviorPreservationReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildBehaviorPreservationReport };

runV100GateCli(import.meta.url, process.argv[1], buildBehaviorPreservationReport, 'CODEX_BEHAVIOR_PRESERVATION_REPORT');
