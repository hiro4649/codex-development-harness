#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildRuntimeLatencySafeMetricReport, runV098GateCli } from './codex-v098-gate-lib.mjs';

export { buildRuntimeLatencySafeMetricReport };

runV098GateCli(import.meta.url, process.argv[1], buildRuntimeLatencySafeMetricReport, 'CODEX_RUNTIME_LATENCY_SAFE_METRIC_REPORT', {});
