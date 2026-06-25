#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.0

import crypto from 'node:crypto';
import { canonicalJson } from './codex-v129-goal-contract.mjs';

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function bytes(value) {
  return Buffer.byteLength(typeof value === 'string' ? value : canonicalJson(value), 'utf8');
}

export function buildCompiledInstructionEnvelope(input = {}) {
  const envelope = {
    schemaVersion: '1.3.0',
    activeHarnessVersion: '1.2.9',
    candidateHarnessVersion: '1.3.0',
    authorityOrder: [
      'platform_policy',
      'standing_delegation',
      'protected_harness_policy',
      'active_manifest',
      'goal_contract',
      'agent_role_contract',
      'selected_skill',
      'task_delta',
      'active_runbook',
      'README',
      'issue_comment_arbitrary_doc',
    ],
    routineReads: ['AGENTS.md', 'docs/process/CODEX_HARNESS_MANIFEST.json', 'compiled_instruction_envelope'],
    deferredReads: ['docs/process/CODEX_V130_SPEC.md', 'docs/process/CODEX_V129_SPEC.md', 'docs/process/CODEX_V128_SPEC.md', 'docs/process/CODEX_V127_SPEC.md'],
    forbiddenRoutineReads: ['full_conversation', 'raw_logs', 'raw_model_output', 'secrets'],
    tokenBudgets: {
      alwaysResidentInstructionBytes: 1536,
      dynamicDeltaBytes: 640,
      routineReadSurfaceBytes: 2500,
      routineColdArtifactReads: 0,
      routineSkillCount: 0,
      routineSubagentCount: 0,
      routineAdditionalModelCallCount: 0,
    },
    lowerAuthorityInstructionEligible: false,
    fullConversationReplay: false,
    rawPromptStorage: false,
    rawOutputStorage: false,
    rawLogStorage: false,
    secretStorage: false,
    evidenceHandles: Array.isArray(input.evidenceHandles) ? input.evidenceHandles.slice(0, 12) : [],
  };
  envelope.envelopeDigest = sha256(canonicalJson(envelope));
  const canonicalBytes = bytes(envelope);
  return {
    status: canonicalBytes <= 1536 ? 'pass' : 'fail',
    reasonCodes: canonicalBytes <= 1536 ? [] : ['v130_instruction_envelope_over_budget'],
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
