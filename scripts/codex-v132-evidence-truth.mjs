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
export const V132_GITHUB_COLLECTOR_VERSION = 'v132-github-collector-4';
export const V132_TRUST_ROOT_PATH = 'docs/process/CODEX_V132_TRUST_ROOT.json';
export const V132_SOURCE_REPOSITORY = 'hiro4649/codex-development-harness';
export const V132_SOURCE_DEFAULT_BRANCH = 'main';

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value)).digest('hex')}`;
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
    runAttempt: Number(run.runAttempt),
    workflowId: Number(run.workflowId),
    workflowPath: String(run.workflowPath || ''),
    event: String(run.event || ''),
    pullRequestNumber: Number(run.pullRequestNumber),
    baseSha: String(run.baseSha || '').toLowerCase(),
    headSha: String(run.headSha || '').toLowerCase(),
    workflowContentDigest: String(run.workflowContentDigest || ''),
    reusableWorkflowRefs: [...new Set(run.reusableWorkflowRefs || [])].map(String).sort(),
  })).sort((a, b) => a.runId - b.runId);
}

function validateTrustRootShape(root, expected = {}) {
  const reasons = [];
  if (root?.schemaVersion !== V132_VERSION) reasons.push('trust_root_schema_invalid');
  if (root?.state !== 'active') reasons.push('trust_root_not_active');
  if (root?.authority !== 'accepted_main_only') reasons.push('trust_root_authority_invalid');
  if (root?.repository !== expected.repository) reasons.push('trust_root_repository_mismatch');
  if (root?.defaultBranch !== (expected.defaultBranch || V132_SOURCE_DEFAULT_BRANCH)) reasons.push('trust_root_default_branch_mismatch');
  if (!SHA_RE.test(String(root?.acceptedMainSha || ''))) reasons.push('trust_root_main_sha_invalid');
  if (expected.acceptedMainSha && root?.acceptedMainSha !== expected.acceptedMainSha) reasons.push('trust_root_main_sha_mismatch');
  const key = root?.finalDecisionKey || {};
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
  if (!Array.isArray(root?.revokedKeyIds)) reasons.push('trust_root_revocation_list_invalid');
  if (root?.revokedKeyIds?.includes(key.keyId)) reasons.push('trust_root_active_key_revoked');
  if (!['stable', 'rotation_pending'].includes(root?.keyRotation?.state)) reasons.push('trust_root_rotation_state_invalid');
  const artifacts = root?.artifactContract?.requiredArtifacts;
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
  const workflows = root?.workflowContract?.requiredWorkflows;
  if (!Array.isArray(workflows) || !workflows.length) reasons.push('trust_root_workflow_contract_missing');
  for (const [index, workflow] of (workflows || []).entries()) {
    if (!Number.isInteger(workflow.workflowId) || workflow.workflowId < 1 || !/^\.github\/workflows\/[^/]+\.ya?ml$/i.test(String(workflow.path || ''))) {
      reasons.push(`trust_root_workflow_${index}_invalid`);
    }
    if (!DIGEST_RE.test(String(workflow.workflowContentDigest || ''))) reasons.push(`trust_root_workflow_${index}_content_digest_invalid`);
    if (workflow.reusableWorkflowRef != null && !/^[^\s@]+\/\.github\/workflows\/[^\s@]+@[^\s@]+$/.test(String(workflow.reusableWorkflowRef))) {
      reasons.push(`trust_root_workflow_${index}_reusable_ref_invalid`);
    }
  }
  const workflowPaths = new Set((workflows || []).map((workflow) => workflow.path));
  for (const [index, artifact] of (artifacts || []).entries()) {
    if (artifact.workflowPath && !workflowPaths.has(artifact.workflowPath)) reasons.push(`trust_root_artifact_${index}_workflow_unknown`);
  }
  return { status: reasons.length ? 'fail' : 'pass', reasonCodes: reasons };
}

function trustRootAccepted(root, testMode) {
  return testMode === true ? FIXTURE_TRUST_ROOTS.has(root) : ACCEPTED_MAIN_TRUST_ROOTS.has(root);
}

function remoteReceiptPayload(receipt) {
  const { receiptPayloadDigest: ignored, ...payload } = receipt;
  return payload;
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
  const trustedCheckNames = new Set(observation.requiredCheckTrustRoot?.requiredCheckNames || []);
  const requiredCheckRuns = checkRuns.filter((check) => trustedCheckNames.has(check.name));
  const receipt = {
    evidenceType: ['account_billing_lock', 'pre_runner_unavailable'].includes(observation.failureClass)
      ? 'github_job_not_started'
      : 'github_required_check_set',
    trustClass: testMode ? 'explicit_test_fixture' : 'github_api_reobserved',
    testMode,
    collectorVersion: V132_GITHUB_COLLECTOR_VERSION,
    repository: String(observation.repository || ''),
    pullRequestNumber: Number(observation.pullRequestNumber),
    event: String(observation.event || ''),
    baseRef: String(observation.baseRef || ''),
    baseSha: String(observation.baseSha || '').toLowerCase(),
    headSha,
    runIds,
    runAttempts,
    workflowRuns,
    observationSource,
    startedAt: observation.startedAt,
    completedAt: observation.completedAt,
    observedAt: observation.observedAt,
    conclusion: observation.conclusion,
    failureClass: observation.failureClass || null,
    annotationDigest: observation.annotationText ? sha256(String(observation.annotationText)) : null,
    checkRuns,
    artifacts,
    requiredCheckTrustRoot: observation.requiredCheckTrustRoot || null,
    requiredArtifactContractDigest: String(observation.requiredArtifactContractDigest || ''),
    requiredWorkflowContractDigest: String(observation.requiredWorkflowContractDigest || ''),
    requiredCheckSetDigest: sha256(canonicalJson(requiredCheckRuns.map(({ checkRunId, name, conclusion, headSha: checkHeadSha }) => ({ checkRunId, name, conclusion, headSha: checkHeadSha })))),
    artifactDigest: sha256(canonicalJson(artifacts)),
  };
  receipt.receiptPayloadDigest = sha256(canonicalJson(remoteReceiptPayload(receipt)));
  return receipt;
}

async function githubJson(url, token, { allowNotFound = false } = {}) {
  const response = await fetch(url, {
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

async function githubText(url, token) {
  const response = await fetch(url, {
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

export function validateAcceptedMainIdentityObservation({
  repository,
  acceptedMainSha,
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
  if (!SHA_RE.test(String(acceptedMainSha || ''))) reasonCodes.push('accepted_main_recorded_sha_invalid');
  if (defaultBranchHeadSha !== String(acceptedMainSha || '').toLowerCase()) reasonCodes.push('accepted_main_default_branch_head_mismatch');
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

export async function collectAcceptedMainTrustRoot({ repository, acceptedMainSha, token } = {}) {
  if (!/^[-A-Za-z0-9_.]+\/[-A-Za-z0-9_.]+$/.test(String(repository || ''))) throw new Error('trust_root_repository_invalid');
  if (repository !== V132_SOURCE_REPOSITORY) throw new Error('trust_root_source_repository_mismatch');
  if (!SHA_RE.test(String(acceptedMainSha || ''))) throw new Error('trust_root_accepted_main_sha_invalid');
  if (!token) throw new Error('github_token_required_for_trust_root_observation');
  const repositoryMetadata = await githubJson(`https://api.github.com/repos/${repository}`, token);
  const observedDefaultBranch = String(repositoryMetadata?.default_branch || '');
  const defaultBranchMetadata = observedDefaultBranch
    ? await githubJson(`https://api.github.com/repos/${repository}/branches/${encodeURIComponent(observedDefaultBranch)}`, token)
    : null;
  const identity = validateAcceptedMainIdentityObservation({
    repository,
    acceptedMainSha,
    repositoryMetadata,
    defaultBranchMetadata,
  });
  if (identity.status !== 'pass') throw new Error(`accepted_main_identity_invalid:${identity.reasonCodes.join(',')}`);
  const defaultBranchProtection = await observeRequiredCheckTrustSnapshot({
    repository,
    baseRef: identity.defaultBranch,
    token,
  });
  const encodedPath = V132_TRUST_ROOT_PATH.split('/').map(encodeURIComponent).join('/');
  const text = await githubText(`https://api.github.com/repos/${repository}/contents/${encodedPath}?ref=${identity.defaultBranchHeadSha}`, token);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('accepted_main_trust_root_json_invalid');
  }
  const trustRoot = {
    ...parsed,
    trustSource: 'accepted_main_github_api',
    trustSourcePath: V132_TRUST_ROOT_PATH,
    trustSourceRepositoryId: identity.repositoryId,
    trustSourceDefaultBranch: identity.defaultBranch,
    trustSourceHeadSha: identity.defaultBranchHeadSha,
    trustSourceProtectionStableDigest: defaultBranchProtection.stableDigest,
    observedAt: new Date().toISOString(),
  };
  const validation = validateTrustRootShape(trustRoot, {
    repository,
    acceptedMainSha: identity.defaultBranchHeadSha,
    defaultBranch: identity.defaultBranch,
  });
  if (validation.status !== 'pass') throw new Error(`accepted_main_trust_root_invalid:${validation.reasonCodes.join(',')}`);
  if (trustRoot.acceptedMainSha !== identity.defaultBranchHeadSha) throw new Error('accepted_main_trust_root_embedded_sha_mismatch');
  ACCEPTED_MAIN_TRUST_ROOTS.add(trustRoot);
  return trustRoot;
}

export function createFixtureTrustRoot({ repository, acceptedMainSha, publicKeyPem, keyId = 'fixture-owner-key', requiredArtifacts, requiredWorkflows } = {}) {
  const defaultWorkflowDigest = sha256('fixture-workflow:quality-gate');
  const trustRoot = {
    schemaVersion: V132_VERSION,
    state: 'active',
    authority: 'accepted_main_only',
    repository,
    defaultBranch: V132_SOURCE_DEFAULT_BRANCH,
    acceptedMainSha,
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
    trustSource: 'explicit_test_fixture',
    trustSourcePath: null,
    observedAt: '2026-07-10T00:00:00Z',
  };
  const validation = validateTrustRootShape(trustRoot, { repository, acceptedMainSha, defaultBranch: V132_SOURCE_DEFAULT_BRANCH });
  if (validation.status !== 'pass') throw new Error(`fixture_trust_root_invalid:${validation.reasonCodes.join(',')}`);
  FIXTURE_TRUST_ROOTS.add(trustRoot);
  return trustRoot;
}

function requiredCheckTrustStablePayload(snapshot = {}) {
  return {
    source: snapshot.source,
    sourceIdentity: snapshot.sourceIdentity,
    baseRef: snapshot.baseRef,
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
  const classicNames = classicObserved ? [
    ...(classicProtection?.contexts || []),
    ...(classicProtection?.checks || []).map((entry) => entry.context),
  ].filter(Boolean).map(String) : [];
  const relevantRules = rulesetsObserved ? rulesetRules.filter((rule) => ['required_status_checks', 'workflows', 'required_workflows'].includes(String(rule?.type || ''))) : [];
  const rulesetNames = relevantRules.flatMap((rule) => rule?.type === 'required_status_checks'
    ? (rule?.parameters?.required_status_checks || []).map((entry) => entry.context)
    : []).filter(Boolean).map(String);
  const requiredWorkflowRefs = relevantRules.flatMap((rule) => ['workflows', 'required_workflows'].includes(rule?.type)
    ? (rule?.parameters?.workflows || rule?.parameters?.required_workflows || []).map((entry) => ({
      path: String(entry.path || ''),
      ref: String(entry.ref || ''),
      sha: String(entry.sha || '').toLowerCase(),
      repositoryId: Number(entry.repository_id) || null,
    }))
    : []).filter((entry) => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(entry.path));
  const requiredCheckNames = [...new Set([...classicNames, ...rulesetNames])].sort();
  if ((!classicObserved && !rulesetsObserved) || (!requiredCheckNames.length && !requiredWorkflowRefs.length)) {
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
    requiredCheckNames,
    requiredWorkflowRefs,
    observedAt,
  };
  snapshot.stableDigest = sha256(canonicalJson(requiredCheckTrustStablePayload(snapshot)));
  return snapshot;
}

async function observeRequiredCheckTrustSnapshot({ repository, baseRef, token } = {}) {
  const encodedBranch = encodeURIComponent(baseRef);
  const [classicProtection, rulesetRules] = await Promise.all([
    githubJson(`https://api.github.com/repos/${repository}/branches/${encodedBranch}/protection/required_status_checks`, token, { allowNotFound: true }),
    githubJson(`https://api.github.com/repos/${repository}/rules/branches/${encodedBranch}`, token, { allowNotFound: true }),
  ]);
  return buildRequiredCheckTrustSnapshot({
    repository,
    baseRef,
    classicProtection,
    rulesetRules,
    observedAt: new Date().toISOString(),
  });
}

async function githubBuffer(url, token) {
  const response = await fetch(url, {
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

function readZipEntry(archive, entryPath) {
  let eocd = -1;
  for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65557); offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('artifact_zip_eocd_missing');
  const entryCount = archive.readUInt16LE(eocd + 10);
  let offset = archive.readUInt32LE(eocd + 16);
  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) throw new Error('artifact_zip_central_directory_invalid');
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const fileNameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8').replaceAll('\\', '/');
    if (name === entryPath) {
      if (archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('artifact_zip_local_header_invalid');
      const localNameLength = archive.readUInt16LE(localOffset + 26);
      const localExtraLength = archive.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = archive.subarray(dataOffset, dataOffset + compressedSize);
      if (method === 0) return Buffer.from(compressed);
      if (method === 8) return zlib.inflateRawSync(compressed);
      throw new Error(`artifact_zip_compression_unsupported:${method}`);
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  throw new Error(`artifact_contract_entry_missing:${entryPath}`);
}

function resolveArtifactContractValue(value, expected = {}) {
  if (value === '$repository') return expected.repository;
  if (value === '$headSha') return String(expected.headSha || '').toLowerCase();
  return value;
}

async function observeRequiredArtifact(artifact, contract, token, expected = {}) {
  const archive = await githubBuffer(artifact.archive_download_url, token);
  const contentDigest = sha256Bytes(archive);
  if (artifact.digest && artifact.digest !== contentDigest) throw new Error(`artifact_archive_digest_mismatch:${artifact.name}`);
  const payloadBytes = readZipEntry(archive, contract.entryPath);
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
  requiredCheckTrustRoot,
} = {}) {
  if (!/^[-A-Za-z0-9_.]+\/[-A-Za-z0-9_.]+$/.test(String(repository || ''))) throw new Error('github_repository_invalid');
  if (!Number.isInteger(Number(run?.id)) || Number(run.id) < 1) throw new Error('github_run_id_invalid');
  if (!token) throw new Error('github_token_required_for_verified_observation');
  const root = `https://api.github.com/repos/${repository}/actions/runs/${Number(run.id)}`;
  const [jobs, artifactResponse, workflow] = await Promise.all([
    githubJson(`${root}/jobs?per_page=100`, token),
    githubJson(`${root}/artifacts?per_page=100`, token),
    githubJson(`https://api.github.com/repos/${repository}/actions/workflows/${Number(run.workflow_id)}`, token),
  ]);
  const encodedWorkflowPath = String(workflow.path || '').split('/').map(encodeURIComponent).join('/');
  const workflowText = await githubText(`https://api.github.com/repos/${repository}/contents/${encodedWorkflowPath}?ref=${String(run.head_sha || '').toLowerCase()}`, token);
  const workflowContentDigest = sha256Bytes(Buffer.from(workflowText, 'utf8'));
  const reusableWorkflowRefs = extractReusableWorkflowRefs(workflowText);

  const jobsList = jobs.jobs || [];
  const preRunnerJobs = jobsList.filter((job) => (!Array.isArray(job.steps) || job.steps.length === 0) && !job.runner_name);
  const annotations = [];
  for (const job of preRunnerJobs) {
    try {
      const observed = await githubJson(`https://api.github.com/repos/${repository}/check-runs/${Number(job.id)}/annotations?per_page=100`, token);
      annotations.push(...(Array.isArray(observed) ? observed : []).map((item) => String(item.message || item.title || '')));
    } catch {
      // Annotation absence must not be guessed as billing.
    }
  }
  const annotationText = annotations.join('\n');
  const billingObserved = /account is locked due to a billing issue|billing (?:issue|lock)|spending limit/i.test(annotationText);
  const failureClass = preRunnerJobs.length === jobsList.length && jobsList.length > 0
    ? (billingObserved ? 'account_billing_lock' : 'pre_runner_unavailable')
    : null;

  const trustRootValid = trustRootAccepted(acceptedMainTrustRoot, false)
    && validateTrustRootShape(acceptedMainTrustRoot, {
      repository,
      acceptedMainSha: acceptedMainTrustRoot?.acceptedMainSha,
      defaultBranch: V132_SOURCE_DEFAULT_BRANCH,
    }).status === 'pass';
  if (run.conclusion === 'success' && !trustRootValid) throw new Error('accepted_main_trust_root_required_for_success_evidence');
  const artifactContracts = (acceptedMainTrustRoot?.artifactContract?.requiredArtifacts || [])
    .filter((contract) => contract.workflowPath === workflow.path);
  const artifactsByName = new Map((artifactResponse.artifacts || []).filter((artifact) => artifact.expired !== true).map((artifact) => [artifact.name, artifact]));
  const artifacts = [];
  if (run.conclusion === 'success') {
    for (const contract of artifactContracts) {
      const artifact = artifactsByName.get(contract.name);
      if (!artifact) throw new Error(`required_artifact_missing:${contract.name}`);
      artifacts.push(await observeRequiredArtifact(artifact, contract, token, {
        repository,
        headSha: run.head_sha,
      }));
    }
  }
  return {
    repository,
    pullRequestNumber: Number(pullRequest.number),
    event: run.event,
    baseRef: pullRequest.base.ref,
    baseSha: pullRequest.base.sha,
    headSha: run.head_sha,
    runId: Number(run.id),
    runAttempt: Number(run.run_attempt),
    workflowRuns: [{
      runId: Number(run.id),
      runAttempt: Number(run.run_attempt),
      workflowId: Number(run.workflow_id),
      workflowPath: workflow.path,
      event: run.event,
      pullRequestNumber: Number(pullRequest.number),
      baseSha: pullRequest.base.sha,
      headSha: run.head_sha,
      workflowContentDigest,
      reusableWorkflowRefs,
    }],
    startedAt: run.run_started_at || run.created_at,
    completedAt: run.updated_at,
    observedAt: new Date().toISOString(),
    conclusion: run.conclusion,
    failureClass,
    annotationText,
    requiredCheckTrustRoot,
    requiredArtifactContractDigest: acceptedMainTrustRoot?.artifactContract ? sha256(canonicalJson(acceptedMainTrustRoot.artifactContract)) : '',
    requiredWorkflowContractDigest: acceptedMainTrustRoot?.workflowContract ? sha256(canonicalJson(acceptedMainTrustRoot.workflowContract)) : '',
    checkRuns: (jobs.jobs || []).map((job) => ({
      checkRunId: Number(job.id),
      name: job.name,
      conclusion: job.conclusion,
      headSha: run.head_sha,
    })),
    artifacts,
  };
}

export function aggregateGithubRunObservations(observations, { repository, testMode = false } = {}) {
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
  const failureClass = observations.some((item) => item.failureClass === 'account_billing_lock')
    ? 'account_billing_lock'
    : observations.some((item) => item.failureClass === 'pre_runner_unavailable')
      ? 'pre_runner_unavailable'
      : null;
  const observation = {
    repository,
    pullRequestNumber: observations[0].pullRequestNumber,
    event: observations[0].event,
    baseRef: observations[0].baseRef,
    baseSha: observations[0].baseSha,
    headSha: observations[0].headSha,
    runIds: observations.map((item) => item.runId),
    runAttempts: observations.map((item) => ({ runId: item.runId, runAttempt: item.runAttempt })),
    workflowRuns: observations.flatMap((item) => item.workflowRuns),
    startedAt: observations.map((item) => item.startedAt).sort()[0],
    completedAt: observations.map((item) => item.completedAt).sort().at(-1),
    observedAt: new Date().toISOString(),
    conclusion: observations.every((item) => item.conclusion === 'success') ? 'success' : 'failure',
    failureClass,
    annotationText: observations.map((item) => item.annotationText).filter(Boolean).join('\n'),
    checkRuns: observations.flatMap((item) => item.checkRuns),
    artifacts: observations.flatMap((item) => item.artifacts),
    requiredCheckTrustRoot: observations[0].requiredCheckTrustRoot,
    requiredArtifactContractDigest: observations[0].requiredArtifactContractDigest,
    requiredWorkflowContractDigest: observations[0].requiredWorkflowContractDigest,
  };
  const receipt = buildRemoteReceipt(observation, {
    testMode,
    observationSource: testMode ? 'explicit_test_collector' : 'github_api_verified_collector',
  });
  if (testMode) FIXTURE_REMOTE_RECEIPTS.add(receipt);
  else API_OBSERVED_REMOTE_RECEIPTS.add(receipt);
  return receipt;
}

export function collectVerifiedGithubEvidence(request = {}) {
  const callerObservationFields = ['headSha', 'baseSha', 'pullRequestNumber', 'event', 'workflowRuns', 'runAttempt', 'checkRuns', 'artifacts', 'conclusion', 'startedAt', 'completedAt', 'observedAt'];
  if (callerObservationFields.some((field) => Object.hasOwn(request, field))) {
    throw new Error('caller_supplied_github_observation_forbidden');
  }
  const allowedRequestFields = new Set(['repository', 'runId', 'runIds', 'token', 'acceptedMainTrustRoot']);
  if (Object.keys(request).some((field) => !allowedRequestFields.has(field))) throw new Error('github_collector_request_field_forbidden');
  const runIds = [...new Set((request.runIds || [request.runId]).map(Number))].filter((runId) => Number.isInteger(runId) && runId > 0);
  if (!runIds.length || runIds.length > 4) throw new Error('github_run_id_set_invalid');
  if (request.acceptedMainTrustRoot && !trustRootAccepted(request.acceptedMainTrustRoot, false)) throw new Error('caller_supplied_untrusted_root_forbidden');
  return (async () => {
    const runs = await Promise.all(runIds.map((runId) => githubJson(
      `https://api.github.com/repos/${request.repository}/actions/runs/${runId}`,
      request.token,
    )));
    const pullRequestNumbers = runs.map((run) => {
      const values = [...new Set((run.pull_requests || []).map((item) => Number(item.number)).filter(Number.isInteger))];
      if (run.event !== 'pull_request' || values.length !== 1) throw new Error('github_run_pull_request_binding_missing');
      return values[0];
    });
    if (new Set(pullRequestNumbers).size !== 1) throw new Error('github_run_set_pull_request_mismatch');
    const pullRequest = await githubJson(`https://api.github.com/repos/${request.repository}/pulls/${pullRequestNumbers[0]}`, request.token);
    const requiredCheckTrustRoot = await observeRequiredCheckTrustSnapshot({
      repository: request.repository,
      baseRef: pullRequest.base.ref,
      token: request.token,
    });
    const observations = await Promise.all(runs.map((run) => observeGithubRun({
      repository: request.repository,
      run,
      token: request.token,
      acceptedMainTrustRoot: request.acceptedMainTrustRoot,
      pullRequest,
      requiredCheckTrustRoot,
    })));
    return aggregateGithubRunObservations(observations, { repository: request.repository, testMode: false });
  })();
}

export function reobserveSerializedGithubEvidence(receipt, request = {}) {
  const serialized = structuredClone(receipt);
  return collectVerifiedGithubEvidence({
    repository: serialized.repository,
    runIds: serialized.runIds,
    token: request.token,
    acceptedMainTrustRoot: request.acceptedMainTrustRoot,
  }).then((observed) => {
    const comparable = (value) => ({
      evidenceType: value.evidenceType,
      repository: value.repository,
      pullRequestNumber: value.pullRequestNumber,
      event: value.event,
      baseRef: value.baseRef,
      baseSha: value.baseSha,
      headSha: value.headSha,
      runIds: value.runIds,
      runAttempts: value.runAttempts,
      workflowRuns: value.workflowRuns,
      startedAt: value.startedAt,
      completedAt: value.completedAt,
      conclusion: value.conclusion,
      failureClass: value.failureClass,
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
  const receipt = buildRemoteReceipt({
    ...observation,
    requiredArtifactContractDigest: observation.requiredArtifactContractDigest
      || (trustRoot?.artifactContract ? sha256(canonicalJson(trustRoot.artifactContract)) : ''),
    requiredWorkflowContractDigest: observation.requiredWorkflowContractDigest
      || (trustRoot?.workflowContract ? sha256(canonicalJson(trustRoot.workflowContract)) : ''),
  }, { testMode: true, observationSource: 'explicit_test_collector' });
  FIXTURE_REMOTE_RECEIPTS.add(receipt);
  return receipt;
}

function finalDecisionPayload(receipt) {
  const { signature: ignoredSignature, receiptDigest: ignoredDigest, ...payload } = receipt;
  return payload;
}

export function trustRootContractDigest(root) {
  return sha256(canonicalJson({
    schemaVersion: root?.schemaVersion,
    state: root?.state,
    authority: root?.authority,
    repository: root?.repository,
    defaultBranch: root?.defaultBranch,
    acceptedMainSha: root?.acceptedMainSha,
    finalDecisionKey: root?.finalDecisionKey,
    revokedKeyIds: root?.revokedKeyIds,
    keyRotation: root?.keyRotation,
    artifactContract: root?.artifactContract,
    workflowContract: root?.workflowContract,
  }));
}

export function verifySignedFinalDecisionReceipt(serializedReceipt, { trustRoot } = {}) {
  const receipt = structuredClone(serializedReceipt);
  const fixtureMode = receipt.testMode === true;
  if (!trustRoot || !trustRootAccepted(trustRoot, fixtureMode)) throw new Error('final_decision_trusted_root_required');
  const rootValidation = validateTrustRootShape(trustRoot, {
    repository: receipt.repository,
    acceptedMainSha: trustRoot.acceptedMainSha,
  });
  if (rootValidation.status !== 'pass') throw new Error(`final_decision_trust_root_invalid:${rootValidation.reasonCodes.join(',')}`);
  const trustedKey = trustRoot.finalDecisionKey;
  if (receipt.signingKeyId !== trustedKey.keyId) throw new Error('final_decision_signing_key_id_untrusted');
  if (receipt.signingKeyFingerprint !== trustedKey.publicKeyFingerprint) throw new Error('final_decision_signing_key_fingerprint_untrusted');
  if (trustRoot.revokedKeyIds.includes(receipt.signingKeyId)) throw new Error('final_decision_signing_key_revoked');
  if (receipt.trustRootDigest !== trustRootContractDigest(trustRoot)) throw new Error('final_decision_trust_root_digest_mismatch');
  if (receipt.signatureAlgorithm !== 'ed25519' || typeof receipt.signature !== 'string') throw new Error('final_decision_signature_metadata_invalid');
  const payload = finalDecisionPayload(receipt);
  const valid = crypto.verify(null, Buffer.from(canonicalJson(payload)), trustedKey.publicKeyPem, Buffer.from(receipt.signature, 'base64'));
  if (!valid) throw new Error('final_decision_signature_invalid');
  if (receipt.receiptDigest !== sha256(canonicalJson({ ...payload, signature: receipt.signature }))) throw new Error('final_decision_digest_invalid');
  if (fixtureMode) FIXTURE_FINAL_DECISION_RECEIPTS.add(receipt);
  else VERIFIED_FINAL_DECISION_RECEIPTS.add(receipt);
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
  if (!uniquePositiveIntegers(receipt.runIds)) reasons.push('remote_run_ids_invalid');
  const runAttempts = Array.isArray(receipt.runAttempts) ? receipt.runAttempts : [];
  if (runAttempts.length !== receipt.runIds?.length
    || runAttempts.some((item) => !receipt.runIds.includes(item.runId) || !Number.isInteger(item.runAttempt) || item.runAttempt < 1)
    || new Set(runAttempts.map((item) => item.runId)).size !== runAttempts.length) reasons.push('remote_run_attempts_invalid');
  if (expected.runId && !receipt.runIds?.includes(Number(expected.runId))) reasons.push('remote_run_id_mismatch');
  if (expected.runAttempt && runAttempts.find((item) => item.runId === Number(expected.runId || receipt.runIds?.[0]))?.runAttempt !== Number(expected.runAttempt)) reasons.push('remote_run_attempt_mismatch');
  const workflowRuns = normalizedWorkflowRuns(receipt.workflowRuns);
  if (workflowRuns.length !== receipt.runIds?.length) reasons.push('remote_workflow_run_binding_count_mismatch');
  const trustRoot = expected.acceptedMainTrustRoot;
  const trustedRoot = trustRootAccepted(trustRoot, expected.testMode === true)
    && validateTrustRootShape(trustRoot, {
      repository,
      acceptedMainSha: trustRoot?.acceptedMainSha,
      defaultBranch: V132_SOURCE_DEFAULT_BRANCH,
    }).status === 'pass';
  const workflowContract = trustedRoot ? trustRoot.workflowContract.requiredWorkflows : [];
  for (const [index, workflowRun] of workflowRuns.entries()) {
    if (!receipt.runIds?.includes(workflowRun.runId)) reasons.push(`workflow_${index}_run_id_mismatch`);
    if (workflowRun.event !== event) reasons.push(`workflow_${index}_event_mismatch`);
    if (workflowRun.pullRequestNumber !== pullRequestNumber) reasons.push(`workflow_${index}_pr_mismatch`);
    if (workflowRun.baseSha !== baseSha) reasons.push(`workflow_${index}_base_mismatch`);
    if (workflowRun.headSha !== headSha) reasons.push(`workflow_${index}_head_mismatch`);
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
  }
  if (receipt.evidenceType !== 'github_job_not_started'
    && receipt.requiredWorkflowContractDigest !== (trustedRoot ? sha256(canonicalJson(trustRoot.workflowContract)) : '')) {
    reasons.push('required_workflow_contract_digest_mismatch');
  }
  if (!['github_api_verified_collector', 'explicit_test_collector'].includes(receipt.observationSource)) reasons.push('remote_observation_source_invalid');
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
  const expectedCheckNames = [...new Set(checkTrust.requiredCheckNames || [])].sort();
  const requiredWorkflowRefs = checkTrust.requiredWorkflowRefs || [];
  if (!expectedCheckNames.length && !requiredWorkflowRefs.length) reasons.push('required_check_and_workflow_set_empty');
  const observedCheckNames = [...new Set(checkRuns.filter((check) => check.conclusion === 'success').map((check) => check.name))].sort();
  if (expectedCheckNames.some((name) => !observedCheckNames.includes(name))) reasons.push('required_check_name_set_mismatch');
  for (const [index, requiredWorkflow] of requiredWorkflowRefs.entries()) {
    if (!workflowRuns.some((run) => run.workflowPath === requiredWorkflow.path)) reasons.push(`ruleset_workflow_${index}_missing`);
  }
  if (Array.isArray(expected.requiredCheckNames) && canonicalJson([...new Set(expected.requiredCheckNames)].sort()) !== canonicalJson(expectedCheckNames)) {
    reasons.push('candidate_controlled_required_check_list_forbidden');
  }
  if (!DIGEST_RE.test(requiredCheckSetDigest)) reasons.push('required_check_set_digest_invalid');
  const derivedCheckSetDigest = sha256(canonicalJson(normalizedCheckRuns(checkRuns, headSha)
    .filter((check) => expectedCheckNames.includes(check.name))
    .map(({ checkRunId, name, conclusion, headSha: checkHeadSha }) => ({ checkRunId, name, conclusion, headSha: checkHeadSha }))));
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
    if (!artifact.workflowPath || !artifact.entryPath || !artifact.schemaVersion || !DIGEST_RE.test(String(artifact.semanticDigest || ''))) reasons.push(`artifact_${index}_semantic_binding_invalid`);
    if (artifact.boundValues?.repository !== repository) reasons.push(`artifact_${index}_repository_binding_mismatch`);
    if (String(artifact.boundValues?.headSha || '').toLowerCase() !== headSha) reasons.push(`artifact_${index}_head_binding_mismatch`);
    if (artifact.boundValues?.status !== 'pass') reasons.push(`artifact_${index}_status_binding_mismatch`);
    if (artifact.valueBindingDigest !== sha256(canonicalJson(artifact.boundValues || {}))) reasons.push(`artifact_${index}_value_binding_digest_invalid`);
  }
  if (!trustedRoot) reasons.push('accepted_main_trust_root_required');
  const requiredArtifactContractDigest = trustedRoot ? sha256(canonicalJson(trustRoot.artifactContract)) : '';
  if (receipt.requiredArtifactContractDigest !== requiredArtifactContractDigest) reasons.push('required_artifact_contract_digest_mismatch');
  const requiredArtifacts = trustedRoot ? trustRoot.artifactContract.requiredArtifacts : [];
  if (canonicalJson(artifacts.map(({ name, workflowPath, entryPath, schemaVersion }) => ({ name, workflowPath, entryPath, schemaVersion })).sort((a, b) => a.name.localeCompare(b.name)))
    !== canonicalJson(requiredArtifacts.map(({ name, workflowPath, entryPath, schemaVersion }) => ({ name, workflowPath, entryPath, schemaVersion })).sort((a, b) => a.name.localeCompare(b.name)))) {
    reasons.push('required_artifact_exact_set_mismatch');
  }
  if (receipt.conclusion !== 'success') reasons.push('remote_conclusion_not_success');

  let remoteValidationState = 'passed';
  if (reasons.some((reason) => reason.includes('head_sha_mismatch') || reason.includes('_head_mismatch'))) remoteValidationState = 'head_mismatch';
  else if (reasons.some((reason) => reason.includes('required_check_set'))) remoteValidationState = 'required_check_set_mismatch';
  else if (reasons.some((reason) => reason.includes('artifact'))) remoteValidationState = 'artifact_missing';
  else if (reasons.length) remoteValidationState = 'failed';

  return {
    status: reasons.length ? 'fail' : 'pass',
    remoteValidationState,
    remoteFailureClass: reasons.length ? 'remote_evidence_invalid' : null,
    sameHeadState: !reasons.some((reason) => reason.includes('head')) && expectedHeadSha ? 'matched' : (expectedHeadSha ? 'mismatch' : 'not_requested'),
    requiredCheckSetState: !reasons.some((reason) => reason.includes('required_check') || reason.startsWith('check_') || reason.includes('candidate_controlled_required_check')) ? 'matched' : 'mismatch',
    artifactIntegrityState: !reasons.some((reason) => reason.includes('artifact')) ? 'verified' : 'missing_or_mismatch',
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
  const productionTrusted = VERIFIED_FINAL_DECISION_RECEIPTS.has(receipt) && receipt.testMode === false;
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
