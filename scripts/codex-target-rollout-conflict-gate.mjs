#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.3
import { fileURLToPath } from 'node:url';
import { normalizePath, readJson, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function parseInput(env = process.env) {
  if (env.CODEX_TARGET_ROLLOUT_CONFLICT_JSON) {
    try { return JSON.parse(env.CODEX_TARGET_ROLLOUT_CONFLICT_JSON); }
    catch { return { invalidInput: true }; }
  }
  return {};
}

export function buildTargetRolloutConflictReport(input = parseInput(), env = process.env) {
  const targetMode = env.CODEX_HARNESS_MODE === 'target' || input.targetMode === true;
  if (!targetMode && !input.forceCheck) return simpleStatus('targetRolloutConflictStatus', 'not_applicable', { reasonCodes: ['source_repo_non_target_context'] });
  const reasonCodes = [];
  const warnings = [];
  if (input.invalidInput) reasonCodes.push('target_rollout_conflict_detected');
  if (input.targetOnlyHarnessFileDeleted) reasonCodes.push('target_only_policy_deleted');
  if (input.targetHotfixOverwritten) reasonCodes.push('target_hotfix_overwritten');
  if (input.existingStashOrPatchNotReferenced) reasonCodes.push('target_rollout_conflict_detected');
  if (input.targetManifestLosesTargetSpecificEntry) reasonCodes.push('target_rollout_conflict_detected');
  if (input.untrackedHarnessManagedMixed) reasonCodes.push('target_rollout_conflict_detected');
  if (input.largeHarnessManagedDiff) warnings.push('large_harness_managed_diff');
  if (input.docsProcessBulkUpdate) warnings.push('docs_process_bulk_update');
  const status = reasonCodes.length ? 'fail' : (warnings.length ? 'warning' : 'pass');
  return simpleStatus('targetRolloutConflictStatus', status, { reasonCodes: [...new Set(reasonCodes)], warnings, safeSummaryOnly: true });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildTargetRolloutConflictReport();
  writeJsonReport(report, 'CODEX_TARGET_ROLLOUT_CONFLICT_REPORT');
  exitFor(report);
}

