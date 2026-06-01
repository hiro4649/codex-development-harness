#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { runV103GateCli, buildWorkflowArtifactReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildWorkflowArtifactReport, 'CODEX_WORKFLOW_ARTIFACT_REPORT');
