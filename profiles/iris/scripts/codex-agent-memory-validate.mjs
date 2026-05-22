#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.9
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

const HARNESS_VERSION = '0.6.9';
const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;
const policyPath = path.join('docs', 'process', 'CODEX_AGENT_MEMORY_POLICY.json');
const requiredForbiddenContent = [
  'rawDiff',
  'rawLogs',
  'secretValue',
  'endpointValue',
  'privatePath',
  'payload',
  'productionData',
  'personalData',
];
const violations = [];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function addViolation(id, message) {
  violations.push({ id, message });
}

function unsafeText(value) {
  const text = String(value ?? '');
  return [
    /(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/\S+/i,
    /\b(?:gh[pousr]_|sk-|AKIA)[A-Za-z0-9_-]{8,}\b/,
    /-----BEGIN [^-]+PRIVATE KEY-----/i,
  ].some((pattern) => pattern.test(text));
}

function containsUnsafeValue(value) {
  if (typeof value === 'string') return unsafeText(value);
  if (Array.isArray(value)) return value.some(containsUnsafeValue);
  if (value && typeof value === 'object') return Object.values(value).some(containsUnsafeValue);
  return false;
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    addViolation('policy.invalid', 'agent memory policy must be a JSON object');
    return;
  }
  if (policy.marker !== marker) addViolation('policy.marker', 'marker must match harness version');
  const allowedFields = new Set([
    'marker',
    'schemaVersion',
    'profile',
    'memoryMode',
    'forbidden',
    'forbiddenContent',
    'maxSummaryChars',
    'maxUserContextChars',
    'profileBounded',
    'crossProfileSharing',
    'autoApply',
    'humanApprovalRequired',
    'safeOutput',
    'allowedUnknownFields',
  ]);
  const allowedUnknown = new Set(Array.isArray(policy.allowedUnknownFields) ? policy.allowedUnknownFields : []);
  for (const key of Object.keys(policy)) {
    if (!allowedFields.has(key) && !allowedUnknown.has(key)) addViolation(`policy.unknownField.${key}`, `${key} is not an allowed field`);
  }
  if (policy.schemaVersion !== '1.0.0') addViolation('policy.schemaVersion', 'schemaVersion must be 1.0.0');
  if (policy.memoryMode !== 'safe-summary-only') addViolation('policy.memoryMode', 'memoryMode must be safe-summary-only');
  if (!Array.isArray(policy.forbidden)) addViolation('policy.forbidden', 'forbidden must be an array');
  if (!Array.isArray(policy.forbiddenContent)) addViolation('policy.forbiddenContent', 'forbiddenContent must be an array');
  for (const item of requiredForbiddenContent) {
    if (!policy.forbidden?.includes(item)) addViolation(`policy.forbidden.${item}`, `${item} must be forbidden`);
    if (!policy.forbiddenContent?.includes(item)) addViolation(`policy.forbiddenContent.${item}`, `${item} must be forbidden`);
  }
  if (typeof policy.maxSummaryChars !== 'number' || policy.maxSummaryChars > 2200) addViolation('policy.maxSummaryChars', 'maxSummaryChars must be a number at or below 2200');
  if (typeof policy.maxUserContextChars !== 'number' || policy.maxUserContextChars > 1375) addViolation('policy.maxUserContextChars', 'maxUserContextChars must be a number at or below 1375');
  if (policy.profileBounded !== true) addViolation('policy.profileBounded', 'profileBounded must be true');
  if (policy.crossProfileSharing !== false) addViolation('policy.crossProfileSharing', 'crossProfileSharing must be false');
  if (policy.autoApply !== false) addViolation('policy.autoApply', 'autoApply must be false');
  if (policy.humanApprovalRequired !== true) addViolation('policy.humanApprovalRequired', 'humanApprovalRequired must be true');
  if (policy.safeOutput?.summaryOnly !== true) addViolation('policy.safeOutput.summaryOnly', 'safeOutput.summaryOnly must be true');
  if (policy.safeOutput?.rawStorageAllowed !== false) addViolation('policy.safeOutput.rawStorageAllowed', 'raw storage must be disabled');
  if (containsUnsafeValue(policy)) addViolation('policy.unsafeValue', 'policy contains unsafe raw value pattern');
}

let policy = {};
try {
  policy = readJson(policyPath);
  validatePolicy(policy);
} catch (error) {
  addViolation('policy.read', `policy could not be read or parsed: ${error.message}`);
}

const status = violations.length ? 'fail' : 'pass';
console.log(JSON.stringify({
  marker,
  harnessVersion: HARNESS_VERSION,
  status,
  policy: 'agentMemoryPolicy',
  profile: typeof policy.profile === 'string' ? policy.profile : 'unknown',
  safeSummaryOnly: true,
  autoApply: false,
  humanApprovalRequired: policy.humanApprovalRequired === true,
  memoryMode: policy.memoryMode || 'unknown',
  maxSummaryChars: policy.maxSummaryChars ?? null,
  maxUserContextChars: policy.maxUserContextChars ?? null,
  forbiddenContentCount: Array.isArray(policy.forbiddenContent) ? policy.forbiddenContent.length : 0,
  violations,
}, null, 2));

process.exit(status === 'pass' ? 0 : 1);
