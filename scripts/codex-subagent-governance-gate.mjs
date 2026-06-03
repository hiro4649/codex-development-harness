#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildSubagentGovernanceReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildSubagentGovernanceReport };

runV095GateCli(import.meta.url, process.argv[1], buildSubagentGovernanceReport, 'CODEX_SUBAGENT_GOVERNANCE_REPORT');
