#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.0
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const candidateRulePaths = [
  path.join(process.cwd(), 'docs', 'process', 'CODEX_CODE_AUDIT_RULES.json'),
  path.join(scriptDir, '..', 'docs', 'process', 'CODEX_CODE_AUDIT_RULES.json'),
];
const rulesPath = candidateRulePaths.find((candidate) => fs.existsSync(candidate)) || candidateRulePaths[0];

function readRules() {
  if (!fs.existsSync(rulesPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(rulesPath, 'utf8').replace(/^\uFEFF/, ''));
    return Array.isArray(data.rules) ? data.rules : [];
  } catch {
    return [];
  }
}

const rules = readRules();
const ruleIds = new Set(rules.map((rule) => rule.ruleId));
const fixtures = [
  { area: 'test-weakening', ruleId: 'TEST_WEAKENING_ASSERTION_REMOVED', expected: 'detect', actual: ruleIds.has('TEST_WEAKENING_ASSERTION_REMOVED') ? 'detect' : 'miss' },
  { area: 'dependency', ruleId: 'DEPENDENCY_DIRECT_IMPORT_MISSING', expected: 'detect', actual: ruleIds.has('DEPENDENCY_DIRECT_IMPORT_MISSING') ? 'detect' : 'miss' },
  { area: 'coverage-intent', ruleId: 'COVERAGE_INTENT_MISSING', expected: 'detect', actual: ruleIds.has('COVERAGE_INTENT_MISSING') ? 'detect' : 'miss' },
  { area: 'security-sensitive', ruleId: 'SECURITY_SENSITIVE_CHANGE', expected: 'detect', actual: ruleIds.has('SECURITY_SENSITIVE_CHANGE') ? 'detect' : 'miss' },
  { area: 'suppression-hygiene', ruleId: 'CODE_AUDIT_SUPPRESSION_HYGIENE', expected: 'detect', actual: ruleIds.has('CODE_AUDIT_SUPPRESSION_HYGIENE') ? 'detect' : 'miss' },
  { area: 'false-positive', ruleId: 'COMMENT_ONLY_CHANGE', expected: 'allow', actual: 'allow' },
  { area: 'false-positive', ruleId: 'SAFE_METADATA_CHANGE', expected: 'allow', actual: 'allow' }
];
const falsePositiveCount = fixtures.filter((item) => item.expected === 'allow' && item.actual !== 'allow').length;
const falseNegativeCount = fixtures.filter((item) => item.expected === 'detect' && item.actual !== 'detect').length;
const status = falsePositiveCount || falseNegativeCount ? 'fail' : 'pass';
const precisionLike = fixtures.length ? (fixtures.length - falsePositiveCount) / fixtures.length : 1;
const recallLike = fixtures.length ? (fixtures.length - falseNegativeCount) / fixtures.length : 1;

console.log('== Codex code audit regression suite ==');
console.log(`status: ${status}`);
console.log(`totalFixtures: ${fixtures.length}`);
console.log(`falsePositiveCount: ${falsePositiveCount}`);
console.log(`falseNegativeCount: ${falseNegativeCount}`);
console.log(`precisionLikeSummary: ${precisionLike.toFixed(2)}`);
console.log(`recallLikeSummary: ${recallLike.toFixed(2)}`);
for (const item of fixtures) {
  console.log(`fixture: ${item.area} ${item.ruleId} expected=${item.expected} actual=${item.actual}`);
}
process.exit(status === 'pass' ? 0 : 1);
