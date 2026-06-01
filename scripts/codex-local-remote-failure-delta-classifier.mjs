#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { runV103GateCli, buildLocalRemoteFailureDeltaClassifierReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildLocalRemoteFailureDeltaClassifierReport, 'CODEX_LOCAL_REMOTE_FAILURE_DELTA_CLASSIFIER_REPORT');
