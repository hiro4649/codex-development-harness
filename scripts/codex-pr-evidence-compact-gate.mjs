#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.3
import { fileURLToPath } from 'node:url';
import { normalizePath, prBodyText, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function parseInput(env = process.env) {
  if (env.CODEX_PR_EVIDENCE_COMPACT_JSON) {
    try { return JSON.parse(env.CODEX_PR_EVIDENCE_COMPACT_JSON); }
    catch { return { invalidInput: true }; }
  }
  return {
    body: prBodyText(env),
    safeArtifactAvailable: Boolean(env.CODEX_SAFE_ARTIFACT_ID || env.CODEX_SAFE_ARTIFACT_URL),
    artifactReferenceStale: env.CODEX_ARTIFACT_REFERENCE_STALE === '1',
  };
}

function changedFileListTooLarge(body, limit = 60) {
  const matches = String(body || '').match(/(?:^|\n)\s*[-*]\s+[^\n]+/g) || [];
  return matches.length > limit;
}

export function buildPrEvidenceCompactReport(input = parseInput()) {
  const body = String(input.body || '');
  const reasonCodes = [];
  const warnings = [];
  if (input.invalidInput) reasonCodes.push('pr_evidence_compact_failed');
  if (/raw logs?:|full stdout|command stdout full text/i.test(body) || input.rawLogIncluded) reasonCodes.push('raw_log_in_pr_body');
  if (/^diff --git\s|^@@\s|raw diffs?:/m.test(body) || input.rawDiffIncluded) reasonCodes.push('pr_evidence_compact_failed');
  if (changedFileListTooLarge(body, input.fileListLimit || 60) || input.largeGeneratedFileList) {
    if (input.safeArtifactAvailable) warnings.push('pr_body_too_large');
    else reasonCodes.push('pr_body_too_large');
  }
  if (input.evidencePackMissing && !input.safeArtifactAvailable) reasonCodes.push('pr_evidence_compact_failed');
  if (input.artifactReferenceStale) reasonCodes.push('pr_evidence_compact_failed');
  if (body.length > (input.sizeBudget || 12000)) warnings.push('pr_body_too_large');
  const status = reasonCodes.length ? 'fail' : (warnings.length ? 'warning' : 'pass');
  return simpleStatus('prEvidenceCompactStatus', status, { reasonCodes: [...new Set(reasonCodes)], warnings, bodySize: body.length, safeSummaryOnly: true });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildPrEvidenceCompactReport();
  writeJsonReport(report, 'CODEX_PR_EVIDENCE_COMPACT_REPORT');
  exitFor(report);
}

