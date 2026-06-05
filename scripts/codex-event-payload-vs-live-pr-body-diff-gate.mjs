#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { runV103GateCli, buildEventPayloadVsLivePrBodyDiffReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildEventPayloadVsLivePrBodyDiffReport, 'CODEX_EVENT_PAYLOAD_VS_LIVE_PR_BODY_DIFF_REPORT');
