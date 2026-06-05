#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildLive2DSpecSyncReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildLive2DSpecSyncReport };

runV096GateCli(import.meta.url, process.argv[1], buildLive2DSpecSyncReport, 'CODEX_LIVE2D_SPEC_SYNC_REPORT');