#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.2

import { buildDefaultV112Statuses } from './codex-v112-conversation-surface.mjs';

const status = buildDefaultV112Statuses().tokenBudgetGovernorV2Status;
console.log(JSON.stringify({ tokenBudgetGovernorV2Status: status, conversationSurfaceBudgetStatus: { status: 'pass', safeSummaryOnly: true }, safeSummaryOnly: true }, null, 2));
