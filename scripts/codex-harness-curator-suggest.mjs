#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import fs from 'node:fs';
import path from 'node:path';

const HARNESS_VERSION = '1.0.1';
const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;
const profiles = ['funky', 'iris', 'iris-live2d-renderer'];
const recommendations = [];
const checkedProfiles = [];

for (const profile of profiles) {
  const skillDir = path.join('profiles', profile, 'docs', 'process', 'skills');
  const files = fs.existsSync(skillDir)
    ? fs.readdirSync(skillDir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.md')).map((entry) => entry.name).sort()
    : [];
  checkedProfiles.push({ profile, skillCount: files.length, skillFiles: files });
  if (!files.length) {
    recommendations.push({
      id: 'curator.profileSkillMissing',
      profile,
      action: 'human_review_profile_skill_coverage',
      humanApprovalRequired: true,
    });
  }
}

if (!recommendations.length) {
  recommendations.push({
    id: 'curator.sourceRepoPeriodicReview',
    action: 'review profile-bounded skills before staleAfterDays',
    staleAfterDays: 30,
    archiveAfterDays: 90,
    humanApprovalRequired: true,
  });
}

console.log(JSON.stringify({
  marker,
  harnessVersion: HARNESS_VERSION,
  status: 'suggestion_only',
  sourceRepoMode: true,
  safeSummaryOnly: true,
  autoApply: false,
  autoCommit: false,
  autoPush: false,
  changedFiles: [],
  checkedProfiles,
  recommendations,
}, null, 2));
