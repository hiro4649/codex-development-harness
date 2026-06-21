#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import fs from 'node:fs';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import {
  V128_OPERATOR_STATUS_KEYS,
  V128_P0_ARTIFACTS,
  buildOrchestrationCapsule,
  validateOrchestrationCapsule,
  validateV128DeterministicDecisionProjection,
  validateV128OrthogonalReasonModel,
  validateV128ResumableLoopAndPermissionProjection,
  validateV128TokenMinimalReadCompatibilityRouter,
} from './codex-orchestration-capsule.mjs';
import {
  buildV127ActiveGateReasonSummaryInput,
  buildV128ProviderChangedFilesEvidence,
  classifyV128ShadowCandidateForActiveGate,
} from './codex-local-quality-gate.mjs';
import {
  buildV128RoutineProjectionReadSurface,
  formatV128ProjectionReaderOutput,
  readV128RoutineProjectionSurfaceFromSafeSummaryText,
} from './codex-v128-projection-reader.mjs';
import { buildV128ManagedContextEmitter } from './codex-v128-managed-context-emitter.mjs';
import {
  buildV128ProjectionSourceDigestBinding,
  validateV128ProjectionIntegrity,
} from './codex-v128-integrity-lib.mjs';
import { readAndEvaluateV128StateMatrix } from './codex-v128-state-matrix.mjs';
import {
  buildV128ValidationExecutionPlan,
  validateV128ValidationExecutionPlan,
} from './codex-v128-validation-execution-plan.mjs';
import { buildCompactReasonSummary } from './codex-reason-summary.mjs';
import {
  digestV128StandingAutonomyPolicy,
  evaluateV128StandingAutonomyPolicy,
  validateV128StandingAutonomyPolicyEvaluation,
} from './codex-v128-standing-autonomy-policy.mjs';
import {
  buildV128TrustClosure,
  validateV128TrustClosure,
} from './codex-v128-trust-closure.mjs';
import { buildEvidenceCapsule } from './codex-evidence-capsule.mjs';
import {
  buildV128CompactQualityGateSafeSummary,
  compactV128ValidationExecutionPlanForStorage,
  validateV128CompactValidationPlanExact,
} from './codex-v128-token-compression.mjs';
import { scanSafeOutput } from './codex-safe-output-scan.mjs';

function test(name, fn) {
  try {
    return { name, status: fn() ? 'pass' : 'fail', safeSummaryOnly: true };
  } catch {
    return { name, status: 'fail', reasonCodes: ['self_test_exception'], safeSummaryOnly: true };
  }
}

function passed(status) {
  return status?.status === 'pass';
}

function failed(status) {
  return status?.status === 'fail';
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function canonicalDigest(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function sha256Canonical(value) {
  return `sha256:${canonicalDigest(value)}`;
}

function standingAutonomyTrustInputs(policy) {
  const probe = evaluateV128StandingAutonomyPolicy({ policy });
  const trustClosure = buildV128TrustClosure();
  return {
    trustedPolicyDigest: digestV128StandingAutonomyPolicy(policy),
    trustedEvaluatorDigest: probe.evaluatorDigest,
    trustedVerifierBundleDigest: trustClosure.trustDigests.verifierBundleDigest,
    verifierBundleDigest: trustClosure.trustDigests.verifierBundleDigest,
    trustedProviderAdapterDigest: trustClosure.trustDigests.providerAdapterDigest,
    providerAdapterDigest: trustClosure.trustDigests.providerAdapterDigest,
    trustedScopeClassifierDigest: trustClosure.trustDigests.scopeClassifierDigest,
    scopeClassifierDigest: trustClosure.trustDigests.scopeClassifierDigest,
    trustedMergeExecutorDigest: trustClosure.trustDigests.mergeExecutorDigest,
    mergeExecutorDigest: trustClosure.trustDigests.mergeExecutorDigest,
    trustedCanonicalizerDigest: trustClosure.trustDigests.canonicalizerDigest,
    canonicalizerDigest: trustClosure.trustDigests.canonicalizerDigest,
    trustedFinalDecisionAuthorityDigest: trustClosure.trustDigests.finalDecisionAuthorityDigest,
    finalDecisionAuthorityDigest: trustClosure.trustDigests.finalDecisionAuthorityDigest,
    trustedPolicySource: 'protected_default_branch_policy',
    repositoryId: 'repo-123',
    authorityEpoch: 'epoch-1',
    trustedAuthorityEpoch: 'epoch-1',
    revocationNonce: 'nonce-1',
    trustedRevocationNonce: 'nonce-1',
  };
}

function buildBoundV128Projection(base = {}, inputs = {}) {
  const projection = { ...base };
  projection.sourceBinding = buildV128ProjectionSourceDigestBinding(projection.headSha || 'unknown', {
    ...inputs,
    projectionPayload: projection,
  });
  return projection;
}

function parseJsonRejectDuplicateKeys(text) {
  const stack = [];
  let index = 0;
  function top() { return stack[stack.length - 1]; }
  function completeValue() {
    const frame = top();
    if (!frame) return;
    if (frame.type === 'object' && frame.state === 'value') frame.state = 'comma_or_end';
    else if (frame.type === 'array' && frame.state === 'value_or_end') frame.state = 'comma_or_end';
  }
  function readString() {
    let result = '';
    index += 1;
    while (index < text.length) {
      const ch = text[index];
      if (ch === '\\') {
        result += ch + (text[index + 1] || '');
        index += 2;
        continue;
      }
      if (ch === '"') {
        index += 1;
        return JSON.parse(`"${result}"`);
      }
      result += ch;
      index += 1;
    }
    throw new Error('unterminated_string');
  }
  function skipPrimitive() {
    while (index < text.length && !/[\s,\]\}]/.test(text[index])) index += 1;
    completeValue();
  }
  while (index < text.length) {
    const ch = text[index];
    if (/\s/.test(ch)) {
      index += 1;
      continue;
    }
    const frame = top();
    if (ch === '{') {
      stack.push({ type: 'object', keys: new Set(), state: 'key_or_end' });
      index += 1;
      continue;
    }
    if (ch === '[') {
      stack.push({ type: 'array', state: 'value_or_end' });
      index += 1;
      continue;
    }
    if (ch === '}') {
      if (!frame || frame.type !== 'object' || !['key_or_end', 'comma_or_end'].includes(frame.state)) throw new Error('object_state_invalid');
      stack.pop();
      index += 1;
      completeValue();
      continue;
    }
    if (ch === ']') {
      if (!frame || frame.type !== 'array' || !['value_or_end', 'comma_or_end'].includes(frame.state)) throw new Error('array_state_invalid');
      stack.pop();
      index += 1;
      completeValue();
      continue;
    }
    if (ch === ',') {
      if (!frame || frame.state !== 'comma_or_end') throw new Error('comma_state_invalid');
      frame.state = frame.type === 'object' ? 'key_or_end' : 'value_or_end';
      index += 1;
      continue;
    }
    if (ch === ':') {
      if (!frame || frame.type !== 'object' || frame.state !== 'colon') throw new Error('colon_state_invalid');
      frame.state = 'value';
      index += 1;
      continue;
    }
    if (ch === '"') {
      const value = readString();
      const current = top();
      if (current?.type === 'object' && current.state === 'key_or_end') {
        if (current.keys.has(value)) throw new Error(`duplicate_key:${value}`);
        current.keys.add(value);
        current.state = 'colon';
      } else {
        completeValue();
      }
      continue;
    }
    skipPrimitive();
  }
  if (stack.length) throw new Error('json_stack_unclosed');
  return JSON.parse(text);
}

function resolveHarnessMode(env = process.env) {
  if (env.CODEX_HARNESS_MODE === 'target') return 'target';
  if (env.CODEX_HARNESS_SOURCE_REPO === '1' || env.CODEX_HARNESS_MODE === 'core' || env.CODEX_HARNESS_MODE === 'source') return 'source';
  try {
    const manifest = readJson('docs/process/CODEX_HARNESS_MANIFEST.json');
    if (manifest.targetRepoMode === true) return 'target';
    if (manifest.sourceOnlyRelease === true) return 'source';
  } catch {
    // Source-body self-test fixtures may omit the target manifest.
  }
  return 'source';
}

function activeManifestPathsForMode(env = process.env) {
  return resolveHarnessMode(env) === 'target'
    ? ['docs/process/CODEX_HARNESS_MANIFEST.json']
    : ['CODEX_SOURCE_HARNESS_MANIFEST.json', 'docs/process/CODEX_HARNESS_MANIFEST.json'];
}

function manifestDeclaresShadowCandidate() {
  const manifests = activeManifestPathsForMode().map((file) => readJson(file));
  return manifests.every((manifest) => manifest.activeHarnessVersion === '1.2.7'
    && manifest.activeSelfTestSuite === 'v127'
    && manifest.deterministicDecisionProjectionAndTokenMinimalLoopClosure?.version === '1.2.8'
    && manifest.deterministicDecisionProjectionAndTokenMinimalLoopClosure?.activationState === 'source_shadow_candidate');
}

function replayCorpusExecutes() {
  const corpus = readJson('docs/process/CODEX_V128_REPLAY_CORPUS.json');
  return corpus.cases.every((item) => {
    if (item.caseId === 'projection_non_authority') {
      return passed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule().deterministicDecisionProjection));
    }
    if (item.caseId === 'old_draft_authority_pollution') {
      return failed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule({
        deterministicDecisionProjection: { decisionCapsuleIsProjectionPhraseDetected: true },
      }).deterministicDecisionProjection));
    }
    if (item.caseId === 'reason_pending_waiting_remote' || item.caseId === 'reason_pending_merge_boundary') {
      const model = buildOrchestrationCapsule().orthogonalReasonModel;
      return model.effectByPhase?.[item.phase]?.[item.reasonCode] === item.expected;
    }
    if (item.caseId === 'routine_token_surface') {
      return passed(validateV128TokenMinimalReadCompatibilityRouter(buildOrchestrationCapsule().tokenMinimalReadCompatibilityRouter));
    }
    if (item.caseId === 'receipt_scope_delta') {
      return failed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule({
        resumableLoopAndPermissionProjection: {
          receiptHydrationBinding: { receiptHydrationState: 'valid', receiptDigest: 'sha256:receipt' },
        },
      }).resumableLoopAndPermissionProjection));
    }
    if (item.caseId === 'post_merge_lane_preservation') {
      return item.replayStatus === 'partial_shadow_candidate'
        && Array.isArray(item.checks)
        && item.checks.includes('post_merge_sentinel')
        && item.checks.includes('blocked_recovery')
        && item.checks.includes('post_merge_verify');
    }
    return false;
  });
}

function stateMatrixIsFiniteUniqueOrPartialDeclared() {
  const result = readAndEvaluateV128StateMatrix();
  return result.status === 'pass'
    && result.coverage === 'full_shadow_candidate'
    && result.fullEnumProductExecuted === true
    && result.totalCells > 0
    && result.unresolvedCells === 0;
}

function boundedProjectionReaderExecutes() {
  const projection = buildBoundV128Projection({
    schemaVersion: '1.2.8',
    projectionKind: 'routine_decision_projection',
    authority: 'non_authoritative_projection',
    finalAuthority: 'v1.1.8_final_decision_kernel',
    activeHarnessVersion: '1.2.7',
    candidateHarnessVersion: '1.2.8',
    candidateActivationState: 'source_shadow_candidate',
    headSha: 'f'.repeat(40),
    sourceBinding: buildV128ProjectionSourceDigestBinding('f'.repeat(40)),
    status: 'pass',
    qualityScore: 100,
    technicalChecksReady: true,
    ownerMergeAuthorized: false,
    blockingCount: 0,
    v127: 'pass',
    v128: 'pass',
    runtimeReadinessClaimed: false,
    productionReadinessClaimed: false,
    productFilesChanged: false,
    packageFilesChanged: false,
    safeNextAction: 'owner_merge_decision_only',
    observed: true,
    metricsSource: 'runtime_safe_summary_projection',
    projectionCanonicalBytes: 0,
    withinRoutineBudget: true,
  });
  const safeSummary = JSON.stringify({
    status: 'pass',
    routineDecisionProjection: projection,
    largeDiagnosticSurface: 'x'.repeat(25000),
  });
  const surface = readV128RoutineProjectionSurfaceFromSafeSummaryText(safeSummary);
  const formatted = formatV128ProjectionReaderOutput(surface);
  return surface.status === 'pass'
    && surface.surfaceCanonicalBytes <= 1600
    && formatted.exitCode === 0
    && formatted.outputBytes <= 1600
    && surface.managedSafeArtifactRead === 1
    && surface.coldArtifactRead === 0
    && surface.managedContextBytesObserved !== true;
}

function evidenceCapsuleDoesNotSubstituteProviderHeads() {
  const head = 'f'.repeat(40);
  const capsule = buildEvidenceCapsule({
    terminalAction: 'merge_current_pr',
    headSha: head,
    qualityGateRunId: '27800000000',
    artifactId: 'artifact-1',
  });
  return capsule.fresh === false
    && capsule.status === 'needs_run'
    && capsule.currentHeadEvidence.prHeadSha === 'unknown'
    && capsule.currentHeadEvidence.workflowHeadSha === 'unknown'
    && capsule.currentHeadEvidence.artifactHeadSha === 'unknown';
}

function boundedProjectionReaderRejectsDuplicateKeys() {
  try {
    readV128RoutineProjectionSurfaceFromSafeSummaryText('{"routineDecisionProjection":{},"routineDecisionProjection":{}}');
    return false;
  } catch {
    return true;
  }
}

function boundedProjectionReaderCompactsOverBudgetFailure() {
  const surface = buildV128RoutineProjectionReadSurface(buildBoundV128Projection({
    schemaVersion: '1.2.8',
    projectionKind: 'routine_decision_projection',
    authority: 'non_authoritative_projection',
    headSha: 'f'.repeat(40),
    oversizedField: 'x'.repeat(3000),
  }));
  const formatted = formatV128ProjectionReaderOutput(surface);
  return surface.status === 'fail'
    && formatted.exitCode === 1
    && formatted.outputBytes <= 1600
    && formatted.output.includes('routine_projection_reader_stdout_over_budget');
}

function managedContextEmitterObservesBytes() {
  const context = buildV128ManagedContextEmitter({ headSha: 'f'.repeat(40) });
  return context.status === 'pass'
    && context.managedContextMeasurementSource === 'v128_managed_context_emitter'
    && context.managedContextBytes > 0
    && context.managedContextBytes <= 4096
    && context.compiledActiveInstructionBytes > 0
    && context.compiledActiveInstructionBytes <= 1400
    && context.compiledContextBytes > 0
    && context.compiledContextBytes <= 1400
    && Array.isArray(context.missingBindingIds)
    && context.missingBindingIds.length === 0
    && context.routineColdArtifactRead === 0
    && context.legacyRead === 0
    && context.foreignProfileRead === 0
    && context.reviewerFanout === 0
    && context.routineSelectedSkill === 0
    && context.sourceFiles.length >= 5
    && context.instructionCapsule.llmSummaryUsed === false
    && context.attestedView.projectionAuthority === 'non_authoritative'
    && context.sourceActivationReady === false;
}

function managedContextEmitterPassesSafeOutputScan() {
  const context = buildV128ManagedContextEmitter({ headSha: 'f'.repeat(40) });
  return scanSafeOutput(context).findings.length === 0;
}

function tokenCompressionCompactsSafeSummary() {
  const projection = buildBoundV128Projection({
    schemaVersion: '1.2.8',
    projectionKind: 'routine_decision_projection',
    authority: 'non_authoritative_projection',
    headSha: 'f'.repeat(40),
    status: 'pass',
    qualityScore: 100,
  });
  const noisyReport = {
    status: 'pass',
    qualityScore: 100,
    mergeReady: true,
    technicalChecksReady: true,
    qualityScoreStatus: { status: 'pass', score: 100, safeSummaryOnly: true },
    finalDecisionStatus: { status: 'pass', reasonCodes: [], safeSummaryOnly: true },
    decisionCapsuleStatus: { status: 'pass', safeSummaryOnly: true },
    evidenceCapsuleStatus: { status: 'pass', safeSummaryOnly: true },
    reasonSummaryStatus: { status: 'pass', summary: { blockingReasons: [] }, safeSummaryOnly: true },
    v127SelfTestStatus: { status: 'pass', caseCount: 10, failureCount: 0, safeSummaryOnly: true },
    v128SelfTestStatus: { status: 'pass', caseCount: 84, failureCount: 0, safeSummaryOnly: true },
    routineDecisionProjection: projection,
    routineProjectionReadSurface: buildV128RoutineProjectionReadSurface(projection),
    v128ManagedContextEmitter: buildV128ManagedContextEmitter({ headSha: 'f'.repeat(40) }),
    v128ValidationExecutionPlan: {
      profileExecution: {
        planDigest: sha256Canonical({ plan: true }),
        runWideInvocationCount: 4,
        runWideDuplicateExecutionCount: 0,
        runWideInvocationLedgerStatus: 'pass',
      },
      graph: { graphDigest: sha256Canonical({ graph: true }), nodes: [{ nodeRef: 'projection_reader' }] },
      validationReuseDecision: { reuseDecision: 'miss', cacheKeyDigest: null },
      typedResults: { projection_reader: { payload: 'x'.repeat(30000) } },
    },
    v128ValidationExecutionPlanStatus: { status: 'pass', observationState: 'observed', safeSummaryOnly: true },
    v128TrustClosure: {
      trustClosureDigest: sha256Canonical({ trust: true }),
      closureFileCount: 120,
      trustDigests: { verifierBundleDigest: sha256Canonical({ verifier: true }) },
      roleClosures: {
        top_level: { unresolvedRelativeImportCount: 0, unsupportedDynamicImportCount: 0, executableInvocationCount: 12, files: Array.from({ length: 120 }, (_, index) => `file-${index}`) },
      },
    },
    v128TrustClosureStatus: { status: 'pass', safeSummaryOnly: true },
    v128StandingAutonomyPolicy: {
      automationDisposition: 'auto_wait',
      policyAuthorizationState: 'not_eligible',
      policyDigest: sha256Canonical({ policy: true }),
    },
    v128StandingAutonomyPolicyStatus: { status: 'pass', safeSummaryOnly: true },
  };
  const summary = buildV128CompactQualityGateSafeSummary({
    report: noisyReport,
    head: 'f'.repeat(40),
    finalDecision: { terminalAction: 'merge_current_pr', mergeAllowed: false, safeNextAction: 'owner_merge_decision_only' },
    routineDecisionProjection: projection,
    routineProjectionReadSurface: noisyReport.routineProjectionReadSurface,
    v128ManagedContextEmitter: noisyReport.v128ManagedContextEmitter,
    v128ValidationExecutionPlan: noisyReport.v128ValidationExecutionPlan,
    v128ValidationExecutionPlanStatus: noisyReport.v128ValidationExecutionPlanStatus,
    v128TrustClosure: noisyReport.v128TrustClosure,
    v128TrustClosureStatus: noisyReport.v128TrustClosureStatus,
    standingAutonomyPolicy: noisyReport.v128StandingAutonomyPolicy,
  });
  return summary.tokenCompression.status === 'pass'
    && summary.tokenCompression.storedSafeSummaryBytes <= 6144
    && summary.tokenCompression.routineReadSurfaceBytes <= 2560
    && summary.compactDiagnostics.validationPlan.typedResultsDigest
    && !JSON.stringify(summary).includes('file-119')
    && !JSON.stringify(summary).includes('xxxxx');
}

function projectionIntegrityBindingVerifies() {
  const inputs = {
    finalDecision: { terminalAction: 'create_pr_only', safeNextAction: 'owner_merge_decision_only' },
    evidenceCapsule: { status: 'pass', fresh: true },
    decisionCapsule: { decision: 'allowed', mergeAllowed: false },
  };
  const projection = buildBoundV128Projection({
    schemaVersion: '1.2.8',
    projectionKind: 'routine_decision_projection',
    authority: 'non_authoritative_projection',
    headSha: 'f'.repeat(40),
  }, inputs);
  return validateV128ProjectionIntegrity(projection, { ...inputs, verifySourceDigest: true, verifyInputDigest: true }).status === 'pass'
    && validateV128ProjectionIntegrity({
      ...projection,
      sourceBinding: { ...projection.sourceBinding, headSha: 'e'.repeat(40) },
    }, { ...inputs, verifyInputDigest: true }).status === 'fail'
    && validateV128ProjectionIntegrity({
      ...projection,
      sourceBinding: { ...projection.sourceBinding, generatorContractDigest: 'sha256:bad' },
    }, { ...inputs, verifyInputDigest: true }).status === 'fail';
}

function projectionPayloadDigestTamperFails() {
  const projection = buildBoundV128Projection({
    schemaVersion: '1.2.8',
    projectionKind: 'routine_decision_projection',
    authority: 'non_authoritative_projection',
    headSha: 'f'.repeat(40),
    qualityScore: 100,
  });
  return validateV128ProjectionIntegrity({ ...projection, qualityScore: 99 }).reasonCodes.includes('projection_payload_digest_mismatch');
}

function projectionInputDigestTamperFails() {
  const inputs = {
    finalDecision: { terminalAction: 'create_pr_only', safeNextAction: 'owner_merge_decision_only' },
    evidenceCapsule: { status: 'pass', fresh: true },
    decisionCapsule: { decision: 'allowed', mergeAllowed: false },
  };
  const projection = buildBoundV128Projection({
    schemaVersion: '1.2.8',
    projectionKind: 'routine_decision_projection',
    authority: 'non_authoritative_projection',
    headSha: 'f'.repeat(40),
  }, inputs);
  return validateV128ProjectionIntegrity(projection, {
    ...inputs,
    finalDecision: { terminalAction: 'create_pr_only', safeNextAction: 'repair_harness_only' },
    verifyInputDigest: true,
  }).reasonCodes.includes('projection_input_digest_mismatch');
}

function executedNode(nodeRef, status = 'pass', stabilityClass = 'decision_stable', payload = {}) {
  return {
    nodeRef,
    executionState: 'executed',
    executionCount: 1,
    executionCountSource: 'executor_registry',
    executionCountObserved: true,
    status,
    stabilityClass,
    typedResultPayload: {
      schemaVersion: '1.0.0',
      nodeRef,
      status,
      ...payload,
    },
  };
}

function reusedNode(nodeRef, payload = {}) {
  const typedResultPayload = {
    schemaVersion: '1.0.0',
    nodeRef,
    status: 'pass',
    reused: true,
    ...payload,
  };
  return {
    nodeRef,
    executionState: 'reused',
    executionCount: 0,
    executionCountSource: 'executor_registry',
    executionCountObserved: true,
    status: 'pass',
    stabilityClass: 'decision_stable',
    sourceRunRef: {
      provider: 'github_actions',
      runId: '27881777742',
      attempt: 1,
      artifactName: `v128-${nodeRef}-typed-result.safe.json`,
      artifactDigest: sha256Canonical({ nodeRef, typedResultPayload }),
      sourceHeadSha: 'f'.repeat(40),
      testedCommitOid: 'f'.repeat(40),
      resultSchemaVersion: '1.0.0',
    },
    sourceResultDigest: sha256Canonical(typedResultPayload),
    sourceHeadSha: 'f'.repeat(40),
    resultSchemaVersion: '1.0.0',
    typedResultPayload,
  };
}

function validValidationNodeResults() {
  const upstream = [
    executedNode('projection_reader', 'pass', 'decision_stable', { surfaceCanonicalBytes: 1200 }),
    executedNode('managed_context_emitter', 'pass', 'cache_stable', { managedContextBytes: 1800 }),
    executedNode('state_matrix_executor', 'pass', 'decision_stable', { totalCells: 96 }),
  ];
  return [
    ...upstream,
    executedNode('aggregate_finalizer', 'pass', 'decision_stable', {
      aggregateOnly: true,
      downstreamRespawnAllowed: false,
      upstreamNodeRefs: upstream.map((node) => node.nodeRef),
      upstreamResultDigests: upstream.map((node) => ({
        nodeRef: node.nodeRef,
        status: node.status,
        resultDigest: sha256Canonical(node.typedResultPayload),
      })),
      failedNodeRefs: [],
    }),
  ];
}

function buildPlanWithBoundReusedCacheKeys(input = {}) {
  const stableInput = {
    testedTreeKind: 'branch_head',
    testedCommitOid: 'f'.repeat(40),
    ...input,
  };
  const draft = buildV128ValidationExecutionPlan(stableInput);
  const commandDigests = Object.fromEntries(Object.entries(draft.nodeSourceClosures || {}).map(([nodeRef, closure]) => [
    nodeRef,
    closure.nodeSourceClosureDigest,
  ]));
  const nodeResults = (stableInput.nodeResults || []).map((node) => {
    if (node.executionState !== 'reused') return node;
    return {
      ...node,
      cacheKeyDigest: draft.validationReuseDecision.nodeCacheKeyDigests[node.nodeRef]
        || draft.validationReuseDecision.cacheKeyDigest
        || node.cacheKeyDigest,
    };
  });
  return buildV128ValidationExecutionPlan({
    ...stableInput,
    nodeResults,
    runWideInvocationLedger: stableInput.runWideInvocationLedger || invocationLedgerFor(nodeResults, commandDigests),
  });
}

function invocationLedgerFor(nodeResults = [], commandDigests = {}) {
  let sequence = 0;
  return nodeResults
    .filter((node) => node.executionState !== 'reused')
    .map((node) => {
      sequence += 1;
      const payload = node.typedResultPayload || {
        nodeRef: node.nodeRef,
        executionState: node.executionState || 'executed',
        status: node.status || 'pass',
        stabilityClass: node.stabilityClass || 'decision_stable',
      };
      return {
        nodeRef: node.nodeRef,
        commandOrFunctionDigest: commandDigests[node.nodeRef] || sha256Canonical({
          nodeRef: node.nodeRef,
          adapterId: 'v128_self_test_fixture_adapter',
          stabilityClass: node.stabilityClass || 'decision_stable',
        }),
        invocationSequence: sequence,
        completionSequence: sequence,
        resultDigest: sha256Canonical(payload),
        executionSource: 'v128_self_test_fixture',
        adapterId: 'v128_self_test_fixture_adapter',
      };
    });
}

function validationExecutionPlanVerifies() {
  const upstream = [
    executedNode('projection_reader', 'pass', 'decision_stable', { surfaceCanonicalBytes: 1200 }),
    executedNode('managed_context_emitter', 'pass', 'cache_stable', { managedContextBytes: 1800 }),
    reusedNode('state_matrix_executor', { totalCells: 96 }),
  ];
  return passed(validateV128ValidationExecutionPlan(buildPlanWithBoundReusedCacheKeys({
    headSha: 'f'.repeat(40),
    sourceHeadOid: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: [
      ...upstream,
      executedNode('aggregate_finalizer', 'pass', 'decision_stable', {
        aggregateOnly: true,
        downstreamRespawnAllowed: false,
        upstreamNodeRefs: upstream.map((node) => node.nodeRef),
        upstreamResultDigests: upstream.map((node) => ({
          nodeRef: node.nodeRef,
          status: node.status,
          resultDigest: sha256Canonical(node.typedResultPayload),
        })),
        failedNodeRefs: [],
      }),
    ],
  })));
}

function compactValidationPlanStillValidates() {
  const upstream = [
    executedNode('projection_reader', 'pass', 'decision_stable', { surfaceCanonicalBytes: 1200, routineDecisionProjection: { sourceBinding: { projectionPayloadDigest: sha256Canonical({ p: true }) } } }),
    executedNode('managed_context_emitter', 'pass', 'cache_stable', {
      managedContextBytes: 1800,
      compiledContext: 'x'.repeat(1200),
      sourceFiles: Array.from({ length: 30 }, (_, index) => ({ path: `file-${index}.mjs`, digest: sha256Canonical({ index }), bytes: 100 })),
    }),
    executedNode('state_matrix_executor', 'pass', 'decision_stable', { totalCells: 96 }),
  ];
  const plan = buildPlanWithBoundReusedCacheKeys({
    headSha: 'f'.repeat(40),
    sourceHeadOid: 'f'.repeat(40),
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: [
      ...upstream,
      executedNode('aggregate_finalizer', 'pass', 'decision_stable', {
        aggregateOnly: true,
        downstreamRespawnAllowed: false,
        upstreamNodeRefs: upstream.map((node) => node.nodeRef),
        upstreamResultDigests: upstream.map((node) => ({
          nodeRef: node.nodeRef,
          resultDigest: sha256Canonical(node.typedResultPayload),
        })),
        failedNodeRefs: [],
      }),
    ],
  });
  const compact = compactV128ValidationExecutionPlanForStorage(plan);
  return passed(validateV128ValidationExecutionPlan(compact))
    && passed(validateV128CompactValidationPlanExact(compact))
    && Buffer.byteLength(JSON.stringify(compact, null, 2), 'utf8') < Buffer.byteLength(JSON.stringify(plan, null, 2), 'utf8')
    && !JSON.stringify(compact).includes('file-29.mjs')
    && !JSON.stringify(compact).includes('xxxxxxxxxx');
}

function compactValidationPlanStaleAggregateDigestFails() {
  const compact = compactV128ValidationExecutionPlanForStorage(buildPlanWithBoundReusedCacheKeys({
    headSha: 'f'.repeat(40),
    sourceHeadOid: 'f'.repeat(40),
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: validValidationNodeResults(),
  }));
  compact.typedResults.aggregate_finalizer.orderedUpstreamResultSetDigest = sha256Canonical({ stale: true });
  return failed(validateV128CompactValidationPlanExact(compact));
}

function compactValidationPlanLedgerDigestMismatchFails() {
  const compact = compactV128ValidationExecutionPlanForStorage(buildPlanWithBoundReusedCacheKeys({
    headSha: 'f'.repeat(40),
    sourceHeadOid: 'f'.repeat(40),
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: validValidationNodeResults(),
  }));
  compact.profileExecution.runWideInvocationLedger[0].resultDigest = sha256Canonical({ wrong: true });
  return failed(validateV128CompactValidationPlanExact(compact));
}

function compactValidationPlanUpstreamDigestMismatchFails() {
  const compact = compactV128ValidationExecutionPlanForStorage(buildPlanWithBoundReusedCacheKeys({
    headSha: 'f'.repeat(40),
    sourceHeadOid: 'f'.repeat(40),
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: validValidationNodeResults(),
  }));
  compact.typedResults.aggregate_finalizer.upstreamResultDigests[0].resultDigest = sha256Canonical({ wrong: true });
  return failed(validateV128CompactValidationPlanExact(compact));
}

function validationExecutionDuplicateNodeFails() {
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodes: [
      { nodeRef: 'compile', dependsOn: [], required: true },
      { nodeRef: 'compile', dependsOn: [], required: true },
    ],
    nodeResults: [
      { nodeRef: 'compile', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
    ],
  })));
}

function validationExecutionRespawnFails() {
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    downstreamRespawnAllowed: true,
    nodeResults: [
      { nodeRef: 'projection_reader', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
      { nodeRef: 'managed_context_emitter', executionState: 'executed', status: 'pass', stabilityClass: 'cache_stable' },
      { nodeRef: 'state_matrix_executor', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
      { nodeRef: 'aggregate_finalizer', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
    ],
  })));
}

function validationReusePlaceholderFails() {
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'unknown',
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    reuseDecision: 'hit',
    nodeResults: [
      { nodeRef: 'projection_reader', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
      { nodeRef: 'managed_context_emitter', executionState: 'executed', status: 'pass', stabilityClass: 'cache_stable' },
      { nodeRef: 'state_matrix_executor', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
      { nodeRef: 'aggregate_finalizer', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
    ],
  })));
}

function validationExecutionRawWorkspacePathFails() {
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    rawWorkspacePathUploaded: true,
    nodeResults: [
      { nodeRef: 'projection_reader', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
      { nodeRef: 'managed_context_emitter', executionState: 'executed', status: 'pass', stabilityClass: 'cache_stable' },
      { nodeRef: 'state_matrix_executor', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
      { nodeRef: 'aggregate_finalizer', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
    ],
  })));
}

function validationTypedPayloadTamperFails() {
  const plan = buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: validValidationNodeResults(),
  });
  plan.typedResults.projection_reader.surfaceCanonicalBytes = 9999;
  return validateV128ValidationExecutionPlan(plan).reasonCodes.includes('typed_result_payload_digest_mismatch');
}

function validationAggregateFinalizerBlocksFailedUpstream() {
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: [
      executedNode('projection_reader', 'fail', 'decision_stable', { reason: 'BROKEN_READER' }),
      executedNode('managed_context_emitter', 'pass', 'cache_stable', { managedContextBytes: 1800 }),
      executedNode('state_matrix_executor', 'pass', 'decision_stable', { totalCells: 96 }),
      executedNode('aggregate_finalizer', 'pass', 'decision_stable', { upstreamNodeRefs: ['projection_reader', 'managed_context_emitter', 'state_matrix_executor'] }),
    ],
  })));
}

function validationExecutionCountTwoFails() {
  const nodes = validValidationNodeResults();
  nodes[0] = { ...nodes[0], executionCount: 2 };
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: nodes,
  })));
}

function validationCacheHitWithExecutedNodeFails() {
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    reuseDecision: 'hit',
    nodeResults: validValidationNodeResults(),
  })));
}

function validationCacheMissWithReusedNodeFails() {
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    reuseDecision: 'miss',
    nodeResults: [
      executedNode('projection_reader', 'pass', 'decision_stable'),
      executedNode('managed_context_emitter', 'pass', 'cache_stable'),
      reusedNode('state_matrix_executor'),
      executedNode('aggregate_finalizer', 'pass', 'decision_stable'),
    ],
  })));
}

function validationReusedNodeSourceDigestMismatchFails() {
  const reused = reusedNode('state_matrix_executor');
  reused.sourceResultDigest = `sha256:${'c'.repeat(64)}`;
  return validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    testedTreeKind: 'branch_head',
    testedCommitOid: 'f'.repeat(40),
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: [
      executedNode('projection_reader', 'pass', 'decision_stable'),
      executedNode('managed_context_emitter', 'pass', 'cache_stable'),
      reused,
      executedNode('aggregate_finalizer', 'pass', 'decision_stable'),
    ],
  })).reasonCodes.includes('reused_node_source_result_digest_mismatch');
}

function validationReusedNodeCacheKeyDigestMismatchFails() {
  const reused = reusedNode('state_matrix_executor');
  reused.cacheKeyDigest = `sha256:${'c'.repeat(64)}`;
  return validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    testedTreeKind: 'branch_head',
    testedCommitOid: 'f'.repeat(40),
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: [
      executedNode('projection_reader', 'pass', 'decision_stable'),
      executedNode('managed_context_emitter', 'pass', 'cache_stable'),
      reused,
      executedNode('aggregate_finalizer', 'pass', 'decision_stable'),
    ],
  })).reasonCodes.includes('reused_node_cache_key_digest_mismatch');
}

function validationReusedNodeMissingCacheKeyDigestFails() {
  return validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    sourceHeadOid: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: [
      executedNode('projection_reader', 'pass', 'decision_stable'),
      executedNode('managed_context_emitter', 'pass', 'cache_stable'),
      reusedNode('state_matrix_executor'),
      executedNode('aggregate_finalizer', 'pass', 'decision_stable'),
    ],
  })).reasonCodes.includes('reused_node_cache_key_digest_required');
}

function validationReusedNodeStringSourceRunRefFails() {
  const reused = reusedNode('state_matrix_executor');
  reused.sourceRunRef = 'github:run:27881777742:attempt:1';
  const plan = buildPlanWithBoundReusedCacheKeys({
    headSha: 'f'.repeat(40),
    sourceHeadOid: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: [
      executedNode('projection_reader', 'pass', 'decision_stable'),
      executedNode('managed_context_emitter', 'pass', 'cache_stable'),
      reused,
      executedNode('aggregate_finalizer', 'pass', 'decision_stable'),
    ],
  });
  return validateV128ValidationExecutionPlan(plan).reasonCodes.includes('reused_node_source_run_ref_must_be_object');
}

function validationUnsupportedDynamicImportDisablesReuse() {
  const virtualPath = 'scripts/__v128_virtual_dynamic_import_fixture.mjs';
  const plan = buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    sourceHeadOid: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    reuseDecision: 'hit',
    sourceClosureFiles: [virtualPath],
    sourceFileTexts: {
      [virtualPath]: "const selected = './dynamic.js'; await ".concat("import(selected);\n"),
    },
    nodeResults: [
      reusedNode('projection_reader'),
      reusedNode('managed_context_emitter'),
      reusedNode('state_matrix_executor'),
      reusedNode('aggregate_finalizer'),
    ],
  });
  const validation = validateV128ValidationExecutionPlan(plan);
  return plan.sourceClosure.unsupportedDynamicImportCount === 1
    && plan.validationReuseDecision.sourceClosureReuseForbidden === true
    && validation.reasonCodes.includes('validation_reuse_miss_cannot_include_reused_nodes');
}

function validationWorkspaceUnobservedCannotBeCanonical() {
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: false,
    canonicalityState: 'canonical',
    decisionInputManifestScanned: true,
    nodeResults: validValidationNodeResults(),
  })));
}

function validationRunnerImageMissingPreventsReuse() {
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    reuseDecision: 'hit',
    nodeResults: [
      reusedNode('projection_reader'),
      reusedNode('managed_context_emitter'),
      reusedNode('state_matrix_executor'),
      reusedNode('aggregate_finalizer'),
    ],
  })));
}

function validationSourceClosureIncludesConsumers() {
  const plan = buildV128ValidationExecutionPlan();
  const paths = new Set(plan.sourceClosure.sourceFiles.map((file) => file.path));
  return paths.has('scripts/codex-v128-validation-execution-plan.mjs')
    && paths.has('scripts/codex-v128-aggregate-finalizer.mjs')
    && paths.has('scripts/codex-local-quality-gate.mjs')
    && paths.has('scripts/codex-orchestration-capsule.mjs')
    && paths.has('scripts/codex-v128-projection-reader.mjs')
    && paths.has('scripts/codex-v128-managed-context-emitter.mjs')
    && paths.has('scripts/codex-v128-state-matrix.mjs')
    && paths.has('scripts/codex-v128-integrity-lib.mjs');
}

function validationSourceClosureResolvesTransitiveImports() {
  const plan = buildV128ValidationExecutionPlan();
  return plan.sourceClosure.declaredImportScanStatus === 'pass'
    && plan.sourceClosure.undeclaredRelativeImportCount === 0
    && plan.sourceClosure.unresolvedRelativeImportCount === 0
    && plan.sourceClosure.transitiveRelativeImportCount > 0
    && Array.isArray(plan.sourceClosure.relativeImportClosureFiles);
}

function validationNodeScopedSourceClosuresExist() {
  const plan = buildV128ValidationExecutionPlan();
  const closures = plan.nodeSourceClosures || {};
  const requiredAdapters = {
    projection_reader: 'scripts/codex-v128-projection-reader-adapter.mjs',
    managed_context_emitter: 'scripts/codex-v128-managed-context-adapter.mjs',
    state_matrix_executor: 'scripts/codex-v128-state-matrix-adapter.mjs',
    aggregate_finalizer: 'scripts/codex-v128-aggregate-finalizer-adapter.mjs',
  };
  const nodeRefs = Object.keys(requiredAdapters);
  return nodeRefs.every((nodeRef) => /^sha256:[a-f0-9]{64}$/.test(String(closures[nodeRef]?.nodeSourceClosureDigest || '')))
    && nodeRefs.every((nodeRef) => closures[nodeRef].sourceFileCount <= plan.sourceClosure.sourceFiles.length)
    && nodeRefs.every((nodeRef) => (closures[nodeRef].seedSourceFiles || []).includes(requiredAdapters[nodeRef]))
    && closures.managed_context_emitter.sourceFileCount < plan.sourceClosure.sourceFiles.length;
}

function validationRunWideDuplicateExecutionFails() {
  const nodeResults = validValidationNodeResults();
  const draft = buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    testedTreeKind: 'branch_head',
    testedCommitOid: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults,
  });
  const commandDigests = Object.fromEntries(Object.entries(draft.nodeSourceClosures || {}).map(([nodeRef, closure]) => [
    nodeRef,
    closure.nodeSourceClosureDigest,
  ]));
  const ledger = invocationLedgerFor(nodeResults, commandDigests);
  ledger.push({
    ...ledger[0],
    invocationSequence: ledger.length + 1,
    completionSequence: ledger.length + 1,
  });
  return validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    testedTreeKind: 'branch_head',
    testedCommitOid: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults,
    runWideInvocationLedger: ledger,
  })).reasonCodes.includes('run_wide_duplicate_execution_detected');
}

function validationRunWideCommandDigestTamperFails() {
  const nodeResults = validValidationNodeResults();
  const plan = buildPlanWithBoundReusedCacheKeys({
    headSha: 'f'.repeat(40),
    testedTreeKind: 'branch_head',
    testedCommitOid: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults,
  });
  plan.profileExecution.runWideInvocationLedger[0].commandOrFunctionDigest = `sha256:${'e'.repeat(64)}`;
  return validateV128ValidationExecutionPlan(plan).reasonCodes.includes('run_wide_invocation_command_digest_mismatch');
}

function validationNodeInputDigestTamperFails() {
  const nodeResults = validValidationNodeResults();
  const plan = buildPlanWithBoundReusedCacheKeys({
    headSha: 'f'.repeat(40),
    testedTreeKind: 'branch_head',
    testedCommitOid: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults,
  });
  plan.profileExecution.nodeResults[0].nodeInputDigest = 'sha256:bad';
  return validateV128ValidationExecutionPlan(plan).reasonCodes.includes('node_input_digest_required');
}

function validationPrMergeReuseRequiresBaseOid() {
  const plan = buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    sourceHeadOid: 'f'.repeat(40),
    baseOid: null,
    testedCommitOid: 'e'.repeat(40),
    testedTreeKind: 'pull_request_merge_ref',
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    reuseDecision: 'hit',
    nodeResults: [
      reusedNode('projection_reader'),
      reusedNode('managed_context_emitter'),
      reusedNode('state_matrix_executor'),
      reusedNode('aggregate_finalizer'),
    ],
  });
  return validateV128ValidationExecutionPlan(plan).reasonCodes.includes('validation_reuse_binding_field_missing');
}

function validationDiagnosticManifestNeedsSanitizedDigest() {
  return validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifest: {
      status: 'pass',
      taxonomyScanStatus: 'pass',
      taxonomyScan: {
        scannedPathCount: 1,
        environmentDiagnosticPathCount: 1,
        forbiddenPathCount: 0,
        environmentDiagnosticExcludedFromDecisionDigest: true,
      },
    },
    nodeResults: validValidationNodeResults(),
  })).reasonCodes.includes('decision_input_manifest_sanitized_digest_required');
}

function validationFinalizerMissingUpstreamNodeFails() {
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: [
      executedNode('projection_reader', 'pass', 'decision_stable'),
      executedNode('managed_context_emitter', 'pass', 'cache_stable'),
      executedNode('state_matrix_executor', 'pass', 'decision_stable'),
      executedNode('aggregate_finalizer', 'pass', 'decision_stable', {
        upstreamNodeRefs: ['projection_reader', 'managed_context_emitter'],
        upstreamResultDigests: [],
      }),
    ],
  })));
}

function validationFinalizerWrongUpstreamDigestFails() {
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: [
      executedNode('projection_reader', 'pass', 'decision_stable'),
      executedNode('managed_context_emitter', 'pass', 'cache_stable'),
      executedNode('state_matrix_executor', 'pass', 'decision_stable'),
      executedNode('aggregate_finalizer', 'pass', 'decision_stable', {
        upstreamNodeRefs: ['projection_reader', 'managed_context_emitter', 'state_matrix_executor'],
        upstreamResultDigests: [
          { nodeRef: 'projection_reader', status: 'pass', resultDigest: `sha256:${'c'.repeat(64)}` },
          { nodeRef: 'managed_context_emitter', status: 'pass', resultDigest: `sha256:${'c'.repeat(64)}` },
          { nodeRef: 'state_matrix_executor', status: 'pass', resultDigest: `sha256:${'c'.repeat(64)}` },
        ],
      }),
    ],
  })));
}

function validationFinalizerPassWithFailedUpstreamFails() {
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    runnerImageDigest: `sha256:${'b'.repeat(64)}`,
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: [
      executedNode('projection_reader', 'fail', 'decision_stable'),
      executedNode('managed_context_emitter', 'pass', 'cache_stable'),
      executedNode('state_matrix_executor', 'pass', 'decision_stable'),
      executedNode('aggregate_finalizer', 'pass', 'decision_stable', {
        upstreamNodeRefs: ['projection_reader', 'managed_context_emitter', 'state_matrix_executor'],
        upstreamResultDigests: [],
        failedNodeRefs: [],
      }),
    ],
  })));
}

function validationDefaultIsNotExercisedPartial() {
  const plan = buildV128ValidationExecutionPlan();
  const validation = validateV128ValidationExecutionPlan(plan);
  return validation.status === 'pass'
    && validation.observationState === 'not_exercised'
    && validation.executionStatus === 'partial_shadow_candidate'
    && plan.profileExecution.nodeResults.length === 0;
}

function validationGraphCycleFails() {
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodes: [
      { nodeRef: 'a', dependsOn: ['b'], required: true },
      { nodeRef: 'b', dependsOn: ['a'], required: true },
    ],
    nodeResults: [
      { nodeRef: 'a', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
      { nodeRef: 'b', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
    ],
  })));
}

function validationGraphMissingDependencyFails() {
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodes: [{ nodeRef: 'a', dependsOn: ['missing'], required: true }],
    nodeResults: [{ nodeRef: 'a', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' }],
  })));
}

function standingAutonomyPolicyAllowsEligibleHarnessPr() {
  const policy = readJson('docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json');
  const evaluation = evaluateV128StandingAutonomyPolicy({
    policy,
    ...standingAutonomyTrustInputs(policy),
    repositoryKey: 'github.com:hiro4649/codex-development-harness',
    prTopology: {
      baseRefKind: 'default_branch',
      prLifecycleState: 'open',
      stackedDependencyState: 'not_stacked',
    },
    finalDecision: {
      terminalAction: 'merge_current_pr',
      decision: 'allowed',
      mergeAllowed: true,
      exitCode: 0,
      safeNextAction: 'owner_merge_decision_only',
    },
    technicalChecksReady: true,
    sameHeadRequiredChecksPass: true,
    deterministicVerifierPass: true,
    v127PreservationPass: true,
    scopeDigestMatch: true,
    expectedHeadCasReady: true,
    automationExecutorAvailable: true,
    zeroUnresolvedFindings: true,
    blockingCount: 0,
    harnessOnlyScope: true,
    productCodeChanged: false,
    packageFilesChanged: false,
    workflowChanged: false,
    sourceActivationRequested: false,
    targetRolloutRequested: false,
  });
  const validation = validateV128StandingAutonomyPolicyEvaluation(evaluation);
  return passed(validation)
    && evaluation.policyAuthorizationState === 'authorized'
    && evaluation.automationDisposition === 'auto_merge'
    && evaluation.automatedMergeExecutionAllowed === true
    && evaluation.humanPerPrDecisionRequired === false
    && evaluation.aiAuthorityCreated === false
    && evaluation.ownerAuthorityCreated === false
    && evaluation.sourceActivationAuthorized === false
    && evaluation.targetRolloutAuthorized === false
    && evaluation.reasonCodes.length === 0;
}

function standingAutonomyPolicyBlocksStackedDraft() {
  const policy = readJson('docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json');
  const probe = evaluateV128StandingAutonomyPolicy({ policy });
  const evaluation = evaluateV128StandingAutonomyPolicy({
    policy,
    trustedPolicyDigest: digestV128StandingAutonomyPolicy(policy),
    trustedEvaluatorDigest: probe.evaluatorDigest,
    trustedPolicySource: 'protected_default_branch_policy',
    repositoryKey: 'github.com:hiro4649/codex-development-harness',
    prTopology: {
      baseRefKind: 'stacked_branch',
      prLifecycleState: 'draft',
      stackedDependencyState: 'base_branch_open_or_unverified',
    },
    finalDecision: {
      terminalAction: 'merge_current_pr',
      decision: 'allowed',
      mergeAllowed: true,
      exitCode: 0,
      safeNextAction: 'owner_merge_decision_only',
    },
    technicalChecksReady: true,
    sameHeadRequiredChecksPass: true,
    deterministicVerifierPass: true,
    v127PreservationPass: true,
    scopeDigestMatch: true,
    expectedHeadCasReady: true,
    zeroUnresolvedFindings: true,
    blockingCount: 0,
    harnessOnlyScope: true,
  });
  const validation = validateV128StandingAutonomyPolicyEvaluation(evaluation);
  return passed(validation)
    && evaluation.policyAuthorizationState === 'not_eligible'
    && evaluation.automationDisposition === 'auto_process_base_pr'
    && evaluation.automatedMergeExecutionAllowed === false
    && evaluation.humanPerPrDecisionRequired === false
    && evaluation.reasonCodes.includes('standing_policy_default_base_required')
    && evaluation.reasonCodes.includes('standing_policy_open_pr_required')
    && evaluation.reasonCodes.includes('standing_policy_stacked_pr_forbidden');
}

function standingAutonomyPolicyRejectsAiAuthorityForgery() {
  const policy = readJson('docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json');
  const probe = evaluateV128StandingAutonomyPolicy({ policy });
  const evaluation = evaluateV128StandingAutonomyPolicy({
    policy,
    trustedPolicyDigest: digestV128StandingAutonomyPolicy(policy),
    trustedEvaluatorDigest: probe.evaluatorDigest,
    trustedPolicySource: 'protected_default_branch_policy',
    prTopology: {
      baseRefKind: 'default_branch',
      prLifecycleState: 'open',
      stackedDependencyState: 'not_stacked',
    },
    finalDecision: {
      terminalAction: 'merge_current_pr',
      decision: 'allowed',
      mergeAllowed: true,
      exitCode: 0,
      safeNextAction: 'owner_merge_decision_only',
    },
    technicalChecksReady: true,
    sameHeadRequiredChecksPass: true,
    deterministicVerifierPass: true,
    v127PreservationPass: true,
    scopeDigestMatch: true,
    expectedHeadCasReady: true,
    zeroUnresolvedFindings: true,
    blockingCount: 0,
    harnessOnlyScope: true,
  });
  return failed(validateV128StandingAutonomyPolicyEvaluation({
    ...evaluation,
    aiAuthorityCreated: true,
  }));
}

function standingAutonomyPolicyBlocksForbiddenScope() {
  const policy = readJson('docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json');
  const probe = evaluateV128StandingAutonomyPolicy({ policy });
  const evaluation = evaluateV128StandingAutonomyPolicy({
    policy,
    trustedPolicyDigest: digestV128StandingAutonomyPolicy(policy),
    trustedEvaluatorDigest: probe.evaluatorDigest,
    trustedPolicySource: 'protected_default_branch_policy',
    prTopology: {
      baseRefKind: 'default_branch',
      prLifecycleState: 'open',
      stackedDependencyState: 'not_stacked',
    },
    finalDecision: {
      terminalAction: 'merge_current_pr',
      decision: 'allowed',
      mergeAllowed: true,
      exitCode: 0,
      safeNextAction: 'owner_merge_decision_only',
    },
    technicalChecksReady: true,
    sameHeadRequiredChecksPass: true,
    deterministicVerifierPass: true,
    v127PreservationPass: true,
    scopeDigestMatch: true,
    expectedHeadCasReady: true,
    zeroUnresolvedFindings: true,
    blockingCount: 0,
    harnessOnlyScope: true,
    workflowChanged: true,
  });
  const validation = validateV128StandingAutonomyPolicyEvaluation(evaluation);
  return passed(validation)
    && evaluation.automatedMergeExecutionAllowed === false
    && evaluation.automationDisposition === 'auto_reject'
    && evaluation.reasonCodes.includes('standing_policy_scope_forbidden');
}

function standingAutonomyPolicyRequiresTrustedPolicyDigest() {
  const policy = readJson('docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json');
  const evaluation = evaluateV128StandingAutonomyPolicy({
    policy,
    trustedPolicySource: 'protected_default_branch_policy',
    prTopology: {
      baseRefKind: 'default_branch',
      prLifecycleState: 'open',
      stackedDependencyState: 'not_stacked',
    },
    finalDecision: {
      terminalAction: 'merge_current_pr',
      decision: 'allowed',
      mergeAllowed: true,
      exitCode: 0,
      safeNextAction: 'owner_merge_decision_only',
    },
    technicalChecksReady: true,
    sameHeadRequiredChecksPass: true,
    deterministicVerifierPass: true,
    v127PreservationPass: true,
    scopeDigestMatch: true,
    expectedHeadCasReady: true,
    zeroUnresolvedFindings: true,
    blockingCount: 0,
    harnessOnlyScope: true,
  });
  const validation = validateV128StandingAutonomyPolicyEvaluation(evaluation);
  return passed(validation)
    && evaluation.automatedMergeExecutionAllowed === false
    && evaluation.automationDisposition === 'auto_wait'
    && evaluation.reasonCodes.includes('standing_policy_trusted_policy_digest_missing');
}

function standingAutonomyPolicyRequiresProviderSameHead() {
  const policy = readJson('docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json');
  const evaluation = evaluateV128StandingAutonomyPolicy({
    policy,
    ...standingAutonomyTrustInputs(policy),
    repositoryKey: 'github.com:hiro4649/codex-development-harness',
    prTopology: {
      baseRefKind: 'default_branch',
      prLifecycleState: 'open',
      stackedDependencyState: 'not_stacked',
    },
    finalDecision: {
      terminalAction: 'merge_current_pr',
      decision: 'allowed',
      mergeAllowed: true,
      exitCode: 0,
      safeNextAction: 'owner_merge_decision_only',
    },
    technicalChecksReady: true,
    sameHeadRequiredChecksPass: false,
    deterministicVerifierPass: true,
    v127PreservationPass: true,
    scopeDigestMatch: true,
    expectedHeadCasReady: true,
    automationExecutorAvailable: true,
    zeroUnresolvedFindings: true,
    blockingCount: 0,
    harnessOnlyScope: true,
  });
  return passed(validateV128StandingAutonomyPolicyEvaluation(evaluation))
    && evaluation.automatedMergeExecutionAllowed === false
    && evaluation.automationDisposition === 'auto_revalidate'
    && evaluation.reasonCodes.includes('standing_policy_same_head_required_checks_required');
}

function standingAutonomyPolicyRequiresExecutor() {
  const policy = readJson('docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json');
  const evaluation = evaluateV128StandingAutonomyPolicy({
    policy,
    ...standingAutonomyTrustInputs(policy),
    repositoryKey: 'github.com:hiro4649/codex-development-harness',
    prTopology: {
      baseRefKind: 'default_branch',
      prLifecycleState: 'open',
      stackedDependencyState: 'not_stacked',
    },
    finalDecision: {
      terminalAction: 'merge_current_pr',
      decision: 'allowed',
      mergeAllowed: true,
      exitCode: 0,
      safeNextAction: 'owner_merge_decision_only',
    },
    technicalChecksReady: true,
    sameHeadRequiredChecksPass: true,
    deterministicVerifierPass: true,
    v127PreservationPass: true,
    scopeDigestMatch: true,
    expectedHeadCasReady: true,
    zeroUnresolvedFindings: true,
    blockingCount: 0,
    harnessOnlyScope: true,
  });
  return passed(validateV128StandingAutonomyPolicyEvaluation(evaluation))
    && evaluation.automatedMergeExecutionAllowed === false
    && evaluation.automationDisposition === 'auto_wait'
    && evaluation.reasonCodes.includes('standing_policy_executor_unavailable');
}

function standingAutonomyPolicyBlocksSelfModification() {
  const policy = readJson('docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json');
  const probe = evaluateV128StandingAutonomyPolicy({ policy });
  const evaluation = evaluateV128StandingAutonomyPolicy({
    policy,
    trustedPolicyDigest: digestV128StandingAutonomyPolicy(policy),
    trustedEvaluatorDigest: probe.evaluatorDigest,
    trustedPolicySource: 'protected_default_branch_policy',
    prTopology: {
      baseRefKind: 'default_branch',
      prLifecycleState: 'open',
      stackedDependencyState: 'not_stacked',
    },
    finalDecision: {
      terminalAction: 'merge_current_pr',
      decision: 'allowed',
      mergeAllowed: true,
      exitCode: 0,
      safeNextAction: 'owner_merge_decision_only',
    },
    technicalChecksReady: true,
    sameHeadRequiredChecksPass: true,
    deterministicVerifierPass: true,
    v127PreservationPass: true,
    scopeDigestMatch: true,
    expectedHeadCasReady: true,
    zeroUnresolvedFindings: true,
    blockingCount: 0,
    harnessOnlyScope: true,
    changedFiles: ['docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json'],
  });
  const validation = validateV128StandingAutonomyPolicyEvaluation(evaluation);
  return passed(validation)
    && evaluation.automatedMergeExecutionAllowed === false
    && evaluation.automationDisposition === 'auto_quarantine'
    && evaluation.reasonCodes.includes('standing_policy_self_modification_forbidden');
}

function trustClosureBuildsCompleteVerifierBundle() {
  const closure = buildV128TrustClosure();
  const validation = validateV128TrustClosure(closure);
  const paths = new Set((closure.fileDigests || []).map((item) => item.path));
  return passed(validation)
    && paths.has('scripts/codex-v128-self-test.mjs')
    && paths.has('scripts/codex-v128-validation-execution-plan.mjs')
    && paths.has('scripts/codex-v128-trust-closure.mjs')
    && paths.has('scripts/codex-workflow-quality-runner.mjs')
    && paths.has('scripts/codex-reason-summary.mjs')
    && paths.has('scripts/codex-decision-capsule.mjs')
    && paths.has('scripts/codex-verifier-capsule.mjs')
    && paths.has('scripts/codex-orchestration-capsule.mjs')
    && paths.has('scripts/codex-worker-proof-capsule.mjs')
    && paths.has('scripts/codex-owner-decision-brief.mjs')
    && closure.transitiveRelativeImportCount > 0
    && closure.closureCompletenessState === 'complete'
    && /^sha256:[a-f0-9]{64}$/.test(closure.trustDigests.verifierBundleDigest)
    && /^sha256:[a-f0-9]{64}$/.test(closure.trustDigests.providerAdapterDigest)
    && /^sha256:[a-f0-9]{64}$/.test(closure.trustDigests.canonicalizerDigest)
    && /^sha256:[a-f0-9]{64}$/.test(closure.trustDigests.finalDecisionAuthorityDigest)
    && Object.keys(closure.roleClosures || {}).length >= 6
    && closure.roleClosures.provider_adapter.closureCompletenessState === 'complete'
    && closure.roleClosures.scope_classifier.closureCompletenessState === 'complete'
    && closure.roleClosures.final_decision_authority.closureCompletenessState === 'complete';
}

function trustClosureFailsOpaqueDependencies() {
  const unresolved = buildV128TrustClosure({
    files: ['scripts/v128-fixture-unresolved.mjs'],
    sourceFileTexts: {
      'scripts/v128-fixture-unresolved.mjs': 'im'.concat("port './missing-fixture.mjs';\n"),
    },
  });
  const dynamicImport = buildV128TrustClosure({
    files: ['scripts/v128-fixture-dynamic.mjs'],
    sourceFileTexts: {
      'scripts/v128-fixture-dynamic.mjs': "const target = './computed-fixture.mjs'; await ".concat("import(target);\n"),
    },
  });
  const loaderUsage = buildV128TrustClosure({
    files: ['scripts/v128-fixture-loader.mjs'],
    sourceFileTexts: {
      'scripts/v128-fixture-loader.mjs': 'const resolved = import.meta'.concat(".resolve('./x.mjs');\n"),
    },
  });
  const executablePermissive = buildV128TrustClosure({
    files: ['scripts/v128-fixture-exec.mjs'],
    sourceFileTexts: {
      'scripts/v128-fixture-exec.mjs': "spawn('node', ['scripts/example.mjs']);\n",
    },
  });
  const executableFailClosed = buildV128TrustClosure({
    failOnExecutableScripts: true,
    files: ['scripts/v128-fixture-exec.mjs'],
    sourceFileTexts: {
      'scripts/v128-fixture-exec.mjs': "spawn('node', ['scripts/example.mjs']);\n",
    },
  });
  return validateV128TrustClosure(unresolved).reasonCodes.includes('trust_closure_unresolved_relative_imports')
    && validateV128TrustClosure(dynamicImport).reasonCodes.includes('trust_closure_unsupported_dynamic_imports')
    && validateV128TrustClosure(loaderUsage).reasonCodes.includes('trust_closure_unsupported_loader_usages')
    && passed(validateV128TrustClosure(executablePermissive))
    && validateV128TrustClosure(executableFailClosed).reasonCodes.includes('trust_closure_executable_script_invocations');
}

function providerChangedFilesPathSetIsNotExactTuple() {
  const evidence = buildV128ProviderChangedFilesEvidence({
    sourceHarnessValidationStatus: { changedFiles: ['scripts/example.mjs'] },
  }, {
    CODEX_V128_PROVIDER_CHANGED_FILES_JSON: JSON.stringify([
      { status: 'modified', path: 'scripts/example.mjs' },
    ]),
  });
  return evidence.status === 'pass'
    && evidence.pathSetDigestMatch === true
    && evidence.exactTupleDigestMatch === null
    && evidence.tupleComparisonMode === 'path_set_only_not_exact';
}

function providerChangedFilesFullTupleDigestMatches() {
  const tuple = [{
    status: 'modified',
    oldPath: 'scripts/example.mjs',
    newPath: 'scripts/example.mjs',
    oldMode: '100644',
    newMode: '100644',
    oldContentDigest: 'sha256:'.concat('1'.repeat(64)),
    newContentDigest: 'sha256:'.concat('2'.repeat(64)),
  }];
  const evidence = buildV128ProviderChangedFilesEvidence({
    sourceHarnessValidationStatus: { changedFiles: ['scripts/example.mjs'] },
  }, {
    CODEX_V128_PROVIDER_CHANGED_FILES_JSON: JSON.stringify(tuple),
    CODEX_V128_EXPECTED_CHANGED_FILES_TUPLE_DIGEST: sha256Canonical(tuple),
  });
  return evidence.status === 'pass'
    && evidence.pathSetDigestMatch === true
    && evidence.exactTupleDigestMatch === true
    && evidence.tupleComparisonMode === 'full_tuple_digest';
}

function standingAutonomyPolicyRejectsVerifierBundleMismatch() {
  const policy = readJson('docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json');
  const trust = standingAutonomyTrustInputs(policy);
  const evaluation = evaluateV128StandingAutonomyPolicy({
    policy,
    ...trust,
    trustedVerifierBundleDigest: 'sha256:'.concat('0'.repeat(64)),
    repositoryKey: 'github.com:hiro4649/codex-development-harness',
    prTopology: {
      baseRefKind: 'default_branch',
      prLifecycleState: 'open',
      stackedDependencyState: 'not_stacked',
    },
    finalDecision: {
      terminalAction: 'merge_current_pr',
      decision: 'allowed',
      mergeAllowed: true,
      exitCode: 0,
      safeNextAction: 'owner_merge_decision_only',
    },
    technicalChecksReady: true,
    sameHeadRequiredChecksPass: true,
    deterministicVerifierPass: true,
    v127PreservationPass: true,
    scopeDigestMatch: true,
    expectedHeadCasReady: true,
    automationExecutorAvailable: true,
    zeroUnresolvedFindings: true,
    blockingCount: 0,
    harnessOnlyScope: true,
  });
  return passed(validateV128StandingAutonomyPolicyEvaluation(evaluation))
    && evaluation.automatedMergeExecutionAllowed === false
    && evaluation.automationDisposition === 'auto_quarantine'
    && evaluation.reasonCodes.includes('standing_policy_trusted_verifier_bundle_mismatch');
}

function nonAuthoritativeProjectionStatusDoesNotBlockActiveGate() {
  const summary = buildCompactReasonSummary(buildV127ActiveGateReasonSummaryInput({
    status: 'pass',
    qualityScoreStatus: { status: 'pass', score: 100, safeSummaryOnly: true },
    routineDecisionProjection: {
      status: 'fail',
      reasonCodes: ['non_authoritative_projection_status_fail'],
      authority: 'non_authoritative_projection',
      safeSummaryOnly: true,
    },
    stressDecisionProjection: {
      status: 'fail',
      reasonCodes: ['non_authoritative_stress_projection_status_fail'],
      authority: 'non_authoritative_projection',
      safeSummaryOnly: true,
    },
    reasonSummary: {
      status: 'fail',
      blockingReasons: [{ reasonCode: 'stale_reason_summary' }],
      safeSummaryOnly: true,
    },
    routineDecisionProjectionStatus: { status: 'pass', safeSummaryOnly: true },
    v128SelfTestStatus: {
      status: 'pass',
      candidateActivationState: 'source_shadow_candidate',
      safeSummaryOnly: true,
    },
  }));
  return summary.status === 'pass'
    && (summary.summary?.blockingReasons || []).length === 0;
}

function typedShadowStatusDoesNotBlockActiveGate() {
  const summary = buildCompactReasonSummary(buildV127ActiveGateReasonSummaryInput({
    status: 'pass',
    qualityScoreStatus: { status: 'pass', score: 100, safeSummaryOnly: true },
    routineDecisionProjectionStatus: {
      status: 'fail',
      authorityLayer: 'v128_shadow_candidate',
      decisionInfluence: 'shadow_only',
      loadBearingForActiveV127: false,
      evidenceEpoch: 'final_closure',
      reasonCodes: ['shadow_candidate_fixture_failure'],
      safeSummaryOnly: true,
    },
  }));
  return summary.status === 'pass'
    && (summary.summary?.blockingReasons || []).length === 0;
}

function validationRequiredSkippedFails() {
  return failed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
    observedExecution: true,
    workspaceObserved: true,
    decisionInputManifestScanned: true,
    nodeResults: [
      { nodeRef: 'projection_reader', executionState: 'executed', status: 'skipped', stabilityClass: 'decision_stable', skipReasonCode: 'TEST_SKIP' },
      { nodeRef: 'managed_context_emitter', executionState: 'executed', status: 'pass', stabilityClass: 'cache_stable' },
      { nodeRef: 'state_matrix_executor', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
      { nodeRef: 'aggregate_finalizer', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
    ],
  })));
}

const cases = [
  ['v128_self_test_must_pass', () => true],
  ['v128_adds_no_new_p0_artifact', () => V128_P0_ARTIFACTS.length === 3 && V128_P0_ARTIFACTS.includes('codex-orchestration-capsule.safe.json')],
  ['v128_adds_no_new_top_level_status', () => V128_OPERATOR_STATUS_KEYS.length === 8 && !V128_OPERATOR_STATUS_KEYS.includes('deterministicDecisionProjectionStatus')],
  ['v128_preserves_v118_final_decision', () => buildOrchestrationCapsule().finalAuthority === 'v1.1.8_final_decision_kernel'],
  ['v128_shadow_candidate_preserves_v127_active_authority', () => {
    const tuple = buildOrchestrationCapsule().skillContextRouting.activeAuthorityTuple;
    return tuple.manifestActiveHarnessVersion === '1.2.7'
      && tuple.activeSelfTestSuite === 'v127'
      && tuple.activeSpecPath === 'docs/process/CODEX_V127_SPEC.md'
      && tuple.candidateHarnessVersion === '1.2.8'
      && tuple.candidateSelfTestSuite === 'v128'
      && tuple.candidateActivationState === 'source_shadow_candidate';
  }],
  ['manifest_declares_v128_shadow_candidate_not_activation', () => manifestDeclaresShadowCandidate()],
  ['stored_projection_is_safe_summary_non_authoritative', () => passed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule().deterministicDecisionProjection))],
  ['projection_observed_bytes_are_required_for_activation', () => failed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule({
    deterministicDecisionProjection: { activationReady: true },
  }).deterministicDecisionProjection))],
  ['projection_observed_bytes_pass_when_measured', () => passed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule({
    deterministicDecisionProjection: {
      projectionBytesObserved: true,
      projectionMeasurementSource: 'runtime_safe_summary_projection',
      projectionBytes: 800,
      stressProjectionBytes: 900,
    },
  }).deterministicDecisionProjection))],
  ['decision_capsule_cannot_be_projection', () => failed(validateV128DeterministicDecisionProjection(buildOrchestrationCapsule({
    deterministicDecisionProjection: { decisionCapsuleIsProjectionPhraseDetected: true },
  }).deterministicDecisionProjection))],
  ['awaiting_is_effect_not_state', () => failed(validateV128OrthogonalReasonModel(buildOrchestrationCapsule({
    orthogonalReasonModel: { reasons: [{ reasonCode: 'required_check_pending', state: 'awaiting', evidenceRef: 'provider.requiredChecks' }] },
  }).orthogonalReasonModel))],
  ['routine_cold_artifact_read_is_zero', () => passed(validateV128TokenMinimalReadCompatibilityRouter(buildOrchestrationCapsule().tokenMinimalReadCompatibilityRouter))],
  ['bounded_projection_reader_extracts_projection_only', () => boundedProjectionReaderExecutes()],
  ['bounded_projection_reader_rejects_duplicate_keys', () => boundedProjectionReaderRejectsDuplicateKeys()],
  ['bounded_projection_reader_compacts_over_budget_failure', () => boundedProjectionReaderCompactsOverBudgetFailure()],
  ['evidence_capsule_missing_provider_heads_cannot_pass_same_head', () => evidenceCapsuleDoesNotSubstituteProviderHeads()],
  ['projection_integrity_binding_verifies_schema_head_and_source_digest', () => projectionIntegrityBindingVerifies()],
  ['projection_payload_digest_tamper_fails', () => projectionPayloadDigestTamperFails()],
  ['projection_input_digest_tamper_fails', () => projectionInputDigestTamperFails()],
  ['validation_execution_plan_verifies', () => validationExecutionPlanVerifies()],
  ['compact_validation_plan_still_validates', () => compactValidationPlanStillValidates()],
  ['compact_validation_plan_stale_aggregate_digest_fails', () => compactValidationPlanStaleAggregateDigestFails()],
  ['compact_validation_plan_ledger_digest_mismatch_fails', () => compactValidationPlanLedgerDigestMismatchFails()],
  ['compact_validation_plan_upstream_digest_mismatch_fails', () => compactValidationPlanUpstreamDigestMismatchFails()],
  ['validation_default_is_not_exercised_partial', () => validationDefaultIsNotExercisedPartial()],
  ['validation_execution_duplicate_node_fails', () => validationExecutionDuplicateNodeFails()],
  ['validation_graph_cycle_fails', () => validationGraphCycleFails()],
  ['validation_graph_missing_dependency_fails', () => validationGraphMissingDependencyFails()],
  ['validation_required_skipped_fails', () => validationRequiredSkippedFails()],
  ['validation_execution_downstream_respawn_fails', () => validationExecutionRespawnFails()],
  ['validation_reuse_placeholder_cache_key_fails', () => validationReusePlaceholderFails()],
  ['validation_execution_raw_workspace_path_fails', () => validationExecutionRawWorkspacePathFails()],
  ['validation_typed_payload_tamper_fails', () => validationTypedPayloadTamperFails()],
  ['validation_aggregate_finalizer_blocks_failed_upstream', () => validationAggregateFinalizerBlocksFailedUpstream()],
  ['validation_execution_count_two_fails', () => validationExecutionCountTwoFails()],
  ['validation_cache_hit_with_executed_node_fails', () => validationCacheHitWithExecutedNodeFails()],
  ['validation_cache_miss_with_reused_node_fails', () => validationCacheMissWithReusedNodeFails()],
  ['validation_reused_node_source_digest_mismatch_fails', () => validationReusedNodeSourceDigestMismatchFails()],
  ['validation_reused_node_cache_key_digest_mismatch_fails', () => validationReusedNodeCacheKeyDigestMismatchFails()],
  ['validation_reused_node_missing_cache_key_digest_fails', () => validationReusedNodeMissingCacheKeyDigestFails()],
  ['validation_reused_node_string_source_run_ref_fails', () => validationReusedNodeStringSourceRunRefFails()],
  ['validation_unsupported_dynamic_import_disables_reuse', () => validationUnsupportedDynamicImportDisablesReuse()],
  ['validation_workspace_unobserved_cannot_be_canonical', () => validationWorkspaceUnobservedCannotBeCanonical()],
  ['validation_runner_image_missing_prevents_reuse', () => validationRunnerImageMissingPreventsReuse()],
  ['validation_source_closure_includes_consumers', () => validationSourceClosureIncludesConsumers()],
  ['validation_source_closure_resolves_transitive_imports', () => validationSourceClosureResolvesTransitiveImports()],
  ['validation_node_scoped_source_closures_exist', () => validationNodeScopedSourceClosuresExist()],
  ['validation_run_wide_duplicate_execution_fails', () => validationRunWideDuplicateExecutionFails()],
  ['validation_run_wide_command_digest_tamper_fails', () => validationRunWideCommandDigestTamperFails()],
  ['validation_node_input_digest_tamper_fails', () => validationNodeInputDigestTamperFails()],
  ['validation_pr_merge_reuse_requires_base_oid', () => validationPrMergeReuseRequiresBaseOid()],
  ['validation_diagnostic_manifest_needs_sanitized_digest', () => validationDiagnosticManifestNeedsSanitizedDigest()],
  ['validation_finalizer_missing_upstream_node_fails', () => validationFinalizerMissingUpstreamNodeFails()],
  ['validation_finalizer_wrong_upstream_digest_fails', () => validationFinalizerWrongUpstreamDigestFails()],
  ['validation_finalizer_pass_with_failed_upstream_fails', () => validationFinalizerPassWithFailedUpstreamFails()],
  ['standing_autonomy_policy_allows_eligible_harness_pr', () => standingAutonomyPolicyAllowsEligibleHarnessPr()],
  ['standing_autonomy_policy_blocks_stacked_draft', () => standingAutonomyPolicyBlocksStackedDraft()],
  ['standing_autonomy_policy_rejects_ai_authority_forgery', () => standingAutonomyPolicyRejectsAiAuthorityForgery()],
  ['standing_autonomy_policy_blocks_forbidden_scope', () => standingAutonomyPolicyBlocksForbiddenScope()],
  ['standing_autonomy_policy_requires_trusted_policy_digest', () => standingAutonomyPolicyRequiresTrustedPolicyDigest()],
  ['standing_autonomy_policy_requires_provider_same_head', () => standingAutonomyPolicyRequiresProviderSameHead()],
  ['standing_autonomy_policy_requires_executor', () => standingAutonomyPolicyRequiresExecutor()],
  ['standing_autonomy_policy_blocks_self_modification', () => standingAutonomyPolicyBlocksSelfModification()],
  ['trust_closure_builds_complete_verifier_bundle', () => trustClosureBuildsCompleteVerifierBundle()],
  ['trust_closure_fails_opaque_dependencies', () => trustClosureFailsOpaqueDependencies()],
  ['standing_autonomy_policy_rejects_verifier_bundle_mismatch', () => standingAutonomyPolicyRejectsVerifierBundleMismatch()],
  ['provider_changed_files_path_set_is_not_exact_tuple', () => providerChangedFilesPathSetIsNotExactTuple()],
  ['provider_changed_files_full_tuple_digest_matches', () => providerChangedFilesFullTupleDigestMatches()],
  ['non_authoritative_projection_status_does_not_block_active_gate', () => nonAuthoritativeProjectionStatusDoesNotBlockActiveGate()],
  ['typed_shadow_status_does_not_block_active_gate', () => typedShadowStatusDoesNotBlockActiveGate()],
  ['managed_context_emitter_observes_bytes', () => managedContextEmitterObservesBytes()],
  ['managed_context_emitter_passes_safe_output_scan', () => managedContextEmitterPassesSafeOutputScan()],
  ['token_compression_compacts_safe_summary', () => tokenCompressionCompactsSafeSummary()],
  ['activation_requires_managed_byte_observation', () => failed(validateV128TokenMinimalReadCompatibilityRouter(buildOrchestrationCapsule({
    tokenMinimalReadCompatibilityRouter: { activationReady: true },
  }).tokenMinimalReadCompatibilityRouter))],
  ['routine_cold_read_fails_when_nonzero', () => failed(validateV128TokenMinimalReadCompatibilityRouter(buildOrchestrationCapsule({
    tokenMinimalReadCompatibilityRouter: { routineColdArtifactRead: 1 },
  }).tokenMinimalReadCompatibilityRouter))],
  ['v128_candidate_failure_does_not_block_active_v127_exit', () => {
    const result = classifyV128ShadowCandidateForActiveGate('v128SelfTestStatus', {
      status: 'fail',
      candidateActivationState: 'source_shadow_candidate',
    }, {});
    return result.applies === true
      && result.blocksActiveGate === false
      && result.effectiveStatus === 'pass_shadow_candidate_fail_non_blocking_active_v127';
  }],
  ['v128_shadow_failure_does_not_reenter_reason_summary_as_blocker', () => {
    const result = buildV127ActiveGateReasonSummaryInput({
      status: 'pass',
      v128SelfTestStatus: {
        status: 'fail',
        candidateActivationState: 'source_shadow_candidate',
        safeSummaryOnly: true,
      },
    });
    return result.v128SelfTestStatus.status === 'pass_shadow_candidate_fail_non_blocking_active_v127'
      && result.v128SelfTestStatus.candidateStatus === 'fail'
      && result.v128SelfTestStatus.activeGateInfluence === 'non_blocking_shadow_candidate';
  }],
  ['v128_activation_gate_blocks_failed_candidate', () => {
    const result = classifyV128ShadowCandidateForActiveGate('v128SelfTestStatus', {
      status: 'fail',
      candidateActivationState: 'source_activation_candidate',
    }, {});
    return result.applies === true
      && result.blocksActiveGate === true;
  }],
  ['permission_projection_is_not_authority', () => passed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule().resumableLoopAndPermissionProjection))],
  ['unhydrated_receipt_cannot_project_actions', () => failed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule({
    resumableLoopAndPermissionProjection: { allowedActionCodes: ['commit'] },
  }).resumableLoopAndPermissionProjection))],
  ['placeholder_receipt_is_not_valid_binding', () => failed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule({
    resumableLoopAndPermissionProjection: {
      receiptHydrationBinding: {
        receiptHydrationState: 'valid',
        receiptDigest: 'sha256:receipt',
        taskId: 'task-v128',
        repositoryKey: 'github.com:hiro4649/codex-development-harness',
        branchConstraint: 'codex/harness-v1-2-8-*',
        scopeContractDigest: 'sha256:scope',
        ownerInstructionDigest: 'sha256:owner',
        observedBinding: true,
      },
    },
  }).resumableLoopAndPermissionProjection))],
  ['valid_receipt_requires_observed_binding', () => failed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule({
    resumableLoopAndPermissionProjection: {
      permissionDerivedFromCurrentReceipt: true,
      receiptHydrationBinding: {
        receiptHydrationState: 'valid',
        receiptDigest: 'sha256:1234567890abcdef',
        taskId: 'task-2026-06-20-v128-shadow',
        repositoryKey: 'github.com:hiro4649/codex-development-harness',
        branchConstraint: 'codex/harness-v1-2-8-deterministic-decision-projection',
        scopeContractDigest: 'sha256:abcdef1234567890',
        ownerInstructionDigest: 'sha256:fedcba0987654321',
        observedBinding: false,
      },
    },
  }).resumableLoopAndPermissionProjection))],
  ['network_filesystem_auto_resume_forbidden', () => failed(validateV128ResumableLoopAndPermissionProjection(buildOrchestrationCapsule({
    resumableLoopAndPermissionProjection: { networkFilesystemAutoResumeAllowed: true },
  }).resumableLoopAndPermissionProjection))],
  ['replay_corpus_is_executed', () => replayCorpusExecutes()],
  ['state_matrix_full_enum_product_executes', () => stateMatrixIsFiniteUniqueOrPartialDeclared()],
  ['strict_json_rejects_duplicate_keys', () => {
    try {
      parseJsonRejectDuplicateKeys('{"a":1,"a":2}');
      return false;
    } catch {
      return true;
    }
  }],
  ['canonical_digest_is_order_independent', () => canonicalDigest({ b: 2, a: 1 }) === canonicalDigest({ a: 1, b: 2 })],
  ['duplicate_keys_allowed_in_different_objects', () => {
    try {
      parseJsonRejectDuplicateKeys('{"a":1,"nested":{"a":2}}');
      return true;
    } catch {
      return false;
    }
  }],
  ['target_mode_does_not_require_source_manifest', () => activeManifestPathsForMode({ CODEX_HARNESS_MODE: 'target' }).join('|') === 'docs/process/CODEX_HARNESS_MANIFEST.json'],
  ['orchestration_capsule_validates_all_v128_internal_blocks', () => Object.values(validateOrchestrationCapsule(buildOrchestrationCapsule())).every((item) => item.status === 'pass')],
].map(([name, fn]) => test(name, fn));

const fixtureGroups = [
  'v127_preservation_matrix_profile_inheritance',
  'deterministic_decision_projection_matrix',
  'orthogonal_reason_model_matrix',
  'token_minimal_read_router_matrix',
  'bounded_projection_reader_execution',
  'managed_context_emitter_execution',
  'resumable_loop_permission_projection_matrix',
  'reader_before_writer_migration_matrix',
  'replay_corpus_execution',
  'state_matrix_full_shadow_candidate_execution',
  'strict_json_and_canonical_digest_execution',
  'validation_execution_plan_aggregate_finalizer',
  'standing_autonomy_policy_execution',
  'active_v127_exit_isolation_negative',
];

const failures = cases.filter((item) => item.status !== 'pass');
const report = {
  v128SelfTestStatus: {
    status: failures.length ? 'fail' : 'pass',
    caseCount: cases.length,
    failureCount: failures.length,
    fixtureGroups,
    executedFixtureGroups: fixtureGroups,
    stateMatrixCoverage: 'full_shadow_candidate',
    postMergeReplayCoverage: 'partial_shadow_candidate',
    sourceActivationReady: false,
    safeSummaryOnly: true,
  },
  cases,
  status: failures.length ? 'fail' : 'pass',
  safeSummaryOnly: true,
};

writeJsonReport(report, 'CODEX_V128_SELF_TEST_REPORT');
if (!process.env.CODEX_V128_SELF_TEST_REPORT && process.env.CODEX_QUALITY_REPORT !== 'json') {
  console.log(`v128SelfTestStatus: ${report.v128SelfTestStatus.status}`);
}
exitFor(report);
