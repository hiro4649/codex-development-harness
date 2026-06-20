#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

export function aggregateV128ValidationResults(input = {}) {
  const upstreamNodeResults = Array.isArray(input.upstreamNodeResults) ? input.upstreamNodeResults : [];
  const upstreamResultDigests = upstreamNodeResults.map((node) => ({
    nodeRef: String(node.nodeRef || 'unknown_node'),
    status: String(node.status || 'fail'),
    resultDigest: String(node.resultDigest || ''),
  }));
  const failed = upstreamNodeResults.filter((node) => node.status !== 'pass');
  return {
    schemaVersion: '1.0.0',
    nodeRef: 'aggregate_finalizer',
    aggregateOnly: true,
    downstreamRespawnAllowed: false,
    upstreamNodeRefs: upstreamNodeResults.map((node) => String(node.nodeRef || 'unknown_node')),
    upstreamResultDigests,
    failedNodeRefs: failed.map((node) => String(node.nodeRef || 'unknown_node')),
    status: failed.length ? 'fail' : 'pass',
    safeSummaryOnly: true,
  };
}

