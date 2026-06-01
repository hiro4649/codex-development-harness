#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { runV102GateCli, buildLegacySelfTestMatrixReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildLegacySelfTestMatrixReport, 'CODEX_LEGACY_SELF_TEST_MATRIX_REPORT');
