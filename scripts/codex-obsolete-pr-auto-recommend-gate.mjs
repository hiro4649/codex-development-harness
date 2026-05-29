#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.9
import { buildObsoletePrAutoRecommendReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildObsoletePrAutoRecommendReport };

runV097GateCli(import.meta.url, process.argv[1], buildObsoletePrAutoRecommendReport, 'CODEX_OBSOLETE_PR_AUTO_RECOMMEND_REPORT');
