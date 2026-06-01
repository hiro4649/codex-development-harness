#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { runV103GateCli, buildGithubEventPayloadFreshnessReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildGithubEventPayloadFreshnessReport, 'CODEX_GITHUB_EVENT_PAYLOAD_FRESHNESS_REPORT');
