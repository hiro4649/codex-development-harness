#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const CANARY_NODE_REFS = [
  'projection_reader',
  'managed_context_emitter',
  'state_matrix_executor',
  'aggregate_finalizer',
];
const PARTIAL_EXECUTED_NODE_REFS = ['aggregate_finalizer', 'projection_reader'];

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

function safeDigest(value, fallbackSeed) {
  return isSha256Digest(value) ? value : digestValue(fallbackSeed);
}

function compactNodeRefs(nodeRefs = []) {
  return [...new Set(nodeRefs.map(String))].sort();
}

function runnerEnvironment() {
  const details = {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    githubActions: process.env.GITHUB_ACTIONS === 'true',
    runnerOs: process.env.RUNNER_OS || null,
    imageOS: process.env.ImageOS || null,
    imageVersion: process.env.ImageVersion || null,
  };
  const providerImageFullyObserved = Boolean(details.imageOS && details.imageVersion);
  return {
    details,
    providerImageFullyObserved,
    proofScope: providerImageFullyObserved
      ? 'provider_image_serialized_cache'
      : 'same_environment_serialized_cache',
    runnerEnvironmentDigest: digestValue(details),
  };
}

function cacheRecordPath(cacheDir, nodeRef) {
  return path.join(cacheDir, `${nodeRef.replace(/[^a-z0-9_-]/gi, '_')}.json`);
}

function buildRecord(binding, nodeRef, nodeInputDigest, nodeSourceClosureDigest, typedResultDigest, runnerEnvironmentDigest) {
  const recordCore = {
    repositoryId: binding.repositoryId,
    sourceHead: binding.sourceHead,
    baseHead: binding.baseHead,
    testedCommit: binding.testedCommit,
    testedTreeKind: binding.testedTreeKind,
    validationContextDigest: binding.validationContextDigest,
    nodeRef,
    nodeInputDigest,
    nodeSourceClosureDigest,
    typedResultSchema: 'v128.node.typedResult.v1',
    typedResultDigest,
    runnerEnvironmentDigest,
  };
  return {
    ...recordCore,
    cacheRecordDigest: digestValue(recordCore),
  };
}

function recordMatches(record, expected) {
  if (!record || typeof record !== 'object') return false;
  for (const key of [
    'repositoryId',
    'sourceHead',
    'baseHead',
    'testedCommit',
    'testedTreeKind',
    'validationContextDigest',
    'nodeRef',
    'nodeInputDigest',
    'nodeSourceClosureDigest',
    'typedResultSchema',
    'typedResultDigest',
    'runnerEnvironmentDigest',
  ]) {
    if (record[key] !== expected[key]) return false;
  }
  const { cacheRecordDigest, ...recordCore } = record;
  return cacheRecordDigest === digestValue(recordCore);
}

function readRecord(cacheDir, expected) {
  const filePath = cacheRecordPath(cacheDir, expected.nodeRef);
  if (!fs.existsSync(filePath)) return { status: 'miss', missReason: 'missing_record' };
  let record;
  try {
    record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return { status: 'miss', missReason: 'unreadable_record' };
  }
  if (!recordMatches(record, expected)) return { status: 'miss', missReason: 'record_binding_mismatch' };
  return {
    status: 'hit',
    recordDigest: record.cacheRecordDigest,
  };
}

function writeRecord(cacheDir, record) {
  fs.writeFileSync(cacheRecordPath(cacheDir, record.nodeRef), `${canonicalJson(record)}\n`, 'utf8');
  return record.cacheRecordDigest;
}

function prepareNodeFacts(input = {}, nodeRefs = CANARY_NODE_REFS) {
  const typedResultDigests = input.typedResultDigests || {};
  const nodeInputDigests = input.nodeInputDigests || {};
  const nodeSourceClosureDigests = input.nodeSourceClosureDigests || {};
  return Object.fromEntries(nodeRefs.map((nodeRef) => [nodeRef, {
    nodeInputDigest: safeDigest(nodeInputDigests[nodeRef], { nodeRef, fallback: 'node_input' }),
    nodeSourceClosureDigest: safeDigest(nodeSourceClosureDigests[nodeRef], { nodeRef, fallback: 'node_source_closure' }),
    typedResultDigest: safeDigest(typedResultDigests[nodeRef], { nodeRef, fallback: 'typed_result' }),
  }]));
}

function withPartialInvalidation(nodeFacts) {
  const next = Object.fromEntries(Object.entries(nodeFacts).map(([nodeRef, facts]) => [nodeRef, { ...facts }]));
  next.projection_reader.nodeInputDigest = digestValue({
    previous: next.projection_reader.nodeInputDigest,
    invalidation: 'projection_reader_input_changed',
  });
  next.aggregate_finalizer.nodeInputDigest = digestValue({
    previous: next.aggregate_finalizer.nodeInputDigest,
    upstream: next.projection_reader.nodeInputDigest,
  });
  return next;
}

function executeCacheRun({ runKind, sequence, cacheDir, binding, nodeRefs, nodeFacts, runnerEnvironmentDigest, forceExecuteNodeRefs = [] }) {
  const started = performance.now();
  const executionId = digestValue({ runKind, sequence, binding, nodeFactsDigest: digestValue(nodeFacts) });
  const forceExecute = new Set(forceExecuteNodeRefs);
  const executedNodeRefs = [];
  const reusedNodeRefs = [];
  const invocationLedger = [];
  const readRecordDigests = [];
  const writtenRecordDigests = [];
  let readCount = 0;
  let missCount = 0;
  for (const nodeRef of nodeRefs) {
    const facts = nodeFacts[nodeRef];
    const expectedRecord = buildRecord(
      binding,
      nodeRef,
      facts.nodeInputDigest,
      facts.nodeSourceClosureDigest,
      facts.typedResultDigest,
      runnerEnvironmentDigest,
    );
    const read = forceExecute.has(nodeRef)
      ? { status: 'miss', missReason: 'forced_canary_execution' }
      : readRecord(cacheDir, expectedRecord);
    readCount += 1;
    if (read.status === 'hit') {
      reusedNodeRefs.push(nodeRef);
      readRecordDigests.push(read.recordDigest);
      continue;
    }
    missCount += 1;
    executedNodeRefs.push(nodeRef);
    invocationLedger.push({
      nodeRef,
      executionId,
      commandDigest: digestValue({ nodeRef, runKind, typedResultDigest: facts.typedResultDigest }),
    });
    writtenRecordDigests.push(writeRecord(cacheDir, expectedRecord));
  }
  const durationMs = Math.max(0, Math.round((performance.now() - started) * 1000) / 1000);
  return {
    executionId,
    runKind,
    durationMs,
    reuseDecision: runKind === 'cold_miss' ? 'miss' : (missCount === 0 ? 'hit' : 'partial_hit'),
    executedNodeRefs: compactNodeRefs(executedNodeRefs),
    reusedNodeRefs: compactNodeRefs(reusedNodeRefs),
    executedEligibleNodeCount: executedNodeRefs.length,
    reusedEligibleNodeCount: reusedNodeRefs.length,
    reusedNodeCount: reusedNodeRefs.length,
    serializedCacheReadCount: readCount,
    serializedCacheWriteCount: writtenRecordDigests.length,
    commandSuppressionObserved: reusedNodeRefs.length > 0 && reusedNodeRefs.every((nodeRef) => !executedNodeRefs.includes(nodeRef)),
    invocationLedgerDigest: digestValue(invocationLedger),
    readRecordSetDigest: digestValue(readRecordDigests),
    writtenRecordSetDigest: digestValue(writtenRecordDigests),
  };
}

function bindingIsComplete(binding = {}) {
  return ['repositoryId', 'sourceHead', 'baseHead', 'testedCommit', 'testedTreeKind', 'validationContextDigest']
    .every((key) => String(binding[key] || '').trim() && !['unknown', 'not_available', 'null', 'undefined'].includes(String(binding[key]).trim()));
}

function summarizeCanary(input, result) {
  return {
    status: result.status,
    observationClass: result.observationClass,
    observed: result.observed,
    proofScope: result.proofScope,
    coldMissExecutedCommandCount: result.performance.coldMissExecutedCommandCount,
    realHitExecutedCommandCount: result.performance.realHitExecutedCommandCount,
    partialHitExecutedCommandCount: result.performance.partialHitExecutedCommandCount,
    suppressedCommandCount: result.performance.suppressedCommandCount,
    unaffectedNodeRerunCount: result.realPartialHit.unaffectedNodeRerunCount,
    cacheRecordReadbackDigest: result.cacheRecordReadbackDigest,
    canaryDigest: result.canaryDigest,
    canaryTransportDigest: result.canaryTransportDigest,
    safeSummaryOnly: true,
  };
}

export function runV128SerializedCacheCanary(input = {}) {
  const nodeRefs = compactNodeRefs(input.nodeRefs?.length ? input.nodeRefs : CANARY_NODE_REFS)
    .filter((nodeRef) => CANARY_NODE_REFS.includes(nodeRef));
  const binding = {
    repositoryId: input.repositoryId || 'github.com:hiro4649/codex-development-harness',
    sourceHead: input.sourceHead || 'unknown',
    baseHead: input.baseHead || input.sourceHead || 'unknown',
    testedCommit: input.testedCommit || input.sourceHead || 'unknown',
    testedTreeKind: input.testedTreeKind || 'branch_head',
    validationContextDigest: input.validationContextDigest || null,
  };
  const environment = runnerEnvironment();
  if (nodeRefs.length !== CANARY_NODE_REFS.length || bindingIsComplete(binding) !== true) {
    const partial = {
      status: 'partial_shadow_candidate',
      observationClass: 'serialized_cache_canary',
      observed: false,
      proofScope: environment.proofScope,
      safeSummaryOnly: true,
      canaryDigest: digestValue({ binding, nodeRefs, status: 'partial_shadow_candidate' }),
      canaryTransportDigest: digestValue({ binding, nodeRefs, transport: 'serialized_cache_unavailable' }),
    };
    return {
      ...partial,
      performance: {
        coldMissDurationMs: 0,
        realHitDurationMs: 0,
        partialHitDurationMs: 0,
        coldMissExecutedCommandCount: 0,
        realHitExecutedCommandCount: 0,
        partialHitExecutedCommandCount: 0,
        executedCommandCount: 0,
        suppressedCommandCount: 0,
      },
      coldMiss: { reuseDecision: 'miss', executedEligibleNodeCount: 0, reusedNodeCount: 0 },
      realHit: { reuseDecision: 'miss', executedEligibleNodeCount: 0, reusedEligibleNodeCount: 0 },
      realPartialHit: { reuseDecision: 'miss', executedNodeRefs: [], reusedNodeRefs: [], unaffectedNodeRerunCount: 0 },
      compactSummary: summarizeCanary(input, {
        ...partial,
        performance: {
          coldMissExecutedCommandCount: 0,
          realHitExecutedCommandCount: 0,
          partialHitExecutedCommandCount: 0,
          suppressedCommandCount: 0,
        },
        realPartialHit: { unaffectedNodeRerunCount: 0 },
        cacheRecordReadbackDigest: null,
      }),
    };
  }

  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v128-cache-canary-'));
  try {
    const nodeFacts = prepareNodeFacts(input, nodeRefs);
    const coldMiss = executeCacheRun({
      runKind: 'cold_miss',
      sequence: 1,
      cacheDir,
      binding,
      nodeRefs,
      nodeFacts,
      runnerEnvironmentDigest: environment.runnerEnvironmentDigest,
      forceExecuteNodeRefs: nodeRefs,
    });
    const realHit = executeCacheRun({
      runKind: 'real_hit',
      sequence: 2,
      cacheDir,
      binding,
      nodeRefs,
      nodeFacts,
      runnerEnvironmentDigest: environment.runnerEnvironmentDigest,
    });
    const partialFacts = withPartialInvalidation(nodeFacts);
    const realPartialHit = executeCacheRun({
      runKind: 'real_partial_hit',
      sequence: 3,
      cacheDir,
      binding,
      nodeRefs,
      nodeFacts: partialFacts,
      runnerEnvironmentDigest: environment.runnerEnvironmentDigest,
      forceExecuteNodeRefs: PARTIAL_EXECUTED_NODE_REFS,
    });
    realPartialHit.unaffectedNodeRerunCount = realPartialHit.executedNodeRefs
      .filter((nodeRef) => !PARTIAL_EXECUTED_NODE_REFS.includes(nodeRef)).length;
    const distinctExecutionIds = new Set([coldMiss.executionId, realHit.executionId, realPartialHit.executionId]).size === 3;
    const acceptance = {
      coldMissExecutesAll: coldMiss.executedEligibleNodeCount === nodeRefs.length && coldMiss.reusedNodeCount === 0,
      realHitExecutesZero: realHit.executedEligibleNodeCount === 0 && realHit.reusedEligibleNodeCount === nodeRefs.length,
      partialExecutesOnlyInvalidatedAndAggregate: canonicalJson(realPartialHit.executedNodeRefs) === canonicalJson(PARTIAL_EXECUTED_NODE_REFS),
      partialReusesUnaffected: canonicalJson(realPartialHit.reusedNodeRefs) === canonicalJson(['managed_context_emitter', 'state_matrix_executor']),
      unaffectedNodeRerunCountZero: realPartialHit.unaffectedNodeRerunCount === 0,
      commandSuppressionObserved: realHit.commandSuppressionObserved === true && realPartialHit.commandSuppressionObserved === true,
      distinctExecutionIds,
    };
    const performanceSummary = {
      coldMissDurationMs: coldMiss.durationMs,
      realHitDurationMs: realHit.durationMs,
      partialHitDurationMs: realPartialHit.durationMs,
      coldMissExecutedCommandCount: coldMiss.executedEligibleNodeCount,
      realHitExecutedCommandCount: realHit.executedEligibleNodeCount,
      partialHitExecutedCommandCount: realPartialHit.executedEligibleNodeCount,
      executedCommandCount: coldMiss.executedEligibleNodeCount + realHit.executedEligibleNodeCount + realPartialHit.executedEligibleNodeCount,
      suppressedCommandCount: realHit.reusedEligibleNodeCount + realPartialHit.reusedEligibleNodeCount,
      wallClockImprovementAdvisoryUntilSamples: 20,
    };
    const transportCore = {
      bindingDigest: digestValue(binding),
      runnerEnvironmentDigest: environment.runnerEnvironmentDigest,
      coldMiss: {
        executionId: coldMiss.executionId,
        writtenRecordSetDigest: coldMiss.writtenRecordSetDigest,
      },
      realHit: {
        executionId: realHit.executionId,
        readRecordSetDigest: realHit.readRecordSetDigest,
      },
      realPartialHit: {
        executionId: realPartialHit.executionId,
        readRecordSetDigest: realPartialHit.readRecordSetDigest,
        writtenRecordSetDigest: realPartialHit.writtenRecordSetDigest,
      },
    };
    const status = Object.values(acceptance).every(Boolean) ? 'pass' : 'partial_shadow_candidate';
    const resultCore = {
      status,
      observationClass: 'serialized_cache_canary',
      observed: status === 'pass',
      proofScope: environment.proofScope,
      cacheStoreKind: 'temporary_non_p0_os_cache',
      cacheStorePersistedInRepo: false,
      runnerEnvironmentDigest: environment.runnerEnvironmentDigest,
      providerImageFullyObserved: environment.providerImageFullyObserved,
      acceptance,
      coldMiss,
      realHit,
      realPartialHit,
      performance: performanceSummary,
      cacheRecordReadbackDigest: digestValue({
        coldMissWritten: coldMiss.writtenRecordSetDigest,
        realHitRead: realHit.readRecordSetDigest,
        realPartialHitRead: realPartialHit.readRecordSetDigest,
      }),
      canaryTransportDigest: digestValue(transportCore),
      safeSummaryOnly: true,
    };
    const result = {
      ...resultCore,
      canaryDigest: digestValue(resultCore),
    };
    return {
      ...result,
      compactSummary: summarizeCanary(input, result),
    };
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && process.argv[1].endsWith('codex-v128-serialized-cache-canary.mjs')) {
  process.stdout.write(`${canonicalJson(runV128SerializedCacheCanary({
    repositoryId: 'github.com:hiro4649/codex-development-harness',
    sourceHead: 'f'.repeat(40),
    baseHead: 'e'.repeat(40),
    testedCommit: 'f'.repeat(40),
    testedTreeKind: 'branch_head',
    validationContextDigest: digestValue({ cli: true }),
  }))}\n`);
}
