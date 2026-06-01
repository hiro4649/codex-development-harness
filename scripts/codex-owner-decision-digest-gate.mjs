#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildOwnerDecisionDigestReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildOwnerDecisionDigestReport };

runV097GateCli(import.meta.url, process.argv[1], buildOwnerDecisionDigestReport, 'CODEX_OWNER_DECISION_DIGEST_REPORT');
