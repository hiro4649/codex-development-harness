#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { runV128ProjectionReaderAdapter } from './codex-v128-projection-reader-adapter.mjs';
import { runV128ManagedContextAdapter } from './codex-v128-managed-context-adapter.mjs';
import { runV128StateMatrixAdapter } from './codex-v128-state-matrix-adapter.mjs';
import { runV128AggregateFinalizerAdapter } from './codex-v128-aggregate-finalizer-adapter.mjs';
import { buildV128OrderedUpstreamResultSetDigest } from './codex-v128-aggregate-finalizer.mjs';
import { buildV128ProjectionSourceDigestBinding } from './codex-v128-integrity-lib.mjs';
import {
  getV128InvocationLedgerSnapshot,
  resetV128InvocationLedger,
} from './codex-v128-invocation-ledger.mjs';

const CANARY_NODE_REFS = [
  'projection_reader',
  'managed_context_emitter',
  'state_matrix_executor',
  'aggregate_finalizer',
];
const PARTIAL_EXECUTED_NODE_REFS = ['aggregate_finalizer', 'projection_reader'];
const ACTUAL_RESULT_SCHEMA = 'v128.node.typedResult.v1';
const ACTUAL_CACHE_RECORD_SCHEMA = 'v128.actual.validation.cache.record.v2';
const ACTUAL_CACHE_MAX_RECORDS = 256;
const ACTUAL_CACHE_MAX_BYTES = 8 * 1024 * 1024;

function canonicalJson(value) {
  if (value === undefined) return 'null';
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

function safePathSegment(value) {
  return String(value || 'unknown').replace(/[^a-z0-9_-]/gi, '_').slice(0, 96) || 'unknown';
}

function cacheRecordIdentityDigest(expected = {}) {
  return digestValue({
    cacheRecordPathSchema: ACTUAL_CACHE_RECORD_SCHEMA,
    repositoryId: expected.repositoryId,
    sourceHead: expected.sourceHead,
    baseHead: expected.baseHead,
    testedCommit: expected.testedCommit,
    testedTreeKind: expected.testedTreeKind,
    validationContextDigest: expected.validationContextDigest,
    nodeRef: expected.nodeRef,
    nodeInputDigest: expected.nodeInputDigest,
    nodeSourceClosureDigest: expected.nodeSourceClosureDigest,
    typedResultSchema: expected.typedResultSchema,
    runnerEnvironmentDigest: expected.runnerEnvironmentDigest,
  });
}

function cacheRecordPath(cacheDir, nodeRef, expected = null) {
  if (!expected) return path.join(cacheDir, `${safePathSegment(nodeRef)}.json`);
  const digest = cacheRecordIdentityDigest(expected).replace(/^sha256:/, '');
  return path.join(cacheDir, safePathSegment(nodeRef), `${digest}.json`);
}

function writeCanonicalJsonAtomically(filePath, value) {
  const payload = `${canonicalJson(value)}\n`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing === payload) return digestValue(value);
    return digestValue({ status: 'existing_record_content_mismatch', filePath: path.basename(filePath) });
  }
  const tempPath = path.join(
    path.dirname(filePath),
    `.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.json`,
  );
  fs.writeFileSync(tempPath, payload, 'utf8');
  fs.renameSync(tempPath, filePath);
  const readback = fs.readFileSync(filePath, 'utf8');
  if (readback !== payload) {
    throw new Error('codex_v128_cache_atomic_write_readback_mismatch');
  }
  return digestValue(value);
}

function listCacheJsonFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const pending = [rootDir];
  const files = [];
  while (pending.length) {
    const dir = pending.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.json')) {
        const stat = fs.statSync(fullPath);
        files.push({ filePath: fullPath, size: stat.size, mtimeMs: stat.mtimeMs });
      }
    }
  }
  return files;
}

function cleanupActualCacheDir(cacheDir, limits = {}) {
  const maxRecords = Number(limits.maxRecords || ACTUAL_CACHE_MAX_RECORDS);
  const maxBytes = Number(limits.maxBytes || ACTUAL_CACHE_MAX_BYTES);
  let files = listCacheJsonFiles(cacheDir);
  let totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  let deletedRecordCount = 0;
  files = files.sort((a, b) => a.mtimeMs - b.mtimeMs);
  while (files.length > maxRecords || totalBytes > maxBytes) {
    const victim = files.shift();
    if (!victim) break;
    fs.rmSync(victim.filePath, { force: true });
    totalBytes -= victim.size;
    deletedRecordCount += 1;
  }
  return {
    status: 'pass',
    maxRecords,
    maxBytes,
    retainedRecordCount: files.length,
    retainedBytes: Math.max(0, totalBytes),
    deletedRecordCount,
    safeSummaryOnly: true,
  };
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

function buildActualCacheRecord(binding, nodeRef, nodeInputDigest, nodeSourceClosureDigest, typedResultPayload, runnerEnvironmentDigest) {
  const safeTypedResultPayload = JSON.parse(canonicalJson(typedResultPayload));
  const typedResultDigest = digestValue(safeTypedResultPayload);
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
    typedResultSchema: ACTUAL_RESULT_SCHEMA,
    typedResultPayload: safeTypedResultPayload,
    typedResultDigest,
    runnerEnvironmentDigest,
  };
  return {
    ...recordCore,
    cacheRecordDigest: digestValue(recordCore),
  };
}

function expectedActualRecordBinding(binding, nodeRef, nodeInputDigest, nodeSourceClosureDigest, runnerEnvironmentDigest) {
  return {
    repositoryId: binding.repositoryId,
    sourceHead: binding.sourceHead,
    baseHead: binding.baseHead,
    testedCommit: binding.testedCommit,
    testedTreeKind: binding.testedTreeKind,
    validationContextDigest: binding.validationContextDigest,
    nodeRef,
    nodeInputDigest,
    nodeSourceClosureDigest,
    typedResultSchema: ACTUAL_RESULT_SCHEMA,
    runnerEnvironmentDigest,
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
  const filePath = cacheRecordPath(cacheDir, expected.nodeRef, expected);
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
  writeCanonicalJsonAtomically(cacheRecordPath(cacheDir, record.nodeRef, record), record);
  return record.cacheRecordDigest;
}

function readActualCacheRecord(cacheDir, expected) {
  const filePath = cacheRecordPath(cacheDir, expected.nodeRef, expected);
  if (!fs.existsSync(filePath)) return { status: 'miss', missReason: 'missing_record' };
  let record;
  try {
    record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return { status: 'miss', missReason: 'unreadable_record' };
  }
  for (const [key, value] of Object.entries(expected)) {
    if (record[key] !== value) return { status: 'miss', missReason: `record_${key}_mismatch` };
  }
  if (!record.typedResultPayload || typeof record.typedResultPayload !== 'object') {
    return { status: 'miss', missReason: 'typed_result_payload_missing' };
  }
  if (digestValue(record.typedResultPayload) !== record.typedResultDigest) {
    return { status: 'miss', missReason: 'typed_result_digest_mismatch' };
  }
  const { cacheRecordDigest, ...recordCore } = record;
  if (cacheRecordDigest !== digestValue(recordCore)) {
    return { status: 'miss', missReason: 'cache_record_digest_mismatch' };
  }
  return {
    status: 'hit',
    recordDigest: record.cacheRecordDigest,
    typedResultPayload: record.typedResultPayload,
    typedResultDigest: record.typedResultDigest,
  };
}

function writeActualCacheRecord(cacheDir, record) {
  writeCanonicalJsonAtomically(cacheRecordPath(cacheDir, record.nodeRef, record), record);
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

function nodeResultFromPayload(nodeRef, typedResultPayload, executionState, input = {}) {
  const resultDigest = digestValue(typedResultPayload);
  return {
    nodeRef,
    executionState,
    executionCount: executionState === 'reused' ? 0 : 1,
    executionCountSource: executionState === 'reused' ? 'serialized_cache_payload_restore' : 'process_wide_invocation_ledger',
    executionCountObserved: true,
    status: typedResultPayload?.status === 'pass' ? 'pass' : 'fail',
    stabilityClass: nodeRef === 'managed_context_emitter' ? 'cache_stable' : 'decision_stable',
    typedResultPayload,
    resultDigest,
    resultSchemaVersion: typedResultPayload?.schemaVersion || '1.0.0',
    sourceRunRef: input.sourceRunRef || null,
    sourceResultDigest: executionState === 'reused' ? resultDigest : null,
    sourceHeadSha: input.sourceHeadSha || null,
    cacheKeyDigest: input.cacheKeyDigest || null,
    nodeInputDigest: input.nodeInputDigest || null,
  };
}

function latestExecutedNodeResult(nodeRef, nodeInputDigest) {
  const snapshot = getV128InvocationLedgerSnapshot();
  const nodeResult = [...snapshot.nodeResults].reverse().find((node) => node.nodeRef === nodeRef);
  if (!nodeResult) return null;
  return {
    ...nodeResult,
    nodeInputDigest,
  };
}

function sourceRunRefFromRecord(binding, recordDigest, typedResultPayload = {}) {
  return {
    provider: 'v128_serialized_cache',
    runId: digestValue({ provider: 'v128_serialized_cache', sourceHead: binding.sourceHead }),
    artifactName: 'v128-serialized-cache-record',
    artifactDigest: recordDigest,
    sourceHeadSha: /^[a-f0-9]{40}$/.test(String(binding.sourceHead || '')) ? binding.sourceHead : '0'.repeat(40),
    testedCommitOid: /^[a-f0-9]{40}$/.test(String(binding.testedCommit || '')) ? binding.testedCommit : '0'.repeat(40),
    resultSchemaVersion: typedResultPayload?.schemaVersion || '1.0.0',
  };
}

function mutateProjectionForPartial(projection = {}) {
  const mutated = {
    ...projection,
    sourceBinding: undefined,
    canaryPartialInputDigest: digestValue({
      previous: projection?.sourceBinding?.projectionPayloadDigest || null,
      mutation: 'actual_cache_partial_projection_input',
    }),
  };
  return {
    ...mutated,
    sourceBinding: buildV128ProjectionSourceDigestBinding(mutated.headSha || 'f'.repeat(40), {
      projectionPayload: mutated,
    }),
  };
}

function defaultRoutineProjection(binding = {}) {
  const projection = {
    schemaVersion: '1.2.8',
    projectionKind: 'routine_decision_projection',
    authority: 'non_authoritative_projection',
    headSha: /^[a-f0-9]{40}$/.test(String(binding.sourceHead || '')) ? binding.sourceHead : 'f'.repeat(40),
    technicalChecksReady: true,
    ownerMergeAuthority: false,
    authorityBoundaryAction: 'final_decision_authority',
    automationDisposition: 'auto_wait',
    safeSummaryOnly: true,
  };
  return {
    ...projection,
    sourceBinding: buildV128ProjectionSourceDigestBinding(projection.headSha, {
      projectionPayload: projection,
    }),
  };
}

function runCachedNode({
  nodeRef,
  cacheDir,
  binding,
  nodeInputDigest,
  nodeSourceClosureDigest,
  runnerEnvironmentDigest,
  forceExecute,
  execute,
}) {
  const expected = expectedActualRecordBinding(
    binding,
    nodeRef,
    nodeInputDigest,
    nodeSourceClosureDigest,
    runnerEnvironmentDigest,
  );
  if (forceExecute !== true) {
    const read = readActualCacheRecord(cacheDir, expected);
    if (read.status === 'hit') {
      return {
        nodeResult: nodeResultFromPayload(nodeRef, read.typedResultPayload, 'reused', {
          sourceRunRef: sourceRunRefFromRecord(binding, read.recordDigest, read.typedResultPayload),
          sourceHeadSha: binding.sourceHead,
          cacheKeyDigest: digestValue(expected),
          nodeInputDigest,
        }),
        typedResultPayload: read.typedResultPayload,
        recordDigest: read.recordDigest,
        reused: true,
      };
    }
  }
  const typedResultPayload = execute();
  const record = buildActualCacheRecord(
    binding,
    nodeRef,
    nodeInputDigest,
    nodeSourceClosureDigest,
    typedResultPayload,
    runnerEnvironmentDigest,
  );
  const ledgerNodeResult = latestExecutedNodeResult(nodeRef, nodeInputDigest)
    || nodeResultFromPayload(nodeRef, record.typedResultPayload, 'executed', { nodeInputDigest });
  const nodeResult = {
    ...ledgerNodeResult,
    typedResultPayload: record.typedResultPayload,
    resultDigest: record.typedResultDigest,
    nodeInputDigest,
  };
  return {
    nodeResult,
    typedResultPayload: record.typedResultPayload,
    recordDigest: writeActualCacheRecord(cacheDir, record),
    reused: false,
  };
}

export function runV128ActualValidationExecutorWithCache(input = {}) {
  const environment = runnerEnvironment();
  const cacheDir = input.cacheDir || fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v128-actual-cache-'));
  fs.mkdirSync(cacheDir, { recursive: true });
  const binding = {
    repositoryId: input.repositoryId || 'github.com:hiro4649/codex-development-harness',
    sourceHead: input.sourceHead || 'unknown',
    baseHead: input.baseHead || input.sourceHead || 'unknown',
    testedCommit: input.testedCommit || input.sourceHead || 'unknown',
    testedTreeKind: input.testedTreeKind || 'branch_head',
    validationContextDigest: input.validationContextDigest || null,
  };
  const nodeSourceClosureDigests = input.nodeSourceClosureDigests || {};
  const commandDigests = input.commandDigests || {};
  const forceExecute = new Set(input.forceExecuteNodeRefs || []);
  const started = performance.now();
  const executionId = digestValue({
    executionKind: 'actual_validation_executor_cache',
    runKind: input.runKind || 'validation',
    binding,
    nodeInputDigests: input.nodeInputDigests || {},
    forceExecuteNodeRefs: [...forceExecute].sort(),
  });
  resetV128InvocationLedger({ epochDigest: executionId });
  const typedResults = {};
  const nodeResults = [];
  const readRecordDigests = [];
  const writtenRecordDigests = [];
  const routineProjection = input.routineDecisionProjection || defaultRoutineProjection(binding);
  const projectionInputDigest = input.nodeInputDigests?.projection_reader
    || routineProjection.sourceBinding?.projectionPayloadDigest
    || digestValue(routineProjection);
  const projectionRun = runCachedNode({
    nodeRef: 'projection_reader',
    cacheDir,
    binding,
    nodeInputDigest: projectionInputDigest,
    nodeSourceClosureDigest: safeDigest(nodeSourceClosureDigests.projection_reader, { nodeRef: 'projection_reader', source: 'actual_executor' }),
    runnerEnvironmentDigest: environment.runnerEnvironmentDigest,
    forceExecute: forceExecute.has('projection_reader'),
    execute: () => runV128ProjectionReaderAdapter(routineProjection, {
      commandOrFunctionDigest: commandDigests.projection_reader,
    }),
  });
  typedResults.projection_reader = projectionRun.typedResultPayload;
  nodeResults.push(projectionRun.nodeResult);
  (projectionRun.reused ? readRecordDigests : writtenRecordDigests).push(projectionRun.recordDigest);

  const managedInput = input.managedContextInput || { headSha: binding.sourceHead };
  const managedInputDigest = input.nodeInputDigests?.managed_context_emitter || digestValue(managedInput);
  const managedRun = runCachedNode({
    nodeRef: 'managed_context_emitter',
    cacheDir,
    binding,
    nodeInputDigest: managedInputDigest,
    nodeSourceClosureDigest: safeDigest(nodeSourceClosureDigests.managed_context_emitter, { nodeRef: 'managed_context_emitter', source: 'actual_executor' }),
    runnerEnvironmentDigest: environment.runnerEnvironmentDigest,
    forceExecute: forceExecute.has('managed_context_emitter'),
    execute: () => runV128ManagedContextAdapter(managedInput, {
      commandOrFunctionDigest: commandDigests.managed_context_emitter,
    }),
  });
  typedResults.managed_context_emitter = managedRun.typedResultPayload;
  nodeResults.push(managedRun.nodeResult);
  (managedRun.reused ? readRecordDigests : writtenRecordDigests).push(managedRun.recordDigest);

  const stateInputDigest = input.nodeInputDigests?.state_matrix_executor || digestValue({ stateMatrix: 'CODEX_V128_STATE_MATRIX' });
  const stateRun = runCachedNode({
    nodeRef: 'state_matrix_executor',
    cacheDir,
    binding,
    nodeInputDigest: stateInputDigest,
    nodeSourceClosureDigest: safeDigest(nodeSourceClosureDigests.state_matrix_executor, { nodeRef: 'state_matrix_executor', source: 'actual_executor' }),
    runnerEnvironmentDigest: environment.runnerEnvironmentDigest,
    forceExecute: forceExecute.has('state_matrix_executor'),
    execute: () => runV128StateMatrixAdapter({
      commandOrFunctionDigest: commandDigests.state_matrix_executor,
    }),
  });
  typedResults.state_matrix_executor = stateRun.typedResultPayload;
  nodeResults.push(stateRun.nodeResult);
  (stateRun.reused ? readRecordDigests : writtenRecordDigests).push(stateRun.recordDigest);

  const upstreamNodeResults = nodeResults.slice();
  const aggregateInputDigest = input.nodeInputDigests?.aggregate_finalizer
    || digestValue({
      aggregateInputSchema: 'v128_aggregate_input_with_upstream_input_digests_v1',
      orderedUpstreamResultSetDigest: buildV128OrderedUpstreamResultSetDigest(upstreamNodeResults),
      upstreamNodeInputDigests: Object.fromEntries(upstreamNodeResults.map((node) => [
        node.nodeRef,
        node.nodeInputDigest || null,
      ])),
    });
  const aggregateRun = runCachedNode({
    nodeRef: 'aggregate_finalizer',
    cacheDir,
    binding,
    nodeInputDigest: aggregateInputDigest,
    nodeSourceClosureDigest: safeDigest(nodeSourceClosureDigests.aggregate_finalizer, { nodeRef: 'aggregate_finalizer', source: 'actual_executor' }),
    runnerEnvironmentDigest: environment.runnerEnvironmentDigest,
    forceExecute: forceExecute.has('aggregate_finalizer'),
    execute: () => runV128AggregateFinalizerAdapter({ upstreamNodeResults }, {
      commandOrFunctionDigest: commandDigests.aggregate_finalizer,
    }),
  });
  typedResults.aggregate_finalizer = aggregateRun.typedResultPayload;
  nodeResults.push(aggregateRun.nodeResult);
  (aggregateRun.reused ? readRecordDigests : writtenRecordDigests).push(aggregateRun.recordDigest);

  const ledgerSnapshot = getV128InvocationLedgerSnapshot();
  const executedNodeRefs = nodeResults.filter((node) => node.executionState === 'executed').map((node) => node.nodeRef).sort();
  const reusedNodeRefs = nodeResults.filter((node) => node.executionState === 'reused').map((node) => node.nodeRef).sort();
  const cacheCleanup = cleanupActualCacheDir(cacheDir, input.cacheCleanupLimits || {});
  const durationMs = Math.max(0, Math.round((performance.now() - started) * 1000) / 1000);
  return {
    status: nodeResults.every((node) => node.status === 'pass') ? 'pass' : 'fail',
    executionId,
    processIdDigest: digestValue({
      pid: process.pid,
      executionId,
      nodeVersion: process.version,
    }),
    durationMs,
    cacheDirPersistedInRepo: false,
    cacheRecordPathSchema: ACTUAL_CACHE_RECORD_SCHEMA,
    cacheCleanup,
    runnerEnvironmentDigest: environment.runnerEnvironmentDigest,
    proofScope: environment.proofScope,
    typedResults,
    nodeResults,
    invocationLedger: ledgerSnapshot.invocationLedger,
    adapterInvocationCount: ledgerSnapshot.invocationLedger.length,
    adapterInvocationSetDigest: digestValue(ledgerSnapshot.invocationLedger.map((entry) => ({
      nodeRef: entry.nodeRef,
      resultDigest: entry.resultDigest,
    }))),
    cacheReadCount: readRecordDigests.length,
    cacheWriteCount: writtenRecordDigests.length,
    restoredPayloadCount: reusedNodeRefs.length,
    executedNodeRefs,
    reusedNodeRefs,
    nodeInputDigests: {
      projection_reader: projectionInputDigest,
      managed_context_emitter: managedInputDigest,
      state_matrix_executor: stateInputDigest,
      aggregate_finalizer: aggregateInputDigest,
    },
    aggregateResultDigest: nodeResults.find((node) => node.nodeRef === 'aggregate_finalizer')?.resultDigest || null,
    recordReadSetDigest: digestValue(readRecordDigests),
    recordWriteSetDigest: digestValue(writtenRecordDigests),
    safeSummaryOnly: true,
  };
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
    actualCacheProofStatus: result.actualCacheProof?.status || 'unknown',
    sampleCount: Number(result.actualCacheProof?.sampleCount || 0),
    coldP50: Number(result.actualCacheProof?.coldP50 || 0),
    hitP50: Number(result.actualCacheProof?.hitP50 || 0),
    coldP95: Number(result.actualCacheProof?.coldP95 || 0),
    hitP95: Number(result.actualCacheProof?.hitP95 || 0),
    resultEquivalenceState: result.actualCacheProof?.resultEquivalenceState || 'unknown',
    cacheProofDigest: result.actualCacheProof?.cacheProofDigest || null,
    cacheRecordReadbackDigest: result.cacheRecordReadbackDigest,
    canaryDigest: result.canaryDigest,
    canaryTransportDigest: result.canaryTransportDigest,
    safeSummaryOnly: true,
  };
}

function writeTempJson(dir, name, value) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, `${canonicalJson(value)}\n`, 'utf8');
  return filePath;
}

function readTempJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runActualCacheChild(input) {
  const output = runV128ActualValidationExecutorWithCache(input);
  return {
    status: output.status,
    executionId: output.executionId,
    processIdDigest: output.processIdDigest,
    durationMs: output.durationMs,
    adapterInvocationCount: output.adapterInvocationCount,
    adapterInvocationSetDigest: output.adapterInvocationSetDigest,
    cacheReadCount: output.cacheReadCount,
    cacheWriteCount: output.cacheWriteCount,
    restoredPayloadCount: output.restoredPayloadCount,
    executedNodeRefs: output.executedNodeRefs,
    reusedNodeRefs: output.reusedNodeRefs,
    nodeInputDigests: output.nodeInputDigests,
    aggregateResultDigest: output.aggregateResultDigest,
    typedResultDigests: Object.fromEntries(Object.entries(output.typedResults).map(([nodeRef, payload]) => [nodeRef, digestValue(payload)])),
    recordReadSetDigest: output.recordReadSetDigest,
    recordWriteSetDigest: output.recordWriteSetDigest,
    safeSummaryOnly: true,
  };
}

function spawnActualCacheChild(input, tempDir, label) {
  const inputPath = writeTempJson(tempDir, `${label}.input.json`, input);
  const outputPath = path.join(tempDir, `${label}.output.json`);
  const result = spawnSync(process.execPath, [
    fileURLToPath(import.meta.url),
    '--actual-cache-child',
    inputPath,
    outputPath,
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    return {
      status: 'fail',
      executionId: null,
      processIdDigest: digestValue({ label, childStatus: result.status, stderr: String(result.stderr || '').slice(0, 200) }),
      adapterInvocationCount: 0,
      cacheReadCount: 0,
      cacheWriteCount: 0,
      restoredPayloadCount: 0,
      executedNodeRefs: [],
      reusedNodeRefs: [],
      childFailureDigest: digestValue({
        status: result.status,
        stderr: String(result.stderr || '').slice(0, 400),
        stdout: String(result.stdout || '').slice(0, 400),
      }),
      safeSummaryOnly: true,
    };
  }
  return readTempJson(outputPath);
}

function percentile(values = [], percentileRank = 0.5) {
  const sorted = values.filter((value) => Number.isFinite(Number(value))).map(Number).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentileRank * sorted.length) - 1));
  return Math.round(sorted[index] * 1000) / 1000;
}

function buildActualCacheProof(input = {}, binding = {}, environment = runnerEnvironment()) {
  const sampleCount = Number(input.actualCacheSampleCount ?? 20);
  if (sampleCount < 1) {
    const proofCore = {
      status: 'partial_shadow_candidate',
      proofKind: 'actual_validation_executor_cache_black_box',
      proofScope: environment.proofScope,
      sampleCount: 0,
      coldP50: 0,
      hitP50: 0,
      coldP95: 0,
      hitP95: 0,
      p50ImprovementPercent: 0,
      p95ImprovementPercent: 0,
      executedCount: 0,
      reusedCount: 0,
      realHitAdapterInvocationCount: 0,
      partialHitUnaffectedAdapterInvocationCount: 0,
      resultEquivalenceState: 'not_exercised',
      acceptance: {
        sampleCountMet: false,
        childrenSucceeded: false,
        distinctProcessesObserved: false,
        realHitAdapterInvocationCountZero: true,
        partialHitUnaffectedAdapterInvocationCountZero: true,
        resultEquivalencePass: false,
        p50ImprovementMet: false,
        p95ImprovementMet: false,
      },
      equivalence: {
        coldHitAggregateEquivalent: false,
        partialAggregateChanged: false,
        partialReusedManagedEquivalent: false,
        partialReusedStateEquivalent: false,
      },
      coldMiss: null,
      realHit: null,
      realPartialHit: null,
      safeSummaryOnly: true,
    };
    return {
      ...proofCore,
      cacheProofDigest: digestValue(proofCore),
    };
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v128-actual-cache-proof-'));
  const cacheDir = path.join(tempDir, 'cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const routineDecisionProjection = input.routineDecisionProjection || defaultRoutineProjection(binding);
  const partialProjection = mutateProjectionForPartial(routineDecisionProjection);
  const managedContextInput = input.managedContextInput || { headSha: binding.sourceHead };
  const sourceDigests = input.nodeSourceClosureDigests || {};
  const baseInput = {
    cacheDir,
    repositoryId: binding.repositoryId,
    sourceHead: binding.sourceHead,
    baseHead: binding.baseHead,
    testedCommit: binding.testedCommit,
    testedTreeKind: binding.testedTreeKind,
    validationContextDigest: binding.validationContextDigest,
    managedContextInput,
    nodeSourceClosureDigests: sourceDigests,
    commandDigests: input.commandDigests || {},
  };
  try {
    const coldRuns = [];
    const hitRuns = [];
    const partialRuns = [];
    for (let sample = 0; sample < sampleCount; sample += 1) {
      coldRuns.push(spawnActualCacheChild({
        ...baseInput,
        runKind: 'cold_miss',
        routineDecisionProjection,
        forceExecuteNodeRefs: CANARY_NODE_REFS,
      }, tempDir, `cold-${sample}`));
      hitRuns.push(spawnActualCacheChild({
        ...baseInput,
        runKind: 'real_hit',
        routineDecisionProjection,
      }, tempDir, `hit-${sample}`));
      partialRuns.push(spawnActualCacheChild({
        ...baseInput,
        runKind: 'real_partial_hit',
        routineDecisionProjection: partialProjection,
        forceExecuteNodeRefs: PARTIAL_EXECUTED_NODE_REFS,
      }, tempDir, `partial-${sample}`));
    }
    const firstCold = coldRuns[0] || {};
    const firstHit = hitRuns[0] || {};
    const firstPartial = partialRuns[0] || {};
    const hitAdapterCalls = hitRuns.reduce((sum, run) => sum + Number(run.adapterInvocationCount || 0), 0);
    const partialUnaffectedAdapterCalls = partialRuns.reduce((sum, run) => {
      const executed = new Set(run.executedNodeRefs || []);
      return sum + ['managed_context_emitter', 'state_matrix_executor'].filter((nodeRef) => executed.has(nodeRef)).length;
    }, 0);
    const coldP50 = percentile(coldRuns.map((run) => run.durationMs), 0.5);
    const hitP50 = percentile(hitRuns.map((run) => run.durationMs), 0.5);
    const coldP95 = percentile(coldRuns.map((run) => run.durationMs), 0.95);
    const hitP95 = percentile(hitRuns.map((run) => run.durationMs), 0.95);
    const p50ImprovementPercent = coldP50 > 0 ? Math.round(((coldP50 - hitP50) / coldP50) * 1000) / 10 : 0;
    const p95ImprovementPercent = coldP95 > 0 ? Math.round(((coldP95 - hitP95) / coldP95) * 1000) / 10 : 0;
    const equivalence = {
      coldHitAggregateEquivalent: firstCold.aggregateResultDigest === firstHit.aggregateResultDigest,
      partialAggregateChanged: firstPartial.aggregateResultDigest !== firstCold.aggregateResultDigest,
      partialReusedManagedEquivalent: firstPartial.typedResultDigests?.managed_context_emitter === firstCold.typedResultDigests?.managed_context_emitter,
      partialReusedStateEquivalent: firstPartial.typedResultDigests?.state_matrix_executor === firstCold.typedResultDigests?.state_matrix_executor,
    };
    const distinctProcessDigests = new Set([
      ...coldRuns,
      ...hitRuns,
      ...partialRuns,
    ].map((run) => run.processIdDigest).filter(Boolean)).size;
    const acceptance = {
      sampleCountMet: sampleCount >= 20,
      childrenSucceeded: [...coldRuns, ...hitRuns, ...partialRuns].every((run) => run.status === 'pass'),
      distinctProcessesObserved: distinctProcessDigests >= 3,
      realHitAdapterInvocationCountZero: hitAdapterCalls === 0,
      partialHitUnaffectedAdapterInvocationCountZero: partialUnaffectedAdapterCalls === 0,
      resultEquivalencePass: Object.values(equivalence).every(Boolean),
      p50ImprovementMet: p50ImprovementPercent >= 25,
      p95ImprovementMet: p95ImprovementPercent >= 20,
    };
    const status = Object.values(acceptance).every(Boolean) ? 'pass' : 'partial_shadow_candidate';
    const proofCore = {
      status,
      proofKind: 'actual_validation_executor_cache_black_box',
      proofScope: environment.proofScope,
      sampleCount,
      coldP50,
      hitP50,
      coldP95,
      hitP95,
      p50ImprovementPercent,
      p95ImprovementPercent,
      executedCount: coldRuns.reduce((sum, run) => sum + Number(run.adapterInvocationCount || 0), 0)
        + partialRuns.reduce((sum, run) => sum + Number(run.adapterInvocationCount || 0), 0),
      reusedCount: hitRuns.reduce((sum, run) => sum + Number(run.restoredPayloadCount || 0), 0)
        + partialRuns.reduce((sum, run) => sum + Number(run.restoredPayloadCount || 0), 0),
      realHitAdapterInvocationCount: hitAdapterCalls,
      partialHitUnaffectedAdapterInvocationCount: partialUnaffectedAdapterCalls,
      resultEquivalenceState: Object.values(equivalence).every(Boolean) ? 'pass' : 'fail',
      acceptance,
      equivalence,
      coldMiss: {
        executionId: firstCold.executionId || null,
        executedNodeRefs: firstCold.executedNodeRefs || [],
        reusedNodeRefs: firstCold.reusedNodeRefs || [],
        adapterInvocationCount: Number(firstCold.adapterInvocationCount || 0),
      },
      realHit: {
        executionId: firstHit.executionId || null,
        executedNodeRefs: firstHit.executedNodeRefs || [],
        reusedNodeRefs: firstHit.reusedNodeRefs || [],
        adapterInvocationCount: Number(firstHit.adapterInvocationCount || 0),
      },
      realPartialHit: {
        executionId: firstPartial.executionId || null,
        executedNodeRefs: firstPartial.executedNodeRefs || [],
        reusedNodeRefs: firstPartial.reusedNodeRefs || [],
        adapterInvocationCount: Number(firstPartial.adapterInvocationCount || 0),
      },
      childRunSetDigest: digestValue({
        cold: coldRuns.map((run) => run.executionId),
        hit: hitRuns.map((run) => run.executionId),
        partial: partialRuns.map((run) => run.executionId),
      }),
      safeSummaryOnly: true,
    };
    return {
      ...proofCore,
      cacheProofDigest: digestValue(proofCore),
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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
    const actualCacheProof = buildActualCacheProof(input, binding, environment);
    const status = Object.values(acceptance).every(Boolean) && actualCacheProof.status === 'pass' ? 'pass' : 'partial_shadow_candidate';
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
      actualCacheProof,
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

if (process.argv[1] && process.argv[1].endsWith('codex-v128-serialized-cache-canary.mjs')
  && process.argv[2] === '--actual-cache-child') {
  const input = readTempJson(process.argv[3]);
  const output = runActualCacheChild(input);
  fs.writeFileSync(process.argv[4], `${canonicalJson(output)}\n`, 'utf8');
} else if (process.argv[1] && process.argv[1].endsWith('codex-v128-serialized-cache-canary.mjs')) {
  process.stdout.write(`${canonicalJson(runV128SerializedCacheCanary({
    repositoryId: 'github.com:hiro4649/codex-development-harness',
    sourceHead: 'f'.repeat(40),
    baseHead: 'e'.repeat(40),
    testedCommit: 'f'.repeat(40),
    testedTreeKind: 'branch_head',
    validationContextDigest: digestValue({ cli: true }),
  }))}\n`);
}
