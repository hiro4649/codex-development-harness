#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildMotionAllowlistDiffReport, runV098GateCli } from './codex-v098-gate-lib.mjs';

export { buildMotionAllowlistDiffReport };

runV098GateCli(import.meta.url, process.argv[1], buildMotionAllowlistDiffReport, 'CODEX_MOTION_ALLOWLIST_DIFF_REPORT', {});
