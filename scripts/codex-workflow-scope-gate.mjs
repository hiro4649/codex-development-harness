#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildWorkflowScopeReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildWorkflowScopeReport };

runV100GateCli(import.meta.url, process.argv[1], buildWorkflowScopeReport, 'CODEX_WORKFLOW_SCOPE_REPORT');
