#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildBlockerRootCauseClassifierReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildBlockerRootCauseClassifierReport };

runV097GateCli(import.meta.url, process.argv[1], buildBlockerRootCauseClassifierReport, 'CODEX_BLOCKER_ROOT_CAUSE_CLASSIFIER_REPORT');
