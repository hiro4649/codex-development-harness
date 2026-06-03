#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildRemoteProductEvidenceExecutionReport, runV098GateCli } from './codex-v098-gate-lib.mjs';

export { buildRemoteProductEvidenceExecutionReport };

runV098GateCli(import.meta.url, process.argv[1], buildRemoteProductEvidenceExecutionReport, 'CODEX_REMOTE_PRODUCT_EVIDENCE_EXECUTION_REPORT', {});
