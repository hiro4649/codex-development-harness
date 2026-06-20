#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const VALIDATION_NODES_MAX = 12;
const FINALIZER_MODES = new Set(['aggregate_only']);
const EXECUTION_STATES = new Set(['executed', 'reused', 'rerun']);
const NODE_STATUSES = new Set(['pass', 'fail', 'skipped']);
const OBSERVATION_STATES = new Set(['observed', 'not_exercised']);
const FIELD_STATES = new Set(['observed', 'not_required_with_reason', 'missing', 'invalid']);
const REUSE_DECISIONS = new Set(['hit', 'partial_hit', 'miss']);
const STABILITY_CLASSES = new Set(['decision_stable', 'cache_stable', 'environment_diagnostic', 'owner_input', 'forbidden']);
const CANONICALITY_STATES = new Set(['canonical', 'duplicate_candidate', 'repo_mismatch', 'harness_version_mismatch', 'unknown']);
const PLACEHOLDER_VALUES = new Set(['', 'unknown', 'required', 'null', 'undefined', 'placeholder', 'not_available']);
const SOURCE_CLOSURE_FILES = [
  'scripts/codex-v128-validation-execution-plan.mjs',
  'scripts/codex-v128-aggregate-finalizer.mjs',
  'scripts/codex-local-quality-gate.mjs',
  'scripts/codex-orchestration-capsule.mjs',
  'scripts/codex-v128-projection-reader.mjs',
  'scripts/codex-v128-managed-context-emitter.mjs',
  'scripts/codex-v128-state-matrix.mjs',
  'scripts/codex-v128-integrity-lib.mjs',
  'docs/process/CODEX_V128_CONTRACT_SCHEMA.json',
  'docs/process/CODEX_V128_SPEC.md',
];
const REQUIRED_CACHE_FIELDS = new Set(['headSha', 'planDigest', 'scriptDigest', 'runtimeVersion', 'taskProfile', 'environmentClass']);

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function digestValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
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

function readFileDigest(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return {
    path: filePath,
    digest: sha256Text(text),
    bytes: Buffer.byteLength(text, 'utf8'),
    text,
  };
}

function sourceClosureManifest(input = {}) {
  const files = Array.isArray(input.sourceClosureFiles) && input.sourceClosureFiles.length
    ? input.sourceClosureFiles
    : SOURCE_CLOSURE_FILES;
  const declared = new Set(files.map((file) => file.replace(/\\/g, '/')));
  const sourceFileReads = files.map(readFileDigest);
  const importPattern = /(?:import\s+(?:[^'"]*?\s+from\s*)?|export\s+[^'"]*?\s+from\s*|import\s*\(\s*|require\(\s*)['"]([^'"]+)['"]/g;
  const undeclared = [];
  const resolveDeclaredPath = (fromPath, specifier) => {
    if (!specifier.startsWith('.')) return null;
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath.replace(/\\/g, '/')), specifier));
    const candidates = [base, `${base}.mjs`, `${base}.js`, `${base}.json`, path.posix.join(base, 'index.mjs'), path.posix.join(base, 'index.js')];
    return candidates.find((candidate) => declared.has(candidate)) || base;
  };
  for (const file of sourceFileReads) {
    importPattern.lastIndex = 0;
    let match;
    while ((match = importPattern.exec(file.text)) !== null) {
      const specifier = match[1];
      const resolved = resolveDeclaredPath(file.path, specifier);
      if (resolved && !declared.has(resolved)) {
        undeclared.push({ from: file.path, specifier, resolved });
      }
    }
  }
  const sourceFiles = sourceFileReads.map(({ text, ...entry }) => entry);
  return {
    sourceFiles,
    declaredImportScanStatus: undeclared.length ? 'activation_blocker' : 'pass',
    undeclaredRelativeImportCount: undeclared.length,
    undeclaredRelativeImportSamples: undeclared.slice(0, 12),
    sourceClosureDigest: digestValue(sourceFiles),
  };
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
    resultSchemaVersion: node.resultSchemaVersion || '1.0.0',
  };
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

function buildCacheKeyFields(input = {}, planDigest, sourceClosureDigest) {
  const head = input.headSha || process.env.CODEX_PR_HEAD_SHA || process.env.GITHUB_SHA || 'not_available';
  return {
    headSha: fieldState(head, { reasonCode: 'HEAD_NOT_OBSERVED' }),
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
  const executedNodeRefs = nodeResults.filter((node) => node.executionState === 'executed').map((node) => node.nodeRef);
  const reusedNodeRefs = nodeResults.filter((node) => node.executionState === 'reused').map((node) => node.nodeRef);
  const rerunNodeRefs = nodeResults.filter((node) => node.executionState === 'rerun').map((node) => node.nodeRef);
  const failedNode = nodeResults.find((node) => node.status === 'fail') || null;
  const requiredSkippedNode = nodeResults.find((node) => node.required === true && node.status === 'skipped') || null;
  const sourceClosure = sourceClosureManifest(input);
  const planCore = {
    profileId: input.profileId || 'source_shadow_validation',
    graphDigest: graph.graphDigest,
    topologicalOrderDigest: graph.topologicalOrderDigest,
    finalizerMode: input.finalizerMode || 'aggregate_only',
    downstreamRespawnAllowed: input.downstreamRespawnAllowed === true,
  };
  const planDigest = digestValue(planCore);
  const cacheKeyFields = buildCacheKeyFields(input, planDigest, sourceClosure.sourceClosureDigest);
  const cacheKeyInvalid = cacheKeyHasInvalidField(cacheKeyFields);
  const reuseEligible = cacheReuseEligible(cacheKeyFields);
  const reuseDecision = classifyReuseDecision(nodeResults, input, cacheKeyInvalid);
  const cacheKeyDigest = reuseEligible ? digestValue(cacheKeyFields) : null;
  const boundNodeResults = nodeResults.map((node) => (
    node.executionState === 'reused' && !node.cacheKeyDigest
      ? { ...node, cacheKeyDigest }
      : node
  ));
  const staticScan = finalizerStaticScan();
  const workspaceObserved = input.workspaceObserved === true || input.workspaceObservation?.observationState === 'observed';
  const workspaceIdentityCore = {
    repositoryKey: input.repositoryKey || 'github.com:hiro4649/codex-development-harness',
    remoteDigest: input.remoteDigest || digestValue({ repositoryKey: input.repositoryKey || 'github.com:hiro4649/codex-development-harness' }),
    branch: input.branch || process.env.CODEX_BRANCH || process.env.GITHUB_REF_NAME || 'unknown',
    sourceBranch: input.sourceBranch || process.env.GITHUB_HEAD_REF || input.branch || process.env.CODEX_BRANCH || 'unknown',
    checkoutRef: input.checkoutRef || process.env.GITHUB_REF || process.env.GITHUB_REF_NAME || 'unknown',
    testedTreeKind: input.testedTreeKind || (String(process.env.GITHUB_REF || '').includes('/pull/') ? 'pull_request_merge_ref' : 'branch_head'),
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
      cacheKeyHasPlaceholder: cacheKeyInvalid,
      cacheReuseEligible: reuseEligible,
      skippedNodeRefs: reuseDecision === 'hit' || reuseDecision === 'partial_hit' ? reusedNodeRefs : [],
    },
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
  const taxonomy = plan.stableDiagnosticTaxonomy || {};
  const workspace = plan.workspaceIdentity || {};
  const graph = plan.graph || {};
  const typedResults = plan.typedResults && typeof plan.typedResults === 'object' ? plan.typedResults : {};
  const nodeResults = Array.isArray(execution.nodeResults) ? execution.nodeResults : [];
  const graphNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
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
  if (plan.candidateActivationState === 'source_activation' && plan.sourceClosure?.undeclaredRelativeImportCount > 0) reasons.push('source_closure_undeclared_import_activation_blocker');
  if ((graph.duplicateNodeRefs || []).length > 0) reasons.push('graph_duplicate_node_ref');
  if ((graph.duplicateEdges || []).length > 0) reasons.push('graph_duplicate_edge');
  if (!Array.isArray(graph.nodes) || graph.nodes.length < 1 || graph.nodes.length > VALIDATION_NODES_MAX) reasons.push('validation_graph_node_count_invalid');
  if (plan.observationState === 'observed' && (nodeResults.length < 1 || nodeResults.length !== graph.nodes.length)) reasons.push('profile_execution_observed_node_results_required');
  if (plan.observationState === 'not_exercised' && nodeResults.length > 0) reasons.push('not_exercised_plan_cannot_include_node_results');
  if (!FINALIZER_MODES.has(execution.finalizerMode)) reasons.push('profile_execution_finalizer_must_be_aggregate_only');
  if (execution.downstreamRespawnAllowed === true) reasons.push('profile_execution_downstream_respawn_forbidden');
  if (execution.failedNodeRef) reasons.push('profile_execution_failed_node_present');
  if (execution.requiredSkippedNodeRef) reasons.push('profile_execution_required_skipped_node_present');
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
    if (plan.observationState === 'observed' && node.executionState === 'executed' && node.executionCountObserved !== true) reasons.push('execution_count_observation_required');
    if (Number(node.executionCount || 0) > 1) reasons.push('profile_execution_node_executed_more_than_once');
    if (node.executionState === 'executed' && Number(node.executionCount) !== 1) reasons.push('executed_node_execution_count_must_be_one');
    if (node.executionState === 'reused' && Number(node.executionCount) !== 0) reasons.push('reused_node_execution_count_must_be_zero');
    if (node.required === true && node.status === 'skipped') reasons.push('profile_execution_required_skipped_node_present');
    if (node.executionState === 'reused') {
      if (!node.sourceRunRef) reasons.push('reused_node_source_run_ref_required');
      if (!/^sha256:[a-f0-9]{64}$/.test(String(node.sourceResultDigest || ''))) reasons.push('reused_node_source_result_digest_required');
      else if (node.sourceResultDigest !== node.resultDigest) reasons.push('reused_node_source_result_digest_mismatch');
      if (!/^[a-f0-9]{40}$/.test(String(node.sourceHeadSha || ''))) reasons.push('reused_node_source_head_sha_required');
      if (!/^sha256:[a-f0-9]{64}$/.test(String(node.cacheKeyDigest || ''))) reasons.push('reused_node_cache_key_digest_required');
      else if (reuse.cacheKeyDigest && node.cacheKeyDigest !== reuse.cacheKeyDigest) reasons.push('reused_node_cache_key_digest_mismatch');
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
  if (plan.observationState === 'observed' && reuse.cacheKeyHasPlaceholder === true) reasons.push('validation_reuse_cache_key_placeholder');
  if (plan.observationState === 'observed' && reuse.reuseDecision !== 'miss' && !/^sha256:[a-f0-9]{64}$/.test(String(reuse.cacheKeyDigest || ''))) reasons.push('validation_reuse_cache_key_digest_invalid');
  for (const [fieldName, field] of Object.entries(reuse.cacheKeyFields || {})) {
    if (!FIELD_STATES.has(field?.state)) reasons.push('validation_reuse_cache_key_field_state_invalid');
    if (plan.observationState === 'observed' && field?.state === 'invalid') reasons.push('validation_reuse_cache_key_field_missing_or_invalid');
    if (plan.observationState === 'observed' && field?.state === 'missing' && REQUIRED_CACHE_FIELDS.has(fieldName)) reasons.push('validation_reuse_cache_key_field_missing_or_invalid');
    if (fieldName === 'runnerImageDigest' && field?.state === 'missing' && reuse.reuseDecision !== 'miss') reasons.push('runner_image_missing_prevents_reuse');
  }
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
