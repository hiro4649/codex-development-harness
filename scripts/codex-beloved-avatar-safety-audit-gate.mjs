#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildBelovedAvatarSafetyAuditV097Report, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildBelovedAvatarSafetyAuditV097Report };

runV097GateCli(import.meta.url, process.argv[1], buildBelovedAvatarSafetyAuditV097Report, 'CODEX_BELOVED_AVATAR_SAFETY_AUDIT_REPORT');
