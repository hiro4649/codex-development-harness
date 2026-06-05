#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { buildLegacySelfTestAdvisoryReport, runV099GateCli } from './codex-v099-gate-lib.mjs';

export { buildLegacySelfTestAdvisoryReport };

runV099GateCli(import.meta.url, process.argv[1], buildLegacySelfTestAdvisoryReport, 'CODEX_LEGACY_SELF_TEST_ADVISORY_REPORT');
