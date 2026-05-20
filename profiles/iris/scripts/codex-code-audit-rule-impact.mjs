#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.8
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}
function readJson(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}
function rulesById(data) {
  const map = new Map();
  for (const rule of Array.isArray(data?.rules) ? data.rules : []) {
    if (rule && typeof rule.ruleId === 'string') map.set(rule.ruleId, rule);
  }
  return map;
}
function policyOverrides(data) {
  const policy = data?.codeAuditPolicy || {};
  return {
    severityOverrides: policy.severityOverrides || {},
    confidenceThresholds: policy.confidenceThresholds || {},
    priorityOverrides: policy.priorityOverrides || {},
  };
}
function flatOverrideKeys(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const result = [];
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) result.push(...flatOverrideKeys(child, next));
    else result.push(next);
  }
  return result.sort();
}

const beforeRules = rulesById(readJson(argValue('--before-rules')));
const afterRulesPath = argValue('--after-rules', path.join('docs', 'process', 'CODEX_CODE_AUDIT_RULES.json'));
const afterRules = rulesById(readJson(afterRulesPath));
const beforePolicy = readJson(argValue('--before-policy')) || {};
const afterPolicy = readJson(argValue('--after-policy', path.join('docs', 'process', 'CODEX_QUALITY_GATE_POLICY.json'))) || {};

const addedRules = [...afterRules.keys()].filter((id) => !beforeRules.has(id)).sort();
const removedRules = [...beforeRules.keys()].filter((id) => !afterRules.has(id)).sort();
const changedSeverity = [];
const changedConfidence = [];
const changedPriority = [];
for (const [id, after] of afterRules.entries()) {
  const before = beforeRules.get(id);
  if (!before) continue;
  if (before.defaultSeverity !== after.defaultSeverity) changedSeverity.push({ ruleId: id, oldSeverity: before.defaultSeverity, newSeverity: after.defaultSeverity });
  if (before.defaultConfidence !== after.defaultConfidence) changedConfidence.push({ ruleId: id, oldConfidence: before.defaultConfidence, newConfidence: after.defaultConfidence });
  if (before.defaultPriority !== after.defaultPriority) changedPriority.push({ ruleId: id, oldPriority: before.defaultPriority, newPriority: after.defaultPriority });
}
const beforeOverrides = policyOverrides(beforePolicy);
const afterOverrides = policyOverrides(afterPolicy);
const changedProfileOverrides = [];
for (const key of ['severityOverrides', 'confidenceThresholds', 'priorityOverrides']) {
  const beforeKeys = flatOverrideKeys(beforeOverrides[key]);
  const afterKeys = flatOverrideKeys(afterOverrides[key]);
  const added = afterKeys.filter((item) => !beforeKeys.includes(item));
  const removed = beforeKeys.filter((item) => !afterKeys.includes(item));
  if (added.length || removed.length) changedProfileOverrides.push({ key, added, removed });
}
const requiresHumanReview = Boolean(addedRules.length || removedRules.length || changedSeverity.length || changedConfidence.length || changedPriority.length || changedProfileOverrides.length);

console.log('== Codex code audit rule impact ==');
console.log(`status: ${requiresHumanReview ? 'review' : 'pass'}`);
console.log(`addedRules: ${addedRules.join(', ') || 'none'}`);
console.log(`removedRules: ${removedRules.join(', ') || 'none'}`);
console.log(`changedSeverity: ${changedSeverity.map((item) => item.ruleId).join(', ') || 'none'}`);
console.log(`changedConfidence: ${changedConfidence.map((item) => item.ruleId).join(', ') || 'none'}`);
console.log(`changedPriority: ${changedPriority.map((item) => item.ruleId).join(', ') || 'none'}`);
console.log(`changedProfileOverrides: ${changedProfileOverrides.map((item) => item.key).join(', ') || 'none'}`);
console.log(`potentialImpact: ${requiresHumanReview ? 'audit behavior may change; review synthetic fixture scorecard before rollout' : 'no rule impact detected'}`);
console.log(`requiresHumanReview: ${requiresHumanReview ? 'yes' : 'no'}`);
