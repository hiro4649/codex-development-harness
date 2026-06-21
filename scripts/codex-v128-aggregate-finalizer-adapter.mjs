#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import { aggregateV128ValidationResults } from './codex-v128-aggregate-finalizer.mjs';
import { recordV128AdapterInvocation } from './codex-v128-invocation-ledger.mjs';

export const V128_AGGREGATE_FINALIZER_ADAPTER_ID = 'v128_aggregate_finalizer_adapter_v1';

export function runV128AggregateFinalizerAdapter(input = {}, options = {}) {
  return recordV128AdapterInvocation({
    nodeRef: 'aggregate_finalizer',
    stabilityClass: 'decision_stable',
    adapterId: V128_AGGREGATE_FINALIZER_ADAPTER_ID,
    commandOrFunctionDigest: options.commandOrFunctionDigest,
  }, {
    ...aggregateV128ValidationResults(input),
    adapterId: V128_AGGREGATE_FINALIZER_ADAPTER_ID,
  });
}
