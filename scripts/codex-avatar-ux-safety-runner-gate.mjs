#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildAvatarUxSafetyRunnerReport, runV098GateCli } from './codex-v098-gate-lib.mjs';

export { buildAvatarUxSafetyRunnerReport };

runV098GateCli(import.meta.url, process.argv[1], buildAvatarUxSafetyRunnerReport, 'CODEX_AVATAR_UX_SAFETY_RUNNER_REPORT', {});
