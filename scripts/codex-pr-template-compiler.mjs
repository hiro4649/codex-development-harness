#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isPrContext,
  scanObjectForUnsafe,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';

const profileSections = {
  harness_workflow_r3: ['Goal', 'Context', 'Files or scope', 'Task Mode', 'Task Contract', 'Load-bearing evidence', 'Testing', 'Residual risks'],
  target_harness_rollout_r3: ['Goal', 'Context', 'Files or scope', 'Task Mode', 'Evidence Continuity', 'Testing and review', 'Residual risks'],
  bugfix_product: ['Goal', 'Context', 'Task Mode', 'Bugfix Evidence', 'Testing and review', 'Residual risks'],
  feature_product: ['Goal', 'Context', 'Task Mode', 'Acceptance criteria', 'Testing and review', 'Residual risks'],
  release_gate: ['Goal', 'Context', 'Task Mode', 'Production Go/No-Go', 'Rollback or stop condition', 'Testing and review'],
  docs_only: ['Goal', 'Context', 'Files or scope', 'Testing and review'],
};

function profile(env = process.env) {
  return env.CODEX_PR_TEMPLATE_PROFILE || env.CODEX_PR_PROFILE || 'harness_workflow_r3';
}

function sectionSkeleton(name) {
  if (name === 'Task Contract') return '## Task Contract\nGoal:\nDone criteria:\nVerification surface:\nRisk surface:\nAllowed scope:\nForbidden scope:\nStop condition:\n';
  if (name === 'Load-bearing evidence') return '## Load-bearing evidence\nComponent:\nFailure mode caught:\nNot covered by existing gates:\nNegative fixture:\nPositive fixture:\nRuntime cost: low\nDefault mode:\n';
  if (name === 'Evidence Continuity') return '## Evidence Continuity\nBaseline health:\nEvidence path continuity:\nSelf-test case export:\nSurface normalization:\n';
  return `## ${name}\n`;
}

export function compilePrTemplate(env = process.env) {
  const templateProfile = profile(env);
  const sections = profileSections[templateProfile] || profileSections.harness_workflow_r3;
  const missingInputs = [];
  if (!templateProfile) missingInputs.push('templateProfile');
  const body = [
    `PR profile: ${templateProfile}`,
    'Risk level: R3',
    '',
    ...sections.flatMap((section) => [sectionSkeleton(section), '']),
  ].join('\n').trimEnd() + '\n';
  const outPath = env.CODEX_PR_TEMPLATE_OUTPUT_PATH || 'codex-pr-body-skeleton.safe.md';
  const safeOutPath = path.basename(outPath) || 'codex-pr-body-skeleton.safe.md';
  const payload = {
    templateProfile,
    missingInputs,
    compiledSections: sections,
    safeSuggestedBodyPath: safeOutPath,
    autoApply: false,
    autoCommit: false,
    autoPush: false,
    reasonCodes: missingInputs.length ? ['pr_template_compiler_hint_available'] : [],
  };
  if (scanObjectForUnsafe(payload).length || scanObjectForUnsafe(body).length) payload.reasonCodes.push('pr_template_compiler_failed');
  if (!payload.reasonCodes.includes('pr_template_compiler_failed') && env.CODEX_PR_TEMPLATE_WRITE !== '0') {
    fs.writeFileSync(outPath, body);
  }
  const status = payload.reasonCodes.includes('pr_template_compiler_failed') ? 'fail' : (payload.reasonCodes.length ? 'warning' : 'pass');
  return simpleStatus('prTemplateCompilerStatus', status, payload);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = compilePrTemplate();
    writeJsonReport(report, 'CODEX_PR_TEMPLATE_COMPILER_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('prTemplateCompilerStatus', 'fail', {
      templateProfile: 'unknown',
      missingInputs: [],
      compiledSections: [],
      safeSuggestedBodyPath: '',
      reasonCodes: ['pr_template_compiler_failed'],
    });
    writeJsonReport(report, 'CODEX_PR_TEMPLATE_COMPILER_REPORT');
    process.exit(1);
  }
}

export { profileSections };
