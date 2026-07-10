#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  deriveCanonicalState,
  reobserveSerializedGithubEvidence,
  sha256,
  canonicalJson,
  verifySignedFinalDecisionReceipt,
  V132_VERSION,
} from './codex-v132-evidence-truth.mjs';
import { loadV132Policy, readJsonStrict, validateManifestProjections } from './codex-v132-manifest-compiler.mjs';
import { buildToolchainSummary, collectWorkspaceState, createValidationReceipt, planIncrementalValidation } from './codex-v132-incremental-validation.mjs';
import { executeValidationPlan } from './codex-v132-node-executor.mjs';
import { runV132CompatibilityCheck } from './codex-v132-compatibility-check.mjs';
import {
  buildDecisionCapsuleV3,
  buildOrchestrationReceipt,
  buildSafeSummary,
  evaluateLongRunBudget,
  finalizeCompactOutput,
  planCiCost,
  validateCompatibilityDebtClosure,
  validateFullDiagnostics,
} from './codex-v132-operational-bounds.mjs';

function run(command, args, cwd, accounting) {
  if (accounting) accounting.subprocessExecutions += 1;
  return spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true });
}

function git(args, cwd, fallback = '', accounting) {
  const result = run('git', args, cwd, accounting);
  return result.status === 0 ? String(result.stdout || '').trim() : fallback;
}

function repositoryFromRemote(remote) {
  const match = String(remote || '').replace(/\.git$/i, '').match(/(?:github\.com[/:])([^/]+\/[^/]+)$/i);
  return match?.[1] || 'hiro4649/codex-development-harness';
}

function readWorkflowInputs(repoRoot) {
  const directory = path.join(repoRoot, '.github', 'workflows');
  if (!fs.existsSync(directory)) return {};
  return Object.fromEntries(fs.readdirSync(directory)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort()
    .map((name) => [name, sha256(fs.readFileSync(path.join(directory, name), 'utf8'))]));
}

function evaluateWorkspaceIdentity({ repository, headSha, sourceManifest, repoRoot }) {
  const reasons = [];
  if (repository !== 'hiro4649/codex-development-harness') reasons.push('workspace_repository_mismatch');
  if (!/^[a-f0-9]{40}$/.test(headSha)) reasons.push('workspace_head_invalid');
  if (sourceManifest.activeHarnessVersion !== V132_VERSION) reasons.push('workspace_active_version_mismatch');
  const agents = fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');
  if (!agents.includes('CODEX_QUALITY_HARNESS_FILE v1.3.2')) reasons.push('workspace_agents_marker_missing');
  return { status: reasons.length ? 'fail' : 'pass', reasonCodes: reasons };
}

function readResumeReceipt(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeResumeReceipt(file, receipt, accounting) {
  if (!file) return;
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(receipt)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, target);
  if (accounting) {
    accounting.harnessFileWrites += 1;
    accounting.checkpointCount += 1;
  }
}

function runSelfTest(repoRoot, accounting) {
  if (process.env.CODEX_SKIP_V132_SELF_TEST === '1') return { status: 'pass', skippedByParentSelfTest: true };
  const result = run(process.execPath, ['scripts/codex-v132-self-test.mjs', '--stage=all'], repoRoot, accounting);
  let nestedAccounting = null;
  try {
    nestedAccounting = JSON.parse(String(result.stdout || '')).executionAccounting || null;
  } catch {
    nestedAccounting = null;
  }
  if (accounting && nestedAccounting) {
    accounting.subprocessExecutions += Number(nestedAccounting.subprocessExecutions || 0);
    accounting.harnessFileWrites += Number(nestedAccounting.harnessFileWrites || 0);
    accounting.retryCount += Number(nestedAccounting.retryCount || 0);
    accounting.retryPerNode = Math.max(accounting.retryPerNode, Number(nestedAccounting.retryPerNode || 0));
    accounting.checkpointCount += Number(nestedAccounting.checkpointCount || 0);
  }
  return {
    status: result.status === 0 ? 'pass' : 'fail',
    exitCode: result.status,
    safeExcerpt: String(result.stdout || result.stderr || '').split(/\r?\n/).filter(Boolean).slice(-3).join(' | ').slice(0, 384),
  };
}

export function runV132SourceQualityGate({
  repoRoot = process.cwd(),
  diagnostics = process.env.CODEX_V132_DIAGNOSTICS === '1',
  remoteEvidence = null,
  finalDecisionReceipt = null,
  expectedRemoteEvidence = {},
} = {}) {
  const root = path.resolve(repoRoot);
  const accounting = { subprocessExecutions: 0, harnessFileWrites: 0, retryCount: 0, retryPerNode: 0, checkpointCount: 0 };
  const policy = loadV132Policy(root);
  const sourceManifest = readJsonStrict(path.join(root, 'CODEX_SOURCE_HARNESS_MANIFEST.json'));
  const docsManifest = readJsonStrict(path.join(root, 'docs/process/CODEX_HARNESS_MANIFEST.json'));
  const activePolicy = readJsonStrict(path.join(root, 'docs/process/CODEX_ACTIVE_POLICY_INDEX.json'));
  const projection = validateManifestProjections({ policy, sourceManifest, docsManifest, activePolicy });
  const remote = git(['config', '--get', 'remote.origin.url'], root, '', accounting);
  const repository = repositoryFromRemote(remote);
  const headSha = git(['rev-parse', 'HEAD'], root, '0'.repeat(40), accounting);
  const locallyBoundExpectedEvidence = {
    requiredCheckNames: policy.evidenceTruthKernel?.requiredCheckNames || [],
    ...expectedRemoteEvidence,
    repository,
    headSha,
  };
  const baseSha = policy.provisionalBaseSha;
  const workspaceState = collectWorkspaceState({ repoRoot: root, baseSha, headSha, accounting });
  const changedFiles = workspaceState.changedPaths;
  const workflowInputs = readWorkflowInputs(root);
  const receiptFile = process.env.CODEX_V132_RESUME_RECEIPT_FILE || '';
  const previousReceipt = readResumeReceipt(receiptFile);
  const plan = planIncrementalValidation({
    repository,
    profile: 'source_control_plane',
    baseSha,
    headSha,
    changedFiles,
    policy,
    registry: policy.staticRegistry,
    workflowInputs,
    evidenceReceipt: remoteEvidence,
    workspaceState,
    previousReceipt,
  });
  const debt = validateCompatibilityDebtClosure([{
    mustReviewBefore: V132_VERSION,
    disposition: policy.compatibilityDebtClosure?.legacyTargetGateShape?.disposition,
    reason: policy.compatibilityDebtClosure?.legacyTargetGateShape?.reason,
    silentExtension: policy.compatibilityDebtClosure?.legacyTargetGateShape?.silentExtension,
  }]);
  const rollbackChain = {
    v131: 'immediate_rollback',
    v130: 'secondary_rollback',
    v129: 'emergency_legacy_rollback',
    v128: 'blocking_compatibility',
    v127: 'readable_compatibility',
  };
  const workspaceIdentity = evaluateWorkspaceIdentity({ repository, headSha, sourceManifest, repoRoot: root });
  const execution = executeValidationPlan({
    plan,
    priorCompletedNodes: previousReceipt?.completedNodes || [],
    context: {
      repository,
      headSha,
      workspaceIdentity,
      manifestProjection: projection,
      registryObservation: { status: 'not_observed', digest: plan.digests.observationDigest },
      rollbackChain,
      outputLimits: {
        compactJsonBytes: policy.outputLimits.defaultCompactJsonBytes,
        topLevelFieldCount: policy.outputLimits.topLevelFieldCount,
      },
      executionAccounting: accounting,
      runLocalChecks: () => runSelfTest(root, accounting),
      runCompatibilityChecks: () => {
        const result = runV132CompatibilityCheck({ repoRoot: root, lane: 'all' });
        return {
          status: result.status,
          reasonCodes: result.reasonCodes,
          sourcePresentStatus: result.sourcePresentStatus,
          projectionValidStatus: result.projectionValidStatus,
          behaviorInvariantsStatus: result.behaviorInvariantsStatus,
        };
      },
      deriveCanonicalState: (completed) => {
        const priorRequired = ['workspace_identity', 'manifest_compile', 'changed_file_classification', 'dependency_closure', 'selected_local_checks', 'compatibility_checks'];
        const localPassed = priorRequired.every((nodeId) => completed.get(nodeId)?.status === 'pass');
        return deriveCanonicalState({ localValidationPassed: localPassed, remoteEvidence, finalDecisionReceipt, expected: locallyBoundExpectedEvidence });
      },
      runCiCostPlanning: () => {
        const result = planCiCost({ repoRoot: root, changeClass: plan.classification.changeClass });
        return { ...result, estimatedJobs: result.estimatedJobCount, estimatedWorkflowRuns: result.workflowRunCount };
      },
    },
  });
  const localBlockers = [...execution.failureCodes];
  let measuredUsage = {
    ...execution.budgetUsage,
    toolCalls: accounting.subprocessExecutions,
    subprocessExecutions: accounting.subprocessExecutions,
    fileWrites: accounting.harnessFileWrites,
    retryCount: accounting.retryCount,
    retryPerNode: accounting.retryPerNode,
    checkpointCount: accounting.checkpointCount,
  };
  let longRunBudgetStatus = evaluateLongRunBudget(measuredUsage);
  if (longRunBudgetStatus.status !== 'within_budget') localBlockers.push(...longRunBudgetStatus.reasonCodes);
  if (debt.status !== 'pass') localBlockers.push(...debt.reasonCodes);
  if (sourceManifest.authorityCreated !== false) localBlockers.push('authority_created');
  if (sourceManifest.targetMutationCount !== 0) localBlockers.push('target_mutation_detected');
  if (!localBlockers.length && receiptFile) {
    writeResumeReceipt(receiptFile, createValidationReceipt({ plan, repository, baseSha, headSha, completedNodeResults: execution.completedNodeResults }), accounting);
    measuredUsage = {
      ...measuredUsage,
      toolCalls: accounting.subprocessExecutions,
      subprocessExecutions: accounting.subprocessExecutions,
      fileWrites: accounting.harnessFileWrites,
      checkpointCount: accounting.checkpointCount,
    };
    longRunBudgetStatus = evaluateLongRunBudget(measuredUsage);
    if (longRunBudgetStatus.status !== 'within_budget') localBlockers.push(...longRunBudgetStatus.reasonCodes);
  }
  const evidenceNode = execution.completedNodeResults.find((node) => node.nodeId === 'evidence_truth_projection');
  const canonicalState = evidenceNode?.output
    ? { ...deriveCanonicalState({ localValidationPassed: evidenceNode.output.localValidationState === 'passed', remoteEvidence, finalDecisionReceipt, expected: locallyBoundExpectedEvidence }), ...evidenceNode.output }
    : deriveCanonicalState({ localValidationPassed: false, remoteEvidence, finalDecisionReceipt, expected: locallyBoundExpectedEvidence });
  const selfTestNode = execution.completedNodeResults.find((node) => node.nodeId === 'selected_local_checks');
  const selfTest = selfTestNode?.output || { status: 'fail', reasonCodes: ['selected_local_checks_not_executed'] };
  const nextSafeAction = canonicalState.localValidationState === 'passed'
    ? 'rebase_after_v131_merge_then_obtain_exact_head_remote_evidence'
    : 'repair_smallest_local_source_blocker';
  const decisionCapsuleV3 = buildDecisionCapsuleV3({ repository, headSha, canonicalState, blockerCodes: localBlockers, nextSafeAction });
  const safeSummary = buildSafeSummary({ repository, headSha, canonicalState, blockerCodes: localBlockers, nextSafeAction });
  const orchestrationReceipt = buildOrchestrationReceipt({ plan, execution, repository, baseSha, headSha });
  const ciCostPlan = planCiCost({ repoRoot: root, changeClass: plan.classification.changeClass });
  const validationCoverageNodes = execution.completedNodeResults
    .map(({ nodeId, status, outputDigest }) => ({ nodeId, status, outputDigest }))
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const validationCoverage = {
    derivation: 'executed_or_attested_node_output_digests',
    nodeCount: validationCoverageNodes.length,
    coverageDigest: sha256(canonicalJson(validationCoverageNodes)),
  };
  const report = {
    schemaVersion: V132_VERSION,
    harnessName: 'HARNESS v1.3.2 Evidence-Converged Lean Core',
    repository,
    baseSha,
    headSha,
    status: localBlockers.length ? 'fail' : 'pass',
    localValidationState: canonicalState.localValidationState,
    remoteValidationState: canonicalState.remoteValidationState,
    technicalMergeEligibility: canonicalState.technicalMergeEligibility,
    finalDecisionState: canonicalState.finalDecisionState,
    mergeAllowed: canonicalState.mergeAllowed,
    remoteEvidenceStatus: canonicalState.remoteEvidence?.status || 'not_observed',
    sameHeadState: canonicalState.remoteEvidence?.sameHeadState || 'not_observed',
    requiredCheckSetState: canonicalState.remoteEvidence?.requiredCheckSetState || 'not_observed',
    artifactIntegrityState: canonicalState.remoteEvidence?.artifactIntegrityState || 'not_observed',
    finalDecisionEvidenceStatus: canonicalState.finalDecisionEvidence?.status || 'not_observed',
    deprecatedLocalTechnicalReady: canonicalState.deprecatedLocalTechnicalReady,
    legacyLocalQualityScore: { value: localBlockers.length ? 70 : 100, authority: false },
    blockingCount: localBlockers.length,
    blockerCodes: localBlockers.slice(0, 16),
    nextSafeAction,
    selectedNodeCount: plan.selectedNodeCount,
    skippedNodeCount: plan.skippedNodeCount,
    executedNodeCount: execution.executedNodeCount,
    reusedNodeCount: execution.reusedNodeCount,
    executionAttestationStatus: {
      status: execution.status,
      executorVersion: execution.executorVersion,
      executedNodeCount: execution.executedNodeCount,
      reusedNodeCount: execution.reusedNodeCount,
      authority: false,
    },
    exactHeadNodeSkipRate: plan.exactHeadNodeSkipRate,
    changeClass: plan.classification.changeClass,
    v132SelfTestStatus: selfTest,
    manifestProjectionStatus: { status: projection.status, classifiedRepositoryCount: projection.registryStatus.classifiedRepositoryCount },
    compatibilityDebtStatus: debt,
    longRunBudgetStatus,
    executionAccounting: measuredUsage,
    validationCoverage,
    ciCostPlan,
    decisionCapsuleV3,
    safeSummary,
    orchestrationReceipt,
    outputMetrics: {
      decisionCapsuleBytes: Buffer.byteLength(JSON.stringify(decisionCapsuleV3), 'utf8'),
      safeSummaryBytes: Buffer.byteLength(JSON.stringify(safeSummary), 'utf8'),
      orchestrationReceiptBytes: Buffer.byteLength(JSON.stringify(orchestrationReceipt), 'utf8'),
    },
    authorityCreated: false,
    targetMutationCount: 0,
    automaticTargetMutation: false,
    PerformanceTrack: 'deferred',
    superiorityClaimState: 'not_proven',
    remoteUnobservedPassCount: 0,
    rawLogsStored: false,
    fullConversationReplay: false,
  };
  finalizeCompactOutput(report);
  if (diagnostics) {
    report.fullDiagnostics = {
      status: 'opt_in',
      changedFiles,
      projection,
      plan,
      execution,
      toolchain: buildToolchainSummary(),
      policyDigest: sha256(canonicalJson(policy)),
      authority: false,
    };
    report.fullDiagnosticsValidation = validateFullDiagnostics(report.fullDiagnostics);
    validateFullDiagnostics(report);
  }
  return { report, exitCode: localBlockers.length ? 1 : 0 };
}

export async function runV132SourceQualityGateWithDurableEvidence(options = {}) {
  let remoteEvidence = options.remoteEvidence || null;
  let finalDecisionReceipt = options.finalDecisionReceipt || null;
  let expectedRemoteEvidence = { ...(options.expectedRemoteEvidence || {}) };
  const remoteReceiptFile = process.env.CODEX_V132_REMOTE_RECEIPT_FILE || '';
  if (!remoteEvidence && remoteReceiptFile) {
    const serialized = JSON.parse(fs.readFileSync(path.resolve(remoteReceiptFile), 'utf8'));
    remoteEvidence = await reobserveSerializedGithubEvidence(serialized, { token: process.env.GITHUB_TOKEN });
    expectedRemoteEvidence = {
      ...expectedRemoteEvidence,
      requiredCheckSetDigest: remoteEvidence.requiredCheckSetDigest,
      artifactDigest: remoteEvidence.artifactDigest,
    };
  }
  const finalReceiptFile = process.env.CODEX_V132_FINAL_DECISION_RECEIPT_FILE || '';
  if (!finalDecisionReceipt && finalReceiptFile) {
    const publicKeyFile = process.env.CODEX_V132_FINAL_DECISION_PUBLIC_KEY_FILE || '';
    if (!publicKeyFile) throw new Error('final_decision_public_key_file_required');
    const serialized = JSON.parse(fs.readFileSync(path.resolve(finalReceiptFile), 'utf8'));
    finalDecisionReceipt = verifySignedFinalDecisionReceipt(serialized, { publicKeyPem: fs.readFileSync(path.resolve(publicKeyFile), 'utf8') });
  }
  return runV132SourceQualityGate({ ...options, remoteEvidence, finalDecisionReceipt, expectedRemoteEvidence });
}

function printResult(result) {
  if (process.env.CODEX_QUALITY_REPORT === 'json') process.stdout.write(`${JSON.stringify(result.report)}\n`);
  else {
    console.log(`status: ${result.report.status}`);
    console.log(`localValidationState: ${result.report.localValidationState}`);
    console.log(`remoteValidationState: ${result.report.remoteValidationState}`);
    console.log(`mergeAllowed: ${result.report.mergeAllowed}`);
    console.log(`nextSafeAction: ${result.report.nextSafeAction}`);
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const result = await runV132SourceQualityGateWithDurableEvidence();
  printResult(result);
  process.exitCode = result.exitCode;
}
