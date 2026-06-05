#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { runV103GateCli, buildActiveSelfTestArtifactSourceReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildActiveSelfTestArtifactSourceReport, 'CODEX_ACTIVE_SELF_TEST_ARTIFACT_SOURCE_REPORT');
