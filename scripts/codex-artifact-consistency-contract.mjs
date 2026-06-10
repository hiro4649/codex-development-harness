#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.7

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { pass, fail } from './codex-outcome-contract.mjs';

export const LOAD_BEARING_ARTIFACTS = [
  'codex-decision-capsule.safe.json',
  'codex-artifact-consistency.safe.json',
  'codex-minimal-blockers.safe.json',
  'codex-quality-gate-safe-summary.json',
];

export const FALLBACK_SAFE_DETAIL_ALLOWED_REASONS = new Set([
  'no_safe_artifact_available',
  'github_metadata_incomplete',
  'artifact_download_failed',
  'remote_artifact_expired',
  'raw_log_access_forbidden',
]);

export function normalizeArtifactStatus(value, fallback = 'missing') {
  if (value === true || value === 'pass' || value === 'present') return 'pass';
  if (value === false || value === 'fail' || value === 'missing') return 'fail';
  return value || fallback;
}

export function classifyArtifactConsistency(input = {}) {
  if (input.safeSummaryMissing) return 'safe_summary_missing';
  if (input.decisionCapsuleMissing) return 'decision_capsule_missing';
  if (input.minimalBlockersMissing) return 'minimal_blockers_missing';
  if (input.workflowUploadContractGap) return 'workflow_upload_contract_gap';
  if (input.summaryPickerIncompatible) return 'summary_picker_incompatible';
  if (input.remoteMetadataIncomplete) return 'remote_metadata_incomplete';
  if (input.schemaMismatch) return 'artifact_schema_mismatch';
  if (input.staleHead || input.artifactHeadMatchStatus === 'fail') return 'artifact_stale_head';
  if (input.generated === false || input.artifactGeneratedStatus === 'fail') return 'artifact_missing';
  if (input.indexed === false || input.uploaded === false || input.downloadObserved === false) return 'artifact_index_consistency_failure';
  return 'artifact_index_consistency_failure';
}

export function classifySafeDetailUnavailable(input = {}) {
  const reason = String(input.reason || input.primaryReason || input.fallbackSafeDetailReason || '').trim();
  const primaryClass = FALLBACK_SAFE_DETAIL_ALLOWED_REASONS.has(reason)
    ? 'safe_detail_unavailable'
    : classifyArtifactConsistency(input);
  const status = primaryClass === 'safe_detail_unavailable' ? 'pass' : 'fail';
  return { status, primaryClass, reasonCodes: status === 'pass' ? [] : [primaryClass], safeSummaryOnly: true };
}

export function validateArtifactConsistency(input = {}) {
  const artifactName = input.artifactName || 'codex-decision-capsule.safe.json';
  const generated = normalizeArtifactStatus(input.artifactGeneratedStatus ?? input.generated, 'pass');
  const indexed = normalizeArtifactStatus(input.artifactIndexedStatus ?? input.indexed, 'pass');
  const uploaded = normalizeArtifactStatus(input.artifactUploadedStatus ?? input.uploaded, 'pass');
  const downloadObserved = normalizeArtifactStatus(input.artifactDownloadObservedStatus ?? input.downloadObserved, 'pass');
  const headMatch = normalizeArtifactStatus(input.artifactHeadMatchStatus ?? input.headMatch, 'pass');
  const reasonCodes = [];
  if (input.safeSummaryPresent === false) reasonCodes.push('safe_summary_missing');
  if (!LOAD_BEARING_ARTIFACTS.includes(artifactName)) reasonCodes.push('artifact_not_load_bearing');
  if (indexed === 'pass' && generated !== 'pass') reasonCodes.push('artifact_index_consistency_failure');
  if (generated === 'pass' && indexed !== 'pass') reasonCodes.push('artifact_generated_not_indexed');
  if (indexed === 'pass' && uploaded !== 'pass') reasonCodes.push('artifact_index_consistency_failure');
  if (uploaded === 'pass' && generated !== 'pass') reasonCodes.push('artifact_uploaded_without_generated_source');
  if (uploaded === 'pass' && downloadObserved !== 'pass') reasonCodes.push('artifact_download_not_observed');
  if (downloadObserved === 'pass' && headMatch !== 'pass') reasonCodes.push('artifact_head_mismatch');
  const base = {
    artifactName,
    artifactGeneratedStatus: generated,
    artifactIndexedStatus: indexed,
    artifactUploadedStatus: uploaded,
    artifactDownloadObservedStatus: downloadObserved,
    artifactHeadMatchStatus: headMatch,
    head: input.head || input.headSha || 'unknown',
    rawLogsRequired: false,
    productRepairAllowed: false,
    safeSummaryOnly: true,
  };
  if (reasonCodes.length) {
    const primaryClass = reasonCodes.includes('artifact_head_mismatch')
      ? 'artifact_stale_head'
      : (reasonCodes.includes('artifact_index_consistency_failure') ? 'artifact_index_consistency_failure' : classifyArtifactConsistency({
        artifactName,
        artifactGeneratedStatus: generated,
        artifactIndexedStatus: indexed,
        artifactUploadedStatus: uploaded,
        artifactDownloadObservedStatus: downloadObserved,
        artifactHeadMatchStatus: headMatch,
      }));
    return fail(reasonCodes, {
      ...base,
      primaryClass,
      repairType: 'target_workflow_artifact_contract',
      safeNextAction: 'owner artifact-contract scope decision',
    });
  }
  return pass(base);
}

export function buildArtifactConsistencyReport(input = {}) {
  const artifacts = input.artifacts || LOAD_BEARING_ARTIFACTS.map((artifactName) => ({
    artifactName,
    artifactHeadMatchStatus: input.remoteHeadMatches === false ? 'fail' : undefined,
    safeSummaryPresent: input.safeSummaryPresent,
  }));
  const entries = artifacts.map((artifact) => validateArtifactConsistency({ head: input.head, ...artifact }));
  const failures = entries.filter((entry) => entry.status === 'fail');
  return {
    status: failures.length ? 'fail' : 'pass',
    artifactConsistencyStatus: failures.length ? failures[0] : pass({ checkedArtifacts: entries.length }),
    entries,
    checkedArtifacts: entries.length,
    safeSummaryOnly: true,
  };
}

export function validateDeltaOnlyFinalizer(input = {}) {
  if (Array.isArray(input.emittedFields) && Array.isArray(input.changedFields)) {
    const changed = new Set(input.changedFields);
    const extra = input.emittedFields.filter((field) => !changed.has(field));
    return extra.length ? fail('delta_only_surface_expanded', { extra }) : pass({ emittedFields: input.emittedFields, countOnly: true });
  }
  const required = [
    'head',
    'primaryClass',
    'mergeAllowed',
    'rawLogsRead',
    'productCodeChanged',
    'packageLockfileChanged',
    'workflowChanged',
    'runtimeReadinessClaimed',
    'productionReadinessClaimed',
    'safeNextAction',
  ];
  const reasonCodes = [];
  for (const field of required) {
    if (!(field in input)) reasonCodes.push('delta_only_required_field_missing');
  }
  if (input.passStatusListPrinted === true || input.legacyStatusListPrinted === true || input.fullJsonStdout === true) {
    reasonCodes.push('delta_only_surface_expanded');
  }
  return reasonCodes.length ? fail(reasonCodes, { required }) : pass({ preservedFields: required, countOnly: true });
}

function readJsonIfPresent(file) {
  try {
    if (!file || !fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = process.argv[2] || '.';
  const head = process.env.CODEX_PR_HEAD_SHA || process.env.GITHUB_SHA || 'unknown';
  const artifacts = LOAD_BEARING_ARTIFACTS.map((artifactName) => {
    const file = path.join(dir, artifactName);
    const artifact = readJsonIfPresent(file);
    return {
      artifactName,
      artifactGeneratedStatus: (artifact || artifactName === 'codex-artifact-consistency.safe.json') ? 'pass' : 'fail',
      artifactIndexedStatus: 'pass',
      artifactUploadedStatus: artifact ? 'pass' : 'fail',
      artifactDownloadObservedStatus: artifact ? 'pass' : 'missing',
      artifactHeadMatchStatus: artifact?.head && artifact.head !== head ? 'fail' : (artifact ? 'pass' : 'not_observed'),
    };
  });
  const report = buildArtifactConsistencyReport({ head, artifacts });
  writeJsonReport(report, 'CODEX_ARTIFACT_CONSISTENCY_REPORT');
  if (!process.env.CODEX_ARTIFACT_CONSISTENCY_REPORT && process.env.CODEX_QUALITY_REPORT !== 'json') {
    console.log(`artifactConsistencyStatus: ${report.artifactConsistencyStatus.status}`);
  }
  exitFor(report);
}
