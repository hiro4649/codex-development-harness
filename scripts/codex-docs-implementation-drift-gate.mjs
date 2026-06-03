#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildDocsImplementationDriftReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildDocsImplementationDriftReport };

runV100GateCli(import.meta.url, process.argv[1], buildDocsImplementationDriftReport, 'CODEX_DOCS_IMPLEMENTATION_DRIFT_REPORT');
