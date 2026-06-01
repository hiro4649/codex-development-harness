#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildFiveLineOwnerDigestReport, runV098GateCli } from './codex-v098-gate-lib.mjs';

export { buildFiveLineOwnerDigestReport };

runV098GateCli(import.meta.url, process.argv[1], buildFiveLineOwnerDigestReport, 'CODEX_FIVE_LINE_OWNER_DIGEST_REPORT', {});
