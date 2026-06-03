#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildWorkflowResumeReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildWorkflowResumeReport };

runV100GateCli(import.meta.url, process.argv[1], buildWorkflowResumeReport, 'CODEX_WORKFLOW_RESUME_REPORT');
