#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildClaimTransitionReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildClaimTransitionReport };

runV096GateCli(import.meta.url, process.argv[1], buildClaimTransitionReport, 'CODEX_CLAIM_TRANSITION_REPORT');