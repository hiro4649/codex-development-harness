#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildRuntimeLatencyMeasurementReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildRuntimeLatencyMeasurementReport };

runV097GateCli(import.meta.url, process.argv[1], buildRuntimeLatencyMeasurementReport, 'CODEX_RUNTIME_LATENCY_MEASUREMENT_REPORT');
