#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { runV102GateCli, buildSameHeadRemoteEvidencePlanReport } from './codex-v102-gate-lib.mjs';
runV102GateCli(import.meta.url, process.argv[1], buildSameHeadRemoteEvidencePlanReport, 'CODEX_SAME_HEAD_REMOTE_EVIDENCE_PLAN_REPORT');
