#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildBrowserSmokeVisualSafetyArtifactReport, runV098GateCli } from './codex-v098-gate-lib.mjs';

export { buildBrowserSmokeVisualSafetyArtifactReport };

runV098GateCli(import.meta.url, process.argv[1], buildBrowserSmokeVisualSafetyArtifactReport, 'CODEX_BROWSER_SMOKE_VISUAL_SAFETY_ARTIFACT_REPORT', {});
