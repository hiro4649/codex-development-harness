#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  aggregateGithubRunObservations,
  buildRequiredCheckTrustSnapshot,
  calculateMergeContextDigest,
  canonicalJson,
  collectAcceptedMainTrustRoot,
  collectVerifiedGithubEvidence,
  createFixtureGithubHttpClient,
  createFixtureFinalDecision,
  createFixtureGithubEvidence,
  createFixtureTrustRoot,
  deriveCanonicalState,
  effectiveTrustRootDigest,
  readArtifactZipEntry,
  reobserveSerializedGithubEvidence,
  sha256,
  trustRootContractDigest,
  validateAcceptedMainIdentityObservation,
  validateCanonicalState,
  validateObservedTrustRootEnvelope,
  verifySignedFinalDecisionReceipt,
  V132_ARTIFACT_LIMITS,
  V132_FINAL_AUTHORITY,
  V132_SOURCE_DEFAULT_BRANCH,
  V132_SOURCE_REPOSITORY,
  V132_TRUST_ROOT_PATH,
  V132_VERSION,
} from './codex-v132-evidence-truth.mjs';
import { runCollectorCli } from './codex-v132-collect-remote-evidence.mjs';
import {
  compileEffectivePolicy,
  deriveCandidateLifecycleState,
  loadV132Policy,
  parseJsonStrict,
  readJsonStrict,
  validateManifestProjections,
  validateStaticRegistry,
  validateCandidateLifecycleTransition,
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
import { evaluateObservedWorkspaceScope, evaluateWorkspaceIdentity, repositoryFromRemote, runV132SourceQualityGate } from './codex-v132-quality-gate.mjs';
import { runV132CompatibilityCheck } from './codex-v132-compatibility-check.mjs';
import { buildV132WorkflowSummaryLines, evaluateV132CompactWorkflowReport } from './codex-workflow-quality-runner.mjs';
import { buildVerificationMetrics } from './codex-v132-benchmark.mjs';
import * as harnessVersion from './codex-harness-version.mjs';

const ROOT = process.cwd();
const results = [];
const pendingTests = [];
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
    const value = fn();
    if (value && typeof value.then === 'function') {
      pendingTests.push(value.then(
        () => results.push({ id, status: 'pass' }),
        (error) => results.push({ id, status: 'fail', reason: String(error?.message || error).slice(0, 400) }),
      ));
    } else {
      results.push({ id, status: 'pass' });
    }
  } catch (error) {
    results.push({ id, status: 'fail', reason: String(error.message || error).slice(0, 400) });
  }
}

function strictJson(file) {
  return readJsonStrict(path.join(ROOT, file));
}

function workflowJobSegments(text) {
  const jobsIndex = text.search(/^jobs:\s*$/m);
  assert.ok(jobsIndex >= 0, 'workflow_jobs_block_missing');
  const jobsBlock = text.slice(jobsIndex);
  const matches = [...jobsBlock.matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm)];
  return matches.map((match, index) => ({
    jobId: match[1],
    text: jobsBlock.slice(match.index, matches[index + 1]?.index ?? jobsBlock.length),
  }));
}

function assertExactHeadWorkflowJobs(relativePath, expectedJobCount) {
  const workflow = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  const jobs = workflowJobSegments(workflow);
  assert.equal(jobs.length, expectedJobCount, `${relativePath}:job_count`);
  for (const { jobId, text } of jobs) {
    const starts = [...text.matchAll(/^      - /gm)];
    const steps = starts.map((match, index) => text.slice(match.index, starts[index + 1]?.index ?? text.length));
    const checkoutIndex = steps.findIndex((step) => step.includes('actions/checkout@'));
    assert.ok(checkoutIndex >= 0, `${relativePath}:${jobId}:checkout_missing`);
    assert.match(steps[checkoutIndex], /ref:\s*\$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
    assert.match(steps[checkoutIndex], /fetch-depth:\s*0/);
    assert.match(steps[checkoutIndex], /persist-credentials:\s*false/);
    const assertion = steps[checkoutIndex + 1] || '';
    assert.match(assertion, /name:\s*Assert exact checkout head and current base/);
    assert.match(assertion, /CODEX_EXPECTED_HEAD_SHA:\s*\$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
    assert.match(assertion, /git rev-parse HEAD/);
    assert.match(assertion, /v132_workflow_checkout_head_mismatch/);
    assert.match(assertion, /CODEX_PR_BASE_SHA:\s*\$\{\{ github\.event\.pull_request\.base\.sha \|\| '' \}\}/);
    assert.match(assertion, /git merge-base --is-ancestor "\$CODEX_PR_BASE_SHA" HEAD/);
    assert.match(assertion, /v132_workflow_base_not_ancestor_of_head/);
    assert.match(assertion, /exit 1/);
  }
  return { workflow, jobs };
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

function validReceipts({ rulesetBinding = null, requiredAppId = null } = {}) {
  const repository = 'hiro4649/codex-development-harness';
  const headSha = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  const { publicKey } = crypto.generateKeyPairSync('ed25519');
  const acceptedMainTrustRoot = createFixtureTrustRoot({
    repository,
    trustSourceHeadSha: 'c'.repeat(40),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    requiredWorkflows: [{
      workflowId: 1001,
      path: '.github/workflows/quality-gate.yml',
      workflowContentDigest: sha256('fixture-workflow:quality-gate'),
      reusableWorkflowRef: null,
      rulesetBinding,
    }],
  });
  const requiredCheckTrustRoot = buildRequiredCheckTrustSnapshot({
    repository,
    baseRef: 'main',
    classicProtection: rulesetBinding ? null : {
      strict: true,
      contexts: requiredAppId == null ? ['quality-gate'] : [],
      checks: requiredAppId == null ? [] : [{ context: 'quality-gate', app_id: requiredAppId }],
    },
    rulesetRules: rulesetBinding ? [{
      ruleset_id: 42,
      ruleset_source_type: 'Repository',
      ruleset_source: repository,
      type: 'workflows',
      parameters: { workflows: [{
        path: rulesetBinding.path,
        ref: rulesetBinding.ref,
        sha: rulesetBinding.sha,
        repository_id: rulesetBinding.repositoryId,
      }] },
    }] : null,
    observedAt: '2026-07-10T00:00:00Z',
  });
  const workflowContentDigest = acceptedMainTrustRoot.document.workflowContract.requiredWorkflows[0].workflowContentDigest;
  const mergeContextDigest = calculateMergeContextDigest({
    repository,
    pullRequestNumber: 165,
    baseSha,
    headSha,
    acceptedMainTrustRootDigest: trustRootContractDigest(acceptedMainTrustRoot),
  });
  const boundValues = { repository, headSha, status: 'pass' };
  const remoteEvidence = createFixtureGithubEvidence({
    repository, pullRequestNumber: 165, event: 'pull_request', baseRef: 'main', baseSha, headSha, runId: 101, runAttempt: 1,
    workflowRuns: [{
      runId: 101, runAttempt: 1, workflowId: 1001, workflowPath: '.github/workflows/quality-gate.yml',
      event: 'pull_request', pullRequestNumber: 165, baseSha, headSha, conclusion: 'success', workflowContentDigest, reusableWorkflowRefs: [], rulesetBinding,
    }],
    startedAt: '2026-07-10T00:00:00Z', completedAt: '2026-07-10T00:01:00Z', observedAt: '2026-07-10T00:01:01Z',
    conclusion: 'success',
    requiredCheckTrustRoot,
    acceptedMainTrustRoot,
    checkRuns: [{ checkRunId: 202, name: 'quality-gate', appId: requiredAppId, conclusion: 'success', headSha }],
    artifacts: [{
      artifactId: 303,
      name: 'safe-summary',
      sizeInBytes: 123,
      contentDigest: sha256('safe-artifact'),
      workflowPath: '.github/workflows/quality-gate.yml',
      entryPath: 'safe-summary.json',
      schemaVersion: V132_VERSION,
      semanticDigest: sha256('safe-summary-payload'),
      boundValues,
      valueBindingDigest: sha256(canonicalJson(boundValues)),
    }],
  });
  const finalDecisionReceipt = createFixtureFinalDecision({
    authority: V132_FINAL_AUTHORITY, decision: 'allow_merge', decisionId: 'decision:test:001',
    repository, pullRequestNumber: 165, baseSha, headSha, mergeContextDigest, observedAt: '2026-07-10T00:02:00Z',
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
    mergeContextDigest,
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

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const payload = Buffer.from(entry.payload || '');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(payload.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(payload.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, name);
    localOffset += local.length + name.length + payload.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function createCollectorMockScenario(mode = 'pass') {
  const repository = V132_SOURCE_REPOSITORY;
  const repositoryId = 1243452288;
  const pullRequestNumber = 165;
  const mainSha = 'c'.repeat(40);
  const baseSha = 'b'.repeat(40);
  const headSha = 'a'.repeat(40);
  const oldHeadSha = 'e'.repeat(40);
  const appId = 15368;
  const qualityPath = '.github/workflows/quality-gate.yml';
  const compatibilityPath = '.github/workflows/v132-compatibility-gate.yml';
  const qualityText = 'name: quality-gate\non: pull_request\njobs:\n  quality-gate:\n    runs-on: ubuntu-latest\n';
  const compatibilityText = 'name: v132-compatibility-gate\non: pull_request\njobs:\n  aggregate-contract:\n    runs-on: ubuntu-latest\n';
  const requiredFieldValues = { repository: '$repository', headSha: '$headSha', status: 'pass' };
  const { publicKey } = crypto.generateKeyPairSync('ed25519');
  const seed = createFixtureTrustRoot({
    repository,
    trustSourceHeadSha: mainSha,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    requiredWorkflows: [
      { workflowId: 1001, path: qualityPath, workflowContentDigest: sha256(qualityText), reusableWorkflowRef: null },
      { workflowId: 1002, path: compatibilityPath, workflowContentDigest: sha256(compatibilityText), reusableWorkflowRef: null },
    ],
    requiredArtifacts: [
      { name: 'quality-safe', workflowPath: qualityPath, entryPath: 'quality.json', schemaVersion: V132_VERSION, requiredFields: ['schemaVersion', 'repository', 'headSha', 'status'], requiredFieldValues },
      { name: 'compat-safe', workflowPath: compatibilityPath, entryPath: 'compat.json', schemaVersion: V132_VERSION, requiredFields: ['schemaVersion', 'repository', 'headSha', 'status'], requiredFieldValues },
    ],
  });
  const trustBytes = Buffer.from(`${JSON.stringify(seed.document, null, 2)}\n`, 'utf8');
  const trustBlobSha = crypto.createHash('sha1').update(Buffer.from(`blob ${trustBytes.length}\0`)).update(trustBytes).digest('hex');
  const payload = (entryPath) => Buffer.from(JSON.stringify({ schemaVersion: V132_VERSION, repository, headSha, status: 'pass', entryPath }));
  const archives = new Map([
    ['/artifacts/quality.zip', createStoredZip([{ name: 'quality.json', payload: payload('quality.json') }])],
    ['/artifacts/compat.zip', createStoredZip([{ name: 'compat.json', payload: payload('compat.json') }])],
  ]);
  const digest = (bytes) => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
  const pullRequests = [{ number: pullRequestNumber }];
  const run = ({ id, workflowId, runNumber, attempt = 1, status = 'completed', conclusion = 'success', runHeadSha = headSha }) => ({
    id,
    workflow_id: workflowId,
    run_number: runNumber,
    run_attempt: attempt,
    event: 'pull_request',
    head_sha: runHeadSha,
    conclusion,
    status,
    pull_requests: pullRequests,
    created_at: `2026-07-10T00:${String(runNumber).padStart(2, '0')}:00Z`,
    run_started_at: `2026-07-10T00:${String(runNumber).padStart(2, '0')}:00Z`,
    updated_at: `2026-07-10T00:${String(runNumber).padStart(2, '0')}:30Z`,
  });
  const unavailable = ['billing', 'pre_runner'].includes(mode);
  const pendingStatus = ['queued', 'in_progress'].includes(mode) ? mode : null;
  const canceled = mode === 'canceled';
  const qualityLatestConclusion = pendingStatus ? null : canceled ? 'cancelled' : mode === 'newer_failure' || unavailable ? 'failure' : 'success';
  const compatibilityConclusion = pendingStatus ? null : canceled ? 'cancelled' : unavailable ? 'failure' : 'success';
  const qualityOld = run({ id: 101, workflowId: 1001, runNumber: 10, conclusion: 'success', runHeadSha: mode === 'old_head' ? oldHeadSha : headSha });
  const qualityLatest = run({ id: 102, workflowId: 1001, runNumber: 11, status: pendingStatus || 'completed', conclusion: qualityLatestConclusion, runHeadSha: mode === 'old_head' ? oldHeadSha : headSha });
  const compatibilityLatest = run({ id: 201, workflowId: 1002, runNumber: 20, status: pendingStatus || 'completed', conclusion: compatibilityConclusion });
  const workflowRuns = [qualityOld, qualityLatest, compatibilityLatest];
  const runsById = new Map(workflowRuns.map((item) => [item.id, item]));
  const calls = [];
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
  const text = (value) => new Response(value, { status: 200, headers: { 'content-type': 'text/plain' } });
  const jobFor = (selectedRun) => {
    const isQuality = selectedRun.workflow_id === 1001;
    const jobId = isQuality ? 1102 : 1201;
    const name = isQuality ? 'quality-gate' : 'aggregate contract';
    return {
      id: jobId,
      name,
      conclusion: selectedRun.conclusion,
      steps: unavailable || pendingStatus ? [] : [{ name: 'run', conclusion: selectedRun.conclusion }],
      runner_name: unavailable || pendingStatus ? null : 'GitHub Actions 1',
    };
  };
  const httpClient = createFixtureGithubHttpClient(async (input, options = {}) => {
    const url = new URL(String(input));
    calls.push(`${options.method || 'GET'} ${url.pathname}${url.search}`);
    if (url.pathname === `/repos/${repository}`) return json({ id: repositoryId, full_name: repository, default_branch: 'main' });
    if (url.pathname === `/repos/${repository}/branches/main`) return json({ name: 'main', commit: { sha: mainSha } });
    if ([
      `/repos/${repository}/branches/main/protection/required_status_checks`,
      `/repos/${repository}/branches/codex%2Fv131-base/protection/required_status_checks`,
    ].includes(url.pathname)) {
      return json({ strict: true, contexts: [], checks: [{ context: 'quality-gate', app_id: appId }, { context: 'aggregate contract', app_id: appId }] });
    }
    if ([`/repos/${repository}/rules/branches/main`, `/repos/${repository}/rules/branches/codex%2Fv131-base`].includes(url.pathname)) return json({}, 404);
    if (url.pathname === `/repos/${repository}/contents/${V132_TRUST_ROOT_PATH}`) {
      return json({ type: 'file', path: V132_TRUST_ROOT_PATH, encoding: 'base64', sha: trustBlobSha, content: trustBytes.toString('base64') });
    }
    if (url.pathname === `/repos/${repository}/pulls/${pullRequestNumber}`) {
      return json({ number: pullRequestNumber, state: 'open', merged: false, base: { ref: 'codex/v131-base', sha: baseSha, repo: { full_name: repository } }, head: { ref: 'codex/v132-candidate', sha: headSha, repo: { full_name: repository } } });
    }
    if (url.pathname === `/repos/${repository}/compare/${baseSha}...${headSha}`) {
      return mode === 'base_not_ancestor'
        ? json({ status: 'diverged', base_commit: { sha: baseSha }, merge_base_commit: { sha: 'd'.repeat(40) } })
        : json({ status: 'ahead', ahead_by: 1, behind_by: 0, base_commit: { sha: baseSha }, merge_base_commit: { sha: baseSha } });
    }
    if (url.pathname === `/repos/${repository}/actions/runs`) return json({ total_count: workflowRuns.length, workflow_runs: workflowRuns });
    const runMatch = url.pathname.match(new RegExp(`^/repos/${repository}/actions/runs/(\\d+)$`));
    if (runMatch) return json(runsById.get(Number(runMatch[1])));
    const jobsMatch = url.pathname.match(new RegExp(`^/repos/${repository}/actions/runs/(\\d+)/jobs$`));
    if (jobsMatch) return json({ jobs: [jobFor(runsById.get(Number(jobsMatch[1])))] });
    const artifactsMatch = url.pathname.match(new RegExp(`^/repos/${repository}/actions/runs/(\\d+)/artifacts$`));
    if (artifactsMatch) {
      const selectedRun = runsById.get(Number(artifactsMatch[1]));
      if (selectedRun.conclusion !== 'success') return json({ artifacts: [] });
      const quality = selectedRun.workflow_id === 1001;
      const archive = archives.get(quality ? '/artifacts/quality.zip' : '/artifacts/compat.zip');
      return json({ artifacts: [{ id: quality ? 301 : 302, name: quality ? 'quality-safe' : 'compat-safe', size_in_bytes: archive.length, digest: digest(archive), expired: false, archive_download_url: `https://api.github.test${quality ? '/artifacts/quality.zip' : '/artifacts/compat.zip'}` }] });
    }
    if (url.pathname === `/repos/${repository}/actions/workflows/1001`) return json({ id: 1001, path: qualityPath });
    if (url.pathname === `/repos/${repository}/actions/workflows/1002`) return json({ id: 1002, path: compatibilityPath });
    if (url.pathname === `/repos/${repository}/contents/${qualityPath}`) return text(qualityText);
    if (url.pathname === `/repos/${repository}/contents/${compatibilityPath}`) return text(compatibilityText);
    const checkMatch = url.pathname.match(new RegExp(`^/repos/${repository}/check-runs/(\\d+)$`));
    if (checkMatch) return json({ id: Number(checkMatch[1]), app: { id: appId } });
    const annotationMatch = url.pathname.match(new RegExp(`^/repos/${repository}/check-runs/(\\d+)/annotations$`));
    if (annotationMatch) {
      if (mode === 'billing') return json([{ message: 'The job was not started because your account is locked due to a billing issue.' }]);
      if (mode === 'pre_runner') return json([{ message: 'The job could not be assigned to a runner.' }]);
      return json([]);
    }
    if (archives.has(url.pathname)) return new Response(archives.get(url.pathname), { status: 200 });
    throw new Error(`unexpected_mock_github_request:${url.pathname}${url.search}`);
  });
  return { repository, pullRequestNumber, mainSha, baseSha, headSha, httpClient, calls };
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

test('v132_release_context_rejects_base_advance_after_remote_and_final_evidence', () => {
  const receipts = validReceipts();
  const advancedBaseSha = 'd'.repeat(40);
  const advancedMergeContextDigest = calculateMergeContextDigest({
    repository: receipts.expected.repository,
    pullRequestNumber: receipts.expected.pullRequestNumber,
    baseSha: advancedBaseSha,
    headSha: receipts.expected.headSha,
    acceptedMainTrustRootDigest: trustRootContractDigest(receipts.expected.acceptedMainTrustRoot),
  });
  const state = deriveCanonicalState({
    localValidationPassed: true,
    remoteEvidence: receipts.remoteEvidence,
    finalDecisionReceipt: receipts.finalDecisionReceipt,
    expected: { ...receipts.expected, baseSha: advancedBaseSha, mergeContextDigest: advancedMergeContextDigest },
  });
  assert.equal(state.remoteValidationState, 'stale');
  assert.equal(state.finalDecisionState, 'not_authorized');
  assert.equal(state.mergeAllowed, false);
  assert.ok(state.remoteEvidence.reasonCodes.includes('remote_base_sha_mismatch'));
  assert.ok(state.finalDecisionEvidence.reasonCodes.includes('final_decision_base_mismatch'));
  assert.ok(state.finalDecisionEvidence.reasonCodes.includes('final_decision_merge_context_digest_mismatch'));
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

test('v132_accepted_main_identity_requires_observed_default_branch_head', () => {
  const mainSha = 'c'.repeat(40);
  const candidateSha = 'd'.repeat(40);
  const repositoryMetadata = {
    id: 123,
    full_name: V132_SOURCE_REPOSITORY,
    default_branch: V132_SOURCE_DEFAULT_BRANCH,
  };
  const defaultBranchMetadata = {
    name: V132_SOURCE_DEFAULT_BRANCH,
    commit: { sha: mainSha },
  };
  assert.equal(validateAcceptedMainIdentityObservation({
    repository: V132_SOURCE_REPOSITORY,
    expectedDefaultBranchHeadSha: mainSha,
    repositoryMetadata,
    defaultBranchMetadata,
  }).status, 'pass');
  const candidateOwned = validateAcceptedMainIdentityObservation({
    repository: V132_SOURCE_REPOSITORY,
    expectedDefaultBranchHeadSha: candidateSha,
    repositoryMetadata,
    defaultBranchMetadata,
  });
  assert.equal(candidateOwned.status, 'fail');
  assert.ok(candidateOwned.reasonCodes.includes('accepted_main_default_branch_head_mismatch'));
  assert.equal(validateAcceptedMainIdentityObservation({
    repository: V132_SOURCE_REPOSITORY,
    expectedDefaultBranchHeadSha: mainSha,
    repositoryMetadata: { ...repositoryMetadata, default_branch: 'candidate' },
    defaultBranchMetadata,
  }).status, 'fail');
  assert.equal(validateAcceptedMainIdentityObservation({
    repository: 'hiro4649/lookalike',
    expectedDefaultBranchHeadSha: mainSha,
    repositoryMetadata,
    defaultBranchMetadata,
  }).status, 'fail');
});

test('v132_trust_root_real_git_bootstrap_is_non_self_referential', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v132-trust-bootstrap-'));
  try {
    const { publicKey } = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
    const seed = createFixtureTrustRoot({
      repository: V132_SOURCE_REPOSITORY,
      trustSourceHeadSha: 'a'.repeat(40),
      publicKeyPem,
    });
    const trustPath = path.join(directory, 'docs', 'process', 'CODEX_V132_TRUST_ROOT.json');
    fs.mkdirSync(path.dirname(trustPath), { recursive: true });
    fs.writeFileSync(trustPath, `${JSON.stringify(seed.document, null, 2)}\n`, 'utf8');
    const git = (...args) => countedSpawnSync('git', args, { cwd: directory, encoding: 'utf8', windowsHide: true });
    assert.equal(git('init').status, 0);
    assert.equal(git('checkout', '-b', V132_SOURCE_DEFAULT_BRANCH).status, 0);
    assert.equal(git('config', 'user.name', 'Codex Fixture').status, 0);
    assert.equal(git('config', 'user.email', 'codex-fixture@example.invalid').status, 0);
    assert.equal(git('add', 'docs/process/CODEX_V132_TRUST_ROOT.json').status, 0);
    assert.equal(git('commit', '-m', 'test: add trust root').status, 0);
    const headSha = git('rev-parse', 'HEAD').stdout.trim();
    const blobSha = git('rev-parse', `HEAD:${V132_TRUST_ROOT_PATH}`).stdout.trim();
    assert.match(headSha, /^[a-f0-9]{40}$/);
    assert.match(blobSha, /^[a-f0-9]{40}$/);
    const observed = createFixtureTrustRoot({
      repository: V132_SOURCE_REPOSITORY,
      trustSourceHeadSha: headSha,
      trustSourceBlobSha: blobSha,
      publicKeyPem,
    });
    assert.deepEqual(observed.document, JSON.parse(fs.readFileSync(trustPath, 'utf8')));
    assert.equal(Object.hasOwn(observed.document, 'acceptedMainSha'), false);
    assert.equal(validateObservedTrustRootEnvelope(observed, {
      repository: V132_SOURCE_REPOSITORY,
      defaultBranch: V132_SOURCE_DEFAULT_BRANCH,
      headSha,
    }).status, 'pass');

    for (const [reason, mutate] of [
      ['trust_root_source_head_mismatch', (root) => { root.trustSourceHeadSha = 'e'.repeat(40); }],
      ['trust_root_source_path_mismatch', (root) => { root.trustSourcePath = 'docs/process/alternate.json'; }],
      ['trust_root_source_repository_mismatch', (root) => { root.trustSourceRepository = 'hiro4649/lookalike'; }],
      ['trust_root_source_default_branch_mismatch', (root) => { root.trustSourceDefaultBranch = 'candidate'; }],
    ]) {
      const changed = structuredClone(observed);
      mutate(changed);
      changed.effectiveTrustRootDigest = effectiveTrustRootDigest(changed);
      const result = validateObservedTrustRootEnvelope(changed, {
        repository: V132_SOURCE_REPOSITORY,
        defaultBranch: V132_SOURCE_DEFAULT_BRANCH,
        headSha,
      });
      assert.equal(result.status, 'fail');
      assert.ok(result.reasonCodes.includes(reason), `${reason}:${result.reasonCodes.join(',')}`);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('v132_required_check_snapshot_supports_classic_and_rulesets_fail_closed', () => {
  const classic = buildRequiredCheckTrustSnapshot({
    repository: V132_SOURCE_REPOSITORY,
    baseRef: 'main',
    classicProtection: { strict: true, contexts: ['quality-gate'], checks: [] },
    rulesetRules: null,
    observedAt: '2026-07-10T00:00:00Z',
  });
  assert.equal(classic.source, 'github_branch_protection');
  assert.deepEqual(classic.requiredCheckNames, ['quality-gate']);
  const ruleset = buildRequiredCheckTrustSnapshot({
    repository: V132_SOURCE_REPOSITORY,
    baseRef: 'main',
    classicProtection: null,
    rulesetRules: [{
      ruleset_id: 42,
      ruleset_source_type: 'Repository',
      ruleset_source: V132_SOURCE_REPOSITORY,
      type: 'workflows',
      parameters: {
        workflows: [{
          path: '.github/workflows/quality-gate.yml',
          ref: 'refs/heads/main',
          sha: 'c'.repeat(40),
          repository_id: 123,
        }],
      },
    }],
    observedAt: '2026-07-10T00:00:01Z',
  });
  assert.equal(ruleset.source, 'github_rulesets');
  assert.equal(ruleset.requiredCheckNames.length, 0);
  assert.equal(ruleset.requiredWorkflowRefs[0].path, '.github/workflows/quality-gate.yml');
  const pinnedWithoutRef = buildRequiredCheckTrustSnapshot({
    repository: V132_SOURCE_REPOSITORY,
    baseRef: 'main',
    classicProtection: null,
    rulesetRules: [{
      ruleset_id: 44,
      ruleset_source_type: 'Repository',
      ruleset_source: V132_SOURCE_REPOSITORY,
      type: 'workflows',
      parameters: { workflows: [{ path: '.github/workflows/quality-gate.yml', sha: 'c'.repeat(40), repository_id: 123 }] },
    }],
  });
  assert.equal(pinnedWithoutRef.requiredWorkflowRefs[0].ref, '');
  const receipts = validReceipts({ rulesetBinding: {
    path: '.github/workflows/quality-gate.yml',
    ref: 'refs/heads/main',
    sha: 'c'.repeat(40),
    repositoryId: 123,
  } });
  receipts.remoteEvidence.requiredCheckTrustRoot = ruleset;
  receipts.remoteEvidence.requiredCheckSetDigest = sha256(canonicalJson([]));
  refreshRemotePayloadDigest(receipts.remoteEvidence);
  const rulesetState = deriveCanonicalState({ localValidationPassed: true, ...receipts });
  assert.equal(rulesetState.remoteValidationState, 'passed', rulesetState.remoteEvidence.reasonCodes.join(','));
  assert.throws(() => buildRequiredCheckTrustSnapshot({
    repository: V132_SOURCE_REPOSITORY,
    baseRef: 'main',
    classicProtection: null,
    rulesetRules: null,
  }), /github_required_check_trust_root_unavailable/);
  assert.throws(() => buildRequiredCheckTrustSnapshot({
    repository: V132_SOURCE_REPOSITORY,
    baseRef: 'main',
    classicProtection: null,
    rulesetRules: [{
      ruleset_id: 43,
      ruleset_source_type: 'Repository',
      ruleset_source: V132_SOURCE_REPOSITORY,
      type: 'workflows',
      parameters: { workflows: [{ path: '.github/workflows/quality-gate.yml', repository_id: 123 }] },
    }],
  }), /github_ruleset_workflow_not_sha_pinned_unsupported/);
});

test('v132_required_check_app_identity_and_ruleset_binding_are_exact', () => {
  const appReceipts = validReceipts({ requiredAppId: 15368 });
  assert.equal(deriveCanonicalState({ localValidationPassed: true, ...appReceipts }).remoteValidationState, 'passed');
  appReceipts.remoteEvidence.checkRuns[0].appId = 99999;
  appReceipts.remoteEvidence.requiredCheckSetDigest = sha256(canonicalJson(appReceipts.remoteEvidence.checkRuns.map((check) => ({
    checkRunId: check.checkRunId,
    name: check.name,
    appId: check.appId,
    conclusion: check.conclusion,
    headSha: check.headSha,
  }))));
  refreshRemotePayloadDigest(appReceipts.remoteEvidence);
  const appMismatch = deriveCanonicalState({ localValidationPassed: true, ...appReceipts });
  assert.equal(appMismatch.mergeAllowed, false);
  assert.ok(appMismatch.remoteEvidence.reasonCodes.includes('required_check_app_identity_mismatch:quality-gate'));

  const binding = {
    path: '.github/workflows/quality-gate.yml',
    ref: 'refs/heads/main',
    sha: 'c'.repeat(40),
    repositoryId: 123,
  };
  for (const mutate of [
    (entry) => { entry.ref = 'refs/heads/candidate'; },
    (entry) => { entry.sha = 'e'.repeat(40); },
    (entry) => { entry.repository_id = 999; },
  ]) {
    const receipts = validReceipts({ rulesetBinding: binding });
    const observedRule = {
      path: binding.path,
      ref: binding.ref,
      sha: binding.sha,
      repository_id: binding.repositoryId,
    };
    mutate(observedRule);
    receipts.remoteEvidence.requiredCheckTrustRoot = buildRequiredCheckTrustSnapshot({
      repository: V132_SOURCE_REPOSITORY,
      baseRef: 'main',
      classicProtection: null,
      rulesetRules: [{
        ruleset_id: 42,
        ruleset_source_type: 'Repository',
        ruleset_source: V132_SOURCE_REPOSITORY,
        type: 'workflows',
        parameters: { workflows: [observedRule] },
      }],
      observedAt: '2026-07-10T00:00:00Z',
    });
    refreshRemotePayloadDigest(receipts.remoteEvidence);
    const mismatch = deriveCanonicalState({ localValidationPassed: true, ...receipts });
    assert.equal(mismatch.mergeAllowed, false);
    assert.ok(mismatch.remoteEvidence.reasonCodes.includes('ruleset_workflow_exact_binding_mismatch'));
  }
});

test('v132_multi_run_aggregation_uses_stable_shared_trust_snapshot', () => {
  const repository = V132_SOURCE_REPOSITORY;
  const baseSha = 'b'.repeat(40);
  const headSha = 'a'.repeat(40);
  const qualityPath = '.github/workflows/quality-gate.yml';
  const compatibilityPath = '.github/workflows/v132-compatibility-gate.yml';
  const qualityDigest = sha256('fixture-workflow:quality');
  const compatibilityDigest = sha256('fixture-workflow:compatibility');
  const { publicKey } = crypto.generateKeyPairSync('ed25519');
  const requiredFieldValues = { repository: '$repository', headSha: '$headSha', status: 'pass' };
  const acceptedMainTrustRoot = createFixtureTrustRoot({
    repository,
    trustSourceHeadSha: 'c'.repeat(40),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    requiredWorkflows: [
      { workflowId: 1001, path: qualityPath, workflowContentDigest: qualityDigest, reusableWorkflowRef: null },
      { workflowId: 1002, path: compatibilityPath, workflowContentDigest: compatibilityDigest, reusableWorkflowRef: null },
    ],
    requiredArtifacts: [
      { name: 'quality-safe', workflowPath: qualityPath, entryPath: 'quality.json', schemaVersion: V132_VERSION, requiredFields: ['schemaVersion', 'repository', 'headSha', 'status'], requiredFieldValues },
      { name: 'compat-safe', workflowPath: compatibilityPath, entryPath: 'compat.json', schemaVersion: V132_VERSION, requiredFields: ['schemaVersion', 'repository', 'headSha', 'status'], requiredFieldValues },
    ],
  });
  const aggregateOptions = {
    repository,
    testMode: true,
    acceptedMainTrustRootDigest: trustRootContractDigest(acceptedMainTrustRoot),
  };
  const snapshotA = buildRequiredCheckTrustSnapshot({
    repository,
    baseRef: 'main',
    classicProtection: { strict: true, contexts: ['aggregate contract', 'quality-gate'], checks: [] },
    rulesetRules: null,
    observedAt: '2026-07-10T00:00:00Z',
  });
  const snapshotB = { ...structuredClone(snapshotA), observedAt: '2026-07-10T00:00:05Z' };
  const contractArtifactDigest = sha256(canonicalJson(acceptedMainTrustRoot.document.artifactContract));
  const contractWorkflowDigest = sha256(canonicalJson(acceptedMainTrustRoot.document.workflowContract));
  const artifact = (artifactId, name, workflowPath, entryPath) => {
    const boundValues = { repository, headSha, status: 'pass' };
    return {
      artifactId,
      name,
      sizeInBytes: 100,
      contentDigest: sha256(`${name}:archive`),
      workflowPath,
      entryPath,
      schemaVersion: V132_VERSION,
      semanticDigest: sha256(`${name}:payload`),
      boundValues,
      valueBindingDigest: sha256(canonicalJson(boundValues)),
    };
  };
  const observation = ({ runId, workflowId, workflowPath, workflowContentDigest, checkName, trustSnapshot, observedAt, artifactRecord }) => ({
    repository,
    pullRequestNumber: 165,
    event: 'pull_request',
    baseRef: 'main',
    baseSha,
    headSha,
    runId,
    runAttempt: 1,
    workflowRuns: [{
      runId,
      runAttempt: 1,
      workflowId,
      workflowPath,
      event: 'pull_request',
      pullRequestNumber: 165,
      baseSha,
      headSha,
      conclusion: 'success',
      workflowContentDigest,
      reusableWorkflowRefs: [],
    }],
    startedAt: observedAt,
    completedAt: '2026-07-10T00:01:00Z',
    observedAt,
    conclusion: 'success',
    failureClass: null,
    annotationText: '',
    requiredCheckTrustRoot: trustSnapshot,
    requiredArtifactContractDigest: contractArtifactDigest,
    requiredWorkflowContractDigest: contractWorkflowDigest,
    checkRuns: [{ checkRunId: runId + 1000, name: checkName, conclusion: 'success', headSha }],
    artifacts: [artifactRecord],
  });
  const observations = [
    observation({
      runId: 101,
      workflowId: 1001,
      workflowPath: qualityPath,
      workflowContentDigest: qualityDigest,
      checkName: 'quality-gate',
      trustSnapshot: snapshotA,
      observedAt: '2026-07-10T00:00:00Z',
      artifactRecord: artifact(301, 'quality-safe', qualityPath, 'quality.json'),
    }),
    observation({
      runId: 102,
      workflowId: 1002,
      workflowPath: compatibilityPath,
      workflowContentDigest: compatibilityDigest,
      checkName: 'aggregate contract',
      trustSnapshot: snapshotB,
      observedAt: '2026-07-10T00:00:05Z',
      artifactRecord: artifact(302, 'compat-safe', compatibilityPath, 'compat.json'),
    }),
  ];
  const receipt = aggregateGithubRunObservations(observations, aggregateOptions);
  const remote = deriveCanonicalState({
    localValidationPassed: true,
    remoteEvidence: receipt,
    expected: { repository, pullRequestNumber: 165, event: 'pull_request', baseSha, headSha, acceptedMainTrustRoot, testMode: true },
  });
  assert.equal(remote.remoteValidationState, 'passed', remote.remoteEvidence.reasonCodes.join(','));
  assert.equal(remote.technicalMergeEligibility, 'eligible');

  const omittedReceipt = aggregateGithubRunObservations(observations.slice(0, 1), aggregateOptions);
  const omitted = deriveCanonicalState({
    localValidationPassed: true,
    remoteEvidence: omittedReceipt,
    expected: { repository, pullRequestNumber: 165, event: 'pull_request', baseSha, headSha, acceptedMainTrustRoot, testMode: true },
  });
  assert.equal(omitted.mergeAllowed, false);
  assert.ok(omitted.remoteEvidence.reasonCodes.includes('required_workflow_exact_set_mismatch'));

  const rerun = structuredClone(observations[0]);
  rerun.runId = 103;
  rerun.runAttempt = 2;
  rerun.workflowRuns[0].runId = 103;
  rerun.workflowRuns[0].runAttempt = 2;
  rerun.checkRuns[0].checkRunId = 1103;
  rerun.artifacts[0].artifactId = 303;
  const normalizedRerun = aggregateGithubRunObservations([...observations, rerun], aggregateOptions);
  assert.deepEqual(normalizedRerun.runIds, [102, 103]);
  const rerunState = deriveCanonicalState({
    localValidationPassed: true,
    remoteEvidence: normalizedRerun,
    expected: { repository, pullRequestNumber: 165, event: 'pull_request', baseSha, headSha, acceptedMainTrustRoot, testMode: true },
  });
  assert.equal(rerunState.remoteValidationState, 'passed', rerunState.remoteEvidence.reasonCodes.join(','));

  const failedLatest = structuredClone(rerun);
  failedLatest.runId = 104;
  failedLatest.runAttempt = 3;
  failedLatest.conclusion = 'failure';
  failedLatest.workflowRuns[0].runId = 104;
  failedLatest.workflowRuns[0].runAttempt = 3;
  failedLatest.workflowRuns[0].conclusion = 'failure';
  failedLatest.checkRuns[0].checkRunId = 1104;
  failedLatest.checkRuns[0].conclusion = 'failure';
  failedLatest.artifacts = [];
  const failedLatestReceipt = aggregateGithubRunObservations([...observations, rerun, failedLatest], aggregateOptions);
  const failedLatestState = deriveCanonicalState({
    localValidationPassed: true,
    remoteEvidence: failedLatestReceipt,
    expected: { repository, pullRequestNumber: 165, event: 'pull_request', baseSha, headSha, acceptedMainTrustRoot, testMode: true },
  });
  assert.equal(failedLatestState.mergeAllowed, false);
  assert.ok(failedLatestState.remoteEvidence.reasonCodes.includes('workflow_1_conclusion_not_success')
    || failedLatestState.remoteEvidence.reasonCodes.includes('workflow_0_conclusion_not_success'));
  for (const mutate of [
    (items) => { items[1].pullRequestNumber = 166; },
    (items) => { items[1].baseSha = 'd'.repeat(40); },
    (items) => { items[1].headSha = 'e'.repeat(40); },
    (items) => {
      items[1].requiredCheckTrustRoot = buildRequiredCheckTrustSnapshot({
        repository,
        baseRef: 'main',
        classicProtection: { strict: true, contexts: ['different-check'], checks: [] },
        rulesetRules: null,
        observedAt: '2026-07-10T00:00:05Z',
      });
    },
    (items) => { items[1].requiredWorkflowContractDigest = sha256('different-workflow-contract'); },
  ]) {
    const changed = structuredClone(observations);
    mutate(changed);
    assert.throws(() => aggregateGithubRunObservations(changed, { repository, testMode: true }), /github_run_set_binding_mismatch/);
  }
});

test('v132_workflow_content_and_artifact_values_are_exactly_bound', () => {
  for (const [reason, mutate] of [
    ['workflow_0_content_digest_mismatch', (receipt) => { receipt.workflowRuns[0].workflowContentDigest = sha256('changed-workflow'); }],
    ['artifact_0_repository_binding_mismatch', (receipt) => { receipt.artifacts[0].boundValues.repository = 'hiro4649/other'; }],
    ['artifact_0_head_binding_mismatch', (receipt) => { receipt.artifacts[0].boundValues.headSha = 'd'.repeat(40); }],
    ['artifact_0_status_binding_mismatch', (receipt) => { receipt.artifacts[0].boundValues.status = 'fail'; }],
  ]) {
    const receipts = validReceipts();
    mutate(receipts.remoteEvidence);
    refreshRemotePayloadDigest(receipts.remoteEvidence);
    const state = deriveCanonicalState({ localValidationPassed: true, ...receipts });
    assert.equal(state.mergeAllowed, false);
    assert.ok(state.remoteEvidence.reasonCodes.includes(reason), `${reason}:${state.remoteEvidence.reasonCodes.join(',')}`);
  }
});

test('v132_artifact_parser_is_resource_bounded_and_duplicate_closed', () => {
  const payload = Buffer.from(JSON.stringify({ schemaVersion: V132_VERSION, status: 'pass' }));
  const valid = createStoredZip([{ name: 'safe-summary.json', payload }]);
  assert.deepEqual(readArtifactZipEntry(valid, 'safe-summary.json'), payload);
  const duplicate = createStoredZip([
    { name: 'safe-summary.json', payload },
    { name: 'safe-summary.json', payload },
  ]);
  assert.throws(() => readArtifactZipEntry(duplicate, 'safe-summary.json'), /artifact_contract_entry_duplicate/);
  const tooMany = createStoredZip(Array.from({ length: V132_ARTIFACT_LIMITS.entryCount + 1 }, (_, index) => ({
    name: `entry-${index}.json`,
    payload: '{}',
  })));
  assert.throws(() => readArtifactZipEntry(tooMany, 'entry-0.json'), /artifact_zip_entry_count_exceeded/);
  const oversizedPayload = createStoredZip([{
    name: 'safe-summary.json',
    payload: Buffer.alloc(V132_ARTIFACT_LIMITS.payloadBytes + 1),
  }]);
  assert.throws(() => readArtifactZipEntry(oversizedPayload, 'safe-summary.json'), /artifact_payload_size_exceeded/);
  assert.throws(() => readArtifactZipEntry(Buffer.alloc(V132_ARTIFACT_LIMITS.archiveBytes + 1), 'safe-summary.json'), /artifact_archive_size_exceeded/);
  const zip64Marked = Buffer.concat([valid, Buffer.from([0x50, 0x4b, 0x06, 0x06])]);
  assert.throws(() => readArtifactZipEntry(zip64Marked, 'safe-summary.json'), /artifact_zip64_unsupported/);
});

test('v132_production_collector_cli_is_non_authoritative_and_owner_scoped', () => {
  const collectorPath = path.join(ROOT, 'scripts', 'codex-v132-collect-remote-evidence.mjs');
  const source = fs.readFileSync(collectorPath, 'utf8');
  assert.match(source, /CODEX_V132_COLLECTOR_TOKEN/);
  assert.doesNotMatch(source, /process\.env\.GITHUB_TOKEN/);
  assert.match(source, /createsAuthority:\s*false/);
  assert.match(source, /finalDecisionAuthorityCreated:\s*false/);
  assert.match(source, /collectAcceptedMainTrustRoot/);
  assert.match(source, /collectVerifiedGithubEvidence/);
  assert.match(source, /evaluateRemoteEvidence/);
  const ordinaryWorkflows = fs.readdirSync(path.join(ROOT, '.github', 'workflows'))
    .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    .map((file) => fs.readFileSync(path.join(ROOT, '.github', 'workflows', file), 'utf8'))
    .join('\n');
  assert.doesNotMatch(ordinaryWorkflows, /CODEX_V132_COLLECTOR_TOKEN/);
  const syntax = countedSpawnSync(process.execPath, ['--check', collectorPath], { encoding: 'utf8', windowsHide: true });
  assert.equal(syntax.status, 0, syntax.stderr);
  const output = path.join(os.tmpdir(), `codex-v132-collector-${process.pid}.json`);
  const env = { ...process.env };
  delete env.CODEX_V132_COLLECTOR_TOKEN;
  const closed = countedSpawnSync(process.execPath, [collectorPath, '--run-ids=1,2', `--output=${output}`], { encoding: 'utf8', windowsHide: true, env });
  assert.equal(closed.status, 1);
  assert.match(closed.stderr, /owner_managed_collector_credential_required/);
  assert.equal(fs.existsSync(output), false);
});

test('v132_production_collector_mock_e2e_binds_current_pr_and_latest_runs', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v132-collector-e2e-'));
  try {
    const scenario = createCollectorMockScenario('pass');
    const outputA = path.join(directory, 'receipt-a.json');
    const resultA = await runCollectorCli({
      argv: [`--repository=${scenario.repository}`, `--pull-request=${scenario.pullRequestNumber}`, '--run-ids=201,101', `--output=${outputA}`],
      env: { CODEX_V132_COLLECTOR_TOKEN: 'fixture-token' },
      httpClient: scenario.httpClient,
    });
    assert.equal(resultA.status, 'pass');
    assert.equal(resultA.remoteValidationState, 'passed');
    assert.deepEqual(resultA.runIds, [102, 201]);
    const serializedA = JSON.parse(fs.readFileSync(outputA, 'utf8'));
    assert.equal(serializedA.authority, 'none');
    assert.equal(serializedA.createsAuthority, false);
    assert.equal(serializedA.mergeAllowed, false);
    assert.equal(serializedA.finalDecisionAuthorityCreated, false);
    assert.equal(serializedA.receipt.pullRequestBinding.headSha, scenario.headSha);
    assert.equal(serializedA.receipt.observedBaseSha, scenario.baseSha);
    assert.equal(serializedA.receipt.baseAncestryState, 'matched');
    assert.match(serializedA.receipt.mergeContextDigest, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(serializedA.receipt.workflowRunDiscovery.hintRunIds, [101, 201]);
    assert.deepEqual(serializedA.receipt.runIds, [102, 201]);

    const outputB = path.join(directory, 'receipt-b.json');
    const resultB = await runCollectorCli({
      argv: [`--repository=${scenario.repository}`, `--pull-request=${scenario.pullRequestNumber}`, '--run-ids=101,201', `--output=${outputB}`],
      env: { CODEX_V132_COLLECTOR_TOKEN: 'fixture-token' },
      httpClient: scenario.httpClient,
    });
    assert.deepEqual(resultB.runIds, resultA.runIds);

    const trustRoot = await collectAcceptedMainTrustRoot({ repository: scenario.repository, token: 'fixture-token', httpClient: scenario.httpClient });
    const reobserved = await reobserveSerializedGithubEvidence(serializedA.receipt, {
      token: 'fixture-token',
      acceptedMainTrustRoot: trustRoot,
      httpClient: scenario.httpClient,
    });
    const evaluation = deriveCanonicalState({
      localValidationPassed: true,
      remoteEvidence: reobserved,
      expected: {
        repository: scenario.repository,
        pullRequestNumber: scenario.pullRequestNumber,
        event: 'pull_request',
        baseSha: scenario.baseSha,
        headSha: scenario.headSha,
        acceptedMainTrustRoot: trustRoot,
        testMode: true,
      },
    });
    assert.equal(evaluation.remoteValidationState, 'passed', evaluation.remoteEvidence.reasonCodes.join(','));
    assert.equal(evaluation.mergeAllowed, false);
    assert.ok(scenario.calls.some((entry) => entry.includes('/actions/runs?event=pull_request') && entry.includes(`head_sha=${scenario.headSha}`)));
    assert.ok(scenario.calls.some((entry) => entry.includes(`/compare/${scenario.baseSha}...${scenario.headSha}`)));
    const staleBaseReceipt = structuredClone(serializedA.receipt);
    staleBaseReceipt.baseSha = 'd'.repeat(40);
    await assert.rejects(() => reobserveSerializedGithubEvidence(staleBaseReceipt, {
      token: 'fixture-token',
      acceptedMainTrustRoot: trustRoot,
      httpClient: scenario.httpClient,
    }), /serialized_github_receipt_reobservation_mismatch/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('v132_collector_stale_success_old_head_and_unavailable_states_fail_closed', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v132-collector-negative-'));
  try {
    const stale = createCollectorMockScenario('newer_failure');
    const staleOutput = path.join(directory, 'stale.json');
    const staleResult = await runCollectorCli({
      argv: [`--repository=${stale.repository}`, `--pull-request=${stale.pullRequestNumber}`, '--run-ids=101,201', `--output=${staleOutput}`],
      env: { CODEX_V132_COLLECTOR_TOKEN: 'fixture-token' },
      httpClient: stale.httpClient,
    });
    assert.equal(staleResult.status, 'fail');
    assert.equal(staleResult.remoteValidationState, 'artifact_missing');
    assert.ok(fs.existsSync(staleOutput));
    assert.deepEqual(JSON.parse(fs.readFileSync(staleOutput, 'utf8')).receipt.runIds, [102, 201]);

    const oldHead = createCollectorMockScenario('old_head');
    const oldHeadOutput = path.join(directory, 'old-head.json');
    const oldHeadResult = await runCollectorCli({
      argv: [`--repository=${oldHead.repository}`, `--pull-request=${oldHead.pullRequestNumber}`, '--run-ids=101,201', `--output=${oldHeadOutput}`],
      env: { CODEX_V132_COLLECTOR_TOKEN: 'fixture-token' },
      httpClient: oldHead.httpClient,
    });
    assert.equal(oldHeadResult.status, 'fail');
    assert.notEqual(oldHeadResult.remoteValidationState, 'passed');
    const oldHeadSerialized = JSON.parse(fs.readFileSync(oldHeadOutput, 'utf8'));
    assert.equal(oldHeadSerialized.receipt.headSha, oldHead.headSha);
    assert.ok(oldHeadSerialized.receipt.workflowRunDiscovery.missingWorkflowIdentities.includes('1001:.github/workflows/quality-gate.yml'));

    const baseDrift = createCollectorMockScenario('base_not_ancestor');
    const baseDriftOutput = path.join(directory, 'base-drift.json');
    const baseDriftResult = await runCollectorCli({
      argv: [`--repository=${baseDrift.repository}`, `--pull-request=${baseDrift.pullRequestNumber}`, `--output=${baseDriftOutput}`],
      env: { CODEX_V132_COLLECTOR_TOKEN: 'fixture-token' },
      httpClient: baseDrift.httpClient,
    });
    assert.equal(baseDriftResult.status, 'fail');
    assert.equal(baseDriftResult.remoteValidationState, 'stale');
    assert.equal(JSON.parse(fs.readFileSync(baseDriftOutput, 'utf8')).receipt.baseAncestryState, 'mismatch');

    for (const mode of ['billing', 'pre_runner']) {
      const unavailable = createCollectorMockScenario(mode);
      const output = path.join(directory, `${mode}.json`);
      const result = await runCollectorCli({
        argv: [`--repository=${unavailable.repository}`, `--pull-request=${unavailable.pullRequestNumber}`, `--output=${output}`],
        env: { CODEX_V132_COLLECTOR_TOKEN: 'fixture-token' },
        httpClient: unavailable.httpClient,
      });
      assert.equal(result.status, 'unavailable');
      assert.equal(result.exitCode, 2);
      assert.equal(result.remoteValidationState, mode === 'billing' ? 'unavailable_billing' : 'unavailable_pre_runner');
      const serialized = JSON.parse(fs.readFileSync(output, 'utf8'));
      assert.equal(serialized.authority, 'none');
      assert.equal(serialized.mergeAllowed, false);
      assert.equal(serialized.finalDecisionAuthorityCreated, false);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('v132_collector_preserves_pending_canceled_and_failed_observation_truth', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v132-collector-state-'));
  try {
    for (const mode of ['queued', 'in_progress', 'canceled']) {
      const scenario = createCollectorMockScenario(mode);
      const output = path.join(directory, `${mode}.json`);
      const result = await runCollectorCli({
        argv: [`--repository=${scenario.repository}`, `--pull-request=${scenario.pullRequestNumber}`, `--output=${output}`],
        env: { CODEX_V132_COLLECTOR_TOKEN: 'fixture-token' },
        httpClient: scenario.httpClient,
      });
      assert.equal(result.remoteValidationState, mode);
      assert.equal(result.status, mode === 'canceled' ? 'fail' : 'unavailable');
      assert.equal(result.exitCode, mode === 'canceled' ? 1 : 2);
      const serialized = JSON.parse(fs.readFileSync(output, 'utf8'));
      assert.equal(serialized.remoteValidationState, mode);
      assert.equal(serialized.receipt.runStatus, mode === 'canceled' ? 'completed' : mode);
      assert.equal(serialized.authority, 'none');
      assert.equal(serialized.mergeAllowed, false);
      assert.equal(serialized.finalDecisionAuthorityCreated, false);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('v132_final_decision_serialized_signature_verification', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const repository = 'hiro4649/codex-development-harness';
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const trustRoot = createFixtureTrustRoot({
    repository,
    trustSourceHeadSha: 'c'.repeat(40),
    publicKeyPem,
    keyId: 'owner-final-key-001',
  });
  const baseSha = 'b'.repeat(40);
  const headSha = 'a'.repeat(40);
  const mergeContextDigest = calculateMergeContextDigest({
    repository,
    pullRequestNumber: 165,
    baseSha,
    headSha,
    acceptedMainTrustRootDigest: trustRootContractDigest(trustRoot),
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
    pullRequestNumber: 165,
    baseSha,
    headSha,
    mergeContextDigest,
    observedAt: '2026-07-10T00:02:00Z',
    signatureAlgorithm: 'ed25519',
    signingKeyId: 'owner-final-key-001',
    signingKeyFingerprint: trustRoot.document.finalDecisionKey.publicKeyFingerprint,
    trustRootDigest: trustRootContractDigest(trustRoot),
  };
  const signature = crypto.sign(null, Buffer.from(canonicalJson(payload)), privateKey).toString('base64');
  const serialized = { ...payload, signature };
  serialized.receiptDigest = sha256(canonicalJson(serialized));
  const verified = verifySignedFinalDecisionReceipt(serialized, { trustRoot });
  const expected = { repository, pullRequestNumber: 165, baseSha, headSha, mergeContextDigest, testMode: true };
  const evaluation = deriveCanonicalState({ localValidationPassed: true, finalDecisionReceipt: verified, expected });
  assert.equal(evaluation.finalDecisionState, 'authorized');
  assert.throws(() => verifySignedFinalDecisionReceipt(serialized, { trustRoot: structuredClone(trustRoot) }), /trusted_root_required/);
  const { publicKey: arbitraryPublicKey } = crypto.generateKeyPairSync('ed25519');
  const arbitraryRoot = createFixtureTrustRoot({
    repository,
    trustSourceHeadSha: 'c'.repeat(40),
    publicKeyPem: arbitraryPublicKey.export({ type: 'spki', format: 'pem' }),
    keyId: 'owner-final-key-002',
  });
  assert.throws(() => verifySignedFinalDecisionReceipt(serialized, { trustRoot: arbitraryRoot }), /signing_key_id_untrusted/);
  const modified = structuredClone(serialized);
  modified.headSha = 'b'.repeat(40);
  assert.equal(deriveCanonicalState({ localValidationPassed: true, finalDecisionReceipt: modified, expected: { testMode: true } }).finalDecisionState, 'not_authorized');
  const advancedBaseSha = 'd'.repeat(40);
  const advancedMergeContextDigest = calculateMergeContextDigest({
    repository,
    pullRequestNumber: 165,
    baseSha: advancedBaseSha,
    headSha,
    acceptedMainTrustRootDigest: trustRootContractDigest(trustRoot),
  });
  const advancedBase = deriveCanonicalState({
    localValidationPassed: true,
    finalDecisionReceipt: verified,
    expected: { ...expected, baseSha: advancedBaseSha, mergeContextDigest: advancedMergeContextDigest },
  });
  assert.equal(advancedBase.finalDecisionState, 'not_authorized');
  assert.ok(advancedBase.finalDecisionEvidence.reasonCodes.includes('final_decision_base_mismatch'));
  assert.ok(advancedBase.finalDecisionEvidence.reasonCodes.includes('final_decision_merge_context_digest_mismatch'));
});

test('v132_billing_lock_is_unavailable_not_code_failure', () => {
  const baseSha = 'b'.repeat(40);
  const headSha = 'a'.repeat(40);
  const receipt = createFixtureGithubEvidence({
    repository: 'hiro4649/codex-development-harness', pullRequestNumber: 165, event: 'pull_request', baseRef: 'main', baseSha, headSha, runId: 1, runAttempt: 1,
    workflowRuns: [{ runId: 1, runAttempt: 1, workflowId: 1001, workflowPath: '.github/workflows/quality-gate.yml', event: 'pull_request', pullRequestNumber: 165, baseSha, headSha, status: 'completed', conclusion: 'failure' }],
    runStatus: 'completed', conclusion: 'failure',
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
    workflowRuns: [{ runId: 2, runAttempt: 1, workflowId: 1001, workflowPath: '.github/workflows/quality-gate.yml', event: 'pull_request', pullRequestNumber: 165, baseSha, headSha, status: 'completed', conclusion: 'failure' }],
    runStatus: 'completed', conclusion: 'failure',
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

test('v132_observed_workspace_dirty_and_product_mutation_fail_closed', () => {
  assert.equal(evaluateObservedWorkspaceScope({ worktreeState: 'clean' }, 0).status, 'pass');
  assert.equal(evaluateObservedWorkspaceScope({ worktreeState: 'dirty' }, 0).status, 'fail');
  assert.equal(evaluateObservedWorkspaceScope({ worktreeState: 'clean' }, 1).status, 'fail');
  assert.equal(evaluateObservedWorkspaceScope({ worktreeState: 'dirty' }, 0, { allowDirtyFixture: true }).status, 'pass');
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
  for (const relative of ['docs/process/CODEX_V132_POLICY.json', 'docs/process/CODEX_EFFECTIVE_POLICY.compact.json', 'CODEX_SOURCE_HARNESS_MANIFEST.json', 'docs/process/CODEX_HARNESS_MANIFEST.json', 'docs/process/CODEX_ACTIVE_POLICY_INDEX.json']) {
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
  assert.equal(policy.acceptedMainShaCreatesTrustAuthority, false);
  assert.equal(policy.trustRootContract.authoritativeDocumentContainsCommitSha, false);
  assert.deepEqual(policy.trustRootContract.effectiveDigestBindings, [
    'document',
    'trustSourceRepository',
    'trustSourceDefaultBranch',
    'trustSourceHeadSha',
    'trustSourceBlobSha',
    'trustSourcePath',
  ]);
  assert.equal(policy.trustRootContract.observedRequiredWorkflowSetExact, true);
  assert.equal(policy.trustRootContract.automaticSourceJobExactHeadCheckoutRequired, true);
  assert.equal(policy.trustRootContract.workflowDispatchBindsGithubSha, true);
  assert.equal(policy.trustRootContract.exactHeadAssertionBeforeChecksRequired, true);
  assert.equal(policy.trustRootContract.artifactHeadMustEqualExpectedHead, true);
  assert.equal(policy.trustRootContract.currentBaseCompareApiObservationRequired, true);
  assert.equal(policy.trustRootContract.currentBaseMustBeAncestorOfExactHead, true);
  assert.deepEqual(policy.trustRootContract.mergeContextDigestBindings, ['repository', 'pullRequestNumber', 'baseSha', 'headSha', 'acceptedMainTrustRootDigest']);
  assert.ok(policy.trustRootContract.finalDecisionKey.requiredBindings.includes('pullRequestNumber'));
  assert.ok(policy.trustRootContract.finalDecisionKey.requiredBindings.includes('baseSha'));
  assert.ok(policy.trustRootContract.finalDecisionKey.requiredBindings.includes('headSha'));
  assert.ok(policy.trustRootContract.finalDecisionKey.requiredBindings.includes('mergeContextDigest'));
  assert.deepEqual(policy.canonicalStateContract.fields, ['localValidationState', 'remoteValidationState', 'observedBaseSha', 'baseAncestryState', 'mergeContextDigest', 'technicalMergeEligibility', 'finalDecisionState', 'mergeAllowed']);
  assert.equal(policy.requiredWorkflowApplicability.qualityGateRequiredForAllPullRequests, true);
  assert.equal(policy.requiredWorkflowApplicability.compatibilityGateRequiredForAllPullRequests, true);
  assert.equal(policy.requiredWorkflowApplicability.compatibilityJobMode, 'single_lightweight_aggregate');
  assert.equal(policy.requiredWorkflowApplicability.compatibilityJobMaximum, 1);
  assert.equal(policy.requiredWorkflowApplicability.pullRequestPathFiltersAllowed, false);
  assert.equal(policy.requiredWorkflowApplicability.workflowDispatchBaseApplicability, 'not_applicable');
  assert.deepEqual(policy.trustRootContract.requiredCheckIdentityFields, ['name', 'appId']);
  assert.deepEqual(policy.trustRootContract.rulesetWorkflowIdentityFields, ['path', 'ref', 'sha', 'repositoryId']);
  assert.equal(policy.remoteEvidenceCollector.credentialClass, 'owner_managed_github_app_or_fine_grained_pat');
  assert.ok(policy.remoteEvidenceCollector.requiredPermissions.includes('Checks read'));
  assert.equal(policy.remoteEvidenceCollector.checksReadRequired, true);
  assert.equal(policy.remoteEvidenceCollector.ordinaryProductWorkflowExposureAllowed, false);
  assert.equal(policy.remoteEvidenceCollector.createsFinalDecisionAuthority, false);
  assert.deepEqual(policy.remoteEvidenceCollector.persistedObservationStates, ['passed', 'unavailable_billing', 'unavailable_pre_runner', 'queued', 'in_progress', 'canceled', 'failed']);
  assert.equal(policy.trustRootContract.userSuppliedRunIdAuthority, 'hint_only');
  assert.equal(policy.rulesetWorkflowSupport.state, 'sha_pinned_only');
  assert.equal(policy.artifactResourceBounds.maximumArchiveBytes, V132_ARTIFACT_LIMITS.archiveBytes);
  assert.equal(policy.artifactResourceBounds.maximumPayloadBytes, V132_ARTIFACT_LIMITS.payloadBytes);
  assert.equal(policy.artifactResourceBounds.maximumEntryCount, V132_ARTIFACT_LIMITS.entryCount);
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
    assert.equal(manifest.acceptedMainVersion, '1.3.0');
    assert.equal(manifest.developmentParentVersion, '1.3.1');
    assert.equal(manifest.candidateVersion, '1.3.2');
    assert.equal(manifest.executionHarnessVersion, '1.3.2');
    assert.equal(manifest.candidateLifecycleState, 'local_validated');
    assert.equal(manifest.activeHarnessVersionAliasState, 'deprecated_execution_compatibility_alias');
    assert.equal(manifest.activeHarnessVersionAuthority, false);
    assert.equal(manifest.acceptedMainVersionAuthority, 'published_authority_version');
    assert.equal(manifest.candidateVersionAuthority, 'unmerged_candidate_version');
  }
  assert.match(strictJson('docs/process/CODEX_ACTIVE_POLICY_INDEX.json').profiles.target_compatibility_profile_install.profilePurpose, /v1\.3\.2 Compatibility Adapter/);
  const compactPolicyPath = path.join(ROOT, 'docs/process/CODEX_EFFECTIVE_POLICY.compact.json');
  const compactPolicyText = fs.readFileSync(compactPolicyPath, 'utf8');
  assert.ok(Buffer.byteLength(compactPolicyText, 'utf8') <= 2048);
  assert.ok(Buffer.byteLength(compactPolicyText, 'utf8') <= policy.routineReadContract.compactEffectivePolicyTargetBytes);
  assert.deepEqual(parseJsonStrict(compactPolicyText), compileEffectivePolicy(policy));
  assert.deepEqual(policy.routineReadContract.requiredReads, ['AGENTS.md', 'docs/process/CODEX_EFFECTIVE_POLICY.compact.json', 'task_delta_capsule']);
  assert.equal(harnessVersion.activeHarnessVersion, '1.3.2');
  assert.equal(harnessVersion.activeSelfTestSuite, 'v132');
  assert.equal(harnessVersion.acceptedMainVersion, '1.3.0');
  assert.equal(harnessVersion.acceptedMainShaRole, 'candidate_lineage_baseline_only');
  assert.equal(harnessVersion.acceptedMainShaCreatesTrustAuthority, false);
  assert.equal(harnessVersion.executionHarnessVersion, '1.3.2');
  assert.equal(harnessVersion.candidateLifecycleState, 'local_validated');
  assert.equal(harnessVersion.activeHarnessVersionAliasState, 'deprecated_execution_compatibility_alias');
  assert.equal(harnessVersion.activeHarnessVersionAuthority, false);
  const sourceManifest = strictJson('CODEX_SOURCE_HARNESS_MANIFEST.json');
  assert.ok(sourceManifest.managedFiles.includes('scripts/codex-v132-collect-remote-evidence.mjs'));
  assert.ok(sourceManifest.scriptNames.includes('codex-v132-collect-remote-evidence.mjs'));
  assert.deepEqual(harnessVersion.versionAuthority, {
    v132: 'local_source_candidate', v131: 'immediate_rollback', v130: 'secondary_rollback',
    v129: 'emergency_legacy_rollback', v128: 'blocking_compatibility', v127: 'readable_compatibility',
  });
  const agents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
  assert.ok(agents.includes('Decision Capsule is a non-authoritative domain projection'));
  assert.ok(agents.includes('Final Decision remains the authority'));
  assert.ok(agents.includes('docs/process/CODEX_EFFECTIVE_POLICY.compact.json'));
});

test('v132_verification_metrics_have_one_machine_source', () => {
  const measured = [{
    surfaceMetrics: {
      effectivePolicyBytes: 1800,
      decisionCapsuleBytes: 500,
      safeSummaryBytes: 400,
      orchestrationReceiptBytes: 1900,
    },
  }];
  const metrics = buildVerificationMetrics({
    baseline: { p50Ms: 15000 },
    candidate: { headSha: 'a'.repeat(40), measuredRunCount: 1, measured, p50Ms: 12000, p50OutputBytes: 6800 },
    outputReductionPercent: 98,
  });
  assert.equal(metrics.source, 'codex-v132-benchmark-json');
  assert.equal(metrics.compactJsonBytes, 6800);
  assert.equal(metrics.effectivePolicyBytes, 1800);
  assert.match(metrics.provenanceDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(metrics.createsAuthority, false);
});

test('v132_candidate_lifecycle_allows_only_explicit_transitions', () => {
  const policy = loadV132Policy(ROOT);
  assert.equal(validateCandidateLifecycleTransition('draft', 'local_validated', policy).status, 'pass');
  assert.equal(validateCandidateLifecycleTransition('local_validated', 'active', policy).status, 'fail');
  assert.equal(validateCandidateLifecycleTransition('activation_eligible', 'active', policy).status, 'fail');
  assert.equal(deriveCandidateLifecycleState({ localValidationState: 'failed', remoteValidationState: 'not_observed' }), 'draft');
  assert.equal(deriveCandidateLifecycleState({ localValidationState: 'passed', remoteValidationState: 'unavailable_billing' }), 'remote_unavailable');
  assert.equal(deriveCandidateLifecycleState({ localValidationState: 'passed', remoteValidationState: 'passed', technicalMergeEligibility: 'eligible', finalDecisionState: 'authorized' }), 'activation_eligible');
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
  assert.equal(ci.estimatedJobs, 2);
  assert.equal(ci.estimatedWorkflowRuns, 2);
  assert.deepEqual(ci.workflowNames, ['quality-gate.yml', 'v132-compatibility-gate.yml']);
  assert.equal(ci.confidence, 'constrained_static_workflow_analysis');
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
  assert.ok(workflow.includes('Detect v1.3.2 Source lean path'));
  assert.ok(workflow.includes('CODEX_V132_SOURCE_LEAN=1'));
  assert.ok(workflow.includes("steps.v132-source.outputs.active != 'true'"));
  assert.ok(workflow.includes('codex-v132-safe-summary.json'));
  assert.equal(/actions\/(?:cache\/(?:restore|save)|upload-artifact)@v\d/.test(workflow), false);
});

test('v132_all_automatic_source_jobs_bind_and_assert_exact_head', () => {
  const quality = assertExactHeadWorkflowJobs('.github/workflows/quality-gate.yml', 1);
  const compatibility = assertExactHeadWorkflowJobs('.github/workflows/v132-compatibility-gate.yml', 1);
  assert.equal(quality.jobs.length + compatibility.jobs.length, 2);
  assert.match(quality.workflow, /CODEX_PR_HEAD_SHA:\s*\$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(quality.workflow, /CODEX_V132_BASE_APPLICABILITY=not_applicable/);
  assert.match(quality.workflow, /cp "\$RUNNER_TEMP\/codex-quality-gate\.json" codex-v132-safe-summary\.json/);
  assert.match(quality.workflow, /codex-v132-safe-summary\.json/);
  assert.equal((compatibility.workflow.match(/CODEX_EXPECTED_HEAD_SHA:/g) || []).length, 1);
  assert.equal(/^\s+paths:/m.test(compatibility.workflow), false);
  assert.equal((compatibility.workflow.match(/codex-v132-compatibility-check\.mjs --lane=/g) || []).length, 3);
});

test('v132_workflow_runner_accepts_compact_technical_pass', () => {
  const previous = process.env.CODEX_SKIP_V132_SELF_TEST;
  process.env.CODEX_SKIP_V132_SELF_TEST = '1';
  try {
    const { report } = runV132SourceQualityGate({ repoRoot: ROOT, diagnostics: false, allowDirtyFixture: true });
    accountNestedExecution(report);
    const result = evaluateV132CompactWorkflowReport(report, { gateExit: 0 });
    assert.equal(result.status, 'pass', result.failures.join(','));
    assert.equal(result.technicalRequiredCheckPassed, true);
    assert.equal(result.mergeAllowed, false);
    const summaryLines = buildV132WorkflowSummaryLines(report);
    assert.equal(summaryLines.length, 8);
    assert.equal(summaryLines.some((line) => /mergeReady|qualityScore/.test(line)), false);
    assert.equal(evaluateV132CompactWorkflowReport(report, { gateExit: 7 }).status, 'fail');
    assert.equal(evaluateV132CompactWorkflowReport(report, { gateExit: 0, expectedRepository: 'wrong/repository' }).status, 'fail');
    assert.equal(evaluateV132CompactWorkflowReport(report, { gateExit: 0, expectedHeadSha: 'f'.repeat(40) }).status, 'fail');
    assert.equal(evaluateV132CompactWorkflowReport(report, { gateExit: 0, expectedBaseSha: report.observedBaseSha, baseApplicability: 'required' }).status, 'pass');
    const staleBaseEvaluation = evaluateV132CompactWorkflowReport(report, { gateExit: 0, expectedBaseSha: 'd'.repeat(40), baseApplicability: 'required' });
    assert.equal(staleBaseEvaluation.status, 'fail');
    assert.ok(staleBaseEvaluation.failures.includes('v132_workflow_base_mismatch'));
    const notAncestorReport = { ...structuredClone(report), baseAncestryState: 'mismatch' };
    const notAncestorEvaluation = evaluateV132CompactWorkflowReport(notAncestorReport, { gateExit: 0, expectedBaseSha: report.observedBaseSha, baseApplicability: 'required' });
    assert.equal(notAncestorEvaluation.status, 'fail');
    assert.ok(notAncestorEvaluation.failures.includes('v132_workflow_base_not_ancestor_of_head'));
    const syntheticMergeReport = { ...structuredClone(report), headSha: 'e'.repeat(40) };
    const syntheticMergeEvaluation = evaluateV132CompactWorkflowReport(syntheticMergeReport, { gateExit: 0, expectedHeadSha: report.headSha });
    assert.equal(syntheticMergeEvaluation.status, 'fail');
    assert.ok(syntheticMergeEvaluation.failures.includes('v132_workflow_head_mismatch'));
    const uploadedArtifactProjection = JSON.parse(JSON.stringify(report));
    assert.equal(uploadedArtifactProjection.headSha, report.headSha);
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
    const { report, exitCode } = runV132SourceQualityGate({ repoRoot: ROOT, diagnostics: false, allowDirtyFixture: true });
    accountNestedExecution(report);
    assert.equal(exitCode, 0, report.blockerCodes.join(','));
    assert.equal(report.status, 'pass');
    assert.equal(report.localValidationState, 'passed');
    assert.equal(report.remoteValidationState, 'not_observed');
    assert.equal(report.technicalMergeEligibility, 'blocked');
    assert.equal(report.mergeAllowed, false);
    assert.equal(report.authorityCreated, false);
    assert.equal(report.targetMutationCount, 0);
    assert.equal(report.productMutationCount, 0);
    assert.equal(report.observed.productMutationCount, 0);
    assert.equal(report.candidateLifecycleState, 'local_validated');
    assert.equal(report.remoteUnobservedPassCount, 0);
    assert.equal(report.longRunBudgetStatus.status, 'within_budget');
    assert.ok(report.executionAccounting.subprocessExecutions > 0);
    assert.equal(report.executionAccounting.toolCalls, report.executionAccounting.subprocessExecutions);
    assert.equal(report.validationCoverage.nodeCount, 10);
    assert.match(report.validationCoverage.coverageDigest, /^sha256:[a-f0-9]{64}$/);
    assert.equal(report.validationCoverage.derivation, 'executed_or_attested_node_output_digests');
    assert.equal(Object.hasOwn(report, 'mergeReady'), false);
    assert.equal(Object.hasOwn(report, 'qualityScore'), false);
    assert.equal(Object.hasOwn(report, 'legacyLocalQualityScore'), false);
    assert.ok(Buffer.byteLength(JSON.stringify(report), 'utf8') <= 8192);
  } finally {
    if (previous === undefined) delete process.env.CODEX_SKIP_V132_SELF_TEST;
    else process.env.CODEX_SKIP_V132_SELF_TEST = previous;
  }
});

await Promise.all(pendingTests);
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
