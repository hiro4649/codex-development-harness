#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildSkillRoutingReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildSkillRoutingReport };

runV095GateCli(import.meta.url, process.argv[1], buildSkillRoutingReport, 'CODEX_SKILL_ROUTING_REPORT');
