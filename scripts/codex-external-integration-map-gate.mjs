#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildExternalIntegrationMapReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildExternalIntegrationMapReport };

runV100GateCli(import.meta.url, process.argv[1], buildExternalIntegrationMapReport, 'CODEX_EXTERNAL_INTEGRATION_MAP_REPORT');
