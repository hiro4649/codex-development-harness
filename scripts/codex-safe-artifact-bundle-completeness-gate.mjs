#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildSafeArtifactBundleCompletenessReport, runV099GateCli } from './codex-v099-gate-lib.mjs';

export { buildSafeArtifactBundleCompletenessReport };

runV099GateCli(import.meta.url, process.argv[1], buildSafeArtifactBundleCompletenessReport, 'CODEX_SAFE_ARTIFACT_BUNDLE_COMPLETENESS_REPORT');
