#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.9
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : (process.argv[index + 1] || '');
}
function unsafeText(value) {
  const text = JSON.stringify(value || '');
  return [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
    /\bsk-[A-Za-z0-9]{20,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/[^\s"']+/i,
  ].some((pattern) => pattern.test(text));
}

const entry = {
  findingFingerprint: argValue('--fingerprint') || 'safe-fingerprint-required',
  ruleId: argValue('--rule-id') || 'RULE_ID_REQUIRED',
  profile: argValue('--profile') || 'generic',
  overrideType: argValue('--type') || 'manual_acceptance',
  reason: argValue('--reason') || 'Short safe reason required before use.',
  reviewerRole: argValue('--role') || 'project-owner',
  expiresAt: argValue('--expires-at') || '2099-12-31',
  conditions: argValue('--conditions') || 'Applies only to the exact safe finding fingerprint.',
  postMergeCheckRequired: true,
  autoApply: false,
  overrideRecommended: false,
  notRecommendedFor: ['P0/P1 high-confidence findings', 'high-confidence credential findings'],
};

console.log('== Codex human override template ==');
console.log(`ruleId: ${entry.ruleId}`);
console.log(`profile: ${entry.profile}`);
console.log(`overrideType: ${entry.overrideType}`);
console.log(`reviewerRole: ${entry.reviewerRole}`);
console.log(`expiresAt: ${entry.expiresAt}`);
console.log('autoApply: false');
console.log('overrideRecommended: false');
console.log('postMergeCheckRequired: true');
console.log('notRecommendedFor: P0/P1 high-confidence findings; high-confidence credential findings');
if (process.env.CODEX_HUMAN_OVERRIDE_JSON === '1') console.log(JSON.stringify(entry, null, 2));
const target = process.env.CODEX_HUMAN_OVERRIDE_PATH || '';
if (target && process.env.CODEX_WRITE_HUMAN_OVERRIDE === '1') {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
}
process.exit(unsafeText(entry) ? 1 : 0);
