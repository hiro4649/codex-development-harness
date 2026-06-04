#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

export function buildAgentsContextBudgetReport(env = process.env) {
  const file = env.CODEX_AGENTS_PATH || 'AGENTS.md';
  const failures = [];
  const warnings = [];
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    failures.push('agents_context_budget_exceeded');
  }
  const byteLength = Buffer.byteLength(text, 'utf8');
  const maxBytes = Number(env.CODEX_AGENTS_CONTEXT_MAX_BYTES || 12000);
  if (byteLength > maxBytes) failures.push('agents_context_budget_exceeded');
  if (/CODEX_VERSION_LINEAGE_POLICY[\s\S]{200,}Security Lifecycle/i.test(text)) failures.push('agents_context_budget_exceeded');
  if (/src[\s\S]{0,120}allowed/i.test(text) && /product code changed:\s*yes/i.test(text)) failures.push('agents_context_budget_exceeded');
  if (/target rollout/i.test(text) && !fs.existsSync('docs/process/CODEX_TASK_BRIEF_COMPILER_POLICY.md')) failures.push('agents_context_budget_exceeded');
  if (/CODEX_QUALITY_HARNESS_FILE v(?!0\.9\.2)/.test(text)) warnings.push('old_version_marker');
  const status = failures.length ? 'fail' : 'pass';
  return simpleStatus('agentsContextBudgetStatus', status, {
    reasonCodes: [...new Set(failures)],
    warnings,
    byteLength,
    maxBytes,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildAgentsContextBudgetReport();
  writeJsonReport(report, 'CODEX_AGENTS_CONTEXT_BUDGET_REPORT');
  exitFor(report);
}
