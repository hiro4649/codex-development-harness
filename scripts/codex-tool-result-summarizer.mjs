#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.2

import fs from 'node:fs';

const maxLines = Number(process.env.CODEX_TOOL_SUMMARY_MAX_LINES || 20);
const text = process.argv[2] && fs.existsSync(process.argv[2])
  ? fs.readFileSync(process.argv[2], 'utf8')
  : '';
const lines = text.split(/\r?\n/).filter(Boolean);
console.log(JSON.stringify({
  lineCount: lines.length,
  shownLineCount: Math.min(lines.length, maxLines),
  truncated: lines.length > maxLines,
  safeSummaryOnly: true,
}, null, 2));
