#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildGameToolAdapterContractFixtureV097Report, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildGameToolAdapterContractFixtureV097Report };

runV097GateCli(import.meta.url, process.argv[1], buildGameToolAdapterContractFixtureV097Report, 'CODEX_GAME_TOOL_ADAPTER_CONTRACT_FIXTURE_REPORT');
