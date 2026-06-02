#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { runV102GateCli, buildSmallRepoModeReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildSmallRepoModeReport, 'CODEX_SMALL_REPO_MODE_REPORT');
