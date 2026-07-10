#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import crypto from 'node:crypto';

export const V132_VERSION = '1.3.2';
export const V132_FINAL_AUTHORITY = 'v1.1.8_final_decision_kernel';
export const V132_REMOTE_VALIDATION_STATES = Object.freeze([
  'not_observed',
  'unavailable_billing',
  'queued',
  'in_progress',
  'passed',
  'failed',
  'canceled',
  'stale',
  'head_mismatch',
  'artifact_missing',
  'required_check_set_mismatch',
]);

const FORBIDDEN_AUTHORITY_BOOLEAN_KEYS = new Set([
  'remoteChecksPass',
  'sameHead',
  'artifactUploaded',
  'artifactDownloadObserved',
  'requiredChecksPass',
  'mergeReady',
]);

const SHA_RE = /^[a-f0-9]{40}$/;
const DIGEST_RE = /^sha256:[a-f0-9]{64}$/;
const RFC3339_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value)).digest('hex')}`;
}

function collectForbiddenBooleanClaims(value, path = '$', claims = []) {
  if (!value || typeof value !== 'object') return claims;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenBooleanClaims(item, `${path}[${index}]`, claims));
    return claims;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_AUTHORITY_BOOLEAN_KEYS.has(key) && typeof child === 'boolean') claims.push(childPath);
    collectForbiddenBooleanClaims(child, childPath, claims);
  }
  return claims;
}

function validRfc3339(value) {
  return typeof value === 'string' && RFC3339_RE.test(value) && Number.isFinite(Date.parse(value));
}

function uniquePositiveIntegers(values) {
  return Array.isArray(values)
    && values.length > 0
    && values.every((value) => Number.isInteger(value) && value > 0)
    && new Set(values).size === values.length;
}

function baseRemoteProjection(remoteValidationState, reasonCodes = []) {
  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    remoteValidationState,
    remoteFailureClass: null,
    sameHeadState: 'not_observed',
    requiredCheckSetState: 'not_observed',
    artifactIntegrityState: 'not_observed',
    remoteEvidenceObserved: false,
    reasonCodes,
    createsAuthority: false,
  };
}

export function evaluateRemoteEvidence(receipt, expected = {}) {
  if (receipt == null) return baseRemoteProjection('not_observed');

  const reasons = collectForbiddenBooleanClaims(receipt).map((path) => `authority_boolean_forbidden:${path}`);
  const repository = String(receipt.repository || '');
  const headSha = String(receipt.headSha || '').toLowerCase();
  const expectedHeadSha = String(expected.headSha || '').toLowerCase();
  const requiredCheckSetDigest = String(receipt.requiredCheckSetDigest || '');
  const expectedCheckSetDigest = String(expected.requiredCheckSetDigest || '');
  const artifactDigest = String(receipt.artifactDigest || '');
  const expectedArtifactDigest = String(expected.artifactDigest || '');

  if (!['github_required_check_set', 'github_job_not_started'].includes(receipt.evidenceType)) reasons.push('remote_evidence_type_invalid');
  if (!repository || (expected.repository && repository !== expected.repository)) reasons.push('remote_repository_mismatch');
  if (!SHA_RE.test(headSha)) reasons.push('remote_head_sha_invalid');
  if (expectedHeadSha && headSha !== expectedHeadSha) reasons.push('remote_head_sha_mismatch');
  if (!uniquePositiveIntegers(receipt.runIds)) reasons.push('remote_run_ids_invalid');
  if (!Number.isInteger(receipt.runAttempt) || receipt.runAttempt < 1) reasons.push('remote_run_attempt_invalid');
  if (receipt.observationSource !== 'github_api') reasons.push('remote_observation_source_invalid');
  if (!validRfc3339(receipt.startedAt) || !validRfc3339(receipt.completedAt) || !validRfc3339(receipt.observedAt)) reasons.push('remote_timestamp_invalid');
  if (validRfc3339(receipt.startedAt) && validRfc3339(receipt.completedAt)
    && Date.parse(receipt.completedAt) < Date.parse(receipt.startedAt)) reasons.push('remote_timestamp_order_invalid');

  if (receipt.evidenceType === 'github_job_not_started') {
    if (receipt.failureClass !== 'account_billing_lock') reasons.push('remote_not_started_failure_class_invalid');
    if (!DIGEST_RE.test(String(receipt.annotationDigest || ''))) reasons.push('remote_not_started_annotation_digest_invalid');
    return {
      ...baseRemoteProjection(reasons.length ? 'failed' : 'unavailable_billing', reasons),
      remoteFailureClass: receipt.failureClass || 'unknown_pre_step_failure',
      remoteEvidenceObserved: true,
      observedHeadSha: SHA_RE.test(headSha) ? headSha : null,
      runIds: uniquePositiveIntegers(receipt.runIds) ? [...receipt.runIds] : [],
    };
  }

  const checkRuns = Array.isArray(receipt.checkRuns) ? receipt.checkRuns : [];
  if (!checkRuns.length) reasons.push('required_check_runs_missing');
  for (const [index, check] of checkRuns.entries()) {
    if (!Number.isInteger(check.checkRunId) || check.checkRunId < 1) reasons.push(`check_${index}_id_invalid`);
    if (!check.name || typeof check.name !== 'string') reasons.push(`check_${index}_name_invalid`);
    if (check.conclusion !== 'success') reasons.push(`check_${index}_conclusion_not_success`);
    if (String(check.headSha || '').toLowerCase() !== headSha) reasons.push(`check_${index}_head_mismatch`);
  }
  if (!DIGEST_RE.test(requiredCheckSetDigest)) reasons.push('required_check_set_digest_invalid');
  if (expectedCheckSetDigest && requiredCheckSetDigest !== expectedCheckSetDigest) reasons.push('required_check_set_digest_mismatch');
  if (!DIGEST_RE.test(artifactDigest)) reasons.push('artifact_digest_missing_or_invalid');
  if (expectedArtifactDigest && artifactDigest !== expectedArtifactDigest) reasons.push('artifact_digest_mismatch');
  if (receipt.conclusion !== 'success') reasons.push('remote_conclusion_not_success');

  let remoteValidationState = 'passed';
  if (reasons.some((reason) => reason.includes('head_sha_mismatch') || reason.includes('_head_mismatch'))) remoteValidationState = 'head_mismatch';
  else if (reasons.some((reason) => reason.includes('required_check_set'))) remoteValidationState = 'required_check_set_mismatch';
  else if (reasons.some((reason) => reason.includes('artifact_digest'))) remoteValidationState = 'artifact_missing';
  else if (reasons.length) remoteValidationState = 'failed';

  return {
    status: reasons.length ? 'fail' : 'pass',
    remoteValidationState,
    remoteFailureClass: reasons.length ? 'remote_evidence_invalid' : null,
    sameHeadState: !reasons.some((reason) => reason.includes('head')) && expectedHeadSha ? 'matched' : (expectedHeadSha ? 'mismatch' : 'not_requested'),
    requiredCheckSetState: !reasons.some((reason) => reason.includes('required_check_set') || reason.startsWith('check_')) ? 'matched' : 'mismatch',
    artifactIntegrityState: !reasons.some((reason) => reason.includes('artifact_digest')) ? 'verified' : 'missing_or_mismatch',
    remoteEvidenceObserved: true,
    observedHeadSha: SHA_RE.test(headSha) ? headSha : null,
    runIds: uniquePositiveIntegers(receipt.runIds) ? [...receipt.runIds] : [],
    reasonCodes: reasons,
    createsAuthority: false,
  };
}

export function evaluateFinalDecisionReceipt(receipt, expected = {}) {
  if (receipt == null) return { status: 'not_observed', finalDecisionState: 'not_authorized', reasonCodes: [], createsAuthority: false };
  const reasons = collectForbiddenBooleanClaims(receipt).map((path) => `authority_boolean_forbidden:${path}`);
  if (receipt.evidenceType !== 'final_decision_authorization') reasons.push('final_decision_receipt_type_invalid');
  if (receipt.authority !== V132_FINAL_AUTHORITY) reasons.push('final_decision_authority_invalid');
  if (receipt.decision !== 'allow_merge') reasons.push('final_decision_not_allow_merge');
  if (!SHA_RE.test(String(receipt.headSha || '').toLowerCase())) reasons.push('final_decision_head_invalid');
  if (expected.headSha && String(receipt.headSha || '').toLowerCase() !== String(expected.headSha).toLowerCase()) reasons.push('final_decision_head_mismatch');
  if (expected.repository && receipt.repository !== expected.repository) reasons.push('final_decision_repository_mismatch');
  if (!DIGEST_RE.test(String(receipt.receiptDigest || ''))) reasons.push('final_decision_digest_invalid');
  if (!validRfc3339(receipt.observedAt)) reasons.push('final_decision_timestamp_invalid');
  return {
    status: reasons.length ? 'fail' : 'pass',
    finalDecisionState: reasons.length ? 'not_authorized' : 'authorized',
    reasonCodes: reasons,
    createsAuthority: false,
  };
}

export function deriveCanonicalState({
  localValidationPassed = false,
  remoteEvidence = null,
  finalDecisionReceipt = null,
  expected = {},
} = {}) {
  const remote = evaluateRemoteEvidence(remoteEvidence, expected);
  const finalDecision = evaluateFinalDecisionReceipt(finalDecisionReceipt, expected);
  const localValidationState = localValidationPassed ? 'passed' : 'failed';
  const technicalMergeEligibility = localValidationState === 'passed'
    && remote.remoteValidationState === 'passed'
    && remote.sameHeadState === 'matched'
    && remote.requiredCheckSetState === 'matched'
    && remote.artifactIntegrityState === 'verified'
    ? 'eligible'
    : 'blocked';
  const mergeAllowed = technicalMergeEligibility === 'eligible' && finalDecision.finalDecisionState === 'authorized';
  return {
    localValidationState,
    remoteValidationState: remote.remoteValidationState,
    remoteFailureClass: remote.remoteFailureClass,
    technicalMergeEligibility,
    finalDecisionState: finalDecision.finalDecisionState,
    mergeAllowed,
    deprecatedLocalTechnicalReady: {
      value: localValidationState === 'passed',
      authority: false,
      canOverrideMergeAllowed: false,
    },
    remoteEvidence: remote,
    finalDecisionEvidence: finalDecision,
    authorityCreated: false,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(deriveCanonicalState({ localValidationPassed: true }), null, 2));
}
