#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.9
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function argValue(name) { const index = process.argv.indexOf(name); return index === -1 ? '' : (process.argv[index + 1] || ''); }
function unsafe(value) { return /\b(sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/[^\s"']+/i.test(JSON.stringify(value || '')); }
const template = {
  riskId: argValue('--risk-id') || 'safe-risk-id-required',
  riskSummary: argValue('--summary') || 'Short safe risk summary required.',
  reason: argValue('--reason') || 'Safe reason required before use.',
  scope: argValue('--scope') || 'Narrow scope required.',
  expiresAt: argValue('--expires-at') || '2099-12-31',
  acceptedByRole: argValue('--role') || 'project-owner',
  requiredFollowUp: argValue('--follow-up') || 'Post-merge check required.',
  postMergeCheck: true,
  autoApply: false,
  disallowed: ['permanent acceptance', 'high-priority high-confidence credential acceptance'],
};
console.log('== Codex risk acceptance template ==');
for (const key of ['riskId', 'riskSummary', 'reason', 'scope', 'expiresAt', 'acceptedByRole', 'requiredFollowUp']) console.log(`${key}: ${template[key]}`);
console.log('postMergeCheck: true');
console.log('autoApply: false');
const target = process.env.CODEX_RISK_ACCEPTANCE_PATH || '';
if (target && process.env.CODEX_WRITE_RISK_ACCEPTANCE === '1') {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
}
process.exit(unsafe(template) ? 1 : 0);
