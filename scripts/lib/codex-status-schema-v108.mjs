// CODEX_QUALITY_HARNESS_FILE v1.0.8

import crypto from 'node:crypto';

export const ALLOWED_STATUS_VALUES = new Set([
  'pass',
  'fail',
  'warning',
  'advisory',
  'not_applicable',
  'skipped_by_profile',
  'blocked_by_context',
  'blocked_by_remote_pending',
  'harness_internal_gap',
  'policy_registered',
]);

export function bool(value) {
  return value === true || value === 'true' || value === '1' || value === 'yes';
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

export function safeStatus(key, status = 'pass', payload = {}) {
  const reasonCodes = [...new Set(payload.reasonCodes || [])];
  const result = {
    status,
    blocking: ['fail', 'blocked_by_context', 'blocked_by_remote_pending', 'harness_internal_gap'].includes(status),
    reasonCodes,
    evidenceConsumed: payload.evidenceConsumed || [],
    safeSummary: payload.safeSummary || {},
    nextSafeAction: payload.nextSafeAction || (reasonCodes.length ? 'repair_v108_evidence' : 'continue_source_harness_validation'),
    safeSummaryOnly: true,
    ...payload,
    reasonCodes,
  };
  delete result.raw;
  return { [key]: result };
}

export function pass(key, payload = {}) {
  return safeStatus(key, 'pass', payload);
}

export function fail(key, reasonCodes, payload = {}) {
  return safeStatus(key, 'fail', { ...payload, reasonCodes });
}

export function policyRegistered(key) {
  return safeStatus(key, 'policy_registered', {
    blocking: false,
    safeSummary: { registration: 'policy_registered' },
    nextSafeAction: 'preserve_policy_boundary',
  });
}

export function statusFromReasons(key, reasonCodes, payload = {}) {
  return reasonCodes.length ? fail(key, reasonCodes, payload) : pass(key, payload);
}

export function safeSummary(records = []) {
  return {
    recordCount: records.length,
    allowedCount: records.filter((item) => item.allowed === true).length,
    blockedCount: records.filter((item) => item.blocked === true).length,
    safeSummaryOnly: true,
  };
}

export function onlySafeKeys(value = {}) {
  const forbidden = /(?:raw|token|secret|endpoint|private|wallet|rpc|db|payload|dataset|memory|viewer|provider|path|diff|log)/i;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !forbidden.test(key)));
}
