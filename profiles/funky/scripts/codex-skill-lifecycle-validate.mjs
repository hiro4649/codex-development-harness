#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.0
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

const HARNESS_VERSION = '0.7.0';
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
function sectionContent(text, element) {
  const pattern = new RegExp(`^#{2,3}\\s+${element}\\s*$`, 'im');
  const match = pattern.exec(text);
  if (!match) return '';
  const rest = text.slice(match.index + match[0].length);
  const next = /\n#{2,3}\s+\S/.exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}
function gitShow(file) {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const rel = path.relative(root, path.resolve(file)).replace(/\\/g, '/');
    return execFileSync('git', ['show', `origin/main:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}
function safetyTerms(text) {
  const lower = text.toLowerCase();
  return ['secret', 'raw', 'payload', 'endpoint', 'private path'].filter((term) => lower.includes(term));
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    addViolation('policy.invalid', 'skill lifecycle policy must be a JSON object');
    return [];
  }
  if (policy.marker !== marker) addViolation('policy.marker', 'marker must match harness version');
  const allowedFields = new Set([
    'marker',
    'schemaVersion',
    'profile',
    'skillFiles',
    'requiredElements',
    'agentGeneratedSkill',
    'staleAfterDays',
    'archiveAfterDays',
    'deleteAutomatically',
    'archiveAutomatically',
    'pinSupported',
    'humanApprovalRequired',
    'forbidden',
    'allowedUnknownFields',
  ]);
  const allowedUnknown = new Set(Array.isArray(policy.allowedUnknownFields) ? policy.allowedUnknownFields : []);
  for (const key of Object.keys(policy)) {
    if (!allowedFields.has(key) && !allowedUnknown.has(key)) addViolation(`policy.unknownField.${key}`, `${key} is not an allowed field`);
  }
  if (policy.schemaVersion !== '1.0.0') addViolation('policy.schemaVersion', 'schemaVersion must be 1.0.0');
  if (policy.skillFiles?.allowedGlob !== 'docs/process/skills/*.md') addViolation('policy.skillFiles.allowedGlob', 'skill files must be limited to docs/process/skills/*.md');
  if (!Array.isArray(policy.forbidden)) addViolation('policy.forbidden', 'forbidden must be an array');
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
  const procedure = sectionContent(text, 'procedure');
  const verification = sectionContent(text, 'verification');
  const safeOutput = sectionContent(text, 'safeOutput');
  if (!procedure) addViolation('skill.procedure.empty', `${path.basename(file)} has empty procedure`);
  if (!verification) addWarning('skill.verification.empty', `${path.basename(file)} has empty verification`);
  const missingSafeTerms = ['secret', 'raw', 'payload', 'endpoint', 'private path'].filter((term) => !safeOutput.toLowerCase().includes(term));
  if (missingSafeTerms.length) addViolation('skill.safeOutput.incomplete', `${path.basename(file)} safeOutput must prohibit secret/raw/payload/endpoint/private path output`);
  const previous = gitShow(file);
  const previousTerms = safetyTerms(previous);
  const currentTerms = safetyTerms(text);
  const removedSafetyTerms = previousTerms.filter((term) => !currentTerms.includes(term));
  if (removedSafetyTerms.length) addWarning('skill.semanticDrift.reviewRequired', `${path.basename(file)} may have removed safety terms`);
  skillSummaries.push({
    fileName: path.basename(file),
    status: missing.length || !procedure || missingSafeTerms.length ? 'fail' : 'pass',
    missingElements: missing,
    procedurePresent: Boolean(procedure),
    verificationPresent: Boolean(verification),
    safeOutputTermsPresent: missingSafeTerms.length === 0,
    removedSafetyTermCount: removedSafetyTerms.length,
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
