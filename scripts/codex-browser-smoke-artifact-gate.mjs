#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildBrowserSmokeArtifactReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildBrowserSmokeArtifactReport };

runV096GateCli(import.meta.url, process.argv[1], buildBrowserSmokeArtifactReport, 'CODEX_BROWSER_SMOKE_ARTIFACT_REPORT');