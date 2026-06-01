#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildMotionAllowlistSyncReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildMotionAllowlistSyncReport };

runV097GateCli(import.meta.url, process.argv[1], buildMotionAllowlistSyncReport, 'CODEX_MOTION_ALLOWLIST_SYNC_REPORT');
