#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.0

import crypto from 'node:crypto';
import { canonicalJson } from './codex-v129-goal-contract.mjs';

export function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

export function compileAgentRole(policy, roleId) {
  const role = policy.agentRoles.find((item) => item.roleId === roleId);
  if (!role) return { status: 'fail', reasonCodes: ['v130_unknown_role'] };
  const profile = policy.roleProfiles?.[role.profileRef];
  if (!profile) return { status: 'fail', reasonCodes: ['v130_unknown_role_profile'] };
  const compiledRole = {
    roleId: role.roleId,
    capabilityClass: role.capabilityClass,
    allowedTaskClasses: role.allowedTaskClasses,
    sandboxMode: profile.sandboxMode,
    networkMode: profile.networkMode,
    allowedTools: [...new Set([...profile.allowedTools, ...(role.allowedToolsDelta || [])])],
    forbiddenTools: [...new Set([...profile.forbiddenTools, ...(role.forbiddenToolsDelta || [])])],
    writeScope: role.writeScope || profile.writeScope,
    selectedSkillPolicy: profile.selectedSkillPolicy,
    maxInputBytes: role.maxInputBytes || profile.maxInputBytes,
    maxOutputBytes: role.maxOutputBytes || profile.maxOutputBytes,
    maxToolCalls: role.maxToolCalls || profile.maxToolCalls,
    timeoutMs: role.timeoutMs || profile.timeoutMs,
    canSpawn: profile.canSpawn,
    outputSchemaRef: role.outputSchemaRef,
    authorityCreated: false,
  };
  const missing = policy.compiledAgentRoleContract.requiredFields.filter((key) => !Object.hasOwn(compiledRole, key));
  return missing.length ? { status: 'fail', reasonCodes: ['agent_role_incomplete'], missing } : { status: 'pass', compiledRole, compiledRoleDigest: sha256(canonicalJson(compiledRole)) };
}

export function buildConstrainedDag(policy, input = {}) {
  const reasonCodes = [];
  const taskClass = input.taskClass || 'code_change';
  const evidenceContradictionCount = Number(input.evidenceContradictionCount || 0);
  const rootCauseAmbiguity = input.rootCauseAmbiguity === true;
  const orchestrated = policy.orchestrationValueGate.constrainedOrchestratedTaskClasses.includes(taskClass)
    || evidenceContradictionCount > policy.orchestrationValueGate.evidenceContradictionCountAdmitsAbove
    || rootCauseAmbiguity;
  const lane = orchestrated ? 'constrained_orchestrated' : 'direct_verified';
  const nodes = lane === 'direct_verified'
    ? [
        { nodeId: 'writer', roleId: 'code_worker', inputHandles: ['goal'], outputSchemaRef: 'change_receipt', timeoutMs: 120000 },
        { nodeId: 'verifier', roleId: 'independent_verifier', inputHandles: ['writer'], outputSchemaRef: 'verification_receipt', timeoutMs: 120000 },
      ]
    : [
        { nodeId: 'diagnosis', roleId: taskClass.startsWith('security') ? 'threat_modeler' : 'architecture_reviewer', inputHandles: ['goal'], outputSchemaRef: 'finding_receipt', timeoutMs: 120000 },
        { nodeId: 'writer', roleId: taskClass === 'security_remediation' ? 'security_patch_worker' : 'code_worker', inputHandles: ['diagnosis'], outputSchemaRef: 'change_receipt', timeoutMs: 120000 },
        { nodeId: 'verifier', roleId: taskClass === 'security_remediation' ? 'independent_security_verifier' : 'independent_verifier', inputHandles: ['writer'], outputSchemaRef: 'verification_receipt', timeoutMs: 120000 },
      ];
  if (input.naturalLanguageWorkflow === true) reasonCodes.push('v130_natural_language_workflow_forbidden');
  if (input.replanCount > policy.constrainedDagPolicy.replanMax) reasonCodes.push('v130_replan_limit_exceeded');
  const writerCount = nodes.filter((node) => ['code_worker', 'test_worker', 'security_patch_worker'].includes(node.roleId)).length;
  const dag = { schemaVersion: '1.3.0', lane, nodes, edges: nodes.slice(1).map((node, i) => ({ from: nodes[i].nodeId, to: node.nodeId, handleType: 'evidence_handle' })), singleWriter: writerCount <= 1, verifierRequired: true, authorityCreated: false };
  dag.dagDigest = sha256(canonicalJson(dag));
  const validation = validateConstrainedDag(policy, dag, input);
  reasonCodes.push(...validation.reasonCodes);
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes, dag, safeSummaryOnly: true };
}

export function validateConstrainedDag(policy, dag = {}, input = {}) {
  const reasonCodes = [];
  const nodes = Array.isArray(dag.nodes) ? dag.nodes : [];
  const edges = Array.isArray(dag.edges) ? dag.edges : [];
  const roleIds = new Set((policy.agentRoles || []).map((role) => role.roleId));
  const nodeIds = new Set(nodes.map((node) => node.nodeId));
  const writerCount = nodes.filter((node) => ['code_worker', 'test_worker', 'security_patch_worker'].includes(node.roleId)).length;
  if (nodes.length > policy.constrainedDagPolicy.nodeCountMax) reasonCodes.push('v130_dag_node_limit_exceeded');
  if (writerCount > policy.constrainedDagPolicy.writerNodeMax) reasonCodes.push('v130_parallel_writer_forbidden');
  if (!nodes.some((node) => String(node.roleId || '').includes('verifier'))) reasonCodes.push('v130_dag_missing_verifier');
  for (const node of nodes) {
    if (!roleIds.has(node.roleId)) reasonCodes.push('v130_dag_unknown_role');
    if (!Number.isInteger(node.timeoutMs) || node.timeoutMs < 1) reasonCodes.push('v130_dag_timeout_missing');
    if (!node.outputSchemaRef) reasonCodes.push('v130_dag_output_schema_missing');
    if (node.modelId) reasonCodes.push('v130_model_id_in_plan_forbidden');
    for (const handle of node.inputHandles || []) {
      if (handle !== 'goal' && !nodeIds.has(handle)) reasonCodes.push('v130_dag_forward_reference_forbidden');
    }
  }
  for (const edge of edges) {
    const from = typeof edge === 'string' ? edge.split('->')[0] : edge.from;
    const to = typeof edge === 'string' ? edge.split('->')[1] : edge.to;
    if (!nodeIds.has(from) || !nodeIds.has(to)) reasonCodes.push('v130_dag_forward_reference_forbidden');
    if (edge.handleType && edge.handleType !== 'evidence_handle') reasonCodes.push('v130_raw_output_broadcast_forbidden');
  }
  const graph = new Map(nodes.map((node) => [node.nodeId, []]));
  for (const edge of edges) {
    const from = typeof edge === 'string' ? edge.split('->')[0] : edge.from;
    const to = typeof edge === 'string' ? edge.split('->')[1] : edge.to;
    if (graph.has(from)) graph.get(from).push(to);
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    for (const next of graph.get(id) || []) {
      if (!visit(next)) return false;
    }
    visiting.delete(id);
    visited.add(id);
    return true;
  }
  for (const id of graph.keys()) {
    if (!visit(id)) {
      reasonCodes.push('v130_dag_cycle_forbidden');
      break;
    }
  }
  if (input.goalMutation === true) reasonCodes.push('v130_goal_mutation_forbidden');
  if (input.gateRemoval === true) reasonCodes.push('v130_gate_removal_forbidden');
  if (input.budgetExpansion === true) reasonCodes.push('v130_budget_expansion_forbidden');
  if (input.finalDecisionReplacement === true) reasonCodes.push('v130_final_decision_replacement_forbidden');
  if (input.replanCount > policy.constrainedDagPolicy.replanMax) reasonCodes.push('v130_replan_limit_exceeded');
  if (input.secondEscalation === true) reasonCodes.push('v130_second_escalation_forbidden');
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes, safeSummaryOnly: true };
}

export function applyAvailabilityMask(policy, inventory = {}, plan = {}) {
  const availableRoles = new Set((inventory.roles || []).filter((item) => item.available && item.authorized && item.featureStage === 'stable').map((item) => item.roleId));
  const maskedNodes = (plan.nodes || []).filter((node) => availableRoles.has(node.roleId));
  const verifierPresent = maskedNodes.some((node) => node.roleId.includes('verifier'));
  const reasonCodes = [];
  if (!verifierPresent) reasonCodes.push('v130_mask_removed_verifier');
  if ((plan.nodes || []).length !== maskedNodes.length) reasonCodes.push('v130_unavailable_role_masked');
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes, maskedNodes, silentFallback: false, safeSummaryOnly: true };
}

export function evaluateEscalation(policy, input = {}) {
  const reasonCodes = [];
  if (!policy.adaptiveEscalationPolicy.allowedFailureClasses.includes(input.failureClass)) reasonCodes.push('v130_escalation_failure_class_forbidden');
  if (Number(input.escalationCount || 0) >= 1) reasonCodes.push('v130_second_escalation_forbidden');
  if (input.authorityCreated === true) reasonCodes.push('v130_escalation_authority_created');
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes, escalationCount: reasonCodes.length ? Number(input.escalationCount || 0) : Number(input.escalationCount || 0) + 1, safeSummaryOnly: true };
}

export function executeConstrainedDag(policy, dagInput = {}, runtime = {}) {
  const planned = buildConstrainedDag(policy, dagInput);
  const reasonCodes = [...(planned.reasonCodes || [])];
  const dag = planned.dag || { nodes: [], edges: [] };
  const handles = new Map();
  const nodeReceipts = [];
  const invokeNode = typeof runtime.invokeNode === 'function' ? runtime.invokeNode : null;
  if (planned.status !== 'pass') return { status: 'fail', reasonCodes, dag, nodeReceipts, evidenceHandles: [], authorityCreated: false, safeSummaryOnly: true };
  if (!invokeNode) reasonCodes.push('v130_dag_invoker_missing');
  for (const node of dag.nodes || []) {
    const role = compileAgentRole(policy, node.roleId);
    if (role.status !== 'pass') {
      reasonCodes.push(...(role.reasonCodes || ['v130_dag_role_compile_failed']));
      continue;
    }
    const inputHandleDigests = (node.inputHandles || []).map((handle) => handle === 'goal' ? dagInput.goalDigest || 'goal' : handles.get(handle)?.handleDigest || null);
    if (inputHandleDigests.some((digest) => !digest)) reasonCodes.push('v130_dag_input_handle_missing');
    const invocation = invokeNode ? invokeNode({ node, compiledRole: role.compiledRole, inputHandleDigests, dag }) : { status: 'fail', reasonCodes: ['v130_dag_invoker_missing'] };
    const receipt = {
      nodeId: node.nodeId,
      roleId: node.roleId,
      status: invocation.status || 'fail',
      reasonCodes: invocation.reasonCodes || [],
      agentId: invocation.agentId || null,
      threadDigest: invocation.threadDigest || null,
      worktreeDigest: invocation.worktreeDigest || null,
      modelInvocationObserved: invocation.modelInvocationObserved === true,
      fileChangeObserved: invocation.fileChangeObserved === true,
      readOnlyObserved: invocation.readOnlyObserved === true,
      outputDigest: invocation.outputDigest || null,
      authorityCreated: invocation.authorityCreated === true,
    };
    receipt.receiptDigest = sha256(canonicalJson(receipt));
    if (receipt.status !== 'pass') reasonCodes.push(...(receipt.reasonCodes.length ? receipt.reasonCodes : ['v130_dag_node_failed']));
    if (receipt.modelInvocationObserved !== true) reasonCodes.push('v130_dag_model_invocation_missing');
    if (!/^sha256:[a-f0-9]{64}$/.test(String(receipt.threadDigest || ''))) reasonCodes.push('v130_dag_thread_digest_missing');
    if (!/^sha256:[a-f0-9]{64}$/.test(String(receipt.worktreeDigest || ''))) reasonCodes.push('v130_dag_worktree_digest_missing');
    if (receipt.authorityCreated === true) reasonCodes.push('v130_dag_authority_created');
    if (String(node.roleId).includes('verifier') && receipt.fileChangeObserved === true) reasonCodes.push('v130_dag_verifier_modified_workspace');
    if (['code_worker', 'test_worker', 'security_patch_worker'].includes(node.roleId) && receipt.fileChangeObserved !== true) reasonCodes.push('v130_dag_writer_file_change_missing');
    const handle = {
      handleId: node.nodeId,
      nodeId: node.nodeId,
      handleDigest: sha256(canonicalJson({
        nodeId: node.nodeId,
        roleId: node.roleId,
        receiptDigest: receipt.receiptDigest,
        outputDigest: receipt.outputDigest,
      })),
      rawOutputStored: false,
      safeSummaryOnly: true,
    };
    handles.set(node.nodeId, handle);
    nodeReceipts.push(receipt);
  }
  const writer = nodeReceipts.find((receipt) => ['code_worker', 'test_worker', 'security_patch_worker'].includes(receipt.roleId));
  const verifier = nodeReceipts.find((receipt) => String(receipt.roleId).includes('verifier'));
  if (!writer) reasonCodes.push('v130_dag_writer_missing');
  if (!verifier) reasonCodes.push('v130_dag_missing_verifier');
  if (writer && verifier) {
    if (writer.agentId && writer.agentId === verifier.agentId) reasonCodes.push('v130_dag_worker_verifier_same_agent');
    if (writer.threadDigest === verifier.threadDigest) reasonCodes.push('v130_dag_worker_verifier_same_thread');
    if (writer.worktreeDigest === verifier.worktreeDigest) reasonCodes.push('v130_dag_worker_verifier_same_worktree');
  }
  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    dag,
    nodeReceipts,
    evidenceHandles: [...handles.values()],
    completionPath: ['Goal Completion Proof', 'v129 Goal Finalizer', 'Final Decision'],
    rawOutputStored: false,
    authorityCreated: false,
    safeSummaryOnly: true,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs');
  const policy = JSON.parse(fs.readFileSync('docs/process/CODEX_V130_POLICY.json', 'utf8'));
  const result = buildConstrainedDag(policy, { taskClass: 'security_remediation' });
  console.log(canonicalJson(result));
  process.exit(result.status === 'pass' ? 0 : 1);
}
