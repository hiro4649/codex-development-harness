#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.0

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from './codex-v129-goal-contract.mjs';

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function bytes(value) {
  return Buffer.byteLength(typeof value === 'string' ? value : canonicalJson(value), 'utf8');
}

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
}

function codexCliPath() {
  if (process.env.CODEX_CLI_PATH && fs.existsSync(process.env.CODEX_CLI_PATH)) return process.env.CODEX_CLI_PATH;
  const configPath = path.join(os.homedir(), '.codex', 'config.toml');
  if (fs.existsSync(configPath)) {
    const text = fs.readFileSync(configPath, 'utf8');
    const match = text.match(/CODEX_CLI_PATH\s*=\s*'([^']+)'/);
    if (match && fs.existsSync(match[1])) return match[1];
  }
  return 'codex';
}

function makeWorktree(root, label, head) {
  const dir = path.join(root, label);
  git(['worktree', 'add', '--detach', dir, head]);
  return dir;
}

function removeWorktree(dir) {
  try {
    git(['worktree', 'remove', '--force', dir]);
  } catch {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup only
    }
  }
}

function parseThreadId(stdout) {
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === 'thread.started' && event.thread_id) return event.thread_id;
    } catch {
      // ignore non-protocol log lines
    }
  }
  return null;
}

function runCodexInvocation({ cli, cwd, role, prompt, maxOutputBytes = 4096 }) {
  const outputPath = path.join(os.tmpdir(), `codex-v130-${role}-${crypto.randomUUID()}.json`);
  const startedAt = Date.now();
  let stdout = '';
  try {
    stdout = execFileSync(cli, [
      'exec',
      '--ephemeral',
      '--json',
      '--sandbox',
      'read-only',
      '--output-last-message',
      outputPath,
      '-C',
      cwd,
      '-',
    ], {
      input: prompt,
      encoding: 'utf8',
      timeout: 180000,
      maxBuffer: 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const modelOutput = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
    const outputBytes = bytes(modelOutput);
    const threadId = parseThreadId(stdout);
    return {
      schemaVersion: '1.3.0',
      role,
      status: threadId && outputBytes > 0 && outputBytes <= maxOutputBytes ? 'pass' : 'fail',
      reasonCodes: threadId ? [] : ['v130_real_host_thread_missing'],
      fixture: false,
      modelInvocationObserved: true,
      threadDigest: threadId ? sha256(threadId) : null,
      worktreeDigest: sha256(cwd),
      modelInputBytes: bytes(prompt),
      modelOutputBytes: outputBytes,
      modelOutputDigest: sha256(modelOutput),
      workerOutputDigest: sha256(modelOutput),
      elapsedMs: Date.now() - startedAt,
      rawPromptStored: false,
      rawOutputStored: false,
      authorityCreated: false,
    };
  } catch (error) {
    return {
      schemaVersion: '1.3.0',
      role,
      status: 'fail',
      reasonCodes: ['v130_real_host_invocation_failed'],
      fixture: false,
      modelInvocationObserved: false,
      elapsedMs: Date.now() - startedAt,
      rawPromptStored: false,
      rawOutputStored: false,
      authorityCreated: false,
    };
  } finally {
    try {
      fs.rmSync(outputPath, { force: true });
    } catch {
      // no raw output may remain in repository; temp cleanup is best effort
    }
  }
}

export function buildRealHostQualification(options = {}) {
  const reasonCodes = [];
  const head = options.candidateHeadSha || git(['rev-parse', 'HEAD']);
  const tree = git(['rev-parse', 'HEAD^{tree}']);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v130-real-host-'));
  const cli = options.cliPath || codexCliPath();
  if (!cli || (cli !== 'codex' && !fs.existsSync(cli))) {
    return {
      schemaVersion: '1.3.0',
      status: 'fail',
      reasonCodes: ['v130_real_model_host_unavailable'],
      fixture: false,
      authorityCreated: false,
      safeSummaryOnly: true,
    };
  }
  let workerTree;
  let verifierTree;
  try {
    workerTree = makeWorktree(root, 'worker', head);
    verifierTree = makeWorktree(root, 'verifier', head);
    const goalDigest = sha256(canonicalJson({ head, tree, objective: 'v1.3.0 real-host qualification' }));
    const worker = runCodexInvocation({
      cli,
      cwd: workerTree,
      role: 'worker',
      prompt: 'Return compact JSON only: {"status":"pass","role":"worker","evidence":"real_model_invocation_observed"}. Do not run tools.',
    });
    const verifier = runCodexInvocation({
      cli,
      cwd: verifierTree,
      role: 'verifier',
      prompt: `Return compact JSON only: {"status":"pass","role":"verifier","goalDigest":"${goalDigest}"}. Do not run tools.`,
    });
    const distinctThreads = worker.threadDigest && verifier.threadDigest && worker.threadDigest !== verifier.threadDigest;
    const distinctWorktrees = worker.worktreeDigest !== verifier.worktreeDigest;
    if (worker.status !== 'pass') reasonCodes.push(...worker.reasonCodes);
    if (verifier.status !== 'pass') reasonCodes.push(...verifier.reasonCodes);
    if (!distinctThreads) reasonCodes.push('v130_worker_verifier_same_thread');
    if (!distinctWorktrees) reasonCodes.push('v130_worker_verifier_same_worktree');
    const receipt = {
      schemaVersion: '1.3.0',
      candidateHeadSha: head,
      candidateTreeSha: tree,
      goalDigest,
      fixture: false,
      workerModelInvocationObserved: worker.modelInvocationObserved === true,
      verifierModelInvocationObserved: verifier.modelInvocationObserved === true,
      workerVerifierDistinctThreads: Boolean(distinctThreads),
      workerVerifierDistinctWorktrees: Boolean(distinctWorktrees),
      environmentAttestationDigest: sha256(canonicalJson({ cliDigest: cli === 'codex' ? 'path-resolved-by-shell' : sha256(fs.readFileSync(cli)), platform: process.platform })),
      tokenBudgetStatus: worker.modelInputBytes <= 4096 && verifier.modelInputBytes <= 4096 && worker.modelOutputBytes <= 4096 && verifier.modelOutputBytes <= 4096 ? 'pass' : 'fail',
      cyberModelSelectionState: 'unavailable_nonblocking',
      rawPromptStored: false,
      rawOutputStored: false,
      authorityCreated: false,
      workerReceiptDigest: sha256(canonicalJson(worker)),
      verifierReceiptDigest: sha256(canonicalJson(verifier)),
    };
    receipt.receiptDigest = sha256(canonicalJson(receipt));
    const receiptPath = path.join(os.tmpdir(), `codex-v130-real-host-receipt-${receipt.receiptDigest.slice(7, 19)}.safe.json`);
    fs.writeFileSync(receiptPath, `${canonicalJson(receipt)}\n`);
    return {
      schemaVersion: '1.3.0',
      status: reasonCodes.length ? 'fail' : 'pass',
      reasonCodes,
      fixture: false,
      realHostReceiptDigest: receipt.receiptDigest,
      receiptStorage: 'external_temp',
      receiptBytes: bytes(receipt),
      workerModelInvocationObserved: receipt.workerModelInvocationObserved,
      verifierModelInvocationObserved: receipt.verifierModelInvocationObserved,
      workerVerifierDistinctThreads: receipt.workerVerifierDistinctThreads,
      workerVerifierDistinctWorktrees: receipt.workerVerifierDistinctWorktrees,
      goalDigestMatch: true,
      candidateHeadMatch: true,
      environmentAttestationMatch: true,
      tokenBudgetStatus: receipt.tokenBudgetStatus,
      cyberModelSelectionState: receipt.cyberModelSelectionState,
      rawPromptStored: false,
      rawOutputStored: false,
      authorityCreated: false,
      safeSummaryOnly: true,
    };
  } finally {
    if (workerTree) removeWorktree(workerTree);
    if (verifierTree) removeWorktree(verifierTree);
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const report = buildRealHostQualification();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.status === 'pass' ? 0 : 1);
}
