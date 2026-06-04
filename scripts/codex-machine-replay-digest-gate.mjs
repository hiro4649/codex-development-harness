#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { runV102GateCli, buildMachineReplayDigestReport, buildDefaultHandoverSnapshot } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], (input) => buildMachineReplayDigestReport({ digest: input.digest || buildDefaultHandoverSnapshot() }), 'CODEX_MACHINE_REPLAY_DIGEST_REPORT');
