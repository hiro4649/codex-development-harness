#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import fs from 'node:fs';
import { buildV128TrustClosure, validateV128TrustClosure } from './codex-v128-trust-closure.mjs';
import { digestV128StandingAutonomyPolicy } from './codex-v128-standing-autonomy-policy.mjs';

const DEFAULT_REQUIRED_CHECKS = [
  {
    name: 'quality-gate',
    workflowName: 'quality-gate',
    workflowPath: '.github/workflows/quality-gate.yml',
  },
  {
    name: 'target complex',
    workflowName: 'v128-actual-target-canary',
    workflowPath: '.github/workflows/v128-actual-target-canary.yml',
  },
  {
    name: 'target restricted',
    workflowName: 'v128-actual-target-canary',
    workflowPath: '.github/workflows/v128-actual-target-canary.yml',
  },
  {
    name: 'aggregate contract',
    workflowName: 'v128-actual-target-canary',
    workflowPath: '.github/workflows/v128-actual-target-canary.yml',
  },
];
const REQUIRED_CHECK_BINDING_KEYS = new Set([
  'name',
  'workflowName',
  'workflowPath',
  'workflowId',
  'workflowFileDigest',
  'appId',
]);
const DEFAULT_POLICY_PATH = 'docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json';
const RATIFIER_FILES = [
  '.github/workflows/v128-protected-ratifier.yml',
  'scripts/codex-v128-protected-ratifier.mjs',
  'scripts/codex-v128-standing-autonomy-policy.mjs',
  'scripts/codex-v128-trust-closure.mjs',
  DEFAULT_POLICY_PATH,
];

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function digestValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function digestText(text) {
  return `sha256:${crypto.createHash('sha256').update(normalizeText(text)).digest('hex')}`;
}

function normalizeText(text) {
  return String(text).replace(/\r\n/g, '\n');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fileDigest(filePath) {
  const text = normalizeText(fs.readFileSync(filePath, 'utf8'));
  return {
    path: filePath.replace(/\\/g, '/'),
    digest: digestText(text),
    bytes: Buffer.byteLength(text, 'utf8'),
  };
}

function collectSourceTexts() {
  const roots = ['.github/workflows', 'docs/process', 'scripts'];
  const sourceFileTexts = {};
  const visit = (entry) => {
    if (!fs.existsSync(entry)) return;
    const stat = fs.statSync(entry);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(entry).sort()) visit(`${entry}/${child}`);
      return;
    }
    if (!/\.(?:mjs|js|json|md|yml|yaml)$/i.test(entry)) return;
    const normalized = entry.replace(/\\/g, '/');
    sourceFileTexts[normalized] = normalizeText(fs.readFileSync(entry, 'utf8'));
  };
  roots.forEach(visit);
  return sourceFileTexts;
}

function ratifierDigest() {
  return digestValue({
    executorKind: 'v128_protected_ratifier',
    fileDigests: RATIFIER_FILES.map(fileDigest),
  });
}

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1] || fallback;
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function isSha(value) {
  return /^[a-f0-9]{40}$/i.test(String(value || ''));
}

function isDigest(value) {
  return /^sha256:[a-f0-9]{64}$/.test(String(value || ''));
}

function parseRequiredChecks() {
  const raw = env('CODEX_V128_REQUIRED_CHECK_BINDINGS_JSON');
  const reasons = [];
  if (!raw) {
    return {
      checks: DEFAULT_REQUIRED_CHECKS.map((item) => ({
        ...item,
        workflowId: null,
        workflowFileDigest: null,
        appId: null,
      })),
      reasons: ['required_check_bindings_missing'],
    };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { checks: [], reasons: ['required_check_bindings_json_invalid'] };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { checks: [], reasons: ['required_check_bindings_invalid'] };
  }
  const seenNames = new Set();
  const checks = parsed.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      reasons.push(`required_check_binding_not_object:${index}`);
      return { name: '', workflowName: '', workflowPath: '', workflowId: null, workflowFileDigest: null, appId: null };
    }
    for (const key of Object.keys(item)) {
      if (!REQUIRED_CHECK_BINDING_KEYS.has(key)) reasons.push(`required_check_binding_extra_field:${index}:${key}`);
    }
    for (const key of REQUIRED_CHECK_BINDING_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(item, key)) reasons.push(`required_check_binding_missing_field:${index}:${key}`);
    }
    const check = {
      name: String(item.name || '').trim(),
      workflowName: String(item.workflowName || '').trim(),
      workflowPath: String(item.workflowPath || '').trim().replace(/\\/g, '/'),
      workflowId: Number(item.workflowId),
      workflowFileDigest: String(item.workflowFileDigest || '').trim(),
      appId: Number(item.appId),
    };
    if (!check.name) reasons.push(`required_check_binding_empty_name:${index}`);
    if (seenNames.has(check.name)) reasons.push(`required_check_binding_duplicate_name:${check.name}`);
    seenNames.add(check.name);
    if (!check.workflowName) reasons.push(`required_check_binding_empty_workflow_name:${check.name || index}`);
    if (!check.workflowPath) reasons.push(`required_check_binding_empty_workflow_path:${check.name || index}`);
    if (!Number.isInteger(check.workflowId) || check.workflowId <= 0) reasons.push(`required_check_binding_workflow_id_invalid:${check.name || index}`);
    if (!isDigest(check.workflowFileDigest)) reasons.push(`required_check_binding_workflow_digest_invalid:${check.name || index}`);
    if (!Number.isInteger(check.appId) || check.appId <= 0) reasons.push(`required_check_binding_app_id_invalid:${check.name || index}`);
    return check;
  });
  return { checks, reasons };
}

function extractRunId(detailsUrl = '') {
  const match = String(detailsUrl || '').match(/\/actions\/runs\/([0-9]+)/);
  return match ? match[1] : null;
}

function parseRepo(slug) {
  const [owner, repo] = String(slug || '').split('/');
  if (!owner || !repo) throw new Error('invalid_repository');
  return { owner, repo };
}

async function githubApi(path, options = {}) {
  const token = env('GITHUB_TOKEN');
  if (!token) throw new Error('github_token_missing');
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  if (!response.ok) {
    const err = new Error(`github_api_${response.status}`);
    err.body = body;
    throw err;
  }
  return body;
}

async function githubGraphql(query, variables) {
  return githubApi('/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
}

async function getCheckRuns(owner, repo, headSha) {
  const first = await githubApi(`/repos/${owner}/${repo}/commits/${headSha}/check-runs?per_page=100`);
  const runs = Array.isArray(first?.check_runs) ? first.check_runs : [];
  return runs.map((run) => ({
    appId: run.app?.id || null,
    appSlug: run.app?.slug || null,
    checkSuiteId: run.check_suite?.id || null,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    htmlUrl: run.html_url,
    detailsUrl: run.details_url,
    runId: extractRunId(run.details_url),
  }));
}

async function getWorkflowRun(owner, repo, runId) {
  if (!runId) return null;
  return githubApi(`/repos/${owner}/${repo}/actions/runs/${runId}`);
}

function latestByName(runs) {
  const byName = new Map();
  for (const run of runs) {
    const current = byName.get(run.name);
    const currentTime = current?.completedAt || current?.startedAt || '';
    const nextTime = run.completedAt || run.startedAt || '';
    if (!current || nextTime >= currentTime) byName.set(run.name, run);
  }
  return byName;
}

function buildTrustRoot() {
  const policy = readJson(DEFAULT_POLICY_PATH);
  const trustClosure = buildV128TrustClosure({ sourceFileTexts: collectSourceTexts() });
  const trustClosureStatus = validateV128TrustClosure(trustClosure);
  const trusted = {
    policyDigest: env('CODEX_V128_TRUSTED_POLICY_DIGEST'),
    evaluatorDigest: env('CODEX_V128_TRUSTED_EVALUATOR_DIGEST'),
    verifierBundleDigest: env('CODEX_V128_TRUSTED_VERIFIER_BUNDLE_DIGEST'),
    providerAdapterDigest: env('CODEX_V128_TRUSTED_PROVIDER_ADAPTER_DIGEST'),
    scopeClassifierDigest: env('CODEX_V128_TRUSTED_SCOPE_CLASSIFIER_DIGEST'),
    mergeExecutorDigest: env('CODEX_V128_TRUSTED_MERGE_EXECUTOR_DIGEST'),
    canonicalizerDigest: env('CODEX_V128_TRUSTED_CANONICALIZER_DIGEST'),
    finalDecisionAuthorityDigest: env('CODEX_V128_TRUSTED_FINAL_DECISION_AUTHORITY_DIGEST'),
    ratifierDigest: env('CODEX_V128_TRUSTED_RATIFIER_DIGEST'),
    authorityEpoch: env('CODEX_V128_AUTHORITY_EPOCH'),
    trustedAuthorityEpoch: env('CODEX_V128_TRUSTED_AUTHORITY_EPOCH'),
    revocationNonce: env('CODEX_V128_REVOCATION_NONCE'),
    trustedRevocationNonce: env('CODEX_V128_TRUSTED_REVOCATION_NONCE'),
    policySource: env('CODEX_V128_TRUSTED_POLICY_SOURCE'),
  };
  const observed = {
    policyDigest: digestV128StandingAutonomyPolicy(policy),
    evaluatorDigest: fileDigest('scripts/codex-v128-standing-autonomy-policy.mjs').digest,
    verifierBundleDigest: trustClosure.trustDigests?.verifierBundleDigest || null,
    providerAdapterDigest: trustClosure.trustDigests?.providerAdapterDigest || null,
    scopeClassifierDigest: trustClosure.trustDigests?.scopeClassifierDigest || null,
    mergeExecutorDigest: trustClosure.trustDigests?.mergeExecutorDigest || null,
    canonicalizerDigest: trustClosure.trustDigests?.canonicalizerDigest || null,
    finalDecisionAuthorityDigest: trustClosure.trustDigests?.finalDecisionAuthorityDigest || null,
    ratifierDigest: ratifierDigest(),
  };
  return {
    policy,
    trustClosureStatus,
    trusted,
    observed,
  };
}

function trustRootReasons(trustRoot) {
  const reasons = [];
  if (trustRoot.trustClosureStatus.status !== 'pass') reasons.push('trust_closure_not_pass');
  if (trustRoot.trusted.policySource !== 'protected_repository_variable') reasons.push('trusted_policy_source_not_protected_variable');
  for (const key of [
    'policyDigest',
    'evaluatorDigest',
    'verifierBundleDigest',
    'providerAdapterDigest',
    'scopeClassifierDigest',
    'mergeExecutorDigest',
    'canonicalizerDigest',
    'finalDecisionAuthorityDigest',
    'ratifierDigest',
  ]) {
    if (!isDigest(trustRoot.trusted[key])) reasons.push(`trusted_${key}_missing`);
    else if (trustRoot.trusted[key] !== trustRoot.observed[key]) reasons.push(`trusted_${key}_mismatch`);
  }
  if (!trustRoot.trusted.authorityEpoch) reasons.push('authority_epoch_missing');
  if (!trustRoot.trusted.trustedAuthorityEpoch) reasons.push('trusted_authority_epoch_missing');
  if (trustRoot.trusted.authorityEpoch !== trustRoot.trusted.trustedAuthorityEpoch) reasons.push('authority_epoch_mismatch');
  if (!trustRoot.trusted.revocationNonce) reasons.push('revocation_nonce_missing');
  if (!trustRoot.trusted.trustedRevocationNonce) reasons.push('trusted_revocation_nonce_missing');
  if (trustRoot.trusted.revocationNonce !== trustRoot.trusted.trustedRevocationNonce) reasons.push('revocation_nonce_mismatch');
  return reasons;
}

function printTrustVariables() {
  const trustRoot = buildTrustRoot();
  const output = {
    CODEX_V128_TRUSTED_POLICY_SOURCE: 'protected_repository_variable',
    CODEX_V128_TRUSTED_POLICY_DIGEST: trustRoot.observed.policyDigest,
    CODEX_V128_TRUSTED_EVALUATOR_DIGEST: trustRoot.observed.evaluatorDigest,
    CODEX_V128_TRUSTED_VERIFIER_BUNDLE_DIGEST: trustRoot.observed.verifierBundleDigest,
    CODEX_V128_TRUSTED_PROVIDER_ADAPTER_DIGEST: trustRoot.observed.providerAdapterDigest,
    CODEX_V128_TRUSTED_SCOPE_CLASSIFIER_DIGEST: trustRoot.observed.scopeClassifierDigest,
    CODEX_V128_TRUSTED_MERGE_EXECUTOR_DIGEST: trustRoot.observed.mergeExecutorDigest,
    CODEX_V128_TRUSTED_CANONICALIZER_DIGEST: trustRoot.observed.canonicalizerDigest,
    CODEX_V128_TRUSTED_FINAL_DECISION_AUTHORITY_DIGEST: trustRoot.observed.finalDecisionAuthorityDigest,
    CODEX_V128_TRUSTED_RATIFIER_DIGEST: trustRoot.observed.ratifierDigest,
    CODEX_V128_REQUIRED_CHECK_APP_ID: '15368',
  };
  process.stdout.write(`${canonicalJson(output)}\n`);
}

function printRequiredCheckBindingTemplate() {
  const output = DEFAULT_REQUIRED_CHECKS.map((check) => ({
    ...check,
    workflowId: null,
    workflowFileDigest: fs.existsSync(check.workflowPath) ? fileDigest(check.workflowPath).digest : null,
    appId: Number(env('CODEX_V128_REQUIRED_CHECK_APP_ID') || '15368'),
  }));
  process.stdout.write(`${canonicalJson(output)}\n`);
}

function safeError(error) {
  return {
    name: error?.name || 'Error',
    message: String(error?.message || 'unknown').slice(0, 160),
    status: error?.body?.status || undefined,
  };
}

async function main() {
  if (hasFlag('print-trust-vars')) {
    printTrustVariables();
    return;
  }
  if (hasFlag('print-required-check-binding-template')) {
    printRequiredCheckBindingTemplate();
    return;
  }

  const execute = hasFlag('execute') || env('CODEX_V128_EXECUTE_MERGE') === '1';
  const prNumber = Number(argValue('pr', env('CODEX_PR_NUMBER')));
  const expectedHead = String(argValue('expected-head', env('CODEX_EXPECTED_HEAD_SHA')) || '').trim();
  const expectedBase = String(argValue('expected-base', env('CODEX_EXPECTED_BASE_SHA')) || '').trim();
  const defaultBranch = String(env('GITHUB_REF_NAME') || env('GITHUB_DEFAULT_BRANCH') || 'main').trim();
  const repository = env('GITHUB_REPOSITORY', 'hiro4649/codex-development-harness');
  const repositoryId = env('GITHUB_REPOSITORY_ID');
  const parsedRequiredChecks = parseRequiredChecks();
  const requiredChecks = parsedRequiredChecks.checks;
  const expectedAppId = Number(env('CODEX_V128_REQUIRED_CHECK_APP_ID') || '0') || null;
  const { owner, repo } = parseRepo(repository);
  const reasons = [];
  const trustRoot = buildTrustRoot();

  if (!Number.isInteger(prNumber) || prNumber <= 0) reasons.push('pr_number_invalid');
  if (!isSha(expectedHead)) reasons.push('expected_head_invalid');
  if (!isSha(expectedBase)) reasons.push('expected_base_invalid');
  if (env('GITHUB_EVENT_NAME') !== 'workflow_dispatch') reasons.push('workflow_dispatch_required');
  if (defaultBranch !== 'main') reasons.push('default_branch_ref_required');
  if (!repositoryId) reasons.push('repository_id_missing');
  if (!expectedAppId) reasons.push('required_check_app_id_missing');
  reasons.push(...parsedRequiredChecks.reasons);
  reasons.push(...trustRootReasons(trustRoot));

  let pr = null;
  let requiredCheckRuns = {};
  let requiredWorkflowRuns = {};
  let mergeResult = null;
  try {
    if (!reasons.length) {
      pr = await githubApi(`/repos/${owner}/${repo}/pulls/${prNumber}`);
      if (pr.state !== 'open') reasons.push('pr_not_open');
      if (pr.base?.ref !== 'main') reasons.push('pr_base_not_main');
      if (String(pr.base?.sha || '').toLowerCase() !== expectedBase.toLowerCase()) reasons.push('pr_base_mismatch');
      if (String(pr.head?.sha || '').toLowerCase() !== expectedHead.toLowerCase()) reasons.push('pr_head_mismatch');
      const checkRuns = await getCheckRuns(owner, repo, expectedHead);
      const byName = latestByName(checkRuns);
      requiredCheckRuns = Object.fromEntries(requiredChecks.map((check) => [check.name, byName.get(check.name) || null]));
      for (const check of requiredChecks) {
        const run = requiredCheckRuns[check.name];
        if (!run) {
          reasons.push(`required_check_missing:${check.name}`);
          continue;
        }
        if (run.status !== 'completed' && run.status !== 'COMPLETED') reasons.push(`required_check_not_completed:${check.name}`);
        if (run.conclusion !== 'success' && run.conclusion !== 'SUCCESS') reasons.push(`required_check_not_success:${check.name}`);
        if (expectedAppId && Number(run.appId) !== expectedAppId) reasons.push(`required_check_app_mismatch:${check.name}`);
        if (check.appId && Number(run.appId) !== check.appId) reasons.push(`required_check_binding_app_mismatch:${check.name}`);
        const workflowRun = await getWorkflowRun(owner, repo, run.runId);
        const workflowFileDigest = check.workflowPath && fs.existsSync(check.workflowPath) ? fileDigest(check.workflowPath).digest : null;
        requiredWorkflowRuns[check.name] = workflowRun ? {
          event: workflowRun.event,
          headSha: workflowRun.head_sha,
          headBranch: workflowRun.head_branch,
          path: workflowRun.path,
          workflowId: workflowRun.workflow_id,
          expectedWorkflowId: check.workflowId,
          name: workflowRun.name,
          workflowFileDigest,
          expectedWorkflowFileDigest: check.workflowFileDigest,
        } : null;
        if (!workflowRun) reasons.push(`required_check_workflow_run_missing:${check.name}`);
        else {
          if (workflowRun.event !== 'pull_request') reasons.push(`required_check_event_mismatch:${check.name}`);
          if (String(workflowRun.head_sha || '').toLowerCase() !== expectedHead.toLowerCase()) reasons.push(`required_check_head_mismatch:${check.name}`);
          if (check.workflowName && workflowRun.name !== check.workflowName) reasons.push(`required_check_workflow_name_mismatch:${check.name}`);
          if (check.workflowPath && workflowRun.path !== check.workflowPath) reasons.push(`required_check_workflow_path_mismatch:${check.name}`);
          if (Number(workflowRun.workflow_id) !== Number(check.workflowId)) reasons.push(`required_check_workflow_id_mismatch:${check.name}`);
        }
        if (check.workflowPath) {
          if (!workflowFileDigest) reasons.push(`required_check_workflow_digest_missing:${check.name}`);
          else if (workflowFileDigest !== check.workflowFileDigest) reasons.push(`required_check_workflow_digest_mismatch:${check.name}`);
        }
      }
    }
    if (!reasons.length && execute) {
      if (pr.draft === true) {
        await githubGraphql(
          'mutation($id: ID!) { markPullRequestReadyForReview(input: { pullRequestId: $id }) { pullRequest { id isDraft } } }',
          { id: pr.node_id },
        );
        pr = await githubApi(`/repos/${owner}/${repo}/pulls/${prNumber}`);
        if (pr.draft === true) reasons.push('pr_ready_transition_failed');
        if (String(pr.head?.sha || '').toLowerCase() !== expectedHead.toLowerCase()) reasons.push('pr_head_changed_after_ready');
        if (String(pr.base?.sha || '').toLowerCase() !== expectedBase.toLowerCase()) reasons.push('pr_base_changed_after_ready');
      }
      if (!reasons.length) {
        pr = await githubApi(`/repos/${owner}/${repo}/pulls/${prNumber}`);
        if (pr.draft === true) reasons.push('pr_draft_before_merge');
        if (String(pr.head?.sha || '').toLowerCase() !== expectedHead.toLowerCase()) reasons.push('pr_head_changed_before_merge');
        if (String(pr.base?.sha || '').toLowerCase() !== expectedBase.toLowerCase()) reasons.push('pr_base_changed_before_merge');
      }
      if (!reasons.length) {
        mergeResult = await githubApi(`/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sha: expectedHead,
            merge_method: 'squash',
            commit_title: `Ratify PR #${prNumber} at ${expectedHead.slice(0, 12)}`,
            commit_message: 'v1.2.8 protected ratifier exact-head CAS merge',
          }),
        });
      }
    }
  } catch (error) {
    reasons.push('protected_ratifier_github_api_failed');
    mergeResult = { error: safeError(error) };
  }

  const status = reasons.length ? 'blocked' : (execute ? 'merged' : 'ratified');
  const result = {
    schemaVersion: '1.2.8',
    resultKind: 'protected_ratifier_result',
    status,
    prNumber,
    expectedHead,
    expectedBase,
    repository,
    repositoryIdDigest: repositoryId ? digestValue({ repositoryId }) : null,
    executeMergeRequested: execute,
    requiredChecks: requiredCheckRuns,
    requiredWorkflowRuns,
    trustRootDigest: digestValue({
      policyDigest: trustRoot.observed.policyDigest,
      evaluatorDigest: trustRoot.observed.evaluatorDigest,
      trustDigests: {
        verifierBundleDigest: trustRoot.observed.verifierBundleDigest,
        providerAdapterDigest: trustRoot.observed.providerAdapterDigest,
        scopeClassifierDigest: trustRoot.observed.scopeClassifierDigest,
        mergeExecutorDigest: trustRoot.observed.mergeExecutorDigest,
        canonicalizerDigest: trustRoot.observed.canonicalizerDigest,
        finalDecisionAuthorityDigest: trustRoot.observed.finalDecisionAuthorityDigest,
      },
      ratifierDigest: trustRoot.observed.ratifierDigest,
      authorityEpoch: trustRoot.trusted.authorityEpoch,
      revocationNonceDigest: trustRoot.trusted.revocationNonce ? digestValue({ revocationNonce: trustRoot.trusted.revocationNonce }) : null,
    }),
    mergeCommitSha: mergeResult?.sha || null,
    reasonCodes: reasons,
    safeNextAction: reasons.length ? 'fix_protected_control_plane_only' : (execute ? 'run_main_post_merge_verification' : 'rerun_with_execute_merge'),
    prHeadMayAuthorizeItself: false,
    humanPerPrDecisionRequired: false,
    safeSummaryOnly: true,
  };
  process.stdout.write(`${canonicalJson(result)}\n`);
  if (env('CODEX_V128_RATIFIER_RESULT_PATH')) {
    fs.writeFileSync(env('CODEX_V128_RATIFIER_RESULT_PATH'), `${canonicalJson(result)}\n`);
  }
  process.exit(reasons.length ? 1 : 0);
}

main().catch((error) => {
  const result = {
    schemaVersion: '1.2.8',
    resultKind: 'protected_ratifier_result',
    status: 'blocked',
    reasonCodes: ['protected_ratifier_unhandled_exception'],
    error: safeError(error),
    safeNextAction: 'fix_protected_control_plane_only',
    safeSummaryOnly: true,
  };
  process.stdout.write(`${canonicalJson(result)}\n`);
  process.exit(1);
});
