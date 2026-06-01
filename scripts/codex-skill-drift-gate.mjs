#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { buildSkillDriftReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildSkillDriftReport };

runV095GateCli(import.meta.url, process.argv[1], buildSkillDriftReport, 'CODEX_SKILL_DRIFT_REPORT');
