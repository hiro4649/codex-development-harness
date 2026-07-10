#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  canonicalJson,
  collectVerifiedGithubEvidence,
  createFixtureFinalDecision,
  createFixtureGithubEvidence,
  createFixtureTrustRoot,
  deriveCanonicalState,
  sha256,
  trustRootContractDigest,
  validateCanonicalState,
  verifySignedFinalDecisionReceipt,
  V132_FINAL_AUTHORITY,
  V132_VERSION,
} from './codex-v132-evidence-truth.mjs';
import {
  compileEffectivePolicy,
  loadV132Policy,
  parseJsonStrict,
  readJsonStrict,
  validateManifestProjections,
  validateStaticRegistry,
} from './codex-v132-manifest-compiler.mjs';
import {
  buildContextCacheEnvelope,
  calculateWorkspaceStateDigest,
  collectWorkspaceState,
  createValidationReceipt,
  planIncrementalValidation,
  validateResumeReceipt,
  V132_WORKSPACE_DIGEST_VERSION,
} from './codex-v132-incremental-validation.mjs';
import { executeValidationPlan, V132_NODE_EXECUTOR_VERSION } from './codex-v132-node-executor.mjs';
import {
  buildDecisionCapsuleV3,
  buildOrchestrationReceipt,
  buildSafeSummary,
  evaluateLongRunBudget,
  finalizeCompactOutput,
  measureJson,
  planCiCost,
  planTargetInstallDryRun,
  validateCompatibilityDebtClosure,
  V132_OUTPUT_LIMITS,
} from './codex-v132-operational-bounds.mjs';
import { evaluateWorkspaceIdentity, repositoryFromRemote, runV132SourceQualityGate } from './codex-v132-quality-gate.mjs';
import { runV132CompatibilityCheck } from './codex-v132-compatibility-check.mjs';
import { evaluateV132CompactWorkflowReport } from './codex-workflow-quality-runner.mjs';
import * as harnessVersion from './codex-harness-version.mjs';

const ROOT = process.cwd();
const results = [];
const selfTestAccounting = { subprocessExecutions: 0, harnessFileWrites: 0, retryCount: 0, retryPerNode: 0, checkpointCount: 0 };

function countedSpawnSync(command, args, options) {
  selfTestAccounting.subprocessExecutions += 1;
  return spawnSync(command, args, options);
}

function accountNestedExecution(report) {
  const nested = report?.executionAccounting || {};
  selfTestAccounting.subprocessExecutions += Number(nested.subprocessExecutions || 0);
  selfTestAccounting.harnessFileWrites += Number(nested.fileWrites || 0);
  selfTestAccounting.retryCount += Number(nested.retryCount || 0);
  selfTestAccounting.retryPerNode = Math.max(selfTestAccounting.retryPerNode, Number(nested.retryPerNode || 0));
  selfTestAccounting.checkpointCount += Number(nested.checkpointCount || 0);
}

function test(id, fn) {
  try {
    fn();
    results.push({ id, status: 'pass' });
  } catch (error) {
    results.push({ id, status: 'fail', reason: String(error.message || error).slice(0, 400) });
  }
}

function strictJson(file) {
  return readJsonStrict(path.join(ROOT, file));
}

function resolvePython() {
  const bundled = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe')
    : '';
  const candidates = [process.env.CODEX_PYTHON, 'python3', 'python', bundled].filter(Boolean);
  for (const command of candidates) {
    const probe = countedSpawnSync(command, ['--version'], { encoding: 'utf8', windowsHide: true });
    if (probe.status === 0) return command;
  }
  throw new Error('python_runtime_not_available_for_parser_equivalence');
}

function resolvePowerShell() {
  for (const command of ['pwsh', 'powershell', 'powershell.exe']) {
    const probe = countedSpawnSync(command, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8', windowsHide: true });
    if (probe.status === 0) return command;
  }
  throw new Error('powershell_runtime_not_available_for_parser_equivalence');
}

function parseThroughPowerShell(file) {
  const escaped = file.replaceAll("'", "''");
  const result = countedSpawnSync(resolvePowerShell(), ['-NoProfile', '-Command', `$x=Get-Content -Raw '${escaped}' | ConvertFrom-Json; $x | ConvertTo-Json -Depth 100 -Compress`], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.replace(/^\uFEFF/, '').trim());
}

function parseThroughPython(file) {
  const result = countedSpawnSync(resolvePython(), ['-c', 'import json,sys; print(json.dumps(json.load(open(sys.argv[1], encoding="utf-8")), ensure_ascii=False, separators=(",",":")))', file], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
}

function validReceipts() {
  const repository = 'hiro4649/codex-development-harness';
  const headSha = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  const { publicKey } = crypto.generateKeyPairSync('ed25519');
  const acceptedMainTrustRoot = createFixtureTrustRoot({
    repository,
    acceptedMainSha: 'c'.repeat(40),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
  });
  const requiredCheckTrustRoot = {
    source: 'explicit_test_branch_protection',
    baseRef: 'main',
    requiredCheckNames: ['quality-gate'],
    observedAt: '2026-07-10T00:00:00Z',
  };
  requiredCheckTrustRoot.digest = sha256(canonicalJson(requiredCheckTrustRoot));
  const remoteEvidence = createFixtureGithubEvidence({
    repository, pullRequestNumber: 165, event: 'pull_request', baseRef: 'main', baseSha, headSha, runId: 101, runAttempt: 1,
    workflowRuns: [{ runId: 101, runAttempt: 1, workflowId: 1001, workflowPath: '.github/workflows/quality-gate.yml', event: 'pull_request', pullRequestNumber: 165, baseSha, headSha }],
    startedAt: '2026-07-10T00:00:00Z', completedAt: '2026-07-10T00:01:00Z', observedAt: '2026-07-10T00:01:01Z',
    conclusion: 'success',
    requiredCheckTrustRoot,
    acceptedMainTrustRoot,
    checkRuns: [{ checkRunId: 202, name: 'quality-gate', conclusion: 'success', headSha }],
    artifacts: [{
      artifactId: 303,
      name: 'safe-summary',
      sizeInBytes: 123,
      contentDigest: sha256('safe-artifact'),
      entryPath: 'safe-summary.json',
      schemaVersion: V132_VERSION,
      semanticDigest: sha256('safe-summary-payload'),
    }],
  });
  const finalDecisionReceipt = createFixtureFinalDecision({
    authority: V132_FINAL_AUTHORITY, decision: 'allow_merge', decisionId: 'decision:test:001',
    repository, headSha, observedAt: '2026-07-10T00:02:00Z',
  });
  const expected = {
    repository,
    pullRequestNumber: 165,
    event: 'pull_request',
    baseSha,
    headSha,
    runId: 101,
    runAttempt: 1,
    acceptedMainTrustRoot,
    testMode: true,
  };
  return {
    expected,
    remoteEvidence,
    finalDecisionReceipt,
  };
}

function refreshRemotePayloadDigest(receipt) {
  const { receiptPayloadDigest: ignored, ...payload } = receipt;
  receipt.receiptPayloadDigest = sha256(canonicalJson(payload));
  return receipt;
}

function fixtureWorkspaceState(changedPaths, salt = 'a') {
  const state = {
    workspaceDigestVersion: V132_WORKSPACE_DIGEST_VERSION,
    contentAddressed: true,
    changedPaths: [...changedPaths],
    untrackedPaths: [],
    committedPatchDigest: sha256(`committed:${salt}`),
    stagedPatchDigest: sha256(`staged:${salt}`),
    unstagedPatchDigest: sha256(`unstaged:${salt}`),
    trackedEntries: changedPaths.map((file) => ({ path: file, fixtureDigest: sha256(`${file}:${salt}`) })),
    untrackedEntries: [],
  };
  state.workspaceStateDigest = calculateWorkspaceStateDigest(state, { baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40) });
  return state;
}

function executeFixturePlan(plan) {
  return executeValidationPlan({
    plan,
    context: {
      repository: 'hiro4649/codex-development-harness',
      headSha: 'b'.repeat(40),
      workspaceIdentity: { status: 'pass', reasonCodes: [] },
      manifestProjection: { status: 'pass', reasonCodes: [], expectedProjectionDigest: sha256('projection') },
      registryObservation: { status: 'not_observed', digest: sha256('not_observed') },
      rollbackChain: { v131: 'immediate_rollback', v130: 'secondary_rollback', v129: 'emergency_legacy_rollback', v128: 'blocking_compatibility', v127: 'readable_compatibility' },
      outputLimits: { compactJsonBytes: 8192, topLevelFieldCount: 64 },
      runLocalChecks: () => ({ status: 'pass', testCount: 1 }),
      runCompatibilityChecks: () => ({ status: 'pass', reasonCodes: [] }),
      deriveCanonicalState: (completed) => deriveCanonicalState({ localValidationPassed: ['workspace_identity', 'manifest_compile', 'changed_file_classification', 'dependency_closure', 'selected_local_checks', 'compatibility_checks'].every((nodeId) => completed.get(nodeId)?.status === 'pass') }),
      runCiCostPlanning: () => ({ status: 'pass', estimatedJobs: 3, estimatedWorkflowRuns: 1 }),
    },
  });
}

test('v132_evidence_truth_local_never_remote', () => {
  const state = deriveCanonicalState({ localValidationPassed: true });
  assert.equal(state.localValidationState, 'passed');
  assert.equal(state.remoteValidationState, 'not_observed');
  assert.equal(state.technicalMergeEligibility, 'blocked');
  assert.equal(state.mergeAllowed, false);
  assert.equal(state.deprecatedLocalTechnicalReady.value, true);
  assert.equal(state.deprecatedLocalTechnicalReady.canOverrideMergeAllowed, false);
});

test('v132_evidence_truth_typed_receipts_authorize_only_exact_state', () => {
  const receipts = validReceipts();
  const state = deriveCanonicalState({ localValidationPassed: true, ...receipts });
  assert.equal(state.remoteValidationState, 'passed');
  assert.equal(state.technicalMergeEligibility, 'eligible');
  assert.equal(state.finalDecisionState, 'authorized');
  assert.equal(state.mergeAllowed, true);
  const invalid = structuredClone(receipts.remoteEvidence);
  invalid.remoteChecksPass = true;
  assert.equal(deriveCanonicalState({ localValidationPassed: true, remoteEvidence: invalid, expected: receipts.expected }).mergeAllowed, false);
  assert.equal(deriveCanonicalState({ localValidationPassed: true, remoteEvidence: receipts.remoteEvidence, expected: { ...receipts.expected, runAttempt: 2 } }).technicalMergeEligibility, 'blocked');
  const plainTypedJson = structuredClone(receipts.remoteEvidence);
  const plainDecision = structuredClone(receipts.finalDecisionReceipt);
  assert.equal(deriveCanonicalState({ localValidationPassed: true, remoteEvidence: plainTypedJson, finalDecisionReceipt: plainDecision, expected: receipts.expected }).mergeAllowed, false);
  assert.equal(deriveCanonicalState({ localValidationPassed: true, remoteEvidence: receipts.remoteEvidence, finalDecisionReceipt: receipts.finalDecisionReceipt, expected: { ...receipts.expected, testMode: false } }).mergeAllowed, false);
  assert.throws(() => collectVerifiedGithubEvidence({
    repository: receipts.expected.repository,
    runId: 1,
    headSha: receipts.expected.headSha,
    checkRuns: [],
  }), /caller_supplied_github_observation_forbidden/);
  const modifiedSerialized = structuredClone(receipts.remoteEvidence);
  modifiedSerialized.runAttempts[0].runAttempt = 2;
  assert.equal(deriveCanonicalState({ localValidationPassed: true, remoteEvidence: modifiedSerialized, expected: receipts.expected }).mergeAllowed, false);
});

test('v132_github_evidence_binds_pr_event_workflow_base_and_head', () => {
  const scenarios = [
    ['remote_pull_request_number_mismatch', (receipt) => { receipt.pullRequestNumber += 1; }],
    ['remote_event_not_pull_request', (receipt) => { receipt.event = 'push'; }],
    ['remote_base_sha_mismatch', (receipt) => { receipt.baseSha = 'd'.repeat(40); }],
    ['remote_head_sha_mismatch', (receipt) => { receipt.headSha = 'd'.repeat(40); }],
    ['workflow_0_not_in_accepted_main_contract', (receipt) => { receipt.workflowRuns[0].workflowPath = '.github/workflows/untrusted.yml'; }],
  ];
  for (const [reason, mutate] of scenarios) {
    const receipts = validReceipts();
    mutate(receipts.remoteEvidence);
    refreshRemotePayloadDigest(receipts.remoteEvidence);
    const state = deriveCanonicalState({ localValidationPassed: true, ...receipts });
    assert.equal(state.mergeAllowed, false, reason);
    assert.ok(state.remoteEvidence.reasonCodes.includes(reason), `${reason}:${state.remoteEvidence.reasonCodes.join(',')}`);
  }
  const receipts = validReceipts();
  const state = deriveCanonicalState({
    localValidationPassed: true,
    ...receipts,
    expected: { ...receipts.expected, requiredCheckNames: [] },
  });
  assert.equal(state.mergeAllowed, false);
  assert.ok(state.remoteEvidence.reasonCodes.includes('candidate_controlled_required_check_list_forbidden'));
});

test('v132_final_decision_serialized_signature_verification', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const repository = 'hiro4649/codex-development-harness';
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const trustRoot = createFixtureTrustRoot({
    repository,
    acceptedMainSha: 'c'.repeat(40),
    publicKeyPem,
    keyId: 'owner-final-key-001',
  });
  const payload = {
    evidenceType: 'final_decision_authorization',
    trustClass: 'explicit_test_fixture',
    testMode: true,
    observationSource: 'explicit_test_final_decision',
    authority: V132_FINAL_AUTHORITY,
    decision: 'allow_merge',
    decisionId: 'decision:signed:001',
    repository,
    headSha: 'a'.repeat(40),
    observedAt: '2026-07-10T00:02:00Z',
    signatureAlgorithm: 'ed25519',
    signingKeyId: 'owner-final-key-001',
    signingKeyFingerprint: trustRoot.finalDecisionKey.publicKeyFingerprint,
    trustRootDigest: trustRootContractDigest(trustRoot),
  };
  const signature = crypto.sign(null, Buffer.from(canonicalJson(payload)), privateKey).toString('base64');
  const serialized = { ...payload, signature };
  serialized.receiptDigest = sha256(canonicalJson(serialized));
  const verified = verifySignedFinalDecisionReceipt(serialized, { trustRoot });
  const evaluation = deriveCanonicalState({ localValidationPassed: true, finalDecisionReceipt: verified, expected: { testMode: true } });
  assert.equal(evaluation.finalDecisionState, 'authorized');
  assert.throws(() => verifySignedFinalDecisionReceipt(serialized, { trustRoot: structuredClone(trustRoot) }), /trusted_root_required/);
  const { publicKey: arbitraryPublicKey } = crypto.generateKeyPairSync('ed25519');
  const arbitraryRoot = createFixtureTrustRoot({
    repository,
    acceptedMainSha: 'c'.repeat(40),
    publicKeyPem: arbitraryPublicKey.export({ type: 'spki', format: 'pem' }),
    keyId: 'owner-final-key-002',
  });
  assert.throws(() => verifySignedFinalDecisionReceipt(serialized, { trustRoot: arbitraryRoot }), /signing_key_id_untrusted/);
  const modified = structuredClone(serialized);
  modified.headSha = 'b'.repeat(40);
  assert.equal(deriveCanonicalState({ localValidationPassed: true, finalDecisionReceipt: modified, expected: { testMode: true } }).finalDecisionState, 'not_authorized');
});

test('v132_billing_lock_is_unavailable_not_code_failure', () => {
  const baseSha = 'b'.repeat(40);
  const headSha = 'a'.repeat(40);
  const receipt = createFixtureGithubEvidence({
    repository: 'hiro4649/codex-development-harness', pullRequestNumber: 165, event: 'pull_request', baseRef: 'main', baseSha, headSha, runId: 1, runAttempt: 1,
    workflowRuns: [{ runId: 1, runAttempt: 1, workflowId: 1001, workflowPath: '.github/workflows/quality-gate.yml', event: 'pull_request', pullRequestNumber: 165, baseSha, headSha }],
    failureClass: 'account_billing_lock', annotationText: 'account billing lock',
    startedAt: '2026-07-10T00:00:00Z', completedAt: '2026-07-10T00:00:01Z', observedAt: '2026-07-10T00:00:02Z',
  });
  const state = deriveCanonicalState({ localValidationPassed: true, remoteEvidence: receipt, expected: { testMode: true } });
  assert.equal(state.remoteValidationState, 'unavailable_billing');
  assert.equal(state.remoteFailureClass, 'account_billing_lock');
  assert.equal(state.mergeAllowed, false);
});

test('v132_unknown_pre_runner_is_not_mislabeled_billing', () => {
  const baseSha = 'b'.repeat(40);
  const headSha = 'a'.repeat(40);
  const receipt = createFixtureGithubEvidence({
    repository: 'hiro4649/codex-development-harness', pullRequestNumber: 165, event: 'pull_request', baseRef: 'main', baseSha, headSha, runId: 2, runAttempt: 1,
    workflowRuns: [{ runId: 2, runAttempt: 1, workflowId: 1001, workflowPath: '.github/workflows/quality-gate.yml', event: 'pull_request', pullRequestNumber: 165, baseSha, headSha }],
    failureClass: 'pre_runner_unavailable',
    startedAt: '2026-07-10T00:00:00Z', completedAt: '2026-07-10T00:00:01Z', observedAt: '2026-07-10T00:00:02Z',
  });
  const state = deriveCanonicalState({ localValidationPassed: true, remoteEvidence: receipt, expected: { testMode: true } });
  assert.equal(state.remoteValidationState, 'unavailable_pre_runner');
  assert.equal(state.remoteFailureClass, 'pre_runner_unavailable');
  assert.equal(state.mergeAllowed, false);
});

test('v132_workspace_identity_origin_and_top_level_fail_closed', () => {
  assert.equal(repositoryFromRemote('git@github.com:hiro4649/codex-development-harness.git'), 'hiro4649/codex-development-harness');
  assert.equal(repositoryFromRemote('https://github.com/hiro4649/codex-development-harness.git'), 'hiro4649/codex-development-harness');
  assert.equal(repositoryFromRemote(''), null);
  assert.equal(repositoryFromRemote('not a url'), null);
  assert.equal(repositoryFromRemote('https://github.com.evil.example/hiro4649/codex-development-harness'), null);
  assert.equal(repositoryFromRemote('https://gitlab.com/hiro4649/codex-development-harness'), null);
  const sourceManifest = strictJson('CODEX_SOURCE_HARNESS_MANIFEST.json');
  const headSha = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  const common = { headSha, baseSha, baseShaExists: true, sourceManifest, repoRoot: ROOT };
  assert.equal(evaluateWorkspaceIdentity({ ...common, remote: '', repository: null, gitTopLevel: ROOT }).status, 'fail');
  assert.equal(evaluateWorkspaceIdentity({ ...common, remote: 'malformed', repository: null, gitTopLevel: ROOT }).status, 'fail');
  assert.equal(evaluateWorkspaceIdentity({ ...common, remote: 'https://github.com/hiro4649/codex-development-harness-lookalike', repository: 'hiro4649/codex-development-harness-lookalike', gitTopLevel: ROOT }).status, 'fail');
  assert.equal(evaluateWorkspaceIdentity({ ...common, remote: 'https://github.com/hiro4649/codex-development-harness', repository: 'hiro4649/codex-development-harness', gitTopLevel: os.tmpdir() }).status, 'fail');
});

test('v132_manifest_strict_duplicate_collision_rejection', () => {
  assert.throws(() => parseJsonStrict('{"a":1,"a":2}'), /exact_duplicate_key/);
  assert.throws(() => parseJsonStrict('{"A":1,"a":2}'), /case_fold_duplicate_key/);
  assert.throws(() => parseJsonStrict('{"a":1,"\\u0061":2}'), /escaped_equivalent_duplicate_key/);
});

test('v132_node_powershell_python_parser_equivalence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v132-parser-'));
  const file = path.join(dir, 'fixture.json');
  fs.writeFileSync(file, '{"schemaVersion":"1.3.2","nested":{"value":7}}\n', 'utf8');
  try {
    const nodeValue = parseJsonStrict(fs.readFileSync(file, 'utf8'));
    const escaped = file.replaceAll("'", "''");
    const powershell = countedSpawnSync(resolvePowerShell(), ['-NoProfile', '-Command', `$x=Get-Content -Raw '${escaped}' | ConvertFrom-Json; Write-Output ($x.schemaVersion+'|'+$x.nested.value)`], { encoding: 'utf8', windowsHide: true });
    const python = countedSpawnSync(resolvePython(), ['-c', 'import json,sys; x=json.load(open(sys.argv[1], encoding="utf-8")); print(x["schemaVersion"]+"|"+str(x["nested"]["value"]))', file], { encoding: 'utf8', windowsHide: true });
    assert.equal(powershell.status, 0, powershell.stderr);
    assert.equal(python.status, 0, python.stderr);
    const expected = `${nodeValue.schemaVersion}|${nodeValue.nested.value}`;
    assert.equal(powershell.stdout.trim(), expected);
    assert.equal(python.stdout.trim(), expected);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('v132_actual_manifests_parser_equivalence', () => {
  for (const relative of ['docs/process/CODEX_V132_POLICY.json', 'CODEX_SOURCE_HARNESS_MANIFEST.json', 'docs/process/CODEX_HARNESS_MANIFEST.json', 'docs/process/CODEX_ACTIVE_POLICY_INDEX.json']) {
    const file = path.join(ROOT, relative);
    const nodeDigest = sha256(canonicalJson(parseJsonStrict(fs.readFileSync(file, 'utf8'))));
    const powershellDigest = sha256(canonicalJson(parseThroughPowerShell(file)));
    const pythonDigest = sha256(canonicalJson(parseThroughPython(file)));
    assert.equal(powershellDigest, nodeDigest, `${relative}:powershell`);
    assert.equal(pythonDigest, nodeDigest, `${relative}:python`);
  }
});

test('v132_manifest_projection_and_registry_inventory', () => {
  const policy = loadV132Policy(ROOT);
  const validation = validateManifestProjections({
    policy,
    sourceManifest: strictJson('CODEX_SOURCE_HARNESS_MANIFEST.json'),
    docsManifest: strictJson('docs/process/CODEX_HARNESS_MANIFEST.json'),
    activePolicy: strictJson('docs/process/CODEX_ACTIVE_POLICY_INDEX.json'),
  });
  assert.equal(validation.status, 'pass', validation.reasonCodes.join(','));
  assert.equal(validateStaticRegistry(policy.staticRegistry).classifiedRepositoryCount, 8);
  assert.equal(policy.staticRegistry.find((entry) => entry.repositoryFullName === 'hiro4649/APS-GATE').profileClass, 'lite_action_target');
  assert.equal(policy.dynamicObservationSchema.persistInStaticRegistry, false);
  for (const manifest of [strictJson('CODEX_SOURCE_HARNESS_MANIFEST.json'), strictJson('docs/process/CODEX_HARNESS_MANIFEST.json'), strictJson('docs/process/CODEX_ACTIVE_POLICY_INDEX.json')]) {
    assert.equal(manifest.sourceCandidateDisplay, 'HARNESS v1.3.2 Evidence-Converged Lean Core');
    assert.equal(manifest.targetInstalledState, 'per_repository_dynamic_observation');
    assert.equal(manifest.targetRolloutState, 'not_started');
    assert.equal(Object.hasOwn(manifest, 'targetHarnessVersion'), false);
    assert.equal(Object.hasOwn(manifest, 'operatorTargetHarnessDisplay'), false);
    assert.equal(Object.hasOwn(manifest, 'installedTargetHarnessVersion'), false);
  }
  assert.match(strictJson('docs/process/CODEX_ACTIVE_POLICY_INDEX.json').profiles.target_compatibility_profile_install.profilePurpose, /v1\.3\.2 Compatibility Adapter/);
  assert.ok(compileEffectivePolicy(policy).compactCanonicalBytes <= 8192);
  assert.equal(harnessVersion.activeHarnessVersion, '1.3.2');
  assert.equal(harnessVersion.activeSelfTestSuite, 'v132');
  assert.deepEqual(harnessVersion.versionAuthority, {
    v132: 'local_source_candidate', v131: 'immediate_rollback', v130: 'secondary_rollback',
    v129: 'emergency_legacy_rollback', v128: 'blocking_compatibility', v127: 'readable_compatibility',
  });
  const agents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
  assert.ok(agents.includes('Decision Capsule is a non-authoritative domain projection'));
  assert.ok(agents.includes('Final Decision remains the authority'));
});

test('v132_incremental_validation_resume_and_invalidation', () => {
  const policy = loadV132Policy(ROOT);
  const changedFiles = ['scripts/codex-v132-self-test.mjs'];
  const args = { repository: 'hiro4649/codex-development-harness', profile: 'source_control_plane', baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40), changedFiles, workspaceState: fixtureWorkspaceState(changedFiles), policy, registry: policy.staticRegistry, workflowInputs: { 'quality-gate.yml': sha256('workflow-a') } };
  const first = planIncrementalValidation(args);
  const execution = executeFixturePlan(first);
  assert.equal(execution.status, 'pass', execution.failureCodes.join(','));
  assert.equal(execution.executedNodeCount, 10);
  const receipt = createValidationReceipt({ plan: first, repository: args.repository, baseSha: args.baseSha, headSha: args.headSha, completedNodeResults: execution.completedNodeResults });
  const resumed = planIncrementalValidation({ ...args, previousReceipt: receipt });
  assert.ok(resumed.exactHeadNodeSkipRate >= 0.7, String(resumed.exactHeadNodeSkipRate));
  assert.equal(resumed.skippedNodeCount, 7);
  assert.equal(resumed.selectedNodeCount, 3);
  assert.equal(validateResumeReceipt(receipt, { ...args, ...first.digests, headSha: 'c'.repeat(40) }).resumeAllowed, false);
  const unknownPaths = ['backend/server.ts'];
  const unknown = planIncrementalValidation({ ...args, changedFiles: unknownPaths, workspaceState: fixtureWorkspaceState(unknownPaths, 'unknown') });
  assert.equal(unknown.status, 'full_gate_required');
  assert.equal(unknown.selectedNodeCount, 10);
  assert.throws(() => createValidationReceipt({ plan: first, repository: args.repository, baseSha: args.baseSha, headSha: args.headSha, completedNodeResults: [{ nodeId: 'workspace_identity', status: 'pass', inputDigest: first.selectedNodes[0].inputDigest }] }), /unattested_node/);

  const forged = structuredClone(receipt);
  forged.completedNodes.find((node) => node.nodeId === 'workspace_identity').output.repository = 'forged/repository';
  const forgedPlan = planIncrementalValidation({ ...args, previousReceipt: forged });
  assert.equal(forgedPlan.reusedNodes.some((node) => node.nodeId === 'workspace_identity'), false);

  const oldExecutor = structuredClone(receipt);
  oldExecutor.completedNodes.find((node) => node.nodeId === 'manifest_compile').executorVersion = `${V132_NODE_EXECUTOR_VERSION}-old`;
  const executorPlan = planIncrementalValidation({ ...args, previousReceipt: oldExecutor });
  assert.equal(executorPlan.reusedNodes.some((node) => node.nodeId === 'manifest_compile'), false);

  const workflowChanged = planIncrementalValidation({ ...args, workflowInputs: { 'quality-gate.yml': sha256('workflow-b') }, previousReceipt: receipt });
  assert.equal(workflowChanged.selectedNodes.some((node) => node.nodeId === 'ci_cost_planning'), true);

  const evidenceA = planIncrementalValidation({ ...args, evidenceReceipt: { receiptDigest: sha256('a') } });
  const evidenceB = planIncrementalValidation({ ...args, evidenceReceipt: { receiptDigest: sha256('b') } });
  assert.notEqual(evidenceA.selectedNodes.find((node) => node.nodeId === 'evidence_truth_projection').inputDigest, evidenceB.selectedNodes.find((node) => node.nodeId === 'evidence_truth_projection').inputDigest);
  assert.equal(receipt.completedNodes.every((node) => node.outputDigest === sha256(canonicalJson(node.output))), true);
});

test('v132_workspace_content_digest_invalidates_same_path_and_untracked', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v132-workspace-'));
  const runGit = (args) => {
    const result = countedSpawnSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, String(result.stderr || result.stdout));
    return String(result.stdout || '').trim();
  };
  try {
    runGit(['init']);
    runGit(['config', 'user.email', 'v132-self-test@example.invalid']);
    runGit(['config', 'user.name', 'v132-self-test']);
    fs.mkdirSync(path.join(dir, 'scripts'));
    fs.writeFileSync(path.join(dir, 'scripts', 'fixture.mjs'), 'export const value = 1;\n');
    runGit(['add', '.']);
    runGit(['commit', '-m', 'fixture']);
    const headSha = runGit(['rev-parse', 'HEAD']);
    fs.writeFileSync(path.join(dir, 'scripts', 'fixture.mjs'), 'export const value = 2;\n');
    const firstState = collectWorkspaceState({ repoRoot: dir, baseSha: headSha, headSha, accounting: selfTestAccounting });
    const policy = loadV132Policy(ROOT);
    const args = { repository: 'hiro4649/codex-development-harness', baseSha: headSha, headSha, workspaceState: firstState, policy, registry: policy.staticRegistry };
    const firstPlan = planIncrementalValidation(args);
    const execution = executeFixturePlan(firstPlan);
    const receipt = createValidationReceipt({ plan: firstPlan, repository: args.repository, baseSha: headSha, headSha, completedNodeResults: execution.completedNodeResults });
    fs.writeFileSync(path.join(dir, 'scripts', 'fixture.mjs'), 'export const value = 3;\n');
    const secondState = collectWorkspaceState({ repoRoot: dir, baseSha: headSha, headSha, accounting: selfTestAccounting });
    assert.notEqual(secondState.workspaceStateDigest, firstState.workspaceStateDigest);
    const changedContentPlan = planIncrementalValidation({ ...args, workspaceState: secondState, previousReceipt: receipt });
    assert.equal(changedContentPlan.receiptValidation.resumeAllowed, false);
    assert.equal(changedContentPlan.selectedNodeCount, 10);
    fs.writeFileSync(path.join(dir, 'untracked.txt'), 'new evidence boundary\n');
    const untrackedState = collectWorkspaceState({ repoRoot: dir, baseSha: headSha, headSha, accounting: selfTestAccounting });
    assert.notEqual(untrackedState.workspaceStateDigest, secondState.workspaceStateDigest);
    assert.ok(untrackedState.changedPaths.includes('untracked.txt'));
    assert.ok(untrackedState.untrackedPaths.includes('untracked.txt'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('v132_context_cache_envelope_limits', () => {
  const envelope = buildContextCacheEnvelope({ immutableCore: 'a'.repeat(3000), compiledRepoPolicy: 'b'.repeat(3000), taskDelta: 'c'.repeat(3000), evidenceCapsule: 'd'.repeat(3000) });
  assert.deepEqual(envelope.sections.map((entry) => entry.bytes), [1536, 1536, 2048, 2048]);
  assert.equal(envelope.totalBytes, 7168);
  assert.equal(envelope.fullManifestLoaded, false);
  assert.equal(envelope.fullConversationReplay, false);
});

test('v132_target_allowlist_rejects_nested_product_paths', () => {
  const policy = loadV132Policy(ROOT);
  const rejected = [
    'packages/web/src/index.ts', 'packages/app/apps/client.ts', 'staging/CODEX_SOURCE_HARNESS_MANIFEST.json',
    'packages/app/package.json', 'packages/app/package-lock.json', 'src/runtime/server.ts', 'contracts/Token.sol',
    'deploy/mainnet.mjs', '.env.production', 'wallet/keys.json', 'rpc/provider.json', 'secrets/token.txt',
  ];
  const plan = planTargetInstallDryRun({ profileClass: 'metadata_gate_target', changedFiles: rejected, policy });
  assert.equal(plan.status, 'fail_closed');
  assert.equal(plan.rejectedExactCount, rejected.length);
  assert.equal(plan.knownFixtureFalseNegativeCount, 0);
  const allowed = planTargetInstallDryRun({ profileClass: 'metadata_gate_target', changedFiles: ['AGENTS.md', 'scripts/codex-v132-self-test.mjs'], policy });
  assert.equal(allowed.status, 'pass');
});

test('v132_ci_cost_and_debt_closure', () => {
  const ci = planCiCost({ repoRoot: ROOT, changeClass: 'source_core' });
  assert.equal(ci.status, 'pass');
  assert.equal(ci.estimatedJobs, 4);
  assert.equal(ci.estimatedWorkflowRuns, 2);
  assert.deepEqual(ci.workflowNames, ['quality-gate.yml', 'v132-compatibility-gate.yml']);
  assert.equal(ci.confidence, 'parsed_from_workflow_files');
  assert.equal(ci.pullRequestEditedTriggersHeavyWorkflow, false);
  assert.equal(planCiCost({ repoRoot: ROOT, duplicateEvidenceRefresh: true }).estimatedJobs, 0);
  const debt = validateCompatibilityDebtClosure([{ mustReviewBefore: '1.3.2', disposition: 'reclassified_with_reason', reason: 'adapter obligation retained', silentExtension: false }]);
  assert.equal(debt.status, 'pass');
  assert.equal(validateCompatibilityDebtClosure([{ mustReviewBefore: '1.3.2' }]).status, 'fail');
});

test('v132_long_run_budget_is_bounded', () => {
  assert.equal(evaluateLongRunBudget({ wallClockMinutes: 119, toolCalls: 299, fileWrites: 99, retryPerNode: 1, parallelAgentRuntime: 1 }).status, 'within_budget');
  assert.equal(evaluateLongRunBudget({ toolCalls: 301 }).status, 'checkpoint_stop');
});

test('v132_compatibility_projection_is_active_tuple_neutral', () => {
  for (const lane of ['immediate-secondary', 'emergency', 'blocking-readable', 'all']) {
    const result = runV132CompatibilityCheck({ repoRoot: ROOT, lane });
    assert.equal(result.status, 'pass', `${lane}:${result.reasonCodes.join(',')}`);
    assert.equal(result.historicalSelfTestsExecutedAsActiveTuple, false);
    assert.equal(result.sourcePresentStatus, 'pass');
    assert.equal(result.projectionValidStatus, 'pass');
    assert.equal(result.behaviorInvariantsStatus, 'pass');
    assert.equal(result.boundedBehaviorInvariantsExecuted, true);
    assert.equal(result.compatibilityEvidence.every((entry) => entry.executionMode === 'bounded_pure_behavior_contracts'), true);
    assert.equal(result.compatibilityEvidence.every((entry) => entry.behaviorInvariantCount >= 2), true);
  }
});

test('v132_compact_output_bounds_and_canonical_fields', () => {
  const canonicalState = deriveCanonicalState({ localValidationPassed: true });
  const plan = planIncrementalValidation();
  const decision = buildDecisionCapsuleV3({ repository: 'hiro4649/codex-development-harness', headSha: 'a'.repeat(40), canonicalState, nextSafeAction: 'wait_for_remote' });
  const summary = buildSafeSummary({ repository: 'hiro4649/codex-development-harness', headSha: 'a'.repeat(40), canonicalState, nextSafeAction: 'wait_for_remote' });
  const orchestration = buildOrchestrationReceipt({ plan, repository: 'hiro4649/codex-development-harness', baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40) });
  assert.ok(measureJson(decision).bytes <= V132_OUTPUT_LIMITS.decisionCapsuleBytes);
  assert.ok(measureJson(summary).bytes <= V132_OUTPUT_LIMITS.safeSummaryBytes);
  assert.ok(measureJson(orchestration).bytes <= V132_OUTPUT_LIMITS.orchestrationReceiptBytes);
  const compact = finalizeCompactOutput({ schemaVersion: V132_VERSION, repository: 'x', headSha: 'a'.repeat(40), localValidationState: 'passed', remoteValidationState: 'not_observed', technicalMergeEligibility: 'blocked', finalDecisionState: 'not_authorized', mergeAllowed: false, selectedNodeCount: 1, skippedNodeCount: 0, blockerCodes: [], nextSafeAction: 'wait' });
  assert.ok(measureJson(compact).bytes <= V132_OUTPUT_LIMITS.compactJsonBytes);
  assert.ok(measureJson(compact).topLevelFields <= 64);
  assert.equal(Object.hasOwn(compact, 'mergeReady'), false);
});

test('v132_workflow_heavy_trigger_excludes_edited', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/quality-gate.yml'), 'utf8');
  const typesLine = workflow.split(/\r?\n/).find((line) => line.includes('types:')) || '';
  assert.equal(typesLine.includes('edited'), false);
});

test('v132_workflow_runner_accepts_compact_technical_pass', () => {
  const previous = process.env.CODEX_SKIP_V132_SELF_TEST;
  process.env.CODEX_SKIP_V132_SELF_TEST = '1';
  try {
    const { report } = runV132SourceQualityGate({ repoRoot: ROOT, diagnostics: false });
    accountNestedExecution(report);
    const result = evaluateV132CompactWorkflowReport(report, { gateExit: 0 });
    assert.equal(result.status, 'pass', result.failures.join(','));
    assert.equal(result.technicalRequiredCheckPassed, true);
    assert.equal(result.mergeAllowed, false);
    assert.equal(evaluateV132CompactWorkflowReport(report, { gateExit: 7 }).status, 'fail');
    assert.equal(evaluateV132CompactWorkflowReport(report, { gateExit: 0, expectedRepository: 'wrong/repository' }).status, 'fail');
    assert.equal(evaluateV132CompactWorkflowReport(report, { gateExit: 0, expectedHeadSha: 'f'.repeat(40) }).status, 'fail');
    const remoteContradiction = { ...structuredClone(report), remoteValidationState: 'failed', remoteEvidenceStatus: 'fail', technicalMergeEligibility: 'eligible' };
    assert.equal(evaluateV132CompactWorkflowReport(remoteContradiction, { gateExit: 0 }).status, 'fail');
    const unobservedEligible = { ...structuredClone(report), remoteValidationState: 'not_observed', technicalMergeEligibility: 'eligible' };
    assert.equal(evaluateV132CompactWorkflowReport(unobservedEligible, { gateExit: 0 }).status, 'fail');
    const unauthorizedEvidence = { ...structuredClone(report), finalDecisionState: 'authorized', finalDecisionEvidenceStatus: 'not_observed' };
    assert.equal(evaluateV132CompactWorkflowReport(unauthorizedEvidence, { gateExit: 0 }).status, 'fail');
    const missingExecutionAttestation = structuredClone(report);
    missingExecutionAttestation.executionAttestationStatus.status = 'fail';
    assert.equal(evaluateV132CompactWorkflowReport(missingExecutionAttestation, { gateExit: 0 }).status, 'fail');
  } finally {
    if (previous === undefined) delete process.env.CODEX_SKIP_V132_SELF_TEST;
    else process.env.CODEX_SKIP_V132_SELF_TEST = previous;
  }
});

test('v132_source_gate_end_to_end_local_only', () => {
  const previous = process.env.CODEX_SKIP_V132_SELF_TEST;
  process.env.CODEX_SKIP_V132_SELF_TEST = '1';
  try {
    const { report, exitCode } = runV132SourceQualityGate({ repoRoot: ROOT, diagnostics: false });
    accountNestedExecution(report);
    assert.equal(exitCode, 0, report.blockerCodes.join(','));
    assert.equal(report.status, 'pass');
    assert.equal(report.localValidationState, 'passed');
    assert.equal(report.remoteValidationState, 'not_observed');
    assert.equal(report.technicalMergeEligibility, 'blocked');
    assert.equal(report.mergeAllowed, false);
    assert.equal(report.authorityCreated, false);
    assert.equal(report.targetMutationCount, 0);
    assert.equal(report.remoteUnobservedPassCount, 0);
    assert.equal(report.longRunBudgetStatus.status, 'within_budget');
    assert.ok(report.executionAccounting.subprocessExecutions > 0);
    assert.equal(report.executionAccounting.toolCalls, report.executionAccounting.subprocessExecutions);
    assert.equal(report.validationCoverage.nodeCount, 10);
    assert.match(report.validationCoverage.coverageDigest, /^sha256:[a-f0-9]{64}$/);
    assert.equal(report.validationCoverage.derivation, 'executed_or_attested_node_output_digests');
    assert.ok(Buffer.byteLength(JSON.stringify(report), 'utf8') <= 8192);
  } finally {
    if (previous === undefined) delete process.env.CODEX_SKIP_V132_SELF_TEST;
    else process.env.CODEX_SKIP_V132_SELF_TEST = previous;
  }
});

const failures = results.filter((result) => result.status === 'fail');
const report = {
  schemaVersion: V132_VERSION,
  status: failures.length ? 'fail' : 'pass',
  stage: process.argv.find((arg) => arg.startsWith('--stage='))?.slice(8) || 'all',
  testCount: results.length,
  passCount: results.length - failures.length,
  failCount: failures.length,
  failures,
  authorityCreated: false,
  targetMutationCount: 0,
  PerformanceTrack: 'deferred',
  superiorityClaimState: 'not_proven',
  executionAccounting: selfTestAccounting,
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.length ? 1 : 0;
