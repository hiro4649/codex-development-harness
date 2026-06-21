#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import { readAndEvaluateV128StateMatrix } from './codex-v128-state-matrix.mjs';
import { recordV128AdapterInvocation } from './codex-v128-invocation-ledger.mjs';

export const V128_STATE_MATRIX_ADAPTER_ID = 'v128_state_matrix_adapter_v1';

export function runV128StateMatrixAdapter(options = {}) {
  const matrix = readAndEvaluateV128StateMatrix();
  return recordV128AdapterInvocation({
    nodeRef: 'state_matrix_executor',
    stabilityClass: 'decision_stable',
    adapterId: V128_STATE_MATRIX_ADAPTER_ID,
    commandOrFunctionDigest: options.commandOrFunctionDigest,
  }, {
    ...matrix,
    schemaVersion: '1.0.0',
    nodeRef: 'state_matrix_executor',
    adapterId: V128_STATE_MATRIX_ADAPTER_ID,
  });
}
