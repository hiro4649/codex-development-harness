#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.3
import { fileURLToPath } from 'node:url';
import { normalizePath, readJson, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function parseInput(env = process.env) {
  if (env.CODEX_TARGET_HOTFIX_INPUT) {
    try { return JSON.parse(env.CODEX_TARGET_HOTFIX_INPUT); }
    catch { return { invalidInput: true }; }
  }
  return {};
}

export function buildTargetHotfixPreservationReport(input = parseInput(), env = process.env) {
  const targetMode = env.CODEX_HARNESS_MODE === 'target' || input.targetMode === true;
  if (!targetMode && !input.forceCheck) {
    return simpleStatus('previousTargetHotfixPreservationStatus', 'not_applicable', { reasonCodes: ['source_repo_non_target_context'] });
  }
  const reasonCodes = [];
  const manualReasonCodes = [];
  if (input.invalidInput) reasonCodes.push('target_hotfix_overwritten');
  if (input.targetHotfixDetected && !input.preserved && !input.migrated && !input.noTargetHotfixPresent) reasonCodes.push('target_hotfix_overwritten');
  if (input.targetSpecificAdaptationOverwritten) reasonCodes.push('target_hotfix_overwritten');
  if (input.existingUncommittedChangeMixed) reasonCodes.push('target_rollout_conflict_detected');
  if (input.targetOnlyPolicyDeletedWithoutMigration) reasonCodes.push('target_only_policy_deleted');
  if (input.targetPatchExists && !input.manifestEntryPresent) reasonCodes.push('target_patch_manifest_missing');
  if (input.unknownTargetDeltaOverwritten) reasonCodes.push('target_rollout_conflict_detected');
  if (input.targetHotfixDetected && !input.preservationDecisionRecorded) manualReasonCodes.push('target_hotfix_preservation_decision_missing');
  if (input.targetSpecificFile && !input.ownerNotePresent) manualReasonCodes.push('target_specific_owner_note_missing');
  if (input.patchExists && input.migrationUnclear) manualReasonCodes.push('target_patch_migration_unclear');
  const status = reasonCodes.length ? 'fail' : (manualReasonCodes.length ? 'manual_confirmation_required' : 'pass');
  const payload = { reasonCodes: [...new Set(reasonCodes)], manualReasonCodes: [...new Set(manualReasonCodes)], classification: input.classification || (input.targetHotfixDetected ? 'target_hotfix' : 'pure_old_harness_drift'), preservation: Boolean(input.preserved || input.migrated || input.noTargetHotfixPresent || input.preExistingChangeStashed), patchPathRecorded: Boolean(input.patchPathRecorded), safeSummaryOnly: true };
  if (scanObjectForUnsafe(payload).length) return simpleStatus('previousTargetHotfixPreservationStatus', 'fail', { reasonCodes: ['unsafe_value_detected'] });
  return simpleStatus('previousTargetHotfixPreservationStatus', status, payload);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildTargetHotfixPreservationReport();
  writeJsonReport(report, 'CODEX_TARGET_HOTFIX_PRESERVATION_REPORT');
  exitFor(report);
}

