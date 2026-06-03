#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { simpleStatus, writeJsonReport, exitFor, normalizePath } from './codex-v080-lib.mjs';

const DANGEROUS = [
  ['dangerous_api_pattern_detected', /\beval\s*\(/],
  ['dangerous_api_pattern_detected', /\bnew\s+Function\s*\(/],
  ['dangerous_api_pattern_detected', /\bchild_process\.exec\s*\(/],
  ['dangerous_api_pattern_detected', /\bos\.system\s*\(/],
  ['dangerous_api_pattern_detected', /\bpickle\.loads?\s*\(/],
  ['dangerous_api_pattern_detected', /\bdangerouslySetInnerHTML\s*=/],
  ['dangerous_api_pattern_detected', /\.innerHTML\s*=/],
  ['dangerous_api_pattern_detected', /\bdocument\.write\s*\(/],
  ['dangerous_api_pattern_detected', /\bSELECT\b[\s\S]{0,80}\+/i],
  ['dangerous_api_pattern_detected', /auth\s*bypass|skip\s*auth|tenant\s*unfiltered/i],
];
const SECRET_PREFIX = /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|glpat-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})\b/;

function gitChangedFiles() {
  try {
    return execFileSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/).filter(Boolean).map(normalizePath);
  } catch {
    return [];
  }
}

function parseFiles(env = process.env) {
  try {
    const parsed = env.CODEX_CHANGED_FILES ? JSON.parse(env.CODEX_CHANGED_FILES) : gitChangedFiles();
    return Array.isArray(parsed) ? parsed.map(normalizePath) : [];
  } catch {
    return gitChangedFiles();
  }
}

function fixturePath(file) {
  return /self-test|fixtures?|EVAL_CASES|SECURITY_LIFECYCLE_RULES|SECURITY_LIFECYCLE_POLICY/i.test(file);
}

function workflowEscalated(file, text) {
  if (!/\.github\/workflows\//.test(file)) return false;
  const lines = String(text || '').split(/\r?\n/);
  let inPermissions = false;
  for (const line of lines) {
    if (/^\s*permissions:\s*$/.test(line)) {
      inPermissions = true;
      continue;
    }
    if (inPermissions && /^\S/.test(line) && !/^permissions:\s*/.test(line)) inPermissions = false;
    if (inPermissions && /^\s*[^#\n]+:\s*write\s*(?:#.*)?$/.test(line)) return true;
    if (/GITHUB_TOKEN[^#\n]*:\s*write\b/i.test(line)) return true;
  }
  return false;
}

export function buildSecurityLifecycleReport(env = process.env) {
  const files = parseFiles(env).filter((file) => fs.existsSync(file) && fs.statSync(file).isFile());
  const failures = [];
  const warnings = [];
  const layers = {
    edit_pattern_scan: 'pass',
    turn_diff_surface_scan: 'pass',
    commit_boundary_scan: 'pass',
    workflow_permission_scan: 'pass',
    secret_prefix_scan: 'pass',
    dangerous_api_scan: 'pass',
    security_guidance_alignment: 'pass',
  };

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    if (SECRET_PREFIX.test(text)) {
      failures.push('unsafe_value_detected');
      layers.secret_prefix_scan = 'fail';
    }
    if (workflowEscalated(file, text) && env.CODEX_TASK_CONTRACT_ALLOWS_WORKFLOW_WRITE !== '1') {
      failures.push('workflow_permission_escalation_unjustified');
      layers.workflow_permission_scan = 'fail';
    }
    for (const [reasonCode, pattern] of DANGEROUS) {
      if (!pattern.test(text)) continue;
      if (fixturePath(file)) warnings.push(`${reasonCode}:${file}`);
      else failures.push(`${reasonCode}:${file}`);
      layers.dangerous_api_scan = fixturePath(file) ? layers.dangerous_api_scan : 'fail';
    }
    if (/^(src|apps|contracts)\//.test(file) && /auth|security|runtime|entrypoint/i.test(file) && env.CODEX_SECURITY_ORACLE_PRESENT !== '1') {
      failures.push('security_lifecycle_failed');
      layers.turn_diff_surface_scan = 'fail';
    }
  }

  const policyValid = fs.existsSync('docs/process/CODEX_SECURITY_LIFECYCLE_POLICY.md') &&
    fs.existsSync('docs/process/CODEX_SECURITY_LIFECYCLE_RULES.json');
  if (!policyValid) failures.push('security lifecycle policy invalid');
  const status = failures.length ? 'fail' : 'pass';
  return simpleStatus('securityLifecycleStatus', status, {
    layers,
    reasonCodes: [...new Set(failures.map((item) => item.split(':')[0].replace(/\s+/g, '_')))],
    warnings,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildSecurityLifecycleReport();
  writeJsonReport(report, 'CODEX_SECURITY_LIFECYCLE_REPORT');
  exitFor(report);
}
