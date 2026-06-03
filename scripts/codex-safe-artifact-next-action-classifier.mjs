#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildSafeArtifactNextActionReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildSafeArtifactNextActionReport };

runV095GateCli(import.meta.url, process.argv[1], buildSafeArtifactNextActionReport, 'CODEX_SAFE_ARTIFACT_NEXT_ACTION_REPORT');
