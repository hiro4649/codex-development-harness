#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import { buildV128RoutineProjectionReadSurface } from './codex-v128-projection-reader.mjs';
import { recordV128AdapterInvocation } from './codex-v128-invocation-ledger.mjs';

export const V128_PROJECTION_READER_ADAPTER_ID = 'v128_projection_reader_adapter_v1';

export function runV128ProjectionReaderAdapter(routineDecisionProjection, options = {}) {
  const surface = buildV128RoutineProjectionReadSurface(routineDecisionProjection);
  return recordV128AdapterInvocation({
    nodeRef: 'projection_reader',
    stabilityClass: 'decision_stable',
    adapterId: V128_PROJECTION_READER_ADAPTER_ID,
    commandOrFunctionDigest: options.commandOrFunctionDigest,
  }, {
    ...surface,
    schemaVersion: '1.0.0',
    nodeRef: 'projection_reader',
    adapterId: V128_PROJECTION_READER_ADAPTER_ID,
  });
}
