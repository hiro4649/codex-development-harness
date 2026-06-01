#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  HARNESS_VERSION,
  marker,
  isPrContext,
  normalizePath,
  prBodyText,
  readJson,
  readText,
  scanObjectForUnsafe,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';
import { changedFiles } from './codex-change-classification-gate.mjs';
import { buildReviewEvalSuiteReport } from './codex-review-eval-suite.mjs';
import { buildPromptVariantSuggestionReport } from './codex-prompt-variant-suggest.mjs';

const defaultPromptSuitePath = 'docs/process/CODEX_PROMPT_EVAL_SUITE.json';
const promptLikePatterns = [
  'AGENTS.md',
  '.agents/skills/',
  '.github/pull_request_template.md',
  'docs/process/',
  'scripts/codex-code-review-monitor.mjs',
  'scripts/codex-prompt-',
  'scripts/codex-review-',
  'scripts/codex-knowledge-',
  'scripts/codex-contract-',
];
const allowedModes = new Set(['off', 'report', 'enforce', 'strict']);
const surfaces = ['agents', 'skill', 'review_policy', 'pr_template', 'gate_policy', 'schema', 'self_test', 'workflow', 'unknown'];

function pathHit(file, pattern) {
  const normalized = normalizePath(file);
  const p = normalizePath(pattern);
  return p.endsWith('/') ? normalized.startsWith(p) : normalized === p || normalized.startsWith(p) || normalized.includes(p);
}

function modeFromEnv(env) {
  const explicit = String(env.CODEX_PROMPT_GOVERNANCE_MODE || '').trim().toLowerCase();
  if (allowedModes.has(explicit)) return explicit;
  return isPrContext(env) ? 'enforce' : 'report';
}

function surfaceFor(file) {
  const normalized = normalizePath(file);
  if (normalized === 'AGENTS.md') return 'agents';
  if (normalized.startsWith('.agents/skills/')) return 'skill';
  if (normalized === '.github/pull_request_template.md') return 'pr_template';
  if (normalized.includes('CODEX_CODE_REVIEW_MONITOR') || normalized.includes('code_review') || normalized.includes('review')) return 'review_policy';
  if (normalized.includes('POLICY')) return 'gate_policy';
  if (normalized.includes('SCHEMA')) return 'schema';
  if (normalized.includes('self-test')) return 'self_test';
  if (normalized.startsWith('.github/workflows/')) return 'workflow';
  return 'unknown';
}

function riskFor(files) {
  const text = files.join('\n');
  if (/manual|confirmation|product|secret|runtime|production|readiness|owner|override/i.test(text)) return 'R4';
  if (/AGENTS\.md|POLICY|gate|monitor/i.test(text)) return 'R3';
  if (/SKILL\.md|pull_request_template|review/i.test(text)) return 'R2';
  if (/docs\//i.test(text)) return 'R1';
  return files.length ? 'R1' : 'R0';
}

function promptLike(files) {
  return files.filter((file) => promptLikePatterns.some((pattern) => pathHit(file, pattern)));
}

function evalCaseStatus(testCase) {
  const text = readText(testCase.target);
  if (text === null) return { id: testCase.id, status: 'fail', reasonCode: 'prompt_eval_case_failed' };
  const mustContain = testCase.mustContain || [];
  const mustNotContain = testCase.mustNotContain || [];
  const requiredRegex = testCase.requiredRegex || [];
  const forbiddenRegex = testCase.forbiddenRegex || [];
  const ok = mustContain.every((item) => text.includes(item)) &&
    mustNotContain.every((item) => !text.includes(item)) &&
    requiredRegex.every((pattern) => new RegExp(pattern, 'i').test(text)) &&
    forbiddenRegex.every((pattern) => !new RegExp(pattern, 'i').test(text));
  return { id: testCase.id, status: ok ? 'pass' : 'fail', reasonCode: ok ? null : 'prompt_eval_case_failed' };
}

export function buildPromptEvalSuiteReport(env = process.env) {
  if (env.CODEX_PROMPT_EVAL_TEST_UNSAFE === '1') {
    return simpleStatus('promptEvalSuiteStatus', 'fail', { reasonCodes: ['prompt_eval_suite_invalid'], casesRun: 0 });
  }
  const suitePath = env.CODEX_PROMPT_EVAL_SUITE_PATH || defaultPromptSuitePath;
  const parsed = readJson(suitePath);
  if (!parsed.ok || !Array.isArray(parsed.value?.cases)) {
    return simpleStatus('promptEvalSuiteStatus', 'fail', { reasonCodes: ['prompt_eval_suite_invalid'], casesRun: 0 });
  }
  const cases = parsed.value.cases.map(evalCaseStatus);
  const failures = cases.filter((item) => item.status === 'fail').map((item) => item.id);
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    promptEvalSuiteStatus: {
      status: failures.length ? 'fail' : 'pass',
      casesRun: cases.length,
      failures,
      cases,
      reasonCodes: failures.length ? ['prompt_eval_case_failed'] : [],
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
  };
  if (scanObjectForUnsafe(report).length) {
    report.promptEvalSuiteStatus.status = 'fail';
    report.promptEvalSuiteStatus.reasonCodes = ['prompt_eval_suite_invalid'];
  }
  report.status = report.promptEvalSuiteStatus.status;
  return report;
}

function parsedStatus(envValue, field) {
  if (!envValue) return null;
  try {
    const parsed = JSON.parse(envValue);
    return parsed[field] || parsed;
  } catch {
    return null;
  }
}

function runReviewEval(env) {
  return parsedStatus(env.CODEX_REVIEW_EVAL_JSON, 'reviewEvalSuiteStatus') || buildReviewEvalSuiteReport(env).reviewEvalSuiteStatus;
}

function runPromptEval(env) {
  return parsedStatus(env.CODEX_PROMPT_EVAL_JSON, 'promptEvalSuiteStatus') || buildPromptEvalSuiteReport(env).promptEvalSuiteStatus;
}

function runVariant(env) {
  return parsedStatus(env.CODEX_PROMPT_VARIANT_JSON, 'promptVariantSuggestionStatus') || buildPromptVariantSuggestionReport(env).promptVariantSuggestionStatus;
}

function caseIds(status) {
  return new Set((status.cases || []).map((item) => (typeof item === 'string' ? item : item.id)).filter(Boolean));
}

function scriptHasForbiddenAutoApply(file) {
  const text = readText(file) || '';
  return /\bautoApply\s*:\s*true\b|\bautoCommit\s*:\s*true\b|\bautoPush\s*:\s*true\b/.test(text);
}

export function buildPromptGovernanceReport(env = process.env) {
  const mode = modeFromEnv(env);
  if (mode === 'off') return simpleStatus('promptGovernanceStatus', 'not_applicable', { mode, reasonCodes: ['prompt_governance_off'] });
  const files = changedFiles(env);
  const changedPromptFiles = promptLike(files);
  if (!changedPromptFiles.length && !isPrContext(env)) {
    return simpleStatus('promptGovernanceStatus', 'not_applicable', {
      mode,
      promptLikeFilesChanged: false,
      changedPromptSurfaces: [],
      promptChangeRisk: 'R0',
      evalRequired: false,
      evalProvided: false,
      reasonCodes: ['prompt_like_files_not_changed'],
    });
  }
  const changedPromptSurfaces = [...new Set(changedPromptFiles.map(surfaceFor).filter((item) => surfaces.includes(item)))];
  const promptChangeRisk = riskFor(changedPromptFiles);
  const evalRequired = changedPromptFiles.length > 0 && !['R0', 'R1'].includes(promptChangeRisk);
  const promptEvalSuiteStatus = runPromptEval(env);
  const reviewEvalSuiteStatus = runReviewEval(env);
  const variantSuggestionStatus = runVariant(env);
  const reasonCodes = [];
  const promptIds = caseIds(promptEvalSuiteStatus);
  const reviewIds = caseIds(reviewEvalSuiteStatus);

  if (evalRequired && promptEvalSuiteStatus.status !== 'pass') reasonCodes.push('prompt_like_change_without_eval');
  if (evalRequired && promptEvalSuiteStatus.status === 'pass' && !promptIds.size) reasonCodes.push('prompt_like_change_without_eval');
  if (changedPromptFiles.includes('AGENTS.md') &&
      (promptEvalSuiteStatus.status !== 'pass' ||
        !['agents_keeps_task_specific_detail_out', 'agents_forbids_raw_logs_and_auto_approve', 'agents_points_to_docs_not_long_manual'].every((id) => promptIds.has(id)))) {
    reasonCodes.push('agents_change_without_prompt_eval');
  }
  if (changedPromptFiles.some((file) => normalizePath(file).includes('codex-bugfix/SKILL.md')) &&
      !['bugfix_skill_requires_reproduction', 'bugfix_skill_requires_root_cause', 'bugfix_skill_requires_verification'].every((id) => promptIds.has(id))) {
    reasonCodes.push('skill_change_without_eval');
  }
  if (changedPromptFiles.some((file) => normalizePath(file).includes('CODEX_CODE_REVIEW_MONITOR_POLICY')) &&
      (reviewEvalSuiteStatus.status !== 'pass' ||
        !['bugfix_missing_root_cause_fail', 'auth_surface_without_negative_test_manual', 'storage_surface_without_integrity_evidence_manual', 'runtime_readiness_with_open_release_blocking_risk_fail'].every((id) => reviewIds.has(id)))) {
    reasonCodes.push('review_policy_change_without_review_eval');
  }
  if (promptEvalSuiteStatus.status === 'fail') reasonCodes.push('prompt_eval_suite_invalid');
  if (reviewEvalSuiteStatus.status === 'fail') reasonCodes.push('review_eval_suite_invalid');
  if (variantSuggestionStatus.status === 'fail') reasonCodes.push('prompt_variant_report_invalid');
  if (scriptHasForbiddenAutoApply('scripts/codex-prompt-variant-suggest.mjs')) reasonCodes.push('prompt_variant_auto_apply_forbidden');

  const policyText = [
    readText('docs/process/CODEX_MANUAL_CONFIRMATION_POLICY.md') || '',
    readText('docs/process/CODEX_PRODUCT_VERIFICATION_POLICY.md') || '',
    prBodyText(env),
  ].join('\n');
  if (/manual confirmation can override non-overridable|non-overridable failures? can be overridden/i.test(policyText)) {
    reasonCodes.push('manual_override_policy_weakened');
  }
  if (/product verification (?:fail|failure)[^.\n]{0,80}(?:pass|allowed)/i.test(policyText)) {
    reasonCodes.push('product_verification_prompt_weakened');
  }

  let status = 'pass';
  const nonOverridable = new Set([
    'prompt_eval_suite_invalid',
    'review_eval_suite_invalid',
    'prompt_variant_auto_apply_forbidden',
    'manual_override_policy_weakened',
    'product_verification_prompt_weakened',
    'agents_change_without_prompt_eval',
    'skill_change_without_eval',
    'review_policy_change_without_review_eval',
  ]);
  if (reasonCodes.some((code) => nonOverridable.has(code))) status = 'fail';
  else if (reasonCodes.includes('prompt_like_change_without_eval')) status = isPrContext(env) ? 'manual_confirmation_required' : 'warning';
  else if (promptChangeRisk === 'unknown') status = 'manual_confirmation_required';
  if (mode === 'report' && status === 'fail' && !isPrContext(env)) status = 'warning';

  const payload = {
    status,
    mode,
    promptLikeFilesChanged: changedPromptFiles.length > 0,
    changedPromptSurfaces,
    promptChangeRisk,
    evalRequired,
    evalProvided: promptEvalSuiteStatus.status === 'pass' && reviewEvalSuiteStatus.status === 'pass',
    promptEvalSuiteStatus,
    reviewEvalSuiteStatus,
    variantSuggestionStatus,
    reasonCodes: [...new Set(reasonCodes)],
    safeSummaryOnly: true,
  };
  if (scanObjectForUnsafe(payload).length || env.CODEX_PROMPT_GOVERNANCE_TEST_UNSAFE === '1') {
    return simpleStatus('promptGovernanceStatus', 'fail', { ...payload, reasonCodes: ['prompt_governance_safe_summary_invalid'] });
  }
  return simpleStatus('promptGovernanceStatus', status, payload);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildPromptGovernanceReport();
    writeJsonReport(report, 'CODEX_PROMPT_GOVERNANCE_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('promptGovernanceStatus', 'fail', { reasonCodes: ['prompt_governance_failed'] });
    writeJsonReport(report, 'CODEX_PROMPT_GOVERNANCE_REPORT');
    process.exit(1);
  }
}
