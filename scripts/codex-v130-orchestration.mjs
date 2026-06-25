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
        { nodeId: 'writer', roleId: 'code_worker', inputHandles: ['goal'], outputSchemaRef: 'change_receipt' },
        { nodeId: 'verifier', roleId: 'independent_verifier', inputHandles: ['writer'], outputSchemaRef: 'verification_receipt' },
      ]
    : [
        { nodeId: 'diagnosis', roleId: taskClass.startsWith('security') ? 'threat_modeler' : 'architecture_reviewer', inputHandles: ['goal'], outputSchemaRef: 'finding_receipt' },
        { nodeId: 'writer', roleId: taskClass === 'security_remediation' ? 'security_patch_worker' : 'code_worker', inputHandles: ['diagnosis'], outputSchemaRef: 'change_receipt' },
        { nodeId: 'verifier', roleId: taskClass === 'security_remediation' ? 'independent_security_verifier' : 'independent_verifier', inputHandles: ['writer'], outputSchemaRef: 'verification_receipt' },
      ];
  const writerCount = nodes.filter((node) => ['code_worker', 'test_worker', 'security_patch_worker'].includes(node.roleId)).length;
  if (nodes.length > policy.constrainedDagPolicy.nodeCountMax) reasonCodes.push('v130_dag_node_limit_exceeded');
  if (writerCount > policy.constrainedDagPolicy.writerNodeMax) reasonCodes.push('v130_parallel_writer_forbidden');
  if (!nodes.some((node) => node.roleId.includes('verifier'))) reasonCodes.push('v130_dag_missing_verifier');
  if (input.naturalLanguageWorkflow === true) reasonCodes.push('v130_natural_language_workflow_forbidden');
  if (input.replanCount > policy.constrainedDagPolicy.replanMax) reasonCodes.push('v130_replan_limit_exceeded');
  const dag = { schemaVersion: '1.3.0', lane, nodes, edges: nodes.slice(1).map((node, i) => `${nodes[i].nodeId}->${node.nodeId}`), singleWriter: writerCount <= 1, verifierRequired: true, authorityCreated: false };
  dag.dagDigest = sha256(canonicalJson(dag));
  return { status: reasonCodes.length ? 'fail' : 'pass', reasonCodes, dag, safeSummaryOnly: true };
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs');
  const policy = JSON.parse(fs.readFileSync('docs/process/CODEX_V130_POLICY.json', 'utf8'));
  const result = buildConstrainedDag(policy, { taskClass: 'security_remediation' });
  console.log(canonicalJson(result));
  process.exit(result.status === 'pass' ? 0 : 1);
}
