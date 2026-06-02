#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { buildTargetQualityBlockerDigestReport, runV099GateCli } from './codex-v099-gate-lib.mjs';

export { buildTargetQualityBlockerDigestReport };

runV099GateCli(import.meta.url, process.argv[1], buildTargetQualityBlockerDigestReport, 'CODEX_TARGET_QUALITY_BLOCKER_DIGEST_REPORT');
