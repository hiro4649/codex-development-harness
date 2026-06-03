#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildBelovedAvatarSafetyReadinessReport, runV099GateCli } from './codex-v099-gate-lib.mjs';

export { buildBelovedAvatarSafetyReadinessReport };

runV099GateCli(import.meta.url, process.argv[1], buildBelovedAvatarSafetyReadinessReport, 'CODEX_BELOVED_AVATAR_SAFETY_READINESS_REPORT');
