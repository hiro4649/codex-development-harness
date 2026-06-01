#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { runV103GateCli, buildVgcFunkyReleaseLadderReport } from './codex-v103-gate-lib.mjs';
runV103GateCli(import.meta.url, process.argv[1], buildVgcFunkyReleaseLadderReport, 'CODEX_VGC_FUNKY_RELEASE_LADDER_REPORT');
