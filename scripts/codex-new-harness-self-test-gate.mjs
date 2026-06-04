#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildNewHarnessSelfTestReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildNewHarnessSelfTestReport };

runV100GateCli(import.meta.url, process.argv[1], buildNewHarnessSelfTestReport, 'CODEX_NEW_HARNESS_SELF_TEST_REPORT');
