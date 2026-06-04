#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildParentHarnessSelfTestReport, runV100GateCli } from './codex-v100-gate-lib.mjs';

export { buildParentHarnessSelfTestReport };

runV100GateCli(import.meta.url, process.argv[1], buildParentHarnessSelfTestReport, 'CODEX_PARENT_HARNESS_SELF_TEST_REPORT');
