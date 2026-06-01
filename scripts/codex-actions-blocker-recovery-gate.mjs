#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildActionsBlockerRecoveryReport, runV099GateCli } from './codex-v099-gate-lib.mjs';

export { buildActionsBlockerRecoveryReport };

runV099GateCli(import.meta.url, process.argv[1], buildActionsBlockerRecoveryReport, 'CODEX_ACTIONS_BLOCKER_RECOVERY_REPORT');
