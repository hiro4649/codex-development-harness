#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.6
import { buildHumanReviewDigestReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildHumanReviewDigestReport };

runV096GateCli(import.meta.url, process.argv[1], buildHumanReviewDigestReport, 'CODEX_HUMAN_REVIEW_DIGEST_REPORT');