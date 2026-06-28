#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.1

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const V131_VERSION = '1.3.1';
export const V131_SELF_TEST_STATUS_KEY = 'v131SelfTestStatus';
export const V131_SELF_TEST_SUITE = 'v131';

export const V131_BACKLOG_ORDER = [
  'workspace_identity_gate',
  'manifest_strict_validator',
  'validation_state_machine',
  'target_profile_drift_linter',
  'remote_ci_cost_gate',
  'decision_capsule_v2',
  'compatibility_debt_ledger',
  'target_profile_installer_dry_run',
  'product_value_return_gate_advisory',
];

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value)).digest('hex')}`;
}

export function rejectDuplicateKeys(jsonText) {
  const stack = [];
  let inString = false;
  let escaping = false;
  let token = '';
  let afterString = false;
  for (let i = 0; i < jsonText.length; i += 1) {
    const char = jsonText[i];
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === '\\') {
        escaping = true;
      } else if (char === '"') {
        inString = false;
        afterString = true;
      } else {
        token += char;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      escaping = false;
      token = '';
      afterString = false;
      continue;
    }
    if (char === '{') stack.push({ keys: new Set(), expectKey: true });
    if (char === '}') stack.pop();
    if (char === ',') {
      const top = stack[stack.length - 1];
      if (top) top.expectKey = true;
    }
    if (afterString && char === ':') {
      const top = stack[stack.length - 1];
      if (top?.expectKey) {
        if (top.keys.has(token)) throw new Error(`duplicate_key:${token}`);
        top.keys.add(token);
        top.expectKey = false;
      }
    }
    if (!/\s/.test(char)) afterString = false;
  }
}

export function readJsonStrict(file) {
  const text = fs.readFileSync(file, 'utf8');
  rejectDuplicateKeys(text);
  return JSON.parse(text);
}

function safeRead(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function resolveGitDir(repoRoot) {
  const dotGit = path.join(repoRoot, '.git');
  if (fs.existsSync(dotGit) && fs.statSync(dotGit).isDirectory()) return dotGit;
  const dotGitText = safeRead(dotGit).trim();
  const match = dotGitText.match(/^gitdir:\s*(.+)$/i);
  if (!match) return null;
  const gitdir = match[1].trim();
  return path.resolve(repoRoot, gitdir);
}

function readGitConfigSurface(repoRoot) {
  const gitDir = resolveGitDir(repoRoot);
  if (!gitDir) return '';
  const configParts = [safeRead(path.join(gitDir, 'config'))];
  const commonDirText = safeRead(path.join(gitDir, 'commondir')).trim();
  if (commonDirText) {
    const commonDir = path.resolve(gitDir, commonDirText);
    configParts.push(safeRead(path.join(commonDir, 'config')));
  }
  return configParts.join('\n');
}

function normalize(value) {
  return String(value || '').replaceAll('\\', '/').toLowerCase();
}

function canonicalRepositorySlug(value) {
  return normalize(value)
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/^git@github\.com:/, '')
    .replace(/\.git$/, '')
    .replace(/^\/+|\/+$/g, '');
}

function repositorySlugFromRemoteUrl(remoteUrl) {
  const raw = normalize(remoteUrl).trim();
  const match = raw.match(/github\.com[:/]([^/\s:#?]+)\/([^/\s#?]+)/);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '').replace(/[?#].*$/, '');
  return `${owner}/${repo}`;
}

function extractRepositorySlugsFromGitConfig(gitConfig) {
  const slugs = [];
  for (const line of String(gitConfig || '').split(/\r?\n/)) {
    const match = line.match(/^\s*url\s*=\s*(.+?)\s*$/i);
    const slug = match ? repositorySlugFromRemoteUrl(match[1]) : null;
    if (slug) slugs.push(slug);
  }
  return Array.from(new Set(slugs));
}

export function evaluateWorkspaceIdentity({
  repoRoot = process.cwd(),
  expectedRepository = 'hiro4649/codex-development-harness',
  expectedHarnessVersion = V131_VERSION,
  expectedSelfTestSuite = V131_SELF_TEST_SUITE,
} = {}) {
  const reasons = [];
  const gitConfig = readGitConfigSurface(repoRoot);
  const agents = safeRead(path.join(repoRoot, 'AGENTS.md'));
  const sourceManifestPath = path.join(repoRoot, 'CODEX_SOURCE_HARNESS_MANIFEST.json');
  const manifestPath = path.join(repoRoot, 'docs', 'process', 'CODEX_HARNESS_MANIFEST.json');
  const sourceManifest = fs.existsSync(sourceManifestPath) ? readJsonStrict(sourceManifestPath) : {};
  const manifest = fs.existsSync(manifestPath) ? readJsonStrict(manifestPath) : {};
  const expectedRepositorySlug = canonicalRepositorySlug(expectedRepository);
  const observedRemoteRepositories = extractRepositorySlugsFromGitConfig(gitConfig);
  const remoteMatches = observedRemoteRepositories.includes(expectedRepositorySlug);
  if (!remoteMatches) reasons.push('workspace_identity_remote_mismatch');
  if (!agents.includes(`CODEX_QUALITY_HARNESS_FILE v${expectedHarnessVersion}`)) reasons.push('workspace_identity_agents_marker_mismatch');
  if (sourceManifest.activeHarnessVersion !== expectedHarnessVersion) reasons.push('workspace_identity_source_active_version_mismatch');
  if (sourceManifest.activeSelfTestSuite !== expectedSelfTestSuite) reasons.push('workspace_identity_source_self_test_mismatch');
  if (manifest.activeHarnessVersion !== expectedHarnessVersion) reasons.push('workspace_identity_docs_active_version_mismatch');
  if (manifest.activeSelfTestSuite !== expectedSelfTestSuite) reasons.push('workspace_identity_docs_self_test_mismatch');
  return {
    status: reasons.length ? 'fail' : 'pass',
    expectedRepository,
    expectedRepositorySlug,
    observedRemoteRepositories,
    expectedHarnessVersion,
    expectedSelfTestSuite,
    reasonCodes: reasons,
    createsAuthority: false,
    safeSummaryOnly: true,
  };
}

export function validateManifestStrict({ sourceManifest = {}, docsManifest = {}, activePolicy = {} } = {}) {
  const reasons = [];
  const manifests = [
    ['source', sourceManifest],
    ['docs', docsManifest],
    ['active_policy', activePolicy],
  ];
  for (const [label, manifest] of manifests) {
    if (manifest.activeHarnessVersion !== V131_VERSION) reasons.push(`${label}_activeHarnessVersion_not_v131`);
    if (manifest.activeSelfTestSuite !== V131_SELF_TEST_SUITE) reasons.push(`${label}_activeSelfTestSuite_not_v131`);
    if (manifest.activeSelfTestStatusKey !== V131_SELF_TEST_STATUS_KEY) reasons.push(`${label}_activeSelfTestStatusKey_not_v131`);
    if (manifest.authorityCreated !== false) reasons.push(`${label}_authority_created`);
    if (manifest.performanceTrack?.state !== 'deferred') reasons.push(`${label}_performance_track_not_deferred`);
    if (manifest.performanceTrack?.superiorityClaimState !== 'not_proven') reasons.push(`${label}_superiority_claim_not_not_proven`);
  }
  if (sourceManifest.previousVersion !== '1.3.0') reasons.push('source_previousVersion_not_v130');
  if (sourceManifest.versionAuthority?.v131 !== 'blocking_current_active_authority') reasons.push('v131_authority_missing');
  if (sourceManifest.versionAuthority?.v130 !== 'immediate_rollback') reasons.push('v130_immediate_rollback_missing');
  if (sourceManifest.versionAuthority?.v129 !== 'immediate_rollback') reasons.push('v129_immediate_rollback_missing');
  if (sourceManifest.versionAuthority?.v128 !== 'blocking_compatibility') reasons.push('v128_blocking_compatibility_missing');
  if (sourceManifest.versionAuthority?.v127 !== 'compatibility_readable') reasons.push('v127_readable_compatibility_missing');
  return {
    status: reasons.length ? 'fail' : 'pass',
    reasonCodes: reasons,
    createsAuthority: false,
    safeSummaryOnly: true,
  };
}

export function classifyValidationState({
  localChecksPass = false,
  remoteChecksPass = false,
  remoteCiAllowed = true,
  remoteChecksStarted = false,
  mergeRequested = false,
} = {}) {
  const localReadiness = localChecksPass ? 'ready' : 'fail';
  const remoteValidation = remoteChecksPass
    ? 'pass'
    : remoteCiAllowed
      ? (remoteChecksStarted ? 'run_failed_or_pending' : 'remote_pending')
      : 'blocked_ci_quota';
  const mergeReadiness = localReadiness === 'ready' && remoteValidation === 'pass' && mergeRequested
    ? 'merge_ready'
    : 'merge_blocked';
  return {
    status: localReadiness === 'ready' ? 'pass' : 'fail',
    localReadiness,
    remoteValidation,
    mergeReadiness,
    localPassPromotedToRemotePass: false,
    remotePendingPromotedToPass: false,
    createsAuthority: false,
    safeSummaryOnly: true,
  };
}

export function lintTargetProfileDrift({ registeredTargets = [], targetProfileStrategy = {} } = {}) {
  const reasons = [];
  const seen = new Map();
  const expectedProfiles = {
    'hiro4649/VGC-FUNKY-TOKEN': 'thin_target',
    'hiro4649/iris-live2d-renderer': 'metadata_gate_target',
    'hiro4649/disco-funky-repair': 'metadata_gate_target',
    'hiro4649/iris': 'metadata_gate_target',
    'hiro4649/VOXWEAVE': 'full_quality_gate_target',
    'hiro4649/CRIPTO-TIP': 'product_heavy_target',
  };
  const profileClassification = targetProfileStrategy.profileClassification || {};
  for (const [profile, repos] of Object.entries(profileClassification)) {
    for (const repo of repos || []) {
      if (seen.has(repo)) reasons.push(`target_profile_duplicate:${repo}`);
      seen.set(repo, profile);
    }
  }
  for (const target of registeredTargets) {
    const repo = target.repositoryFullName;
    if (!seen.has(repo)) reasons.push(`target_profile_missing:${repo}`);
    const expectedProfile = expectedProfiles[repo];
    if (expectedProfile && seen.get(repo) !== expectedProfile) {
      reasons.push(`target_profile_drift:${repo}:${expectedProfile}`);
    }
  }
  return {
    status: reasons.length ? 'fail' : 'pass',
    reasonCodes: reasons,
    createsAuthority: false,
    safeSummaryOnly: true,
  };
}

export function evaluateRemoteCiCostGate({
  remoteCiAllowed = true,
  action = 'local_checks',
  estimatedRuns = 0,
  workflowDispatch = false,
  rerun = false,
} = {}) {
  const reasons = [];
  if (!remoteCiAllowed && workflowDispatch) reasons.push('workflow_dispatch_forbidden_when_remote_ci_blocked');
  if (!remoteCiAllowed && rerun) reasons.push('actions_rerun_forbidden_when_remote_ci_blocked');
  if (!remoteCiAllowed && action === 'merge') reasons.push('merge_forbidden_when_remote_ci_blocked');
  const mergeReadiness = remoteCiAllowed ? 'remote_required_checks_required' : 'merge_blocked';
  const remoteValidation = remoteCiAllowed ? 'remote_pending' : 'blocked_ci_quota';
  const remoteRequiredChecksPassed = false;
  const mergeAllowed = false;
  return {
    status: reasons.length ? 'fail' : 'pass',
    action,
    remoteCiAllowed,
    estimatedRuns,
    remoteValidation,
    mergeReadiness,
    remoteRequiredChecksPassed,
    mergeAllowed,
    pushAllowed: true,
    prCreationAllowed: true,
    mergeActionAllowed: mergeAllowed,
    requiredCheckBypassAllowed: false,
    localPassPromotedToRemotePass: false,
    workflowDispatchAllowed: remoteCiAllowed,
    rerunAllowed: remoteCiAllowed,
    reasonCodes: reasons,
    createsAuthority: false,
    safeSummaryOnly: true,
  };
}

export function buildDecisionCapsuleV2({
  activeHarnessVersion = V131_VERSION,
  branch = null,
  head = null,
  changedFiles = [],
  localChecks = 'not_run',
  remoteValidation = 'remote_pending',
  mergeReadiness = 'merge_blocked',
  blockers = [],
  nextSafeAction = 'run_local_checks',
} = {}) {
  const remoteRequiredChecksPassed = remoteValidation === 'pass';
  const mergeAllowed = mergeReadiness === 'merge_ready' && remoteRequiredChecksPassed;
  return {
    capsuleVersion: 'v2',
    activeHarnessVersion,
    branch,
    head,
    changedFiles: changedFiles.slice(0, 20),
    changedFileCount: changedFiles.length,
    localChecks,
    remoteValidation,
    mergeReadiness,
    remoteRequiredChecksPassed,
    mergeAllowed,
    requiredCheckBypassAllowed: false,
    localPassPromotedToRemotePass: false,
    blockers: blockers.slice(0, 5),
    nextSafeAction,
    maxDisplayLines: 50,
    createsAuthority: false,
    safeSummaryOnly: true,
  };
}

export function buildCompatibilityDebtLedger({
  debts = [
    {
      state: 'pass_with_compatibility_debt',
      reason: 'legacy target gate shape preserved',
      introducedIn: '1.3.0',
      mustReviewBefore: '1.3.2',
      affectsAuthority: false,
      blocking: false,
    },
  ],
} = {}) {
  const reasons = [];
  for (const [index, debt] of debts.entries()) {
    if (debt.state !== 'pass_with_compatibility_debt') reasons.push(`debt_${index}_state_invalid`);
    if (!debt.reason) reasons.push(`debt_${index}_reason_missing`);
    if (!debt.introducedIn) reasons.push(`debt_${index}_introducedIn_missing`);
    if (!debt.mustReviewBefore) reasons.push(`debt_${index}_mustReviewBefore_missing`);
    if (debt.affectsAuthority !== false) reasons.push(`debt_${index}_authority_affecting`);
    if (debt.blocking !== false) reasons.push(`debt_${index}_blocking`);
  }
  return {
    status: reasons.length ? 'fail' : 'pass',
    debts,
    reasonCodes: reasons,
    createsAuthority: false,
    safeSummaryOnly: true,
  };
}

export function dryRunTargetProfileInstall({
  repositoryFullName,
  profile,
  changedFiles = [],
  sourceManifestCopied = false,
} = {}) {
  const maxChangedFiles = 50;
  const maxReasonCodes = 50;
  const maxSourceManifestCopyPaths = 20;
  const reasons = [];
  const sensitivePatterns = [
    /(^|\/)package(-lock)?\.json$/i,
    /(^|\/)pnpm-lock\.yaml$/i,
    /(^|\/)yarn\.lock$/i,
    /(^|\/)bun\.lockb$/i,
    /(^|\/)contracts?\//i,
    /(^|\/)migrations?\//i,
    /(^|\/)runtime\//i,
    /(^|\/)deploy(ment)?\//i,
    /(^|\/)scripts\/deploy/i,
    /^\.github\/workflows\/deploy/i,
    /wallet/i,
    /rpc/i,
    /secret/i,
    /(^|\/)\.env(\.|$)/i,
    /^src\//i,
    /^apps\//i,
  ];
  if (!repositoryFullName) reasons.push('target_repository_missing');
  if (!profile) reasons.push('target_profile_missing');
  if (sourceManifestCopied) reasons.push('source_manifest_copy_forbidden');
  let sensitiveDiffCount = 0;
  let sourceManifestCopyDetected = sourceManifestCopied;
  const sourceManifestCopyPaths = [];
  const normalizedChangedFiles = [];
  for (const file of changedFiles) {
    const normalized = file.replaceAll('\\', '/');
    normalizedChangedFiles.push(normalized);
    if (/(^|\/)CODEX_SOURCE_HARNESS_MANIFEST\.json$/i.test(normalized)) {
      sourceManifestCopyDetected = true;
      sourceManifestCopyPaths.push(normalized);
      if (!reasons.includes('source_manifest_copy_forbidden')) reasons.push('source_manifest_copy_forbidden');
    }
    if (sensitivePatterns.some((pattern) => pattern.test(normalized))) {
      sensitiveDiffCount += 1;
      reasons.push(`sensitive_diff_forbidden:${normalized}`);
    }
  }
  return {
    status: reasons.length ? 'fail' : 'pass',
    mode: 'dry_run_only',
    repositoryFullName,
    profile,
    changedFiles: normalizedChangedFiles.slice(0, maxChangedFiles),
    changedFileCount: normalizedChangedFiles.length,
    changedFilesOmittedCount: Math.max(0, normalizedChangedFiles.length - maxChangedFiles),
    automaticMutationAllowed: false,
    productMutationCount: changedFiles.filter((file) => /(^|\/)(src|apps|runtime|contracts?)\//i.test(file.replaceAll('\\', '/'))).length,
    sensitiveDiffCount,
    sourceManifestCopied: sourceManifestCopyDetected,
    sourceManifestCopyCount: sourceManifestCopyPaths.length,
    sourceManifestCopyPaths: sourceManifestCopyPaths.slice(0, maxSourceManifestCopyPaths),
    sourceManifestCopyPathsOmittedCount: Math.max(0, sourceManifestCopyPaths.length - maxSourceManifestCopyPaths),
    reasonCodes: reasons.slice(0, maxReasonCodes),
    reasonCodeCount: reasons.length,
    reasonCodesOmittedCount: Math.max(0, reasons.length - maxReasonCodes),
    createsAuthority: false,
    safeSummaryOnly: true,
  };
}

export function evaluateProductValueReturnGate({
  consecutiveHarnessOrDocsPrs = 0,
  threshold = 3,
} = {}) {
  return {
    status: 'pass',
    state: consecutiveHarnessOrDocsPrs >= threshold ? 'advisory' : 'not_applicable',
    blocking: false,
    consecutiveHarnessOrDocsPrs,
    threshold,
    recommendation: consecutiveHarnessOrDocsPrs >= threshold
      ? 'consider_product_value_task_before_more_harness_work'
      : 'no_product_value_return_advisory',
    createsAuthority: false,
    safeSummaryOnly: true,
  };
}

export function buildOperationalConvergenceCore({
  sourceManifest = {},
  docsManifest = {},
  activePolicy = {},
  remoteCiAllowed = process.env.CODEX_REMOTE_CI_ALLOWED !== 'false',
} = {}) {
  const validationState = classifyValidationState({ localChecksPass: true, remoteCiAllowed });
  return {
    version: V131_VERSION,
    name: 'HARNESS v1.3.1 Operational Convergence Core',
    purpose: 'prevent operational premise mistakes without adding product or runtime authority',
    backlogOrder: V131_BACKLOG_ORDER,
    manifestStrictStatus: validateManifestStrict({ sourceManifest, docsManifest, activePolicy }),
    targetProfileDriftStatus: lintTargetProfileDrift({
      registeredTargets: sourceManifest.registeredTargetRepositories || [],
      targetProfileStrategy: sourceManifest.targetProfileStrategy || {},
    }),
    validationState,
    remoteCiCostGate: evaluateRemoteCiCostGate({ remoteCiAllowed }),
    decisionCapsuleV2: buildDecisionCapsuleV2({ remoteValidation: validationState.remoteValidation }),
    compatibilityDebtLedger: buildCompatibilityDebtLedger(),
    targetProfileInstallerDryRun: dryRunTargetProfileInstall({
      repositoryFullName: 'hiro4649/disco-funky-repair',
      profile: 'metadata_gate_target',
      changedFiles: ['AGENTS.md', 'docs/process/CODEX_HARNESS_MANIFEST.json'],
    }),
    productValueReturnGate: evaluateProductValueReturnGate({ consecutiveHarnessOrDocsPrs: 3 }),
    createsAuthority: false,
    targetRolloutStarted: false,
    performanceTrackStarted: false,
    fableComparisonStarted: false,
    sdkBenchmarkStarted: false,
    skillRuntimeStarted: false,
    dagRuntimeStarted: false,
    safeSummaryOnly: true,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const sourceManifest = readJsonStrict(path.join(root, 'CODEX_SOURCE_HARNESS_MANIFEST.json'));
  const docsManifest = readJsonStrict(path.join(root, 'docs', 'process', 'CODEX_HARNESS_MANIFEST.json'));
  const activePolicy = readJsonStrict(path.join(root, 'docs', 'process', 'CODEX_ACTIVE_POLICY_INDEX.json'));
  console.log(JSON.stringify(buildOperationalConvergenceCore({ sourceManifest, docsManifest, activePolicy }), null, 2));
}
