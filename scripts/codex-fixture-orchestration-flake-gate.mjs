#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { runV102GateCli, buildFixtureOrchestrationFlakeReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildFixtureOrchestrationFlakeReport, 'CODEX_FIXTURE_ORCHESTRATION_FLAKE_REPORT');
