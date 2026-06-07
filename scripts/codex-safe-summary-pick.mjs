#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.2

import fs from 'node:fs';
import { pickSafeSummary } from './codex-v112-conversation-surface.mjs';

const filePath = process.argv[2] || '';
const report = filePath && fs.existsSync(filePath)
  ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
  : {};
console.log(JSON.stringify(pickSafeSummary(report, { safeArtifactPath: filePath }), null, 2));
