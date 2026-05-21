#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.6.9
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const HARNESS_VERSION = '0.6.9';
const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;
const policyPath = path.join('docs', 'process', 'CODEX_SKILL_LIFECYCLE_POLICY.json');
const skillsDir = path.join('docs', 'process', 'skills');
const defaultRequiredElements = ['title', 'purpose', 'whenToUse', 'procedure', 'pitfalls', 'verification', 'safeOutput'];
const violations = [];
const warnings = [];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function addViolation(id, message) {
  violations.push({ id, message });
}

function addWarning(id, message) {
  warnings.push({ id, message });
}

function listSkillFiles() {
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(skillsDir, entry.name))
    .sort();
}

function hasElement(text, element) {
  const normalized = text.toLowerCase();
  const lower = element.toLowerCase();
  return normalized.includes(`## ${lower}`) || normalized.includes(`### ${lower}`);
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    addViolation('policy.invalid', 'skill lifecycle policy must be a JSON object');
    return [];
  }
  if (policy.marker !== marker) addViolation('policy.marker', 'marker must match harness version');
  if (policy.schemaVersion !== '1.0.0') addViolation('policy.schemaVersion', 'schemaVersion must be 1.0.0');
  if (policy.skillFiles?.allowedGlob !== 'docs/process/skills/*.md') addViolation('policy.skillFiles.allowedGlob', 'skill files must be limited to docs/process/skills/*.md');
  if (!Array.isArray(policy.requiredElements)) addViolation('policy.requiredElements', 'requiredElements must be an array');
  for (const element of defaultRequiredElements) {
    if (!policy.requiredElements?.includes(element)) addViolation(`policy.requiredElements.${element}`, `${element} must be required`);
  }
  if (policy.agentGeneratedSkill?.proposalAllowed !== true) addViolation('policy.agentGeneratedSkill.proposalAllowed', 'agent generated skill proposals must be allowed');
  if (policy.agentGeneratedSkill?.autoAdopt !== false) addViolation('policy.agentGeneratedSkill.autoAdopt', 'agent generated skills must not be auto-adopted');
  if (policy.staleAfterDays !== 30) addViolation('policy.staleAfterDays', 'staleAfterDays must be 30');
  if (policy.archiveAfterDays !== 90) addViolation('policy.archiveAfterDays', 'archiveAfterDays must be 90');
  if (policy.deleteAutomatically !== false) addViolation('policy.deleteAutomatically', 'deleteAutomatically must be false');
  if (policy.archiveAutomatically !== false) addViolation('policy.archiveAutomatically', 'archiveAutomatically must be false');
  if (policy.pinSupported !== true) addViolation('policy.pinSupported', 'pinSupported must be true');
  if (policy.humanApprovalRequired !== true) addViolation('policy.humanApprovalRequired', 'humanApprovalRequired must be true');
  return Array.isArray(policy.requiredElements) ? policy.requiredElements : defaultRequiredElements;
}

let policy = {};
let requiredElements = defaultRequiredElements;
try {
  policy = readJson(policyPath);
  requiredElements = validatePolicy(policy);
} catch (error) {
  addViolation('policy.read', `policy could not be read or parsed: ${error.message}`);
}

const skills = listSkillFiles();
if (!skills.length) addWarning('skills.none', 'no skill files found under docs/process/skills');

const skillSummaries = [];
for (const file of skills) {
  const text = fs.readFileSync(file, 'utf8');
  const missing = requiredElements.filter((element) => !hasElement(text, element));
  if (missing.length) addViolation('skill.requiredElements', `${path.basename(file)} is missing required skill elements`);
  skillSummaries.push({
    fileName: path.basename(file),
    status: missing.length ? 'fail' : 'pass',
    missingElements: missing,
  });
}

const status = violations.length ? 'fail' : (warnings.length ? 'warning' : 'pass');
console.log(JSON.stringify({
  marker,
  harnessVersion: HARNESS_VERSION,
  status,
  policy: 'skillLifecyclePolicy',
  profile: typeof policy.profile === 'string' ? policy.profile : 'unknown',
  safeSummaryOnly: true,
  autoApply: false,
  humanApprovalRequired: policy.humanApprovalRequired === true,
  skillDirectory: 'docs/process/skills',
  checkedSkills: skillSummaries,
  warnings,
  violations,
}, null, 2));

process.exit(status === 'fail' ? 1 : 0);
