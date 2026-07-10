#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import {
  classifyValidationState,
  evaluateRemoteCiCostGate,
  lintTargetProfileDrift,
} from './codex-v131-operational-convergence.mjs';
import { deriveCanonicalState, sha256, canonicalJson, V132_FINAL_AUTHORITY } from './codex-v132-evidence-truth.mjs';
import { planTargetInstallDryRun } from './codex-v132-operational-bounds.mjs';
import { defaultTestRegistry, digestRegistry, routeCapability } from './codex-v129-capability-router.mjs';
import { readAndEvaluateV128StateMatrix } from './codex-v128-state-matrix.mjs';
import {
  buildV128ActualTargetCanaryContract,
  buildV128ActualTargetCanaryTargetDigest,
  validateV128ActualTargetCanaryContract,
} from './codex-v128-actual-target-canary-contract.mjs';
import {
  buildOrchestrationCapsule,
  validateContextOutputOwnerInterruptTokenBudget,
  validateDecisionEvidenceEnvelopeAndSameHeadBinder,
  validateTypedOwnerProcessReceiptAndContinuationKernel,
} from './codex-orchestration-capsule.mjs';

function result(invariantId, passed, detail = null) {
  return { invariantId, status: passed ? 'pass' : 'fail', detail };
}

function profileStrategy(registry = []) {
  const profileClassification = {};
  for (const entry of registry) {
    if (!profileClassification[entry.profileClass]) profileClassification[entry.profileClass] = [];
    profileClassification[entry.profileClass].push(entry.repositoryFullName);
  }
  return { profileClassification };
}

function v131Invariants(policy) {
  const state = classifyValidationState({
    localChecksPass: true,
    remoteChecksPass: false,
    remoteCiAllowed: false,
    remoteChecksStarted: false,
    mergeRequested: true,
  });
  const v131KnownTargets = policy.staticRegistry.filter((entry) => [
    'hiro4649/disco-funky-repair',
    'hiro4649/iris-live2d-renderer',
    'hiro4649/VOXWEAVE',
    'hiro4649/CRIPTO-TIP',
  ].includes(entry.repositoryFullName));
  const drift = lintTargetProfileDrift({
    registeredTargets: v131KnownTargets,
    targetProfileStrategy: profileStrategy(v131KnownTargets),
  });
  const driftNegative = lintTargetProfileDrift({
    registeredTargets: policy.staticRegistry,
    targetProfileStrategy: { profileClassification: { metadata_gate_target: ['hiro4649/VOXWEAVE'] } },
  });
  const cost = evaluateRemoteCiCostGate({
    remoteCiAllowed: false,
    action: 'merge',
    estimatedRuns: 1,
    workflowDispatch: true,
    rerun: true,
  });
  return [
    result('v131_validation_state_machine', state.localReadiness === 'ready'
      && state.remoteValidation === 'blocked_ci_quota'
      && state.mergeReadiness === 'merge_blocked'
      && state.localPassPromotedToRemotePass === false),
    result('v131_profile_drift_protection', drift.status === 'pass' && driftNegative.status === 'fail'),
    result('v131_remote_ci_cost_boundary', cost.status === 'fail'
      && cost.mergeAllowed === false
      && cost.workflowDispatchAllowed === false
      && cost.rerunAllowed === false),
  ];
}

function v130Invariants(policy) {
  const state = deriveCanonicalState({ localValidationPassed: true });
  const rejectedInstall = planTargetInstallDryRun({
    profileClass: 'metadata_gate_target',
    changedFiles: ['src/runtime/server.ts'],
    policy,
  });
  return [
    result('v130_final_decision_authority_preservation', V132_FINAL_AUTHORITY === 'v1.1.8_final_decision_kernel'
      && state.finalDecisionState === 'not_authorized'
      && state.mergeAllowed === false),
    result('v130_target_mutation_prohibition', rejectedInstall.status === 'fail_closed'
      && rejectedInstall.automaticMutationAllowed === false
      && rejectedInstall.authority === false),
    result('v130_performance_track_deferred', policy.performanceTrack?.state === 'deferred'
      && policy.performanceTrack?.authority === 'non_authoritative'
      && policy.performanceTrack?.superiorityClaimState === 'not_proven'),
  ];
}

function evaluateRollbackTransition({ fromVersion, toVersion, role, authorityCreated = false } = {}) {
  const allowed = {
    '1.3.2': { '1.3.1': 'immediate_rollback', '1.3.0': 'secondary_rollback', '1.2.9': 'emergency_legacy_rollback' },
  };
  const expectedRole = allowed[fromVersion]?.[toVersion];
  return {
    status: expectedRole === role && authorityCreated === false ? 'pass' : 'fail',
    expectedRole: expectedRole || null,
    authorityCreated: false,
  };
}

function v129Invariants() {
  const registry = defaultTestRegistry();
  const env = {
    CODEX_V129_CAPABILITY_REGISTRY_JSON: canonicalJson(registry),
    CODEX_V129_TRUSTED_CAPABILITY_REGISTRY_DIGEST: digestRegistry(registry),
  };
  const route = routeCapability({ taskClass: 'routine_metadata', difficulty: 'low', requiredCapabilityClasses: ['low_cost_worker'] }, env);
  const routeFailClosed = routeCapability({ taskClass: 'routine_metadata', difficulty: 'low' }, {});
  const rollback = evaluateRollbackTransition({
    fromVersion: '1.3.2',
    toVersion: '1.2.9',
    role: 'emergency_legacy_rollback',
  });
  const rollbackTampered = evaluateRollbackTransition({
    fromVersion: '1.3.2',
    toVersion: '1.2.9',
    role: 'immediate_rollback',
  });
  return [
    result('v129_capability_routing_contract', route.status === 'pass'
      && route.capabilityClass === 'low_cost_worker'
      && route.authorityCreated === false
      && routeFailClosed.status === 'fail'),
    result('v129_rollback_contract', rollback.status === 'pass' && rollbackTampered.status === 'fail'),
  ];
}

function canaryTarget(kind, repositoryFullName, sourceCandidateSha, candidateBundleDigest) {
  const target = {
    kind,
    repositoryFullName,
    repositoryId: kind === 'complex' ? 1256870006 : 1257029490,
    targetHeadSha: kind === 'complex' ? 'a'.repeat(40) : 'b'.repeat(40),
    targetManifestDigest: sha256(`${kind}:manifest`),
    targetProfileDigest: sha256(`${kind}:profile`),
    targetAgentsActiveBlockDigest: sha256(`${kind}:agents`),
    sourceCandidateSha,
    candidateBundleDigest,
    v127Status: 'pass',
    v128ShadowStatus: 'pass',
    preservationMismatchCount: 0,
    semanticForeignProfileLoadCount: 0,
    legacyActiveReadCount: 0,
    productRuntimeMutationCount: 0,
    deployWalletRpcSecretContractMutationCount: 0,
    cacheState: 'miss',
    readLedgerDigest: sha256(`${kind}:read-ledger`),
    v127QualityGateStatus: 'pass',
    v127QualityGateDecisionInfluence: 'load_bearing_pass',
    v127QualityGateMode: kind === 'restricted' ? 'restricted_target_readonly_validation' : 'target_copy_quality_gate',
    v127QualityGateSafeStatus: 'pass',
    v127QualityGateSafeFailureCount: 0,
    v127QualityGateSafeQualityScore: 100,
    v127QualityGateExitCode: 0,
    v128CandidateInputSource: 'target_v127_safe_evidence',
    v128CandidateSyntheticPassInput: false,
    v128CandidateTargetEvidenceDigest: sha256(`${kind}:evidence`),
    v128CandidateQualityScore: 100,
    rawLogStored: false,
    localPathStored: false,
    targetWriteAttempted: false,
    sourceActivationAuthorized: false,
    targetRolloutAuthorized: false,
    deployWalletRpcAuthorized: false,
  };
  target.targetResultDigest = buildV128ActualTargetCanaryTargetDigest(target);
  return target;
}

function v128Invariants(repoRoot) {
  const matrix = readAndEvaluateV128StateMatrix(`${repoRoot}/docs/process/CODEX_V128_STATE_MATRIX.json`);
  const sourceCandidateSha = 'c'.repeat(40);
  const candidateBundleDigest = sha256('v132-candidate-bundle');
  const canary = buildV128ActualTargetCanaryContract({
    sourceCandidateSha,
    candidateBundleDigest,
    targets: [
      canaryTarget('complex', 'hiro4649/CRIPTO-TIP', sourceCandidateSha, candidateBundleDigest),
      canaryTarget('restricted', 'hiro4649/VGC-FUNKY-TOKEN', sourceCandidateSha, candidateBundleDigest),
    ],
  });
  const canaryValidation = validateV128ActualTargetCanaryContract(canary);
  const canaryNegative = buildV128ActualTargetCanaryContract({ sourceCandidateSha, candidateBundleDigest, targets: [] });
  return [
    result('v128_blocking_compatibility_contract', matrix.status === 'pass'
      && matrix.fullEnumProductExecuted === true
      && matrix.hardInvalidCells > 0),
    result('v128_target_canary_contract', canary.status === 'pass'
      && canaryValidation.status === 'pass'
      && canaryNegative.status === 'fail'),
  ];
}

function v127Invariants() {
  const receipt = {
    present: true,
    receiptId: 'receipt-v127-compatibility',
    taskId: 'task-v127-compatibility',
    ownerInstructionHash: 'sha256:owner-instruction-v127',
    allowedActions: ['edit', 'check', 'commit', 'push', 'create_pr'],
  };
  const receiptControl = buildOrchestrationCapsule({
    typedOwnerProcessReceiptAndContinuationKernel: { ownerProcessReceipt: receipt },
  }).typedOwnerProcessReceiptAndContinuationKernel;
  const sameHead = buildOrchestrationCapsule({
    decisionEvidenceEnvelopeAndSameHeadBinder: {
      decisionEvidenceEnvelope: {
        lane: 'same_head_remote_qg',
        localHead: 'abc123',
        prHead: 'abc123',
        workflowHead: 'abc123',
        artifactHead: 'abc123',
        remoteGate: 'pass',
        allowedNextAction: 'owner_merge_decision_only',
      },
    },
  }).decisionEvidenceEnvelopeAndSameHeadBinder;
  const mismatchedHead = buildOrchestrationCapsule({
    decisionEvidenceEnvelopeAndSameHeadBinder: {
      decisionEvidenceEnvelope: {
        lane: 'same_head_remote_qg',
        localHead: 'abc123',
        prHead: 'def456',
        workflowHead: 'abc123',
        artifactHead: 'abc123',
        remoteGate: 'pass',
        allowedNextAction: 'owner_merge_decision_only',
      },
    },
  }).decisionEvidenceEnvelopeAndSameHeadBinder;
  const token = buildOrchestrationCapsule({
    contextOutputOwnerInterruptTokenBudget: {
      observed: true,
      requireObservedMetrics: true,
      metricsSource: 'quality_gate_runtime_generated_artifact_sizes',
      countsSource: 'declared_budget',
      observedCounts: false,
      routineArtifactBytes: 120,
      safeArtifactBytes: 1200,
      outputLineCount: 8,
    },
  }).contextOutputOwnerInterruptTokenBudget;
  const tokenOverflow = buildOrchestrationCapsule({
    contextOutputOwnerInterruptTokenBudget: { operatorOutputLines: 25, finalReportLineBudget: 12 },
  }).contextOutputOwnerInterruptTokenBudget;
  return [
    result('v127_receipt_readability_contract', validateTypedOwnerProcessReceiptAndContinuationKernel(receiptControl).status === 'pass'),
    result('v127_same_head_binding_contract', validateDecisionEvidenceEnvelopeAndSameHeadBinder(sameHead).status === 'pass'
      && validateDecisionEvidenceEnvelopeAndSameHeadBinder(mismatchedHead).status === 'fail'),
    result('v127_token_boundary_contract', validateContextOutputOwnerInterruptTokenBudget(token).status === 'pass'
      && validateContextOutputOwnerInterruptTokenBudget(tokenOverflow).status === 'fail'),
  ];
}

export function runV132CompatibilityBehaviorInvariants({ version, policy, repoRoot = process.cwd() } = {}) {
  let invariants;
  if (version === 'v131') invariants = v131Invariants(policy);
  else if (version === 'v130') invariants = v130Invariants(policy);
  else if (version === 'v129') invariants = v129Invariants();
  else if (version === 'v128') invariants = v128Invariants(repoRoot);
  else if (version === 'v127') invariants = v127Invariants();
  else invariants = [result('compatibility_version_unknown', false)];
  return {
    version,
    status: invariants.every((item) => item.status === 'pass') ? 'pass' : 'fail',
    invariants,
    invariantDigest: sha256(canonicalJson(invariants)),
    executionMode: 'bounded_pure_behavior_contracts',
    historicalActiveTupleExecuted: false,
    authorityCreated: false,
  };
}
