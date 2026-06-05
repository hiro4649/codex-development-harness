#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildAgentContainmentBoundaryReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildAgentContainmentBoundaryReport };

runV095GateCli(import.meta.url, process.argv[1], buildAgentContainmentBoundaryReport, 'CODEX_AGENT_CONTAINMENT_BOUNDARY_REPORT');
