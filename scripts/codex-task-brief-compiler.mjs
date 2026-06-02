#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prBodyText, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor, normalizePath } from './codex-v080-lib.mjs';

const PRODUCT_PATH = /^(src|apps|contracts|runtime|package\.json|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)(\/|$)/;

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function files(env) {
  const parsed = parseJson(env.CODEX_CHANGED_FILES, []);
  return Array.isArray(parsed) ? parsed.map(normalizePath) : [];
}

function hasBrief(body) {
  return /## Task Contract|## Task Brief|Goal:|Forbidden scope:/i.test(body);
}

export function buildTaskBriefCompilerReport(env = process.env) {
  const input = parseJson(env.CODEX_TASK_BRIEF_INPUT, {});
  const body = input.body || prBodyText(env);
  const changed = input.changedFiles || files(env);
  const productChanged = changed.some((file) => PRODUCT_PATH.test(file));
  const highComplexity = input.complexity === 'high' || env.CODEX_TASK_COMPLEXITY === 'high' || changed.length > 12;
  const taskMode = input.taskMode || env.CODEX_TASK_MODE || (/target rollout|harness rollout/i.test(body) ? 'harness_change' : '');
  const runtimeClaim = input.runtimeReadinessClaimed === true || /runtime readiness claimed:\s*yes/i.test(body);
  const bugfix = taskMode === 'bugfix' || /task mode:\s*bugfix/i.test(body);
  const failures = [];
  const warnings = [];

  if (highComplexity && !hasBrief(body) && !input.goal) failures.push('task_brief_missing');
  if ((highComplexity || productChanged || taskMode === 'harness_change') && !/Forbidden scope:/i.test(body) && !input.forbiddenScope) failures.push('task_brief_forbidden_scope_missing');
  if (productChanged && !/Forbidden scope:/i.test(body) && !input.forbiddenScope) failures.push('task_brief_forbidden_scope_missing');
  if (runtimeClaim && !/Oracle requirement:/i.test(body) && !input.oracleRequirement) failures.push('runtime_readiness_not_proven');
  if (bugfix && !(/reproduced|root cause|verification/i.test(body) || input.reproduced && input.rootCause && input.verification)) failures.push('task_brief_missing');
  if ((/target rollout/i.test(body) || input.targetRollout) && !/harness-managed files only/i.test(body) && !input.harnessManagedOnly) failures.push('task_brief_forbidden_scope_missing');
  if (/docs-only/i.test(body) && !hasBrief(body)) warnings.push('docs_only_task_missing_brief');

  const brief = {
    Goal: input.goal || 'Maintain Codex harness safety gate behavior.',
    Context: input.context || 'Deterministic harness-managed evidence and policy update.',
    'Allowed scope': input.allowedScope || 'harness-managed files',
    'Forbidden scope': input.forbiddenScope || 'product runtime code, package files, profiles',
    'Done criteria': input.doneCriteria || 'targeted harness checks pass',
    'Verification surface': input.verificationSurface || 'local quality gate and self-test',
    'Risk surface': input.riskSurface || 'harness evidence and CI gate behavior',
    'Oracle requirement': input.oracleRequirement || 'required for runtime readiness claims only',
    'Rollback condition': input.rollbackCondition || 'revert harness-managed change',
    'Runtime readiness claim': runtimeClaim ? 'yes' : 'no',
    'Product code changed claim': productChanged ? 'yes' : 'no',
    'Expected files': changed.slice(0, 40),
    'Do-not-touch list': input.doNotTouch || ['src', 'apps', 'contracts', 'package files', 'profiles'],
    safeSummaryOnly: true,
  };
  const unsafe = scanObjectForUnsafe(brief).length > 0;
  const status = failures.length || unsafe ? 'fail' : 'pass';
  return simpleStatus('taskBriefCompilerStatus', status, {
    reasonCodes: [...new Set([...(unsafe ? ['task_brief_missing'] : []), ...failures])],
    warnings,
    brief,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildTaskBriefCompilerReport();
  if (process.argv.includes('--write-artifact')) fs.writeFileSync('codex-task-brief.safe.json', JSON.stringify(report.taskBriefCompilerStatus.brief, null, 2));
  writeJsonReport(report, 'CODEX_TASK_BRIEF_COMPILER_REPORT');
  exitFor(report);
}
