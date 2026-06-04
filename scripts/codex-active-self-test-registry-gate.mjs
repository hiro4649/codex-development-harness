#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import { buildActiveSelfTestRegistryReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildActiveSelfTestRegistryReport };

runV097GateCli(import.meta.url, process.argv[1], buildActiveSelfTestRegistryReport, 'CODEX_ACTIVE_SELF_TEST_REGISTRY_REPORT');
