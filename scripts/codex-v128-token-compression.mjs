#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import { buildV128OrderedUpstreamResultSetDigest } from './codex-v128-aggregate-finalizer.mjs';

export const V128_SAFE_SUMMARY_STORED_BYTES_SOFT_MAX = 6144;
export const V128_SAFE_SUMMARY_ROUTINE_SURFACE_BYTES_MAX = 2560;
export const V128_ORCHESTRATION_CAPSULE_BYTES_SOFT_MAX = 60000;

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function canonicalBytes(value) {
  return Buffer.byteLength(canonicalJson(value), 'utf8');
}

export function prettyBytes(value) {
  return Buffer.byteLength(JSON.stringify(value, null, 2), 'utf8');
}

export function digestValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function compactStatus(value = {}) {
  if (!value || typeof value !== 'object') return { status: 'missing' };
  return { status: value.status || 'missing' };
}

function compactReasonSummary(value = {}) {
  const summary = value.summary || value.reasonSummary || value || {};
  const blockingReasons = Array.isArray(summary.blockingReasons) ? summary.blockingReasons : [];
  return {
    status: value.status || summary.status || 'missing',
    blockingCount: blockingReasons.length,
    blockingReasonCodes: blockingReasons.slice(0, 4).map((item) => item.reasonCode || item.primaryClass || 'unknown'),
    safeSummaryOnly: true,
  };
}

function compactReadSurface(value = {}) {
  return {
    status: value.status || 'missing',
    surfaceCanonicalBytes: Number(value.surfaceCanonicalBytes || 0),
    managedSafeArtifactRead: Number(value.managedSafeArtifactRead || 0),
    coldArtifactRead: Number(value.coldArtifactRead || 0),
    projectionIntegrityStatus: value.projectionIntegrityStatus || 'unknown',
    projectionPayloadDigest: value.projectionPayloadDigest || null,
    safeSummaryOnly: true,
  };
}

function compactManagedContext(value = {}) {
  return {
    status: value.status || 'missing',
    managedContextEnvelopeBytes: Number(value.managedContextEnvelopeBytes || value.managedContextBytes || 0),
    managedContextMeasurementSource: value.managedContextMeasurementSource || 'not_observed',
    activeInstructionSourceSetDigest: value.activeInstructionSourceSetDigest || null,
    residentContextDigest: value.residentContextDigest || null,
    residentContextBytes: Number(value.residentContextBytes || 0),
    deltaPacketDigest: value.deltaPacketDigest || null,
    deltaContextBytes: Number(value.deltaContextBytes || 0),
    fullContextResendCount: Number(value.fullContextResendCount || 0),
    compiledActiveInstructionBytes: Number(value.compiledActiveInstructionBytes || value.compiledContextBytes || 0),
    compiledContextDigest: value.compiledContextDigest || null,
    routineColdArtifactRead: Number(value.routineColdArtifactRead || 0),
    legacyRead: Number(value.legacyRead || 0),
    foreignProfileRead: Number(value.foreignProfileRead || 0),
    reviewerFanout: Number(value.reviewerFanout || 0),
    routineSelectedSkill: Number(value.routineSelectedSkill || 0),
    repeatedSafetyText: Number(value.repeatedSafetyText || 0),
    missingBindingCount: Array.isArray(value.missingBindingIds) ? value.missingBindingIds.length : 0,
    safeSummaryOnly: true,
  };
}

function compactValidationPlan(plan = {}, status = {}) {
  const execution = plan.profileExecution || {};
  const graph = plan.graph || {};
  const reuse = plan.validationReuseDecision || {};
  const requeue = plan.failureDirectedRequeue || {};
  const economy = plan.loopEconomy || {};
  return {
    status: status.status || 'missing',
    observationState: status.observationState || plan.observationState || 'unknown',
    nodeCount: Array.isArray(graph.nodes) ? graph.nodes.length : 0,
    runWideInvocationCount: Number(execution.runWideInvocationCount || 0),
    runWideDuplicateExecutionCount: Number(execution.runWideDuplicateExecutionCount || 0),
    runWideInvocationLedgerStatus: execution.runWideInvocationLedgerStatus || 'unknown',
    reuseDecision: reuse.reuseDecision || 'unknown',
    unaffectedNodeRerunCount: Number(requeue.unaffectedNodeRerunCount || 0),
    loopBudgetState: economy.budgetState || 'unknown',
    managedInputBytesPerAcceptedChange: economy.managedInputBytesPerAcceptedChange ?? null,
    fullContextResendCount: Number(economy.fullContextResendCount || 0),
    deltaContextBytes: Number(economy.deltaContextBytes || 0),
    typedResultsDigest: plan.typedResults ? digestValue(plan.typedResults) : null,
    safeSummaryOnly: true,
  };
}

function compactTrustClosure(trustClosure = {}, trustStatus = {}) {
  const roleClosures = trustClosure.roleClosures || {};
  const top = roleClosures.top_level || {};
  return {
    status: trustStatus.status || trustClosure.status || 'missing',
    trustClosureDigest: trustClosure.trustClosureDigest || null,
    closureFileCount: Number(trustClosure.closureFileCount || 0),
    roleClosureCount: Object.keys(roleClosures).length,
    unresolvedRelativeImportCount: Number(top.unresolvedRelativeImportCount || 0),
    unsupportedDynamicImportCount: Number(top.unsupportedDynamicImportCount || 0),
    safeSummaryOnly: true,
  };
}

function finalizeCompression(summaryBase) {
  let summary = {
    ...summaryBase,
    tokenCompression: {
      status: 'fail',
      storedSafeSummaryBytes: 0,
      storedSafeSummaryBytesMax: V128_SAFE_SUMMARY_STORED_BYTES_SOFT_MAX,
      routineReadSurfaceBytes: 0,
      routineReadSurfaceBytesMax: V128_SAFE_SUMMARY_ROUTINE_SURFACE_BYTES_MAX,
      routineColdArtifactRead: 0,
      legacyRead: 0,
      foreignProfileRead: 0,
      reviewerFanout: 0,
      routineSelectedSkill: 0,
      repeatedSafetyText: 0,
      safeSummaryOnly: true,
    },
  };
  for (let i = 0; i < 8; i += 1) {
    const routineSurface = {
      routineDecisionProjection: summary.routineDecisionProjection,
      compactIntegrityStatus: summary.compactIntegrityStatus,
      finalDecisionPointer: summary.finalDecisionPointer,
      sameHead: summary.sameHead,
      blockerState: summary.blockerState,
      nextActionCode: summary.nextActionCode,
      coldEvidencePointers: summary.coldEvidencePointers,
    };
    const tokenCompression = {
      ...summary.tokenCompression,
      storedSafeSummaryBytes: prettyBytes(summary),
      routineReadSurfaceBytes: canonicalBytes(routineSurface),
      compiledActiveInstructionBytes: Number(summary.compactDiagnostics?.managedContext?.compiledActiveInstructionBytes || 0),
      managedContextEnvelopeBytes: Number(summary.compactDiagnostics?.managedContext?.managedContextEnvelopeBytes || 0),
    };
    tokenCompression.status = tokenCompression.storedSafeSummaryBytes <= tokenCompression.storedSafeSummaryBytesMax
      && tokenCompression.routineReadSurfaceBytes <= tokenCompression.routineReadSurfaceBytesMax
      && tokenCompression.routineColdArtifactRead === 0
      && tokenCompression.legacyRead === 0
      && tokenCompression.foreignProfileRead === 0
      && tokenCompression.reviewerFanout === 0
      && tokenCompression.routineSelectedSkill <= 1
      && tokenCompression.repeatedSafetyText === 0
      ? 'pass'
      : 'fail';
    const next = { ...summary, tokenCompression };
    if (next.tokenCompression.storedSafeSummaryBytes === summary.tokenCompression.storedSafeSummaryBytes
      && next.tokenCompression.routineReadSurfaceBytes === summary.tokenCompression.routineReadSurfaceBytes
      && next.tokenCompression.status === summary.tokenCompression.status) {
      return next;
    }
    summary = next;
  }
  return summary;
}

export function buildV128CompactQualityGateSafeSummary(input = {}) {
  const report = input.report || {};
  const head = input.head || report.head || report.decisionCapsule?.headSha || 'unknown';
  const finalDecision = input.finalDecision || report.finalDecision || {};
  const routineDecisionProjection = input.routineDecisionProjection || report.routineDecisionProjection || null;
  const reasonSummaryStatus = input.reasonSummaryStatus || report.reasonSummaryStatus || {};
  const v128ValidationExecutionPlan = input.v128ValidationExecutionPlan || report.v128ValidationExecutionPlan || {};
  const v128ValidationExecutionPlanStatus = input.v128ValidationExecutionPlanStatus || report.v128ValidationExecutionPlanStatus || {};
  const v128TrustClosure = input.v128TrustClosure || report.v128TrustClosure || {};
  const v128TrustClosureStatus = input.v128TrustClosureStatus || report.v128TrustClosureStatus || {};
  const orchestrationCapsule = input.orchestrationCapsule || report.orchestrationCapsule || null;
  const workerProofCapsule = input.workerProofCapsule || report.workerProofCapsule || null;
  const ownerDecisionBrief = input.ownerDecisionBrief || report.ownerDecisionBrief || null;
  const providerSnapshot = input.providerSnapshot || report.v128ProviderSnapshotEvidence || {};
  const standingAutonomy = input.standingAutonomyPolicy || report.v128StandingAutonomyPolicy || {};
  const nextActionCode = routineDecisionProjection?.automationDisposition
    || standingAutonomy.automationDisposition
    || 'auto_wait';
  const summaryBase = {
    marker: input.marker || 'CODEX_QUALITY_HARNESS_FILE v1.2.8',
    artifactName: 'codex-quality-gate-safe-summary.json',
    summaryKind: 'v128_token_minimal_safe_summary',
    loadBearing: true,
    status: report.status || 'unknown',
    qualityScore: report.qualityScore ?? report.qualityScoreStatus?.score ?? null,
    nextActionCode,
    sameHead: {
      status: providerSnapshot.status || report.decisionEvidenceEnvelopeSameHeadInternalStatus?.status || 'unknown',
      sameHead: providerSnapshot.sameHead === true || report.evidenceCapsule?.fresh === true,
      remoteGate: providerSnapshot.sameHeadRequiredChecksPass === true ? 'pass' : 'unknown',
      safeSummaryOnly: true,
    },
    routineDecisionProjection,
    compactIntegrityStatus: {
      qualityScoreStatus: compactStatus(report.qualityScoreStatus),
      finalDecisionStatus: compactStatus(report.finalDecisionStatus),
      reasonSummaryStatus: compactReasonSummary(reasonSummaryStatus),
      v127SelfTestStatus: compactStatus(report.v127SelfTestStatus),
      v128SelfTestStatus: compactStatus(report.v128SelfTestStatus),
      safeArtifactValidation: compactStatus(report.safeArtifactValidation),
      safeSummaryOnly: true,
    },
    compactDiagnostics: {
      managedContext: compactManagedContext(input.v128ManagedContextEmitter || report.v128ManagedContextEmitter || {}),
      validationPlan: compactValidationPlan(v128ValidationExecutionPlan, v128ValidationExecutionPlanStatus),
      trustClosure: compactTrustClosure(v128TrustClosure, v128TrustClosureStatus),
      safeSummaryOnly: true,
    },
    finalDecisionPointer: {
      artifactName: 'codex-final-decision.safe.json',
      digest: finalDecision ? digestValue(finalDecision) : null,
      safeNextAction: finalDecision.safeNextAction || report.decisionCapsule?.safeNextAction || null,
      terminalAction: finalDecision.terminalAction || null,
      mergeAllowed: finalDecision.mergeAllowed === true,
      safeSummaryOnly: true,
    },
    blockerState: {
      blockingCount: Array.isArray(reasonSummaryStatus?.summary?.blockingReasons) ? reasonSummaryStatus.summary.blockingReasons.length : 0,
      awaitingCount: Array.isArray(reasonSummaryStatus?.summary?.manualReasons) ? reasonSummaryStatus.summary.manualReasons.length : 0,
      safeSummaryOnly: true,
    },
    coldEvidencePointers: {
      status: orchestrationCapsule && workerProofCapsule && ownerDecisionBrief ? 'present' : 'partial',
      pointerSetDigest: digestValue([
        ['codex-orchestration-capsule.safe.json', Boolean(orchestrationCapsule)],
        ['codex-worker-proof.safe.json', Boolean(workerProofCapsule)],
        ['codex-owner-decision-brief.safe.json', Boolean(ownerDecisionBrief)],
        ['codex-decision-capsule.safe.json', true],
        ['codex-evidence-capsule.safe.json', Boolean(report.evidenceCapsule)],
      ]),
      pointerCount: 5,
      safeSummaryOnly: true,
    },
    failureCount: Array.isArray(report.failures) ? report.failures.length : 0,
    warningCount: Array.isArray(report.warnings) ? report.warnings.length : 0,
    rawLogsRead: false,
    eightSessionUsed: false,
    safeSummaryOnly: true,
  };
  return finalizeCompression(summaryBase);
}

function compactSourceClosure(closure = {}) {
  return {
    seedSourceFileCount: Number(closure.seedSourceFileCount || 0),
    sourceFileCount: Array.isArray(closure.sourceFiles) ? closure.sourceFiles.length : Number(closure.sourceFileCount || 0),
    relativeImportEdgeCount: Number(closure.relativeImportEdgeCount || 0),
    transitiveRelativeImportCount: Number(closure.transitiveRelativeImportCount || 0),
    declaredImportScanStatus: closure.declaredImportScanStatus || 'unknown',
    undeclaredRelativeImportCount: Number(closure.undeclaredRelativeImportCount || 0),
    unresolvedRelativeImportCount: Number(closure.unresolvedRelativeImportCount || 0),
    unsupportedDynamicImportCount: Number(closure.unsupportedDynamicImportCount || 0),
    sourceClosureTruncated: closure.sourceClosureTruncated === true,
    sourceClosureDigest: closure.sourceClosureDigest || null,
  };
}

function compactNodeSourceClosures(closures = {}) {
  return Object.fromEntries(Object.entries(closures || {}).map(([nodeRef, closure = {}]) => [
    nodeRef,
    {
      nodeSourceClosureDigest: closure.nodeSourceClosureDigest || null,
    },
  ]));
}

function compactTypedResult(nodeRef, payload = {}) {
  if (nodeRef === 'projection_reader') {
    return {
      schemaVersion: payload.schemaVersion || '1.2.8',
      nodeRef,
      status: payload.status || 'missing',
      surfaceCanonicalBytes: Number(payload.surfaceCanonicalBytes || 0),
      managedSafeArtifactRead: Number(payload.managedSafeArtifactRead || 0),
      coldArtifactRead: Number(payload.coldArtifactRead || 0),
      projectionPayloadDigest: payload.projectionPayloadDigest || payload.routineDecisionProjection?.sourceBinding?.projectionPayloadDigest || null,
      safeSummaryOnly: true,
    };
  }
  if (nodeRef === 'managed_context_emitter') {
    return {
      schemaVersion: payload.schemaVersion || '1.2.8',
      nodeRef,
      status: payload.status || 'missing',
      managedContextBytes: Number(payload.managedContextBytes || 0),
      compiledContextBytes: Number(payload.compiledContextBytes || 0),
      activeInstructionSourceSetDigest: payload.activeInstructionSourceSetDigest || null,
      compiledContextDigest: payload.compiledContextDigest || null,
      routineColdArtifactRead: Number(payload.routineColdArtifactRead || 0),
      legacyRead: Number(payload.legacyRead || 0),
      foreignProfileRead: Number(payload.foreignProfileRead || 0),
      reviewerFanout: Number(payload.reviewerFanout || 0),
      safeSummaryOnly: true,
    };
  }
  if (nodeRef === 'state_matrix_executor') {
    return {
      schemaVersion: payload.schemaVersion || '1.2.8',
      nodeRef,
      status: payload.status || 'missing',
      coverage: payload.coverage || 'unknown',
      totalCells: Number(payload.totalCells || 0),
      transitionCells: Number(payload.transitionCells || 0),
      hardInvalidCells: Number(payload.hardInvalidCells || 0),
      unresolvedCells: Number(payload.unresolvedCells || 0),
      stateMatrixContentDigest: payload.stateMatrixContentDigest || null,
      safeSummaryOnly: true,
    };
  }
  return {
    nodeRef,
    status: payload.status || 'missing',
    safeSummaryOnly: true,
  };
}

function compactNodeInputDigest(nodeRef, payload = {}) {
  if (nodeRef === 'projection_reader') {
    return payload.projectionPayloadDigest || digestValue(payload);
  }
  if (nodeRef === 'managed_context_emitter') {
    return payload.activeInstructionSourceSetDigest || digestValue(payload);
  }
  if (nodeRef === 'state_matrix_executor') {
    return payload.stateMatrixContentDigest || digestValue(payload);
  }
  if (nodeRef === 'aggregate_finalizer') {
    return payload.orderedUpstreamResultSetDigest || digestValue(payload.upstreamResultDigests || []);
  }
  return digestValue(payload);
}

export function validateV128CompactValidationPlanExact(plan = {}) {
  const typedResults = plan.typedResults && typeof plan.typedResults === 'object' ? plan.typedResults : {};
  const nodeResults = Array.isArray(plan.profileExecution?.nodeResults) ? plan.profileExecution.nodeResults : [];
  const ledger = Array.isArray(plan.profileExecution?.runWideInvocationLedger) ? plan.profileExecution.runWideInvocationLedger : [];
  const reasons = [];
  for (const node of nodeResults) {
    const payload = typedResults[node.nodeRef];
    if (!payload) {
      reasons.push(`compact_typed_result_missing_${node.nodeRef || 'unknown'}`);
      continue;
    }
    const resultDigest = digestValue(payload);
    if (node.resultDigest !== resultDigest) reasons.push(`compact_result_digest_mismatch_${node.nodeRef}`);
    if (node.nodeInputDigest !== compactNodeInputDigest(node.nodeRef, payload)) reasons.push(`compact_node_input_digest_mismatch_${node.nodeRef}`);
  }
  for (const entry of ledger) {
    const payload = typedResults[entry.nodeRef];
    if (payload && entry.resultDigest !== digestValue(payload)) reasons.push(`compact_ledger_result_digest_mismatch_${entry.nodeRef}`);
  }
  const aggregate = typedResults.aggregate_finalizer;
  if (aggregate) {
    const expectedOrdered = buildV128OrderedUpstreamResultSetDigest(aggregate.upstreamResultDigests || []);
    if (aggregate.orderedUpstreamResultSetDigest !== expectedOrdered) reasons.push('compact_aggregate_ordered_digest_mismatch');
    const byRef = new Map(nodeResults.map((node) => [node.nodeRef, node.resultDigest]));
    const statusByRef = new Map(nodeResults.map((node) => [node.nodeRef, node.status]));
    for (const item of aggregate.upstreamResultDigests || []) {
      if (byRef.get(item.nodeRef) !== item.resultDigest) reasons.push(`compact_aggregate_upstream_digest_mismatch_${item.nodeRef}`);
      if (statusByRef.get(item.nodeRef) !== item.status) reasons.push(`compact_aggregate_upstream_status_mismatch_${item.nodeRef}`);
    }
  }
  return reasons.length ? { status: 'fail', reasonCodes: [...new Set(reasons)], safeSummaryOnly: true } : { status: 'pass', safeSummaryOnly: true };
}

export function compactV128ValidationExecutionPlanForStorage(plan = {}) {
  const compact = JSON.parse(JSON.stringify(plan || {}));
  compact.sourceClosure = compactSourceClosure(plan.sourceClosure || {});
  compact.nodeSourceClosures = compactNodeSourceClosures(plan.nodeSourceClosures || {});
  const reuse = plan.validationReuseDecision || {};
  compact.validationReuseDecision = {
    reuseDecision: reuse.reuseDecision || 'miss',
    cacheKeyHasPlaceholder: reuse.cacheKeyHasPlaceholder === true,
    sourceClosureReuseForbidden: reuse.sourceClosureReuseForbidden === true,
    cacheKeyDigest: reuse.reuseDecision === 'miss' ? null : (reuse.cacheKeyDigest || null),
    cacheKeyFieldsDigest: reuse.cacheKeyFields ? digestValue(reuse.cacheKeyFields) : null,
    nodeCacheKeyDigestsDigest: reuse.nodeCacheKeyDigests ? digestValue(reuse.nodeCacheKeyDigests) : null,
  };
  const taxonomy = plan.stableDiagnosticTaxonomy || {};
  compact.stableDiagnosticTaxonomy = {
    environmentDiagnosticExcludedFromDecisionDigest: taxonomy.environmentDiagnosticExcludedFromDecisionDigest === true,
    rawLogForbidden: taxonomy.rawLogForbidden === true,
    secretForbidden: taxonomy.secretForbidden === true,
    localAbsolutePathForbidden: taxonomy.localAbsolutePathForbidden === true,
    decisionInputManifestScanned: taxonomy.decisionInputManifestScanned === true,
    decisionInputManifestTaxonomyStatus: taxonomy.decisionInputManifestTaxonomyStatus || 'unknown',
    decisionInputManifestSanitizedDigest: taxonomy.decisionInputManifestSanitizedDigest || null,
    fieldSetDigest: Array.isArray(taxonomy.fields) ? digestValue(taxonomy.fields) : null,
  };
  const workspace = plan.workspaceIdentity || {};
  compact.workspaceIdentity = {
    repositoryKey: workspace.repositoryKey || null,
    remoteDigest: workspace.remoteDigest || null,
    worktreeIdentityDigest: workspace.worktreeIdentityDigest || null,
    canonicalityState: workspace.canonicalityState || 'unknown',
    observationState: workspace.observationState || 'unknown',
    rawWorkspacePathUploaded: workspace.rawWorkspacePathUploaded === true,
    observationDigest: workspace.observationDigest || null,
  };
  const phase = plan.phaseProgress || {};
  compact.phaseProgress = {
    status: phase.status || 'unknown',
    currentPhase: phase.currentPhase || null,
  };
  const requeue = plan.failureDirectedRequeue || {};
  compact.failureDirectedRequeue = {
    mode: requeue.mode || 'failure_directed_requeue',
    failedNodeRefs: Array.isArray(requeue.failedNodeRefs) ? requeue.failedNodeRefs.slice(0, 4) : [],
    allowedRequeueNodeRefs: Array.isArray(requeue.allowedRequeueNodeRefs) ? requeue.allowedRequeueNodeRefs.slice(0, 6) : [],
    actualRequeuedNodeRefs: Array.isArray(requeue.actualRequeuedNodeRefs) ? requeue.actualRequeuedNodeRefs.slice(0, 6) : [],
    unaffectedNodeRerunCount: Number(requeue.unaffectedNodeRerunCount || 0),
    currentAttemptDigest: requeue.currentAttemptDigest || null,
    lastAttemptDigest: requeue.lastAttemptDigest || null,
    noProgressStop: requeue.noProgressStop === true,
  };
  const economy = plan.loopEconomy || {};
  compact.loopEconomy = {
    observed: economy.observed === true,
    managedInputBytes: Number(economy.managedInputBytes || 0),
    modelInvocationCount: Number(economy.modelInvocationCount || 0),
    fullContextResendCount: Number(economy.fullContextResendCount || 0),
    deltaContextBytes: Number(economy.deltaContextBytes || 0),
    executedNodeCount: Number(economy.executedNodeCount || 0),
    reusedNodeCount: Number(economy.reusedNodeCount || 0),
    managedInputBytesPerAcceptedChange: economy.managedInputBytesPerAcceptedChange ?? null,
    budgetState: economy.budgetState || 'unknown',
  };
  const memory = plan.selectiveFailureMemory || {};
  compact.selectiveFailureMemory = {
    memoryDigest: memory.memoryDigest || null,
    failureClass: memory.failureClass || null,
    successfulPatternRef: memory.successfulPatternRef || null,
    storesRawLogs: memory.storesRawLogs === true,
    storesFullDiff: memory.storesFullDiff === true,
    storesConversation: memory.storesConversation === true,
  };
  const originalTypedResults = plan.typedResults && typeof plan.typedResults === 'object' ? plan.typedResults : {};
  const typedResults = {};
  const nodeResults = (compact.profileExecution?.nodeResults || []).map((node) => {
    const compactNode = {
      nodeRef: node.nodeRef,
      required: node.required !== false,
      executionState: node.executionState,
      executionCount: Number(node.executionCount || 0),
      executionCountObserved: node.executionCountObserved === true,
      status: node.status,
      stabilityClass: node.stabilityClass,
      typedResultRef: node.typedResultRef,
      resultDigest: node.resultDigest,
      nodeInputDigest: node.nodeInputDigest,
      resultSchemaVersion: node.resultSchemaVersion || '1.0.0',
    };
    if (node.skipReasonCode) compactNode.skipReasonCode = node.skipReasonCode;
    if (node.executionState === 'reused') {
      compactNode.sourceRunRef = node.sourceRunRef || null;
      compactNode.sourceResultDigest = node.sourceResultDigest || null;
      compactNode.sourceHeadSha = node.sourceHeadSha || null;
      compactNode.cacheKeyDigest = node.cacheKeyDigest || null;
    }
    return compactNode;
  });
  const ledger = (compact.profileExecution?.runWideInvocationLedger || []).map((entry) => ({ ...entry }));
  const nodeByRef = new Map(nodeResults.map((node) => [node.nodeRef, node]));
  for (const nodeRef of Object.keys(originalTypedResults)) {
    if (nodeRef === 'aggregate_finalizer') continue;
    typedResults[nodeRef] = compactTypedResult(nodeRef, originalTypedResults[nodeRef]);
    const digest = digestValue(typedResults[nodeRef]);
    if (nodeByRef.has(nodeRef)) nodeByRef.get(nodeRef).resultDigest = digest;
    for (const entry of ledger) {
      if (entry.nodeRef === nodeRef) entry.resultDigest = digest;
    }
  }
  const aggregateOriginal = originalTypedResults.aggregate_finalizer || {};
  const aggregateDependsOn = (compact.graph?.nodes || []).find((node) => node.nodeRef === 'aggregate_finalizer')?.dependsOn || [];
  const upstreamResultDigests = aggregateDependsOn.map((nodeRef) => ({
    nodeRef,
    status: nodeByRef.get(nodeRef)?.status || 'missing',
    resultDigest: nodeByRef.get(nodeRef)?.resultDigest || digestValue(typedResults[nodeRef] || null),
  }));
  typedResults.aggregate_finalizer = {
    schemaVersion: aggregateOriginal.schemaVersion || '1.2.8',
    nodeRef: 'aggregate_finalizer',
    status: aggregateOriginal.status || 'pass',
    upstreamNodeRefs: aggregateDependsOn,
    upstreamResultDigests,
    failedNodeRefs: Array.isArray(aggregateOriginal.failedNodeRefs) ? aggregateOriginal.failedNodeRefs : [],
    orderedUpstreamResultSetDigest: buildV128OrderedUpstreamResultSetDigest(upstreamResultDigests),
    safeSummaryOnly: true,
  };
  const aggregateDigest = digestValue(typedResults.aggregate_finalizer);
  if (nodeByRef.has('aggregate_finalizer')) nodeByRef.get('aggregate_finalizer').resultDigest = aggregateDigest;
  for (const entry of ledger) {
    if (entry.nodeRef === 'aggregate_finalizer') entry.resultDigest = aggregateDigest;
  }
  for (const node of nodeResults) {
    node.nodeInputDigest = compactNodeInputDigest(node.nodeRef, typedResults[node.nodeRef] || {});
  }
  if (compact.profileExecution) {
    compact.profileExecution.nodeResults = nodeResults;
    compact.profileExecution.runWideInvocationLedger = ledger;
  }
  compact.typedResults = typedResults;
  return compact;
}
