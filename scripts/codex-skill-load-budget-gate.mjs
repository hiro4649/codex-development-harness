#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildSkillLoadBudgetReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildSkillLoadBudgetReport };

runV095GateCli(import.meta.url, process.argv[1], buildSkillLoadBudgetReport, 'CODEX_SKILL_LOAD_BUDGET_REPORT');
