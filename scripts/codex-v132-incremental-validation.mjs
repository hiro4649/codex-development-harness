#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import os from 'node:os';
import { canonicalJson, sha256, V132_VERSION } from './codex-v132-evidence-truth.mjs';

export const V132_NODE_EXECUTOR_VERSION = 'v132-node-executor-1';

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
    inputDigests: ['diffDigest', 'classificationPolicyDigest'],
    invalidationKeys: ['git_diff', 'classification_policy'],
    costClass: 'fast',
    requiredProfiles: ['source_control_plane'],
    outputSchema: 'v132_classification_status',
  },
  {
    nodeId: 'dependency_closure',
    dependsOn: ['changed_file_classification', 'manifest_compile'],
    inputDigests: ['graphDigest', 'diffDigest', 'policyDigest'],
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
  const diffDigest = sha256(canonicalJson(changedFiles.map(normalizePath).sort()));
  const toolchainDigest = sha256(canonicalJson({ node: process.version, platform: process.platform, arch: process.arch }));
  const environmentDigest = sha256(canonicalJson(safeEnvironment));
  return {
    repositoryDigest: sha256(String(repository || '')),
    gitIdentityDigest: sha256(canonicalJson({ repository, baseSha, headSha })),
    policyDigest,
    manifestDigest: policyDigest,
    registryDigest,
    observationDigest: sha256(canonicalJson(evidenceReceipt?.registryObservation || 'not_observed')),
    diffDigest,
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
    changeClassDigest: diffDigest,
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
  for (const field of ['repository', 'baseSha', 'headSha', 'diffDigest', 'policyDigest', 'registryDigest', 'toolchainDigest', 'graphDigest', 'environmentDigest']) {
    if (receipt?.[field] !== current[field]) reasons.push(`resume_${field}_mismatch`);
  }
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
  previousReceipt = null,
  now = Date.now(),
} = {}) {
  const classification = classifyChangedFiles(changedFiles);
  const digests = buildValidationDigests({ repository, baseSha, headSha, changedFiles, policy, registry, workflowInputs, evidenceReceipt });
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
    diffDigest: plan?.digests?.diffDigest,
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
