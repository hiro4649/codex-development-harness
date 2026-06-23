#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import { canonicalJson, computeGoalDigest, sha256 } from './codex-v129-goal-contract.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyGoalTask } from './codex-v129-task-classifier.mjs';
import { defaultTestRegistry, digestRegistry, routeCapability } from './codex-v129-capability-router.mjs';
import { selectPlugins } from './codex-v129-plugin-broker.mjs';
import { buildDispatchRequest, digestFile, dispatchHost } from './codex-v129-host-dispatch.mjs';
import { computeWorkspaceTreeDigest } from './codex-v129-independent-verifier.mjs';
import { buildGoalCompletionProof } from './codex-v129-goal-finalizer.mjs';

function digest(value) {
  return `sha256:${sha256(canonicalJson(value))}`;
}

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function git(args, cwd = repoRoot()) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 10000, maxBuffer: 16384 }).trim();
}

function makeShadowWorktree(prefix, candidateHeadSha) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.rmSync(root, { recursive: true, force: true });
  git(['worktree', 'add', '--quiet', '--detach', root, candidateHeadSha]);
  return root;
}

function removeShadowWorktree(root) {
  if (!root) return;
  try {
    git(['worktree', 'remove', '--force', root]);
  } catch {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function currentHead() {
  return git(['rev-parse', 'HEAD']);
}

function fileDigest(relativePath) {
  return `sha256:${sha256(fs.readFileSync(path.join(repoRoot(), relativePath)))}`;
}

function fixtureGoal() {
  const headSha = currentHead();
  const goal = {
    goalId: 'goal-v129-shadow-fixture',
    goalVersion: 1,
    taskClass: 'code_change',
    truthOwnerRefs: [{ path: 'docs/process/CODEX_V129_SPEC.md', digest: fileDigest('docs/process/CODEX_V129_SPEC.md') }],
    desiredEndState: 'Run v129 shadow fixture without changing active authority.',
    acceptanceCriteria: [{ id: 'AC1', description: 'shadow completion proof passes', required: true }],
    constraints: ['No active version change.'],
    nonGoals: ['No merge authority.'],
    allowedFiles: ['scripts/codex-v129-shadow-runner.mjs'],
    forbiddenFiles: ['scripts/codex-final-decision-kernel.mjs'],
    evidencePlan: ['fixture safe JSON only'],
    killCriteria: ['stop once'],
    repairBudget: { maxRepairIterations: 1, sameBlockerMax: 1 },
    binding: {
      repositoryId: 1243452288,
      baseSha: headSha,
      scopeDigest: `sha256:${'b'.repeat(64)}`,
    },
    candidateHeadSha: headSha,
    goalDigest: 'placeholder',
  };
  goal.goalDigest = computeGoalDigest(goal);
  return goal;
}

export function runV129ShadowFixture(env = process.env) {
  if (env.CODEX_V129_SHADOW !== '1') {
    return {
      schemaVersion: '1.2.9',
      status: 'blocked',
      reasonCodes: ['v129_shadow_env_missing'],
      activeOutputChanged: false,
      safeSummaryOnly: true,
    };
  }
  const goal = fixtureGoal();
  const classification = classifyGoalTask(goal);
  const registry = defaultTestRegistry();
  const registryDigest = digestRegistry(registry);
  const routingEnv = {
    ...env,
    CODEX_V129_CAPABILITY_REGISTRY_JSON: canonicalJson(registry),
    CODEX_V129_TRUSTED_CAPABILITY_REGISTRY_DIGEST: registryDigest,
  };
  const routeDecision = routeCapability(classification, routingEnv);
  const pluginDecision = selectPlugins(classification, routeDecision, routingEnv);
  const adapterPath = new URL('./codex-v129-fixture-host-adapter.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const adapterDigest = digestFile(adapterPath);
  const dispatchRequest = buildDispatchRequest({
    goalDigest: goal.goalDigest,
    classificationDigest: classification.classificationDigest,
    routeDecisionDigest: routeDecision.routeDecisionDigest,
    registryDigest: routeDecision.registryDigest,
    capabilityClass: routeDecision.capabilityClass,
    resolvedModelRef: routeDecision.resolvedModelRef,
    pluginRefs: pluginDecision.selectedPluginIds,
    safeInput: { goalDigest: goal.goalDigest, classificationDigest: classification.classificationDigest },
    maxOutputBytes: routeDecision.maxOutputBytes,
    timeoutMs: 5000,
    workspaceDigest: `sha256:${'c'.repeat(64)}`,
  });
  const dispatch = dispatchHost(dispatchRequest, {
    ...routingEnv,
    CODEX_V129_TEST_MODE: '1',
    CODEX_V129_HOST_ADAPTER_PATH: adapterPath,
    CODEX_V129_TRUSTED_HOST_ADAPTER_DIGEST: adapterDigest,
  });
  const workerReceiptDigest = digest(dispatch.invocationReceipt || {});
  const evidence = {
    schemaVersion: '1.2.9',
    goalDigest: goal.goalDigest,
    routeDecisionDigest: routeDecision.routeDecisionDigest,
    invocationReceiptDigest: workerReceiptDigest,
  };
  const evidenceDigest = digest(evidence);
  const workerWorkspacePath = makeShadowWorktree('v129-worker-', goal.candidateHeadSha);
  const verifierWorkspacePath = makeShadowWorktree('v129-verifier-', goal.candidateHeadSha);
  let report;
  const verifierInput = {
    schemaVersion: '1.2.9',
    workerId: 'worker-a',
    verifierId: 'verifier-b',
    workerWorkspacePath,
    verifierWorkspacePath,
    workerWorkspaceDigest: computeWorkspaceTreeDigest(workerWorkspacePath),
    verifierWorkspaceDigest: computeWorkspaceTreeDigest(verifierWorkspacePath),
    candidateHeadSha: goal.candidateHeadSha,
    goalDigest: goal.goalDigest,
    goalContract: goal,
    workerReceipt: dispatch.invocationReceipt || {},
    workerReceiptDigest,
    evidence,
    evidenceDigest,
    worker: {
      goalDigest: goal.goalDigest,
      candidateHeadSha: goal.candidateHeadSha,
      routeDecisionDigest: routeDecision.routeDecisionDigest,
      workerOutputDigest: dispatch.invocationReceipt?.workerOutputDigest,
    },
    verifier: {
      goalDigest: goal.goalDigest,
      candidateHeadSha: goal.candidateHeadSha,
      routeDecisionDigest: routeDecision.routeDecisionDigest,
      workerOutputDigest: dispatch.invocationReceipt?.workerOutputDigest,
    },
    criteriaResults: [{ id: 'AC1', required: true, status: 'pass', evidenceDigest: workerReceiptDigest }],
    verifierMergeAuthority: false,
  };
  const verifierStdout = execFileSync(process.execPath, [fileURLToPath(new URL('./codex-v129-independent-verifier.mjs', import.meta.url))], {
    input: canonicalJson(verifierInput),
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 8192,
    env: { CODEX_QUALITY_REPORT: 'json' },
  });
  const verifier = JSON.parse(verifierStdout);
  const verifierReceiptDigest = digest(verifier);
  const truthOwnerDigest = digest(goal.truthOwnerRefs);
  const v129ShadowPointer = {
    candidateHarnessVersion: '1.2.9',
    candidateActivationState: 'source_shadow_candidate',
    goalDigest: goal.goalDigest,
    routeDecisionDigest: routeDecision.routeDecisionDigest,
    workerReceiptDigest,
    verifierReceiptDigest,
    evidenceDigest,
  };
  const finalizer = buildGoalCompletionProof({
    goalContract: goal,
    goalDigest: goal.goalDigest,
    candidateHeadSha: goal.candidateHeadSha,
    baseSha: goal.binding.baseSha,
    scopeDigest: goal.binding.scopeDigest,
    truthOwnerDigest,
    routeDecisionDigest: routeDecision.routeDecisionDigest,
    workerReceipt: dispatch.invocationReceipt || {},
    workerReceiptDigest,
    verifierReceipt: verifier,
    verifierReceiptDigest,
    evidence,
    evidenceDigest,
    criteriaResults: verifierInput.criteriaResults,
    headBindings: [goal.candidateHeadSha, goal.candidateHeadSha, goal.candidateHeadSha],
    validatedWorkerReceipt: { status: dispatch.status, digest: workerReceiptDigest },
    independentVerifier: { status: verifier.status, digest: verifierReceiptDigest },
    repairIterationCount: 0,
    sameBlockerCount: 0,
    tokenBudget: { usedBytes: Buffer.byteLength(canonicalJson(verifier), 'utf8'), maxBytes: 4096 },
  });
  const statuses = [classification, routeDecision, pluginDecision, dispatch, verifier, finalizer];
  const reasonCodes = statuses.flatMap((item) => item.reasonCodes || []);
  report = {
    schemaVersion: '1.2.9',
    candidateHarnessVersion: '1.2.9',
    candidateActivationState: 'source_shadow_candidate',
    sourceActivation: 'forbidden',
    targetRollout: 'forbidden',
    goalRef: { goalId: goal.goalId, goalVersion: goal.goalVersion, goalDigest: goal.goalDigest },
    classificationDigest: classification.classificationDigest,
    routeDecisionDigest: routeDecision.routeDecisionDigest,
    v129ShadowPointer,
    routingState: routeDecision.status === 'pass' ? 'routed' : 'blocked',
    invocationReceiptDigest: workerReceiptDigest,
    verifierReceiptDigest,
    goalCompletionProofSummary: {
      completionState: finalizer.goalCompletionProof.completionState,
      proofDigest: finalizer.goalCompletionProof.proofDigest,
      unresolvedCriterionCount: finalizer.goalCompletionProof.unresolvedCriterionCount,
      safeNextAction: finalizer.goalCompletionProof.safeNextAction,
      authorityCreated: false,
    },
    verifierWorkspace: {
      workerVerifierDistinctGitWorktrees: path.resolve(workerWorkspacePath) !== path.resolve(verifierWorkspacePath),
      workerHeadSha: verifier.recomputed?.workerCandidateHeadSha || null,
      verifierHeadSha: verifier.recomputed?.verifierCandidateHeadSha || null,
      workerTreeSha: verifier.recomputed?.workerTreeSha || null,
      verifierTreeSha: verifier.recomputed?.verifierTreeSha || null,
    },
    invocationState: {
      actualModelReceiptState: dispatch.invocationReceipt?.fixture === true ? 'unavailable_fixture_only' : 'observed',
      actualPluginReceiptState: (dispatch.invocationReceipt?.pluginRefs || []).length ? 'observed' : 'unavailable_not_selected',
    },
    tokenBudgetStatus: { status: Buffer.byteLength(canonicalJson(finalizer.goalCompletionProof), 'utf8') <= 4096 ? 'pass' : 'fail' },
    activeOutputChanged: false,
    authorityCreated: false,
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    safeSummaryOnly: true,
  };
  removeShadowWorktree(workerWorkspacePath);
  removeShadowWorktree(verifierWorkspacePath);
  return report;
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const report = runV129ShadowFixture(process.env);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.status === 'pass' ? 0 : 1);
}
