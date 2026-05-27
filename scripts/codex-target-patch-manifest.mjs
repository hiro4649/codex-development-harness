#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.3
import { fileURLToPath } from 'node:url';
import { normalizePath, readJson, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function inputFromEnv(env = process.env) {
  if (env.CODEX_TARGET_PATCH_MANIFEST_JSON) {
    try { return JSON.parse(env.CODEX_TARGET_PATCH_MANIFEST_JSON); }
    catch { return { invalidJson: true }; }
  }
  const file = env.CODEX_TARGET_PATCH_MANIFEST_PATH || 'docs/process/CODEX_TARGET_PATCH_MANIFEST.json';
  const parsed = readJson(file);
  if (parsed.ok) return parsed.value;
  return { missingManifest: true, source: file };
}

export function buildTargetPatchManifestReport(input = inputFromEnv(), env = process.env) {
  const targetMode = env.CODEX_HARNESS_MODE === 'target' || input.targetMode === true;
  if (input.missingManifest && !targetMode) return simpleStatus('targetPatchManifestStatus', 'not_applicable', { reasonCodes: ['target_patch_manifest_not_required_in_source_context'] });
  const reasonCodes = [];
  if (input.invalidJson) reasonCodes.push('target_patch_manifest_missing');
  const patches = Array.isArray(input.patches) ? input.patches : [];
  if (!input.missingManifest && !Array.isArray(input.patches)) reasonCodes.push('target_patch_manifest_missing');
  for (const patch of patches) {
    if (patch.classification === 'target_hotfix' && !patch.preservationMode) reasonCodes.push('target_patch_manifest_missing');
    if (patch.expectedDuringRollout === true && patch.presentAfterRollout === false) reasonCodes.push('target_patch_manifest_missing');
    if (patch.preservationMode === 'remove_with_evidence' && !patch.removalEvidence) reasonCodes.push('target_hotfix_overwritten');
    if (patch.fileChangedWithoutManifestUpdate) reasonCodes.push('target_patch_manifest_missing');
  }
  const payload = { patchCount: patches.length, reasonCodes: [...new Set(reasonCodes)], safeSummaryOnly: true };
  if (scanObjectForUnsafe(payload).length) return simpleStatus('targetPatchManifestStatus', 'fail', { reasonCodes: ['unsafe_value_detected'] });
  return simpleStatus('targetPatchManifestStatus', reasonCodes.length ? 'fail' : 'pass', payload);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildTargetPatchManifestReport();
  writeJsonReport(report, 'CODEX_TARGET_PATCH_MANIFEST_REPORT');
  exitFor(report);
}

