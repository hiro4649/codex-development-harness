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

function makeShadowWorkspace(prefix, candidateHeadSha, extraFileName) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.writeFileSync(path.join(root, 'CANDIDATE_HEAD'), `${candidateHeadSha}\n`);
  fs.writeFileSync(path.join(root, extraFileName), `${prefix}:${candidateHeadSha}\n`);
  return root;
}

function fixtureGoal() {
  const goal = {
    goalId: 'goal-v129-shadow-fixture',
    goalVersion: 1,
    taskClass: 'code_change',
    truthOwnerRefs: [{ path: 'docs/process/CODEX_V129_SPEC.md', digest: `sha256:${'a'.repeat(64)}` }],
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
      baseSha: '8e74e8d4843dea7ca41bfc50d2e66ad9079fc87d',
      scopeDigest: `sha256:${'b'.repeat(64)}`,
    },
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
  const workerWorkspacePath = makeShadowWorkspace('v129-worker-', goal.binding.baseSha, 'worker-proof.json');
  const verifierWorkspacePath = makeShadowWorkspace('v129-verifier-', goal.binding.baseSha, 'verifier-proof.json');
  const verifierInput = {
    schemaVersion: '1.2.9',
    workerId: 'worker-a',
    verifierId: 'verifier-b',
    workerWorkspacePath,
    verifierWorkspacePath,
    workerWorkspaceDigest: computeWorkspaceTreeDigest(workerWorkspacePath),
    verifierWorkspaceDigest: computeWorkspaceTreeDigest(verifierWorkspacePath),
    candidateHeadSha: goal.binding.baseSha,
    goalDigest: goal.goalDigest,
    goalContract: goal,
    workerReceipt: dispatch.invocationReceipt || {},
    workerReceiptDigest,
    evidence,
    evidenceDigest,
    worker: {
      goalDigest: goal.goalDigest,
      candidateHeadSha: goal.binding.baseSha,
      routeDecisionDigest: routeDecision.routeDecisionDigest,
      workerOutputDigest: dispatch.invocationReceipt?.workerOutputDigest,
    },
    verifier: {
      goalDigest: goal.goalDigest,
      candidateHeadSha: goal.binding.baseSha,
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
  const finalizer = buildGoalCompletionProof({
    goalContract: goal,
    goalDigest: goal.goalDigest,
    candidateHeadSha: goal.binding.baseSha,
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
    headBindings: [goal.binding.baseSha, goal.binding.baseSha, goal.binding.baseSha],
    repairIterationCount: 0,
    sameBlockerCount: 0,
    tokenBudget: { usedBytes: Buffer.byteLength(canonicalJson(verifier), 'utf8'), maxBytes: 4096 },
  });
  const statuses = [classification, routeDecision, pluginDecision, dispatch, verifier, finalizer];
  const reasonCodes = statuses.flatMap((item) => item.reasonCodes || []);
  return {
    schemaVersion: '1.2.9',
    candidateHarnessVersion: '1.2.9',
    candidateActivationState: 'source_shadow_candidate',
    sourceActivation: 'forbidden',
    targetRollout: 'forbidden',
    goalRef: { goalId: goal.goalId, goalVersion: goal.goalVersion, goalDigest: goal.goalDigest },
    classificationDigest: classification.classificationDigest,
    routeDecisionDigest: routeDecision.routeDecisionDigest,
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
    tokenBudgetStatus: { status: Buffer.byteLength(canonicalJson(finalizer.goalCompletionProof), 'utf8') <= 4096 ? 'pass' : 'fail' },
    activeOutputChanged: false,
    authorityCreated: false,
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const report = runV129ShadowFixture(process.env);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.status === 'pass' ? 0 : 1);
}
