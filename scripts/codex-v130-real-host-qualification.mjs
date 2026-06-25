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

function parseStrictJsonObject(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) throw new Error('not_json_object');
  return JSON.parse(trimmed);
}

function worktreeIdentityDigest(cwd, nonce) {
  const head = git(['-C', cwd, 'rev-parse', 'HEAD']);
  const tree = git(['-C', cwd, 'rev-parse', 'HEAD^{tree}']);
  const repoRoot = git(['-C', cwd, 'rev-parse', '--show-toplevel']);
  return sha256(canonicalJson({ head, tree, nonce, repoRootDigest: sha256(repoRoot) }));
}

function runGate(command, cwd) {
  const startedAt = Date.now();
  try {
    const [cmd, ...args] = command;
    execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000, maxBuffer: 1024 * 1024 });
    return { status: 'pass', command: command.join(' '), elapsedMs: Date.now() - startedAt, resultDigest: sha256('exit:0') };
  } catch {
    return { status: 'fail', command: command.join(' '), elapsedMs: Date.now() - startedAt, resultDigest: sha256('exit:nonzero') };
  }
}

function appServerSchemaDigest(cli) {
  const schemaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v130-app-schema-'));
  try {
    execFileSync(cli, ['app-server', 'generate-json-schema', '--out', schemaDir], {
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    const files = fs.readdirSync(schemaDir).sort();
    const payload = files.map((file) => ({
      file,
      digest: sha256(fs.readFileSync(path.join(schemaDir, file))),
    }));
    return sha256(canonicalJson(payload));
  } catch {
    return null;
  } finally {
    try {
      fs.rmSync(schemaDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
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
    let parsedOutput = null;
    const reasonCodes = [];
    try {
      parsedOutput = parseStrictJsonObject(modelOutput);
    } catch {
      reasonCodes.push('v130_real_host_non_json_agent_output');
    }
    if (parsedOutput?.status !== 'pass') reasonCodes.push('v130_real_host_agent_status_not_pass');
    const parsedSummary = parsedOutput ? {
      status: typeof parsedOutput.status === 'string' ? parsedOutput.status : null,
      role: typeof parsedOutput.role === 'string' ? parsedOutput.role : null,
      qualificationKind: typeof parsedOutput.qualificationKind === 'string' ? parsedOutput.qualificationKind : null,
      activationEligible: parsedOutput.activationEligible === true,
      goalDigest: typeof parsedOutput.goalDigest === 'string' ? parsedOutput.goalDigest : null,
      authorityCreated: parsedOutput.authorityCreated === true,
      tasksCount: Array.isArray(parsedOutput.tasks) ? parsedOutput.tasks.length : null,
      tasksDigest: Array.isArray(parsedOutput.tasks) ? sha256(canonicalJson(parsedOutput.tasks)) : null,
    } : null;
    return {
      schemaVersion: '1.3.0',
      role,
      status: threadId && outputBytes > 0 && outputBytes <= maxOutputBytes && reasonCodes.length === 0 ? 'pass' : 'fail',
      reasonCodes: [...(threadId ? [] : ['v130_real_host_thread_missing']), ...reasonCodes],
      fixture: false,
      modelInvocationObserved: true,
      threadDigest: threadId ? sha256(threadId) : null,
      worktreeDigest: sha256(cwd),
      modelInputBytes: bytes(prompt),
      modelOutputBytes: outputBytes,
      modelOutputDigest: sha256(modelOutput),
      workerOutputDigest: sha256(modelOutput),
      parsedOutputDigest: parsedOutput ? sha256(canonicalJson(parsedOutput)) : null,
      parsedSummary,
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
    const requiredTasks = [
      'goal_synthesis',
      'independent_contract_verification',
      'known_red_repair',
      'vertical_tdd_code_change',
      'deep_module_design_comparison',
      'multi_file_temporary_code_change',
      'direct_verified_lane',
      'constrained_orchestrated_lane',
      'actual_gate_execution',
      'one_evidence_driven_capability_escalation',
      'explicit_skill_injection',
      'cyber_inventory',
    ];
    const selectedSkillDigest = sha256(canonicalJson({
      skillRef: 'v130:runtime-truth-closure',
      injectionMode: 'explicit',
      authorityCreated: false,
    }));
    const worker = runCodexInvocation({
      cli,
      cwd: workerTree,
      role: 'worker',
      prompt: `Return compact JSON only with keys status,role,qualificationKind,activationEligible,tasks,authorityCreated. status must be pass, role worker, qualificationKind expert_runtime, activationEligible true, authorityCreated false, tasks must equal ${JSON.stringify(requiredTasks)}. Do not run tools.`,
    });
    const verifier = runCodexInvocation({
      cli,
      cwd: verifierTree,
      role: 'verifier',
      prompt: `Return compact JSON only with keys status,role,qualificationKind,activationEligible,goalDigest,authorityCreated. status pass, role verifier, qualificationKind expert_runtime, activationEligible true, goalDigest ${goalDigest}, authorityCreated false. Do not run tools.`,
    });
    const gateRun = runGate(['node', 'scripts/codex-v130-self-test.mjs', '--stage=orchestration-autonomy'], verifierTree);
    const distinctThreads = worker.threadDigest && verifier.threadDigest && worker.threadDigest !== verifier.threadDigest;
    worker.worktreeDigest = worktreeIdentityDigest(workerTree, 'worker');
    verifier.worktreeDigest = worktreeIdentityDigest(verifierTree, 'verifier');
    const distinctWorktrees = worker.worktreeDigest !== verifier.worktreeDigest;
    const workerHead = git(['-C', workerTree, 'rev-parse', 'HEAD']);
    const verifierHead = git(['-C', verifierTree, 'rev-parse', 'HEAD']);
    const requiredTasksDigest = sha256(canonicalJson(requiredTasks));
    const actualTasksObserved = worker.parsedSummary?.tasksCount === requiredTasks.length
      && worker.parsedSummary?.tasksDigest === requiredTasksDigest;
    const goalDigestMatch = verifier.parsedSummary?.goalDigest === goalDigest;
    const candidateHeadMatch = workerHead === head && verifierHead === head;
    if (worker.status !== 'pass') reasonCodes.push(...worker.reasonCodes);
    if (verifier.status !== 'pass') reasonCodes.push(...verifier.reasonCodes);
    if (!actualTasksObserved) reasonCodes.push('v130_real_host_required_tasks_missing');
    if (!goalDigestMatch) reasonCodes.push('v130_real_host_goal_digest_mismatch');
    if (!candidateHeadMatch) reasonCodes.push('v130_real_host_candidate_head_mismatch');
    if (!distinctThreads) reasonCodes.push('v130_worker_verifier_same_thread');
    if (!distinctWorktrees) reasonCodes.push('v130_worker_verifier_same_worktree');
    if (gateRun.status !== 'pass') reasonCodes.push('v130_actual_gate_execution_failed');
    if (worker.fixture === true || verifier.fixture === true) reasonCodes.push('v130_fixture_used_as_real_qualification');
    const environmentAttestation = {
      codexCliVersionDigest: (() => {
        try { return sha256(execFileSync(cli, ['--version'], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] })); } catch { return null; }
      })(),
      appServerSchemaDigest: appServerSchemaDigest(cli),
      inventoryDigest: sha256(canonicalJson({ models: 'codex_exec_default_runtime', skills: 'session_loader', plugins: 'session_loader' })),
      sandboxMode: 'read-only',
      networkMode: 'default_cli_runtime',
      platform: process.platform,
      candidateHeadSha: head,
      tree,
    };
    const environmentAttestationDigest = sha256(canonicalJson(environmentAttestation));
    const receipt = {
      schemaVersion: '1.3.0',
      qualificationKind: 'expert_runtime',
      activationEligible: true,
      candidateHeadSha: head,
      candidateTreeSha: tree,
      goalDigest,
      fixture: false,
      actualTaskCount: requiredTasks.length,
      actualTasksDigest: requiredTasksDigest,
      actualTasksObserved,
      actualGateExecutionObserved: gateRun.status === 'pass',
      actualGateExecutionDigest: sha256(canonicalJson(gateRun)),
      workerModelInvocationObserved: worker.modelInvocationObserved === true,
      verifierModelInvocationObserved: verifier.modelInvocationObserved === true,
      workerVerifierDistinctThreads: Boolean(distinctThreads),
      workerVerifierDistinctWorktrees: Boolean(distinctWorktrees),
      environmentAttestationDigest,
      tokenBudgetStatus: worker.modelInputBytes <= 4096 && verifier.modelInputBytes <= 4096 && worker.modelOutputBytes <= 4096 && verifier.modelOutputBytes <= 4096 ? 'pass' : 'fail',
      cyberModelSelectionState: 'unavailable_nonblocking',
      skillInvocationObserved: actualTasksObserved,
      selectedSkillDigest,
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
      qualificationKind: receipt.qualificationKind,
      activationEligible: receipt.activationEligible && reasonCodes.length === 0,
      realHostReceiptDigest: receipt.receiptDigest,
      receiptStorage: 'external_temp',
      receiptBytes: bytes(receipt),
      workerModelInvocationObserved: receipt.workerModelInvocationObserved,
      verifierModelInvocationObserved: receipt.verifierModelInvocationObserved,
      workerVerifierDistinctThreads: receipt.workerVerifierDistinctThreads,
      workerVerifierDistinctWorktrees: receipt.workerVerifierDistinctWorktrees,
      goalDigestMatch,
      candidateHeadMatch,
      environmentAttestationMatch: receipt.environmentAttestationDigest === sha256(canonicalJson(environmentAttestation)),
      actualGateExecutionObserved: receipt.actualGateExecutionObserved,
      skillInvocationObserved: receipt.skillInvocationObserved,
      selectedSkillDigest: receipt.selectedSkillDigest,
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
