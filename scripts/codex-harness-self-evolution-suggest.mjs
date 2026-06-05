#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import fs from 'node:fs';
import path from 'node:path';

const HARNESS_VERSION = '1.0.1';
const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;
const policyFiles = [
  'CODEX_SOURCE_HARNESS_MANIFEST.json',
  'profiles/funky/docs/process/CODEX_HARNESS_SELF_EVOLUTION_POLICY.json',
  'profiles/iris/docs/process/CODEX_HARNESS_SELF_EVOLUTION_POLICY.json',
  'profiles/iris-live2d-renderer/docs/process/CODEX_HARNESS_SELF_EVOLUTION_POLICY.json',
];
const sourceSignals = [
  'audit feedback',
  'quality report',
  'effectiveness tracker',
  'learning recommendation',
  'decision retrospective',
];
const missingPolicies = policyFiles.filter((file) => !fs.existsSync(file)).map((file) => path.basename(file));

console.log(JSON.stringify({
  marker,
  harnessVersion: HARNESS_VERSION,
  status: missingPolicies.length ? 'warning' : 'suggestion_only',
  sourceRepoMode: true,
  safeSummaryOnly: true,
  autoApply: false,
  autoCommit: false,
  autoPush: false,
  changedFiles: [],
  sourceSignals,
  candidatePatch: {
    generated: false,
    mayGenerate: true,
    directApply: false,
    reason: 'suggestion script does not generate or apply patches; human approval is required for a separate PR'
  },
  recommendations: [
    {
      id: 'selfEvolution.reviewSourceHarnessSignals',
      action: 'review safe source harness summaries before proposing a follow-up harness PR',
      requiresHumanApproval: true
    }
  ],
  missingPolicyCount: missingPolicies.length,
}, null, 2));
