#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import { buildV128RoutineProjectionReadSurface } from './codex-v128-projection-reader.mjs';

export const V128_PROJECTION_READER_ADAPTER_ID = 'v128_projection_reader_adapter_v1';

export function runV128ProjectionReaderAdapter(routineDecisionProjection) {
  const surface = buildV128RoutineProjectionReadSurface(routineDecisionProjection);
  return {
    ...surface,
    schemaVersion: '1.0.0',
    nodeRef: 'projection_reader',
    adapterId: V128_PROJECTION_READER_ADAPTER_ID,
  };
}
