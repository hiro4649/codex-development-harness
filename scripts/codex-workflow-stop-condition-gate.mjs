#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildWorkflowStopConditionReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildWorkflowStopConditionReport };

runV100GateCli(import.meta.url, process.argv[1], buildWorkflowStopConditionReport, 'CODEX_WORKFLOW_STOP_CONDITION_REPORT');
