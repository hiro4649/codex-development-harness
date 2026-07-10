#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

import { canonicalJson, sha256, V132_VERSION } from './codex-v132-evidence-truth.mjs';
import { V132_NODE_EXECUTOR_VERSION, V132_VALIDATION_GRAPH } from './codex-v132-incremental-validation.mjs';

export { V132_NODE_EXECUTOR_VERSION };
export const V132_NONBLOCKING_NODE_STATES = Object.freeze(['not_observed', 'not_applicable']);

const SCHEMA_REQUIRED_FIELDS = Object.freeze({
  v132_status: ['status'],
  v132_observation_status: ['status', 'observationState'],
  v132_classification_status: ['status', 'changeClass'],
  v132_dependency_status: ['status', 'dependencyCount'],
  v132_local_check_status: ['status'],
  v132_compatibility_status: ['status', 'rollbackChain'],
  v132_canonical_state: ['status', 'localValidationState', 'remoteValidationState', 'mergeAllowed'],
  v132_compact_output: ['status', 'maxBytes', 'maxTopLevelFields'],
  v132_ci_cost_plan: ['status', 'estimatedJobs', 'estimatedWorkflowRuns'],
});

export function validateNodeOutput(schema, output) {
  const reasons = [];
  if (!output || typeof output !== 'object' || Array.isArray(output)) reasons.push('node_output_not_object');
  for (const field of SCHEMA_REQUIRED_FIELDS[schema] || []) {
    if (!Object.hasOwn(output || {}, field)) reasons.push(`node_output_${field}_missing`);
  }
  const allowedStatuses = new Set(['pass', 'fail', ...V132_NONBLOCKING_NODE_STATES]);
  if (!allowedStatuses.has(output?.status)) reasons.push('node_output_status_invalid');
  if (output?.authorityCreated === true) reasons.push('node_output_authority_forbidden');
  return { status: reasons.length ? 'fail' : 'pass', reasonCodes: reasons, authority: false };
}

function dependencyResults(node, completed) {
  return node.dependsOn.map((nodeId) => completed.get(nodeId)).filter(Boolean);
}

function defaultHandlers() {
  return {
    workspace_identity: ({ context }) => ({
      status: context.workspaceIdentity?.status === 'pass' ? 'pass' : 'fail',
      repository: context.repository,
      headSha: context.headSha,
      reasonCodes: context.workspaceIdentity?.reasonCodes || [],
      authorityCreated: false,
    }),
    manifest_compile: ({ context }) => ({
      status: context.manifestProjection?.status === 'pass' ? 'pass' : 'fail',
      projectionDigest: context.manifestProjection?.expectedProjectionDigest || null,
      reasonCodes: context.manifestProjection?.reasonCodes || [],
      authorityCreated: false,
    }),
    registry_observation: ({ context }) => ({
      status: context.registryObservation?.status === 'verified' ? 'pass' : 'not_observed',
      observationState: context.registryObservation?.status || 'not_observed',
      observationDigest: context.registryObservation?.digest || sha256('not_observed'),
      authorityCreated: false,
    }),
    changed_file_classification: ({ plan }) => ({
      status: 'pass',
      changeClass: plan.classification.changeClass,
      changedFileCount: plan.classification.normalizedChangedFiles.length,
      unknownPathCount: plan.classification.unknownPaths.length,
      fallback: plan.unknownPathFallback,
      authorityCreated: false,
    }),
    dependency_closure: ({ node, completed }) => {
      const dependencies = dependencyResults(node, completed);
      const allSatisfied = dependencies.length === node.dependsOn.length
        && dependencies.every((item) => ['pass', ...V132_NONBLOCKING_NODE_STATES].includes(item.status));
      return {
        status: allSatisfied ? 'pass' : 'fail',
        dependencyCount: node.dependsOn.length,
        satisfiedDependencyCount: dependencies.length,
        dependencyNodeIds: node.dependsOn,
        authorityCreated: false,
      };
    },
    selected_local_checks: ({ context }) => ({
      ...(context.runLocalChecks ? context.runLocalChecks() : { status: 'fail', reasonCodes: ['local_check_handler_missing'] }),
      authorityCreated: false,
    }),
    compatibility_checks: ({ context }) => ({
      ...(context.runCompatibilityChecks ? context.runCompatibilityChecks() : { status: 'fail', reasonCodes: ['compatibility_handler_missing'] }),
      rollbackChain: context.rollbackChain,
      authorityCreated: false,
    }),
    evidence_truth_projection: ({ context, completed }) => {
      const state = context.deriveCanonicalState ? context.deriveCanonicalState(completed) : context.canonicalState;
      return {
        status: state.localValidationState === 'passed' ? 'pass' : 'fail',
        localValidationState: state.localValidationState,
        remoteValidationState: state.remoteValidationState,
        technicalMergeEligibility: state.technicalMergeEligibility,
        finalDecisionState: state.finalDecisionState,
        mergeAllowed: state.mergeAllowed,
        authorityCreated: false,
      };
    },
    compact_output_rendering: ({ context }) => ({
      status: 'pass',
      maxBytes: context.outputLimits.compactJsonBytes,
      maxTopLevelFields: context.outputLimits.topLevelFieldCount,
      outputPolicyDigest: sha256(canonicalJson(context.outputLimits)),
      authorityCreated: false,
    }),
    ci_cost_planning: ({ context }) => ({
      ...(context.runCiCostPlanning ? context.runCiCostPlanning() : { status: 'fail', estimatedJobs: -1, estimatedWorkflowRuns: -1 }),
      authorityCreated: false,
    }),
  };
}

export function validateReusableNodeResult(prior, node, inputDigest) {
  const reasons = [];
  if (!prior || prior.nodeId !== node.nodeId) reasons.push('resume_node_identity_invalid');
  if (prior?.inputDigest !== inputDigest) reasons.push('resume_node_input_digest_mismatch');
  if (prior?.executorVersion !== V132_NODE_EXECUTOR_VERSION) reasons.push('resume_node_executor_version_mismatch');
  if (!['pass', ...V132_NONBLOCKING_NODE_STATES].includes(prior?.status)) reasons.push('resume_node_status_invalid');
  if (!prior?.output || typeof prior.output !== 'object') reasons.push('resume_node_output_missing');
  const calculatedOutputDigest = prior?.output ? sha256(canonicalJson(prior.output)) : null;
  if (prior?.outputDigest !== calculatedOutputDigest) reasons.push('resume_node_output_digest_invalid');
  if (!Number.isFinite(Date.parse(prior?.completedAt || ''))) reasons.push('resume_node_completed_at_invalid');
  const schema = validateNodeOutput(node.outputSchema, prior?.output);
  if (schema.status !== 'pass') reasons.push(...schema.reasonCodes.map((reason) => `resume_${reason}`));
  return { status: reasons.length ? 'invalid' : 'valid', reasonCodes: reasons, reusable: reasons.length === 0, authority: false };
}

export function executeValidationPlan({ plan, context = {}, priorCompletedNodes = [], now = () => new Date().toISOString(), handlers = {} } = {}) {
  const resolvedHandlers = { ...defaultHandlers(), ...handlers };
  const completed = new Map();
  const executedNodeResults = [];
  const reusedNodeResults = [];
  const failures = [];

  for (const item of plan?.reusedNodes || []) {
    const prior = priorCompletedNodes.find((entry) => entry.nodeId === item.nodeId);
    const node = V132_VALIDATION_GRAPH.find((entry) => entry.nodeId === item.nodeId);
    const validation = validateReusableNodeResult(prior, node, item.inputDigest);
    if (!validation.reusable) {
      failures.push(`reuse_${item.nodeId}_invalid:${validation.reasonCodes.join('+')}`);
      continue;
    }
    completed.set(item.nodeId, prior);
    reusedNodeResults.push({ ...prior, reuseStatus: 'reused_verified', authority: false });
  }

  for (const selected of plan?.selectedNodes || []) {
    const node = V132_VALIDATION_GRAPH.find((entry) => entry.nodeId === selected.nodeId);
    const missingDependency = node.dependsOn.find((nodeId) => !completed.has(nodeId));
    if (missingDependency) {
      failures.push(`${node.nodeId}_dependency_missing:${missingDependency}`);
      continue;
    }
    const handler = resolvedHandlers[node.nodeId];
    if (typeof handler !== 'function') {
      failures.push(`${node.nodeId}_handler_missing`);
      continue;
    }
    let output;
    try {
      output = handler({ node, plan, context, completed });
    } catch (error) {
      output = { status: 'fail', reasonCodes: [`handler_exception:${String(error.message || error).slice(0, 128)}`], authorityCreated: false };
    }
    const schemaValidation = validateNodeOutput(node.outputSchema, output);
    const completedAt = now();
    const result = {
      nodeId: node.nodeId,
      inputDigest: selected.inputDigest,
      outputDigest: sha256(canonicalJson(output)),
      executorVersion: V132_NODE_EXECUTOR_VERSION,
      status: schemaValidation.status === 'pass' ? output.status : 'fail',
      completedAt,
      output,
      outputSchema: node.outputSchema,
      schemaValidation,
      authority: false,
    };
    executedNodeResults.push(result);
    completed.set(node.nodeId, result);
    if (result.status === 'fail') failures.push(`${node.nodeId}_failed:${[...(output.reasonCodes || []), ...schemaValidation.reasonCodes].join('+')}`);
  }

  return {
    schemaVersion: V132_VERSION,
    status: failures.length ? 'fail' : 'pass',
    executorVersion: V132_NODE_EXECUTOR_VERSION,
    executedNodeResults,
    reusedNodeResults,
    completedNodeResults: [...completed.values()],
    executedNodeCount: executedNodeResults.length,
    reusedNodeCount: reusedNodeResults.length,
    failureCodes: failures,
    authorityCreated: false,
  };
}
