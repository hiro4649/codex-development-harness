#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.8
import { buildAgentsDoctrineReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildAgentsDoctrineReport };

runV095GateCli(import.meta.url, process.argv[1], buildAgentsDoctrineReport, 'CODEX_AGENTS_DOCTRINE_REPORT');
