#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.0
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

const HARNESS_VERSION = '0.7.0';
const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;
const policyPath = path.join('docs', 'process', 'CODEX_SKILL_LIFECYCLE_POLICY.json');
const skillsDir = path.join('docs', 'process', 'skills');
const requiredElements = ['title', 'purpose', 'whenToUse', 'procedure', 'pitfalls', 'verification', 'safeOutput'];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
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

let policy = {};
const recommendations = [];
try {
  policy = readJson(policyPath);
} catch {
  recommendations.push({
    id: 'policy.missing',
    action: 'add_or_fix_skill_lifecycle_policy',
    humanApprovalRequired: true,
  });
}

const skills = listSkillFiles();
if (!skills.length) {
  recommendations.push({
    id: 'skills.none',
    action: 'propose_profile_bounded_skill',
    humanApprovalRequired: true,
  });
}

for (const file of skills) {
  const text = fs.readFileSync(file, 'utf8');
  const missing = requiredElements.filter((element) => !hasElement(text, element));
  if (missing.length) {
    recommendations.push({
      id: 'skill.shape',
      fileName: path.basename(file),
      action: 'human_review_skill_shape',
      missingElements: missing,
      humanApprovalRequired: true,
    });
  }
}

if (!recommendations.length) {
  recommendations.push({
    id: 'curator.periodicReview',
    action: 'schedule_human_review_before_stale_after_days',
    staleAfterDays: policy.staleAfterDays ?? 30,
    archiveAfterDays: policy.archiveAfterDays ?? 90,
    humanApprovalRequired: true,
  });
}

console.log(JSON.stringify({
  marker,
  harnessVersion: HARNESS_VERSION,
  status: 'suggestion_only',
  profile: typeof policy.profile === 'string' ? policy.profile : 'unknown',
  safeSummaryOnly: true,
  autoApply: false,
  autoCommit: false,
  autoPush: false,
  changedFiles: [],
  skillFilesChecked: skills.map((file) => path.basename(file)),
  recommendations,
}, null, 2));
