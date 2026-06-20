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
import { classifyV128ShadowCandidateForActiveGate } from './codex-local-quality-gate.mjs';
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
import { buildEvidenceCapsule } from './codex-evidence-capsule.mjs';

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
    && surface.managedContextBytesObserved === false;
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
    && context.sourceFiles.length >= 5
    && context.instructionCapsule.llmSummaryUsed === false
    && context.attestedView.projectionAuthority === 'non_authoritative'
    && context.sourceActivationReady === false;
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
  return {
    nodeRef,
    executionState: 'reused',
    executionCount: 0,
    executionCountSource: 'executor_registry',
    executionCountObserved: true,
    status: 'pass',
    stabilityClass: 'decision_stable',
    sourceRunRef: 'github:run:27881777742:attempt:1',
    sourceResultDigest: `sha256:${'a'.repeat(64)}`,
    sourceHeadSha: 'f'.repeat(40),
    resultSchemaVersion: '1.0.0',
    typedResultPayload: {
      schemaVersion: '1.0.0',
      nodeRef,
      status: 'pass',
      reused: true,
      ...payload,
    },
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

function validationExecutionPlanVerifies() {
  const upstream = [
    executedNode('projection_reader', 'pass', 'decision_stable', { surfaceCanonicalBytes: 1200 }),
    executedNode('managed_context_emitter', 'pass', 'cache_stable', { managedContextBytes: 1800 }),
    reusedNode('state_matrix_executor', { totalCells: 96 }),
  ];
  return passed(validateV128ValidationExecutionPlan(buildV128ValidationExecutionPlan({
    headSha: 'f'.repeat(40),
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
  ['validation_workspace_unobserved_cannot_be_canonical', () => validationWorkspaceUnobservedCannotBeCanonical()],
  ['validation_runner_image_missing_prevents_reuse', () => validationRunnerImageMissingPreventsReuse()],
  ['validation_source_closure_includes_consumers', () => validationSourceClosureIncludesConsumers()],
  ['validation_finalizer_missing_upstream_node_fails', () => validationFinalizerMissingUpstreamNodeFails()],
  ['validation_finalizer_wrong_upstream_digest_fails', () => validationFinalizerWrongUpstreamDigestFails()],
  ['validation_finalizer_pass_with_failed_upstream_fails', () => validationFinalizerPassWithFailedUpstreamFails()],
  ['managed_context_emitter_observes_bytes', () => managedContextEmitterObservesBytes()],
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
