#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';

export const V128_SAFE_SUMMARY_STORED_BYTES_SOFT_MAX = 8192;
export const V128_SAFE_SUMMARY_ROUTINE_SURFACE_BYTES_MAX = 4096;
export const V128_ORCHESTRATION_CAPSULE_BYTES_SOFT_MAX = 65536;

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
  if (!value || typeof value !== 'object') return { status: 'missing', safeSummaryOnly: true };
  const output = { status: value.status || 'missing', safeSummaryOnly: true };
  if (Array.isArray(value.reasonCodes) && value.reasonCodes.length) output.reasonCodes = value.reasonCodes.slice(0, 4);
  if (typeof value.score === 'number') output.score = value.score;
  if (typeof value.caseCount === 'number') output.caseCount = value.caseCount;
  if (typeof value.failureCount === 'number') output.failureCount = value.failureCount;
  return output;
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
    managedContextBytes: Number(value.managedContextBytes || 0),
    managedContextBytesMax: Number(value.managedContextBytesMax || 4096),
    managedContextMeasurementSource: value.managedContextMeasurementSource || 'not_observed',
    activeInstructionSourceSetDigest: value.activeInstructionSourceSetDigest || null,
    compiledContextBytes: Number(value.compiledContextBytes || 0),
    compiledContextBytesMax: Number(value.compiledContextBytesMax || 4096),
    compiledContextDigest: value.compiledContextDigest || null,
    routineManagedSafeArtifactRead: Number(value.routineManagedSafeArtifactRead || 0),
    routineColdArtifactRead: Number(value.routineColdArtifactRead || 0),
    legacyRead: Number(value.legacyRead || 0),
    foreignProfileRead: Number(value.foreignProfileRead || 0),
    reviewerFanout: Number(value.reviewerFanout || 0),
    routineSelectedSkill: Number(value.routineSelectedSkill || 0),
    repeatedSafetyText: Number(value.repeatedSafetyText || 0),
    sourceFileCount: Array.isArray(value.sourceFiles) ? value.sourceFiles.length : Number(value.sourceFileCount || 0),
    llmSummaryUsed: value.instructionCapsule?.llmSummaryUsed === true,
    sourceActivationReady: value.sourceActivationReady === true,
    safeSummaryOnly: true,
  };
}

function compactValidationPlan(plan = {}, status = {}) {
  const execution = plan.profileExecution || {};
  const graph = plan.graph || {};
  const reuse = plan.validationReuseDecision || {};
  return {
    status: status.status || 'missing',
    observationState: status.observationState || plan.observationState || 'unknown',
    planDigest: execution.planDigest || status.planDigest || null,
    graphDigest: graph.graphDigest || null,
    nodeCount: Array.isArray(graph.nodes) ? graph.nodes.length : 0,
    runWideInvocationCount: Number(execution.runWideInvocationCount || 0),
    runWideDuplicateExecutionCount: Number(execution.runWideDuplicateExecutionCount || 0),
    runWideInvocationLedgerStatus: execution.runWideInvocationLedgerStatus || 'unknown',
    reuseDecision: reuse.reuseDecision || 'unknown',
    cacheKeyDigest: reuse.cacheKeyDigest || null,
    typedResultsDigest: plan.typedResults ? digestValue(plan.typedResults) : null,
    pointer: '#/codex-orchestration-capsule.safe.json/validationExecutionPlanAndReuse',
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
    executableInvocationCount: Number(top.executableInvocationCount || 0),
    verifierBundleDigest: trustClosure.trustDigests?.verifierBundleDigest || null,
    providerAdapterDigest: trustClosure.trustDigests?.providerAdapterDigest || null,
    canonicalizerDigest: trustClosure.trustDigests?.canonicalizerDigest || null,
    finalDecisionAuthorityDigest: trustClosure.trustDigests?.finalDecisionAuthorityDigest || null,
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
      routineProjectionReadSurface: summary.routineProjectionReadSurface,
      compactStatus: summary.compactStatus,
      finalDecisionPointer: summary.finalDecisionPointer,
      sameHead: summary.sameHead,
      nextActionCode: summary.nextActionCode,
    };
    const tokenCompression = {
      ...summary.tokenCompression,
      storedSafeSummaryBytes: prettyBytes(summary),
      routineReadSurfaceBytes: canonicalBytes(routineSurface),
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
  const projectionStatus = input.routineDecisionProjectionStatus || report.routineDecisionProjectionStatus || {};
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
    activeHarnessVersion: '1.2.7',
    activeSelfTestSuite: 'v127',
    candidateHarnessVersion: '1.2.8',
    candidateActivationState: 'source_shadow_candidate',
    sourceActivationReady: false,
    targetRolloutReady: false,
    head,
    mergeReady: report.mergeReady === true,
    technicalChecksReady: report.technicalChecksReady === true || report.mergeReady === true,
    ownerMergeAuthorized: finalDecision.mergeAllowed === true,
    nextActionCode,
    sameHead: {
      status: providerSnapshot.status || report.decisionEvidenceEnvelopeSameHeadInternalStatus?.status || 'unknown',
      sameHead: providerSnapshot.sameHead === true || report.evidenceCapsule?.fresh === true,
      remoteGate: providerSnapshot.sameHeadRequiredChecksPass === true ? 'pass' : 'unknown',
      safeSummaryOnly: true,
    },
    routineDecisionProjection,
    routineProjectionReadSurface: compactReadSurface(input.routineProjectionReadSurface || report.routineProjectionReadSurface || {}),
    compactStatus: {
      qualityScoreStatus: compactStatus(report.qualityScoreStatus),
      finalDecisionStatus: compactStatus(report.finalDecisionStatus),
      decisionCapsuleStatus: compactStatus(report.decisionCapsuleStatus),
      evidenceCapsuleStatus: compactStatus(report.evidenceCapsuleStatus),
      reasonSummaryStatus: compactReasonSummary(reasonSummaryStatus),
      v127SelfTestStatus: compactStatus(report.v127SelfTestStatus),
      v128SelfTestStatus: compactStatus(report.v128SelfTestStatus),
      routineDecisionProjectionStatus: compactStatus(projectionStatus),
      safeArtifactValidation: compactStatus(report.safeArtifactValidation),
      safeSummaryOnly: true,
    },
    v128ManagedContextEmitter: compactManagedContext(input.v128ManagedContextEmitter || report.v128ManagedContextEmitter || {}),
    v128ValidationExecutionPlan: compactValidationPlan(v128ValidationExecutionPlan, v128ValidationExecutionPlanStatus),
    v128TrustClosure: compactTrustClosure(v128TrustClosure, v128TrustClosureStatus),
    v128StandingAutonomyPolicy: {
      status: report.v128StandingAutonomyPolicyStatus?.status || 'missing',
      automationDisposition: standingAutonomy.automationDisposition || null,
      policyAuthorizationState: standingAutonomy.policyAuthorizationState || null,
      humanPerPrDecisionRequired: standingAutonomy.humanPerPrDecisionRequired === true,
      automatedMergeExecutionAllowed: standingAutonomy.automatedMergeExecutionAllowed === true,
      policyDigest: standingAutonomy.policyDigest || null,
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

export function compactV128ValidationExecutionPlanForStorage(plan = {}) {
  const compact = JSON.parse(JSON.stringify(plan || {}));
  compact.sourceClosure = compactSourceClosure(plan.sourceClosure || {});
  compact.nodeSourceClosures = compactNodeSourceClosures(plan.nodeSourceClosures || {});
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
  typedResults.aggregate_finalizer = {
    schemaVersion: aggregateOriginal.schemaVersion || '1.2.8',
    nodeRef: 'aggregate_finalizer',
    status: aggregateOriginal.status || 'pass',
    upstreamNodeRefs: aggregateDependsOn,
    upstreamResultDigests: aggregateDependsOn.map((nodeRef) => ({
      nodeRef,
      resultDigest: nodeByRef.get(nodeRef)?.resultDigest || digestValue(typedResults[nodeRef] || null),
    })),
    failedNodeRefs: Array.isArray(aggregateOriginal.failedNodeRefs) ? aggregateOriginal.failedNodeRefs : [],
    orderedUpstreamResultSetDigest: aggregateOriginal.orderedUpstreamResultSetDigest || null,
    safeSummaryOnly: true,
  };
  const aggregateDigest = digestValue(typedResults.aggregate_finalizer);
  if (nodeByRef.has('aggregate_finalizer')) nodeByRef.get('aggregate_finalizer').resultDigest = aggregateDigest;
  for (const entry of ledger) {
    if (entry.nodeRef === 'aggregate_finalizer') entry.resultDigest = aggregateDigest;
  }
  if (compact.profileExecution) {
    compact.profileExecution.nodeResults = nodeResults;
    compact.profileExecution.runWideInvocationLedger = ledger;
  }
  compact.typedResults = typedResults;
  return compact;
}
