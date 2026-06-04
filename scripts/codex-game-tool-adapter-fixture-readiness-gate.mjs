#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildGameToolAdapterFixtureReadinessReport, runV099GateCli } from './codex-v099-gate-lib.mjs';

export { buildGameToolAdapterFixtureReadinessReport };

runV099GateCli(import.meta.url, process.argv[1], buildGameToolAdapterFixtureReadinessReport, 'CODEX_GAME_TOOL_ADAPTER_FIXTURE_READINESS_REPORT');
