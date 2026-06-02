#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildBrowserSmokeJsonArtifactReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildBrowserSmokeJsonArtifactReport };

runV097GateCli(import.meta.url, process.argv[1], buildBrowserSmokeJsonArtifactReport, 'CODEX_BROWSER_SMOKE_JSON_ARTIFACT_REPORT');
