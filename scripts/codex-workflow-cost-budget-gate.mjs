#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildWorkflowCostBudgetReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildWorkflowCostBudgetReport };

runV100GateCli(import.meta.url, process.argv[1], buildWorkflowCostBudgetReport, 'CODEX_WORKFLOW_COST_BUDGET_REPORT');
