#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.9
import process from 'node:process';

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function safe(value) {
  return String(value || '')
    .replace(/(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/\S+/gi, '[redacted endpoint]')
    .replace(/\b(?:gh[pousr]_|sk-|AKIA)[A-Za-z0-9_-]{8,}\b/g, '[redacted credential]')
    .replace(/-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/g, '[redacted private key]');
}

const ruleId = safe(argValue('--rule-id', 'RULE_ID_HERE'));
const profile = safe(argValue('--profile', 'generic'));
const reason = safe(argValue('--reason', 'why this finding is a false positive'));
const context = safe(argValue('--context', 'safe context only; no raw diff or logs'));
const rootCauseId = safe(argValue('--root-cause-id', 'ROOT_CAUSE_ID_HERE'));
const priority = safe(argValue('--priority', 'P2'));
const owner = safe(argValue('--owner', 'required-owner'));
const expiresAt = safe(argValue('--expires-at', 'YYYY-MM-DD'));
const highPriority = priority === 'P0' || priority === 'P1';

const output = [
  '== Codex code audit false positive template ==',
  `ruleId: ${ruleId}`,
  `rootCauseId: ${rootCauseId}`,
  `profile: ${profile}`,
  `priority: ${priority}`,
  `whyFalsePositive: ${reason}`,
  `safe context: ${context}`,
  `ownerRequired: ${owner}`,
  `expiresAtRequired: ${expiresAt}`,
  'reasonRequired: use a specific safe explanation with no raw diff or logs',
  'humanApprovalRequired: yes',
  'matchScope required: keep it narrow to one path, rule, or profile',
  highPriority ? 'baseline recommendation: do not baseline P0/P1 high-confidence findings without human approval' : 'baseline recommendation: scoped baseline may be considered after human review',
  'recommendedBaselineEntry: include ruleId, rootCauseId, profile, owner, expiresAt, reason, and narrow matchScope',
  'suggested baseline or rule adjustment: add a narrow CODEX_CODE_AUDIT_BASELINE entry or tighten profile policy matching',
  'expiry suggestion: set expiresAt within 30-90 days and re-review before expiry',
  'do not include: raw diff, raw logs, secrets, endpoints, tokens, DB connection strings, or payloads',
  '',
].join('\n');

process.stdout.write(output);
