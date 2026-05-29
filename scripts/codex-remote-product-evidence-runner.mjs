#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.9
import { buildRemoteProductEvidenceRunnerReport, runV098GateCli } from './codex-v098-gate-lib.mjs';

export { buildRemoteProductEvidenceRunnerReport };

runV098GateCli(import.meta.url, process.argv[1], buildRemoteProductEvidenceRunnerReport, 'CODEX_REMOTE_PRODUCT_EVIDENCE_RUNNER_REPORT', { writeArtifacts: true });
