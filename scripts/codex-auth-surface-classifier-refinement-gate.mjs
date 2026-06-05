#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildAuthSurfaceClassifierRefinementReport, runV099GateCli } from './codex-v099-gate-lib.mjs';

export { buildAuthSurfaceClassifierRefinementReport };

runV099GateCli(import.meta.url, process.argv[1], buildAuthSurfaceClassifierRefinementReport, 'CODEX_AUTH_SURFACE_CLASSIFIER_REFINEMENT_REPORT');
