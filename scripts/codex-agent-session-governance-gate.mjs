#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildAgentSessionGovernanceReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildAgentSessionGovernanceReport };

runV095GateCli(import.meta.url, process.argv[1], buildAgentSessionGovernanceReport, 'CODEX_AGENT_SESSION_GOVERNANCE_REPORT');
