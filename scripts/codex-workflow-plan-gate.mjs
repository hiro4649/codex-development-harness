#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildWorkflowPlanReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildWorkflowPlanReport };

runV100GateCli(import.meta.url, process.argv[1], buildWorkflowPlanReport, 'CODEX_WORKFLOW_PLAN_REPORT');
