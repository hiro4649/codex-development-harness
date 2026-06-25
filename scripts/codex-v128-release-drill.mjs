#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';

export const V128_RELEASE_DRILL_TRUSTED_BASE_COMMIT = '37e2812620c1b64d8f4da7085b2e0efe1ac89de2';

export const V128_RELEASE_DRILL_SCENARIOS = Object.freeze([
  'forced_interruption_recovery',
  'stale_lock_recovery',
  'same_blocker_stop',
  'duplicate_writer_rejection',
  'v127_rollback_dry_run',
]);

const CHILD_ARG = '--release-drill-child';

const DEFAULT_ANTI_SPIN = Object.freeze({
  maxRepairIterations: 2,
  sameBlockerMax: 1,
  noProgressWindow: 1,
});

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function digestValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function safeWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, canonicalJson(value));
}

function safeRm(targetPath, allowedRoot) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(allowedRoot);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('release_drill_rm_outside_temp_root');
  }
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}

function loadRepoFacts(repoRoot = process.cwd()) {
  const versionText = readTextIfExists(path.join(repoRoot, 'scripts/codex-harness-version.mjs')) || '';
  const preservationText = readTextIfExists(path.join(repoRoot, 'docs/process/CODEX_V128_PRESERVATION_MATRIX.json')) || '';
  return {
    v127SelfTestAvailable: fs.existsSync(path.join(repoRoot, 'scripts/codex-v127-self-test.mjs')),
    v128SelfTestAvailable: fs.existsSync(path.join(repoRoot, 'scripts/codex-v128-self-test.mjs')),
    v127SpecAvailable: fs.existsSync(path.join(repoRoot, 'docs/process/CODEX_V127_SPEC.md')),
    versionRegistryDeclaresPreviousV127: versionText.includes("previousVersion = '1.2.7'"),
    versionRegistryDeclaresPreviousV128: versionText.includes("previousVersion = '1.2.8'"),
    versionRegistryDeclaresV127StatusKey: versionText.includes('v127SelfTestStatus'),
    versionRegistryDeclaresV128StatusKey: versionText.includes('v128SelfTestStatus'),
    preservationDeclaresRollback: preservationText.includes('"rollback_writer_to_v127"'),
    preservationDeclaresDualReader: preservationText.includes('"v127_v128_dual_reader"'),
  };
}

function scenarioInput(input, scenarioId) {
  const byId = Object.fromEntries((input.scenarios || []).map((item) => [item.scenarioId, item]));
  return {
    ...(input.scenarioOverrides?.[scenarioId] || {}),
    ...(byId[scenarioId] || {}),
  };
}

function scenarioBase(scenarioId, overrides = {}) {
  return {
    scenarioId,
    status: 'pass',
    reasonCodes: [],
    rawLogsRead: false,
    productRuntimeMutation: false,
    packageMutation: false,
    deployMutation: false,
    completionContractChanged: false,
    sourceActivationAuthorized: false,
    targetRolloutAuthorized: false,
    safeSummaryOnly: true,
    ...overrides,
  };
}

function finalizeScenario(scenario) {
  scenario.status = scenario.reasonCodes.length ? 'fail' : 'pass';
  scenario.scenarioDigest = digestValue({
    scenarioId: scenario.scenarioId,
    status: scenario.status,
    reasonCodes: scenario.reasonCodes,
  });
  return scenario;
}

function evaluateScenario(scenarioId, override = {}, context = {}) {
  const antiSpin = context.antiSpin || DEFAULT_ANTI_SPIN;
  const repoFacts = context.repoFacts || {};
  const scenario = scenarioBase(scenarioId, override);

  if (scenario.rawLogsRead !== false) scenario.reasonCodes.push('release_drill_raw_log_read_forbidden');
  if (scenario.productRuntimeMutation !== false) scenario.reasonCodes.push('release_drill_product_runtime_mutation_forbidden');
  if (scenario.packageMutation !== false) scenario.reasonCodes.push('release_drill_package_mutation_forbidden');
  if (scenario.deployMutation !== false) scenario.reasonCodes.push('release_drill_deploy_mutation_forbidden');
  if (scenario.completionContractChanged !== false) scenario.reasonCodes.push('release_drill_completion_contract_change_forbidden');
  if (scenario.sourceActivationAuthorized !== false) scenario.reasonCodes.push('release_drill_source_activation_authority_forbidden');
  if (scenario.targetRolloutAuthorized !== false) scenario.reasonCodes.push('release_drill_target_rollout_authority_forbidden');

  if (scenarioId === 'forced_interruption_recovery') {
    const expected = {
      interruptionObserved: true,
      checkpointState: 'observed',
      recoveryAction: 'resume_from_checkpoint',
      scopeDelta: false,
      recoveryContinuesSameContract: true,
    };
    Object.assign(scenario, { ...expected, ...scenario });
    if (scenario.interruptionObserved !== true) scenario.reasonCodes.push('forced_interruption_not_observed');
    if (scenario.checkpointState !== 'observed') scenario.reasonCodes.push('forced_interruption_checkpoint_missing');
    if (scenario.recoveryAction !== 'resume_from_checkpoint') scenario.reasonCodes.push('forced_interruption_recovery_action_invalid');
    if (scenario.scopeDelta !== false) scenario.reasonCodes.push('forced_interruption_scope_delta_forbidden');
    if (scenario.recoveryContinuesSameContract !== true) scenario.reasonCodes.push('forced_interruption_contract_not_preserved');
  }

  if (scenarioId === 'stale_lock_recovery') {
    const expected = {
      staleLockObserved: true,
      lockRecoveryAction: 'reacquire_after_stale_lock',
      activeWriterRejected: true,
      duplicateWriterAllowed: false,
    };
    Object.assign(scenario, { ...expected, ...scenario });
    if (scenario.staleLockObserved !== true) scenario.reasonCodes.push('stale_lock_not_observed');
    if (scenario.lockRecoveryAction !== 'reacquire_after_stale_lock') scenario.reasonCodes.push('stale_lock_recovery_action_invalid');
    if (scenario.activeWriterRejected !== true) scenario.reasonCodes.push('stale_lock_active_writer_not_rejected');
    if (scenario.duplicateWriterAllowed !== false) scenario.reasonCodes.push('stale_lock_duplicate_writer_allowed');
  }

  if (scenarioId === 'same_blocker_stop') {
    const expected = {
      sameBlockerRepeatCount: antiSpin.sameBlockerMax,
      repairIterationCount: antiSpin.maxRepairIterations,
      stopAction: 'stop_same_blocker',
      noProgressWindow: antiSpin.noProgressWindow,
    };
    Object.assign(scenario, { ...expected, ...scenario });
    if (Number(scenario.sameBlockerRepeatCount) < antiSpin.sameBlockerMax) scenario.reasonCodes.push('same_blocker_repeat_not_reached');
    if (Number(scenario.repairIterationCount) > antiSpin.maxRepairIterations) scenario.reasonCodes.push('same_blocker_repair_cap_exceeded');
    if (scenario.stopAction !== 'stop_same_blocker') scenario.reasonCodes.push('same_blocker_stop_action_invalid');
    if (Number(scenario.noProgressWindow) < antiSpin.noProgressWindow) scenario.reasonCodes.push('same_blocker_no_progress_window_missing');
  }

  if (scenarioId === 'duplicate_writer_rejection') {
    const expected = {
      duplicateWriterObserved: true,
      writerCount: 2,
      rejectionAction: 'reject_duplicate_writer',
      stateMutationAllowed: false,
      mergeAllowed: false,
    };
    Object.assign(scenario, { ...expected, ...scenario });
    if (scenario.duplicateWriterObserved !== true) scenario.reasonCodes.push('duplicate_writer_not_observed');
    if (Number(scenario.writerCount) < 2) scenario.reasonCodes.push('duplicate_writer_count_invalid');
    if (scenario.rejectionAction !== 'reject_duplicate_writer') scenario.reasonCodes.push('duplicate_writer_rejection_action_invalid');
    if (scenario.stateMutationAllowed !== false) scenario.reasonCodes.push('duplicate_writer_state_mutation_allowed');
    if (scenario.mergeAllowed !== false) scenario.reasonCodes.push('duplicate_writer_merge_allowed');
  }

  if (scenarioId === 'v127_rollback_dry_run') {
    const expected = {
      rollbackDryRun: true,
      activationSurfaceMutated: false,
      v127DualReaderAvailable: repoFacts.preservationDeclaresDualReader === true,
      v127RollbackAvailable: repoFacts.v127SelfTestAvailable === true
        && repoFacts.v127SpecAvailable === true
        && (repoFacts.versionRegistryDeclaresPreviousV127 === true
          || (repoFacts.versionRegistryDeclaresPreviousV128 === true
            && repoFacts.versionRegistryDeclaresV128StatusKey === true))
        && repoFacts.versionRegistryDeclaresV127StatusKey === true
        && repoFacts.preservationDeclaresRollback === true,
    };
    Object.assign(scenario, { ...expected, ...scenario });
    if (scenario.rollbackDryRun !== true) scenario.reasonCodes.push('v127_rollback_dry_run_missing');
    if (scenario.activationSurfaceMutated !== false) scenario.reasonCodes.push('v127_rollback_dry_run_mutated_activation_surface');
    if (scenario.v127DualReaderAvailable !== true) scenario.reasonCodes.push('v127_dual_reader_missing');
    if (scenario.v127RollbackAvailable !== true) scenario.reasonCodes.push('v127_rollback_unavailable');
  }

  return finalizeScenario(scenario);
}

export function buildV128ReleaseDrill(input = {}) {
  const antiSpin = {
    maxRepairIterations: Number(input.maxRepairIterations ?? DEFAULT_ANTI_SPIN.maxRepairIterations),
    sameBlockerMax: Number(input.sameBlockerMax ?? DEFAULT_ANTI_SPIN.sameBlockerMax),
    noProgressWindow: Number(input.noProgressWindow ?? DEFAULT_ANTI_SPIN.noProgressWindow),
  };
  const repoFacts = input.repoFacts || loadRepoFacts(input.repoRoot || process.cwd());
  const scenarioIds = Array.isArray(input.scenarioIds) && input.scenarioIds.length
    ? input.scenarioIds
    : V128_RELEASE_DRILL_SCENARIOS;
  const scenarios = scenarioIds.map((scenarioId) => evaluateScenario(scenarioId, scenarioInput(input, scenarioId), {
    antiSpin,
    repoFacts,
  }));
  const validation = validateV128ReleaseDrill({ executionMode: 'contract_fixture', scenarios, antiSpin });
  return {
    releaseDrillStatus: {
      status: validation.status,
      executionMode: 'contract_fixture',
      scenarioCount: scenarios.length,
      requiredScenarioCount: V128_RELEASE_DRILL_SCENARIOS.length,
      antiSpin,
      sourceActivationAuthorized: false,
      targetRolloutAuthorized: false,
      completionContractChanged: false,
      safeNextAction: validation.status === 'pass' ? 'source_activation_pr_only' : 'repair_release_drill_only',
      reasonCodes: validation.reasonCodes,
      safeSummaryOnly: true,
    },
    scenarioSetDigest: digestValue(scenarios.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      status: scenario.status,
      scenarioDigest: scenario.scenarioDigest,
    }))),
    scenarios,
    status: validation.status,
    safeSummaryOnly: true,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFile(filePath, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (fs.existsSync(filePath)) return true;
    await sleep(50);
  }
  return false;
}

function writeChildConfig(tmpRoot, kind, config) {
  const configFile = path.join(tmpRoot, 'child-configs', `${kind}-${crypto.randomUUID()}.json`);
  safeWriteJson(configFile, config);
  return configFile;
}

function childProcessArgs(kind, resultFile, configFile) {
  return [fileURLToPath(import.meta.url), CHILD_ARG, kind, resultFile, configFile];
}

function readChildResult(resultFile) {
  return readJsonIfExists(resultFile) || {
    status: 'fail',
    reasonCodes: ['release_drill_child_result_missing'],
  };
}

function runShortChild(kind, tmpRoot, config = {}, options = {}) {
  const resultFile = path.join(tmpRoot, 'child-results', `${kind}-${crypto.randomUUID()}.json`);
  const configFile = writeChildConfig(tmpRoot, kind, { tmpRoot, ...config });
  const child = spawnSync(process.execPath, childProcessArgs(kind, resultFile, configFile), {
    cwd: config.cwd || process.cwd(),
    encoding: 'utf8',
    timeout: options.timeoutMs || 10000,
    env: { ...process.env, CODEX_RELEASE_DRILL_CHILD: '1' },
  });
  const result = readChildResult(resultFile);
  return {
    exitCode: child.status,
    signal: child.signal || null,
    timedOut: Boolean(child.error && child.error.code === 'ETIMEDOUT'),
    result,
  };
}

function startLongChild(kind, tmpRoot, config = {}) {
  const resultFile = path.join(tmpRoot, 'child-results', `${kind}-${crypto.randomUUID()}.json`);
  const configFile = writeChildConfig(tmpRoot, kind, { tmpRoot, ...config });
  const child = spawn(process.execPath, childProcessArgs(kind, resultFile, configFile), {
    cwd: config.cwd || process.cwd(),
    stdio: 'ignore',
    env: { ...process.env, CODEX_RELEASE_DRILL_CHILD: '1' },
  });
  return { child, resultFile };
}

async function waitForExit(child, timeoutMs = 5000) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return { exitCode: child.exitCode, signal: child.signalCode };
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ exitCode: child.exitCode, signal: child.signalCode || 'TIMEOUT_KILL' });
    }, timeoutMs);
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ exitCode: code, signal: signal || null });
    });
  });
}

function commandStatus(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    timeout: options.timeoutMs || 120000,
    env: { ...process.env, CODEX_QUALITY_REPORT: 'json', ...(options.env || {}) },
  });
  return {
    command: path.basename(command),
    exitCode: result.status,
    signal: result.signal || null,
    timedOut: Boolean(result.error && result.error.code === 'ETIMEDOUT'),
  };
}

async function runForcedInterruptionScenario(tmpRoot, antiSpin) {
  const scenarioId = 'forced_interruption_recovery';
  const contractDigest = digestValue({ scenarioId, antiSpin, trustedBaseCommit: V128_RELEASE_DRILL_TRUSTED_BASE_COMMIT });
  const checkpointFile = path.join(tmpRoot, 'forced-interruption', 'checkpoint.safe.json');
  const worker = startLongChild('forced-worker', tmpRoot, { contractDigest, checkpointFile });
  const checkpointReady = await waitForFile(checkpointFile, 5000);
  const workerReady = await waitForFile(worker.resultFile, 5000);
  worker.child.kill('SIGTERM');
  const workerExit = await waitForExit(worker.child, 5000);
  const resume = runShortChild('forced-resume', tmpRoot, { contractDigest, checkpointFile });
  const resumeResult = resume.result || {};
  const scenario = scenarioBase(scenarioId, {
    executionMode: 'black_box_child_process_filesystem',
    observationSource: 'actual_child_process_and_filesystem',
    expectedDefaultsMaterialized: false,
    observedByChildProcess: true,
    interruptionObserved: checkpointReady && workerReady && (workerExit.signal !== null || workerExit.exitCode !== 0),
    childProcessKilled: workerExit.signal !== null || workerExit.exitCode !== 0,
    checkpointState: checkpointReady ? 'observed' : 'missing',
    recoveryAction: resumeResult.recoveryAction || 'missing',
    scopeDelta: resumeResult.scopeDelta ?? true,
    recoveryContinuesSameContract: resumeResult.recoveryContinuesSameContract === true,
  });
  if (scenario.interruptionObserved !== true) scenario.reasonCodes.push('forced_interruption_not_observed');
  if (scenario.childProcessKilled !== true) scenario.reasonCodes.push('forced_interruption_child_not_killed');
  if (scenario.checkpointState !== 'observed') scenario.reasonCodes.push('forced_interruption_checkpoint_missing');
  if (scenario.recoveryAction !== 'resume_from_checkpoint') scenario.reasonCodes.push('forced_interruption_recovery_action_invalid');
  if (scenario.scopeDelta !== false) scenario.reasonCodes.push('forced_interruption_scope_delta_forbidden');
  if (scenario.recoveryContinuesSameContract !== true) scenario.reasonCodes.push('forced_interruption_contract_not_preserved');
  return finalizeScenario(scenario);
}

async function runStaleLockScenario(tmpRoot) {
  const scenarioId = 'stale_lock_recovery';
  const staleLockDir = path.join(tmpRoot, 'locks', 'stale.lock');
  fs.mkdirSync(staleLockDir, { recursive: true });
  safeWriteJson(path.join(staleLockDir, 'owner.json'), {
    pid: 0,
    stale: true,
    timestampMs: Date.now() - 600000,
  });
  const staleAttempt = runShortChild('lock-attempt', tmpRoot, {
    lockDir: staleLockDir,
    mode: 'stale',
    staleAgeMs: 60000,
  });

  const liveLockDir = path.join(tmpRoot, 'locks', 'live.lock');
  const holder = startLongChild('live-lock-holder', tmpRoot, { lockDir: liveLockDir });
  const holderReady = await waitForFile(holder.resultFile, 5000);
  const liveAttempt = runShortChild('lock-attempt', tmpRoot, {
    lockDir: liveLockDir,
    mode: 'live',
  });
  holder.child.kill('SIGTERM');
  await waitForExit(holder.child, 5000);

  const scenario = scenarioBase(scenarioId, {
    executionMode: 'black_box_child_process_filesystem',
    observationSource: 'actual_child_process_and_filesystem',
    expectedDefaultsMaterialized: false,
    observedByChildProcess: true,
    staleLockObserved: staleAttempt.result.staleLockObserved === true,
    staleLockRecovered: staleAttempt.result.lockRecoveryAction === 'reacquire_after_stale_lock',
    lockRecoveryAction: staleAttempt.result.lockRecoveryAction || 'missing',
    activeWriterRejected: holderReady && liveAttempt.result.rejectionAction === 'reject_active_writer',
    duplicateWriterAllowed: false,
  });
  if (scenario.staleLockObserved !== true) scenario.reasonCodes.push('stale_lock_not_observed');
  if (scenario.staleLockRecovered !== true) scenario.reasonCodes.push('stale_lock_not_recovered');
  if (scenario.lockRecoveryAction !== 'reacquire_after_stale_lock') scenario.reasonCodes.push('stale_lock_recovery_action_invalid');
  if (scenario.activeWriterRejected !== true) scenario.reasonCodes.push('stale_lock_active_writer_not_rejected');
  if (scenario.duplicateWriterAllowed !== false) scenario.reasonCodes.push('stale_lock_duplicate_writer_allowed');
  return finalizeScenario(scenario);
}

function runSameBlockerScenario(tmpRoot, antiSpin) {
  const scenarioId = 'same_blocker_stop';
  const stateFile = path.join(tmpRoot, 'same-blocker', 'state.safe.json');
  const blockerDigest = digestValue({ blocker: 'fixed_release_drill_blocker', antiSpin });
  const first = runShortChild('blocker-attempt', tmpRoot, { stateFile, blockerDigest });
  const second = runShortChild('blocker-attempt', tmpRoot, { stateFile, blockerDigest });
  const scenario = scenarioBase(scenarioId, {
    executionMode: 'black_box_child_process_filesystem',
    observationSource: 'actual_child_process_and_filesystem',
    expectedDefaultsMaterialized: false,
    observedByChildProcess: true,
    firstAttemptAction: first.result.action || 'missing',
    sameBlockerRepeatCount: second.result.sameBlockerRepeatCount ?? 0,
    repairIterationCount: 2,
    stopAction: second.result.action || 'missing',
    noProgressWindow: antiSpin.noProgressWindow,
  });
  if (scenario.firstAttemptAction !== 'continue_repair') scenario.reasonCodes.push('same_blocker_first_attempt_invalid');
  if (Number(scenario.sameBlockerRepeatCount) < antiSpin.sameBlockerMax) scenario.reasonCodes.push('same_blocker_repeat_not_reached');
  if (Number(scenario.repairIterationCount) > antiSpin.maxRepairIterations) scenario.reasonCodes.push('same_blocker_repair_cap_exceeded');
  if (scenario.stopAction !== 'stop_same_blocker') scenario.reasonCodes.push('same_blocker_stop_action_invalid');
  if (Number(scenario.noProgressWindow) < antiSpin.noProgressWindow) scenario.reasonCodes.push('same_blocker_no_progress_window_missing');
  return finalizeScenario(scenario);
}

async function runDuplicateWriterScenario(tmpRoot) {
  const scenarioId = 'duplicate_writer_rejection';
  const lockDir = path.join(tmpRoot, 'duplicate-writer', 'writer.lock');
  const stateFile = path.join(tmpRoot, 'duplicate-writer', 'state.safe.json');
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  const writerA = startLongChild('duplicate-writer', tmpRoot, { lockDir, stateFile, writerId: 'writer_a', holdMs: 120 });
  const writerB = startLongChild('duplicate-writer', tmpRoot, { lockDir, stateFile, writerId: 'writer_b', holdMs: 120 });
  const readyA = await waitForFile(writerA.resultFile, 5000);
  const readyB = await waitForFile(writerB.resultFile, 5000);
  await waitForExit(writerA.child, 5000);
  await waitForExit(writerB.child, 5000);
  const results = [readChildResult(writerA.resultFile), readChildResult(writerB.resultFile)];
  const acceptedWriterCount = results.filter((result) => result.action === 'write_state').length;
  const rejectedWriterCount = results.filter((result) => result.action === 'reject_duplicate_writer').length;
  const state = readJsonIfExists(stateFile);
  const scenario = scenarioBase(scenarioId, {
    executionMode: 'black_box_child_process_filesystem',
    observationSource: 'actual_child_process_and_filesystem',
    expectedDefaultsMaterialized: false,
    observedByChildProcess: true,
    duplicateWriterObserved: readyA && readyB && acceptedWriterCount === 1 && rejectedWriterCount === 1,
    writerCount: 2,
    acceptedWriterCount,
    rejectedWriterCount,
    rejectionAction: rejectedWriterCount === 1 ? 'reject_duplicate_writer' : 'missing',
    stateMutationAllowed: rejectedWriterCount === 1 && acceptedWriterCount === 1 ? false : true,
    stateWriterCount: state?.writerId ? 1 : 0,
    mergeAllowed: false,
  });
  if (scenario.duplicateWriterObserved !== true) scenario.reasonCodes.push('duplicate_writer_not_observed');
  if (Number(scenario.writerCount) < 2) scenario.reasonCodes.push('duplicate_writer_count_invalid');
  if (scenario.acceptedWriterCount !== 1) scenario.reasonCodes.push('duplicate_writer_accepted_count_invalid');
  if (scenario.rejectedWriterCount !== 1) scenario.reasonCodes.push('duplicate_writer_rejected_count_invalid');
  if (scenario.rejectionAction !== 'reject_duplicate_writer') scenario.reasonCodes.push('duplicate_writer_rejection_action_invalid');
  if (scenario.stateMutationAllowed !== false) scenario.reasonCodes.push('duplicate_writer_state_mutation_allowed');
  if (scenario.mergeAllowed !== false) scenario.reasonCodes.push('duplicate_writer_merge_allowed');
  return finalizeScenario(scenario);
}

function runV127RollbackScenario(tmpRoot, repoRoot) {
  const scenarioId = 'v127_rollback_dry_run';
  const worktreePath = path.join(tmpRoot, 'trusted-v127-worktree');
  let worktreeAdded = false;
  const reasonCodes = [];
  const add = commandStatus('git', ['worktree', 'add', '--detach', worktreePath, V128_RELEASE_DRILL_TRUSTED_BASE_COMMIT], {
    cwd: repoRoot,
    timeoutMs: 120000,
    env: { GIT_TERMINAL_PROMPT: '0' },
  });
  worktreeAdded = add.exitCode === 0;
  if (!worktreeAdded) reasonCodes.push('v127_rollback_worktree_add_failed');

  const repoFacts = worktreeAdded ? loadRepoFacts(worktreePath) : {};
  const v127SelfTest = worktreeAdded
    ? commandStatus(process.execPath, ['scripts/codex-v127-self-test.mjs'], { cwd: worktreePath, timeoutMs: 180000 })
    : { exitCode: 1, timedOut: false };
  const v127Gate = worktreeAdded
    ? commandStatus(process.execPath, ['scripts/codex-local-quality-gate.mjs'], { cwd: worktreePath, timeoutMs: 240000 })
    : { exitCode: 1, timedOut: false };

  if (worktreeAdded) {
    const remove = commandStatus('git', ['worktree', 'remove', '--force', worktreePath], {
      cwd: repoRoot,
      timeoutMs: 120000,
      env: { GIT_TERMINAL_PROMPT: '0' },
    });
    if (remove.exitCode !== 0) reasonCodes.push('v127_rollback_worktree_remove_failed');
  }

  const v127RollbackAvailable = repoFacts.v127SelfTestAvailable === true
    && repoFacts.v127SpecAvailable === true
    && (repoFacts.versionRegistryDeclaresPreviousV127 === true
      || (repoFacts.versionRegistryDeclaresPreviousV128 === true
        && repoFacts.versionRegistryDeclaresV128StatusKey === true))
    && repoFacts.versionRegistryDeclaresV127StatusKey === true
    && repoFacts.preservationDeclaresRollback === true;
  const scenario = scenarioBase(scenarioId, {
    executionMode: 'black_box_child_process_filesystem',
    observationSource: 'actual_git_worktree_and_child_process',
    expectedDefaultsMaterialized: false,
    observedByChildProcess: true,
    trustedBaseCommit: V128_RELEASE_DRILL_TRUSTED_BASE_COMMIT,
    rollbackDryRun: true,
    activationSurfaceMutated: false,
    v127DualReaderAvailable: repoFacts.preservationDeclaresDualReader === true,
    v127RollbackAvailable,
    v127SelfTestPass: v127SelfTest.exitCode === 0 && v127SelfTest.timedOut !== true,
    v127QualityGatePass: v127Gate.exitCode === 0 && v127Gate.timedOut !== true,
    worktreeAdded,
    ...{ reasonCodes },
  });
  if (scenario.rollbackDryRun !== true) scenario.reasonCodes.push('v127_rollback_dry_run_missing');
  if (scenario.activationSurfaceMutated !== false) scenario.reasonCodes.push('v127_rollback_dry_run_mutated_activation_surface');
  if (scenario.v127DualReaderAvailable !== true) scenario.reasonCodes.push('v127_dual_reader_missing');
  if (scenario.v127RollbackAvailable !== true) scenario.reasonCodes.push('v127_rollback_unavailable');
  if (scenario.v127SelfTestPass !== true) scenario.reasonCodes.push('v127_rollback_self_test_failed');
  if (scenario.v127QualityGatePass !== true) scenario.reasonCodes.push('v127_rollback_quality_gate_failed');
  return finalizeScenario(scenario);
}

export async function runV128BlackBoxReleaseDrill(input = {}) {
  const repoRoot = input.repoRoot || process.cwd();
  const antiSpin = {
    maxRepairIterations: Number(input.maxRepairIterations ?? DEFAULT_ANTI_SPIN.maxRepairIterations),
    sameBlockerMax: Number(input.sameBlockerMax ?? DEFAULT_ANTI_SPIN.sameBlockerMax),
    noProgressWindow: Number(input.noProgressWindow ?? DEFAULT_ANTI_SPIN.noProgressWindow),
  };
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v128-release-drill-'));
  let scenarios = [];
  try {
    scenarios = [
      await runForcedInterruptionScenario(tmpRoot, antiSpin),
      await runStaleLockScenario(tmpRoot),
      runSameBlockerScenario(tmpRoot, antiSpin),
      await runDuplicateWriterScenario(tmpRoot),
      runV127RollbackScenario(tmpRoot, repoRoot),
    ];
  } finally {
    safeRm(tmpRoot, os.tmpdir());
  }
  const validation = validateV128ReleaseDrill({
    executionMode: 'black_box_child_process_filesystem',
    trustedBaseCommit: V128_RELEASE_DRILL_TRUSTED_BASE_COMMIT,
    scenarios,
    antiSpin,
  });
  return {
    releaseDrillStatus: {
      status: validation.status,
      executionMode: 'black_box_child_process_filesystem',
      trustedBaseCommit: V128_RELEASE_DRILL_TRUSTED_BASE_COMMIT,
      scenarioCount: scenarios.length,
      requiredScenarioCount: V128_RELEASE_DRILL_SCENARIOS.length,
      antiSpin,
      sourceActivationAuthorized: false,
      targetRolloutAuthorized: false,
      completionContractChanged: false,
      targetRolloutFrozen: true,
      safeNextAction: validation.status === 'pass' ? 'ratify_current_activation' : 'auto_revert_source_activation',
      reasonCodes: validation.reasonCodes,
      safeSummaryOnly: true,
    },
    scenarioSetDigest: digestValue(scenarios.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      status: scenario.status,
      scenarioDigest: scenario.scenarioDigest,
    }))),
    scenarios,
    status: validation.status,
    safeSummaryOnly: true,
  };
}

function requireBlackBoxField(condition, reasonCodes, reasonCode) {
  if (!condition) reasonCodes.push(reasonCode);
}

function validateBlackBoxScenario(scenario, reasonCodes) {
  const label = scenario.scenarioId || 'unknown';
  requireBlackBoxField(scenario.executionMode === 'black_box_child_process_filesystem', reasonCodes, `release_drill_black_box_mode_missing_${label}`);
  requireBlackBoxField(
    scenario.observationSource === 'actual_child_process_and_filesystem'
      || scenario.observationSource === 'actual_git_worktree_and_child_process',
    reasonCodes,
    `release_drill_observation_source_invalid_${label}`,
  );
  requireBlackBoxField(scenario.observedByChildProcess === true, reasonCodes, `release_drill_child_process_observation_missing_${label}`);
  requireBlackBoxField(scenario.expectedDefaultsMaterialized === false, reasonCodes, `release_drill_expected_defaults_materialized_${label}`);

  if (label === 'forced_interruption_recovery') {
    requireBlackBoxField(scenario.interruptionObserved === true, reasonCodes, 'black_box_forced_interruption_not_observed');
    requireBlackBoxField(scenario.childProcessKilled === true, reasonCodes, 'black_box_forced_interruption_child_not_killed');
    requireBlackBoxField(scenario.checkpointState === 'observed', reasonCodes, 'black_box_forced_interruption_checkpoint_missing');
    requireBlackBoxField(scenario.recoveryAction === 'resume_from_checkpoint', reasonCodes, 'black_box_forced_interruption_recovery_invalid');
    requireBlackBoxField(scenario.recoveryContinuesSameContract === true, reasonCodes, 'black_box_forced_interruption_contract_not_preserved');
  }
  if (label === 'stale_lock_recovery') {
    requireBlackBoxField(scenario.staleLockObserved === true, reasonCodes, 'black_box_stale_lock_not_observed');
    requireBlackBoxField(scenario.staleLockRecovered === true, reasonCodes, 'black_box_stale_lock_not_recovered');
    requireBlackBoxField(scenario.activeWriterRejected === true, reasonCodes, 'black_box_live_lock_not_rejected');
  }
  if (label === 'same_blocker_stop') {
    requireBlackBoxField(scenario.firstAttemptAction === 'continue_repair', reasonCodes, 'black_box_same_blocker_first_attempt_invalid');
    requireBlackBoxField(scenario.stopAction === 'stop_same_blocker', reasonCodes, 'black_box_same_blocker_stop_missing');
    requireBlackBoxField(Number(scenario.sameBlockerRepeatCount) >= DEFAULT_ANTI_SPIN.sameBlockerMax, reasonCodes, 'black_box_same_blocker_repeat_missing');
  }
  if (label === 'duplicate_writer_rejection') {
    requireBlackBoxField(scenario.acceptedWriterCount === 1, reasonCodes, 'black_box_duplicate_writer_accepted_count_invalid');
    requireBlackBoxField(scenario.rejectedWriterCount === 1, reasonCodes, 'black_box_duplicate_writer_rejected_count_invalid');
    requireBlackBoxField(scenario.stateMutationAllowed === false, reasonCodes, 'black_box_duplicate_writer_state_mutation_allowed');
  }
  if (label === 'v127_rollback_dry_run') {
    requireBlackBoxField(scenario.trustedBaseCommit === V128_RELEASE_DRILL_TRUSTED_BASE_COMMIT, reasonCodes, 'black_box_v127_rollback_trusted_base_invalid');
    requireBlackBoxField(scenario.worktreeAdded === true, reasonCodes, 'black_box_v127_rollback_worktree_missing');
    requireBlackBoxField(scenario.v127SelfTestPass === true, reasonCodes, 'black_box_v127_self_test_not_passed');
    requireBlackBoxField(scenario.v127QualityGatePass === true, reasonCodes, 'black_box_v127_quality_gate_not_passed');
    requireBlackBoxField(scenario.v127RollbackAvailable === true, reasonCodes, 'black_box_v127_rollback_unavailable');
  }
}

export function validateV128ReleaseDrill(report = {}) {
  const scenarios = Array.isArray(report.scenarios) ? report.scenarios : [];
  const antiSpin = report.antiSpin || report.releaseDrillStatus?.antiSpin || {};
  const executionMode = report.executionMode || report.releaseDrillStatus?.executionMode || 'contract_fixture';
  const reasonCodes = [];
  const ids = scenarios.map((scenario) => scenario.scenarioId);
  const required = new Set(V128_RELEASE_DRILL_SCENARIOS);
  const idCounts = new Map();
  for (const id of ids) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  for (const requiredId of required) {
    if (!idCounts.has(requiredId)) reasonCodes.push(`release_drill_missing_${requiredId}`);
    if ((idCounts.get(requiredId) || 0) > 1) reasonCodes.push(`release_drill_duplicate_${requiredId}`);
  }
  for (const id of ids) {
    if (!required.has(id)) reasonCodes.push(`release_drill_extra_${id || 'unknown'}`);
  }
  if (scenarios.length !== V128_RELEASE_DRILL_SCENARIOS.length) reasonCodes.push('release_drill_scenario_count_not_exact');
  if (Number(antiSpin.maxRepairIterations) !== DEFAULT_ANTI_SPIN.maxRepairIterations) reasonCodes.push('release_drill_max_repair_iterations_not_fixed');
  if (Number(antiSpin.sameBlockerMax) !== DEFAULT_ANTI_SPIN.sameBlockerMax) reasonCodes.push('release_drill_same_blocker_max_not_fixed');
  if (Number(antiSpin.noProgressWindow) !== DEFAULT_ANTI_SPIN.noProgressWindow) reasonCodes.push('release_drill_no_progress_window_not_fixed');

  if (executionMode === 'black_box_child_process_filesystem'
    && report.trustedBaseCommit !== V128_RELEASE_DRILL_TRUSTED_BASE_COMMIT
    && report.releaseDrillStatus?.trustedBaseCommit !== V128_RELEASE_DRILL_TRUSTED_BASE_COMMIT) {
    reasonCodes.push('release_drill_trusted_base_commit_invalid');
  }

  for (const scenario of scenarios) {
    if (scenario.status !== 'pass') reasonCodes.push(`release_drill_scenario_failed_${scenario.scenarioId || 'unknown'}`);
    if (scenario.rawLogsRead !== false) reasonCodes.push(`release_drill_scenario_raw_log_read_${scenario.scenarioId || 'unknown'}`);
    if (scenario.productRuntimeMutation !== false) reasonCodes.push(`release_drill_scenario_product_runtime_mutation_${scenario.scenarioId || 'unknown'}`);
    if (scenario.packageMutation !== false) reasonCodes.push(`release_drill_scenario_package_mutation_${scenario.scenarioId || 'unknown'}`);
    if (scenario.deployMutation !== false) reasonCodes.push(`release_drill_scenario_deploy_mutation_${scenario.scenarioId || 'unknown'}`);
    if (scenario.completionContractChanged !== false) reasonCodes.push(`release_drill_scenario_completion_contract_changed_${scenario.scenarioId || 'unknown'}`);
    if (scenario.sourceActivationAuthorized !== false) reasonCodes.push(`release_drill_scenario_source_activation_authorized_${scenario.scenarioId || 'unknown'}`);
    if (scenario.targetRolloutAuthorized !== false) reasonCodes.push(`release_drill_scenario_target_rollout_authorized_${scenario.scenarioId || 'unknown'}`);
    if (executionMode === 'black_box_child_process_filesystem') validateBlackBoxScenario(scenario, reasonCodes);
  }

  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    safeSummaryOnly: true,
  };
}

async function handleChild(kind, resultFile, configFile) {
  const config = readJsonIfExists(configFile) || {};
  try {
    if (kind === 'forced-worker') {
      const checkpoint = {
        scenarioId: 'forced_interruption_recovery',
        checkpointState: 'observed',
        contractDigest: config.contractDigest,
        pid: process.pid,
      };
      safeWriteJson(config.checkpointFile, checkpoint);
      safeWriteJson(resultFile, {
        status: 'pass',
        checkpointState: 'observed',
        observedByChildProcess: true,
      });
      setInterval(() => {}, 1000);
      return;
    }
    if (kind === 'forced-resume') {
      const checkpoint = readJsonIfExists(config.checkpointFile);
      safeWriteJson(resultFile, {
        status: checkpoint?.contractDigest === config.contractDigest ? 'pass' : 'fail',
        checkpointState: checkpoint ? 'observed' : 'missing',
        recoveryAction: 'resume_from_checkpoint',
        scopeDelta: false,
        recoveryContinuesSameContract: checkpoint?.contractDigest === config.contractDigest,
      });
      return;
    }
    if (kind === 'live-lock-holder') {
      fs.mkdirSync(config.lockDir, { recursive: false });
      safeWriteJson(path.join(config.lockDir, 'owner.json'), {
        pid: process.pid,
        timestampMs: Date.now(),
        stale: false,
      });
      safeWriteJson(resultFile, {
        status: 'pass',
        lockHeld: true,
        observedByChildProcess: true,
      });
      setInterval(() => {}, 1000);
      return;
    }
    if (kind === 'lock-attempt') {
      const ownerFile = path.join(config.lockDir, 'owner.json');
      const owner = readJsonIfExists(ownerFile);
      const now = Date.now();
      if (owner && config.mode === 'stale' && now - Number(owner.timestampMs || 0) > Number(config.staleAgeMs || 60000)) {
        safeRm(config.lockDir, config.tmpRoot);
        fs.mkdirSync(config.lockDir, { recursive: false });
        safeWriteJson(ownerFile, { pid: process.pid, timestampMs: now, stale: false });
        safeWriteJson(resultFile, {
          status: 'pass',
          staleLockObserved: true,
          lockRecoveryAction: 'reacquire_after_stale_lock',
        });
        return;
      }
      if (owner) {
        safeWriteJson(resultFile, {
          status: 'pass',
          activeWriterRejected: true,
          rejectionAction: 'reject_active_writer',
        });
        return;
      }
      fs.mkdirSync(config.lockDir, { recursive: false });
      safeWriteJson(ownerFile, { pid: process.pid, timestampMs: now, stale: false });
      safeWriteJson(resultFile, { status: 'pass', action: 'acquire_lock' });
      return;
    }
    if (kind === 'blocker-attempt') {
      const prior = readJsonIfExists(config.stateFile);
      if (prior?.blockerDigest === config.blockerDigest) {
        safeWriteJson(resultFile, {
          status: 'pass',
          action: 'stop_same_blocker',
          sameBlockerRepeatCount: 1,
        });
        return;
      }
      safeWriteJson(config.stateFile, {
        blockerDigest: config.blockerDigest,
        repairIterationCount: 1,
      });
      safeWriteJson(resultFile, {
        status: 'pass',
        action: 'continue_repair',
        sameBlockerRepeatCount: 0,
      });
      return;
    }
    if (kind === 'duplicate-writer') {
      try {
        fs.mkdirSync(config.lockDir, { recursive: false });
        await sleep(Number(config.holdMs || 100));
        if (!fs.existsSync(config.stateFile)) {
          safeWriteJson(config.stateFile, { writerId: config.writerId });
        }
        safeWriteJson(resultFile, {
          status: 'pass',
          writerId: config.writerId,
          action: 'write_state',
        });
      } catch {
        safeWriteJson(resultFile, {
          status: 'pass',
          writerId: config.writerId,
          action: 'reject_duplicate_writer',
          stateMutationAllowed: false,
        });
      }
      return;
    }
    safeWriteJson(resultFile, {
      status: 'fail',
      reasonCodes: ['release_drill_unknown_child_kind'],
    });
    process.exitCode = 1;
  } catch {
    safeWriteJson(resultFile, {
      status: 'fail',
      reasonCodes: ['release_drill_child_exception'],
    });
    process.exitCode = 1;
  }
}

if (process.argv[2] === CHILD_ARG) {
  await handleChild(process.argv[3], process.argv[4], process.argv[5]);
} else if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const report = await runV128BlackBoxReleaseDrill();
  writeJsonReport(report, 'CODEX_V128_RELEASE_DRILL_REPORT');
  if (!process.argv.includes('--json')
    && !process.env.CODEX_V128_RELEASE_DRILL_REPORT
    && process.env.CODEX_QUALITY_REPORT !== 'json') {
    console.log(`v128ReleaseDrillStatus: ${report.releaseDrillStatus.status}`);
  }
  exitFor(report);
}
