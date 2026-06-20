#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import process from 'node:process';

const VALIDATION_NODES_MAX = 12;
const FINALIZER_MODES = new Set(['aggregate_only']);
const EXECUTION_STATES = new Set(['executed', 'reused', 'rerun']);
const NODE_STATUSES = new Set(['pass', 'fail', 'skipped']);
const REUSE_DECISIONS = new Set(['hit', 'partial_hit', 'miss']);
const STABILITY_CLASSES = new Set(['decision_stable', 'cache_stable', 'environment_diagnostic', 'owner_input', 'forbidden']);
const CANONICALITY_STATES = new Set(['canonical', 'duplicate_candidate', 'repo_mismatch', 'harness_version_mismatch', 'unknown']);
const PLACEHOLDER_VALUES = new Set(['', 'unknown', 'required', 'null', 'undefined', 'placeholder']);

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function digestValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function stableDigest(label, input = {}) {
  return digestValue({ label, ...input });
}

function truncateStrings(values = [], limit = 16) {
  return Array.isArray(values) ? values.slice(0, limit).map(String) : [];
}

function safeText(value, fallback) {
  const text = String(value || '').trim();
  return text ? text : fallback;
}

function isPlaceholder(value) {
  return PLACEHOLDER_VALUES.has(String(value ?? '').trim().toLowerCase());
}

function defaultNodeResults(input = {}) {
  return Array.isArray(input.nodeResults) && input.nodeResults.length
    ? input.nodeResults
    : [
      { nodeRef: 'projection_reader', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
      { nodeRef: 'managed_context_emitter', executionState: 'executed', status: 'pass', stabilityClass: 'cache_stable' },
      { nodeRef: 'state_matrix_executor', executionState: 'executed', status: 'pass', stabilityClass: 'decision_stable' },
    ];
}

function normalizeNode(node = {}) {
  const nodeRef = safeText(node.nodeRef, 'unknown_node');
  const executionState = EXECUTION_STATES.has(node.executionState) ? node.executionState : 'executed';
  const status = NODE_STATUSES.has(node.status) ? node.status : 'fail';
  const stabilityClass = STABILITY_CLASSES.has(node.stabilityClass) ? node.stabilityClass : 'decision_stable';
  return {
    nodeRef,
    executionState,
    status,
    stabilityClass,
    typedResultRef: node.typedResultRef || `${nodeRef}:typed_result`,
  };
}

function classifyReuseDecision(nodes = [], input = {}) {
  if (input.reuseDecision && REUSE_DECISIONS.has(input.reuseDecision)) return input.reuseDecision;
  const reused = nodes.filter((node) => node.executionState === 'reused').length;
  const executed = nodes.filter((node) => node.executionState === 'executed').length;
  if (reused > 0 && executed === 0) return 'hit';
  if (reused > 0) return 'partial_hit';
  return 'miss';
}

function buildCacheKeyFields(input = {}, planDigest) {
  return {
    headSha: safeText(input.headSha || process.env.CODEX_PR_HEAD_SHA || process.env.GITHUB_SHA, 'not_available'),
    planDigest,
    scriptDigest: input.scriptDigest || stableDigest('v128_validation_execution_plan_script'),
    lockfileDigest: input.lockfileDigest || 'not_applicable',
    runnerImageDigest: input.runnerImageDigest || stableDigest('runner_image', {
      provider: process.env.GITHUB_ACTIONS === 'true' ? 'github_actions' : 'local',
      os: process.platform,
    }),
    runtimeVersion: input.runtimeVersion || process.version,
    taskProfile: input.taskProfile || 'source_shadow_candidate',
    environmentClass: input.environmentClass || (process.env.GITHUB_ACTIONS === 'true' ? 'github_actions' : 'local'),
  };
}

export function buildV128ValidationExecutionPlan(input = {}) {
  const nodes = defaultNodeResults(input).map(normalizeNode).slice(0, VALIDATION_NODES_MAX);
  const nodeRefs = nodes.map((node) => node.nodeRef);
  const duplicatedNodeRefs = [...new Set(nodeRefs.filter((nodeRef, index) => nodeRefs.indexOf(nodeRef) !== index))];
  const executedNodeRefs = nodes.filter((node) => node.executionState === 'executed').map((node) => node.nodeRef);
  const reusedNodeRefs = nodes.filter((node) => node.executionState === 'reused').map((node) => node.nodeRef);
  const rerunNodeRefs = nodes.filter((node) => node.executionState === 'rerun').map((node) => node.nodeRef);
  const failedNode = nodes.find((node) => node.status === 'fail') || null;
  const planCore = {
    profileId: input.profileId || 'source_shadow_validation',
    nodeRefs,
    nodeCount: nodes.length,
    finalizerMode: input.finalizerMode || 'aggregate_only',
    downstreamRespawnAllowed: input.downstreamRespawnAllowed === true,
  };
  const planDigest = digestValue(planCore);
  const cacheKeyFields = buildCacheKeyFields(input, planDigest);
  const cacheKeyValues = Object.values(cacheKeyFields).map((value) => String(value ?? ''));
  const cacheKeyHasPlaceholder = cacheKeyValues.some(isPlaceholder);
  const reuseDecision = cacheKeyHasPlaceholder ? 'miss' : classifyReuseDecision(nodes, input);
  const cacheKeyDigest = cacheKeyHasPlaceholder ? null : digestValue(cacheKeyFields);
  const workspaceIdentityCore = {
    repositoryKey: input.repositoryKey || 'github.com:hiro4649/codex-development-harness',
    remoteDigest: input.remoteDigest || stableDigest('remote', { repositoryKey: input.repositoryKey || 'github.com:hiro4649/codex-development-harness' }),
    branch: input.branch || process.env.CODEX_BRANCH || process.env.GITHUB_REF_NAME || 'unknown',
    headSha: cacheKeyFields.headSha,
    activeHarnessVersion: input.activeHarnessVersion || '1.2.7',
  };
  const status = duplicatedNodeRefs.length === 0
    && nodes.length > 0
    && nodes.length <= VALIDATION_NODES_MAX
    && failedNode === null
    && FINALIZER_MODES.has(planCore.finalizerMode)
    && planCore.downstreamRespawnAllowed === false
    && cacheKeyHasPlaceholder === false
    ? 'pass'
    : 'fail';
  return {
    schemaVersion: '1.2.8',
    executionKind: 'validation_execution_plan_shadow',
    authority: 'non_authoritative_execution_surface',
    candidateActivationState: input.candidateActivationState || 'source_shadow_candidate',
    profileExecution: {
      profileId: planCore.profileId,
      planDigest,
      headSha: cacheKeyFields.headSha,
      nodeCount: nodes.length,
      nodeResults: nodes,
      executedNodeRefs,
      reusedNodeRefs,
      rerunNodeRefs,
      failedNodeRef: failedNode?.nodeRef || null,
      duplicatedNodeRefs,
      finalizerMode: planCore.finalizerMode,
      downstreamRespawnAllowed: planCore.downstreamRespawnAllowed,
      status,
    },
    validationReuseDecision: {
      reuseDecision,
      reusedNodeRefs,
      executedNodeRefs,
      rerunNodeRefs,
      missReasonRef: cacheKeyHasPlaceholder ? 'CACHE_KEY_PLACEHOLDER' : (reuseDecision === 'miss' ? 'NO_REUSABLE_NODE' : null),
      cacheKeyDigest,
      cacheKeyFields,
      cacheKeyHasPlaceholder,
      skippedNodeRefs: reuseDecision === 'hit' || reuseDecision === 'partial_hit' ? reusedNodeRefs : [],
    },
    stableDiagnosticTaxonomy: {
      decisionStableClasses: ['decision_stable'],
      cacheStableClasses: ['cache_stable'],
      diagnosticClasses: ['environment_diagnostic'],
      ownerInputClasses: ['owner_input'],
      forbiddenClasses: ['forbidden'],
      environmentDiagnosticExcludedFromDecisionDigest: input.environmentDiagnosticExcludedFromDecisionDigest !== false,
      rawLogForbidden: true,
      secretForbidden: true,
      localAbsolutePathForbidden: true,
      fields: [
        { field: 'normalizedArtifactFingerprint', stabilityClass: 'decision_stable' },
        { field: 'validationCacheKeyDigest', stabilityClass: 'cache_stable' },
        { field: 'runnerImageDigest', stabilityClass: 'environment_diagnostic' },
      ],
    },
    workspaceIdentity: {
      ...workspaceIdentityCore,
      worktreeIdentityDigest: input.worktreeIdentityDigest || digestValue(workspaceIdentityCore),
      canonicalityState: input.canonicalityState || 'canonical',
      rawWorkspacePathUploaded: input.rawWorkspacePathUploaded === true,
    },
    phaseProgress: {
      phase: input.phase || 'validation',
      currentNodeRef: input.currentNodeRef || nodes[nodes.length - 1]?.nodeRef || null,
      completedNodeCount: nodes.filter((node) => node.status === 'pass').length,
      totalNodeCount: nodes.length,
      lastProgressDigest: digestValue({ nodeRefs, status }),
      stallClass: input.stallClass || 'none',
    },
    ownerAuthorityCreated: false,
    newP0ArtifactCreated: false,
    safeSummaryOnly: true,
  };
}

export function validateV128ValidationExecutionPlan(plan = {}) {
  const reasons = [];
  const execution = plan.profileExecution || {};
  const reuse = plan.validationReuseDecision || {};
  const taxonomy = plan.stableDiagnosticTaxonomy || {};
  const workspace = plan.workspaceIdentity || {};
  const nodeResults = Array.isArray(execution.nodeResults) ? execution.nodeResults : [];
  const nodeRefs = nodeResults.map((node) => node.nodeRef);
  const duplicateRefs = nodeRefs.filter((nodeRef, index) => nodeRefs.indexOf(nodeRef) !== index);
  if (plan.schemaVersion !== '1.2.8') reasons.push('validation_execution_schema_invalid');
  if (plan.executionKind !== 'validation_execution_plan_shadow') reasons.push('validation_execution_kind_invalid');
  if (plan.authority !== 'non_authoritative_execution_surface') reasons.push('validation_execution_authority_invalid');
  if (plan.candidateActivationState !== 'source_shadow_candidate') reasons.push('validation_execution_activation_state_invalid');
  if (!execution.profileId) reasons.push('profile_execution_profile_id_required');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(execution.planDigest || ''))) reasons.push('profile_execution_plan_digest_invalid');
  if (nodeResults.length < 1 || nodeResults.length > VALIDATION_NODES_MAX) reasons.push('profile_execution_node_count_invalid');
  if (duplicateRefs.length > 0 || (execution.duplicatedNodeRefs || []).length > 0) reasons.push('profile_execution_duplicate_node_ref');
  if (!FINALIZER_MODES.has(execution.finalizerMode)) reasons.push('profile_execution_finalizer_must_be_aggregate_only');
  if (execution.downstreamRespawnAllowed === true) reasons.push('profile_execution_downstream_respawn_forbidden');
  if (execution.failedNodeRef) reasons.push('profile_execution_failed_node_present');
  for (const node of nodeResults) {
    if (!node.nodeRef) reasons.push('profile_execution_node_ref_required');
    if (!EXECUTION_STATES.has(node.executionState)) reasons.push(`profile_execution_state_invalid_${node.executionState || 'missing'}`);
    if (!NODE_STATUSES.has(node.status)) reasons.push(`profile_execution_node_status_invalid_${node.status || 'missing'}`);
    if (!STABILITY_CLASSES.has(node.stabilityClass)) reasons.push(`stability_class_invalid_${node.stabilityClass || 'missing'}`);
  }
  if (!REUSE_DECISIONS.has(reuse.reuseDecision)) reasons.push('validation_reuse_decision_invalid');
  if (reuse.cacheKeyHasPlaceholder === true) reasons.push('validation_reuse_cache_key_placeholder');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(reuse.cacheKeyDigest || ''))) reasons.push('validation_reuse_cache_key_digest_invalid');
  for (const value of Object.values(reuse.cacheKeyFields || {})) {
    if (isPlaceholder(value)) reasons.push('validation_reuse_cache_key_placeholder_value');
  }
  if (taxonomy.environmentDiagnosticExcludedFromDecisionDigest !== true) reasons.push('environment_diagnostic_must_be_excluded_from_decision_digest');
  if (taxonomy.rawLogForbidden !== true || taxonomy.secretForbidden !== true || taxonomy.localAbsolutePathForbidden !== true) reasons.push('stable_diagnostic_forbidden_boundary_missing');
  for (const field of taxonomy.fields || []) {
    if (!STABILITY_CLASSES.has(field.stabilityClass)) reasons.push(`taxonomy_field_stability_invalid_${field.stabilityClass || 'missing'}`);
    if (field.stabilityClass === 'forbidden') reasons.push('forbidden_field_cannot_enter_execution_surface');
  }
  if (!workspace.repositoryKey) reasons.push('workspace_repository_key_required');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(workspace.remoteDigest || ''))) reasons.push('workspace_remote_digest_invalid');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(workspace.worktreeIdentityDigest || ''))) reasons.push('workspace_identity_digest_invalid');
  if (!CANONICALITY_STATES.has(workspace.canonicalityState)) reasons.push(`workspace_canonicality_invalid_${workspace.canonicalityState || 'missing'}`);
  if (workspace.rawWorkspacePathUploaded === true) reasons.push('raw_workspace_path_upload_forbidden');
  if (plan.ownerAuthorityCreated === true) reasons.push('validation_execution_cannot_create_owner_authority');
  if (plan.newP0ArtifactCreated === true) reasons.push('validation_execution_cannot_create_new_p0_artifact');
  return reasons.length ? { status: 'fail', reasonCodes: [...new Set(reasons)], safeSummaryOnly: true } : {
    status: 'pass',
    planDigest: execution.planDigest,
    cacheKeyDigest: reuse.cacheKeyDigest,
    safeSummaryOnly: true,
  };
}

function main() {
  const plan = buildV128ValidationExecutionPlan();
  const validation = validateV128ValidationExecutionPlan(plan);
  process.stdout.write(`${canonicalJson({ plan, validation })}\n`);
  process.exit(validation.status === 'pass' ? 0 : 1);
}

if (process.argv[1] && process.argv[1].endsWith('codex-v128-validation-execution-plan.mjs')) {
  main();
}

