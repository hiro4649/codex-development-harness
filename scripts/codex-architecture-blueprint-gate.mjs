#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildArchitectureBlueprintReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildArchitectureBlueprintReport };

runV100GateCli(import.meta.url, process.argv[1], buildArchitectureBlueprintReport, 'CODEX_ARCHITECTURE_BLUEPRINT_REPORT');
