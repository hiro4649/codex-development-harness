#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import { buildV128ManagedContextEmitter } from './codex-v128-managed-context-emitter.mjs';
import { recordV128AdapterInvocation } from './codex-v128-invocation-ledger.mjs';

export const V128_MANAGED_CONTEXT_ADAPTER_ID = 'v128_managed_context_adapter_v1';

export function runV128ManagedContextAdapter(input = {}, options = {}) {
  const context = buildV128ManagedContextEmitter(input);
  return recordV128AdapterInvocation({
    nodeRef: 'managed_context_emitter',
    stabilityClass: 'cache_stable',
    adapterId: V128_MANAGED_CONTEXT_ADAPTER_ID,
    commandOrFunctionDigest: options.commandOrFunctionDigest,
  }, {
    ...context,
    schemaVersion: '1.0.0',
    nodeRef: 'managed_context_emitter',
    adapterId: V128_MANAGED_CONTEXT_ADAPTER_ID,
    sourceFileCount: Array.isArray(context.sourceFiles) ? context.sourceFiles.length : 0,
  });
}
