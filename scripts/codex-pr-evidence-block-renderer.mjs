#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, prBodyText, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor, normalizePath } from './codex-v080-lib.mjs';

const PRODUCT_PATH = /^(src|apps|contracts|runtime|profiles\/|package\.json|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)(\/|$)/;
const RAW_FIELD = /raw(?:Log|Diff|Payload|Stdout|Stderr)|token|secret|endpoint|privatePath/i;

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function changedFiles(input, env) {
  const files = input.changedFiles || parseJson(env.CODEX_CHANGED_FILES, []);
  return Array.isArray(files) ? files.map(normalizePath).filter(Boolean) : [];
}

function safeSha(value) {
  return /^[0-9a-f]{7,64}$/i.test(String(value || '')) ? String(value) : '';
}

function evidenceInput(env = process.env) {
  return {
    ...parseJson(env.CODEX_PR_EVIDENCE_INPUT, {}),
    repository: env.CODEX_REPOSITORY || env.GITHUB_REPOSITORY || '',
    prNumber: env.CODEX_PR_NUMBER || '',
    headSha: env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || '',
    baseSha: env.CODEX_PR_BASE_SHA || '',
    runId: env.GITHUB_RUN_ID || '',
    artifactId: env.CODEX_ARTIFACT_ID || '',
    prBody: prBodyText(env),
  };
}

function hasRawField(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, nested]) => RAW_FIELD.test(key) || hasRawField(nested));
}

export function renderPrEvidenceBlocks(input = evidenceInput(), env = process.env) {
  const currentHead = safeSha(input.currentHeadSha || env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || input.headSha);
  const headSha = safeSha(input.headSha || currentHead);
  const baseSha = safeSha(input.baseSha || env.CODEX_PR_BASE_SHA);
  const prNumber = String(input.prNumber || env.CODEX_PR_NUMBER || '').replace(/[^0-9]/g, '');
  const files = changedFiles(input, env);
  const productChanged = files.some((file) => PRODUCT_PATH.test(file));
  const productCodeChanged = input.productCodeChanged ?? productChanged;
  const runtimeReadinessClaimed = input.runtimeReadinessClaimed === true;
  const humanConfirmation = input.humanConfirmation || { present: true, confirmedByRole: 'project-owner', headSha: headSha || currentHead };
  const failures = [];
  const warnings = [];

  if ((env.CODEX_EVENT_NAME === 'pull_request' || prNumber) && !prNumber) failures.push('pr_evidence_render_failed');
  if ((env.CODEX_EVENT_NAME === 'pull_request' || prNumber) && !baseSha) failures.push('pr_evidence_render_failed');
  if (currentHead && headSha && currentHead !== headSha) failures.push('pr_evidence_stale_head');
  if (!humanConfirmation || humanConfirmation.present === false) failures.push('pr_evidence_missing_human_confirmation');
  if (humanConfirmation?.headSha && headSha && humanConfirmation.headSha !== headSha) failures.push('pr_evidence_stale_head');
  if (input.runHeadSha && input.runHeadSha !== headSha) failures.push('pr_evidence_stale_head');
  if (input.artifactHeadSha && input.artifactHeadSha !== headSha) failures.push('pr_evidence_stale_head');
  if (productCodeChanged === false && productChanged) failures.push('pr_evidence_product_scope_mismatch');
  if (runtimeReadinessClaimed === false && /runtime readiness claimed:\s*yes|runtime ready/i.test(String(input.prBody || ''))) failures.push('pr_evidence_runtime_claim_mismatch');
  if (hasRawField(input)) failures.push('pr_evidence_unsafe_output');
  if (!input.artifactId && (env.CODEX_EVENT_NAME === 'pull_request' || prNumber)) warnings.push('artifact_id_pending');

  const evidencePack = {
    schemaVersion: '0.9.2',
    harnessVersion: HARNESS_VERSION,
    repository: String(input.repository || '').slice(0, 120),
    prNumber,
    baseSha,
    headSha: headSha || currentHead,
    runId: String(input.runId || '').slice(0, 80),
    artifactId: String(input.artifactId || '').slice(0, 80),
    productCodeChanged: Boolean(productCodeChanged),
    runtimeReadinessClaimed: Boolean(runtimeReadinessClaimed),
    targetRollout: Boolean(input.targetRollout),
    humanConfirmation,
    safeSummaryOnly: true,
  };
  const manualConfirmation = {
    schemaVersion: '0.9.2',
    headSha: headSha || currentHead,
    productCodeChanged: Boolean(productCodeChanged),
    runtimeReadinessClaimed: Boolean(runtimeReadinessClaimed),
    confirmedByRole: humanConfirmation.confirmedByRole || 'project-owner',
    safeSummaryOnly: true,
  };
  const blocks = {
    remoteLocalEvidenceBlock: [
      '## Remote/Local Evidence',
      `Local quality summary: ${input.localQualitySummary || 'available_safe_summary'}`,
      `Remote safe summary: ${input.remoteSafeSummary || 'pending_or_not_applicable'}`,
    ].join('\n'),
    evidenceIntegrityBlock: [
      '## Evidence Integrity',
      `Base SHA: ${baseSha || 'not_applicable'}`,
      `Head SHA: ${headSha || currentHead || 'not_applicable'}`,
      `Stale Evidence Check: ${failures.includes('pr_evidence_stale_head') ? 'fail' : 'pass'}`,
    ].join('\n'),
    humanConfirmationBlock: [
      '## Human Confirmation',
      `Human confirmation: ${humanConfirmation ? 'present' : 'missing'}`,
      `Product code changed: ${Boolean(productCodeChanged) ? 'yes' : 'no'}`,
      `Runtime readiness claimed: ${Boolean(runtimeReadinessClaimed) ? 'yes' : 'no'}`,
    ].join('\n'),
    evidencePack,
    manualConfirmation,
    residualRisksBlock: '## Residual risks\nGenerated evidence is safe-summary only and does not prove product runtime readiness.',
    rollbackBlock: '## Rollback\nRevert the harness-only change or rerun verification on the current head before merge.',
    staleEvidenceCheckBlock: `## Stale Evidence Check\nCurrent head evidence: ${failures.includes('pr_evidence_stale_head') ? 'stale' : 'current'}`,
  };
  const unsafe = scanObjectForUnsafe(blocks).length > 0;
  const status = failures.length || unsafe ? 'fail' : 'pass';
  return simpleStatus('prEvidenceRendererStatus', status, {
    reasonCodes: [...new Set([...(unsafe ? ['pr_evidence_render_failed'] : []), ...failures])],
    warnings,
    blocks,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = renderPrEvidenceBlocks();
  if (process.argv.includes('--write-artifact')) fs.writeFileSync('codex-pr-evidence-rendered.safe.json', JSON.stringify(report.prEvidenceRendererStatus.blocks, null, 2));
  writeJsonReport(report, 'CODEX_PR_EVIDENCE_RENDERER_REPORT');
  exitFor(report);
}
