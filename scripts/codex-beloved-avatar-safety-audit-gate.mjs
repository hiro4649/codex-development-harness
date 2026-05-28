#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.6
import { buildBelovedAvatarSafetyAuditReport, runV096GateCli } from './codex-v096-gate-lib.mjs';

export { buildBelovedAvatarSafetyAuditReport };

runV096GateCli(import.meta.url, process.argv[1], buildBelovedAvatarSafetyAuditReport, 'CODEX_BELOVED_AVATAR_SAFETY_AUDIT_REPORT');