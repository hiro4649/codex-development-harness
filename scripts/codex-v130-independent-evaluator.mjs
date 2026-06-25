#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.0

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { canonicalJson } from './codex-v129-goal-contract.mjs';

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

export function evaluateBenchmarkBlackBox(options = {}) {
  const benchmarkScript = path.join(repoRoot(), 'scripts', 'codex-v130-benchmark.mjs');
  const args = [benchmarkScript];
  if (options.pack) args.push('--pack', options.pack);
  if (options.packBindingDigest) args.push('--pack-binding-digest', options.packBindingDigest);
  if (options.receiptRoot) {
    return {
      schemaVersion: '1.3.0',
      evaluatorKind: 'black_box_subprocess',
      status: 'fail',
      reasonCodes: ['v130_candidate_provided_jsonl_forbidden'],
      resultDigest: null,
      candidateRuntimeImported: false,
      authorityCreated: false,
      safeSummaryOnly: true,
    };
  }
  let stdout = '';
  let status = 'pass';
  let reasonCodes = [];
  try {
    stdout = execFileSync(process.execPath, args, {
      cwd: repoRoot(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: Number(options.timeoutMs || 900000),
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    status = 'fail';
    stdout = String(error.stdout || '');
    reasonCodes = ['v130_independent_evaluator_subprocess_failed'];
  }
  let result = null;
  try {
    result = JSON.parse(stdout);
    if (result.status !== 'pass') status = 'fail';
    reasonCodes = [...new Set([...reasonCodes, ...(result.reasonCodes || [])])];
  } catch {
    status = 'fail';
    reasonCodes.push('v130_independent_evaluator_output_invalid');
  }
  return {
    schemaVersion: '1.3.0',
    evaluatorKind: 'black_box_subprocess',
    status,
    reasonCodes: status === 'pass' ? [] : reasonCodes,
    resultDigest: result ? sha256(canonicalJson(result)) : null,
    candidateRuntimeImported: false,
    authorityCreated: false,
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const result = evaluateBenchmarkBlackBox({
    pack: argValue('--pack'),
    packBindingDigest: argValue('--pack-binding-digest') || argValue('--pack-digest'),
  });
  console.log(canonicalJson(result));
  process.exit(result.status === 'pass' ? 0 : 1);
}
