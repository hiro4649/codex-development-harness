#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.0
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

const HARNESS_VERSION = '0.7.0';
const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;
const policyPath = path.join('docs', 'process', 'CODEX_HARNESS_SELF_EVOLUTION_POLICY.json');
const allowedSignals = [
  'audit feedback',
  'quality report',
  'effectiveness tracker',
  'learning recommendation',
  'decision retrospective',
];
const violations = [];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function addViolation(id, message) {
  violations.push({ id, message });
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    addViolation('policy.invalid', 'self evolution policy must be a JSON object');
    return;
  }
  if (policy.marker !== marker) addViolation('policy.marker', 'marker must match harness version');
  const allowedFields = new Set([
    'marker',
    'schemaVersion',
    'profile',
    'sourceSignals',
    'forbidden',
    'forbiddenSourceSignals',
    'candidatePatch',
    'autoApply',
    'autoCommit',
    'autoPush',
    'requiresAllChecksPass',
    'requiresHumanApproval',
    'maxSkillSizeKB',
    'mustPreserveSemanticPurpose',
    'allowedUnknownFields',
  ]);
  const allowedUnknown = new Set(Array.isArray(policy.allowedUnknownFields) ? policy.allowedUnknownFields : []);
  for (const key of Object.keys(policy)) {
    if (!allowedFields.has(key) && !allowedUnknown.has(key)) addViolation(`policy.unknownField.${key}`, `${key} is not an allowed field`);
  }
  if (policy.schemaVersion !== '1.0.0') addViolation('policy.schemaVersion', 'schemaVersion must be 1.0.0');
  if (!Array.isArray(policy.forbidden)) addViolation('policy.forbidden', 'forbidden must be an array');
  if (!Array.isArray(policy.sourceSignals)) addViolation('policy.sourceSignals', 'sourceSignals must be an array');
  for (const signal of policy.sourceSignals || []) {
    if (!allowedSignals.includes(signal)) addViolation('policy.sourceSignals.disallowed', 'sourceSignals must be limited to approved safe summaries');
  }
  for (const signal of allowedSignals) {
    if (!policy.sourceSignals?.includes(signal)) addViolation(`policy.sourceSignals.${signal}`, `${signal} must be listed`);
  }
  if (!policy.forbiddenSourceSignals?.includes('raw execution logs')) addViolation('policy.forbiddenSourceSignals.rawExecutionLogs', 'raw execution logs must be forbidden');
  if (policy.candidatePatch?.mayGenerate !== true) addViolation('policy.candidatePatch.mayGenerate', 'candidate patch generation must be explicitly allowed');
  if (policy.candidatePatch?.directApply !== false) addViolation('policy.candidatePatch.directApply', 'candidate patches must not be directly applied');
  if (policy.autoApply !== false) addViolation('policy.autoApply', 'autoApply must be false');
  if (policy.autoCommit !== false) addViolation('policy.autoCommit', 'autoCommit must be false');
  if (policy.autoPush !== false) addViolation('policy.autoPush', 'autoPush must be false');
  if (policy.requiresAllChecksPass !== true) addViolation('policy.requiresAllChecksPass', 'requiresAllChecksPass must be true');
  if (policy.requiresHumanApproval !== true) addViolation('policy.requiresHumanApproval', 'requiresHumanApproval must be true');
  if (typeof policy.maxSkillSizeKB !== 'number' || policy.maxSkillSizeKB > 15) addViolation('policy.maxSkillSizeKB', 'maxSkillSizeKB must be a number at or below 15');
  if (policy.mustPreserveSemanticPurpose !== true) addViolation('policy.mustPreserveSemanticPurpose', 'mustPreserveSemanticPurpose must be true');
}

let policy = {};
try {
  policy = readJson(policyPath);
  validatePolicy(policy);
} catch (error) {
  addViolation('policy.read', `policy could not be read or parsed: ${error.message}`);
}

const status = violations.length ? 'fail' : 'suggestion_only';
console.log(JSON.stringify({
  marker,
  harnessVersion: HARNESS_VERSION,
  status,
  profile: typeof policy.profile === 'string' ? policy.profile : 'unknown',
  safeSummaryOnly: true,
  autoApply: false,
  autoCommit: false,
  autoPush: false,
  changedFiles: [],
  sourceSignals: Array.isArray(policy.sourceSignals) ? policy.sourceSignals : [],
  candidatePatch: {
    generated: false,
    mayGenerate: policy.candidatePatch?.mayGenerate === true,
    directApply: false,
    reason: 'suggestion script does not generate or apply patches; human approval is required for a separate PR',
  },
  recommendations: [
    {
      id: 'selfEvolution.reviewSafeSignals',
      action: 'review safe summary signals before proposing a separate human-approved harness PR',
      requiresHumanApproval: true,
    },
  ],
  violations,
}, null, 2));

process.exit(status === 'fail' ? 1 : 0);
