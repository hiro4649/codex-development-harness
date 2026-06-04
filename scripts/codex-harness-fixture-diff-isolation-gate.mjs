#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { runV102GateCli, buildHarnessFixtureDiffIsolationReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildHarnessFixtureDiffIsolationReport, 'CODEX_HARNESS_FIXTURE_DIFF_ISOLATION_REPORT');
