#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { runV128SerializedCacheCanary } from './codex-v128-serialized-cache-canary.mjs';

const VALIDATION_NODES_MAX = 12;
const DELTA_CONTEXT_BYTES_MAX = 768;
const MAX_ITERATIONS = 3;
const MAX_MODEL_INVOCATIONS = 4;
const LOOP_EXECUTION_MODES = new Set(['one_shot', 'bounded_goal', 'protected_routine']);
const LOOP_ADMISSION_STATUSES = new Set(['admitted', 'blocked']);
const LOOP_TRANSITION_CODES = new Set(['LOOP_NOT_REQUIRED', 'REPAIR_FAILED_NODE', 'STOP_NO_PROGRESS', 'WAIT_FOR_LOOP_EVIDENCE', 'WAIT_FOR_PROTECTED_EXECUTOR']);
const OPERATOR_NEXT_ACTION_CODES = new Set(['auto_wait', 'auto_rebase', 'auto_merge', 'auto_reject', 'auto_repair', 'auto_ready', 'auto_process_base_pr']);
const ACCEPTED_CHANGE_STATES = new Set(['validation_pass', 'merged', 'rejected', 'quarantined']);
const LOOP_BUDGET_STATES = new Set(['observed_within_budget', 'observed_over_budget', 'incomplete_observation']);
const FINALIZER_MODES = new Set(['aggregate_only']);
const EXECUTION_STATES = new Set(['executed', 'reused', 'rerun']);
const NODE_STATUSES = new Set(['pass', 'fail', 'skipped']);
const OBSERVATION_STATES = new Set(['observed', 'not_exercised']);
const FIELD_STATES = new Set(['observed', 'not_required_with_reason', 'missing', 'invalid']);
const REUSE_DECISIONS = new Set(['hit', 'partial_hit', 'miss']);
const STABILITY_CLASSES = new Set(['decision_stable', 'cache_stable', 'environment_diagnostic', 'owner_input', 'forbidden']);
const CANONICALITY_STATES = new Set(['canonical', 'duplicate_candidate', 'repo_mismatch', 'harness_version_mismatch', 'unknown']);
const PLACEHOLDER_VALUES = new Set(['', 'unknown', 'required', 'null', 'undefined', 'placeholder', 'not_available']);
const SOURCE_RUN_REF_REQUIRED_FIELDS = ['provider', 'runId', 'artifactName', 'artifactDigest', 'sourceHeadSha', 'testedCommitOid', 'resultSchemaVersion'];
const SOURCE_CLOSURE_FILES = [
  'scripts/codex-v128-validation-execution-plan.mjs',
  'scripts/codex-v128-aggregate-finalizer.mjs',
  'scripts/codex-local-quality-gate.mjs',
  'scripts/codex-orchestration-capsule.mjs',
  'scripts/codex-v128-projection-reader-adapter.mjs',
  'scripts/codex-v128-managed-context-adapter.mjs',
  'scripts/codex-v128-state-matrix-adapter.mjs',
  'scripts/codex-v128-aggregate-finalizer-adapter.mjs',
  'scripts/codex-v128-invocation-ledger.mjs',
  'scripts/codex-v128-serialized-cache-canary.mjs',
  'scripts/codex-v128-projection-reader.mjs',
  'scripts/codex-v128-managed-context-emitter.mjs',
  'scripts/codex-v128-state-matrix.mjs',
  'scripts/codex-v128-integrity-lib.mjs',
  'docs/process/CODEX_V128_CONTRACT_SCHEMA.json',
  'docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json',
  'docs/process/CODEX_V128_SPEC.md',
  'scripts/codex-v128-standing-autonomy-policy.mjs',
  'scripts/codex-v128-trust-closure.mjs',
  'scripts/codex-workflow-quality-runner.mjs',
];
const REQUIRED_CACHE_FIELDS = new Set(['headSha', 'planDigest', 'scriptDigest', 'runtimeVersion', 'taskProfile', 'environmentClass']);
const REUSE_BINDING_FIELDS = new Set(['sourceHeadOid', 'baseOid', 'testedCommitOid', 'testedTreeKind', 'validationContextDigest']);
const NODE_SOURCE_CLOSURE_SEEDS = {
  projection_reader: [
    'scripts/codex-v128-projection-reader-adapter.mjs',
    'scripts/codex-v128-invocation-ledger.mjs',
    'scripts/codex-v128-projection-reader.mjs',
    'scripts/codex-v128-integrity-lib.mjs',
    'scripts/codex-v128-standing-autonomy-policy.mjs',
    'docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json',
    'docs/process/CODEX_V128_CONTRACT_SCHEMA.json',
    'docs/process/CODEX_V128_SPEC.md',
  ],
  managed_context_emitter: [
    'scripts/codex-v128-managed-context-adapter.mjs',
    'scripts/codex-v128-invocation-ledger.mjs',
    'scripts/codex-v128-managed-context-emitter.mjs',
    'docs/process/CODEX_V128_SPEC.md',
  ],
  state_matrix_executor: [
    'scripts/codex-v128-state-matrix-adapter.mjs',
    'scripts/codex-v128-invocation-ledger.mjs',
    'scripts/codex-v128-state-matrix.mjs',
    'docs/process/CODEX_V128_STATE_MATRIX.json',
    'docs/process/CODEX_V128_SPEC.md',
  ],
  aggregate_finalizer: [
    'scripts/codex-v128-aggregate-finalizer-adapter.mjs',
    'scripts/codex-v128-invocation-ledger.mjs',
    'scripts/codex-v128-aggregate-finalizer.mjs',
    'scripts/codex-v128-validation-execution-plan.mjs',
    'docs/process/CODEX_V128_CONTRACT_SCHEMA.json',
  ],
};

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function digestValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function isSha256Digest(value) {
  return /^sha256:[a-f0-9]{64}$/.test(String(value || ''));
}

export function buildV128LoopAdmissionDigestInput(router = {}) {
  const evidence = router.evidenceStates || {};
  return {
    executionMode: router.executionMode || 'unknown',
    admissionStatus: router.admissionStatus || 'unknown',
    admissionReasonCode: router.admissionReasonCode || null,
    budgetState: router.budgetState || 'unknown',
    failedNodeCount: Number(router.failedNodeCount || 0),
    stopReason: router.stopReason || null,
    loopTransitionCode: router.loopTransitionCode || 'unknown',
    operatorNextActionCode: router.operatorNextActionCode || 'auto_wait',
    authorityBoundaryAction: router.authorityBoundaryAction || 'final_decision_authority',
    protectedExecutorAvailable: router.protectedExecutorAvailable === true,
    protectedLifecycleRequested: router.protectedLifecycleRequested === true,
    iterationCount: Number(router.iterationCount || 0),
    noProgressCount: Number(router.noProgressCount || 0),
    flipFlopCount: Number(router.flipFlopCount || 0),
    fullContextResendCount: Number(router.fullContextResendCount || 0),
    deltaContextBytes: Number(router.deltaContextBytes || 0),
    evidenceStates: {
      taskRecurrenceObserved: evidence.taskRecurrenceObserved === true,
      objectiveCompletionContractObserved: evidence.objectiveCompletionContractObserved === true,
      agentEndToEndCapabilityObserved: evidence.agentEndToEndCapabilityObserved === true,
      economicBenefitObserved: evidence.economicBenefitObserved === true,
      repairableFailureObserved: evidence.repairableFailureObserved === true,
      objectiveContractDigest: isSha256Digest(evidence.objectiveContractDigest) ? evidence.objectiveContractDigest : null,
      capabilityProfileDigest: isSha256Digest(evidence.capabilityProfileDigest) ? evidence.capabilityProfileDigest : null,
      economicsObservationDigest: isSha256Digest(evidence.economicsObservationDigest) ? evidence.economicsObservationDigest : null,
      repairableFailureEvidenceDigest: isSha256Digest(evidence.repairableFailureEvidenceDigest) ? evidence.repairableFailureEvidenceDigest : null,
    },
  };
}

export function buildV128LoopAdmissionDigest(router = {}) {
  return digestValue(buildV128LoopAdmissionDigestInput(router));
}

function canonicalBytes(value) {
  return Buffer.byteLength(canonicalJson(value), 'utf8');
}

function sha256Text(text) {
  return `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
}

function safeText(value, fallback) {
  const text = String(value || '').trim();
  return text ? text : fallback;
}

function isPlaceholder(value) {
  return PLACEHOLDER_VALUES.has(String(value ?? '').trim().toLowerCase());
}

function readSourceFileDigest(filePath, input = {}) {
  const normalized = filePath.replace(/\\/g, '/');
  const text = input.sourceFileTexts && Object.hasOwn(input.sourceFileTexts, normalized)
    ? String(input.sourceFileTexts[normalized])
    : fs.readFileSync(filePath, 'utf8');
  return {
    path: normalized,
    digest: sha256Text(text),
    bytes: Buffer.byteLength(text, 'utf8'),
    text,
  };
}

function sourceFileExists(filePath, input = {}) {
  const normalized = filePath.replace(/\\/g, '/');
  return (input.sourceFileTexts && Object.hasOwn(input.sourceFileTexts, normalized))
    || fs.existsSync(filePath);
}

function sourceClosureManifest(input = {}) {
  const files = Array.isArray(input.sourceClosureFiles) && input.sourceClosureFiles.length
    ? input.sourceClosureFiles
    : SOURCE_CLOSURE_FILES;
  const seedFiles = files.map((file) => file.replace(/\\/g, '/'));
  const seedSet = new Set(seedFiles);
  const importPattern = /(?:import\s+(?:[^'"]*?\s+from\s*)?|export\s+[^'"]*?\s+from\s*|import\s*\(\s*|require\(\s*)['"]([^'"]+)['"]/g;
  const dynamicImportPattern = /\bimport\s*\(\s*([^'"\s][^)]*)\)/g;
  const unresolved = [];
  const unsupportedDynamicImports = [];
  const edges = [];
  const normalizePath = (filePath) => filePath.replace(/\\/g, '/');
  const resolveRelativePath = (fromPath, specifier) => {
    if (!specifier.startsWith('.')) return null;
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(normalizePath(fromPath)), specifier));
    const candidates = [base, `${base}.mjs`, `${base}.js`, `${base}.json`, path.posix.join(base, 'index.mjs'), path.posix.join(base, 'index.js')];
    return candidates.find((candidate) => sourceFileExists(candidate, input)) || null;
  };
  const byPath = new Map();
  const queue = [...seedFiles];
  const maxClosureFiles = Number(input.maxSourceClosureFiles || 256);
  let truncated = false;
  while (queue.length) {
    const current = normalizePath(queue.shift());
    if (byPath.has(current)) continue;
    if (byPath.size >= maxClosureFiles) {
      truncated = true;
      break;
    }
    const file = readSourceFileDigest(current, input);
    byPath.set(current, file);
    importPattern.lastIndex = 0;
    dynamicImportPattern.lastIndex = 0;
    let dynamicMatch;
    while ((dynamicMatch = dynamicImportPattern.exec(file.text)) !== null) {
      unsupportedDynamicImports.push({
        from: file.path,
        expression: String(dynamicMatch[1] || '').trim().slice(0, 80),
      });
    }
    let match;
    while ((match = importPattern.exec(file.text)) !== null) {
      const specifier = match[1];
      const resolved = resolveRelativePath(file.path, specifier);
      if (!specifier.startsWith('.')) continue;
      if (!resolved) {
        unresolved.push({ from: file.path, specifier });
        continue;
      }
      edges.push({ from: file.path, specifier, resolved });
      if (!byPath.has(resolved)) {
        queue.push(resolved);
      }
    }
  }
  const sourceFiles = [...byPath.values()]
    .map(({ text, ...entry }) => entry)
    .sort((a, b) => a.path.localeCompare(b.path));
  const relativeImportClosureFiles = sourceFiles.filter((file) => !seedSet.has(file.path));
  return {
    sourceFiles,
    seedSourceFileCount: seedFiles.length,
    relativeImportClosureFiles,
    relativeImportEdgeCount: edges.length,
    transitiveRelativeImportCount: relativeImportClosureFiles.length,
    declaredImportScanStatus: unresolved.length || truncated || unsupportedDynamicImports.length ? 'activation_blocker' : 'pass',
    undeclaredRelativeImportCount: 0,
    unresolvedRelativeImportCount: unresolved.length,
    unresolvedRelativeImportSamples: unresolved.slice(0, 12),
    unsupportedDynamicImportCount: unsupportedDynamicImports.length,
    unsupportedDynamicImportSamples: unsupportedDynamicImports.slice(0, 12),
    sourceClosureTruncated: truncated,
    sourceClosureDigest: digestValue(sourceFiles),
  };
}

function nodeSourceClosureManifest(input = {}, graphNodes = defaultGraphNodes()) {
  const closures = {};
  for (const node of graphNodes) {
    const seeds = input.nodeSourceClosureSeeds?.[node.nodeRef] || NODE_SOURCE_CLOSURE_SEEDS[node.nodeRef] || SOURCE_CLOSURE_FILES;
    const closure = sourceClosureManifest({
      ...input,
      sourceClosureFiles: seeds,
      maxSourceClosureFiles: input.maxNodeSourceClosureFiles || 128,
    });
    closures[node.nodeRef] = {
      seedSourceFiles: seeds,
      seedSourceFileCount: closure.seedSourceFileCount,
      sourceFileCount: closure.sourceFiles.length,
      relativeImportEdgeCount: closure.relativeImportEdgeCount,
      transitiveRelativeImportCount: closure.transitiveRelativeImportCount,
      unresolvedRelativeImportCount: closure.unresolvedRelativeImportCount,
      unsupportedDynamicImportCount: closure.unsupportedDynamicImportCount,
      sourceClosureTruncated: closure.sourceClosureTruncated,
      declaredImportScanStatus: closure.declaredImportScanStatus,
      nodeSourceClosureDigest: closure.sourceClosureDigest,
    };
  }
  return closures;
}

export function buildV128NodeCommandDigests(input = {}) {
  const graphNodes = (Array.isArray(input.nodes) && input.nodes.length ? input.nodes : defaultGraphNodes()).map(normalizeGraphNode).slice(0, VALIDATION_NODES_MAX);
  const closures = nodeSourceClosureManifest(input, graphNodes);
  return Object.fromEntries(graphNodes.map((node) => [
    node.nodeRef,
    closures[node.nodeRef]?.nodeSourceClosureDigest || null,
  ]));
}

function defaultGraphNodes() {
  return [
    { nodeRef: 'projection_reader', dependsOn: [], required: true },
    { nodeRef: 'managed_context_emitter', dependsOn: ['projection_reader'], required: true },
    { nodeRef: 'state_matrix_executor', dependsOn: ['managed_context_emitter'], required: true },
    { nodeRef: 'aggregate_finalizer', dependsOn: ['projection_reader', 'managed_context_emitter', 'state_matrix_executor'], required: true },
  ];
}

function normalizeGraphNode(node = {}) {
  return {
    nodeRef: safeText(node.nodeRef, 'unknown_node'),
    dependsOn: Array.isArray(node.dependsOn) ? node.dependsOn.map(String) : [],
    required: node.required !== false,
  };
}

function typedResultRef(nodeRef) {
  return `#/typedResults/${nodeRef}`;
}

function normalizeNodeResult(node = {}, graphNode = {}, typedPayload = null) {
  const nodeRef = safeText(node.nodeRef || graphNode.nodeRef, 'unknown_node');
  const executionState = EXECUTION_STATES.has(node.executionState) ? node.executionState : 'executed';
  const status = NODE_STATUSES.has(node.status) ? node.status : 'fail';
  const stabilityClass = STABILITY_CLASSES.has(node.stabilityClass) ? node.stabilityClass : 'decision_stable';
  const resultPayload = typedPayload || node.typedResultPayload || {
    nodeRef,
    executionState,
    status,
    stabilityClass,
  };
  const resultDigest = node.resultDigest || digestValue(resultPayload);
  const hasExecutionCount = node.executionCount !== undefined && node.executionCount !== null;
  return {
    nodeRef,
    dependsOn: Array.isArray(node.dependsOn) ? node.dependsOn.map(String) : (graphNode.dependsOn || []),
    required: node.required === undefined ? graphNode.required !== false : node.required !== false,
    executionState,
    executionCount: hasExecutionCount ? Number(node.executionCount) : (executionState === 'reused' ? 0 : 1),
    executionCountSource: node.executionCountSource || (hasExecutionCount ? 'executor_registry' : 'derived_default'),
    executionCountObserved: node.executionCountObserved === true || node.executionCountSource === 'executor_registry',
    status,
    stabilityClass,
    typedResultRef: node.typedResultRef || typedResultRef(nodeRef),
    resultDigest,
    skipReasonCode: node.skipReasonCode || null,
    sourceRunRef: node.sourceRunRef || null,
    sourceResultDigest: node.sourceResultDigest || null,
    sourceHeadSha: node.sourceHeadSha || null,
    cacheKeyDigest: node.cacheKeyDigest || null,
    nodeInputDigest: node.nodeInputDigest || null,
    resultSchemaVersion: node.resultSchemaVersion || '1.0.0',
  };
}

function validateSourceRunRef(sourceRunRef, node = {}) {
  const reasons = [];
  if (!sourceRunRef || typeof sourceRunRef !== 'object' || Array.isArray(sourceRunRef)) {
    return ['reused_node_source_run_ref_must_be_object'];
  }
  for (const field of SOURCE_RUN_REF_REQUIRED_FIELDS) {
    if (isPlaceholder(sourceRunRef[field])) reasons.push(`reused_node_source_run_ref_${field}_required`);
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(String(sourceRunRef.artifactDigest || ''))) reasons.push('reused_node_source_run_ref_artifact_digest_invalid');
  if (!/^[a-f0-9]{40}$/.test(String(sourceRunRef.sourceHeadSha || ''))) reasons.push('reused_node_source_run_ref_source_head_invalid');
  if (!/^[a-f0-9]{40}$/.test(String(sourceRunRef.testedCommitOid || ''))) reasons.push('reused_node_source_run_ref_tested_commit_invalid');
  if (node.sourceHeadSha && sourceRunRef.sourceHeadSha !== node.sourceHeadSha) reasons.push('reused_node_source_run_ref_source_head_mismatch');
  if (node.resultSchemaVersion && sourceRunRef.resultSchemaVersion !== node.resultSchemaVersion) reasons.push('reused_node_source_run_ref_schema_mismatch');
  return reasons;
}

function normalizeInvocationLedger(input = {}) {
  if (!Array.isArray(input.runWideInvocationLedger)) return [];
  return input.runWideInvocationLedger.map((entry = {}) => ({
    nodeRef: safeText(entry.nodeRef, 'unknown_node'),
    commandOrFunctionDigest: String(entry.commandOrFunctionDigest || ''),
    invocationSequence: Number(entry.invocationSequence || 0),
    completionSequence: Number(entry.completionSequence || 0),
    resultDigest: String(entry.resultDigest || ''),
    executionSource: safeText(entry.executionSource, 'unknown_execution_source'),
    adapterId: entry.adapterId ? String(entry.adapterId) : null,
  }));
}

function payloadDigest(payload) {
  return digestValue(payload || null);
}

function deriveNodeInputDigest(nodeRef, typedPayload = {}) {
  if (nodeRef === 'projection_reader') {
    return typedPayload.routineDecisionProjection?.sourceBinding?.projectionPayloadDigest
      || payloadDigest(typedPayload.routineDecisionProjection || typedPayload);
  }
  if (nodeRef === 'managed_context_emitter') {
    return typedPayload.activeInstructionSourceSetDigest
      || payloadDigest({
        sourceFiles: typedPayload.sourceFiles || [],
        instructionCapsule: typedPayload.instructionCapsule || {},
        providerSummary: typedPayload.providerSummary || {},
        attestedView: typedPayload.attestedView || {},
      });
  }
  if (nodeRef === 'state_matrix_executor') {
    return typedPayload.stateMatrixContentDigest
      || payloadDigest({
        coverage: typedPayload.coverage || null,
        fullEnumProductExecuted: typedPayload.fullEnumProductExecuted === true,
        totalCells: typedPayload.totalCells ?? null,
        transitionCells: typedPayload.transitionCells ?? null,
        hardInvalidCells: typedPayload.hardInvalidCells ?? null,
      });
  }
  if (nodeRef === 'aggregate_finalizer') {
    return typedPayload.orderedUpstreamResultSetDigest
      || payloadDigest(typedPayload.upstreamResultDigests || []);
  }
  return payloadDigest(typedPayload);
}

function normalizeNodeInputDigests(input = {}, nodeResults = [], typedResults = {}) {
  const explicit = input.nodeInputDigests && typeof input.nodeInputDigests === 'object' ? input.nodeInputDigests : {};
  const digests = {};
  for (const node of nodeResults) {
    const explicitDigest = explicit[node.nodeRef] || node.nodeInputDigest;
    digests[node.nodeRef] = /^sha256:[a-f0-9]{64}$/.test(String(explicitDigest || ''))
      ? explicitDigest
      : deriveNodeInputDigest(node.nodeRef, typedResults[node.nodeRef] || node.typedResultPayload || {});
  }
  return digests;
}

function evaluateGraph(graphNodes = []) {
  const reasons = [];
  const nodeRefs = graphNodes.map((node) => node.nodeRef);
  const duplicateNodeRefs = [...new Set(nodeRefs.filter((nodeRef, index) => nodeRefs.indexOf(nodeRef) !== index))];
  const duplicateEdges = [];
  for (const node of graphNodes) {
    const seen = new Set();
    for (const dependency of node.dependsOn || []) {
      if (seen.has(dependency)) duplicateEdges.push(`${node.nodeRef}:${dependency}`);
      seen.add(dependency);
      if (!nodeRefs.includes(dependency)) reasons.push(`graph_dependency_unknown_${node.nodeRef}_${dependency}`);
    }
  }
  if (duplicateNodeRefs.length) reasons.push('graph_duplicate_node_ref');
  if (duplicateEdges.length) reasons.push('graph_duplicate_edge');
  const order = [];
  const temporary = new Set();
  const permanent = new Set();
  const byRef = new Map(graphNodes.map((node) => [node.nodeRef, node]));
  function visit(nodeRef) {
    if (permanent.has(nodeRef)) return;
    if (temporary.has(nodeRef)) {
      reasons.push('graph_cycle_detected');
      return;
    }
    const node = byRef.get(nodeRef);
    if (!node) return;
    temporary.add(nodeRef);
    for (const dependency of [...(node.dependsOn || [])].sort()) visit(dependency);
    temporary.delete(nodeRef);
    permanent.add(nodeRef);
    order.push(nodeRef);
  }
  for (const nodeRef of [...nodeRefs].sort()) visit(nodeRef);
  return {
    status: reasons.length ? 'fail' : 'pass',
    reasonCodes: [...new Set(reasons)],
    duplicateNodeRefs,
    duplicateEdges,
    topologicalOrder: order,
    graphDigest: digestValue(graphNodes),
    topologicalOrderDigest: digestValue(order),
  };
}

function fieldState(value, options = {}) {
  if (options.notRequired === true) {
    return {
      state: 'not_required_with_reason',
      value: null,
      reasonCode: options.reasonCode || 'NOT_REQUIRED',
    };
  }
  if (isPlaceholder(value)) {
    return {
      state: 'missing',
      value: null,
      reasonCode: options.reasonCode || 'FIELD_MISSING',
    };
  }
  return {
    state: 'observed',
    value: String(value),
  };
}

function fieldValue(field) {
  return field?.state === 'observed' ? field.value : field?.state;
}

function buildValidationContext(input = {}, head) {
  const testedTreeKind = input.testedTreeKind
    || (String(process.env.GITHUB_REF || '').includes('/pull/') ? 'pull_request_merge_ref' : 'branch_head');
  const sourceHeadOid = input.sourceHeadOid || process.env.CODEX_PR_HEAD_SHA || head;
  const baseOid = Object.hasOwn(input, 'baseOid') ? input.baseOid : (process.env.CODEX_PR_BASE_SHA || null);
  const testedCommitOid = input.testedCommitOid || process.env.GITHUB_SHA || head;
  const context = {
    sourceHeadOid: fieldState(sourceHeadOid, { reasonCode: 'SOURCE_HEAD_NOT_OBSERVED' }),
    baseOid: baseOid
      ? fieldState(baseOid, { reasonCode: 'BASE_NOT_OBSERVED' })
      : fieldState(null, { notRequired: testedTreeKind === 'branch_head', reasonCode: testedTreeKind === 'branch_head' ? 'BRANCH_HEAD_HAS_NO_BASE_OID' : 'BASE_NOT_OBSERVED' }),
    testedCommitOid: fieldState(testedCommitOid, { reasonCode: 'TESTED_COMMIT_NOT_OBSERVED' }),
    testedTreeKind: fieldState(testedTreeKind, { reasonCode: 'TESTED_TREE_KIND_NOT_OBSERVED' }),
  };
  context.validationContextDigest = fieldState(digestValue({
    sourceHeadOid: fieldValue(context.sourceHeadOid),
    baseOid: fieldValue(context.baseOid),
    testedCommitOid: fieldValue(context.testedCommitOid),
    testedTreeKind: fieldValue(context.testedTreeKind),
  }));
  return context;
}

function buildCacheKeyFields(input = {}, planDigest, sourceClosureDigest, validationContext = null) {
  const head = input.headSha || process.env.CODEX_PR_HEAD_SHA || process.env.GITHUB_SHA || 'not_available';
  const context = validationContext || buildValidationContext(input, head);
  return {
    headSha: fieldState(head, { reasonCode: 'HEAD_NOT_OBSERVED' }),
    sourceHeadOid: context.sourceHeadOid,
    baseOid: context.baseOid,
    testedCommitOid: context.testedCommitOid,
    testedTreeKind: context.testedTreeKind,
    validationContextDigest: context.validationContextDigest,
    planDigest: fieldState(planDigest),
    scriptDigest: fieldState(input.scriptDigest || sourceClosureDigest),
    lockfileDigest: input.lockfileDigest
      ? fieldState(input.lockfileDigest)
      : fieldState(null, { notRequired: true, reasonCode: 'PROFILE_HAS_NO_LOCKFILE' }),
    runnerImageDigest: input.runnerImageDigest
      ? fieldState(input.runnerImageDigest)
      : {
        state: 'missing',
        value: null,
        reasonCode: 'RUNNER_IMAGE_DIGEST_NOT_OBSERVED',
      },
    runnerClassDigest: fieldState(input.runnerClassDigest || digestValue({
      provider: process.env.GITHUB_ACTIONS === 'true' ? 'github_actions' : 'local',
      os: process.platform,
    })),
    runtimeVersion: fieldState(input.runtimeVersion || process.version),
    taskProfile: fieldState(input.taskProfile || 'source_shadow_candidate'),
    environmentClass: fieldState(input.environmentClass || (process.env.GITHUB_ACTIONS === 'true' ? 'github_actions' : 'local')),
  };
}

function cacheKeyHasInvalidField(cacheKeyFields = {}) {
  return Object.entries(cacheKeyFields).some(([key, field]) => field?.state === 'invalid'
    || (field?.state === 'missing' && REQUIRED_CACHE_FIELDS.has(key)));
}

function cacheReuseEligible(cacheKeyFields = {}) {
  return Object.values(cacheKeyFields).every((field) => !['missing', 'invalid'].includes(field?.state));
}

function classifyReuseDecision(nodes = [], input = {}, cacheKeyInvalid = false) {
  if (cacheKeyInvalid) return 'miss';
  if (input.reuseDecision && REUSE_DECISIONS.has(input.reuseDecision)) return input.reuseDecision;
  const reused = nodes.filter((node) => node.executionState === 'reused').length;
  const executed = nodes.filter((node) => node.executionState === 'executed').length;
  if (reused > 0 && executed === 0) return 'hit';
  if (reused > 0) return 'partial_hit';
  return 'miss';
}

function downstreamNodeRefs(graphNodes = [], startingRefs = []) {
  const start = new Set(startingRefs.filter(Boolean));
  const descendants = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of graphNodes) {
      if (descendants.has(node.nodeRef) || start.has(node.nodeRef)) continue;
      if ((node.dependsOn || []).some((dependency) => start.has(dependency) || descendants.has(dependency))) {
        descendants.add(node.nodeRef);
        changed = true;
      }
    }
  }
  return [...descendants].sort();
}

function buildFailureDirectedRequeue(input = {}, graphNodes = [], nodeResults = [], nodeInputDigests = {}) {
  const failedNodeRefs = nodeResults.filter((node) => node.status === 'fail').map((node) => node.nodeRef).sort();
  const changedInputNodeRefs = Array.isArray(input.changedInputNodeRefs) ? input.changedInputNodeRefs.map(String).sort() : [];
  const changedInputDownstreamNodeRefs = downstreamNodeRefs(graphNodes, changedInputNodeRefs);
  const invalidatedCacheNodeRefs = Array.isArray(input.invalidatedCacheNodeRefs) ? input.invalidatedCacheNodeRefs.map(String).sort() : [];
  const allowedRequeueNodeRefs = [...new Set([
    ...failedNodeRefs,
    ...changedInputNodeRefs,
    ...changedInputDownstreamNodeRefs,
    ...invalidatedCacheNodeRefs,
  ])].sort();
  const actualRequeuedNodeRefs = nodeResults.filter((node) => node.executionState === 'rerun').map((node) => node.nodeRef).sort();
  const unaffectedNodeRerunRefs = actualRequeuedNodeRefs.filter((nodeRef) => !allowedRequeueNodeRefs.includes(nodeRef));
  const currentAttemptDigest = digestValue({
    failedNodeRefs,
    nodeInputDigests: Object.fromEntries(failedNodeRefs.map((nodeRef) => [nodeRef, nodeInputDigests[nodeRef] || null])),
    failureClasses: Object.fromEntries(nodeResults
      .filter((node) => failedNodeRefs.includes(node.nodeRef))
      .map((node) => [node.nodeRef, node.skipReasonCode || node.status])),
  });
  const sameFailureAsLastAttempt = input.lastAttemptDigest && input.lastAttemptDigest === currentAttemptDigest;
  return {
    mode: 'failure_directed_requeue',
    failedNodeRefs,
    changedInputNodeRefs,
    changedInputDownstreamNodeRefs,
    invalidatedCacheNodeRefs,
    allowedRequeueNodeRefs,
    actualRequeuedNodeRefs,
    unaffectedNodeRerunCount: unaffectedNodeRerunRefs.length,
    unaffectedNodeRerunRefs,
    currentAttemptDigest,
    lastAttemptDigest: input.lastAttemptDigest || null,
    noProgressStop: sameFailureAsLastAttempt === true,
    stopReason: sameFailureAsLastAttempt ? 'no_progress_same_failure' : null,
    safeSummaryOnly: true,
  };
}

function buildLoopEconomy(input = {}, nodeResults = [], validationStatus = 'partial_shadow_candidate', failureDirectedRequeue = {}) {
  const stableContextBytes = Number(input.stableContextBytes || input.residentContextBytes || 0);
  const deltaContextBytes = Number(input.deltaContextBytes || 0);
  const firstFullSendBytes = Number(input.fullContextSendBytes || stableContextBytes || 0);
  const fullContextResendCount = Number(input.fullContextResendCount ?? (firstFullSendBytes > 0 ? 1 : 0));
  const managedInputBytes = Number(input.managedInputBytes || (firstFullSendBytes + deltaContextBytes));
  const modelInvocationObserved = input.modelInvocationObserved === true;
  const modelInvocationCount = modelInvocationObserved ? Number(input.modelInvocationCount ?? 0) : null;
  const modelInputBytes = modelInvocationObserved ? Number(input.modelInputBytes || 0) : null;
  const modelOutputBytes = modelInvocationObserved ? Number(input.modelOutputBytes || 0) : null;
  const modelTransportDigest = modelInvocationObserved ? (input.modelTransportDigest || digestValue({
    modelInvocationCount,
    modelInputBytes,
    modelOutputBytes,
    modelTransportBoundary: input.modelTransportBoundary || 'unknown',
  })) : null;
  const executedNodeCount = nodeResults.filter((node) => node.executionState === 'executed' || node.executionState === 'rerun').length;
  const reusedNodeCount = nodeResults.filter((node) => node.executionState === 'reused').length;
  const managedInputObserved = managedInputBytes > 0;
  const validationNodeInvocationCount = Number(input.validationNodeInvocationCount ?? executedNodeCount);
  const acceptedChangeState = input.acceptedChangeState
    || (input.providerMergeObserved === true ? 'merged' : (input.quarantineObserved === true ? 'quarantined' : (validationStatus === 'pass' ? 'validation_pass' : 'rejected')));
  const acceptedChange = acceptedChangeState === 'merged';
  const acceptedChangeRate = nodeResults.length ? (acceptedChange ? 1 : 0) : 0;
  const managedInputBytesPerAcceptedChange = acceptedChange ? managedInputBytes : null;
  const residentAndDeltaBytesPerValidatedPass = validationStatus === 'pass' && managedInputObserved ? managedInputBytes : null;
  const nonModelBudgetWithin = fullContextResendCount <= 1
    && deltaContextBytes <= DELTA_CONTEXT_BYTES_MAX
    && failureDirectedRequeue.unaffectedNodeRerunCount === 0;
  const budgetState = modelInvocationObserved !== true
    ? 'incomplete_observation'
    : (nonModelBudgetWithin && modelInvocationCount <= MAX_MODEL_INVOCATIONS
      ? 'observed_within_budget'
      : 'observed_over_budget');
  return {
    observed: nodeResults.length > 0,
    managedInputBytes,
    validationNodeInvocationCount,
    modelInvocationObserved,
    modelInvocationCount,
    modelInputBytes,
    modelOutputBytes,
    modelTransportDigest,
    fullContextResendCount,
    deltaContextBytes,
    deltaContextBytesMax: DELTA_CONTEXT_BYTES_MAX,
    executedNodeCount,
    reusedNodeCount,
    reexecutedNodesPerAcceptedChange: acceptedChange ? failureDirectedRequeue.actualRequeuedNodeRefs.length : null,
    rejectedAttemptCount: Number(input.rejectedAttemptCount || (failureDirectedRequeue.noProgressStop ? 1 : 0)),
    acceptedChangeState,
    acceptedChange,
    acceptedChangeRate,
    managedInputBytesPerAcceptedChange,
    residentAndDeltaBytesPerValidatedPass,
    maxIterations: MAX_ITERATIONS,
    maxModelInvocations: MAX_MODEL_INVOCATIONS,
    sameBlockerMax: 1,
    noProgressWindow: 1,
    flipFlopMax: 1,
    budgetState,
    safeSummaryOnly: true,
  };
}

function buildSelectiveFailureMemory(input = {}, failureDirectedRequeue = {}) {
  return {
    memoryKind: 'selective_failure_memory',
    lastAttemptDigest: failureDirectedRequeue.lastAttemptDigest,
    currentAttemptDigest: failureDirectedRequeue.currentAttemptDigest,
    failureClass: input.failureClass || (failureDirectedRequeue.failedNodeRefs.length ? 'validation_node_failure' : null),
    rejectedApproachRef: input.rejectedApproachRef || (failureDirectedRequeue.unaffectedNodeRerunCount ? 'approach:full_dag_rerun' : null),
    successfulPatternRef: input.successfulPatternRef || 'repair:failed_nodes_only',
    storesRawLogs: false,
    storesFullDiff: false,
    storesConversation: false,
    memoryDigest: digestValue({
      lastAttemptDigest: failureDirectedRequeue.lastAttemptDigest,
      currentAttemptDigest: failureDirectedRequeue.currentAttemptDigest,
      failureClass: input.failureClass || null,
      successfulPatternRef: input.successfulPatternRef || 'repair:failed_nodes_only',
    }),
    safeSummaryOnly: true,
  };
}

function buildLoopAdmissionRouter(input = {}, validationStatus = 'partial_shadow_candidate', failureDirectedRequeue = {}, loopEconomy = {}) {
  const failedNodeCount = Array.isArray(failureDirectedRequeue.failedNodeRefs) ? failureDirectedRequeue.failedNodeRefs.length : 0;
  const protectedExecutorAvailable = input.protectedExecutorAvailable === true;
  const protectedLifecycleRequested = input.protectedLifecycleRequested === true;
  const iterationCount = Number(input.iterationCount || 1);
  const noProgressCount = Number(input.noProgressCount || (failureDirectedRequeue.noProgressStop === true ? 1 : 0));
  const flipFlopCount = Number(input.flipFlopCount || 0);
  const hasRepairableFailure = failedNodeCount > 0 || validationStatus === 'fail';
  const repairableFailureEvidenceDigest = isSha256Digest(input.repairableFailureEvidenceDigest)
    ? input.repairableFailureEvidenceDigest
    : (hasRepairableFailure && Array.isArray(failureDirectedRequeue.failedNodeRefs) && failureDirectedRequeue.failedNodeRefs.length
      ? digestValue({
        failedNodeRefs: failureDirectedRequeue.failedNodeRefs,
        currentAttemptDigest: failureDirectedRequeue.currentAttemptDigest || null,
      })
      : null);
  const evidenceStates = {
    taskRecurrenceObserved: isSha256Digest(input.taskRecurrenceDigest),
    objectiveCompletionContractObserved: isSha256Digest(input.objectiveContractDigest),
    agentEndToEndCapabilityObserved: isSha256Digest(input.capabilityProfileDigest),
    economicBenefitObserved: isSha256Digest(input.economicsObservationDigest),
    repairableFailureObserved: isSha256Digest(repairableFailureEvidenceDigest),
    taskRecurrenceDigest: isSha256Digest(input.taskRecurrenceDigest) ? input.taskRecurrenceDigest : null,
    objectiveContractDigest: isSha256Digest(input.objectiveContractDigest) ? input.objectiveContractDigest : null,
    capabilityProfileDigest: isSha256Digest(input.capabilityProfileDigest) ? input.capabilityProfileDigest : null,
    economicsObservationDigest: isSha256Digest(input.economicsObservationDigest) ? input.economicsObservationDigest : null,
    repairableFailureEvidenceDigest,
  };
  const boundedGoalEvidenceComplete = evidenceStates.objectiveCompletionContractObserved
    && evidenceStates.agentEndToEndCapabilityObserved
    && evidenceStates.economicBenefitObserved
    && evidenceStates.repairableFailureObserved;
  const protectedRoutineEvidenceComplete = evidenceStates.taskRecurrenceObserved
    && evidenceStates.objectiveCompletionContractObserved
    && evidenceStates.agentEndToEndCapabilityObserved
    && evidenceStates.economicBenefitObserved
    && protectedExecutorAvailable;
  let executionMode = 'one_shot';
  let admissionStatus = 'admitted';
  const budgetBlocksLoop = loopEconomy.budgetState !== 'observed_within_budget';
  let stopReason = failureDirectedRequeue.noProgressStop === true
    ? 'no_progress_same_failure'
    : (loopEconomy.budgetState === 'observed_over_budget' ? 'loop_budget_exceeded'
      : (iterationCount > MAX_ITERATIONS ? 'iteration_limit_exceeded'
        : (noProgressCount > 1 ? 'no_progress_limit_exceeded'
          : (flipFlopCount > 1 ? 'flip_flop_limit_exceeded' : null))));
  let loopTransitionCode = 'LOOP_NOT_REQUIRED';
  let admissionReasonCode = 'one_shot_loop_not_required';
  if (stopReason) {
    admissionStatus = 'blocked';
    loopTransitionCode = 'STOP_NO_PROGRESS';
    admissionReasonCode = stopReason;
  } else if (protectedLifecycleRequested) {
    if (protectedRoutineEvidenceComplete && !budgetBlocksLoop) {
      executionMode = 'protected_routine';
      admissionReasonCode = 'protected_routine_admitted';
    } else {
      admissionStatus = 'blocked';
      loopTransitionCode = protectedExecutorAvailable ? 'WAIT_FOR_LOOP_EVIDENCE' : 'WAIT_FOR_PROTECTED_EXECUTOR';
      admissionReasonCode = budgetBlocksLoop ? 'protected_routine_budget_observation_missing' : (protectedExecutorAvailable ? 'protected_routine_evidence_missing' : 'protected_executor_missing');
    }
  } else if (hasRepairableFailure) {
    if (boundedGoalEvidenceComplete && !budgetBlocksLoop) {
      executionMode = 'bounded_goal';
      loopTransitionCode = 'REPAIR_FAILED_NODE';
      admissionReasonCode = 'bounded_goal_repairable_failure_admitted';
    } else {
      admissionStatus = 'blocked';
      loopTransitionCode = 'WAIT_FOR_LOOP_EVIDENCE';
      admissionReasonCode = budgetBlocksLoop ? 'bounded_goal_budget_observation_missing' : 'bounded_goal_evidence_missing';
    }
  }
  const router = {
    routerKind: 'loop_admission_router',
    executionMode,
    admissionStatus,
    admissionReasonCode,
    budgetState: loopEconomy.budgetState || 'unknown',
    failedNodeCount,
    stopReason,
    loopTransitionCode,
    operatorNextActionCode: input.operatorNextActionCode || 'auto_wait',
    authorityBoundaryAction: input.authorityBoundaryAction || 'final_decision_authority',
    evidenceStates,
    protectedExecutorAvailable,
    protectedLifecycleRequested,
    iterationCount,
    noProgressCount,
    flipFlopCount,
    maxIterations: MAX_ITERATIONS,
    maxModelInvocations: MAX_MODEL_INVOCATIONS,
    fullContextResendCount: Number(loopEconomy.fullContextResendCount || 0),
    deltaContextBytes: Number(loopEconomy.deltaContextBytes || 0),
    humanOwnerDecisionRequired: false,
    ownerAuthorityCreated: false,
    sourceActivationAuthorized: false,
    targetRolloutAuthorized: false,
    newP0ArtifactCreated: false,
    safeSummaryOnly: true,
  };
  return {
    ...router,
    admissionDigest: buildV128LoopAdmissionDigest(router),
  };
}

function finalizerStaticScan() {
  const entry = 'scripts/codex-v128-aggregate-finalizer.mjs';
  const text = fs.readFileSync(entry, 'utf8');
  const childProcessImportDetected = /from\s+['"]node:child_process['"]|from\s+['"]child_process['"]|require\(\s*['"]child_process['"]\s*\)/.test(text);
  const shellExecutionDetected = /spawnSync\(|execSync\(|execFileSync\(|\bshell:\s*true\b/.test(text);
  return {
    finalizerSourcePath: entry,
    childProcessImportDetected,
    shellExecutionDetected,
    networkImportDetected: /from\s+['"]node:https?['"]|require\(\s*['"]https?['"]\s*\)/.test(text),
  };
}

function buildCacheReuseSimulation(input = {}, graphNodes = [], nodeResults = [], typedResults = {}, nodeInputDigests = {}, nodeCacheKeyDigests = {}, cacheKeyDigest = null, reuseEligible = false) {
  const eligibleNodeRefs = graphNodes.map((node) => node.nodeRef);
  const typedResultDigests = Object.fromEntries(eligibleNodeRefs.map((nodeRef) => [nodeRef, digestValue(typedResults[nodeRef] || null)]));
  const allNodesPassed = eligibleNodeRefs.every((nodeRef) => (nodeResults.find((node) => node.nodeRef === nodeRef)?.status || 'missing') === 'pass');
  const canaryTransportDigest = digestValue({
    cacheKeyDigest,
    nodeCacheKeyDigests,
    nodeInputDigests,
    typedResultDigests,
    transport: 'existing_validation_artifact_payload',
  });
  const invalidatedNodeRefs = input.cacheCanaryInvalidatedNodeRefs?.length
    ? input.cacheCanaryInvalidatedNodeRefs.map(String)
    : ['projection_reader'];
  const changedDownstream = downstreamNodeRefs(graphNodes, invalidatedNodeRefs);
  const partialExecutedNodeRefs = [...new Set([...invalidatedNodeRefs, ...changedDownstream])].filter((nodeRef) => eligibleNodeRefs.includes(nodeRef)).sort();
  const partialReusedNodeRefs = eligibleNodeRefs.filter((nodeRef) => !partialExecutedNodeRefs.includes(nodeRef)).sort();
  const observed = allNodesPassed && reuseEligible === true && isSha256Digest(cacheKeyDigest) && eligibleNodeRefs.length > 0;
  const canaryCore = {
    canaryKind: 'v128_existing_artifact_cache_simulation',
    observationClass: 'simulation',
    observationSource: 'existing_safe_artifact_typed_results',
    observed: false,
    simulatedOnly: true,
    cacheKeyDigest,
    canaryTransportDigest,
    coldMiss: {
      observed: false,
      reuseDecision: 'miss',
      executedEligibleNodeCount: 0,
      reusedNodeCount: 0,
    },
    realHit: {
      observed: false,
      reuseDecision: 'hit',
      executedEligibleNodeCount: 0,
      reusedEligibleNodeCount: 0,
      sourceArtifactTransportDigest: canaryTransportDigest,
    },
    realPartialHit: {
      observed: false,
      reuseDecision: 'partial_hit',
      invalidatedNodeRefs,
      executedNodeRefs: [],
      reusedNodeRefs: [],
      unaffectedNodeRerunCount: 0,
      sourceArtifactTransportDigest: canaryTransportDigest,
    },
  };
  return {
    ...canaryCore,
    status: 'partial_shadow_candidate',
    canaryDigest: digestValue(canaryCore),
    safeSummaryOnly: true,
  };
}

export function buildV128ValidationExecutionPlan(input = {}) {
  const observationState = input.observedExecution === true || (Array.isArray(input.nodeResults) && input.nodeResults.length > 0)
    ? 'observed'
    : 'not_exercised';
  const graphNodes = (Array.isArray(input.nodes) && input.nodes.length ? input.nodes : defaultGraphNodes()).map(normalizeGraphNode).slice(0, VALIDATION_NODES_MAX);
  const graph = evaluateGraph(graphNodes);
  const providedTypedResults = input.typedResults && typeof input.typedResults === 'object' ? input.typedResults : {};
  const resultsByRef = new Map((Array.isArray(input.nodeResults) ? input.nodeResults : []).map((node) => [node.nodeRef, node]));
  const nodeResults = observationState === 'observed'
    ? graphNodes.map((node) => {
      const raw = resultsByRef.get(node.nodeRef) || {
        nodeRef: node.nodeRef,
        status: 'skipped',
        executionState: 'executed',
        skipReasonCode: 'MISSING_OBSERVED_RESULT',
      };
      return normalizeNodeResult(raw, node, providedTypedResults[node.nodeRef] || raw.typedResultPayload || null);
    })
    : [];
  const typedResults = observationState === 'observed'
    ? Object.fromEntries(nodeResults.map((node) => {
      const raw = resultsByRef.get(node.nodeRef) || {};
      const payload = providedTypedResults[node.nodeRef] || raw.typedResultPayload || {
        nodeRef: node.nodeRef,
        executionState: node.executionState,
        status: node.status,
        stabilityClass: node.stabilityClass,
      };
      return [node.nodeRef, payload];
    }))
    : {};
  const nodeInputDigests = normalizeNodeInputDigests(input, nodeResults, typedResults);
  const boundNodeResults = nodeResults.map((node) => ({
    ...node,
    nodeInputDigest: node.nodeInputDigest || nodeInputDigests[node.nodeRef] || null,
  }));
  const executedNodeRefs = boundNodeResults.filter((node) => node.executionState === 'executed').map((node) => node.nodeRef);
  const reusedNodeRefs = boundNodeResults.filter((node) => node.executionState === 'reused').map((node) => node.nodeRef);
  const rerunNodeRefs = boundNodeResults.filter((node) => node.executionState === 'rerun').map((node) => node.nodeRef);
  const localExecutionNodeCount = executedNodeRefs.length + rerunNodeRefs.length;
  const runWideInvocationLedger = normalizeInvocationLedger(input);
  const runWideInvocationCounts = runWideInvocationLedger.reduce((acc, entry) => {
    acc[entry.nodeRef] = (acc[entry.nodeRef] || 0) + 1;
    return acc;
  }, {});
  const runWideDuplicateExecutionCount = Object.values(runWideInvocationCounts).filter((count) => count > 1).length;
  const failedNode = nodeResults.find((node) => node.status === 'fail') || null;
  const requiredSkippedNode = nodeResults.find((node) => node.required === true && node.status === 'skipped') || null;
  const sourceClosure = sourceClosureManifest(input);
  const nodeSourceClosures = nodeSourceClosureManifest(input, graphNodes);
  const planCore = {
    profileId: input.profileId || 'source_shadow_validation',
    graphDigest: graph.graphDigest,
    topologicalOrderDigest: graph.topologicalOrderDigest,
    finalizerMode: input.finalizerMode || 'aggregate_only',
    downstreamRespawnAllowed: input.downstreamRespawnAllowed === true,
  };
  const planDigest = digestValue(planCore);
  const headForContext = input.headSha || process.env.CODEX_PR_HEAD_SHA || process.env.GITHUB_SHA || 'not_available';
  const validationContext = buildValidationContext(input, headForContext);
  const cacheKeyFields = buildCacheKeyFields(input, planDigest, sourceClosure.sourceClosureDigest, validationContext);
  const sourceClosureReuseForbidden = sourceClosure.declaredImportScanStatus !== 'pass';
  const cacheKeyInvalid = cacheKeyHasInvalidField(cacheKeyFields) || sourceClosureReuseForbidden;
  const reuseEligible = cacheReuseEligible(cacheKeyFields) && !sourceClosureReuseForbidden;
  const reuseDecision = classifyReuseDecision(nodeResults, input, cacheKeyInvalid);
  const cacheKeyDigest = cacheKeyInvalid ? null : digestValue(cacheKeyFields);
  const nodeCacheKeyDigests = Object.fromEntries(graphNodes.map((node) => {
    const nodeClosure = nodeSourceClosures[node.nodeRef] || {};
    const nodeSourceDigest = nodeSourceClosures[node.nodeRef]?.nodeSourceClosureDigest || sourceClosure.sourceClosureDigest;
    const nodeFields = {
      ...cacheKeyFields,
      scriptDigest: fieldState(nodeSourceDigest),
      nodeInputDigest: fieldState(nodeInputDigests[node.nodeRef], { reasonCode: 'NODE_INPUT_DIGEST_NOT_OBSERVED' }),
      nodeRef: fieldState(node.nodeRef),
    };
    return [node.nodeRef, cacheReuseEligible(nodeFields) && nodeClosure.declaredImportScanStatus === 'pass' ? digestValue(nodeFields) : null];
  }));
  const staticScan = finalizerStaticScan();
  const workspaceObserved = input.workspaceObserved === true || input.workspaceObservation?.observationState === 'observed';
  const workspaceIdentityCore = {
    repositoryKey: input.repositoryKey || 'github.com:hiro4649/codex-development-harness',
    remoteDigest: input.remoteDigest || digestValue({ repositoryKey: input.repositoryKey || 'github.com:hiro4649/codex-development-harness' }),
    branch: input.branch || process.env.CODEX_BRANCH || process.env.GITHUB_REF_NAME || 'unknown',
    sourceBranch: input.sourceBranch || process.env.GITHUB_HEAD_REF || input.branch || process.env.CODEX_BRANCH || 'unknown',
    checkoutRef: input.checkoutRef || process.env.GITHUB_REF || process.env.GITHUB_REF_NAME || 'unknown',
    testedTreeKind: fieldValue(validationContext.testedTreeKind) || 'unknown',
    sourceHeadOid: fieldValue(validationContext.sourceHeadOid) || 'unknown',
    baseOid: fieldValue(validationContext.baseOid) || 'unknown',
    testedCommitOid: fieldValue(validationContext.testedCommitOid) || 'unknown',
    validationContextDigest: fieldValue(validationContext.validationContextDigest) || null,
    headSha: fieldValue(cacheKeyFields.headSha) || 'unknown',
    activeHarnessVersion: input.activeHarnessVersion || '1.2.7',
  };
  const decisionInputManifestScanned = input.decisionInputManifest?.taxonomyScanStatus === 'pass'
    || input.decisionInputManifestScanned === true;
  const status = observationState === 'not_exercised'
    ? 'partial_shadow_candidate'
    : (graph.status === 'pass'
      && failedNode === null
      && requiredSkippedNode === null
      && FINALIZER_MODES.has(planCore.finalizerMode)
      && planCore.downstreamRespawnAllowed === false
      && cacheKeyInvalid === false
      && staticScan.childProcessImportDetected === false
      && staticScan.shellExecutionDetected === false
      && staticScan.networkImportDetected === false
        ? 'pass'
        : 'fail');
  const failureDirectedRequeue = buildFailureDirectedRequeue(input, graphNodes, boundNodeResults, nodeInputDigests);
  const loopEconomy = buildLoopEconomy(input, boundNodeResults, status, failureDirectedRequeue);
  const typedResultDigests = Object.fromEntries(graphNodes.map((node) => [node.nodeRef, digestValue(typedResults[node.nodeRef] || null)]));
  const nodeSourceClosureDigests = Object.fromEntries(graphNodes.map((node) => [
    node.nodeRef,
    nodeSourceClosures[node.nodeRef]?.nodeSourceClosureDigest || sourceClosure.sourceClosureDigest,
  ]));
  const baseHeadForSerializedCache = /^[a-f0-9]{40}$/.test(String(fieldValue(validationContext.baseOid) || ''))
    ? fieldValue(validationContext.baseOid)
    : digestValue({
      testedTreeKind: fieldValue(validationContext.testedTreeKind) || 'unknown',
      baseHead: 'not_applicable',
    });
  const realCacheCanary = observationState === 'observed'
    ? runV128SerializedCacheCanary({
      repositoryId: workspaceIdentityCore.repositoryKey,
      sourceHead: fieldValue(validationContext.sourceHeadOid) || fieldValue(cacheKeyFields.headSha) || 'unknown',
      baseHead: baseHeadForSerializedCache,
      testedCommit: fieldValue(validationContext.testedCommitOid) || fieldValue(cacheKeyFields.headSha) || 'unknown',
      testedTreeKind: fieldValue(validationContext.testedTreeKind) || 'unknown',
      validationContextDigest: fieldValue(validationContext.validationContextDigest) || null,
      nodeRefs: graphNodes.map((node) => node.nodeRef),
      typedResultDigests,
      nodeInputDigests,
      nodeSourceClosureDigests,
      actualCacheSampleCount: Number(input.actualCacheSampleCount ?? 0),
    })
    : { status: 'not_exercised', observed: false, safeSummaryOnly: true };
  const cacheReuseSimulation = observationState === 'observed'
    ? buildCacheReuseSimulation(input, graphNodes, boundNodeResults, typedResults, nodeInputDigests, nodeCacheKeyDigests, cacheKeyDigest, reuseEligible)
    : { status: 'not_exercised', observed: false, observationClass: 'simulation', safeSummaryOnly: true };
  const selectiveFailureMemory = buildSelectiveFailureMemory(input, failureDirectedRequeue);
  const loopAdmissionRouter = buildLoopAdmissionRouter(input, status, failureDirectedRequeue, loopEconomy);
  return {
    schemaVersion: '1.2.8',
    executionKind: 'validation_execution_plan_shadow',
    authority: 'non_authoritative_execution_surface',
    candidateActivationState: input.candidateActivationState || 'source_shadow_candidate',
    observationState,
    graph: {
      graphDigest: graph.graphDigest,
      topologicalOrderDigest: graph.topologicalOrderDigest,
      topologicalOrder: graph.topologicalOrder,
      nodes: graphNodes,
      duplicateNodeRefs: graph.duplicateNodeRefs,
      duplicateEdges: graph.duplicateEdges,
      status: graph.status,
      reasonCodes: graph.reasonCodes,
    },
    typedResults,
    sourceClosure,
    nodeSourceClosures,
    profileExecution: {
      profileId: planCore.profileId,
      planDigest,
      headSha: fieldValue(cacheKeyFields.headSha) || 'unknown',
      nodeCount: graphNodes.length,
      nodeResults: boundNodeResults,
      executedNodeRefs,
      reusedNodeRefs,
      rerunNodeRefs,
      failedNodeRef: failedNode?.nodeRef || null,
      requiredSkippedNodeRef: requiredSkippedNode?.nodeRef || null,
      runWideInvocationLedger,
      runWideInvocationCount: runWideInvocationLedger.length,
      runWideDuplicateExecutionCount,
      runWideInvocationLedgerStatus: runWideInvocationLedger.length && runWideDuplicateExecutionCount === 0
        ? 'pass'
        : (observationState === 'observed' && localExecutionNodeCount === 0 ? 'pass' : (observationState === 'observed' ? 'fail' : 'not_exercised')),
      finalizerMode: planCore.finalizerMode,
      downstreamRespawnAllowed: planCore.downstreamRespawnAllowed,
      finalizerStaticScan: staticScan,
      status,
    },
    validationReuseDecision: {
      reuseDecision,
      reusedNodeRefs,
      executedNodeRefs,
      rerunNodeRefs,
      missReasonRef: cacheKeyInvalid ? 'CACHE_KEY_FIELD_MISSING_OR_INVALID' : (reuseDecision === 'miss' ? 'NO_REUSABLE_NODE' : null),
      cacheKeyDigest,
      cacheKeyFields,
      nodeCacheKeyDigests,
      nodeInputDigests,
      cacheKeyHasPlaceholder: cacheKeyInvalid,
      sourceClosureReuseForbidden,
      sourceClosureReuseForbiddenReason: sourceClosureReuseForbidden ? 'SOURCE_CLOSURE_IMPORT_SCAN_NOT_PASS' : null,
      cacheReuseEligible: reuseEligible,
      skippedNodeRefs: reuseDecision === 'hit' || reuseDecision === 'partial_hit' ? reusedNodeRefs : [],
    },
    failureDirectedRequeue,
    cacheReuseSimulation,
    realCacheCanary,
    loopEconomy,
    loopAdmissionRouter,
    selectiveFailureMemory,
    stableDiagnosticTaxonomy: {
      decisionStableClasses: ['decision_stable'],
      cacheStableClasses: ['cache_stable'],
      diagnosticClasses: ['environment_diagnostic'],
      ownerInputClasses: ['owner_input'],
      forbiddenClasses: ['forbidden'],
      environmentDiagnosticExcludedFromDecisionDigest: input.environmentDiagnosticExcludedFromDecisionDigest !== false,
      rawLogForbidden: true,
      secretForbidden: true,
      localAbsolutePathForbidden: true,
      decisionInputManifestScanned,
      decisionInputManifestDigest: input.decisionInputManifest?.digest || null,
      decisionInputManifestScan: input.decisionInputManifest?.taxonomyScan || null,
      decisionInputManifestSanitizedDigest: input.decisionInputManifest?.sanitizedDecisionInputDigest || input.decisionInputManifest?.taxonomyScan?.sanitizedDecisionInputDigest || null,
      decisionInputManifestTaxonomyStatus: input.decisionInputManifest?.taxonomyScanStatus || (decisionInputManifestScanned ? 'pass' : 'not_scanned'),
      fields: [
        { field: 'normalizedArtifactFingerprint', stabilityClass: 'decision_stable' },
        { field: 'validationCacheKeyDigest', stabilityClass: 'cache_stable' },
      { field: 'runnerImageDigest', stabilityClass: 'environment_diagnostic' },
        { field: 'runnerClassDigest', stabilityClass: 'environment_diagnostic' },
      ],
    },
    workspaceIdentity: {
      ...workspaceIdentityCore,
      worktreeIdentityDigest: input.worktreeIdentityDigest || digestValue(workspaceIdentityCore),
      canonicalityState: input.canonicalityState || input.workspaceObservation?.canonicalityState || (workspaceObserved ? 'canonical' : 'unknown'),
      observationState: workspaceObserved ? 'observed' : 'not_exercised',
      observationDigest: input.workspaceObservation?.observationDigest || (workspaceObserved ? digestValue(workspaceIdentityCore) : null),
      rawWorkspacePathUploaded: input.rawWorkspacePathUploaded === true,
    },
    phaseProgress: {
      phase: input.phase || 'validation',
      currentNodeRef: input.currentNodeRef || graph.topologicalOrder[graph.topologicalOrder.length - 1] || null,
      completedNodeCount: boundNodeResults.filter((node) => node.status === 'pass').length,
      totalNodeCount: graphNodes.length,
      progressSequence: Number(input.progressSequence || (observationState === 'observed' ? 1 : 0)),
      lastProgressDigest: digestValue({ graphDigest: graph.graphDigest, status, completed: nodeResults.map((node) => [node.nodeRef, node.status]) }),
      stallClass: input.stallClass || 'none',
      observed: observationState === 'observed',
    },
    ownerAuthorityCreated: false,
    newP0ArtifactCreated: false,
    safeSummaryOnly: true,
  };
}

export function validateV128ValidationExecutionPlan(plan = {}) {
  const reasons = [];
  const execution = plan.profileExecution || {};
  const reuse = plan.validationReuseDecision || {};
  const requeue = plan.failureDirectedRequeue || {};
  const cacheReuseSimulation = plan.cacheReuseSimulation || {};
  const realCacheCanary = plan.realCacheCanary || {};
  const loopEconomy = plan.loopEconomy || {};
  const loopAdmissionRouter = plan.loopAdmissionRouter || {};
  const failureMemory = plan.selectiveFailureMemory || {};
  const taxonomy = plan.stableDiagnosticTaxonomy || {};
  const workspace = plan.workspaceIdentity || {};
  const graph = plan.graph || {};
  const typedResults = plan.typedResults && typeof plan.typedResults === 'object' ? plan.typedResults : {};
  const nodeResults = Array.isArray(execution.nodeResults) ? execution.nodeResults : [];
  const graphNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const nodeSourceClosures = plan.nodeSourceClosures && typeof plan.nodeSourceClosures === 'object' ? plan.nodeSourceClosures : {};
  const graphByRef = new Map(graphNodes.map((node) => [node.nodeRef, node]));
  const resultByRef = new Map(nodeResults.map((node) => [node.nodeRef, node]));
  if (plan.schemaVersion !== '1.2.8') reasons.push('validation_execution_schema_invalid');
  if (plan.executionKind !== 'validation_execution_plan_shadow') reasons.push('validation_execution_kind_invalid');
  if (plan.authority !== 'non_authoritative_execution_surface') reasons.push('validation_execution_authority_invalid');
  if (plan.candidateActivationState !== 'source_shadow_candidate') reasons.push('validation_execution_activation_state_invalid');
  if (!OBSERVATION_STATES.has(plan.observationState)) reasons.push('validation_execution_observation_state_invalid');
  if (!execution.profileId) reasons.push('profile_execution_profile_id_required');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(execution.planDigest || ''))) reasons.push('profile_execution_plan_digest_invalid');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(graph.graphDigest || ''))) reasons.push('validation_graph_digest_invalid');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(graph.topologicalOrderDigest || ''))) reasons.push('validation_graph_topological_digest_invalid');
  if (graph.status !== 'pass') reasons.push('validation_graph_invalid');
  if (plan.candidateActivationState === 'source_activation' && plan.sourceClosure?.declaredImportScanStatus !== 'pass') reasons.push('source_closure_import_scan_activation_blocker');
  if ((graph.duplicateNodeRefs || []).length > 0) reasons.push('graph_duplicate_node_ref');
  if ((graph.duplicateEdges || []).length > 0) reasons.push('graph_duplicate_edge');
  if (!Array.isArray(graph.nodes) || graph.nodes.length < 1 || graph.nodes.length > VALIDATION_NODES_MAX) reasons.push('validation_graph_node_count_invalid');
  if (plan.observationState === 'observed' && (nodeResults.length < 1 || nodeResults.length !== graph.nodes.length)) reasons.push('profile_execution_observed_node_results_required');
  if (plan.observationState === 'not_exercised' && nodeResults.length > 0) reasons.push('not_exercised_plan_cannot_include_node_results');
  if (!FINALIZER_MODES.has(execution.finalizerMode)) reasons.push('profile_execution_finalizer_must_be_aggregate_only');
  if (execution.downstreamRespawnAllowed === true) reasons.push('profile_execution_downstream_respawn_forbidden');
  if (execution.failedNodeRef) reasons.push('profile_execution_failed_node_present');
  if (execution.requiredSkippedNodeRef) reasons.push('profile_execution_required_skipped_node_present');
  const runWideInvocationLedger = Array.isArray(execution.runWideInvocationLedger) ? execution.runWideInvocationLedger : [];
  const localExecutionNodeCount = nodeResults.filter((node) => node.executionState !== 'reused').length;
  const recomputedInvocationCounts = runWideInvocationLedger.reduce((acc, entry) => {
    acc[entry.nodeRef] = (acc[entry.nodeRef] || 0) + 1;
    return acc;
  }, {});
  const recomputedDuplicateExecutionCount = Object.values(recomputedInvocationCounts).filter((count) => count > 1).length;
  const expectedLedgerStatus = runWideInvocationLedger.length && recomputedDuplicateExecutionCount === 0
    ? 'pass'
    : (plan.observationState === 'observed' && localExecutionNodeCount === 0 ? 'pass' : (plan.observationState === 'observed' ? 'fail' : 'not_exercised'));
  if (plan.observationState === 'observed' && localExecutionNodeCount > 0 && !runWideInvocationLedger.length) reasons.push('run_wide_invocation_ledger_required');
  if (recomputedDuplicateExecutionCount > 0) reasons.push('run_wide_duplicate_execution_detected');
  if (Number(execution.runWideInvocationCount || 0) !== runWideInvocationLedger.length) reasons.push('run_wide_invocation_count_mismatch');
  if (Number(execution.runWideDuplicateExecutionCount || 0) !== recomputedDuplicateExecutionCount) reasons.push('run_wide_duplicate_execution_count_mismatch');
  if ((execution.runWideInvocationLedgerStatus || 'not_exercised') !== expectedLedgerStatus) reasons.push('run_wide_invocation_status_mismatch');
  const ledgerByNode = new Map();
  const invocationSequences = new Set();
  const completionSequences = new Set();
  for (const entry of runWideInvocationLedger) {
    if (!graphByRef.has(entry.nodeRef)) reasons.push('run_wide_invocation_unknown_node');
    if (!/^sha256:[a-f0-9]{64}$/.test(String(entry.commandOrFunctionDigest || ''))) reasons.push('run_wide_invocation_command_digest_invalid');
    else if (nodeSourceClosures[entry.nodeRef]?.nodeSourceClosureDigest
      && entry.commandOrFunctionDigest !== nodeSourceClosures[entry.nodeRef].nodeSourceClosureDigest) reasons.push('run_wide_invocation_command_digest_mismatch');
    if (!/^sha256:[a-f0-9]{64}$/.test(String(entry.resultDigest || ''))) reasons.push('run_wide_invocation_result_digest_invalid');
    if (Number(entry.invocationSequence || 0) < 1 || Number(entry.completionSequence || 0) < 1) reasons.push('run_wide_invocation_sequence_invalid');
    if (Number(entry.completionSequence || 0) < Number(entry.invocationSequence || 0)) reasons.push('run_wide_invocation_sequence_invalid');
    if (invocationSequences.has(Number(entry.invocationSequence))) reasons.push('run_wide_invocation_sequence_duplicate');
    invocationSequences.add(Number(entry.invocationSequence));
    if (completionSequences.has(Number(entry.completionSequence))) reasons.push('run_wide_completion_sequence_duplicate');
    completionSequences.add(Number(entry.completionSequence));
    ledgerByNode.set(entry.nodeRef, entry);
  }
  const staticScan = execution.finalizerStaticScan || {};
  if (staticScan.childProcessImportDetected === true) reasons.push('finalizer_child_process_import_forbidden');
  if (staticScan.shellExecutionDetected === true) reasons.push('finalizer_shell_execution_forbidden');
  if (staticScan.networkImportDetected === true) reasons.push('finalizer_network_import_forbidden');
  for (const node of nodeResults) {
    if (!node.nodeRef) reasons.push('profile_execution_node_ref_required');
    if (!EXECUTION_STATES.has(node.executionState)) reasons.push(`profile_execution_state_invalid_${node.executionState || 'missing'}`);
    if (!NODE_STATUSES.has(node.status)) reasons.push(`profile_execution_node_status_invalid_${node.status || 'missing'}`);
    if (!STABILITY_CLASSES.has(node.stabilityClass)) reasons.push(`stability_class_invalid_${node.stabilityClass || 'missing'}`);
    if (node.typedResultRef !== typedResultRef(node.nodeRef)) reasons.push('typed_result_ref_invalid');
    if (!typedResults[node.nodeRef]) reasons.push('typed_result_payload_missing');
    else if (node.resultDigest !== digestValue(typedResults[node.nodeRef])) reasons.push('typed_result_payload_digest_mismatch');
    if (plan.observationState === 'observed' && !/^sha256:[a-f0-9]{64}$/.test(String(node.nodeInputDigest || ''))) reasons.push('node_input_digest_required');
    if (plan.observationState === 'observed' && node.executionState === 'executed') {
      const ledgerEntry = ledgerByNode.get(node.nodeRef);
      if (!ledgerEntry) reasons.push('run_wide_invocation_missing_for_executed_node');
      else if (ledgerEntry.resultDigest !== node.resultDigest) reasons.push('run_wide_invocation_result_digest_mismatch');
    }
    if (plan.observationState === 'observed' && node.executionState === 'reused' && ledgerByNode.has(node.nodeRef)) reasons.push('run_wide_invocation_for_reused_node_forbidden');
    if (plan.observationState === 'observed' && node.executionState === 'executed' && node.executionCountObserved !== true) reasons.push('execution_count_observation_required');
    if (Number(node.executionCount || 0) > 1) reasons.push('profile_execution_node_executed_more_than_once');
    if (node.executionState === 'executed' && Number(node.executionCount) !== 1) reasons.push('executed_node_execution_count_must_be_one');
    if (node.executionState === 'reused' && Number(node.executionCount) !== 0) reasons.push('reused_node_execution_count_must_be_zero');
    if (node.required === true && node.status === 'skipped') reasons.push('profile_execution_required_skipped_node_present');
    if (node.executionState === 'reused') {
      if (!node.sourceRunRef) reasons.push('reused_node_source_run_ref_required');
      reasons.push(...validateSourceRunRef(node.sourceRunRef, node));
      const expectedSourceHead = fieldValue(reuse.cacheKeyFields?.sourceHeadOid);
      const expectedTestedCommit = fieldValue(reuse.cacheKeyFields?.testedCommitOid);
      if (/^[a-f0-9]{40}$/.test(String(expectedSourceHead || ''))
        && node.sourceRunRef?.sourceHeadSha !== expectedSourceHead) reasons.push('reused_node_source_run_ref_source_head_binding_mismatch');
      if (/^[a-f0-9]{40}$/.test(String(expectedTestedCommit || ''))
        && node.sourceRunRef?.testedCommitOid !== expectedTestedCommit) reasons.push('reused_node_source_run_ref_tested_commit_binding_mismatch');
      if (!/^sha256:[a-f0-9]{64}$/.test(String(node.sourceResultDigest || ''))) reasons.push('reused_node_source_result_digest_required');
      else if (node.sourceResultDigest !== node.resultDigest) reasons.push('reused_node_source_result_digest_mismatch');
      if (!/^[a-f0-9]{40}$/.test(String(node.sourceHeadSha || ''))) reasons.push('reused_node_source_head_sha_required');
      if (!/^sha256:[a-f0-9]{64}$/.test(String(node.cacheKeyDigest || ''))) reasons.push('reused_node_cache_key_digest_required');
      else {
        const nodeCacheKeyDigest = reuse.nodeCacheKeyDigests?.[node.nodeRef] || null;
        const runWideCacheKeyDigest = reuse.cacheKeyDigest || null;
        if (node.cacheKeyDigest !== nodeCacheKeyDigest && node.cacheKeyDigest !== runWideCacheKeyDigest) reasons.push('reused_node_cache_key_digest_mismatch');
      }
      if (node.sourceRunRef?.nodeInputDigest && node.sourceRunRef.nodeInputDigest !== node.nodeInputDigest) reasons.push('reused_node_source_run_ref_node_input_digest_mismatch');
      if (!node.resultSchemaVersion) reasons.push('reused_node_result_schema_required');
    }
  }
  const aggregateGraphNode = graphByRef.get('aggregate_finalizer');
  const aggregatePayload = typedResults.aggregate_finalizer || null;
  if (plan.observationState === 'observed') {
    if (!aggregateGraphNode) reasons.push('finalizer_graph_node_required');
    if (!aggregatePayload) reasons.push('finalizer_typed_payload_required');
  }
  if (aggregateGraphNode && aggregatePayload) {
    const expectedRefs = [...(aggregateGraphNode.dependsOn || [])].sort();
    const actualRefs = [...(aggregatePayload.upstreamNodeRefs || [])].sort();
    if (JSON.stringify(expectedRefs) !== JSON.stringify(actualRefs)) reasons.push('finalizer_upstream_refs_mismatch');
    const digestByRef = new Map((aggregatePayload.upstreamResultDigests || []).map((item) => [item.nodeRef, item.resultDigest]));
    for (const upstreamRef of expectedRefs) {
      const upstreamResult = resultByRef.get(upstreamRef);
      if (!upstreamResult) {
        reasons.push('finalizer_upstream_result_missing');
        continue;
      }
      if (!digestByRef.has(upstreamRef)) reasons.push('finalizer_upstream_digest_missing');
      else if (digestByRef.get(upstreamRef) !== upstreamResult.resultDigest) reasons.push('finalizer_upstream_digest_mismatch');
    }
    const failedUpstreamRefs = expectedRefs.filter((upstreamRef) => resultByRef.get(upstreamRef)?.status !== 'pass');
    if (failedUpstreamRefs.length && aggregatePayload.status !== 'fail') reasons.push('finalizer_failed_upstream_must_fail');
    const payloadFailedRefs = new Set(aggregatePayload.failedNodeRefs || []);
    for (const upstreamRef of failedUpstreamRefs) {
      if (!payloadFailedRefs.has(upstreamRef)) reasons.push('finalizer_failed_upstream_ref_missing');
    }
  }
  if (!REUSE_DECISIONS.has(reuse.reuseDecision)) reasons.push('validation_reuse_decision_invalid');
  const executedCount = nodeResults.filter((node) => node.executionState === 'executed').length;
  const reusedCount = nodeResults.filter((node) => node.executionState === 'reused').length;
  if (reuse.reuseDecision === 'hit' && (reusedCount === 0 || executedCount > 0)) reasons.push('validation_reuse_hit_execution_state_mismatch');
  if (reuse.reuseDecision === 'partial_hit' && (reusedCount === 0 || executedCount === 0)) reasons.push('validation_reuse_partial_hit_state_mismatch');
  if (reuse.reuseDecision === 'miss' && reusedCount > 0) reasons.push('validation_reuse_miss_cannot_include_reused_nodes');
  if (reuse.reuseDecision !== 'miss' && reuse.sourceClosureReuseForbidden === true) reasons.push('validation_source_closure_reuse_forbidden');
  if (plan.observationState === 'observed' && reuse.cacheKeyHasPlaceholder === true) reasons.push('validation_reuse_cache_key_placeholder');
  if (plan.observationState === 'observed' && reuse.reuseDecision !== 'miss' && !/^sha256:[a-f0-9]{64}$/.test(String(reuse.cacheKeyDigest || ''))) reasons.push('validation_reuse_cache_key_digest_invalid');
  for (const [fieldName, field] of Object.entries(reuse.cacheKeyFields || {})) {
    if (!FIELD_STATES.has(field?.state)) reasons.push('validation_reuse_cache_key_field_state_invalid');
    if (plan.observationState === 'observed' && field?.state === 'invalid') reasons.push('validation_reuse_cache_key_field_missing_or_invalid');
    if (plan.observationState === 'observed' && field?.state === 'missing' && REQUIRED_CACHE_FIELDS.has(fieldName)) reasons.push('validation_reuse_cache_key_field_missing_or_invalid');
    if (plan.observationState === 'observed' && reuse.reuseDecision !== 'miss' && field?.state === 'missing' && REUSE_BINDING_FIELDS.has(fieldName)) reasons.push('validation_reuse_binding_field_missing');
    if (fieldName === 'runnerImageDigest' && field?.state === 'missing' && reuse.reuseDecision !== 'miss') reasons.push('runner_image_missing_prevents_reuse');
  }
  for (const [nodeRef, digest] of Object.entries(reuse.nodeCacheKeyDigests || {})) {
    if (!graphByRef.has(nodeRef)) reasons.push('node_cache_key_digest_unknown_node');
    if (reuse.reuseDecision !== 'miss' && !/^sha256:[a-f0-9]{64}$/.test(String(digest || ''))) reasons.push('node_cache_key_digest_invalid');
  }
  if (requeue.mode && requeue.mode !== 'failure_directed_requeue') reasons.push('failure_directed_requeue_mode_invalid');
  if (!Array.isArray(requeue.failedNodeRefs)) reasons.push('failure_directed_failed_nodes_required');
  if (Number(requeue.unaffectedNodeRerunCount || 0) !== (Array.isArray(requeue.unaffectedNodeRerunRefs) ? requeue.unaffectedNodeRerunRefs.length : 0)) reasons.push('failure_directed_unaffected_rerun_count_mismatch');
  if (Number(requeue.unaffectedNodeRerunCount || 0) > 0) reasons.push('failure_directed_unaffected_node_rerun_forbidden');
  if (requeue.noProgressStop === true) reasons.push('failure_directed_no_progress_stop_required');
  if (plan.observationState === 'observed' && !/^sha256:[a-f0-9]{64}$/.test(String(requeue.currentAttemptDigest || ''))) reasons.push('failure_directed_current_attempt_digest_required');
  const requeueAllowed = new Set(Array.isArray(requeue.allowedRequeueNodeRefs) ? requeue.allowedRequeueNodeRefs : []);
  for (const nodeRef of requeue.actualRequeuedNodeRefs || []) {
    if (!graphByRef.has(nodeRef)) reasons.push('failure_directed_unknown_requeue_node');
    if (!requeueAllowed.has(nodeRef)) reasons.push('failure_directed_unallowed_requeue_node');
  }
  if (plan.observationState === 'observed') {
    if (cacheReuseSimulation.status === 'pass') reasons.push('cache_reuse_simulation_cannot_pass');
    if (cacheReuseSimulation.observationClass && cacheReuseSimulation.observationClass !== 'simulation') reasons.push('cache_reuse_simulation_class_invalid');
    if (!['pass', 'partial_shadow_candidate'].includes(realCacheCanary.status || 'missing')) reasons.push('real_cache_canary_status_invalid');
    if (realCacheCanary.status === 'pass') {
      if (realCacheCanary.observed !== true) reasons.push('real_cache_canary_observed_required');
      if (realCacheCanary.observationClass !== 'serialized_cache_canary') reasons.push('real_cache_canary_observation_class_required');
      if (!['same_environment_serialized_cache', 'provider_image_serialized_cache'].includes(realCacheCanary.proofScope || 'missing')) reasons.push('real_cache_canary_proof_scope_invalid');
      const executionIds = [
        realCacheCanary.coldMiss?.executionId,
        realCacheCanary.realHit?.executionId,
        realCacheCanary.realPartialHit?.executionId,
      ].filter(Boolean);
      if (executionIds.length !== 3 || new Set(executionIds).size !== 3) reasons.push('real_cache_canary_distinct_execution_ids_required');
      if (realCacheCanary.coldMiss?.reuseDecision !== 'miss') reasons.push('real_cache_canary_cold_miss_required');
      if (Number(realCacheCanary.coldMiss?.reusedNodeCount || 0) !== 0) reasons.push('real_cache_canary_cold_miss_reused_forbidden');
      if (Number(realCacheCanary.coldMiss?.executedEligibleNodeCount || 0) !== graphNodes.length) reasons.push('real_cache_canary_cold_miss_all_nodes_required');
      if (realCacheCanary.realHit?.reuseDecision !== 'hit') reasons.push('real_cache_canary_hit_required');
      if (Number(realCacheCanary.realHit?.executedEligibleNodeCount || 0) !== 0) reasons.push('real_cache_canary_hit_execution_forbidden');
      if (Number(realCacheCanary.realHit?.reusedEligibleNodeCount || 0) !== graphNodes.length) reasons.push('real_cache_canary_hit_reuse_all_required');
      if (realCacheCanary.realHit?.commandSuppressionObserved !== true) reasons.push('real_cache_canary_hit_command_suppression_required');
      if (realCacheCanary.realPartialHit?.reuseDecision !== 'partial_hit') reasons.push('real_cache_canary_partial_hit_required');
      const partialExecuted = Array.isArray(realCacheCanary.realPartialHit?.executedNodeRefs) ? realCacheCanary.realPartialHit.executedNodeRefs : [];
      const partialReused = Array.isArray(realCacheCanary.realPartialHit?.reusedNodeRefs) ? realCacheCanary.realPartialHit.reusedNodeRefs : [];
      if (canonicalJson([...partialExecuted].sort()) !== canonicalJson(['aggregate_finalizer', 'projection_reader'])) reasons.push('real_cache_canary_partial_executed_refs_invalid');
      if (canonicalJson([...partialReused].sort()) !== canonicalJson(['managed_context_emitter', 'state_matrix_executor'])) reasons.push('real_cache_canary_partial_reused_refs_invalid');
      if (Number(realCacheCanary.realPartialHit?.unaffectedNodeRerunCount || 0) !== 0) reasons.push('real_cache_canary_unaffected_rerun_forbidden');
      if (realCacheCanary.realPartialHit?.commandSuppressionObserved !== true) reasons.push('real_cache_canary_partial_command_suppression_required');
      if (!isSha256Digest(realCacheCanary.cacheRecordReadbackDigest)) reasons.push('real_cache_canary_cache_readback_digest_required');
      if (realCacheCanary.actualCacheProof?.status !== 'pass') reasons.push('real_cache_canary_actual_executor_proof_required');
      if (Number(realCacheCanary.actualCacheProof?.sampleCount || 0) < 20) reasons.push('real_cache_canary_actual_sample_count_required');
      if (Number(realCacheCanary.actualCacheProof?.realHitAdapterInvocationCount || 0) !== 0) reasons.push('real_cache_canary_actual_hit_adapter_invocation_forbidden');
      if (Number(realCacheCanary.actualCacheProof?.partialHitUnaffectedAdapterInvocationCount || 0) !== 0) reasons.push('real_cache_canary_actual_partial_unaffected_invocation_forbidden');
      if (realCacheCanary.actualCacheProof?.resultEquivalenceState !== 'pass') reasons.push('real_cache_canary_actual_result_equivalence_required');
      if (!isSha256Digest(realCacheCanary.actualCacheProof?.cacheProofDigest)) reasons.push('real_cache_canary_actual_proof_digest_required');
      if (!isSha256Digest(realCacheCanary.canaryDigest)) reasons.push('real_cache_canary_digest_required');
      if (!isSha256Digest(realCacheCanary.canaryTransportDigest)) reasons.push('real_cache_canary_transport_digest_required');
      if (Number(realCacheCanary.performance?.realHitExecutedCommandCount || 0) !== 0) reasons.push('real_cache_canary_hit_performance_execution_forbidden');
      if (Number(realCacheCanary.performance?.suppressedCommandCount || 0) < 1) reasons.push('real_cache_canary_suppressed_command_count_required');
    }
  }
  if (loopEconomy.observed === true && plan.observationState !== 'observed') reasons.push('loop_economy_observed_requires_observed_plan');
  if (Number(loopEconomy.fullContextResendCount || 0) > 1) reasons.push('loop_economy_full_context_resend_over_budget');
  if (loopEconomy.modelInvocationObserved === true && Number(loopEconomy.modelInvocationCount || 0) > MAX_MODEL_INVOCATIONS) reasons.push('loop_economy_model_invocation_over_budget');
  if (loopEconomy.modelInvocationObserved === true && !isSha256Digest(loopEconomy.modelTransportDigest)) reasons.push('loop_economy_model_transport_digest_required');
  if (loopEconomy.modelInvocationObserved !== true && loopEconomy.modelTransportDigest !== null) reasons.push('loop_economy_unobserved_model_transport_digest_must_be_null');
  if (loopEconomy.modelInvocationObserved !== true && loopEconomy.modelInvocationCount !== null) reasons.push('loop_economy_unobserved_model_invocation_count_must_be_null');
  if (Number(loopEconomy.deltaContextBytes || 0) > DELTA_CONTEXT_BYTES_MAX) reasons.push('loop_economy_delta_context_over_budget');
  if (!LOOP_BUDGET_STATES.has(loopEconomy.budgetState || 'incomplete_observation')) reasons.push('loop_economy_budget_state_invalid');
  if (!ACCEPTED_CHANGE_STATES.has(loopEconomy.acceptedChangeState || 'validation_pass')) reasons.push('loop_economy_accepted_change_state_invalid');
  if (plan.observationState === 'observed' && loopEconomy.acceptedChangeState === 'merged'
    && !(Number(loopEconomy.managedInputBytesPerAcceptedChange) > 0)) reasons.push('loop_economy_managed_bytes_per_accepted_change_required');
  if (plan.observationState === 'observed' && loopEconomy.acceptedChangeState !== 'merged'
    && loopEconomy.managedInputBytesPerAcceptedChange !== null) reasons.push('loop_economy_managed_bytes_per_accepted_change_requires_accepted_change');
  if (execution.status === 'pass' && Number(loopEconomy.managedInputBytes || 0) > 0
    && !(Number(loopEconomy.residentAndDeltaBytesPerValidatedPass || 0) > 0)) reasons.push('loop_economy_validated_pass_bytes_required');
  if (Number(loopEconomy.maxIterations || MAX_ITERATIONS) !== MAX_ITERATIONS) reasons.push('loop_economy_max_iterations_invalid');
  if (Number(loopEconomy.maxModelInvocations || MAX_MODEL_INVOCATIONS) !== MAX_MODEL_INVOCATIONS) reasons.push('loop_economy_max_model_invocations_invalid');
  if (!LOOP_EXECUTION_MODES.has(loopAdmissionRouter.executionMode)) reasons.push('loop_admission_execution_mode_invalid');
  if (!LOOP_ADMISSION_STATUSES.has(loopAdmissionRouter.admissionStatus)) reasons.push('loop_admission_status_invalid');
  if (!LOOP_TRANSITION_CODES.has(loopAdmissionRouter.loopTransitionCode)) reasons.push('loop_admission_loop_transition_invalid');
  if (!OPERATOR_NEXT_ACTION_CODES.has(loopAdmissionRouter.operatorNextActionCode || 'auto_wait')) reasons.push('loop_admission_operator_next_action_invalid');
  if (!loopAdmissionRouter.authorityBoundaryAction) reasons.push('loop_admission_authority_boundary_action_required');
  if (loopAdmissionRouter.executionMode === 'protected_routine' && loopAdmissionRouter.protectedExecutorAvailable !== true) reasons.push('loop_admission_protected_executor_required');
  if (!LOOP_BUDGET_STATES.has(loopAdmissionRouter.budgetState || 'incomplete_observation')) reasons.push('loop_admission_budget_state_invalid');
  if (loopAdmissionRouter.admissionStatus === 'admitted'
    && loopAdmissionRouter.executionMode !== 'one_shot'
    && loopAdmissionRouter.budgetState !== 'observed_within_budget') reasons.push('loop_admission_loop_requires_observed_budget');
  if (loopAdmissionRouter.executionMode === 'bounded_goal' && loopAdmissionRouter.admissionStatus === 'admitted') {
    const evidence = loopAdmissionRouter.evidenceStates || {};
    if (evidence.objectiveCompletionContractObserved !== true
      || evidence.agentEndToEndCapabilityObserved !== true
      || evidence.economicBenefitObserved !== true
      || evidence.repairableFailureObserved !== true) reasons.push('loop_admission_bounded_goal_evidence_required');
    for (const key of ['objectiveContractDigest', 'capabilityProfileDigest', 'economicsObservationDigest', 'repairableFailureEvidenceDigest']) {
      if (!isSha256Digest(evidence[key])) reasons.push(`loop_admission_${key}_required`);
    }
  }
  if (loopAdmissionRouter.executionMode === 'protected_routine' && loopAdmissionRouter.admissionStatus === 'admitted') {
    const evidence = loopAdmissionRouter.evidenceStates || {};
    for (const key of ['taskRecurrenceDigest', 'objectiveContractDigest', 'capabilityProfileDigest', 'economicsObservationDigest']) {
      if (!isSha256Digest(evidence[key])) reasons.push(`loop_admission_${key}_required`);
    }
  }
  if (loopAdmissionRouter.executionMode === 'one_shot' && Number(loopAdmissionRouter.failedNodeCount || 0) === 0
    && loopAdmissionRouter.admissionStatus === 'admitted'
    && loopAdmissionRouter.loopTransitionCode !== 'LOOP_NOT_REQUIRED') reasons.push('loop_admission_one_shot_transition_invalid');
  if (Number(loopAdmissionRouter.failedNodeCount || 0) !== (Array.isArray(requeue.failedNodeRefs) ? requeue.failedNodeRefs.length : 0)) reasons.push('loop_admission_failed_count_mismatch');
  if (Number(loopAdmissionRouter.iterationCount || 0) > MAX_ITERATIONS) reasons.push('loop_admission_iteration_limit_exceeded');
  if (Number(loopAdmissionRouter.noProgressCount || 0) > 1) reasons.push('loop_admission_no_progress_limit_exceeded');
  if (Number(loopAdmissionRouter.flipFlopCount || 0) > 1) reasons.push('loop_admission_flip_flop_limit_exceeded');
  if (Number(loopAdmissionRouter.maxIterations || 0) !== MAX_ITERATIONS) reasons.push('loop_admission_max_iterations_invalid');
  if (Number(loopAdmissionRouter.maxModelInvocations || 0) !== MAX_MODEL_INVOCATIONS) reasons.push('loop_admission_max_model_invocations_invalid');
  if (loopAdmissionRouter.humanOwnerDecisionRequired === true) reasons.push('loop_admission_human_owner_decision_forbidden');
  if (loopAdmissionRouter.ownerAuthorityCreated === true || loopAdmissionRouter.sourceActivationAuthorized === true
    || loopAdmissionRouter.targetRolloutAuthorized === true || loopAdmissionRouter.newP0ArtifactCreated === true) reasons.push('loop_admission_authority_boundary_violation');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(loopAdmissionRouter.admissionDigest || ''))) reasons.push('loop_admission_digest_required');
  else if (loopAdmissionRouter.admissionDigest !== buildV128LoopAdmissionDigest(loopAdmissionRouter)) reasons.push('loop_admission_digest_mismatch');
  if (failureMemory.storesRawLogs === true || failureMemory.storesFullDiff === true || failureMemory.storesConversation === true) reasons.push('selective_failure_memory_forbidden_payload');
  if (failureMemory.memoryDigest && !/^sha256:[a-f0-9]{64}$/.test(String(failureMemory.memoryDigest))) reasons.push('selective_failure_memory_digest_invalid');
  if (taxonomy.environmentDiagnosticExcludedFromDecisionDigest !== true) reasons.push('environment_diagnostic_must_be_excluded_from_decision_digest');
  if (taxonomy.rawLogForbidden !== true || taxonomy.secretForbidden !== true || taxonomy.localAbsolutePathForbidden !== true) reasons.push('stable_diagnostic_forbidden_boundary_missing');
  if (plan.observationState === 'observed' && taxonomy.decisionInputManifestScanned !== true) reasons.push('decision_input_manifest_scan_required');
  if (plan.observationState === 'observed' && taxonomy.decisionInputManifestTaxonomyStatus !== 'pass') reasons.push('decision_input_manifest_taxonomy_scan_required');
  if (taxonomy.decisionInputManifestScan?.forbiddenPathCount > 0) reasons.push('decision_input_manifest_forbidden_path_detected');
  if (taxonomy.decisionInputManifestScan?.environmentDiagnosticPathCount > 0
    && !/^sha256:[a-f0-9]{64}$/.test(String(taxonomy.decisionInputManifestSanitizedDigest || ''))) reasons.push('decision_input_manifest_sanitized_digest_required');
  for (const field of taxonomy.fields || []) {
    if (!STABILITY_CLASSES.has(field.stabilityClass)) reasons.push(`taxonomy_field_stability_invalid_${field.stabilityClass || 'missing'}`);
    if (field.stabilityClass === 'forbidden') reasons.push('forbidden_field_cannot_enter_execution_surface');
  }
  if (!workspace.repositoryKey) reasons.push('workspace_repository_key_required');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(workspace.remoteDigest || ''))) reasons.push('workspace_remote_digest_invalid');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(workspace.worktreeIdentityDigest || ''))) reasons.push('workspace_identity_digest_invalid');
  if (!CANONICALITY_STATES.has(workspace.canonicalityState)) reasons.push(`workspace_canonicality_invalid_${workspace.canonicalityState || 'missing'}`);
  if (!OBSERVATION_STATES.has(workspace.observationState)) reasons.push('workspace_observation_state_invalid');
  if (workspace.canonicalityState === 'canonical' && workspace.observationState !== 'observed') reasons.push('workspace_canonical_requires_observation');
  if (workspace.rawWorkspacePathUploaded === true) reasons.push('raw_workspace_path_upload_forbidden');
  if (plan.ownerAuthorityCreated === true) reasons.push('validation_execution_cannot_create_owner_authority');
  if (plan.newP0ArtifactCreated === true) reasons.push('validation_execution_cannot_create_new_p0_artifact');
  return reasons.length ? { status: 'fail', reasonCodes: [...new Set(reasons)], safeSummaryOnly: true } : {
    status: 'pass',
    executionStatus: execution.status,
    observationState: plan.observationState,
    planDigest: execution.planDigest,
    cacheKeyDigest: reuse.cacheKeyDigest || null,
    safeSummaryOnly: true,
  };
}

function main() {
  const plan = buildV128ValidationExecutionPlan();
  const validation = validateV128ValidationExecutionPlan(plan);
  process.stdout.write(`${canonicalJson({ plan, validation })}\n`);
  process.exit(validation.status === 'pass' ? 0 : 1);
}

if (process.argv[1] && process.argv[1].endsWith('codex-v128-validation-execution-plan.mjs')) {
  main();
}
