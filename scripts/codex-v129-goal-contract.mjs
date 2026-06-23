#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.9

import crypto from 'node:crypto';
import fs from 'node:fs';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';

export const V129_TASK_CLASSES = Object.freeze([
  'routine_metadata',
  'repository_discovery',
  'code_change',
  'bug_repair',
  'architecture',
  'migration',
  'security_scan',
  'security_remediation',
  'runtime_sensitive',
  'restricted_asset',
  'authority_change',
  'target_rollout',
  'research',
]);

export const V129_DIFFICULTIES = Object.freeze(['low', 'medium', 'high', 'critical']);

export const V129_GOAL_CONTRACT_FIELDS = Object.freeze([
  'goalId',
  'goalVersion',
  'taskClass',
  'truthOwnerRefs',
  'desiredEndState',
  'acceptanceCriteria',
  'constraints',
  'nonGoals',
  'allowedFiles',
  'forbiddenFiles',
  'evidencePlan',
  'killCriteria',
  'repairBudget',
  'binding',
  'goalDigest',
]);

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function sha256Canonical(value) {
  return `sha256:${sha256(canonicalJson(value))}`;
}

export function parseJsonRejectDuplicateKeys(text) {
  const stack = [];
  let index = 0;
  function top() { return stack[stack.length - 1]; }
  function completeValue() {
    const frame = top();
    if (!frame) return;
    if (frame.type === 'object' && frame.state === 'value') frame.state = 'comma_or_end';
    else if (frame.type === 'array' && frame.state === 'value_or_end') frame.state = 'comma_or_end';
  }
  function readString() {
    let result = '';
    index += 1;
    while (index < text.length) {
      const ch = text[index];
      if (ch === '\\') {
        result += ch + (text[index + 1] || '');
        index += 2;
        continue;
      }
      if (ch === '"') {
        index += 1;
        return JSON.parse(`"${result}"`);
      }
      result += ch;
      index += 1;
    }
    throw new Error('unterminated_string');
  }
  function skipPrimitive() {
    while (index < text.length && !/[\s,\]\}]/.test(text[index])) index += 1;
    completeValue();
  }
  while (index < text.length) {
    const ch = text[index];
    if (/\s/.test(ch)) {
      index += 1;
      continue;
    }
    const frame = top();
    if (ch === '{') {
      stack.push({ type: 'object', keys: new Set(), state: 'key_or_end' });
      index += 1;
      continue;
    }
    if (ch === '[') {
      stack.push({ type: 'array', state: 'value_or_end' });
      index += 1;
      continue;
    }
    if (ch === '}') {
      if (!frame || frame.type !== 'object' || !['key_or_end', 'comma_or_end'].includes(frame.state)) throw new Error('object_state_invalid');
      stack.pop();
      index += 1;
      completeValue();
      continue;
    }
    if (ch === ']') {
      if (!frame || frame.type !== 'array' || !['value_or_end', 'comma_or_end'].includes(frame.state)) throw new Error('array_state_invalid');
      stack.pop();
      index += 1;
      completeValue();
      continue;
    }
    if (ch === ',') {
      if (!frame || frame.state !== 'comma_or_end') throw new Error('comma_state_invalid');
      frame.state = frame.type === 'object' ? 'key_or_end' : 'value_or_end';
      index += 1;
      continue;
    }
    if (ch === ':') {
      if (!frame || frame.type !== 'object' || frame.state !== 'colon') throw new Error('colon_state_invalid');
      frame.state = 'value';
      index += 1;
      continue;
    }
    if (ch === '"') {
      const value = readString();
      const current = top();
      if (current?.type === 'object' && current.state === 'key_or_end') {
        if (current.keys.has(value)) throw new Error(`duplicate_key:${value}`);
        current.keys.add(value);
        current.state = 'colon';
      } else {
        completeValue();
      }
      continue;
    }
    skipPrimitive();
  }
  if (stack.length) throw new Error('json_stack_unclosed');
  return JSON.parse(text);
}

export function goalDigestPayload(goal = {}) {
  const { goalDigest, candidateHeadSha, ...payload } = goal || {};
  return payload;
}

export function computeGoalDigest(goal = {}) {
  return sha256Canonical(goalDigestPayload(goal));
}

function arrayStrings(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function hasDuplicates(values) {
  return new Set(values).size !== values.length;
}

function isSha256Digest(value) {
  return /^sha256:[a-f0-9]{64}$/.test(String(value || ''));
}

function isFullSha(value) {
  return /^[a-f0-9]{40}$/.test(String(value || ''));
}

export function validateGoalContract(goal = {}) {
  const reasonCodes = [];
  const keys = Object.keys(goal);
  const allowed = new Set(V129_GOAL_CONTRACT_FIELDS);
  for (const key of V129_GOAL_CONTRACT_FIELDS) {
    if (!(key in goal)) reasonCodes.push(`missing_${key}`);
  }
  for (const key of keys) {
    if (!allowed.has(key)) reasonCodes.push(`unknown_field_${key}`);
  }
  if (!Number.isInteger(goal.goalVersion) || goal.goalVersion < 1) reasonCodes.push('goal_version_invalid');
  if (!V129_TASK_CLASSES.includes(goal.taskClass)) reasonCodes.push('task_class_invalid');
  const truthOwnerRefs = Array.isArray(goal.truthOwnerRefs) ? goal.truthOwnerRefs : [];
  if (!truthOwnerRefs.length) reasonCodes.push('truth_owner_refs_missing');
  for (const ref of truthOwnerRefs) {
    if (!ref || typeof ref.path !== 'string' || !ref.path) reasonCodes.push('truth_owner_path_missing');
    if (!isSha256Digest(ref?.digest)) reasonCodes.push('truth_owner_digest_missing');
  }
  const criteria = Array.isArray(goal.acceptanceCriteria) ? goal.acceptanceCriteria : [];
  if (!criteria.length) reasonCodes.push('acceptance_criteria_missing');
  const criteriaIds = criteria.map((item) => item?.id).filter(Boolean);
  if (hasDuplicates(criteriaIds)) reasonCodes.push('acceptance_criterion_id_duplicate');
  for (const criterion of criteria) {
    if (!criterion?.id || !criterion?.description || typeof criterion.required !== 'boolean') {
      reasonCodes.push('acceptance_criterion_invalid');
    }
  }
  if (!arrayStrings(goal.constraints)) reasonCodes.push('constraints_invalid');
  if (!arrayStrings(goal.nonGoals)) reasonCodes.push('non_goals_invalid');
  if (!arrayStrings(goal.allowedFiles)) reasonCodes.push('allowed_files_invalid');
  if (!arrayStrings(goal.forbiddenFiles)) reasonCodes.push('forbidden_files_invalid');
  if (!arrayStrings(goal.evidencePlan)) reasonCodes.push('evidence_plan_invalid');
  if (!arrayStrings(goal.killCriteria)) reasonCodes.push('kill_criteria_invalid');
  const allowedFiles = new Set(goal.allowedFiles || []);
  for (const file of goal.forbiddenFiles || []) {
    if (allowedFiles.has(file)) reasonCodes.push('allowed_forbidden_overlap');
  }
  if (!goal.repairBudget || !Number.isInteger(goal.repairBudget.maxRepairIterations) || goal.repairBudget.maxRepairIterations > 1) {
    reasonCodes.push('repair_budget_iterations_invalid');
  }
  if (!goal.repairBudget || !Number.isInteger(goal.repairBudget.sameBlockerMax) || goal.repairBudget.sameBlockerMax > 1) {
    reasonCodes.push('repair_budget_same_blocker_invalid');
  }
  if (!goal.binding || typeof goal.binding !== 'object') reasonCodes.push('binding_missing');
  if (!goal.binding?.repositoryId) reasonCodes.push('binding_repository_id_missing');
  if (!isFullSha(goal.binding?.baseSha)) reasonCodes.push('binding_base_sha_invalid');
  if (!isSha256Digest(goal.binding?.scopeDigest)) reasonCodes.push('binding_scope_digest_invalid');
  const expectedDigest = computeGoalDigest(goal);
  if (!isSha256Digest(goal.goalDigest)) reasonCodes.push('goal_digest_invalid');
  else if (goal.goalDigest !== expectedDigest) reasonCodes.push('goal_digest_mismatch');
  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    goalDigest: goal.goalDigest || null,
    expectedGoalDigest: expectedDigest,
    safeSummaryOnly: true,
  };
}

export function compileGoalContract(input) {
  const goal = typeof input === 'string' ? parseJsonRejectDuplicateKeys(input) : input;
  const validation = validateGoalContract(goal);
  return {
    schemaVersion: '1.2.9',
    candidateHarnessVersion: '1.2.9',
    candidateActivationState: 'source_shadow_candidate',
    sourceActivation: 'forbidden',
    targetRollout: 'forbidden',
    goalContractStatus: validation,
    goalDigest: validation.goalDigest,
    finalAuthority: 'v1.1.8_final_decision_kernel',
    safeSummaryOnly: true,
    status: validation.status,
  };
}

export function readGoalContractFile(file) {
  return fs.readFileSync(file, 'utf8');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let report;
  try {
    const file = process.argv[2];
    const text = file ? readGoalContractFile(file) : fs.readFileSync(0, 'utf8');
    report = compileGoalContract(text);
  } catch (error) {
    report = {
      schemaVersion: '1.2.9',
      candidateHarnessVersion: '1.2.9',
      goalContractStatus: { status: 'fail', reasonCodes: [String(error.message || error)], safeSummaryOnly: true },
      status: 'fail',
      safeSummaryOnly: true,
    };
  }
  writeJsonReport(report);
  exitFor(report.status);
}
