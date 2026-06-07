#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.2

import fs from 'node:fs';
import { pickSafeSummary } from './codex-v112-conversation-surface.mjs';

const report = process.argv[2] && fs.existsSync(process.argv[2])
  ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  : {};
const summary = pickSafeSummary(report, { safeArtifactPath: process.argv[2] || '' });
console.log(JSON.stringify({
  state: summary.status,
  qualityScore: summary.qualityScore,
  blocker: summary.topBlockingReasonCodes[0] || 'none',
  safeNextAction: summary.requiredCheckStatus === 'pass' ? 'continue' : 'inspect_safe_artifact',
  safeSummaryOnly: true,
}, null, 2));
