#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { runV102GateCli, buildSupportFileMaterializationReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildSupportFileMaterializationReport, 'CODEX_SUPPORT_FILE_MATERIALIZATION_REPORT');
