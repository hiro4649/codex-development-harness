#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, isPrContext, prBodyText, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { classifyChange, changedFiles } from './codex-change-classification-gate.mjs';

const profiles = {
  docs_only_r1_r2: ['Goal', 'Files or scope', 'Validation', 'Residual risks'],
  harness_only_r2: ['Goal', 'Files or scope', 'Validation', 'Residual risks'],
  harness_workflow_r3: ['Goal', 'Risk level', 'Files or scope', 'Evidence Integrity', 'Validation commands', 'Residual risks', 'Human confirmation needed'],
  product_minor_r2: ['Goal', 'Product verification', 'Tests or checks run', 'Residual risks'],
  product_r3: ['Goal', 'Risk level', 'Product verification', 'Affected entrypoints', 'Failure paths considered', 'Residual risks', 'Human confirmation needed'],
  security_r3: ['Goal', 'Risk level', 'Security impact', 'Validation commands', 'Residual risks', 'Human confirmation needed'],
  release_r3: ['Goal', 'Risk level', 'Readiness claim', 'Validation commands', 'Residual risks', 'Human confirmation needed'],
  readiness_claim_r3: ['Goal', 'Risk level', 'Readiness claim', 'Environment evidence', 'Residual risks', 'Human confirmation needed'],
};

function declaredProfile(body) {
  const match = String(body || '').match(/(?:PR profile|Profile)\s*:\s*([a-z0-9_]+)/i);
  return match ? match[1] : null;
}

function sectionPresent(body, section) {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\n)\\s*(?:#{1,6}\\s*)?${escaped}\\s*:`, 'im').test(body) ||
    new RegExp(`(^|\\n)\\s*(?:#{1,6}\\s*)?${escaped}\\s*$`, 'im').test(body);
}

function harnessManagedChange(files = []) {
  return files.some((raw) => {
    const file = String(raw || '').replace(/\\/g, '/');
    return file === 'AGENTS.md' ||
      file === 'CODEX_SOURCE_HARNESS_MANIFEST.json' ||
      file === '.github/pull_request_template.md' ||
      file.startsWith('.github/workflows/') ||
      file.startsWith('docs/process/') ||
      file.startsWith('docs/codex/') ||
      file.startsWith('scripts/codex-');
  });
}

function inferProfile(env = process.env) {
  const files = changedFiles(env);
  const classified = classifyChange(files, env);
  const c = classified.classification;
  if (c.runtimeReadinessClaimed) return 'readiness_claim_r3';
  if (classified.productRelevantChanged) return env.CODEX_RISK_LEVEL === 'R3' ? 'product_r3' : 'product_minor_r2';
  if (c.workflowChanged || harnessManagedChange(files)) {
    return env.CODEX_RISK_LEVEL === 'R2' ? 'harness_only_r2' : 'harness_workflow_r3';
  }
  if (c.docsOnly) return 'docs_only_r1_r2';
  if (c.harnessOnly && env.CODEX_RISK_LEVEL === 'R2') return 'harness_only_r2';
  return 'harness_workflow_r3';
}

export function buildPrProfileReport(env = process.env) {
  const body = prBodyText(env);
  if (!body.trim() && !isPrContext(env)) {
    return simpleStatus('prProfileStatus', 'not_applicable', { reasonCodes: ['no_pr_context'] });
  }
  const inferredProfile = inferProfile(env);
  const declared = declaredProfile(body);
  const profile = declared || inferredProfile;
  const reasonCodes = [];
  if (!profiles[profile]) reasonCodes.push('pr_profile_invalid');
  if (!declared && isPrContext(env)) reasonCodes.push('pr_profile_missing');
  if (declared && declared !== inferredProfile && isPrContext(env)) reasonCodes.push('pr_profile_conflict');
  const required = profiles[profile] || profiles.harness_workflow_r3;
  const missingSections = required.filter((section) => !sectionPresent(body, section));
  if (missingSections.length) reasonCodes.push('missing_required_method_sections');
  const status = reasonCodes.some((code) => ['pr_profile_invalid', 'missing_required_method_sections'].includes(code)) ? 'fail'
    : reasonCodes.length ? 'warning' : 'pass';
  return simpleStatus('prProfileStatus', status, {
    profile,
    declaredProfile: declared || null,
    inferredProfile,
    missingSections,
    reasonCodes,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildPrProfileReport();
    writeJsonReport(report, 'CODEX_PR_PROFILE_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('prProfileStatus', 'fail', { reasonCodes: ['pr_profile_invalid'] });
    writeJsonReport(report, 'CODEX_PR_PROFILE_REPORT');
    process.exit(1);
  }
}
