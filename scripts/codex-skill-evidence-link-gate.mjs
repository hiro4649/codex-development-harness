#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { buildSkillEvidenceLinkReport, runV095GateCli } from './codex-v095-gate-lib.mjs';

export { buildSkillEvidenceLinkReport };

runV095GateCli(import.meta.url, process.argv[1], buildSkillEvidenceLinkReport, 'CODEX_SKILL_EVIDENCE_LINK_REPORT');
