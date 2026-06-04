#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { runV103GateCli, buildSafeArtifactHeadMatchReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildSafeArtifactHeadMatchReport, 'CODEX_SAFE_ARTIFACT_HEAD_MATCH_REPORT');
