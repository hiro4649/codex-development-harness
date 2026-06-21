#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ledgerState = {
  invocationSequence: 0,
  completionSequence: 0,
  counts: new Map(),
  typedResults: {},
  nodeResults: [],
  invocationLedger: [],
};

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function digestValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function optionalLedgerAppend(entry) {
  const configuredPath = String(process.env.CODEX_V128_INVOCATION_LEDGER_PATH || '').trim();
  if (!configuredPath) return;
  const normalized = configuredPath.replace(/\\/g, '/');
  if (!normalized.startsWith('.codex/')) return;
  fs.mkdirSync(path.dirname(configuredPath), { recursive: true });
  fs.appendFileSync(configuredPath, `${canonicalJson(entry)}\n`, 'utf8');
}

export function resetV128InvocationLedger() {
  ledgerState.invocationSequence = 0;
  ledgerState.completionSequence = 0;
  ledgerState.counts = new Map();
  ledgerState.typedResults = {};
  ledgerState.nodeResults = [];
  ledgerState.invocationLedger = [];
}

export function recordV128AdapterInvocation(meta = {}, payload = {}) {
  const nodeRef = String(meta.nodeRef || payload?.nodeRef || 'unknown_node');
  ledgerState.invocationSequence += 1;
  ledgerState.completionSequence += 1;
  const executionCount = (ledgerState.counts.get(nodeRef) || 0) + 1;
  ledgerState.counts.set(nodeRef, executionCount);
  const resultDigest = digestValue(payload);
  const stabilityClass = meta.stabilityClass || 'decision_stable';
  const nodeResult = {
    nodeRef,
    executionState: 'executed',
    executionCount,
    executionCountSource: 'process_wide_invocation_ledger',
    executionCountObserved: true,
    status: payload?.status === 'pass' ? 'pass' : 'fail',
    stabilityClass,
    typedResultPayload: payload,
    resultDigest,
    resultSchemaVersion: payload?.schemaVersion || '1.0.0',
  };
  const ledgerEntry = {
    nodeRef,
    commandOrFunctionDigest: meta.commandOrFunctionDigest || digestValue({
      nodeRef,
      stabilityClass,
      adapterId: meta.adapterId || payload?.adapterId || null,
    }),
    invocationSequence: ledgerState.invocationSequence,
    completionSequence: ledgerState.completionSequence,
    resultDigest,
    executionSource: meta.executionSource || 'v128_process_wide_adapter_entrypoint',
    adapterId: meta.adapterId || payload?.adapterId || null,
  };
  ledgerState.typedResults[nodeRef] = payload;
  ledgerState.nodeResults.push(nodeResult);
  ledgerState.invocationLedger.push(ledgerEntry);
  optionalLedgerAppend(ledgerEntry);
  return payload;
}

export function getV128InvocationLedgerSnapshot() {
  return {
    nodeResults: [...ledgerState.nodeResults],
    typedResults: { ...ledgerState.typedResults },
    invocationLedger: [...ledgerState.invocationLedger],
  };
}
