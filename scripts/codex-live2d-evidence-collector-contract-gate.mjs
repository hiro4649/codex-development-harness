#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildLive2DEvidenceCollectorContractReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildLive2DEvidenceCollectorContractReport };

runV097GateCli(import.meta.url, process.argv[1], buildLive2DEvidenceCollectorContractReport, 'CODEX_LIVE2D_EVIDENCE_COLLECTOR_CONTRACT_REPORT');
