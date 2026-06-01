#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildAvatarUxSafetyReport, runV097GateCli } from './codex-v097-gate-lib.mjs';

export { buildAvatarUxSafetyReport };

runV097GateCli(import.meta.url, process.argv[1], buildAvatarUxSafetyReport, 'CODEX_AVATAR_UX_SAFETY_REPORT');
