#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  deriveCanonicalState,
  collectAcceptedMainTrustRoot,
  reobserveSerializedGithubEvidence,
  sha256,
  canonicalJson,
  verifySignedFinalDecisionReceipt,
  V132_VERSION,
} from './codex-v132-evidence-truth.mjs';
import { deriveCandidateLifecycleState, loadV132Policy, readJsonStrict, validateManifestProjections } from './codex-v132-manifest-compiler.mjs';
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

export function repositoryFromRemote(remote) {
  const value = String(remote || '').trim();
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return null;
  let owner = '';
  let repository = '';
  const scp = value.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (scp) {
    [, owner, repository] = scp;
  } else {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      return null;
    }
    if (!['https:', 'ssh:'].includes(parsed.protocol) || parsed.hostname.toLowerCase() !== 'github.com') return null;
    if (parsed.search || parsed.hash || (parsed.username && parsed.protocol === 'https:') || parsed.password) return null;
    const segments = parsed.pathname.replace(/\/$/, '').replace(/\.git$/i, '').split('/').filter(Boolean);
    if (segments.length !== 2) return null;
    [owner, repository] = segments;
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repository)) return null;
  return `${owner}/${repository}`;
}

function readWorkflowInputs(repoRoot) {
  const directory = path.join(repoRoot, '.github', 'workflows');
  if (!fs.existsSync(directory)) return {};
  return Object.fromEntries(fs.readdirSync(directory)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort()
    .map((name) => [name, sha256(fs.readFileSync(path.join(directory, name), 'utf8'))]));
}

function comparableRealPath(value) {
  try {
    const normalized = fs.realpathSync.native(path.resolve(value)).replaceAll('\\', '/').replace(/\/$/, '');
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
  } catch {
    return null;
  }
}

export function evaluateWorkspaceIdentity({
  repository,
  remote,
  headSha,
  baseSha,
  baseShaExists,
  gitTopLevel,
  sourceManifest,
  repoRoot,
}) {
  const reasons = [];
  if (!remote) reasons.push('workspace_origin_missing');
  if (remote && !repository) reasons.push('workspace_origin_malformed_or_unsupported');
  if (repository !== 'hiro4649/codex-development-harness') reasons.push('workspace_repository_mismatch');
  if (!/^[a-f0-9]{40}$/.test(headSha)) reasons.push('workspace_head_invalid');
  if (!/^[a-f0-9]{40}$/.test(String(baseSha || '')) || baseShaExists !== true) reasons.push('workspace_base_invalid_or_missing');
  const expectedTopLevel = comparableRealPath(repoRoot);
  const observedTopLevel = comparableRealPath(gitTopLevel || '');
  if (!expectedTopLevel || !observedTopLevel || expectedTopLevel !== observedTopLevel) reasons.push('workspace_git_top_level_mismatch');
  if (sourceManifest.activeHarnessVersion !== V132_VERSION) reasons.push('workspace_active_version_mismatch');
  const agents = fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');
  if (!agents.includes('CODEX_QUALITY_HARNESS_FILE v1.3.2')) reasons.push('workspace_agents_marker_missing');
  if (sourceManifest.marker !== 'CODEX_QUALITY_HARNESS_FILE v1.3.2') reasons.push('workspace_source_manifest_marker_missing');
  return { status: reasons.length ? 'fail' : 'pass', reasonCodes: reasons };
}

export function evaluateObservedWorkspaceScope(workspaceState = {}, observedProductMutationCount = 0, { allowDirtyFixture = false } = {}) {
  const reasons = [];
  if (workspaceState.worktreeState !== 'clean' && allowDirtyFixture !== true) reasons.push('workspace_uncommitted_state_forbidden');
  if (observedProductMutationCount > 0) reasons.push('source_scope_product_mutation_detected');
  return { status: reasons.length ? 'fail' : 'pass', reasonCodes: reasons, observedProductMutationCount };
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
  allowDirtyFixture = false,
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
  const gitTopLevel = git(['rev-parse', '--show-toplevel'], root, '', accounting);
  const eventName = process.env.CODEX_EVENT_NAME || 'local';
  const suppliedBaseSha = String(process.env.CODEX_PR_BASE_SHA || '').toLowerCase();
  const baseSha = suppliedBaseSha || policy.provisionalBaseSha;
  const baseShaExists = run('git', ['cat-file', '-e', `${baseSha}^{commit}`], root, accounting).status === 0;
  const baseApplicability = eventName === 'workflow_dispatch' ? 'not_applicable' : 'required';
  const baseAncestryState = baseApplicability === 'not_applicable'
    ? 'not_applicable'
    : baseShaExists && run('git', ['merge-base', '--is-ancestor', baseSha, headSha], root, accounting).status === 0
      ? 'matched'
      : 'mismatch';
  const locallyBoundExpectedEvidence = {
    ...expectedRemoteEvidence,
    repository,
    baseSha,
    headSha,
    baseAncestryState,
  };
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
  const workspaceIdentity = evaluateWorkspaceIdentity({
    repository,
    remote,
    headSha,
    baseSha,
    baseShaExists,
    gitTopLevel,
    sourceManifest,
    repoRoot: root,
  });
  if (baseApplicability === 'required' && baseAncestryState !== 'matched') {
    workspaceIdentity.status = 'fail';
    workspaceIdentity.reasonCodes.push('v132_workflow_base_not_ancestor_of_head');
  }
  const observedProductMutationCount = plan.classification.unknownPaths.length;
  const workspaceScope = evaluateObservedWorkspaceScope(workspaceState, observedProductMutationCount, { allowDirtyFixture });
  if (workspaceScope.status !== 'pass') {
    workspaceIdentity.status = 'fail';
    workspaceIdentity.reasonCodes.push(...workspaceScope.reasonCodes);
  }
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
  const candidateLifecycleState = deriveCandidateLifecycleState(canonicalState);
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
    declared: {
      acceptedMainVersion: policy.acceptedMainVersion,
      developmentParentVersion: policy.developmentParentVersion,
      candidateVersion: policy.candidateVersion,
      executionHarnessVersion: policy.executionHarnessVersion,
      candidateLifecycleState: policy.candidateLifecycleState,
      targetRolloutState: policy.targetRolloutState,
      targetMutationCount: sourceManifest.targetMutationCount,
    },
    observed: {
      repository,
      baseSha,
      observedBaseSha: canonicalState.observedBaseSha,
      baseApplicability,
      baseAncestryState: canonicalState.baseAncestryState,
      headSha,
      workspaceStateDigest: workspaceState.workspaceStateDigest,
      worktreeState: workspaceState.worktreeState,
      committedChangedPathCount: workspaceState.committedChangedPathCount,
      uncommittedChangedPathCount: workspaceState.stagedChangedPathCount + workspaceState.unstagedChangedPathCount + workspaceState.untrackedPathCount,
      productMutationCount: observedProductMutationCount,
      source: 'git_content_addressed_workspace_observation',
    },
    validation: {
      localValidationState: canonicalState.localValidationState,
      remoteValidationState: canonicalState.remoteValidationState,
      executionAttestationState: execution.status,
      compatibilityState: execution.completedNodeResults.find((node) => node.nodeId === 'compatibility_checks')?.status || 'not_observed',
    },
    decision: {
      technicalMergeEligibility: canonicalState.technicalMergeEligibility,
      finalDecisionState: canonicalState.finalDecisionState,
      mergeAllowed: canonicalState.mergeAllowed,
      primaryBlocker: localBlockers[0] || canonicalState.remoteEvidence?.reasonCodes?.[0] || null,
    },
    projection: {
      decisionCapsuleDigest: decisionCapsuleV3.digest,
      safeSummaryDigest: sha256(canonicalJson(safeSummary)),
      orchestrationReceiptDigest: orchestrationReceipt.digest,
      authority: false,
    },
    repository,
    baseSha,
    observedBaseSha: canonicalState.observedBaseSha,
    baseAncestryState: canonicalState.baseAncestryState,
    mergeContextDigest: canonicalState.mergeContextDigest,
    headSha,
    status: localBlockers.length ? 'fail' : 'pass',
    localValidationState: canonicalState.localValidationState,
    remoteValidationState: canonicalState.remoteValidationState,
    candidateLifecycleState,
    technicalMergeEligibility: canonicalState.technicalMergeEligibility,
    finalDecisionState: canonicalState.finalDecisionState,
    mergeAllowed: canonicalState.mergeAllowed,
    remoteEvidenceStatus: canonicalState.remoteEvidence?.status || 'not_observed',
    sameHeadState: canonicalState.remoteEvidence?.sameHeadState || 'not_observed',
    requiredCheckSetState: canonicalState.remoteEvidence?.requiredCheckSetState || 'not_observed',
    artifactIntegrityState: canonicalState.remoteEvidence?.artifactIntegrityState || 'not_observed',
    finalDecisionEvidenceStatus: canonicalState.finalDecisionEvidence?.status || 'not_observed',
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
    changeClass: plan.classification.changeClass,
    v132SelfTestStatus: selfTest,
    manifestProjectionStatus: { status: projection.status, classifiedRepositoryCount: projection.registryStatus.classifiedRepositoryCount },
    compatibilityDebtStatus: debt,
    longRunBudgetStatus: {
      status: longRunBudgetStatus.status,
      reasonCodes: longRunBudgetStatus.reasonCodes,
      usage: {
        subprocessExecutions: measuredUsage.subprocessExecutions,
        fileWrites: measuredUsage.fileWrites,
        retryCount: measuredUsage.retryCount,
        checkpointCount: measuredUsage.checkpointCount,
      },
      authority: false,
    },
    executionAccounting: measuredUsage,
    validationCoverage,
    ciCostPlan: {
      status: ciCostPlan.status,
      estimatedWorkflowRuns: ciCostPlan.estimatedWorkflowRuns,
      estimatedJobs: ciCostPlan.estimatedJobs,
      workflowNames: ciCostPlan.workflowNames,
      confidence: ciCostPlan.confidence,
      estimatedActionsImpact: ciCostPlan.estimatedActionsImpact,
      authority: false,
    },
    decisionCapsuleV3,
    safeSummary,
    orchestrationReceipt,
    outputMetrics: {
      decisionCapsuleBytes: Buffer.byteLength(JSON.stringify(decisionCapsuleV3), 'utf8'),
      safeSummaryBytes: Buffer.byteLength(JSON.stringify(safeSummary), 'utf8'),
      orchestrationReceiptBytes: Buffer.byteLength(JSON.stringify(orchestrationReceipt), 'utf8'),
    },
    authorityCreated: false,
    productMutationCount: observedProductMutationCount,
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
  const finalReceiptFile = process.env.CODEX_V132_FINAL_DECISION_RECEIPT_FILE || '';
  let acceptedMainTrustRoot = options.acceptedMainTrustRoot || null;
  if ((remoteReceiptFile || finalReceiptFile) && !acceptedMainTrustRoot) {
    acceptedMainTrustRoot = await collectAcceptedMainTrustRoot({
      repository: 'hiro4649/codex-development-harness',
      token: process.env.CODEX_V132_COLLECTOR_TOKEN,
    });
  }
  if (!remoteEvidence && remoteReceiptFile) {
    const serializedEnvelope = JSON.parse(fs.readFileSync(path.resolve(remoteReceiptFile), 'utf8'));
    const serialized = serializedEnvelope?.receipt || serializedEnvelope;
    remoteEvidence = await reobserveSerializedGithubEvidence(serialized, {
      token: process.env.CODEX_V132_COLLECTOR_TOKEN,
      acceptedMainTrustRoot,
    });
    expectedRemoteEvidence = {
      ...expectedRemoteEvidence,
      acceptedMainTrustRoot,
      event: process.env.CODEX_EVENT_NAME || 'pull_request',
      pullRequestNumber: Number(process.env.CODEX_PR_NUMBER || 0) || undefined,
      baseSha: process.env.CODEX_PR_BASE_SHA || undefined,
    };
  }
  if (!finalDecisionReceipt && finalReceiptFile) {
    const serialized = JSON.parse(fs.readFileSync(path.resolve(finalReceiptFile), 'utf8'));
    finalDecisionReceipt = verifySignedFinalDecisionReceipt(serialized, { trustRoot: acceptedMainTrustRoot });
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
