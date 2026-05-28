#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.6
import { buildGameToolAdapterContractFixtureReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildGameToolAdapterContractFixtureReport };

runV096GateCli(import.meta.url, process.argv[1], buildGameToolAdapterContractFixtureReport, 'CODEX_GAME_TOOL_ADAPTER_CONTRACT_FIXTURE_REPORT');