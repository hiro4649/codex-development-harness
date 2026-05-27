#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.3
import { fileURLToPath } from 'node:url';
import { isPrContext, normalizePath, prBodyText, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function parseInput(env = process.env) {
  if (env.CODEX_SAME_HEAD_EVIDENCE_JSON) {
    try { return JSON.parse(env.CODEX_SAME_HEAD_EVIDENCE_JSON); }
    catch { return { invalidInput: true }; }
  }
  const prContext = isPrContext(env);
  const explicitLocalHead = env.CODEX_LOCAL_HEAD_SHA || (prContext ? env.CODEX_PR_HEAD_SHA : '') || env.GITHUB_SHA || '';
  return {
    localHeadSha: explicitLocalHead,
    prHeadSha: env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || '',
    evidencePackHeadSha: env.CODEX_EVIDENCE_PACK_HEAD_SHA || env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || '',
    manualConfirmationHeadSha: env.CODEX_MANUAL_CONFIRMATION_HEAD_SHA || env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || '',
    remoteRunHeadSha: env.CODEX_REMOTE_RUN_HEAD_SHA || env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || '',
    artifactHeadSha: env.CODEX_ARTIFACT_HEAD_SHA || '',
    safeSummaryHeadSha: env.CODEX_SAFE_SUMMARY_HEAD_SHA || '',
    artifactRequired: env.CODEX_ARTIFACT_REQUIRED === '1',
    mergeReady: env.CODEX_MERGE_READY === '1',
  };
}

export function buildSameHeadArtifactEvidenceReport(input = parseInput(), env = process.env) {
  const prContext = isPrContext(env) || Boolean(input.forcePrContext);
  if (!prContext && !input.forceCheck && !input.localHeadSha) {
    return simpleStatus('sameHeadArtifactEvidenceStatus', 'pass', { reasonCodes: ['same_head_not_required_for_local_non_pr'], sameHeadRequired: false });
  }
  const labels = ['localHeadSha', 'prHeadSha', 'evidencePackHeadSha', 'manualConfirmationHeadSha', 'remoteRunHeadSha'];
  const heads = labels.map((key) => [key, input[key]]).filter(([, value]) => value);
  const expected = input.prHeadSha || input.localHeadSha;
  const reasonCodes = [];
  if (input.invalidInput || !expected) reasonCodes.push('same_head_artifact_missing');
  for (const [key, value] of heads) {
    if (expected && value && value !== expected) reasonCodes.push(key === 'manualConfirmationHeadSha' ? 'manual_confirmation_stale_head' : 'same_head_artifact_mismatch');
  }
  if (input.artifactRequired && !input.artifactHeadSha) reasonCodes.push('same_head_artifact_missing');
  if (input.artifactHeadSha && expected && input.artifactHeadSha !== expected) reasonCodes.push('same_head_artifact_mismatch');
  if (input.safeSummaryHeadSha && expected && input.safeSummaryHeadSha !== expected) reasonCodes.push('same_head_artifact_mismatch');
  if (input.sameHeadEvidencePending && input.mergeReady) reasonCodes.push('same_head_artifact_missing');
  return simpleStatus('sameHeadArtifactEvidenceStatus', reasonCodes.length ? 'fail' : 'pass', { requiredHeads: heads.map(([key]) => key), reasonCodes: [...new Set(reasonCodes)], sameHeadRequired: true, safeSummaryOnly: true });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildSameHeadArtifactEvidenceReport();
  writeJsonReport(report, 'CODEX_SAME_HEAD_ARTIFACT_EVIDENCE_REPORT');
  exitFor(report);
}

