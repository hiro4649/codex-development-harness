#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.8
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const candidateRulePaths = [
  path.join(process.cwd(), 'docs', 'process', 'CODEX_CODE_AUDIT_RULES.json'),
  path.join(scriptDir, '..', 'docs', 'process', 'CODEX_CODE_AUDIT_RULES.json'),
];

function readRules() {
  const file = candidateRulePaths.find((candidate) => fs.existsSync(candidate));
  if (!file) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    return Array.isArray(data.rules) ? data.rules : [];
  } catch {
    return [];
  }
}

const rules = readRules();

console.log('== Codex code audit rules ==');
for (const rule of rules) {
  console.log(`ruleId: ${rule.ruleId}`);
  console.log(`shortDescription: ${rule.safeDescription}`);
  console.log(`defaultSeverity: ${rule.defaultSeverity}`);
  console.log(`defaultConfidence: ${rule.defaultConfidence}`);
  console.log(`defaultPriority: ${rule.defaultPriority}`);
  console.log(`recommendedFixType: ${rule.recommendedFixType}`);
  console.log(`humanReviewTrigger: ${rule.humanReviewTrigger === true}`);
  console.log('falsePositiveGuidance: use a narrow expiring baseline only after human review');
  console.log('testFixtureCoverage: covered by synthetic audit regression fixtures where applicable');
  console.log('example: safe summary only; no raw diff or logs');
  console.log('');
}
