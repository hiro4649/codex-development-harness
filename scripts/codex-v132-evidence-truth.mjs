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
const API_OBSERVED_REMOTE_RECEIPTS = new WeakSet();
const VERIFIED_FINAL_DECISION_RECEIPTS = new WeakSet();
const FIXTURE_REMOTE_RECEIPTS = new WeakSet();
const FIXTURE_FINAL_DECISION_RECEIPTS = new WeakSet();
export const V132_GITHUB_COLLECTOR_VERSION = 'v132-github-collector-2';

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
  const status = reasonCodes.length
    ? 'fail'
    : remoteValidationState === 'passed'
      ? 'pass'
      : remoteValidationState === 'not_observed'
        ? 'not_observed'
        : 'unavailable';
  return {
    status,
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

function normalizedCheckRuns(checkRuns = [], headSha = '') {
  return checkRuns.map((check) => ({
    checkRunId: Number(check.checkRunId),
    name: String(check.name || ''),
    conclusion: String(check.conclusion || ''),
    headSha: String(check.headSha || headSha).toLowerCase(),
  })).sort((a, b) => a.name.localeCompare(b.name) || a.checkRunId - b.checkRunId);
}

function normalizedArtifacts(artifacts = []) {
  return artifacts.map((artifact) => ({
    artifactId: Number(artifact.artifactId),
    name: String(artifact.name || ''),
    sizeInBytes: Number(artifact.sizeInBytes),
    contentDigest: String(artifact.contentDigest || ''),
  })).sort((a, b) => a.name.localeCompare(b.name) || a.artifactId - b.artifactId);
}

function remoteReceiptPayload(receipt) {
  const { receiptPayloadDigest: ignored, ...payload } = receipt;
  return payload;
}

function buildRemoteReceipt(observation = {}, { testMode = false, observationSource } = {}) {
  const headSha = String(observation.headSha || '').toLowerCase();
  const checkRuns = normalizedCheckRuns(observation.checkRuns, headSha);
  const artifacts = normalizedArtifacts(observation.artifacts);
  const runIds = (observation.runIds || [observation.runId]).map(Number).filter(Number.isInteger).sort((a, b) => a - b);
  const runAttempts = (observation.runAttempts || [{ runId: observation.runId, runAttempt: observation.runAttempt }])
    .map((item) => ({ runId: Number(item.runId), runAttempt: Number(item.runAttempt) }))
    .sort((a, b) => a.runId - b.runId);
  const receipt = {
    evidenceType: observation.failureClass === 'account_billing_lock' ? 'github_job_not_started' : 'github_required_check_set',
    trustClass: testMode ? 'explicit_test_fixture' : 'github_api_reobserved',
    testMode,
    collectorVersion: V132_GITHUB_COLLECTOR_VERSION,
    repository: String(observation.repository || ''),
    headSha,
    runIds,
    runAttempts,
    observationSource,
    startedAt: observation.startedAt,
    completedAt: observation.completedAt,
    observedAt: observation.observedAt,
    conclusion: observation.conclusion,
    failureClass: observation.failureClass || null,
    annotationDigest: observation.annotationText ? sha256(String(observation.annotationText)) : null,
    checkRuns,
    artifacts,
    requiredCheckSetDigest: sha256(canonicalJson(checkRuns.map(({ checkRunId, name, conclusion, headSha: checkHeadSha }) => ({ checkRunId, name, conclusion, headSha: checkHeadSha })))),
    artifactDigest: sha256(canonicalJson(artifacts)),
  };
  receipt.receiptPayloadDigest = sha256(canonicalJson(remoteReceiptPayload(receipt)));
  return receipt;
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'codex-v132-evidence-collector',
    },
  });
  if (!response.ok) throw new Error(`github_api_observation_failed:${response.status}:${url}`);
  return response.json();
}

async function observeGithubRun({ repository, runId, token } = {}) {
  if (!/^[-A-Za-z0-9_.]+\/[-A-Za-z0-9_.]+$/.test(String(repository || ''))) throw new Error('github_repository_invalid');
  if (!Number.isInteger(Number(runId)) || Number(runId) < 1) throw new Error('github_run_id_invalid');
  if (!token) throw new Error('github_token_required_for_verified_observation');
  const root = `https://api.github.com/repos/${repository}/actions/runs/${Number(runId)}`;
  const run = await githubJson(root, token);
  const jobs = await githubJson(`${root}/jobs?per_page=100`, token);
  const artifacts = await githubJson(`${root}/artifacts?per_page=100`, token);
  return {
    repository,
    headSha: run.head_sha,
    runId: Number(run.id),
    runAttempt: Number(run.run_attempt),
    startedAt: run.run_started_at || run.created_at,
    completedAt: run.updated_at,
    observedAt: new Date().toISOString(),
    conclusion: run.conclusion,
    checkRuns: (jobs.jobs || []).map((job) => ({
      checkRunId: Number(job.id),
      name: job.name,
      conclusion: job.conclusion,
      headSha: run.head_sha,
    })),
    artifacts: (artifacts.artifacts || []).filter((artifact) => artifact.expired !== true).map((artifact) => ({
      artifactId: Number(artifact.id),
      name: artifact.name,
      sizeInBytes: Number(artifact.size_in_bytes),
      contentDigest: artifact.digest || '',
    })),
  };
}

export function collectVerifiedGithubEvidence(request = {}) {
  const callerObservationFields = ['headSha', 'runAttempt', 'checkRuns', 'artifacts', 'conclusion', 'startedAt', 'completedAt', 'observedAt'];
  if (callerObservationFields.some((field) => Object.hasOwn(request, field))) {
    throw new Error('caller_supplied_github_observation_forbidden');
  }
  const allowedRequestFields = new Set(['repository', 'runId', 'runIds', 'token']);
  if (Object.keys(request).some((field) => !allowedRequestFields.has(field))) throw new Error('github_collector_request_field_forbidden');
  const runIds = [...new Set((request.runIds || [request.runId]).map(Number))].filter((runId) => Number.isInteger(runId) && runId > 0);
  if (!runIds.length || runIds.length > 4) throw new Error('github_run_id_set_invalid');
  return Promise.all(runIds.map((runId) => observeGithubRun({ repository: request.repository, runId, token: request.token }))).then((observations) => {
    const headSha = observations[0].headSha;
    const observation = {
      repository: request.repository,
      headSha,
      runIds: observations.map((item) => item.runId),
      runAttempts: observations.map((item) => ({ runId: item.runId, runAttempt: item.runAttempt })),
      startedAt: observations.map((item) => item.startedAt).sort()[0],
      completedAt: observations.map((item) => item.completedAt).sort().at(-1),
      observedAt: new Date().toISOString(),
      conclusion: observations.every((item) => item.conclusion === 'success') ? 'success' : 'failure',
      checkRuns: observations.flatMap((item) => item.checkRuns),
      artifacts: observations.flatMap((item) => item.artifacts),
    };
    const receipt = buildRemoteReceipt(observation, { testMode: false, observationSource: 'github_api_verified_collector' });
    API_OBSERVED_REMOTE_RECEIPTS.add(receipt);
    return receipt;
  });
}

export function reobserveSerializedGithubEvidence(receipt, request = {}) {
  const serialized = structuredClone(receipt);
  return collectVerifiedGithubEvidence({
    repository: serialized.repository,
    runIds: serialized.runIds,
    token: request.token,
  }).then((observed) => {
    const comparable = (value) => ({
      evidenceType: value.evidenceType,
      repository: value.repository,
      headSha: value.headSha,
      runIds: value.runIds,
      runAttempts: value.runAttempts,
      startedAt: value.startedAt,
      completedAt: value.completedAt,
      conclusion: value.conclusion,
      failureClass: value.failureClass,
      annotationDigest: value.annotationDigest,
      checkRuns: value.checkRuns,
      artifacts: value.artifacts,
      requiredCheckSetDigest: value.requiredCheckSetDigest,
      artifactDigest: value.artifactDigest,
    });
    if (canonicalJson(comparable(serialized)) !== canonicalJson(comparable(observed))) {
      throw new Error('serialized_github_receipt_reobservation_mismatch');
    }
    return observed;
  });
}

export function createFixtureGithubEvidence(observation = {}) {
  const receipt = buildRemoteReceipt(observation, { testMode: true, observationSource: 'explicit_test_collector' });
  FIXTURE_REMOTE_RECEIPTS.add(receipt);
  return receipt;
}

function finalDecisionPayload(receipt) {
  const { signature: ignoredSignature, receiptDigest: ignoredDigest, ...payload } = receipt;
  return payload;
}

export function verifySignedFinalDecisionReceipt(serializedReceipt, { publicKeyPem } = {}) {
  const receipt = structuredClone(serializedReceipt);
  if (!publicKeyPem) throw new Error('final_decision_public_key_required');
  if (receipt.signatureAlgorithm !== 'ed25519' || typeof receipt.signature !== 'string') throw new Error('final_decision_signature_metadata_invalid');
  const payload = finalDecisionPayload(receipt);
  const valid = crypto.verify(null, Buffer.from(canonicalJson(payload)), publicKeyPem, Buffer.from(receipt.signature, 'base64'));
  if (!valid) throw new Error('final_decision_signature_invalid');
  if (receipt.receiptDigest !== sha256(canonicalJson({ ...payload, signature: receipt.signature }))) throw new Error('final_decision_digest_invalid');
  VERIFIED_FINAL_DECISION_RECEIPTS.add(receipt);
  return receipt;
}

export function createFixtureFinalDecision(observation = {}) {
  const receipt = {
    evidenceType: 'final_decision_authorization',
    trustClass: 'explicit_test_fixture',
    testMode: true,
    observationSource: 'explicit_test_final_decision',
    authority: observation.authority,
    decision: observation.decision,
    decisionId: String(observation.decisionId || ''),
    repository: String(observation.repository || ''),
    headSha: String(observation.headSha || '').toLowerCase(),
    observedAt: observation.observedAt,
  };
  receipt.receiptDigest = sha256(canonicalJson(receipt));
  FIXTURE_FINAL_DECISION_RECEIPTS.add(receipt);
  return receipt;
}

export function evaluateRemoteEvidence(receipt, expected = {}) {
  if (receipt == null) return baseRemoteProjection('not_observed');

  const reasons = collectForbiddenBooleanClaims(receipt).map((path) => `authority_boolean_forbidden:${path}`);
  const productionTrusted = API_OBSERVED_REMOTE_RECEIPTS.has(receipt) && receipt.testMode === false;
  const fixtureTrusted = FIXTURE_REMOTE_RECEIPTS.has(receipt) && receipt.testMode === true && expected.testMode === true;
  if (!productionTrusted && !fixtureTrusted) reasons.push('remote_receipt_not_api_observed_or_reobserved');
  if (receipt.testMode === true && expected.testMode !== true) reasons.push('fixture_receipt_forbidden_outside_test_mode');
  if (receipt.collectorVersion !== V132_GITHUB_COLLECTOR_VERSION) reasons.push('remote_collector_version_invalid');
  if (receipt.receiptPayloadDigest !== sha256(canonicalJson(remoteReceiptPayload(receipt)))) reasons.push('remote_receipt_payload_digest_invalid');
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
  const runAttempts = Array.isArray(receipt.runAttempts) ? receipt.runAttempts : [];
  if (runAttempts.length !== receipt.runIds?.length
    || runAttempts.some((item) => !receipt.runIds.includes(item.runId) || !Number.isInteger(item.runAttempt) || item.runAttempt < 1)
    || new Set(runAttempts.map((item) => item.runId)).size !== runAttempts.length) reasons.push('remote_run_attempts_invalid');
  if (expected.runId && !receipt.runIds?.includes(Number(expected.runId))) reasons.push('remote_run_id_mismatch');
  if (expected.runAttempt && runAttempts.find((item) => item.runId === Number(expected.runId || receipt.runIds?.[0]))?.runAttempt !== Number(expected.runAttempt)) reasons.push('remote_run_attempt_mismatch');
  if (!['github_api_verified_collector', 'explicit_test_collector'].includes(receipt.observationSource)) reasons.push('remote_observation_source_invalid');
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
  const observedCheckNames = [...new Set(checkRuns.map((check) => check.name))].sort();
  const expectedCheckNames = [...new Set(expected.requiredCheckNames || [])].sort();
  if (expectedCheckNames.length && canonicalJson(observedCheckNames) !== canonicalJson(expectedCheckNames)) reasons.push('required_check_name_set_mismatch');
  if (!DIGEST_RE.test(requiredCheckSetDigest)) reasons.push('required_check_set_digest_invalid');
  const derivedCheckSetDigest = sha256(canonicalJson(normalizedCheckRuns(checkRuns, headSha).map(({ checkRunId, name, conclusion, headSha: checkHeadSha }) => ({ checkRunId, name, conclusion, headSha: checkHeadSha }))));
  if (requiredCheckSetDigest !== derivedCheckSetDigest) reasons.push('required_check_set_digest_not_derived');
  if (expectedCheckSetDigest && requiredCheckSetDigest !== expectedCheckSetDigest) reasons.push('required_check_set_digest_mismatch');
  if (!DIGEST_RE.test(artifactDigest)) reasons.push('artifact_digest_missing_or_invalid');
  const derivedArtifactDigest = sha256(canonicalJson(normalizedArtifacts(receipt.artifacts)));
  if (artifactDigest !== derivedArtifactDigest) reasons.push('artifact_digest_not_derived');
  if (expectedArtifactDigest && artifactDigest !== expectedArtifactDigest) reasons.push('artifact_digest_mismatch');
  const artifacts = Array.isArray(receipt.artifacts) ? receipt.artifacts : [];
  if (!artifacts.length) reasons.push('artifact_records_missing');
  for (const [index, artifact] of artifacts.entries()) {
    if (!Number.isInteger(artifact.artifactId) || artifact.artifactId < 1) reasons.push(`artifact_${index}_id_invalid`);
    if (!artifact.name || typeof artifact.name !== 'string') reasons.push(`artifact_${index}_name_invalid`);
    if (!Number.isInteger(artifact.sizeInBytes) || artifact.sizeInBytes < 0) reasons.push(`artifact_${index}_size_invalid`);
    if (!DIGEST_RE.test(String(artifact.contentDigest || ''))) reasons.push(`artifact_${index}_content_digest_missing`);
  }
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
  let productionTrusted = VERIFIED_FINAL_DECISION_RECEIPTS.has(receipt) && receipt.testMode === false;
  if (!productionTrusted && receipt.testMode !== true && expected.finalDecisionPublicKeyPem) {
    try {
      verifySignedFinalDecisionReceipt(receipt, { publicKeyPem: expected.finalDecisionPublicKeyPem });
      productionTrusted = true;
    } catch {
      productionTrusted = false;
    }
  }
  const fixtureTrusted = FIXTURE_FINAL_DECISION_RECEIPTS.has(receipt) && receipt.testMode === true && expected.testMode === true;
  if (!productionTrusted && !fixtureTrusted) reasons.push('final_decision_receipt_not_signature_verified');
  if (receipt.testMode === true && expected.testMode !== true) reasons.push('fixture_final_decision_forbidden_outside_test_mode');
  if (!['final_decision_kernel_verified', 'explicit_test_final_decision'].includes(receipt.observationSource)) reasons.push('final_decision_observation_source_invalid');
  if (receipt.evidenceType !== 'final_decision_authorization') reasons.push('final_decision_receipt_type_invalid');
  if (receipt.authority !== V132_FINAL_AUTHORITY) reasons.push('final_decision_authority_invalid');
  if (receipt.decision !== 'allow_merge') reasons.push('final_decision_not_allow_merge');
  if (!/^[A-Za-z0-9_.:-]{8,128}$/.test(String(receipt.decisionId || ''))) reasons.push('final_decision_id_invalid');
  if (!SHA_RE.test(String(receipt.headSha || '').toLowerCase())) reasons.push('final_decision_head_invalid');
  if (expected.headSha && String(receipt.headSha || '').toLowerCase() !== String(expected.headSha).toLowerCase()) reasons.push('final_decision_head_mismatch');
  if (expected.repository && receipt.repository !== expected.repository) reasons.push('final_decision_repository_mismatch');
  const suppliedDigest = String(receipt.receiptDigest || '');
  const { receiptDigest: ignoredDigest, ...decisionPayload } = receipt;
  if (!DIGEST_RE.test(suppliedDigest) || suppliedDigest !== sha256(canonicalJson(decisionPayload))) reasons.push('final_decision_digest_invalid');
  if (!validRfc3339(receipt.observedAt)) reasons.push('final_decision_timestamp_invalid');
  return {
    status: reasons.length ? 'fail' : 'pass',
    finalDecisionState: reasons.length ? 'not_authorized' : 'authorized',
    reasonCodes: reasons,
    createsAuthority: false,
  };
}

export function validateCanonicalState(state = {}) {
  const reasons = [];
  const local = state.localValidationState;
  const remote = state.remoteValidationState;
  const technical = state.technicalMergeEligibility;
  const finalDecision = state.finalDecisionState;
  const remoteEvidenceStatus = state.remoteEvidence?.status || state.remoteEvidenceStatus || 'not_observed';
  const sameHeadState = state.remoteEvidence?.sameHeadState || state.sameHeadState || 'not_observed';
  const requiredCheckSetState = state.remoteEvidence?.requiredCheckSetState || state.requiredCheckSetState || 'not_observed';
  const artifactIntegrityState = state.remoteEvidence?.artifactIntegrityState || state.artifactIntegrityState || 'not_observed';
  const finalDecisionEvidenceStatus = state.finalDecisionEvidence?.status || state.finalDecisionEvidenceStatus || 'not_observed';
  if (!['passed', 'failed'].includes(local)) reasons.push('canonical_local_validation_state_invalid');
  if (!V132_REMOTE_VALIDATION_STATES.includes(remote)) reasons.push('canonical_remote_validation_state_invalid');
  if (!['eligible', 'blocked'].includes(technical)) reasons.push('canonical_technical_eligibility_invalid');
  if (!['authorized', 'not_authorized'].includes(finalDecision)) reasons.push('canonical_final_decision_state_invalid');
  if (typeof state.mergeAllowed !== 'boolean') reasons.push('canonical_merge_allowed_invalid');

  const technicalConjunction = local === 'passed'
    && remote === 'passed'
    && remoteEvidenceStatus === 'pass'
    && sameHeadState === 'matched'
    && requiredCheckSetState === 'matched'
    && artifactIntegrityState === 'verified';
  if ((technical === 'eligible') !== technicalConjunction) reasons.push('canonical_technical_eligibility_contradiction');
  if (finalDecision === 'authorized' && finalDecisionEvidenceStatus !== 'pass') reasons.push('canonical_final_decision_without_trusted_evidence');
  const mergeConjunction = technicalConjunction && finalDecision === 'authorized' && finalDecisionEvidenceStatus === 'pass';
  if (state.mergeAllowed !== mergeConjunction) reasons.push('canonical_merge_allowed_contradiction');
  if (remote !== 'passed' && technical === 'eligible') reasons.push('canonical_nonpassed_remote_technically_eligible');
  return { status: reasons.length ? 'fail' : 'pass', reasonCodes: [...new Set(reasons)], authorityCreated: false };
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
  const state = {
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
  state.canonicalStateValidation = validateCanonicalState(state);
  return state;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = Number(process.argv.find((arg) => arg.startsWith('--github-run-id='))?.slice(16) || 0);
  const repository = process.argv.find((arg) => arg.startsWith('--repository='))?.slice(13);
  if (runId) {
    const receipt = await collectVerifiedGithubEvidence({ repository, runId, token: process.env.GITHUB_TOKEN });
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log(JSON.stringify(deriveCanonicalState({ localValidationPassed: true }), null, 2));
  }
}
