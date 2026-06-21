#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function digestValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function upstreamDigestSet(upstreamNodeResults = []) {
  return upstreamNodeResults.map((node) => ({
    nodeRef: String(node.nodeRef || 'unknown_node'),
    status: String(node.status || 'fail'),
    resultDigest: String(node.resultDigest || ''),
  }));
}

export function buildV128OrderedUpstreamResultSetDigest(upstreamNodeResults = []) {
  return digestValue(upstreamDigestSet(upstreamNodeResults));
}

export function aggregateV128ValidationResults(input = {}) {
  const upstreamNodeResults = Array.isArray(input.upstreamNodeResults) ? input.upstreamNodeResults : [];
  const upstreamResultDigests = upstreamDigestSet(upstreamNodeResults);
  const failed = upstreamNodeResults.filter((node) => node.status !== 'pass');
  return {
    schemaVersion: '1.0.0',
    nodeRef: 'aggregate_finalizer',
    aggregateOnly: true,
    downstreamRespawnAllowed: false,
    upstreamNodeRefs: upstreamNodeResults.map((node) => String(node.nodeRef || 'unknown_node')),
    upstreamResultDigests,
    orderedUpstreamResultSetDigest: buildV128OrderedUpstreamResultSetDigest(upstreamNodeResults),
    failedNodeRefs: failed.map((node) => String(node.nodeRef || 'unknown_node')),
    status: failed.length ? 'fail' : 'pass',
    safeSummaryOnly: true,
  };
}
