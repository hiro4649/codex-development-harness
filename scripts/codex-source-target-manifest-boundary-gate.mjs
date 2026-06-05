#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { runV102GateCli, buildSourceTargetManifestBoundaryReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildSourceTargetManifestBoundaryReport, 'CODEX_SOURCE_TARGET_MANIFEST_BOUNDARY_REPORT');
