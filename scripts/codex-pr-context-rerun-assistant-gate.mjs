#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildPrContextRerunAssistantReport, runV099GateCli } from './codex-v099-gate-lib.mjs';

export { buildPrContextRerunAssistantReport };

runV099GateCli(import.meta.url, process.argv[1], buildPrContextRerunAssistantReport, 'CODEX_PR_CONTEXT_RERUN_ASSISTANT_REPORT');
