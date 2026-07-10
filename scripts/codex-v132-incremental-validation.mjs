#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalJson, sha256, V132_VERSION } from './codex-v132-evidence-truth.mjs';

export const V132_NODE_EXECUTOR_VERSION = 'v132-node-executor-2';
export const V132_WORKSPACE_DIGEST_VERSION = 'v132-workspace-content-1';

export const V132_VALIDATION_GRAPH = Object.freeze([
  {
    nodeId: 'workspace_identity',
    dependsOn: [],
    inputDigests: ['repositoryDigest', 'gitIdentityDigest'],
    invalidationKeys: ['git_identity', 'agents_marker'],
    costClass: 'fast',
    requiredProfiles: ['source_control_plane'],
    outputSchema: 'v132_status',
  },
  {
    nodeId: 'manifest_compile',
    dependsOn: ['workspace_identity'],
    inputDigests: ['policyDigest', 'manifestDigest'],
    invalidationKeys: ['manifest_files', 'policy_files'],
    costClass: 'fast',
    requiredProfiles: ['source_control_plane'],
    outputSchema: 'v132_status',
  },
  {
    nodeId: 'registry_observation',
    dependsOn: ['manifest_compile'],
    inputDigests: ['registryDigest', 'observationDigest'],
    invalidationKeys: ['registry_files', 'observation_receipt'],
    costClass: 'fast',
    requiredProfiles: ['source_control_plane'],
    outputSchema: 'v132_observation_status',
  },
  {
    nodeId: 'changed_file_classification',
    dependsOn: ['workspace_identity'],
    inputDigests: ['workspaceStateDigest', 'classificationPolicyDigest'],
    invalidationKeys: ['git_diff', 'classification_policy'],
    costClass: 'fast',
    requiredProfiles: ['source_control_plane'],
    outputSchema: 'v132_classification_status',
  },
  {
    nodeId: 'dependency_closure',
    dependsOn: ['changed_file_classification', 'manifest_compile'],
    inputDigests: ['graphDigest', 'workspaceStateDigest', 'policyDigest'],
    invalidationKeys: ['validation_graph', 'git_diff', 'policy_files'],
    costClass: 'fast',
    requiredProfiles: ['source_control_plane'],
    outputSchema: 'v132_dependency_status',
  },
  {
    nodeId: 'selected_local_checks',
    dependsOn: ['dependency_closure'],
    inputDigests: ['selectedCheckDigest', 'toolchainDigest', 'environmentDigest'],
    invalidationKeys: ['selected_check_inputs', 'toolchain', 'execution_environment'],
    costClass: 'bounded',
    requiredProfiles: ['source_control_plane'],
    outputSchema: 'v132_local_check_status',
  },
  {
    nodeId: 'compatibility_checks',
    dependsOn: ['selected_local_checks'],
    inputDigests: ['compatibilityInputDigest', 'toolchainDigest'],
    invalidationKeys: ['compatibility_files', 'toolchain'],
    costClass: 'bounded',
    requiredProfiles: ['source_control_plane'],
    outputSchema: 'v132_compatibility_status',
  },
  {
    nodeId: 'evidence_truth_projection',
    dependsOn: ['registry_observation', 'compatibility_checks'],
    inputDigests: ['evidenceDigest', 'headSha'],
    invalidationKeys: ['evidence_receipt', 'git_head'],
    costClass: 'fast',
    requiredProfiles: ['source_control_plane'],
    outputSchema: 'v132_canonical_state',
    alwaysRun: true,
  },
  {
    nodeId: 'compact_output_rendering',
    dependsOn: ['evidence_truth_projection'],
    inputDigests: ['canonicalStateDigest', 'outputPolicyDigest'],
    invalidationKeys: ['canonical_state', 'output_policy'],
    costClass: 'fast',
    requiredProfiles: ['source_control_plane'],
    outputSchema: 'v132_compact_output',
    alwaysRun: true,
  },
  {
    nodeId: 'ci_cost_planning',
    dependsOn: ['changed_file_classification', 'compact_output_rendering'],
    inputDigests: ['workflowDigest', 'changeClassDigest'],
    invalidationKeys: ['workflow_files', 'change_class'],
    costClass: 'fast',
    requiredProfiles: ['source_control_plane'],
    outputSchema: 'v132_ci_cost_plan',
    alwaysRun: true,
  },
]);

const FULL_GATE_CLASSES = new Set(['source_core', 'workflow', 'unknown']);
const DOC_PATTERN = /^(?:README\.md|AGENTS\.md|docs\/|\.github\/pull_request_template\.md)/i;
const SOURCE_PATTERN = /^(?:CODEX_SOURCE_HARNESS_MANIFEST\.json|scripts\/codex-|docs\/process\/CODEX_|\.github\/workflows\/)/i;

function normalizePath(file) {
  return String(file || '').replaceAll('\\', '/').replace(/^\.\//, '');
}

function digestBytes(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function accountSubprocess(accounting) {
  if (accounting && typeof accounting === 'object') {
    accounting.subprocessExecutions = Number(accounting.subprocessExecutions || 0) + 1;
  }
}

function gitBuffer(repoRoot, args, accounting) {
  accountSubprocess(accounting);
  const result = spawnSync('git', args, { cwd: repoRoot, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`workspace_git_failed:${args[0]}:${String(result.stderr || '').slice(-256)}`);
  }
  return Buffer.from(result.stdout || Buffer.alloc(0));
}

function nullSeparated(buffer) {
  return buffer.toString('utf8').split('\0').filter(Boolean);
}

function parseIndexEntries(buffer) {
  const entries = new Map();
  for (const item of nullSeparated(buffer)) {
    const match = item.match(/^(\d{6}) ([a-f0-9]{40,64}) (\d+)\t([\s\S]+)$/);
    if (!match) continue;
    entries.set(normalizePath(match[4]), { mode: match[1], objectId: match[2], stage: Number(match[3]) });
  }
  return entries;
}

function parseTreeEntries(buffer) {
  const entries = new Map();
  for (const item of nullSeparated(buffer)) {
    const match = item.match(/^(\d{6}) ([a-z]+) ([a-f0-9]{40,64})\t([\s\S]+)$/);
    if (!match) continue;
    entries.set(normalizePath(match[4]), { mode: match[1], objectType: match[2], objectId: match[3] });
  }
  return entries;
}

export function calculateWorkspaceStateDigest(workspaceState = {}, { baseSha, headSha } = {}) {
  return sha256(canonicalJson({
    version: workspaceState.workspaceDigestVersion,
    baseSha,
    headSha,
    changedPaths: (workspaceState.changedPaths || []).map(normalizePath).sort(),
    committedPatchDigest: workspaceState.committedPatchDigest,
    stagedPatchDigest: workspaceState.stagedPatchDigest,
    unstagedPatchDigest: workspaceState.unstagedPatchDigest,
    trackedEntries: workspaceState.trackedEntries || [],
    untrackedEntries: workspaceState.untrackedEntries || [],
  }));
}

function worktreeEntry(repoRoot, relativePath) {
  const absolute = path.join(repoRoot, ...relativePath.split('/'));
  let stat;
  try {
    stat = fs.lstatSync(absolute);
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false };
    throw error;
  }
  const mode = (stat.mode & 0o177777).toString(8).padStart(6, '0');
  if (stat.isSymbolicLink()) {
    const symlinkTarget = fs.readlinkSync(absolute);
    return { exists: true, type: 'symlink', mode, symlinkTarget, contentDigest: digestBytes(symlinkTarget) };
  }
  if (stat.isFile()) {
    return { exists: true, type: 'file', mode, contentDigest: digestBytes(fs.readFileSync(absolute)), size: stat.size };
  }
  return { exists: true, type: 'other', mode, contentDigest: null };
}

export function collectWorkspaceState({ repoRoot = process.cwd(), baseSha, headSha = 'HEAD', accounting } = {}) {
  const root = path.resolve(repoRoot);
  if (!baseSha) throw new Error('workspace_base_sha_required');
  const committedPatch = gitBuffer(root, ['diff', '--binary', '--full-index', '--no-ext-diff', baseSha, headSha, '--'], accounting);
  const stagedPatch = gitBuffer(root, ['diff', '--cached', '--binary', '--full-index', '--no-ext-diff', '--'], accounting);
  const unstagedPatch = gitBuffer(root, ['diff', '--binary', '--full-index', '--no-ext-diff', '--'], accounting);
  const committedPaths = nullSeparated(gitBuffer(root, ['diff', '--name-only', '-z', baseSha, headSha, '--'], accounting));
  const stagedPaths = nullSeparated(gitBuffer(root, ['diff', '--cached', '--name-only', '-z', '--'], accounting));
  const unstagedPaths = nullSeparated(gitBuffer(root, ['diff', '--name-only', '-z', '--'], accounting));
  const untrackedPaths = nullSeparated(gitBuffer(root, ['ls-files', '--others', '--exclude-standard', '-z'], accounting));
  const changedPaths = [...new Set([...committedPaths, ...stagedPaths, ...unstagedPaths, ...untrackedPaths].map(normalizePath))].sort();
  const indexEntries = parseIndexEntries(gitBuffer(root, ['ls-files', '--stage', '-z'], accounting));
  const headEntries = parseTreeEntries(gitBuffer(root, ['ls-tree', '-r', '-z', '--full-tree', headSha], accounting));
  const trackedPathSet = new Set([...committedPaths, ...stagedPaths, ...unstagedPaths].map(normalizePath));
  const trackedEntries = [...trackedPathSet].sort().map((relativePath) => ({
    path: relativePath,
    head: headEntries.get(relativePath) || null,
    index: indexEntries.get(relativePath) || null,
    worktree: worktreeEntry(root, relativePath),
  }));
  const untrackedEntries = untrackedPaths.map(normalizePath).sort().map((relativePath) => ({
    path: relativePath,
    worktree: worktreeEntry(root, relativePath),
  }));
  const state = {
    workspaceDigestVersion: V132_WORKSPACE_DIGEST_VERSION,
    contentAddressed: true,
    ignoredExclusionPolicy: 'git_exclude_standard_only',
    changedPaths,
    untrackedPaths: untrackedEntries.map((entry) => entry.path),
    committedPatchDigest: digestBytes(committedPatch),
    stagedPatchDigest: digestBytes(stagedPatch),
    unstagedPatchDigest: digestBytes(unstagedPatch),
    trackedEntries,
    untrackedEntries,
  };
  state.workspaceStateDigest = calculateWorkspaceStateDigest(state, { baseSha, headSha });
  return state;
}

export function classifyChangedFiles(changedFiles = []) {
  const normalized = changedFiles.map(normalizePath).filter(Boolean);
  if (!normalized.length) return { changeClass: 'no_op', unknownPaths: [], normalizedChangedFiles: [] };
  const unknownPaths = normalized.filter((file) => !DOC_PATTERN.test(file) && !SOURCE_PATTERN.test(file));
  if (unknownPaths.length) return { changeClass: 'unknown', unknownPaths, normalizedChangedFiles: normalized };
  if (normalized.every((file) => DOC_PATTERN.test(file) && !SOURCE_PATTERN.test(file))) {
    return { changeClass: 'docs_only', unknownPaths: [], normalizedChangedFiles: normalized };
  }
  if (normalized.some((file) => file.startsWith('.github/workflows/'))) {
    return { changeClass: 'workflow', unknownPaths: [], normalizedChangedFiles: normalized };
  }
  return { changeClass: 'source_core', unknownPaths: [], normalizedChangedFiles: normalized };
}

export function buildValidationDigests({
  repository,
  baseSha,
  headSha,
  changedFiles = [],
  policy = {},
  registry = [],
  workflowInputs = {},
  evidenceReceipt = null,
  workspaceState = null,
  environment = process.env,
} = {}) {
  const safeEnvironment = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    harnessMode: environment.CODEX_HARNESS_MODE || 'core',
    profileCompatMode: environment.CODEX_PROFILE_COMPAT_MODE || 'optional',
  };
  const graphDigest = sha256(canonicalJson(V132_VALIDATION_GRAPH));
  const policyDigest = sha256(canonicalJson(policy));
  const registryDigest = sha256(canonicalJson(registry));
  const calculatedWorkspaceStateDigest = calculateWorkspaceStateDigest(workspaceState || {}, { baseSha, headSha });
  const workspaceStateVerified = workspaceState?.contentAddressed === true
    && workspaceState.workspaceDigestVersion === V132_WORKSPACE_DIGEST_VERSION
    && workspaceState.workspaceStateDigest === calculatedWorkspaceStateDigest;
  const workspaceStateDigest = workspaceStateVerified
    ? workspaceState.workspaceStateDigest
    : sha256(canonicalJson({ version: 'paths_only_non_resumable', changedFiles: changedFiles.map(normalizePath).sort() }));
  const toolchainDigest = sha256(canonicalJson({ node: process.version, platform: process.platform, arch: process.arch }));
  const environmentDigest = sha256(canonicalJson(safeEnvironment));
  return {
    repositoryDigest: sha256(String(repository || '')),
    gitIdentityDigest: sha256(canonicalJson({ repository, baseSha, headSha })),
    policyDigest,
    manifestDigest: policyDigest,
    registryDigest,
    observationDigest: sha256(canonicalJson(evidenceReceipt?.registryObservation || 'not_observed')),
    workspaceStateDigest,
    workspaceDigestVersion: workspaceState?.workspaceDigestVersion || 'paths_only_non_resumable',
    contentAddressedWorkspace: workspaceStateVerified,
    classificationPolicyDigest: sha256(`${V132_VERSION}:classification`),
    graphDigest,
    selectedCheckDigest: sha256(`${V132_VERSION}:selected_checks`),
    toolchainDigest,
    environmentDigest,
    compatibilityInputDigest: sha256(`${V132_VERSION}:v131_v130_v129_v128_v127`),
    evidenceDigest: sha256(canonicalJson(evidenceReceipt || 'not_observed')),
    headSha,
    canonicalStateDigest: sha256('pending'),
    outputPolicyDigest: sha256(canonicalJson(policy.outputLimits || {})),
    workflowDigest: sha256(canonicalJson(workflowInputs)),
    changeClassDigest: sha256(canonicalJson({ workspaceStateDigest, classificationPolicy: `${V132_VERSION}:classification` })),
    executorVersionDigest: sha256(V132_NODE_EXECUTOR_VERSION),
  };
}

function nodeInputDigest(node, digests) {
  const values = Object.fromEntries(node.inputDigests.map((key) => [key, digests[key] || null]));
  return sha256(canonicalJson(values));
}

export function validateResumeReceipt(receipt, current = {}, now = Date.now()) {
  const reasons = [];
  if (!receipt || receipt.receiptVersion !== 'v132') reasons.push('resume_receipt_version_invalid');
  for (const field of ['repository', 'baseSha', 'headSha', 'workspaceStateDigest', 'workspaceDigestVersion', 'policyDigest', 'registryDigest', 'toolchainDigest', 'graphDigest', 'environmentDigest']) {
    if (receipt?.[field] !== current[field]) reasons.push(`resume_${field}_mismatch`);
  }
  if (receipt?.contentAddressedWorkspace !== true || current.contentAddressedWorkspace !== true) reasons.push('resume_workspace_not_content_addressed');
  if (!Number.isFinite(Date.parse(receipt?.expiresAt || '')) || Date.parse(receipt.expiresAt) <= now) reasons.push('resume_receipt_expired');
  if (!Array.isArray(receipt?.completedNodes) || !Array.isArray(receipt?.nextNodes)) reasons.push('resume_node_lists_invalid');
  if (receipt?.createsAuthority !== false) reasons.push('resume_receipt_authority_invalid');
  return {
    status: reasons.length ? 'invalid' : 'valid',
    reasonCodes: reasons,
    resumeAllowed: reasons.length === 0,
    createsAuthority: false,
  };
}

export function planIncrementalValidation({
  repository = 'hiro4649/codex-development-harness',
  profile = 'source_control_plane',
  baseSha = 'unknown',
  headSha = 'unknown',
  changedFiles = [],
  policy = {},
  registry = [],
  workflowInputs = {},
  evidenceReceipt = null,
  workspaceState = null,
  previousReceipt = null,
  now = Date.now(),
} = {}) {
  const workspaceStateVerified = workspaceState?.contentAddressed === true
    && workspaceState.workspaceDigestVersion === V132_WORKSPACE_DIGEST_VERSION
    && workspaceState.workspaceStateDigest === calculateWorkspaceStateDigest(workspaceState, { baseSha, headSha });
  const effectiveChangedFiles = workspaceStateVerified ? workspaceState.changedPaths : changedFiles;
  const classification = classifyChangedFiles(effectiveChangedFiles);
  const digests = buildValidationDigests({ repository, baseSha, headSha, changedFiles: effectiveChangedFiles, policy, registry, workflowInputs, evidenceReceipt, workspaceState });
  const currentReceiptIdentity = { repository, baseSha, headSha, ...digests };
  const receiptValidation = previousReceipt
    ? validateResumeReceipt(previousReceipt, currentReceiptIdentity, now)
    : { status: 'not_observed', resumeAllowed: false, reasonCodes: [], createsAuthority: false };

  // Every profile preserves the same invariant closure. Cheap exact-head reuse,
  // rather than omission, makes no-op and docs-only paths fast.
  const requiredNodeIds = V132_VALIDATION_GRAPH.map((node) => node.nodeId);

  const completed = new Map((previousReceipt?.completedNodes || []).map((node) => [node.nodeId, node]));
  const selectedNodes = [];
  const reusedNodes = [];
  for (const node of V132_VALIDATION_GRAPH.filter((item) => requiredNodeIds.includes(item.nodeId))) {
    const inputDigest = nodeInputDigest(node, digests);
    const prior = completed.get(node.nodeId);
    const priorOutputDigest = prior?.output ? sha256(canonicalJson(prior.output)) : null;
    const priorValid = prior?.inputDigest === inputDigest
      && prior?.executorVersion === V132_NODE_EXECUTOR_VERSION
      && ['pass', 'not_observed', 'not_applicable'].includes(prior?.status)
      && prior?.outputDigest === priorOutputDigest
      && Number.isFinite(Date.parse(prior?.completedAt || ''));
    if (receiptValidation.resumeAllowed && node.alwaysRun !== true && priorValid) {
      reusedNodes.push({ nodeId: node.nodeId, status: 'reused_verified', inputDigest, outputDigest: prior.outputDigest, executorVersion: prior.executorVersion, authority: false });
    } else {
      selectedNodes.push({ ...node, inputDigest });
    }
  }

  const totalConsidered = selectedNodes.length + reusedNodes.length;
  return {
    status: classification.changeClass === 'unknown' ? 'full_gate_required' : 'planned',
    schedulerType: 'deterministic_validation_graph',
    agentTeamRuntime: false,
    profile,
    classification,
    digests,
    selectedNodes,
    reusedNodes,
    selectedNodeCount: selectedNodes.length,
    skippedNodeCount: reusedNodes.length,
    exactHeadNodeSkipRate: totalConsidered ? reusedNodes.length / totalConsidered : 0,
    receiptValidation,
    unknownPathFallback: classification.changeClass === 'unknown' ? 'full_local_gate' : 'not_required',
    createsAuthority: false,
  };
}

export function createValidationReceipt({
  plan,
  repository,
  baseSha,
  headSha,
  completedNodeResults = [],
  createdAt = new Date().toISOString(),
  ttlMinutes = 120,
} = {}) {
  for (const item of completedNodeResults) {
    const calculatedDigest = item?.output ? sha256(canonicalJson(item.output)) : null;
    if (!item?.nodeId || !item?.inputDigest || !item?.outputDigest || item.outputDigest !== calculatedDigest
      || item.executorVersion !== V132_NODE_EXECUTOR_VERSION || !['pass', 'not_observed', 'not_applicable'].includes(item.status)
      || !Number.isFinite(Date.parse(item.completedAt || ''))) {
      throw new Error(`validation_receipt_unattested_node:${item?.nodeId || 'unknown'}`);
    }
  }
  const createdMs = Date.parse(createdAt);
  const completedIds = new Set(completedNodeResults.map((item) => item.nodeId));
  const nextNodes = (plan?.selectedNodes || []).filter((node) => !completedIds.has(node.nodeId)).map((node) => node.nodeId);
  return {
    receiptVersion: 'v132',
    repository,
    baseSha,
    headSha,
    workspaceStateDigest: plan?.digests?.workspaceStateDigest,
    workspaceDigestVersion: plan?.digests?.workspaceDigestVersion,
    contentAddressedWorkspace: plan?.digests?.contentAddressedWorkspace === true,
    policyDigest: plan?.digests?.policyDigest,
    registryDigest: plan?.digests?.registryDigest,
    toolchainDigest: plan?.digests?.toolchainDigest,
    graphDigest: plan?.digests?.graphDigest,
    environmentDigest: plan?.digests?.environmentDigest,
    executorVersion: V132_NODE_EXECUTOR_VERSION,
    completedNodes: completedNodeResults.map((item) => ({
      nodeId: item.nodeId,
      status: item.status,
      inputDigest: item.inputDigest,
      outputDigest: item.outputDigest,
      executorVersion: item.executorVersion,
      completedAt: item.completedAt,
      output: item.output,
    })),
    nextNodes,
    createdAt,
    expiresAt: new Date(createdMs + ttlMinutes * 60 * 1000).toISOString(),
    createsAuthority: false,
  };
}

function truncateUtf8(value, maxBytes) {
  const text = String(value || '');
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text;
  let end = text.length;
  while (end > 0 && Buffer.byteLength(`${text.slice(0, end)}...`, 'utf8') > maxBytes) end -= 1;
  return `${text.slice(0, end)}...`;
}

export function buildContextCacheEnvelope({
  immutableCore = '',
  compiledRepoPolicy = '',
  taskDelta = '',
  evidenceCapsule = '',
} = {}) {
  const limits = {
    immutableCore: 1536,
    compiledRepoPolicy: 1536,
    taskDelta: 2048,
    evidenceCapsule: 2048,
  };
  const payloads = {
    immutableCore: truncateUtf8(immutableCore, limits.immutableCore),
    compiledRepoPolicy: truncateUtf8(compiledRepoPolicy, limits.compiledRepoPolicy),
    taskDelta: truncateUtf8(taskDelta, limits.taskDelta),
    evidenceCapsule: truncateUtf8(evidenceCapsule, limits.evidenceCapsule),
  };
  const sections = Object.entries(payloads).map(([name, payload]) => ({
    name,
    digest: sha256(payload),
    bytes: Buffer.byteLength(payload, 'utf8'),
    maxBytes: limits[name],
    payload,
  }));
  return {
    schemaVersion: V132_VERSION,
    state: 'compiled_advisory_contract',
    order: ['immutableCore', 'compiledRepoPolicy', 'taskDelta', 'evidenceCapsule'],
    sections,
    totalBytes: sections.reduce((sum, section) => sum + section.bytes, 0),
    stablePrefixDigest: sha256(canonicalJson(sections.slice(0, 2).map(({ name, digest, bytes }) => ({ name, digest, bytes })))),
    fullManifestLoaded: false,
    fullConversationReplay: false,
    skillsMcpToolsLazyLoad: true,
    modelToolChangesWithinTask: false,
    providerNeutral: true,
    runtimeEnforced: false,
    createsAuthority: false,
  };
}

export function buildToolchainSummary() {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    authority: false,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const plan = planIncrementalValidation();
  console.log(JSON.stringify(plan, null, 2));
}
