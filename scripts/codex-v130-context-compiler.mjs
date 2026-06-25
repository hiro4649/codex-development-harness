#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.0

import crypto from 'node:crypto';
import fs from 'node:fs';
import { canonicalJson } from './codex-v129-goal-contract.mjs';

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function bytes(value) {
  return Buffer.byteLength(typeof value === 'string' ? value : canonicalJson(value), 'utf8');
}

export function buildCompiledInstructionEnvelope(input = {}) {
  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync('docs/process/CODEX_HARNESS_MANIFEST.json', 'utf8'));
  } catch {
    manifest = {};
  }
  const envelope = {
    schemaVersion: '1.3.0',
    activeHarnessVersion: manifest.activeHarnessVersion || input.activeHarnessVersion || null,
    candidateHarnessVersion: '1.3.0',
    goalDigest: input.goalDigest || `sha256:${'0'.repeat(64)}`,
    taskClass: input.taskClass || 'code_change',
    roleId: input.roleId || 'code_worker',
    actionClass: input.actionClass || 'read',
    allowedPaths: Array.isArray(input.allowedPaths) ? input.allowedPaths.slice(0, 16) : [],
    forbiddenPathDigest: input.forbiddenPathDigest || `sha256:${'0'.repeat(64)}`,
    requiredGateIds: Array.isArray(input.requiredGateIds) ? input.requiredGateIds.slice(0, 8) : ['v130-intake-context'],
    selectedSkillRef: input.selectedSkillRef || null,
    sandboxMode: input.sandboxMode || (input.actionClass === 'write' ? 'workspace_write' : 'read_only'),
    networkMode: input.networkMode || 'restricted',
    stopPolicyId: input.stopPolicyId || 'v130_anti_spin_once',
    repairBudget: input.repairBudget || { maxRepairIterations: 1, sameBlockerMax: 1 },
    outputSchemaId: input.outputSchemaId || 'v130_compiled_instruction_result',
    policyDigest: input.policyDigest || (fs.existsSync('docs/process/CODEX_V130_POLICY.json') ? sha256(fs.readFileSync('docs/process/CODEX_V130_POLICY.json', 'utf8')) : null),
    candidateHeadSha: input.candidateHeadSha || null,
    routineReads: ['AGENTS.md', 'docs/process/CODEX_HARNESS_MANIFEST.json', 'compiled_instruction_envelope'],
    deferredSpecRead: true,
    forbiddenRoutineReadsDigest: sha256(canonicalJson(['full_conversation', 'raw_logs', 'raw_model_output', 'secrets'])),
    tokenBudgets: {
      alwaysResidentInstructionBytes: 1536,
      dynamicDeltaBytes: 640,
      routineReadSurfaceBytes: 2500,
      routineColdArtifactReads: 0,
      routineSkillCount: 0,
      routineSubagentCount: 0,
      routineAdditionalModelCallCount: 0,
    },
    fullConversationReplay: false,
    rawStorageAllowed: false,
    evidenceHandles: Array.isArray(input.evidenceHandles) ? input.evidenceHandles.slice(0, 12) : [],
  };
  envelope.instructionDigest = sha256(canonicalJson(envelope));
  const canonicalBytes = bytes(envelope);
  const reasonCodes = [];
  if (!envelope.activeHarnessVersion) reasonCodes.push('v130_instruction_envelope_active_version_unavailable');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(envelope.goalDigest || ''))) reasonCodes.push('v130_instruction_envelope_goal_digest_invalid');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(envelope.policyDigest || ''))) reasonCodes.push('v130_instruction_envelope_policy_digest_invalid');
  if (envelope.candidateHeadSha && !/^[a-f0-9]{40}$/.test(String(envelope.candidateHeadSha))) reasonCodes.push('v130_instruction_envelope_candidate_head_invalid');
  if (canonicalBytes > 1536) reasonCodes.push('v130_instruction_envelope_over_budget');
  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    compiledInstructionEnvelope: envelope,
    canonicalBytes,
    safeSummaryOnly: true,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = buildCompiledInstructionEnvelope();
  console.log(canonicalJson(result));
  process.exit(result.status === 'pass' ? 0 : 1);
}
