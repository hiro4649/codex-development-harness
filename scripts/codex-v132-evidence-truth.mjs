#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import crypto from 'node:crypto';
import zlib from 'node:zlib';

export const V132_VERSION = '1.3.2';
export const V132_FINAL_AUTHORITY = 'v1.1.8_final_decision_kernel';
export const V132_REMOTE_VALIDATION_STATES = Object.freeze([
  'not_observed',
  'unavailable_billing',
  'unavailable_pre_runner',
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
const ACCEPTED_MAIN_TRUST_ROOTS = new WeakSet();
const FIXTURE_TRUST_ROOTS = new WeakSet();
const FIXTURE_REMOTE_RECEIPTS = new WeakSet();
const FIXTURE_FINAL_DECISION_RECEIPTS = new WeakSet();
const FIXTURE_GITHUB_HTTP_CLIENTS = new WeakSet();
export const V132_GITHUB_COLLECTOR_VERSION = 'v132-github-collector-7';
export const V132_TRUST_ROOT_PATH = 'docs/process/CODEX_V132_TRUST_ROOT.json';
export const V132_SOURCE_REPOSITORY = 'hiro4649/codex-development-harness';
export const V132_SOURCE_DEFAULT_BRANCH = 'main';
export const V132_ARTIFACT_LIMITS = Object.freeze({
  archiveBytes: 8 * 1024 * 1024,
  payloadBytes: 256 * 1024,
  entryCount: 64,
});

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value)).digest('hex')}`;
}

export function calculateMergeContextDigest({
  repository,
  pullRequestNumber,
  baseSha,
  headSha,
  acceptedMainTrustRootDigest,
} = {}) {
  return sha256(canonicalJson({
    repository: String(repository || ''),
    pullRequestNumber: Number(pullRequestNumber),
    baseSha: String(baseSha || '').toLowerCase(),
    headSha: String(headSha || '').toLowerCase(),
    acceptedMainTrustRootDigest: String(acceptedMainTrustRootDigest || ''),
  }));
}

export function createFixtureGithubHttpClient(fetchImplementation) {
  if (typeof fetchImplementation !== 'function') throw new Error('fixture_github_fetch_required');
  const client = Object.freeze({ fetch: fetchImplementation });
  FIXTURE_GITHUB_HTTP_CLIENTS.add(client);
  return client;
}

function githubFetch(httpClient) {
  if (httpClient == null) return globalThis.fetch;
  if (!FIXTURE_GITHUB_HTTP_CLIENTS.has(httpClient)) throw new Error('untrusted_github_http_client_forbidden');
  return httpClient.fetch;
}

function githubHttpFixtureMode(httpClient) {
  return FIXTURE_GITHUB_HTTP_CLIENTS.has(httpClient);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sha256Bytes(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

export function publicKeyFingerprint(publicKeyPem) {
  const key = crypto.createPublicKey(publicKeyPem);
  return sha256Bytes(key.export({ type: 'spki', format: 'der' }));
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

function normalizeAppId(value) {
  return value == null ? null : (Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null);
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
    observedBaseSha: null,
    baseAncestryState: 'not_observed',
    mergeContextDigest: null,
    remoteEvidenceObserved: false,
    reasonCodes,
    createsAuthority: false,
  };
}

function normalizedCheckRuns(checkRuns = [], headSha = '') {
  return checkRuns.map((check) => ({
    checkRunId: Number(check.checkRunId),
    name: String(check.name || ''),
    appId: normalizeAppId(check.appId),
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
    workflowPath: String(artifact.workflowPath || ''),
    entryPath: String(artifact.entryPath || ''),
    schemaVersion: String(artifact.schemaVersion || ''),
    semanticDigest: String(artifact.semanticDigest || ''),
    boundValues: artifact.boundValues && typeof artifact.boundValues === 'object' ? artifact.boundValues : {},
    valueBindingDigest: String(artifact.valueBindingDigest || ''),
  })).sort((a, b) => a.name.localeCompare(b.name) || a.artifactId - b.artifactId);
}

function normalizedWorkflowRuns(workflowRuns = []) {
  return workflowRuns.map((run) => ({
    runId: Number(run.runId),
    runNumber: Number.isInteger(Number(run.runNumber)) ? Number(run.runNumber) : Number(run.runId),
    runAttempt: Number(run.runAttempt),
    workflowId: Number(run.workflowId),
    workflowPath: String(run.workflowPath || ''),
    event: String(run.event || ''),
    pullRequestNumber: Number(run.pullRequestNumber),
    baseSha: String(run.baseSha || '').toLowerCase(),
    headSha: String(run.headSha || '').toLowerCase(),
    status: String(run.status || (run.conclusion ? 'completed' : '')),
    conclusion: String(run.conclusion || ''),
    createdAt: String(run.createdAt || run.startedAt || ''),
    updatedAt: String(run.updatedAt || run.completedAt || ''),
    workflowContentDigest: String(run.workflowContentDigest || ''),
    reusableWorkflowRefs: [...new Set(run.reusableWorkflowRefs || [])].map(String).sort(),
    rulesetBinding: run.rulesetBinding ? {
      path: String(run.rulesetBinding.path || ''),
      ref: String(run.rulesetBinding.ref || ''),
      sha: String(run.rulesetBinding.sha || '').toLowerCase(),
      repositoryId: Number(run.rulesetBinding.repositoryId) || null,
    } : null,
  })).sort((a, b) => a.runId - b.runId);
}

function trustRootDocument(root) {
  return root?.document && typeof root.document === 'object' ? root.document : null;
}

function validateTrustDocumentShape(document, expected = {}) {
  const reasons = [];
  if (document?.schemaVersion !== V132_VERSION) reasons.push('trust_root_schema_invalid');
  if (document?.trustRootVersion !== '1') reasons.push('trust_root_version_invalid');
  if (document?.state !== 'active') reasons.push('trust_root_not_active');
  if (document?.authority !== 'accepted_main_only') reasons.push('trust_root_authority_invalid');
  if (document?.repository !== expected.repository) reasons.push('trust_root_repository_mismatch');
  if (document?.defaultBranch !== (expected.defaultBranch || V132_SOURCE_DEFAULT_BRANCH)) reasons.push('trust_root_default_branch_mismatch');
  if (Object.hasOwn(document || {}, 'acceptedMainSha')) reasons.push('trust_root_self_referential_sha_forbidden');
  const key = document?.finalDecisionKey || {};
  if (!/^[A-Za-z0-9_.:-]{8,128}$/.test(String(key.keyId || ''))) reasons.push('trust_root_key_id_invalid');
  if (key.state !== 'active') reasons.push('trust_root_key_not_active');
  if (!DIGEST_RE.test(String(key.publicKeyFingerprint || ''))) reasons.push('trust_root_key_fingerprint_invalid');
  if (typeof key.publicKeyPem !== 'string') reasons.push('trust_root_public_key_missing');
  else {
    try {
      if (publicKeyFingerprint(key.publicKeyPem) !== key.publicKeyFingerprint) reasons.push('trust_root_public_key_fingerprint_mismatch');
    } catch {
      reasons.push('trust_root_public_key_invalid');
    }
  }
  if (!Array.isArray(document?.revokedKeyIds)) reasons.push('trust_root_revocation_list_invalid');
  if (document?.revokedKeyIds?.includes(key.keyId)) reasons.push('trust_root_active_key_revoked');
  if (!['stable', 'rotation_pending'].includes(document?.keyRotation?.state)) reasons.push('trust_root_rotation_state_invalid');
  const artifacts = document?.artifactContract?.requiredArtifacts;
  if (!Array.isArray(artifacts) || !artifacts.length) reasons.push('trust_root_artifact_contract_missing');
  for (const [index, artifact] of (artifacts || []).entries()) {
    if (!artifact.name || !artifact.workflowPath || !artifact.entryPath || !artifact.schemaVersion) reasons.push(`trust_root_artifact_${index}_invalid`);
    if (!Array.isArray(artifact.requiredFields)) reasons.push(`trust_root_artifact_${index}_required_fields_invalid`);
    if (!artifact.requiredFieldValues || typeof artifact.requiredFieldValues !== 'object' || Array.isArray(artifact.requiredFieldValues)) {
      reasons.push(`trust_root_artifact_${index}_required_values_invalid`);
    } else {
      for (const field of ['repository', 'headSha', 'status']) {
        if (!Object.hasOwn(artifact.requiredFieldValues, field)) reasons.push(`trust_root_artifact_${index}_required_value_${field}_missing`);
        if (!artifact.requiredFields?.includes(field)) reasons.push(`trust_root_artifact_${index}_required_field_${field}_missing`);
      }
      if (artifact.requiredFieldValues.repository !== '$repository') reasons.push(`trust_root_artifact_${index}_repository_binding_invalid`);
      if (artifact.requiredFieldValues.headSha !== '$headSha') reasons.push(`trust_root_artifact_${index}_head_binding_invalid`);
      if (artifact.requiredFieldValues.status !== 'pass') reasons.push(`trust_root_artifact_${index}_status_binding_invalid`);
    }
  }
  const workflows = document?.workflowContract?.requiredWorkflows;
  if (!Array.isArray(workflows) || !workflows.length) reasons.push('trust_root_workflow_contract_missing');
  const workflowIdentities = new Set();
  for (const [index, workflow] of (workflows || []).entries()) {
    if (!Number.isInteger(workflow.workflowId) || workflow.workflowId < 1 || !/^\.github\/workflows\/[^/]+\.ya?ml$/i.test(String(workflow.path || ''))) {
      reasons.push(`trust_root_workflow_${index}_invalid`);
    }
    if (!DIGEST_RE.test(String(workflow.workflowContentDigest || ''))) reasons.push(`trust_root_workflow_${index}_content_digest_invalid`);
    const identity = `${Number(workflow.workflowId)}:${String(workflow.path || '')}`;
    if (workflowIdentities.has(identity)) reasons.push(`trust_root_workflow_${index}_duplicate`);
    workflowIdentities.add(identity);
    if (workflow.reusableWorkflowRef != null && !/^[^\s@]+\/\.github\/workflows\/[^\s@]+@[^\s@]+$/.test(String(workflow.reusableWorkflowRef))) {
      reasons.push(`trust_root_workflow_${index}_reusable_ref_invalid`);
    }
    if (workflow.rulesetBinding != null) {
      const binding = workflow.rulesetBinding;
      if (binding.path !== workflow.path) reasons.push(`trust_root_workflow_${index}_ruleset_path_mismatch`);
      if (binding.ref && !String(binding.ref).startsWith('refs/')) reasons.push(`trust_root_workflow_${index}_ruleset_ref_invalid`);
      if (!SHA_RE.test(String(binding.sha || '').toLowerCase())) reasons.push(`trust_root_workflow_${index}_ruleset_sha_invalid`);
      if (!Number.isInteger(Number(binding.repositoryId)) || Number(binding.repositoryId) < 1) reasons.push(`trust_root_workflow_${index}_ruleset_repository_invalid`);
    }
  }
  const workflowPaths = new Set((workflows || []).map((workflow) => workflow.path));
  for (const [index, artifact] of (artifacts || []).entries()) {
    if (artifact.workflowPath && !workflowPaths.has(artifact.workflowPath)) reasons.push(`trust_root_artifact_${index}_workflow_unknown`);
  }
  return { status: reasons.length ? 'fail' : 'pass', reasonCodes: reasons };
}

export function effectiveTrustRootDigest(root = {}) {
  return sha256(canonicalJson({
    document: trustRootDocument(root),
    trustSourceRepository: root.trustSourceRepository,
    trustSourceDefaultBranch: root.trustSourceDefaultBranch,
    trustSourceHeadSha: root.trustSourceHeadSha,
    trustSourceBlobSha: root.trustSourceBlobSha,
    trustSourcePath: root.trustSourcePath,
  }));
}

export function validateObservedTrustRootEnvelope(root, expected = {}) {
  const reasons = [];
  const document = trustRootDocument(root);
  if (root?.envelopeVersion !== V132_VERSION) reasons.push('trust_root_envelope_version_invalid');
  if (!document) reasons.push('trust_root_document_missing');
  else reasons.push(...validateTrustDocumentShape(document, expected).reasonCodes);
  if (!['accepted_main_github_api', 'github_api_mock_fixture', 'explicit_test_fixture'].includes(root?.trustSource)) reasons.push('trust_root_source_invalid');
  if (root?.trustSourceRepository !== expected.repository || root?.trustSourceRepository !== document?.repository) reasons.push('trust_root_source_repository_mismatch');
  if (!Number.isInteger(Number(root?.trustSourceRepositoryId)) || Number(root.trustSourceRepositoryId) < 1) reasons.push('trust_root_source_repository_id_invalid');
  if (root?.trustSourceDefaultBranch !== (expected.defaultBranch || V132_SOURCE_DEFAULT_BRANCH)
    || root?.trustSourceDefaultBranch !== document?.defaultBranch) reasons.push('trust_root_source_default_branch_mismatch');
  if (!SHA_RE.test(String(root?.trustSourceHeadSha || '').toLowerCase())) reasons.push('trust_root_source_head_invalid');
  if (expected.headSha && String(root?.trustSourceHeadSha || '').toLowerCase() !== String(expected.headSha).toLowerCase()) reasons.push('trust_root_source_head_mismatch');
  if (!SHA_RE.test(String(root?.trustSourceBlobSha || '').toLowerCase())) reasons.push('trust_root_source_blob_invalid');
  if (root?.trustSourcePath !== V132_TRUST_ROOT_PATH) reasons.push('trust_root_source_path_mismatch');
  if (!DIGEST_RE.test(String(root?.trustSourceProtectionStableDigest || ''))) reasons.push('trust_root_source_protection_digest_invalid');
  if (!validRfc3339(root?.observedAt)) reasons.push('trust_root_observed_at_invalid');
  if (!DIGEST_RE.test(String(root?.effectiveTrustRootDigest || ''))
    || root.effectiveTrustRootDigest !== effectiveTrustRootDigest(root)) reasons.push('trust_root_effective_digest_invalid');
  return { status: reasons.length ? 'fail' : 'pass', reasonCodes: [...new Set(reasons)] };
}

function trustRootAccepted(root, testMode) {
  return testMode === true ? FIXTURE_TRUST_ROOTS.has(root) : ACCEPTED_MAIN_TRUST_ROOTS.has(root);
}

function remoteReceiptPayload(receipt) {
  const { receiptPayloadDigest: ignored, ...payload } = receipt;
  return payload;
}

function pullRequestBindingPayload(binding = {}) {
  return {
    source: binding.source,
    repository: binding.repository,
    pullRequestNumber: Number(binding.pullRequestNumber),
    state: binding.state,
    baseRef: binding.baseRef,
    baseSha: String(binding.baseSha || '').toLowerCase(),
    headRef: binding.headRef,
    headSha: String(binding.headSha || '').toLowerCase(),
  };
}

function buildPullRequestBinding(binding = {}) {
  const normalized = {
    ...pullRequestBindingPayload(binding),
    observedAt: binding.observedAt,
  };
  normalized.stableDigest = sha256(canonicalJson(pullRequestBindingPayload(normalized)));
  return normalized;
}

function baseAncestryPayload(observation = {}) {
  return {
    source: observation.source,
    repository: observation.repository,
    pullRequestNumber: Number(observation.pullRequestNumber),
    observedBaseSha: String(observation.observedBaseSha || '').toLowerCase(),
    checkedHeadSha: String(observation.checkedHeadSha || '').toLowerCase(),
    compareStatus: String(observation.compareStatus || ''),
    mergeBaseSha: String(observation.mergeBaseSha || '').toLowerCase(),
    state: observation.state,
  };
}

function buildBaseAncestryObservation(observation = {}) {
  const normalized = {
    ...baseAncestryPayload(observation),
    observedAt: observation.observedAt,
  };
  normalized.stableDigest = sha256(canonicalJson(baseAncestryPayload(normalized)));
  return normalized;
}

function workflowDiscoveryPayload(discovery = {}) {
  return {
    source: discovery.source,
    repository: discovery.repository,
    pullRequestNumber: Number(discovery.pullRequestNumber),
    headSha: String(discovery.headSha || '').toLowerCase(),
    observedRunCount: Number(discovery.observedRunCount),
    missingWorkflowIdentities: [...new Set(discovery.missingWorkflowIdentities || [])].map(String).sort(),
    selectedRuns: [...(discovery.selectedRuns || [])].map((run) => ({
      workflowId: Number(run.workflowId),
      workflowPath: String(run.workflowPath || ''),
      runId: Number(run.runId),
      runNumber: Number(run.runNumber),
      runAttempt: Number(run.runAttempt),
      status: String(run.status || (run.conclusion ? 'completed' : '')),
      conclusion: String(run.conclusion || ''),
      headSha: String(run.headSha || '').toLowerCase(),
    })).sort((a, b) => a.workflowPath.localeCompare(b.workflowPath) || a.workflowId - b.workflowId),
  };
}

function buildWorkflowDiscovery(discovery = {}) {
  const normalized = {
    ...workflowDiscoveryPayload(discovery),
    hintRunIds: [...new Set(discovery.hintRunIds || [])].map(Number).filter(Number.isInteger).sort((a, b) => a - b),
    observedAt: discovery.observedAt,
  };
  normalized.stableDigest = sha256(canonicalJson(workflowDiscoveryPayload(normalized)));
  return normalized;
}

function buildRemoteReceipt(observation = {}, { testMode = false, observationSource } = {}) {
  const headSha = String(observation.headSha || '').toLowerCase();
  const checkRuns = normalizedCheckRuns(observation.checkRuns, headSha);
  const artifacts = normalizedArtifacts(observation.artifacts);
  const workflowRuns = normalizedWorkflowRuns(observation.workflowRuns || []);
  const runIds = (observation.runIds || [observation.runId]).map(Number).filter(Number.isInteger).sort((a, b) => a - b);
  const runAttempts = (observation.runAttempts || [{ runId: observation.runId, runAttempt: observation.runAttempt }])
    .map((item) => ({ runId: Number(item.runId), runAttempt: Number(item.runAttempt) }))
    .sort((a, b) => a.runId - b.runId);
  const trustedCheckNames = new Set((observation.requiredCheckTrustRoot?.requiredChecks || [])
    .map((entry) => entry.name));
  const requiredCheckRuns = checkRuns.filter((check) => trustedCheckNames.has(check.name));
  const pullRequestBinding = observation.pullRequestBinding || buildPullRequestBinding({
    source: testMode ? 'explicit_test_current_pr' : 'github_api_current_pr',
    repository: observation.repository,
    pullRequestNumber: observation.pullRequestNumber,
    state: 'open',
    baseRef: observation.baseRef,
    baseSha: observation.baseSha,
    headRef: observation.headRef || 'candidate',
    headSha,
    observedAt: observation.observedAt,
  });
  const baseAncestry = observation.baseAncestry || (testMode ? buildBaseAncestryObservation({
    source: 'explicit_test_compare_api',
    repository: observation.repository,
    pullRequestNumber: observation.pullRequestNumber,
    observedBaseSha: observation.baseSha,
    checkedHeadSha: headSha,
    compareStatus: 'ahead',
    mergeBaseSha: observation.baseSha,
    state: 'matched',
    observedAt: observation.observedAt,
  }) : null);
  const acceptedMainTrustRootDigest = String(observation.acceptedMainTrustRootDigest
    || (observation.acceptedMainTrustRoot ? trustRootContractDigest(observation.acceptedMainTrustRoot) : ''));
  const mergeContextDigest = calculateMergeContextDigest({
    repository: observation.repository,
    pullRequestNumber: observation.pullRequestNumber,
    baseSha: observation.baseSha,
    headSha,
    acceptedMainTrustRootDigest,
  });
  const workflowRunDiscovery = observation.workflowRunDiscovery || buildWorkflowDiscovery({
    source: testMode ? 'explicit_test_current_pr_exact_head' : 'github_api_current_pr_exact_head',
    repository: observation.repository,
    pullRequestNumber: observation.pullRequestNumber,
    headSha,
    observedRunCount: workflowRuns.length,
    hintRunIds: observation.hintRunIds || [],
    missingWorkflowIdentities: observation.missingWorkflowIdentities || [],
    selectedRuns: workflowRuns,
    observedAt: observation.observedAt,
  });
  const receipt = {
    evidenceType: ['account_billing_lock', 'pre_runner_unavailable'].includes(observation.failureClass)
      ? 'github_job_not_started'
      : 'github_required_check_set',
    trustClass: testMode ? 'explicit_test_fixture' : 'github_api_reobserved',
    testMode,
    collectorVersion: V132_GITHUB_COLLECTOR_VERSION,
    repository: String(observation.repository || ''),
    pullRequestNumber: Number(observation.pullRequestNumber),
    pullRequestBinding,
    baseAncestry,
    observedBaseSha: String(baseAncestry?.observedBaseSha || '').toLowerCase(),
    baseAncestryState: baseAncestry?.state || 'not_observed',
    acceptedMainTrustRootDigest,
    mergeContextDigest,
    event: String(observation.event || ''),
    baseRef: String(observation.baseRef || ''),
    baseSha: String(observation.baseSha || '').toLowerCase(),
    headSha,
    runIds,
    runAttempts,
    workflowRuns,
    workflowRunDiscovery,
    observationSource,
    startedAt: observation.startedAt,
    completedAt: observation.completedAt,
    observedAt: observation.observedAt,
    runStatus: String(observation.runStatus || (observation.conclusion ? 'completed' : '')),
    conclusion: observation.conclusion,
    failureClass: observation.failureClass || null,
    observationErrors: [...new Set(observation.observationErrors || [])].map(String).sort(),
    annotationDigest: observation.annotationText ? sha256(String(observation.annotationText)) : null,
    checkRuns,
    artifacts,
    requiredCheckTrustRoot: observation.requiredCheckTrustRoot || null,
    requiredArtifactContractDigest: String(observation.requiredArtifactContractDigest || ''),
    requiredWorkflowContractDigest: String(observation.requiredWorkflowContractDigest || ''),
    requiredCheckSetDigest: sha256(canonicalJson(requiredCheckRuns.map(({ checkRunId, name, appId, conclusion, headSha: checkHeadSha }) => ({ checkRunId, name, appId, conclusion, headSha: checkHeadSha })))),
    artifactDigest: sha256(canonicalJson(artifacts)),
  };
  receipt.receiptPayloadDigest = sha256(canonicalJson(remoteReceiptPayload(receipt)));
  return receipt;
}

async function githubJson(url, token, { allowNotFound = false, httpClient = null } = {}) {
  const response = await githubFetch(httpClient)(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'codex-v132-evidence-collector',
    },
  });
  if (allowNotFound && response.status === 404) return null;
  if (!response.ok) throw new Error(`github_api_observation_failed:${response.status}:${url}`);
  return response.json();
}

async function githubText(url, token, { httpClient = null } = {}) {
  const response = await githubFetch(httpClient)(url, {
    headers: {
      Accept: 'application/vnd.github.raw+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'codex-v132-trust-root-collector',
    },
  });
  if (!response.ok) throw new Error(`github_trust_root_observation_failed:${response.status}`);
  return response.text();
}

async function observeCurrentPullRequest({ repository, pullRequestNumber, token, httpClient = null } = {}) {
  if (!Number.isInteger(Number(pullRequestNumber)) || Number(pullRequestNumber) < 1) throw new Error('github_pull_request_locator_invalid');
  const observedAt = new Date().toISOString();
  const pullRequest = await githubJson(`https://api.github.com/repos/${repository}/pulls/${Number(pullRequestNumber)}`, token, { httpClient });
  const baseRepository = String(pullRequest?.base?.repo?.full_name || '');
  const headSha = String(pullRequest?.head?.sha || '').toLowerCase();
  const baseSha = String(pullRequest?.base?.sha || '').toLowerCase();
  if (Number(pullRequest?.number) !== Number(pullRequestNumber)) throw new Error('github_pull_request_number_observation_mismatch');
  if (baseRepository !== repository) throw new Error('github_pull_request_repository_observation_mismatch');
  if (pullRequest?.state !== 'open' || pullRequest?.merged === true) throw new Error('github_pull_request_not_open');
  if (!SHA_RE.test(headSha) || !SHA_RE.test(baseSha)) throw new Error('github_pull_request_head_or_base_invalid');
  if (!pullRequest?.base?.ref || !pullRequest?.head?.ref) throw new Error('github_pull_request_ref_observation_missing');
  const binding = buildPullRequestBinding({
    source: githubHttpFixtureMode(httpClient) ? 'github_api_mock_current_pr' : 'github_api_current_pr',
    repository,
    pullRequestNumber,
    state: pullRequest.state,
    baseRef: String(pullRequest.base?.ref || ''),
    baseSha,
    headRef: String(pullRequest.head?.ref || ''),
    headSha,
    observedAt,
  });
  return { pullRequest, binding };
}

async function observeCurrentBaseAncestry({ repository, pullRequestBinding, token, httpClient = null } = {}) {
  const baseSha = String(pullRequestBinding?.baseSha || '').toLowerCase();
  const headSha = String(pullRequestBinding?.headSha || '').toLowerCase();
  if (!SHA_RE.test(baseSha) || !SHA_RE.test(headSha)) throw new Error('github_compare_base_or_head_invalid');
  const comparison = await githubJson(
    `https://api.github.com/repos/${repository}/compare/${baseSha}...${headSha}`,
    token,
    { httpClient },
  );
  const compareStatus = String(comparison?.status || '');
  const observedBaseSha = String(comparison?.base_commit?.sha || '').toLowerCase();
  const mergeBaseSha = String(comparison?.merge_base_commit?.sha || '').toLowerCase();
  if (!['ahead', 'behind', 'diverged', 'identical'].includes(compareStatus)) throw new Error('github_compare_status_invalid');
  if (!SHA_RE.test(observedBaseSha) || observedBaseSha !== baseSha) throw new Error('github_compare_base_commit_mismatch');
  if (!SHA_RE.test(mergeBaseSha)) throw new Error('github_compare_merge_base_invalid');
  return buildBaseAncestryObservation({
    source: githubHttpFixtureMode(httpClient) ? 'github_compare_api_mock' : 'github_compare_api',
    repository,
    pullRequestNumber: pullRequestBinding.pullRequestNumber,
    observedBaseSha,
    checkedHeadSha: headSha,
    compareStatus,
    mergeBaseSha,
    state: ['ahead', 'identical'].includes(compareStatus) && mergeBaseSha === baseSha ? 'matched' : 'mismatch',
    observedAt: new Date().toISOString(),
  });
}

function latestWorkflowRun(candidates = []) {
  return [...candidates].sort((a, b) => {
    const runNumber = Number(b.run_number || 0) - Number(a.run_number || 0);
    if (runNumber) return runNumber;
    const attempt = Number(b.run_attempt || 0) - Number(a.run_attempt || 0);
    if (attempt) return attempt;
    const updated = Date.parse(b.updated_at || b.created_at || 0) - Date.parse(a.updated_at || a.created_at || 0);
    if (updated) return updated;
    return Number(b.id || 0) - Number(a.id || 0);
  })[0] || null;
}

async function discoverCurrentPullRequestWorkflowRuns({
  repository,
  pullRequestBinding,
  workflowContract,
  hintRunIds = [],
  token,
  httpClient = null,
} = {}) {
  const allRuns = [];
  for (let page = 1; page <= 10; page += 1) {
    const query = new URLSearchParams({
      event: 'pull_request',
      head_sha: pullRequestBinding.headSha,
      exclude_pull_requests: 'false',
      per_page: '100',
      page: String(page),
    });
    const response = await githubJson(`https://api.github.com/repos/${repository}/actions/runs?${query}`, token, { httpClient });
    const pageRuns = Array.isArray(response?.workflow_runs) ? response.workflow_runs : [];
    allRuns.push(...pageRuns);
    if (pageRuns.length < 100 || allRuns.length >= Number(response?.total_count || 0)) break;
    if (page === 10) throw new Error('github_workflow_run_discovery_limit_exceeded');
  }
  const exactPrHeadRuns = [...new Map(allRuns.filter((run) => run?.event === 'pull_request'
    && String(run?.head_sha || '').toLowerCase() === pullRequestBinding.headSha
    && (run?.pull_requests || []).some((item) => Number(item.number) === pullRequestBinding.pullRequestNumber))
    .map((run) => [Number(run.id), run])).values()];
  const selectedRuns = [];
  const missingWorkflowIdentities = [];
  for (const workflow of workflowContract || []) {
    const selected = latestWorkflowRun(exactPrHeadRuns.filter((run) => Number(run.workflow_id) === Number(workflow.workflowId)));
    if (!selected) {
      missingWorkflowIdentities.push(`${Number(workflow.workflowId)}:${workflow.path}`);
      continue;
    }
    selectedRuns.push(selected);
  }
  const discovery = buildWorkflowDiscovery({
    source: githubHttpFixtureMode(httpClient) ? 'github_api_mock_current_pr_exact_head' : 'github_api_current_pr_exact_head',
    repository,
    pullRequestNumber: pullRequestBinding.pullRequestNumber,
    headSha: pullRequestBinding.headSha,
    observedRunCount: exactPrHeadRuns.length,
    hintRunIds,
    missingWorkflowIdentities,
    selectedRuns: selectedRuns.map((run) => {
      const workflow = (workflowContract || []).find((entry) => Number(entry.workflowId) === Number(run.workflow_id));
      return {
        workflowId: Number(run.workflow_id),
        workflowPath: workflow?.path || '',
        runId: Number(run.id),
        runNumber: Number(run.run_number),
        runAttempt: Number(run.run_attempt),
        status: String(run.status || (run.conclusion ? 'completed' : '')),
        conclusion: String(run.conclusion || ''),
        headSha: String(run.head_sha || '').toLowerCase(),
      };
    }),
    observedAt: new Date().toISOString(),
  });
  return { selectedRuns, discovery };
}

export function validateAcceptedMainIdentityObservation({
  repository,
  expectedDefaultBranchHeadSha,
  repositoryMetadata,
  defaultBranchMetadata,
} = {}) {
  const reasonCodes = [];
  const observedRepository = String(repositoryMetadata?.full_name || '');
  const defaultBranch = String(repositoryMetadata?.default_branch || '');
  const defaultBranchHeadSha = String(defaultBranchMetadata?.commit?.sha || '').toLowerCase();
  if (repository !== V132_SOURCE_REPOSITORY || observedRepository !== V132_SOURCE_REPOSITORY) reasonCodes.push('accepted_main_source_repository_mismatch');
  if (defaultBranch !== V132_SOURCE_DEFAULT_BRANCH) reasonCodes.push('accepted_main_default_branch_mismatch');
  if (String(defaultBranchMetadata?.name || defaultBranch) !== V132_SOURCE_DEFAULT_BRANCH) reasonCodes.push('accepted_main_branch_observation_mismatch');
  if (!SHA_RE.test(defaultBranchHeadSha)) reasonCodes.push('accepted_main_default_branch_head_invalid');
  if (expectedDefaultBranchHeadSha != null) {
    if (!SHA_RE.test(String(expectedDefaultBranchHeadSha || ''))) reasonCodes.push('accepted_main_expected_head_invalid');
    else if (defaultBranchHeadSha !== String(expectedDefaultBranchHeadSha).toLowerCase()) reasonCodes.push('accepted_main_default_branch_head_mismatch');
  }
  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    repository: observedRepository || null,
    repositoryId: Number(repositoryMetadata?.id) || null,
    defaultBranch: defaultBranch || null,
    defaultBranchHeadSha: SHA_RE.test(defaultBranchHeadSha) ? defaultBranchHeadSha : null,
    reasonCodes,
    createsAuthority: false,
  };
}

function gitBlobSha(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(bytes).digest('hex');
}

function buildObservedTrustRootEnvelope({ document, observation } = {}) {
  const root = {
    envelopeVersion: V132_VERSION,
    document,
    trustSource: observation?.trustSource,
    trustSourceRepository: observation?.trustSourceRepository,
    trustSourceRepositoryId: Number(observation?.trustSourceRepositoryId) || null,
    trustSourceDefaultBranch: observation?.trustSourceDefaultBranch,
    trustSourceHeadSha: String(observation?.trustSourceHeadSha || '').toLowerCase(),
    trustSourceBlobSha: String(observation?.trustSourceBlobSha || '').toLowerCase(),
    trustSourcePath: observation?.trustSourcePath,
    trustSourceProtectionStableDigest: observation?.trustSourceProtectionStableDigest || null,
    observedAt: observation?.observedAt,
  };
  root.effectiveTrustRootDigest = effectiveTrustRootDigest(root);
  return root;
}

export async function collectAcceptedMainTrustRoot({ repository, expectedDefaultBranchHeadSha, token, httpClient = null } = {}) {
  if (!/^[-A-Za-z0-9_.]+\/[-A-Za-z0-9_.]+$/.test(String(repository || ''))) throw new Error('trust_root_repository_invalid');
  if (repository !== V132_SOURCE_REPOSITORY) throw new Error('trust_root_source_repository_mismatch');
  if (!token) throw new Error('github_token_required_for_trust_root_observation');
  const fixtureMode = githubHttpFixtureMode(httpClient);
  const repositoryMetadata = await githubJson(`https://api.github.com/repos/${repository}`, token, { httpClient });
  const observedDefaultBranch = String(repositoryMetadata?.default_branch || '');
  const defaultBranchMetadata = observedDefaultBranch
    ? await githubJson(`https://api.github.com/repos/${repository}/branches/${encodeURIComponent(observedDefaultBranch)}`, token, { httpClient })
    : null;
  const identity = validateAcceptedMainIdentityObservation({
    repository,
    expectedDefaultBranchHeadSha,
    repositoryMetadata,
    defaultBranchMetadata,
  });
  if (identity.status !== 'pass') throw new Error(`accepted_main_identity_invalid:${identity.reasonCodes.join(',')}`);
  const defaultBranchProtection = await observeRequiredCheckTrustSnapshot({
    repository,
    baseRef: identity.defaultBranch,
    token,
    httpClient,
  });
  const encodedPath = V132_TRUST_ROOT_PATH.split('/').map(encodeURIComponent).join('/');
  const contentObject = await githubJson(`https://api.github.com/repos/${repository}/contents/${encodedPath}?ref=${identity.defaultBranchHeadSha}`, token, { httpClient });
  if (contentObject?.type !== 'file' || contentObject?.path !== V132_TRUST_ROOT_PATH || contentObject?.encoding !== 'base64') {
    throw new Error('accepted_main_trust_root_content_observation_invalid');
  }
  const bytes = Buffer.from(String(contentObject.content || '').replace(/\s/g, ''), 'base64');
  const observedBlobSha = String(contentObject.sha || '').toLowerCase();
  if (!SHA_RE.test(observedBlobSha) || gitBlobSha(bytes) !== observedBlobSha) throw new Error('accepted_main_trust_root_blob_binding_invalid');
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('accepted_main_trust_root_json_invalid');
  }
  const trustRoot = buildObservedTrustRootEnvelope({
    document: parsed,
    observation: {
      trustSource: fixtureMode ? 'github_api_mock_fixture' : 'accepted_main_github_api',
      trustSourceRepository: identity.repository,
      trustSourceRepositoryId: identity.repositoryId,
      trustSourceDefaultBranch: identity.defaultBranch,
      trustSourceHeadSha: identity.defaultBranchHeadSha,
      trustSourceBlobSha: observedBlobSha,
      trustSourcePath: V132_TRUST_ROOT_PATH,
      trustSourceProtectionStableDigest: defaultBranchProtection.stableDigest,
      observedAt: new Date().toISOString(),
    },
  });
  const validation = validateObservedTrustRootEnvelope(trustRoot, {
    repository,
    defaultBranch: identity.defaultBranch,
    headSha: identity.defaultBranchHeadSha,
  });
  if (validation.status !== 'pass') throw new Error(`accepted_main_trust_root_invalid:${validation.reasonCodes.join(',')}`);
  const frozenTrustRoot = deepFreeze(trustRoot);
  if (fixtureMode) FIXTURE_TRUST_ROOTS.add(frozenTrustRoot);
  else ACCEPTED_MAIN_TRUST_ROOTS.add(frozenTrustRoot);
  return frozenTrustRoot;
}

export function createFixtureTrustRoot({
  repository,
  trustSourceHeadSha,
  trustSourceBlobSha = 'd'.repeat(40),
  trustSourcePath = V132_TRUST_ROOT_PATH,
  trustSourceDefaultBranch = V132_SOURCE_DEFAULT_BRANCH,
  publicKeyPem,
  keyId = 'fixture-owner-key',
  requiredArtifacts,
  requiredWorkflows,
} = {}) {
  const defaultWorkflowDigest = sha256('fixture-workflow:quality-gate');
  const document = {
    schemaVersion: V132_VERSION,
    trustRootVersion: '1',
    state: 'active',
    authority: 'accepted_main_only',
    repository,
    defaultBranch: V132_SOURCE_DEFAULT_BRANCH,
    finalDecisionKey: {
      keyId,
      state: 'active',
      publicKeyPem,
      publicKeyFingerprint: publicKeyFingerprint(publicKeyPem),
    },
    revokedKeyIds: [],
    keyRotation: { state: 'stable', successorKeyId: null, notBefore: null },
    artifactContract: {
      requiredArtifacts: requiredArtifacts || [{
        name: 'safe-summary',
        workflowPath: '.github/workflows/quality-gate.yml',
        entryPath: 'safe-summary.json',
        schemaVersion: V132_VERSION,
        requiredFields: ['schemaVersion', 'repository', 'status', 'headSha'],
        requiredFieldValues: { repository: '$repository', headSha: '$headSha', status: 'pass' },
      }],
    },
    workflowContract: {
      requiredWorkflows: requiredWorkflows || [{
        workflowId: 1001,
        path: '.github/workflows/quality-gate.yml',
        workflowContentDigest: defaultWorkflowDigest,
        reusableWorkflowRef: null,
      }],
    },
  };
  const trustRoot = buildObservedTrustRootEnvelope({
    document,
    observation: {
      trustSource: 'explicit_test_fixture',
      trustSourceRepository: repository,
      trustSourceRepositoryId: 123456,
      trustSourceDefaultBranch,
      trustSourceHeadSha,
      trustSourceBlobSha,
      trustSourcePath,
      trustSourceProtectionStableDigest: sha256('fixture-protection'),
      observedAt: '2026-07-10T00:00:00Z',
    },
  });
  const validation = validateObservedTrustRootEnvelope(trustRoot, {
    repository,
    defaultBranch: V132_SOURCE_DEFAULT_BRANCH,
    headSha: trustSourceHeadSha,
  });
  if (validation.status !== 'pass') throw new Error(`fixture_trust_root_invalid:${validation.reasonCodes.join(',')}`);
  const frozenTrustRoot = deepFreeze(trustRoot);
  FIXTURE_TRUST_ROOTS.add(frozenTrustRoot);
  return frozenTrustRoot;
}

function requiredCheckTrustStablePayload(snapshot = {}) {
  return {
    source: snapshot.source,
    sourceIdentity: snapshot.sourceIdentity,
    baseRef: snapshot.baseRef,
    requiredChecks: [...(snapshot.requiredChecks || [])]
      .map((entry) => ({ name: String(entry.name || ''), appId: normalizeAppId(entry.appId) }))
      .sort((a, b) => a.name.localeCompare(b.name) || Number(a.appId || 0) - Number(b.appId || 0)),
    requiredCheckNames: [...new Set(snapshot.requiredCheckNames || [])].sort(),
    requiredWorkflowRefs: [...(snapshot.requiredWorkflowRefs || [])]
      .map((entry) => ({
        path: String(entry.path || ''),
        ref: String(entry.ref || ''),
        sha: String(entry.sha || '').toLowerCase(),
        repositoryId: Number(entry.repositoryId) || null,
      }))
      .sort((a, b) => a.path.localeCompare(b.path) || a.ref.localeCompare(b.ref)),
  };
}

export function buildRequiredCheckTrustSnapshot({
  repository,
  baseRef,
  classicProtection = null,
  rulesetRules = null,
  observedAt = new Date().toISOString(),
} = {}) {
  const classicObserved = classicProtection !== null;
  const rulesetsObserved = Array.isArray(rulesetRules);
  const classicChecksByName = new Map();
  if (classicObserved) {
    for (const context of classicProtection?.contexts || []) {
      if (context) classicChecksByName.set(String(context), { name: String(context), appId: null });
    }
    for (const entry of classicProtection?.checks || []) {
      if (!entry?.context) continue;
      classicChecksByName.set(String(entry.context), {
        name: String(entry.context),
        appId: normalizeAppId(entry.app_id),
      });
    }
  }
  const relevantRules = rulesetsObserved ? rulesetRules.filter((rule) => ['required_status_checks', 'workflows', 'required_workflows'].includes(String(rule?.type || ''))) : [];
  const rulesetChecks = relevantRules.flatMap((rule) => rule?.type === 'required_status_checks'
    ? (rule?.parameters?.required_status_checks || []).map((entry) => ({
      name: String(entry.context || ''),
      appId: normalizeAppId(entry.integration_id ?? entry.app_id),
    }))
    : []).filter((entry) => entry.name);
  const requiredWorkflowRefs = relevantRules.flatMap((rule) => ['workflows', 'required_workflows'].includes(rule?.type)
    ? (rule?.parameters?.workflows || rule?.parameters?.required_workflows || []).map((entry) => ({
      path: String(entry.path || ''),
      ref: String(entry.ref || ''),
      sha: String(entry.sha || '').toLowerCase(),
      repositoryId: Number(entry.repository_id) || null,
    }))
    : []);
  if (requiredWorkflowRefs.some((entry) => !/^\.github\/workflows\/[^/]+\.ya?ml$/i.test(entry.path)
    || (entry.ref && !entry.ref.startsWith('refs/'))
    || !Number.isInteger(entry.repositoryId))) {
    throw new Error('github_ruleset_workflow_binding_invalid');
  }
  if (requiredWorkflowRefs.some((entry) => !SHA_RE.test(entry.sha))) {
    throw new Error('github_ruleset_workflow_not_sha_pinned_unsupported');
  }
  const workflowRefIdentities = requiredWorkflowRefs.map((entry) => canonicalJson(entry));
  if (new Set(workflowRefIdentities).size !== workflowRefIdentities.length) throw new Error('github_ruleset_workflow_binding_duplicate');
  const requiredChecksByIdentity = new Map();
  for (const entry of [...classicChecksByName.values(), ...rulesetChecks]) {
    requiredChecksByIdentity.set(`${entry.name}:${entry.appId ?? '*'}`, entry);
  }
  const requiredChecks = [...requiredChecksByIdentity.values()]
    .sort((a, b) => a.name.localeCompare(b.name) || Number(a.appId || 0) - Number(b.appId || 0));
  const requiredCheckNames = [...new Set(requiredChecks.map((entry) => entry.name))].sort();
  if ((!classicObserved && !rulesetsObserved) || (!requiredChecks.length && !requiredWorkflowRefs.length)) {
    throw new Error('github_required_check_trust_root_unavailable');
  }
  const source = classicObserved && relevantRules.length
    ? 'github_branch_protection_and_rulesets'
    : relevantRules.length
      ? 'github_rulesets'
      : 'github_branch_protection';
  const snapshot = {
    source,
    sourceIdentity: {
      classic: classicObserved ? {
        repository,
        baseRef,
        strict: classicProtection?.strict === true,
        integrationIds: [...new Set((classicProtection?.checks || []).map((entry) => Number(entry.app_id)).filter(Number.isInteger))].sort((a, b) => a - b),
      } : null,
      rulesets: relevantRules.map((rule) => ({
        rulesetId: Number(rule.ruleset_id) || null,
        sourceType: String(rule.ruleset_source_type || ''),
        source: String(rule.ruleset_source || ''),
        type: String(rule.type || ''),
      })).sort((a, b) => Number(a.rulesetId || 0) - Number(b.rulesetId || 0) || a.type.localeCompare(b.type)),
    },
    baseRef: String(baseRef || ''),
    requiredChecks,
    requiredCheckNames,
    requiredWorkflowRefs,
    observedAt,
  };
  snapshot.stableDigest = sha256(canonicalJson(requiredCheckTrustStablePayload(snapshot)));
  return snapshot;
}

async function observeRequiredCheckTrustSnapshot({ repository, baseRef, token, httpClient = null } = {}) {
  const encodedBranch = encodeURIComponent(baseRef);
  const [classicProtection, rulesetRules] = await Promise.all([
    githubJson(`https://api.github.com/repos/${repository}/branches/${encodedBranch}/protection/required_status_checks`, token, { allowNotFound: true, httpClient }),
    githubJson(`https://api.github.com/repos/${repository}/rules/branches/${encodedBranch}`, token, { allowNotFound: true, httpClient }),
  ]);
  return buildRequiredCheckTrustSnapshot({
    repository,
    baseRef,
    classicProtection,
    rulesetRules,
    observedAt: new Date().toISOString(),
  });
}

async function githubBuffer(url, token, { httpClient = null } = {}) {
  const response = await githubFetch(httpClient)(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'codex-v132-artifact-observer',
    },
  });
  if (!response.ok) throw new Error(`github_artifact_observation_failed:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function zipExtraHasZip64(extra) {
  let offset = 0;
  while (offset + 4 <= extra.length) {
    const id = extra.readUInt16LE(offset);
    const size = extra.readUInt16LE(offset + 2);
    if (offset + 4 + size > extra.length) throw new Error('artifact_zip_extra_invalid');
    if (id === 0x0001) return true;
    offset += 4 + size;
  }
  if (offset !== extra.length) throw new Error('artifact_zip_extra_invalid');
  return false;
}

export function readArtifactZipEntry(archive, entryPath, limits = V132_ARTIFACT_LIMITS) {
  if (!Buffer.isBuffer(archive)) throw new Error('artifact_archive_buffer_required');
  if (archive.length > limits.archiveBytes) throw new Error('artifact_archive_size_exceeded');
  if (!entryPath || entryPath.includes('\\') || entryPath.startsWith('/') || entryPath.split('/').includes('..')) {
    throw new Error('artifact_contract_entry_path_invalid');
  }
  if (archive.includes(Buffer.from([0x50, 0x4b, 0x06, 0x06])) || archive.includes(Buffer.from([0x50, 0x4b, 0x06, 0x07]))) {
    throw new Error('artifact_zip64_unsupported');
  }
  let eocd = -1;
  for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65557); offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('artifact_zip_eocd_missing');
  const entryCount = archive.readUInt16LE(eocd + 10);
  const entriesOnDisk = archive.readUInt16LE(eocd + 8);
  const centralDirectorySize = archive.readUInt32LE(eocd + 12);
  let offset = archive.readUInt32LE(eocd + 16);
  if (entryCount === 0xffff || entriesOnDisk === 0xffff || centralDirectorySize === 0xffffffff || offset === 0xffffffff) throw new Error('artifact_zip64_unsupported');
  if (entryCount !== entriesOnDisk) throw new Error('artifact_zip_multidisk_unsupported');
  if (entryCount > limits.entryCount) throw new Error('artifact_zip_entry_count_exceeded');
  if (offset + centralDirectorySize > eocd) throw new Error('artifact_zip_central_directory_bounds_invalid');
  const matches = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > archive.length) throw new Error('artifact_zip_central_directory_bounds_invalid');
    if (archive.readUInt32LE(offset) !== 0x02014b50) throw new Error('artifact_zip_central_directory_invalid');
    const flags = archive.readUInt16LE(offset + 8);
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const uncompressedSize = archive.readUInt32LE(offset + 24);
    const fileNameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const nextOffset = offset + 46 + fileNameLength + extraLength + commentLength;
    if (nextOffset > archive.length) throw new Error('artifact_zip_central_directory_bounds_invalid');
    const centralExtra = archive.subarray(offset + 46 + fileNameLength, offset + 46 + fileNameLength + extraLength);
    if ([compressedSize, uncompressedSize, localOffset].includes(0xffffffff) || zipExtraHasZip64(centralExtra)) throw new Error('artifact_zip64_unsupported');
    const name = archive.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8').replaceAll('\\', '/');
    if (name === entryPath) {
      if (flags & 0x0001) throw new Error('artifact_zip_encryption_unsupported');
      if (uncompressedSize > limits.payloadBytes) throw new Error('artifact_payload_size_exceeded');
      if (localOffset + 30 > archive.length) throw new Error('artifact_zip_local_header_bounds_invalid');
      if (archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('artifact_zip_local_header_invalid');
      const localNameLength = archive.readUInt16LE(localOffset + 26);
      const localExtraLength = archive.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const localExtra = archive.subarray(localOffset + 30 + localNameLength, dataOffset);
      if (dataOffset > archive.length || zipExtraHasZip64(localExtra)) throw new Error('artifact_zip_local_header_bounds_invalid');
      if (dataOffset + compressedSize > archive.length) throw new Error('artifact_zip_payload_bounds_invalid');
      const compressed = archive.subarray(dataOffset, dataOffset + compressedSize);
      let payload;
      if (method === 0) payload = Buffer.from(compressed);
      else if (method === 8) payload = zlib.inflateRawSync(compressed, { maxOutputLength: limits.payloadBytes });
      else throw new Error(`artifact_zip_compression_unsupported:${method}`);
      if (payload.length !== uncompressedSize) throw new Error('artifact_zip_uncompressed_size_mismatch');
      if (payload.length > limits.payloadBytes) throw new Error('artifact_payload_size_exceeded');
      matches.push(payload);
    }
    offset = nextOffset;
  }
  if (matches.length > 1) throw new Error(`artifact_contract_entry_duplicate:${entryPath}`);
  if (matches.length === 1) return matches[0];
  throw new Error(`artifact_contract_entry_missing:${entryPath}`);
}

function resolveArtifactContractValue(value, expected = {}) {
  if (value === '$repository') return expected.repository;
  if (value === '$headSha') return String(expected.headSha || '').toLowerCase();
  return value;
}

async function observeRequiredArtifact(artifact, contract, token, expected = {}, { httpClient = null } = {}) {
  if (!Number.isInteger(Number(artifact.size_in_bytes)) || Number(artifact.size_in_bytes) > V132_ARTIFACT_LIMITS.archiveBytes) {
    throw new Error(`artifact_archive_size_exceeded:${artifact.name}`);
  }
  const archive = await githubBuffer(artifact.archive_download_url, token, { httpClient });
  const contentDigest = sha256Bytes(archive);
  if (artifact.digest && artifact.digest !== contentDigest) throw new Error(`artifact_archive_digest_mismatch:${artifact.name}`);
  const payloadBytes = readArtifactZipEntry(archive, contract.entryPath);
  let payload;
  try {
    payload = JSON.parse(payloadBytes.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    throw new Error(`artifact_payload_json_invalid:${artifact.name}`);
  }
  if (payload?.schemaVersion !== contract.schemaVersion) throw new Error(`artifact_schema_mismatch:${artifact.name}`);
  for (const field of contract.requiredFields || []) {
    if (!Object.hasOwn(payload, field)) throw new Error(`artifact_required_field_missing:${artifact.name}:${field}`);
  }
  const boundValues = {};
  for (const [field, contractValue] of Object.entries(contract.requiredFieldValues || {})) {
    const expectedValue = resolveArtifactContractValue(contractValue, expected);
    const observedValue = field === 'headSha' ? String(payload[field] || '').toLowerCase() : payload[field];
    if (observedValue !== expectedValue) throw new Error(`artifact_required_value_mismatch:${artifact.name}:${field}`);
    boundValues[field] = observedValue;
  }
  return {
    artifactId: Number(artifact.id),
    name: artifact.name,
    sizeInBytes: Number(artifact.size_in_bytes),
    contentDigest,
    workflowPath: contract.workflowPath,
    entryPath: contract.entryPath,
    schemaVersion: payload.schemaVersion,
    semanticDigest: sha256(canonicalJson(payload)),
    boundValues,
    valueBindingDigest: sha256(canonicalJson(boundValues)),
  };
}

function extractReusableWorkflowRefs(text) {
  const refs = [];
  const pattern = /uses:\s*['"]?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/\.github\/workflows\/[^@\s'"]+@[^\s'"#]+)/g;
  for (const match of String(text || '').matchAll(pattern)) refs.push(match[1]);
  return [...new Set(refs)].sort();
}

async function observeGithubRun({
  repository,
  run,
  token,
  acceptedMainTrustRoot,
  pullRequest,
  pullRequestBinding,
  requiredCheckTrustRoot,
  httpClient = null,
} = {}) {
  if (!/^[-A-Za-z0-9_.]+\/[-A-Za-z0-9_.]+$/.test(String(repository || ''))) throw new Error('github_repository_invalid');
  if (!Number.isInteger(Number(run?.id)) || Number(run.id) < 1) throw new Error('github_run_id_invalid');
  if (!token) throw new Error('github_token_required_for_verified_observation');
  const root = `https://api.github.com/repos/${repository}/actions/runs/${Number(run.id)}`;
  const [jobs, artifactResponse, workflow] = await Promise.all([
    githubJson(`${root}/jobs?per_page=100`, token, { httpClient }),
    githubJson(`${root}/artifacts?per_page=100`, token, { httpClient }),
    githubJson(`https://api.github.com/repos/${repository}/actions/workflows/${Number(run.workflow_id)}`, token, { httpClient }),
  ]);
  const encodedWorkflowPath = String(workflow.path || '').split('/').map(encodeURIComponent).join('/');
  const workflowText = await githubText(`https://api.github.com/repos/${repository}/contents/${encodedWorkflowPath}?ref=${String(run.head_sha || '').toLowerCase()}`, token, { httpClient });
  const workflowContentDigest = sha256Bytes(Buffer.from(workflowText, 'utf8'));
  const reusableWorkflowRefs = extractReusableWorkflowRefs(workflowText);

  const jobsList = jobs.jobs || [];
  const checkRunDetails = await Promise.all(jobsList.map((job) => githubJson(
    `https://api.github.com/repos/${repository}/check-runs/${Number(job.id)}`,
    token,
    { httpClient },
  )));
  const checkRunDetailsById = new Map(checkRunDetails.map((check) => [Number(check.id), check]));
  const preRunnerJobs = jobsList.filter((job) => (!Array.isArray(job.steps) || job.steps.length === 0) && !job.runner_name);
  const annotations = [];
  for (const job of preRunnerJobs) {
    try {
      const observed = await githubJson(`https://api.github.com/repos/${repository}/check-runs/${Number(job.id)}/annotations?per_page=100`, token, { httpClient });
      annotations.push(...(Array.isArray(observed) ? observed : []).map((item) => String(item.message || item.title || '')));
    } catch {
      // Annotation absence must not be guessed as billing.
    }
  }
  const annotationText = annotations.join('\n');
  const billingObserved = /account is locked due to a billing issue|billing (?:issue|lock)|spending limit/i.test(annotationText);
  const failureClass = run.status === 'completed' && run.conclusion === 'failure'
    && preRunnerJobs.length === jobsList.length && jobsList.length > 0
    ? (billingObserved ? 'account_billing_lock' : 'pre_runner_unavailable')
    : null;

  const fixtureMode = githubHttpFixtureMode(httpClient);
  const trustRootValid = trustRootAccepted(acceptedMainTrustRoot, fixtureMode)
    && validateObservedTrustRootEnvelope(acceptedMainTrustRoot, {
      repository,
      defaultBranch: V132_SOURCE_DEFAULT_BRANCH,
    }).status === 'pass';
  if (run.conclusion === 'success' && !trustRootValid) throw new Error('accepted_main_trust_root_required_for_success_evidence');
  const acceptedDocument = trustRootDocument(acceptedMainTrustRoot);
  const artifactContracts = (acceptedDocument?.artifactContract?.requiredArtifacts || [])
    .filter((contract) => contract.workflowPath === workflow.path);
  const artifactsByName = new Map((artifactResponse.artifacts || []).filter((artifact) => artifact.expired !== true).map((artifact) => [artifact.name, artifact]));
  const artifacts = [];
  const observationErrors = [];
  if (run.conclusion === 'success') {
    for (const contract of artifactContracts) {
      const artifact = artifactsByName.get(contract.name);
      if (!artifact) {
        observationErrors.push(`required_artifact_missing:${contract.name}`);
        continue;
      }
      try {
        artifacts.push(await observeRequiredArtifact(artifact, contract, token, {
          repository,
          headSha: run.head_sha,
        }, { httpClient }));
      } catch (error) {
        observationErrors.push(String(error?.message || error));
      }
    }
  }
  const rulesetBinding = requiredCheckTrustRoot.requiredWorkflowRefs
    .find((entry) => entry.path === workflow.path) || null;
  return {
    repository,
    pullRequestNumber: Number(pullRequest.number),
    pullRequestBinding,
    event: run.event,
    baseRef: pullRequest.base.ref,
    baseSha: pullRequest.base.sha,
    headSha: run.head_sha,
    runId: Number(run.id),
    runNumber: Number(run.run_number),
    runAttempt: Number(run.run_attempt),
    workflowRuns: [{
      runId: Number(run.id),
      runNumber: Number(run.run_number),
      runAttempt: Number(run.run_attempt),
      workflowId: Number(run.workflow_id),
      workflowPath: workflow.path,
      event: run.event,
      pullRequestNumber: Number(pullRequest.number),
      baseSha: pullRequest.base.sha,
      headSha: run.head_sha,
      status: run.status,
      conclusion: run.conclusion,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      workflowContentDigest,
      reusableWorkflowRefs,
      rulesetBinding,
    }],
    startedAt: run.run_started_at || run.created_at,
    completedAt: run.updated_at,
    observedAt: new Date().toISOString(),
    runStatus: run.status,
    conclusion: run.conclusion,
    failureClass,
    observationErrors,
    annotationText,
    requiredCheckTrustRoot,
    requiredArtifactContractDigest: acceptedDocument?.artifactContract ? sha256(canonicalJson(acceptedDocument.artifactContract)) : '',
    requiredWorkflowContractDigest: acceptedDocument?.workflowContract ? sha256(canonicalJson(acceptedDocument.workflowContract)) : '',
    checkRuns: (jobs.jobs || []).map((job) => ({
      checkRunId: Number(job.id),
      name: job.name,
      appId: normalizeAppId(checkRunDetailsById.get(Number(job.id))?.app?.id),
      conclusion: job.conclusion,
      headSha: run.head_sha,
    })),
    artifacts,
  };
}

function finalizeObservedRemoteReceipt(observation, { testMode = false, observationSource } = {}) {
  const receipt = buildRemoteReceipt(observation, { testMode, observationSource });
  if (testMode) {
    FIXTURE_REMOTE_RECEIPTS.add(receipt);
    return receipt;
  }
  const frozenReceipt = deepFreeze(receipt);
  API_OBSERVED_REMOTE_RECEIPTS.add(frozenReceipt);
  return frozenReceipt;
}

export function aggregateGithubRunObservations(observations, {
  repository,
  testMode = false,
  pullRequestBinding = null,
  baseAncestry = null,
  acceptedMainTrustRootDigest = '',
  workflowRunDiscovery = null,
  hintRunIds = [],
} = {}) {
  if (!Array.isArray(observations) || !observations.length) throw new Error('github_run_observations_missing');
  const stableTrustDigest = (item) => {
    const snapshot = item.requiredCheckTrustRoot || {};
    const derived = sha256(canonicalJson(requiredCheckTrustStablePayload(snapshot)));
    if (snapshot.stableDigest !== derived) throw new Error('github_required_check_trust_snapshot_digest_invalid');
    return derived;
  };
  const bindingDigest = (item) => canonicalJson({
    repository: item.repository,
    pullRequestNumber: item.pullRequestNumber,
    event: item.event,
    baseRef: item.baseRef,
    baseSha: item.baseSha,
    headSha: item.headSha,
    requiredCheckTrustStableDigest: stableTrustDigest(item),
    requiredArtifactContractDigest: item.requiredArtifactContractDigest,
    requiredWorkflowContractDigest: item.requiredWorkflowContractDigest,
  });
  if (observations.some((item) => bindingDigest(item) !== bindingDigest(observations[0]))) throw new Error('github_run_set_binding_mismatch');
  const selectedByWorkflow = new Map();
  for (const item of observations) {
    if (!Array.isArray(item.workflowRuns) || item.workflowRuns.length !== 1) throw new Error('github_run_observation_workflow_cardinality_invalid');
    const workflow = item.workflowRuns[0];
    const key = `${Number(workflow.workflowId)}:${String(workflow.workflowPath || '')}`;
    const current = selectedByWorkflow.get(key);
    if (!current
      || Number(item.runAttempt) > Number(current.runAttempt)
      || (Number(item.runAttempt) === Number(current.runAttempt) && Number(item.runId) > Number(current.runId))) {
      selectedByWorkflow.set(key, item);
    }
  }
  const selected = [...selectedByWorkflow.values()].sort((a, b) => Number(a.runId) - Number(b.runId));
  const selectedStatuses = selected.map((item) => String(item.runStatus || (item.conclusion ? 'completed' : '')));
  const runStatus = selectedStatuses.includes('in_progress')
    ? 'in_progress'
    : selectedStatuses.includes('queued')
      ? 'queued'
      : 'completed';
  const failureClass = selected.some((item) => item.failureClass === 'account_billing_lock')
    ? 'account_billing_lock'
    : selected.some((item) => item.failureClass === 'pre_runner_unavailable')
      ? 'pre_runner_unavailable'
      : null;
  const observation = {
    repository,
    pullRequestNumber: observations[0].pullRequestNumber,
    pullRequestBinding: pullRequestBinding || observations[0].pullRequestBinding,
    baseAncestry,
    acceptedMainTrustRootDigest,
    event: observations[0].event,
    baseRef: observations[0].baseRef,
    baseSha: observations[0].baseSha,
    headSha: observations[0].headSha,
    runIds: selected.map((item) => item.runId),
    runAttempts: selected.map((item) => ({ runId: item.runId, runAttempt: item.runAttempt })),
    workflowRuns: selected.flatMap((item) => item.workflowRuns),
    workflowRunDiscovery,
    hintRunIds,
    startedAt: selected.map((item) => item.startedAt).sort()[0],
    completedAt: selected.map((item) => item.completedAt).sort().at(-1),
    observedAt: new Date().toISOString(),
    runStatus,
    conclusion: runStatus !== 'completed'
      ? null
      : selected.every((item) => item.conclusion === 'success')
        ? 'success'
        : selected.some((item) => ['cancelled', 'canceled'].includes(item.conclusion))
          ? 'cancelled'
          : 'failure',
    failureClass,
    observationErrors: selected.flatMap((item) => item.observationErrors || []),
    annotationText: selected.map((item) => item.annotationText).filter(Boolean).join('\n'),
    checkRuns: selected.flatMap((item) => item.checkRuns),
    artifacts: selected.flatMap((item) => item.artifacts),
    requiredCheckTrustRoot: observations[0].requiredCheckTrustRoot,
    requiredArtifactContractDigest: observations[0].requiredArtifactContractDigest,
    requiredWorkflowContractDigest: observations[0].requiredWorkflowContractDigest,
  };
  return finalizeObservedRemoteReceipt(observation, {
    testMode,
    observationSource: testMode ? 'explicit_test_collector' : 'github_api_verified_collector',
  });
}

export function collectVerifiedGithubEvidence(request = {}) {
  const callerObservationFields = ['headSha', 'baseSha', 'event', 'workflowRuns', 'runAttempt', 'checkRuns', 'artifacts', 'conclusion', 'startedAt', 'completedAt', 'observedAt'];
  if (callerObservationFields.some((field) => Object.hasOwn(request, field))) {
    throw new Error('caller_supplied_github_observation_forbidden');
  }
  const allowedRequestFields = new Set(['repository', 'pullRequestNumber', 'runId', 'runIds', 'token', 'acceptedMainTrustRoot', 'httpClient']);
  if (Object.keys(request).some((field) => !allowedRequestFields.has(field))) throw new Error('github_collector_request_field_forbidden');
  const hintRunIds = [...new Set((request.runIds || (request.runId ? [request.runId] : [])).map(Number))]
    .filter((runId) => Number.isInteger(runId) && runId > 0);
  if (hintRunIds.length > 20) throw new Error('github_run_hint_set_too_large');
  const testMode = githubHttpFixtureMode(request.httpClient);
  if (!request.acceptedMainTrustRoot || !trustRootAccepted(request.acceptedMainTrustRoot, testMode)) throw new Error('caller_supplied_untrusted_root_forbidden');
  return (async () => {
    const document = trustRootDocument(request.acceptedMainTrustRoot);
    const acceptedMainTrustRootDigest = trustRootContractDigest(request.acceptedMainTrustRoot);
    const firstPr = await observeCurrentPullRequest({
      repository: request.repository,
      pullRequestNumber: request.pullRequestNumber,
      token: request.token,
      httpClient: request.httpClient,
    });
    const firstBaseAncestry = await observeCurrentBaseAncestry({
      repository: request.repository,
      pullRequestBinding: firstPr.binding,
      token: request.token,
      httpClient: request.httpClient,
    });
    const requiredCheckTrustRoot = await observeRequiredCheckTrustSnapshot({
      repository: request.repository,
      baseRef: firstPr.binding.baseRef,
      token: request.token,
      httpClient: request.httpClient,
    });
    const firstDiscovery = await discoverCurrentPullRequestWorkflowRuns({
      repository: request.repository,
      pullRequestBinding: firstPr.binding,
      workflowContract: document.workflowContract.requiredWorkflows,
      hintRunIds,
      token: request.token,
      httpClient: request.httpClient,
    });
    const selectedRuns = await Promise.all(firstDiscovery.selectedRuns.map((selected) => githubJson(
      `https://api.github.com/repos/${request.repository}/actions/runs/${Number(selected.id)}`,
      request.token,
      { httpClient: request.httpClient },
    )));
    for (const [index, run] of selectedRuns.entries()) {
      const selected = firstDiscovery.selectedRuns[index];
      if (Number(run.id) !== Number(selected.id)
        || Number(run.workflow_id) !== Number(selected.workflow_id)
        || Number(run.run_number) !== Number(selected.run_number)
        || Number(run.run_attempt) !== Number(selected.run_attempt)
        || String(run.head_sha || '').toLowerCase() !== firstPr.binding.headSha) {
        throw new Error('github_latest_run_detail_changed_during_observation');
      }
    }
    const observations = await Promise.all(selectedRuns.map((run) => observeGithubRun({
      repository: request.repository,
      run,
      token: request.token,
      acceptedMainTrustRoot: request.acceptedMainTrustRoot,
      pullRequest: firstPr.pullRequest,
      pullRequestBinding: firstPr.binding,
      requiredCheckTrustRoot,
      httpClient: request.httpClient,
    })));
    const finalPr = await observeCurrentPullRequest({
      repository: request.repository,
      pullRequestNumber: request.pullRequestNumber,
      token: request.token,
      httpClient: request.httpClient,
    });
    if (firstPr.binding.stableDigest !== finalPr.binding.stableDigest) throw new Error('github_pull_request_changed_during_observation');
    const finalBaseAncestry = await observeCurrentBaseAncestry({
      repository: request.repository,
      pullRequestBinding: finalPr.binding,
      token: request.token,
      httpClient: request.httpClient,
    });
    if (firstBaseAncestry.stableDigest !== finalBaseAncestry.stableDigest) throw new Error('github_base_ancestry_changed_during_observation');
    const finalDiscovery = await discoverCurrentPullRequestWorkflowRuns({
      repository: request.repository,
      pullRequestBinding: finalPr.binding,
      workflowContract: document.workflowContract.requiredWorkflows,
      hintRunIds,
      token: request.token,
      httpClient: request.httpClient,
    });
    if (firstDiscovery.discovery.stableDigest !== finalDiscovery.discovery.stableDigest) throw new Error('github_latest_run_set_changed_during_observation');
    if (!observations.length) {
      const now = new Date().toISOString();
      return finalizeObservedRemoteReceipt({
        repository: request.repository,
        pullRequestNumber: finalPr.binding.pullRequestNumber,
        pullRequestBinding: finalPr.binding,
        baseAncestry: finalBaseAncestry,
        acceptedMainTrustRootDigest,
        event: 'pull_request',
        baseRef: finalPr.binding.baseRef,
        baseSha: finalPr.binding.baseSha,
        headRef: finalPr.binding.headRef,
        headSha: finalPr.binding.headSha,
        runIds: [],
        runAttempts: [],
        workflowRuns: [],
        workflowRunDiscovery: finalDiscovery.discovery,
        startedAt: now,
        completedAt: now,
        observedAt: now,
        runStatus: 'completed',
        conclusion: 'failure',
        failureClass: null,
        observationErrors: finalDiscovery.discovery.missingWorkflowIdentities.map((identity) => `required_workflow_missing:${identity}`),
        requiredCheckTrustRoot,
        requiredArtifactContractDigest: sha256(canonicalJson(document.artifactContract)),
        requiredWorkflowContractDigest: sha256(canonicalJson(document.workflowContract)),
        checkRuns: [],
        artifacts: [],
        hintRunIds,
      }, {
        testMode,
        observationSource: testMode ? 'github_api_mock_verified_collector' : 'github_api_verified_collector',
      });
    }
    return aggregateGithubRunObservations(observations, {
      repository: request.repository,
      testMode,
      pullRequestBinding: finalPr.binding,
      baseAncestry: finalBaseAncestry,
      acceptedMainTrustRootDigest,
      workflowRunDiscovery: finalDiscovery.discovery,
      hintRunIds,
    });
  })();
}

export function reobserveSerializedGithubEvidence(receipt, request = {}) {
  const serialized = structuredClone(receipt);
  return collectVerifiedGithubEvidence({
    repository: serialized.repository,
    pullRequestNumber: serialized.pullRequestNumber,
    runIds: serialized.runIds,
    token: request.token,
    acceptedMainTrustRoot: request.acceptedMainTrustRoot,
    httpClient: request.httpClient,
  }).then((observed) => {
    const comparable = (value) => ({
      evidenceType: value.evidenceType,
      repository: value.repository,
      pullRequestNumber: value.pullRequestNumber,
      pullRequestBindingStableDigest: value.pullRequestBinding?.stableDigest || null,
      baseAncestryStableDigest: value.baseAncestry?.stableDigest || null,
      observedBaseSha: value.observedBaseSha,
      baseAncestryState: value.baseAncestryState,
      acceptedMainTrustRootDigest: value.acceptedMainTrustRootDigest,
      mergeContextDigest: value.mergeContextDigest,
      event: value.event,
      baseRef: value.baseRef,
      baseSha: value.baseSha,
      headSha: value.headSha,
      runIds: value.runIds,
      runAttempts: value.runAttempts,
      workflowRuns: value.workflowRuns,
      workflowRunDiscoveryStableDigest: value.workflowRunDiscovery?.stableDigest || null,
      startedAt: value.startedAt,
      completedAt: value.completedAt,
      runStatus: value.runStatus,
      conclusion: value.conclusion,
      failureClass: value.failureClass,
      observationErrors: value.observationErrors,
      annotationDigest: value.annotationDigest,
      checkRuns: value.checkRuns,
      artifacts: value.artifacts,
      requiredCheckTrustStableDigest: value.requiredCheckTrustRoot?.stableDigest || null,
      requiredArtifactContractDigest: value.requiredArtifactContractDigest,
      requiredWorkflowContractDigest: value.requiredWorkflowContractDigest,
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
  const trustRoot = observation.acceptedMainTrustRoot;
  if (trustRoot && !trustRootAccepted(trustRoot, true)) throw new Error('fixture_remote_trust_root_invalid');
  const document = trustRootDocument(trustRoot);
  const receipt = buildRemoteReceipt({
    ...observation,
    requiredArtifactContractDigest: observation.requiredArtifactContractDigest
      || (document?.artifactContract ? sha256(canonicalJson(document.artifactContract)) : ''),
    requiredWorkflowContractDigest: observation.requiredWorkflowContractDigest
      || (document?.workflowContract ? sha256(canonicalJson(document.workflowContract)) : ''),
  }, { testMode: true, observationSource: 'explicit_test_collector' });
  FIXTURE_REMOTE_RECEIPTS.add(receipt);
  return receipt;
}

function finalDecisionPayload(receipt) {
  const { signature: ignoredSignature, receiptDigest: ignoredDigest, ...payload } = receipt;
  return payload;
}

export function trustRootContractDigest(root) {
  return effectiveTrustRootDigest(root);
}

export function verifySignedFinalDecisionReceipt(serializedReceipt, { trustRoot } = {}) {
  const receipt = structuredClone(serializedReceipt);
  const fixtureMode = receipt.testMode === true;
  if (!trustRoot || !trustRootAccepted(trustRoot, fixtureMode)) throw new Error('final_decision_trusted_root_required');
  const rootValidation = validateObservedTrustRootEnvelope(trustRoot, {
    repository: receipt.repository,
  });
  if (rootValidation.status !== 'pass') throw new Error(`final_decision_trust_root_invalid:${rootValidation.reasonCodes.join(',')}`);
  const trustedDocument = trustRootDocument(trustRoot);
  const trustedKey = trustedDocument.finalDecisionKey;
  if (receipt.signingKeyId !== trustedKey.keyId) throw new Error('final_decision_signing_key_id_untrusted');
  if (receipt.signingKeyFingerprint !== trustedKey.publicKeyFingerprint) throw new Error('final_decision_signing_key_fingerprint_untrusted');
  if (trustedDocument.revokedKeyIds.includes(receipt.signingKeyId)) throw new Error('final_decision_signing_key_revoked');
  if (receipt.trustRootDigest !== trustRootContractDigest(trustRoot)) throw new Error('final_decision_trust_root_digest_mismatch');
  if (receipt.signatureAlgorithm !== 'ed25519' || typeof receipt.signature !== 'string') throw new Error('final_decision_signature_metadata_invalid');
  const payload = finalDecisionPayload(receipt);
  const valid = crypto.verify(null, Buffer.from(canonicalJson(payload)), trustedKey.publicKeyPem, Buffer.from(receipt.signature, 'base64'));
  if (!valid) throw new Error('final_decision_signature_invalid');
  if (receipt.receiptDigest !== sha256(canonicalJson({ ...payload, signature: receipt.signature }))) throw new Error('final_decision_digest_invalid');
  const frozenReceipt = deepFreeze(receipt);
  if (fixtureMode) FIXTURE_FINAL_DECISION_RECEIPTS.add(frozenReceipt);
  else VERIFIED_FINAL_DECISION_RECEIPTS.add(frozenReceipt);
  return frozenReceipt;
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
    pullRequestNumber: Number(observation.pullRequestNumber),
    baseSha: String(observation.baseSha || '').toLowerCase(),
    headSha: String(observation.headSha || '').toLowerCase(),
    mergeContextDigest: String(observation.mergeContextDigest || ''),
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
  const pullRequestNumber = Number(receipt.pullRequestNumber);
  const event = String(receipt.event || '');
  const baseSha = String(receipt.baseSha || '').toLowerCase();
  const headSha = String(receipt.headSha || '').toLowerCase();
  const expectedBaseSha = String(expected.baseSha || '').toLowerCase();
  const expectedHeadSha = String(expected.headSha || '').toLowerCase();
  const requiredCheckSetDigest = String(receipt.requiredCheckSetDigest || '');
  const expectedCheckSetDigest = String(expected.requiredCheckSetDigest || '');
  const artifactDigest = String(receipt.artifactDigest || '');
  const expectedArtifactDigest = String(expected.artifactDigest || '');
  const runStatus = String(receipt.runStatus || (receipt.conclusion ? 'completed' : ''));
  const pendingRemoteState = ['queued', 'in_progress'].includes(runStatus) ? runStatus : null;
  const trustRoot = expected.acceptedMainTrustRoot;
  const trustedRoot = trustRootAccepted(trustRoot, expected.testMode === true)
    && validateObservedTrustRootEnvelope(trustRoot, {
      repository,
      defaultBranch: V132_SOURCE_DEFAULT_BRANCH,
    }).status === 'pass';
  const trustedDocument = trustedRoot ? trustRootDocument(trustRoot) : null;
  const expectedTrustRootDigest = trustedRoot ? trustRootContractDigest(trustRoot) : '';
  const expectedMergeContextDigest = trustedRoot && SHA_RE.test(expectedBaseSha || baseSha) && SHA_RE.test(expectedHeadSha || headSha)
    ? calculateMergeContextDigest({
      repository,
      pullRequestNumber,
      baseSha: expectedBaseSha || baseSha,
      headSha: expectedHeadSha || headSha,
      acceptedMainTrustRootDigest: expectedTrustRootDigest,
    })
    : null;

  if (!['github_required_check_set', 'github_job_not_started'].includes(receipt.evidenceType)) reasons.push('remote_evidence_type_invalid');
  if (!repository || (expected.repository && repository !== expected.repository)) reasons.push('remote_repository_mismatch');
  if (!Number.isInteger(pullRequestNumber) || pullRequestNumber < 1) reasons.push('remote_pull_request_number_invalid');
  if (expected.pullRequestNumber && pullRequestNumber !== Number(expected.pullRequestNumber)) reasons.push('remote_pull_request_number_mismatch');
  if (event !== 'pull_request') reasons.push('remote_event_not_pull_request');
  if (expected.event && event !== expected.event) reasons.push('remote_event_mismatch');
  if (!SHA_RE.test(baseSha)) reasons.push('remote_base_sha_invalid');
  if (expectedBaseSha && baseSha !== expectedBaseSha) reasons.push('remote_base_sha_mismatch');
  if (!SHA_RE.test(headSha)) reasons.push('remote_head_sha_invalid');
  if (expectedHeadSha && headSha !== expectedHeadSha) reasons.push('remote_head_sha_mismatch');
  if (!['completed', 'queued', 'in_progress'].includes(runStatus)) reasons.push('remote_run_status_invalid');
  const pullRequestBinding = receipt.pullRequestBinding || {};
  if (!['github_api_current_pr', 'github_api_mock_current_pr', 'explicit_test_current_pr'].includes(pullRequestBinding.source)) reasons.push('remote_pull_request_binding_source_invalid');
  if (!validRfc3339(pullRequestBinding.observedAt)) reasons.push('remote_pull_request_binding_timestamp_invalid');
  if (pullRequestBinding.stableDigest !== sha256(canonicalJson(pullRequestBindingPayload(pullRequestBinding)))) reasons.push('remote_pull_request_binding_digest_invalid');
  if (pullRequestBinding.repository !== repository
    || Number(pullRequestBinding.pullRequestNumber) !== pullRequestNumber
    || pullRequestBinding.baseRef !== receipt.baseRef
    || String(pullRequestBinding.baseSha || '').toLowerCase() !== baseSha
    || String(pullRequestBinding.headSha || '').toLowerCase() !== headSha
    || pullRequestBinding.state !== 'open') reasons.push('remote_pull_request_binding_mismatch');
  const baseAncestry = receipt.baseAncestry || {};
  if (!['github_compare_api', 'github_compare_api_mock', 'explicit_test_compare_api'].includes(baseAncestry.source)) reasons.push('remote_base_ancestry_source_invalid');
  if (!validRfc3339(baseAncestry.observedAt)) reasons.push('remote_base_ancestry_timestamp_invalid');
  if (baseAncestry.stableDigest !== sha256(canonicalJson(baseAncestryPayload(baseAncestry)))) reasons.push('remote_base_ancestry_digest_invalid');
  if (baseAncestry.repository !== repository
    || Number(baseAncestry.pullRequestNumber) !== pullRequestNumber
    || String(baseAncestry.observedBaseSha || '').toLowerCase() !== baseSha
    || String(baseAncestry.checkedHeadSha || '').toLowerCase() !== headSha) reasons.push('remote_base_ancestry_binding_mismatch');
  if (receipt.observedBaseSha !== baseSha || receipt.baseAncestryState !== baseAncestry.state) reasons.push('remote_base_ancestry_projection_mismatch');
  if (baseAncestry.state !== 'matched'
    || !['ahead', 'identical'].includes(baseAncestry.compareStatus)
    || String(baseAncestry.mergeBaseSha || '').toLowerCase() !== baseSha) reasons.push('remote_base_not_ancestor_of_head');
  if (trustedRoot && receipt.acceptedMainTrustRootDigest !== expectedTrustRootDigest) reasons.push('remote_accepted_main_trust_root_digest_mismatch');
  if (!DIGEST_RE.test(String(receipt.mergeContextDigest || ''))
    || receipt.mergeContextDigest !== calculateMergeContextDigest({
      repository,
      pullRequestNumber,
      baseSha,
      headSha,
      acceptedMainTrustRootDigest: receipt.acceptedMainTrustRootDigest,
    })) reasons.push('remote_merge_context_digest_invalid');
  if (expectedMergeContextDigest && receipt.mergeContextDigest !== expectedMergeContextDigest) reasons.push('remote_merge_context_digest_mismatch');
  if (!uniquePositiveIntegers(receipt.runIds)) reasons.push('remote_run_ids_invalid');
  const runAttempts = Array.isArray(receipt.runAttempts) ? receipt.runAttempts : [];
  if (runAttempts.length !== receipt.runIds?.length
    || runAttempts.some((item) => !receipt.runIds.includes(item.runId) || !Number.isInteger(item.runAttempt) || item.runAttempt < 1)
    || new Set(runAttempts.map((item) => item.runId)).size !== runAttempts.length) reasons.push('remote_run_attempts_invalid');
  if (expected.runId && !receipt.runIds?.includes(Number(expected.runId))) reasons.push('remote_run_id_mismatch');
  if (expected.runAttempt && runAttempts.find((item) => item.runId === Number(expected.runId || receipt.runIds?.[0]))?.runAttempt !== Number(expected.runAttempt)) reasons.push('remote_run_attempt_mismatch');
  const workflowRuns = normalizedWorkflowRuns(receipt.workflowRuns);
  if (workflowRuns.length !== receipt.runIds?.length) reasons.push('remote_workflow_run_binding_count_mismatch');
  const workflowRunDiscovery = receipt.workflowRunDiscovery || {};
  if (!['github_api_current_pr_exact_head', 'github_api_mock_current_pr_exact_head', 'explicit_test_current_pr_exact_head'].includes(workflowRunDiscovery.source)) {
    reasons.push('remote_workflow_discovery_source_invalid');
  }
  if (!validRfc3339(workflowRunDiscovery.observedAt)) reasons.push('remote_workflow_discovery_timestamp_invalid');
  if (workflowRunDiscovery.stableDigest !== sha256(canonicalJson(workflowDiscoveryPayload(workflowRunDiscovery)))) reasons.push('remote_workflow_discovery_digest_invalid');
  if (workflowRunDiscovery.repository !== repository
    || Number(workflowRunDiscovery.pullRequestNumber) !== pullRequestNumber
    || String(workflowRunDiscovery.headSha || '').toLowerCase() !== headSha) reasons.push('remote_workflow_discovery_pr_head_mismatch');
  const discoveredSelectedRuns = workflowDiscoveryPayload(workflowRunDiscovery).selectedRuns;
  const receiptSelectedRuns = workflowRuns.map((run) => ({
    workflowId: run.workflowId,
    workflowPath: run.workflowPath,
    runId: run.runId,
    runNumber: run.runNumber,
    runAttempt: run.runAttempt,
    status: run.status,
    conclusion: run.conclusion,
    headSha: run.headSha,
  })).sort((a, b) => a.workflowPath.localeCompare(b.workflowPath) || a.workflowId - b.workflowId);
  if (canonicalJson(discoveredSelectedRuns) !== canonicalJson(receiptSelectedRuns)) reasons.push('remote_workflow_discovery_selection_mismatch');
  if ((workflowRunDiscovery.missingWorkflowIdentities || []).length) reasons.push('remote_workflow_discovery_contract_omission');
  for (const error of receipt.observationErrors || []) reasons.push(`remote_observation_error:${String(error).slice(0, 160)}`);
  const workflowContract = trustedDocument?.workflowContract?.requiredWorkflows || [];
  const contractedWorkflowSet = workflowContract
    .map((entry) => ({ workflowId: Number(entry.workflowId), workflowPath: String(entry.path || '') }))
    .sort((a, b) => a.workflowPath.localeCompare(b.workflowPath) || a.workflowId - b.workflowId);
  const observedWorkflowSet = workflowRuns
    .map((entry) => ({ workflowId: Number(entry.workflowId), workflowPath: String(entry.workflowPath || '') }))
    .sort((a, b) => a.workflowPath.localeCompare(b.workflowPath) || a.workflowId - b.workflowId);
  if (receipt.evidenceType !== 'github_job_not_started' && canonicalJson(observedWorkflowSet) !== canonicalJson(contractedWorkflowSet)) {
    reasons.push('required_workflow_exact_set_mismatch');
  }
  for (const [index, workflowRun] of workflowRuns.entries()) {
    if (!receipt.runIds?.includes(workflowRun.runId)) reasons.push(`workflow_${index}_run_id_mismatch`);
    if (workflowRun.event !== event) reasons.push(`workflow_${index}_event_mismatch`);
    if (workflowRun.pullRequestNumber !== pullRequestNumber) reasons.push(`workflow_${index}_pr_mismatch`);
    if (workflowRun.baseSha !== baseSha) reasons.push(`workflow_${index}_base_mismatch`);
    if (workflowRun.headSha !== headSha) reasons.push(`workflow_${index}_head_mismatch`);
    if (!['completed', 'queued', 'in_progress'].includes(workflowRun.status)) reasons.push(`workflow_${index}_status_invalid`);
    if (receipt.evidenceType !== 'github_job_not_started' && !pendingRemoteState && workflowRun.conclusion !== 'success') reasons.push(`workflow_${index}_conclusion_not_success`);
    const contractedWorkflow = workflowContract.find((entry) => entry.workflowId === workflowRun.workflowId && entry.path === workflowRun.workflowPath);
    if (receipt.evidenceType !== 'github_job_not_started' && !contractedWorkflow) {
      reasons.push(`workflow_${index}_not_in_accepted_main_contract`);
    }
    if (receipt.evidenceType !== 'github_job_not_started' && contractedWorkflow
      && workflowRun.workflowContentDigest !== contractedWorkflow.workflowContentDigest) {
      reasons.push(`workflow_${index}_content_digest_mismatch`);
    }
    if (receipt.evidenceType !== 'github_job_not_started' && contractedWorkflow?.reusableWorkflowRef
      && !workflowRun.reusableWorkflowRefs.includes(contractedWorkflow.reusableWorkflowRef)) {
      reasons.push(`workflow_${index}_reusable_ref_mismatch`);
    }
    if (receipt.evidenceType !== 'github_job_not_started'
      && canonicalJson(workflowRun.rulesetBinding) !== canonicalJson(contractedWorkflow?.rulesetBinding || null)) {
      reasons.push(`workflow_${index}_ruleset_binding_mismatch`);
    }
  }
  if (receipt.evidenceType !== 'github_job_not_started'
    && receipt.requiredWorkflowContractDigest !== (trustedDocument ? sha256(canonicalJson(trustedDocument.workflowContract)) : '')) {
    reasons.push('required_workflow_contract_digest_mismatch');
  }
  if (!['github_api_verified_collector', 'github_api_mock_verified_collector', 'explicit_test_collector'].includes(receipt.observationSource)) reasons.push('remote_observation_source_invalid');
  if (!validRfc3339(receipt.startedAt) || !validRfc3339(receipt.completedAt) || !validRfc3339(receipt.observedAt)) reasons.push('remote_timestamp_invalid');
  if (validRfc3339(receipt.startedAt) && validRfc3339(receipt.completedAt)
    && Date.parse(receipt.completedAt) < Date.parse(receipt.startedAt)) reasons.push('remote_timestamp_order_invalid');

  if (receipt.evidenceType === 'github_job_not_started') {
    if (!['account_billing_lock', 'pre_runner_unavailable'].includes(receipt.failureClass)) reasons.push('remote_not_started_failure_class_invalid');
    if (receipt.failureClass === 'account_billing_lock' && !DIGEST_RE.test(String(receipt.annotationDigest || ''))) {
      reasons.push('remote_billing_annotation_required');
    }
    const unavailableState = receipt.failureClass === 'account_billing_lock' ? 'unavailable_billing' : 'unavailable_pre_runner';
    return {
      ...baseRemoteProjection(reasons.length ? 'failed' : unavailableState, reasons),
      remoteFailureClass: receipt.failureClass || 'unknown_pre_step_failure',
      remoteEvidenceObserved: true,
      observedBaseSha: SHA_RE.test(baseSha) ? baseSha : null,
      baseAncestryState: reasons.some((reason) => reason.includes('base_') || reason.includes('merge_context')) ? 'mismatch' : (baseAncestry.state || 'not_observed'),
      mergeContextDigest: DIGEST_RE.test(String(receipt.mergeContextDigest || '')) ? receipt.mergeContextDigest : null,
      observedHeadSha: SHA_RE.test(headSha) ? headSha : null,
      runIds: uniquePositiveIntegers(receipt.runIds) ? [...receipt.runIds] : [],
    };
  }

  if (pendingRemoteState) {
    return {
      ...baseRemoteProjection(reasons.length ? 'failed' : pendingRemoteState, reasons),
      remoteFailureClass: reasons.length ? 'remote_evidence_invalid' : null,
      remoteEvidenceObserved: true,
      observedBaseSha: SHA_RE.test(baseSha) ? baseSha : null,
      baseAncestryState: reasons.some((reason) => reason.includes('base_') || reason.includes('merge_context')) ? 'mismatch' : (baseAncestry.state || 'not_observed'),
      mergeContextDigest: DIGEST_RE.test(String(receipt.mergeContextDigest || '')) ? receipt.mergeContextDigest : null,
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
  const checkTrust = receipt.requiredCheckTrustRoot || {};
  const validCheckTrustSource = [
    'github_branch_protection',
    'github_rulesets',
    'github_branch_protection_and_rulesets',
    'explicit_test_branch_protection',
    'explicit_test_rulesets',
    'explicit_test_branch_protection_and_rulesets',
  ].includes(checkTrust.source);
  if (!validCheckTrustSource) reasons.push('required_check_trust_root_invalid');
  if (checkTrust.baseRef !== receipt.baseRef) reasons.push('required_check_trust_root_base_mismatch');
  if (!validRfc3339(checkTrust.observedAt)) reasons.push('required_check_trust_root_timestamp_invalid');
  const derivedStableTrustDigest = sha256(canonicalJson(requiredCheckTrustStablePayload(checkTrust)));
  if (checkTrust.stableDigest !== derivedStableTrustDigest) reasons.push('required_check_trust_root_digest_invalid');
  const requiredChecks = [...(checkTrust.requiredChecks || [])]
    .map((entry) => ({ name: String(entry.name || ''), appId: normalizeAppId(entry.appId) }))
    .sort((a, b) => a.name.localeCompare(b.name) || Number(a.appId || 0) - Number(b.appId || 0));
  const expectedCheckNames = [...new Set(requiredChecks.map((entry) => entry.name))].sort();
  const requiredWorkflowRefs = checkTrust.requiredWorkflowRefs || [];
  if (!requiredChecks.length && !requiredWorkflowRefs.length) reasons.push('required_check_and_workflow_set_empty');
  for (const requiredCheck of requiredChecks) {
    const matching = checkRuns.filter((check) => check.name === requiredCheck.name && check.conclusion === 'success');
    if (!matching.length) reasons.push(`required_check_missing:${requiredCheck.name}`);
    else if (requiredCheck.appId != null && !matching.some((check) => check.appId === requiredCheck.appId)) {
      reasons.push(`required_check_app_identity_mismatch:${requiredCheck.name}`);
    }
  }
  const normalizedRulesetRefs = requiredWorkflowRefs.map((entry) => ({
    path: String(entry.path || ''),
    ref: String(entry.ref || ''),
    sha: String(entry.sha || '').toLowerCase(),
    repositoryId: Number(entry.repositoryId) || null,
  })).sort((a, b) => a.path.localeCompare(b.path) || a.ref.localeCompare(b.ref));
  const contractedRulesetRefs = workflowContract.filter((entry) => entry.rulesetBinding).map((entry) => ({
    path: String(entry.rulesetBinding.path || ''),
    ref: String(entry.rulesetBinding.ref || ''),
    sha: String(entry.rulesetBinding.sha || '').toLowerCase(),
    repositoryId: Number(entry.rulesetBinding.repositoryId) || null,
  })).sort((a, b) => a.path.localeCompare(b.path) || a.ref.localeCompare(b.ref));
  if (canonicalJson(normalizedRulesetRefs) !== canonicalJson(contractedRulesetRefs)) reasons.push('ruleset_workflow_exact_binding_mismatch');
  if (Array.isArray(expected.requiredCheckNames) && canonicalJson([...new Set(expected.requiredCheckNames)].sort()) !== canonicalJson(expectedCheckNames)) {
    reasons.push('candidate_controlled_required_check_list_forbidden');
  }
  if (Array.isArray(expected.requiredChecks) && canonicalJson(expected.requiredChecks) !== canonicalJson(requiredChecks)) {
    reasons.push('candidate_controlled_required_check_identity_forbidden');
  }
  if (!DIGEST_RE.test(requiredCheckSetDigest)) reasons.push('required_check_set_digest_invalid');
  const derivedCheckSetDigest = sha256(canonicalJson(normalizedCheckRuns(checkRuns, headSha)
    .filter((check) => expectedCheckNames.includes(check.name))
    .map(({ checkRunId, name, appId, conclusion, headSha: checkHeadSha }) => ({ checkRunId, name, appId, conclusion, headSha: checkHeadSha }))));
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
    if (artifact.sizeInBytes > V132_ARTIFACT_LIMITS.archiveBytes) reasons.push(`artifact_${index}_size_limit_exceeded`);
    if (!DIGEST_RE.test(String(artifact.contentDigest || ''))) reasons.push(`artifact_${index}_content_digest_missing`);
    if (!artifact.workflowPath || !artifact.entryPath || !artifact.schemaVersion || !DIGEST_RE.test(String(artifact.semanticDigest || ''))) reasons.push(`artifact_${index}_semantic_binding_invalid`);
    if (artifact.boundValues?.repository !== repository) reasons.push(`artifact_${index}_repository_binding_mismatch`);
    if (String(artifact.boundValues?.headSha || '').toLowerCase() !== headSha) reasons.push(`artifact_${index}_head_binding_mismatch`);
    if (artifact.boundValues?.status !== 'pass') reasons.push(`artifact_${index}_status_binding_mismatch`);
    if (artifact.valueBindingDigest !== sha256(canonicalJson(artifact.boundValues || {}))) reasons.push(`artifact_${index}_value_binding_digest_invalid`);
  }
  if (!trustedRoot) reasons.push('accepted_main_trust_root_required');
  const requiredArtifactContractDigest = trustedDocument ? sha256(canonicalJson(trustedDocument.artifactContract)) : '';
  if (receipt.requiredArtifactContractDigest !== requiredArtifactContractDigest) reasons.push('required_artifact_contract_digest_mismatch');
  const requiredArtifacts = trustedDocument?.artifactContract?.requiredArtifacts || [];
  if (canonicalJson(artifacts.map(({ name, workflowPath, entryPath, schemaVersion }) => ({ name, workflowPath, entryPath, schemaVersion })).sort((a, b) => a.name.localeCompare(b.name)))
    !== canonicalJson(requiredArtifacts.map(({ name, workflowPath, entryPath, schemaVersion }) => ({ name, workflowPath, entryPath, schemaVersion })).sort((a, b) => a.name.localeCompare(b.name)))) {
    reasons.push('required_artifact_exact_set_mismatch');
  }
  if (receipt.conclusion !== 'success') reasons.push('remote_conclusion_not_success');

  let remoteValidationState = 'passed';
  if (reasons.some((reason) => reason.includes('head_sha_mismatch') || reason.includes('_head_mismatch'))) remoteValidationState = 'head_mismatch';
  else if (reasons.some((reason) => reason.includes('base_ancestry') || reason.includes('base_not_ancestor') || reason.includes('merge_context'))) remoteValidationState = 'stale';
  else if (['cancelled', 'canceled'].includes(receipt.conclusion)) remoteValidationState = 'canceled';
  else if (reasons.some((reason) => reason.includes('required_check_set'))) remoteValidationState = 'required_check_set_mismatch';
  else if (reasons.some((reason) => reason.includes('artifact'))) remoteValidationState = 'artifact_missing';
  else if (reasons.length) remoteValidationState = 'failed';

  return {
    status: reasons.length ? 'fail' : 'pass',
    remoteValidationState,
    remoteFailureClass: remoteValidationState === 'canceled' ? 'remote_run_canceled' : (reasons.length ? 'remote_evidence_invalid' : null),
    sameHeadState: !reasons.some((reason) => reason.includes('head')) && expectedHeadSha ? 'matched' : (expectedHeadSha ? 'mismatch' : 'not_requested'),
    requiredCheckSetState: !reasons.some((reason) => reason.includes('required_check') || reason.startsWith('check_') || reason.includes('candidate_controlled_required_check')) ? 'matched' : 'mismatch',
    artifactIntegrityState: !reasons.some((reason) => reason.includes('artifact')) ? 'verified' : 'missing_or_mismatch',
    remoteEvidenceObserved: true,
    observedBaseSha: SHA_RE.test(baseSha) ? baseSha : null,
    baseAncestryState: reasons.some((reason) => reason.includes('base_') || reason.includes('merge_context')) ? 'mismatch' : (baseAncestry.state || 'not_observed'),
    mergeContextDigest: DIGEST_RE.test(String(receipt.mergeContextDigest || '')) ? receipt.mergeContextDigest : null,
    observedHeadSha: SHA_RE.test(headSha) ? headSha : null,
    runIds: uniquePositiveIntegers(receipt.runIds) ? [...receipt.runIds] : [],
    reasonCodes: reasons,
    createsAuthority: false,
  };
}

export function evaluateFinalDecisionReceipt(receipt, expected = {}) {
  if (receipt == null) return { status: 'not_observed', finalDecisionState: 'not_authorized', reasonCodes: [], createsAuthority: false };
  const reasons = collectForbiddenBooleanClaims(receipt).map((path) => `authority_boolean_forbidden:${path}`);
  const productionTrusted = VERIFIED_FINAL_DECISION_RECEIPTS.has(receipt) && receipt.testMode === false;
  const fixtureTrusted = FIXTURE_FINAL_DECISION_RECEIPTS.has(receipt) && receipt.testMode === true && expected.testMode === true;
  if (!productionTrusted && !fixtureTrusted) reasons.push('final_decision_receipt_not_signature_verified');
  if (receipt.testMode === true && expected.testMode !== true) reasons.push('fixture_final_decision_forbidden_outside_test_mode');
  if (!['final_decision_kernel_verified', 'explicit_test_final_decision'].includes(receipt.observationSource)) reasons.push('final_decision_observation_source_invalid');
  if (receipt.evidenceType !== 'final_decision_authorization') reasons.push('final_decision_receipt_type_invalid');
  if (receipt.authority !== V132_FINAL_AUTHORITY) reasons.push('final_decision_authority_invalid');
  if (receipt.decision !== 'allow_merge') reasons.push('final_decision_not_allow_merge');
  if (!/^[A-Za-z0-9_.:-]{8,128}$/.test(String(receipt.decisionId || ''))) reasons.push('final_decision_id_invalid');
  if (!Number.isInteger(Number(receipt.pullRequestNumber)) || Number(receipt.pullRequestNumber) < 1) reasons.push('final_decision_pull_request_number_invalid');
  if (expected.pullRequestNumber && Number(receipt.pullRequestNumber) !== Number(expected.pullRequestNumber)) reasons.push('final_decision_pull_request_number_mismatch');
  if (!SHA_RE.test(String(receipt.baseSha || '').toLowerCase())) reasons.push('final_decision_base_invalid');
  if (expected.baseSha && String(receipt.baseSha || '').toLowerCase() !== String(expected.baseSha).toLowerCase()) reasons.push('final_decision_base_mismatch');
  if (!SHA_RE.test(String(receipt.headSha || '').toLowerCase())) reasons.push('final_decision_head_invalid');
  if (expected.headSha && String(receipt.headSha || '').toLowerCase() !== String(expected.headSha).toLowerCase()) reasons.push('final_decision_head_mismatch');
  if (expected.repository && receipt.repository !== expected.repository) reasons.push('final_decision_repository_mismatch');
  if (!DIGEST_RE.test(String(receipt.mergeContextDigest || ''))) reasons.push('final_decision_merge_context_digest_invalid');
  if (expected.mergeContextDigest && receipt.mergeContextDigest !== expected.mergeContextDigest) reasons.push('final_decision_merge_context_digest_mismatch');
  const suppliedDigest = String(receipt.receiptDigest || '');
  const { receiptDigest: ignoredDigest, ...decisionPayload } = receipt;
  if (!DIGEST_RE.test(suppliedDigest) || suppliedDigest !== sha256(canonicalJson(decisionPayload))) reasons.push('final_decision_digest_invalid');
  if (!validRfc3339(receipt.observedAt)) reasons.push('final_decision_timestamp_invalid');
  return {
    status: reasons.length ? 'fail' : 'pass',
    finalDecisionState: reasons.length ? 'not_authorized' : 'authorized',
    mergeContextDigest: DIGEST_RE.test(String(receipt.mergeContextDigest || '')) ? receipt.mergeContextDigest : null,
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
  const observedBaseSha = state.observedBaseSha;
  const baseAncestryState = state.baseAncestryState;
  const mergeContextDigest = state.mergeContextDigest;
  if (!['passed', 'failed'].includes(local)) reasons.push('canonical_local_validation_state_invalid');
  if (!V132_REMOTE_VALIDATION_STATES.includes(remote)) reasons.push('canonical_remote_validation_state_invalid');
  if (!['eligible', 'blocked'].includes(technical)) reasons.push('canonical_technical_eligibility_invalid');
  if (!['authorized', 'not_authorized'].includes(finalDecision)) reasons.push('canonical_final_decision_state_invalid');
  if (typeof state.mergeAllowed !== 'boolean') reasons.push('canonical_merge_allowed_invalid');
  if (![null, undefined].includes(observedBaseSha) && !SHA_RE.test(String(observedBaseSha || '').toLowerCase())) reasons.push('canonical_observed_base_sha_invalid');
  if (!['not_observed', 'not_applicable', 'matched', 'mismatch'].includes(baseAncestryState)) reasons.push('canonical_base_ancestry_state_invalid');
  if (![null, undefined].includes(mergeContextDigest) && !DIGEST_RE.test(String(mergeContextDigest || ''))) reasons.push('canonical_merge_context_digest_invalid');
  if (remote === 'passed' && (!SHA_RE.test(String(observedBaseSha || '').toLowerCase()) || baseAncestryState !== 'matched' || !DIGEST_RE.test(String(mergeContextDigest || '')))) {
    reasons.push('canonical_passed_remote_release_context_incomplete');
  }

  const technicalConjunction = local === 'passed'
    && remote === 'passed'
    && remoteEvidenceStatus === 'pass'
    && sameHeadState === 'matched'
    && requiredCheckSetState === 'matched'
    && artifactIntegrityState === 'verified'
    && baseAncestryState === 'matched'
    && DIGEST_RE.test(String(mergeContextDigest || ''));
  if ((technical === 'eligible') !== technicalConjunction) reasons.push('canonical_technical_eligibility_contradiction');
  if (finalDecision === 'authorized' && finalDecisionEvidenceStatus !== 'pass') reasons.push('canonical_final_decision_without_trusted_evidence');
  if (finalDecision === 'authorized' && state.finalDecisionEvidence?.mergeContextDigest !== mergeContextDigest) reasons.push('canonical_final_decision_merge_context_mismatch');
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
  const observedBaseSha = remote.observedBaseSha || (SHA_RE.test(String(expected.baseSha || '').toLowerCase()) ? String(expected.baseSha).toLowerCase() : null);
  const baseAncestryState = remote.baseAncestryState !== 'not_observed'
    ? remote.baseAncestryState
    : (expected.baseAncestryState || 'not_observed');
  const expectedMergeContextDigest = expected.mergeContextDigest || (
    expected.acceptedMainTrustRoot
    && expected.repository
    && expected.pullRequestNumber
    && expected.baseSha
    && expected.headSha
      ? calculateMergeContextDigest({
        repository: expected.repository,
        pullRequestNumber: expected.pullRequestNumber,
        baseSha: expected.baseSha,
        headSha: expected.headSha,
        acceptedMainTrustRootDigest: trustRootContractDigest(expected.acceptedMainTrustRoot),
      })
      : null
  );
  const mergeContextDigest = expectedMergeContextDigest || remote.mergeContextDigest || null;
  const finalDecision = evaluateFinalDecisionReceipt(finalDecisionReceipt, {
    ...expected,
    baseSha: expected.baseSha || observedBaseSha,
    mergeContextDigest,
  });
  const localValidationState = localValidationPassed ? 'passed' : 'failed';
  const technicalMergeEligibility = localValidationState === 'passed'
    && remote.remoteValidationState === 'passed'
    && remote.sameHeadState === 'matched'
    && remote.requiredCheckSetState === 'matched'
    && remote.artifactIntegrityState === 'verified'
    && baseAncestryState === 'matched'
    && DIGEST_RE.test(String(mergeContextDigest || ''))
    ? 'eligible'
    : 'blocked';
  const mergeAllowed = technicalMergeEligibility === 'eligible' && finalDecision.finalDecisionState === 'authorized';
  const state = {
    localValidationState,
    remoteValidationState: remote.remoteValidationState,
    remoteFailureClass: remote.remoteFailureClass,
    technicalMergeEligibility,
    finalDecisionState: finalDecision.finalDecisionState,
    observedBaseSha,
    baseAncestryState,
    mergeContextDigest,
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
  if (runId) {
    console.error(JSON.stringify({
      status: 'fail',
      reason: 'use_codex_v132_collect_remote_evidence_cli',
      createsAuthority: false,
    }));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(deriveCanonicalState({ localValidationPassed: true }), null, 2));
  }
}
