#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.8

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { pass, fail } from './codex-outcome-contract.mjs';

export const EVIDENCE_CAPSULE_VERSION = '1';

function notRequired(reason) {
  return {
    statusCode: 'not_required_with_reason',
    statusRole: 'non_load_bearing',
    reason,
    mergeConditionEligible: false,
    safeSummaryOnly: true,
  };
}

function requiredValue(value) {
  return value || 'needs_run';
}

export function buildEvidenceCapsule(input = {}) {
  const terminalAction = input.terminalAction || 'create_pr_only';
  const separateCiRequired = input.separateRequiredCiCheckExists === true;
  const headSha = input.headSha || input.head || process.env.CODEX_PR_HEAD_SHA || process.env.GITHUB_SHA || 'unknown';
  const qualityGateRunId = requiredValue(input.qualityGateRunId);
  const artifactPointer = input.artifactPointer || input.artifactName || input.artifactId || '';
  const artifactId = requiredValue(input.artifactId || artifactPointer);
  const artifactName = input.artifactName || null;
  const prHeadSha = input.prHeadSha || input.prHead || headSha;
  const workflowHeadSha = input.workflowHeadSha || input.workflowHead || headSha;
  const artifactHeadSha = input.artifactHeadSha || input.artifactHead || headSha;
  const ciRunId = separateCiRequired ? requiredValue(input.ciRunId) : notRequired('no_separate_required_ci_check');
  const remoteRequired = terminalAction === 'merge_current_pr';
  const fresh = headSha !== 'unknown' &&
    qualityGateRunId !== 'needs_run' &&
    artifactId !== 'needs_run' &&
    prHeadSha === headSha &&
    workflowHeadSha === headSha &&
    artifactHeadSha === headSha &&
    (!separateCiRequired || ciRunId !== 'needs_run');
  return {
    evidenceCapsuleVersion: EVIDENCE_CAPSULE_VERSION,
    evidenceModel: 'previous_head_committed_plus_current_head_artifact',
    terminalAction,
    headSha,
    committedEvidence: {
      role: 'intent_and_scope',
      mayReferencePreviousHead: true,
      mustNotPretendFutureCommitSha: true,
      machineMergeAuthority: false,
      safeSummaryOnly: true,
    },
    currentHeadEvidence: {
      role: 'merge_evidence',
      source: 'github_run_safe_artifact',
      mustBindHeadSha: true,
      machineMergeAuthority: true,
      headSha,
      qualityGateRunId,
      artifactId,
      artifactName,
      artifactPointer: artifactPointer || artifactId,
      prHeadSha,
      workflowHeadSha,
      artifactHeadSha,
      ciRunId,
      remoteRequired,
      safeSummaryOnly: true,
    },
    prBody: {
      role: 'human_render',
      machineEvidence: false,
      runIdExactMatchRequired: false,
      advisoryOnly: true,
      safeSummaryOnly: true,
    },
    freshnessTuple: {
      headSha,
      qualityGateRunId,
      artifactId,
      artifactPointer: artifactPointer || artifactId,
      ciRunId,
      safeSummaryOnly: true,
    },
    fresh,
    status: fresh || !remoteRequired ? 'pass' : 'needs_run',
    safeSummaryOnly: true,
  };
}

export function validateEvidenceCapsule(input = {}) {
  const capsule = input.evidenceCapsuleVersion ? input : buildEvidenceCapsule(input);
  const reasonCodes = [];
  if (capsule.evidenceCapsuleVersion !== EVIDENCE_CAPSULE_VERSION) reasonCodes.push('evidence_capsule_version_mismatch');
  if (capsule.committedEvidence?.machineMergeAuthority !== false) reasonCodes.push('committed_evidence_cannot_merge');
  if (capsule.committedEvidence?.mustNotPretendFutureCommitSha !== true) reasonCodes.push('committed_evidence_future_sha_forbidden');
  if (capsule.currentHeadEvidence?.machineMergeAuthority !== true) reasonCodes.push('current_head_artifact_required_for_merge');
  if (capsule.prBody?.machineEvidence !== false) reasonCodes.push('pr_body_not_machine_evidence');
  if (capsule.prBody?.runIdExactMatchRequired !== false) reasonCodes.push('pr_body_run_id_exact_match_advisory_only');
  if (capsule.currentHeadEvidence?.remoteRequired === true && capsule.fresh !== true) reasonCodes.push('current_head_artifact_required_for_merge_current_pr');
  if (capsule.currentHeadEvidence?.ciRunId === 'needs_run' && capsule.currentHeadEvidence?.remoteRequired === true) reasonCodes.push('ci_run_id_required_when_separate_ci_exists');
  return reasonCodes.length ? fail(reasonCodes, { evidenceCapsule: capsule }) : pass({ evidenceCapsule: capsule });
}

function readJson(file) {
  try {
    if (!file || !fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const input = process.argv[2] ? readJson(process.argv[2]) : {};
  const evidenceCapsule = buildEvidenceCapsule(input);
  const report = {
    evidenceCapsuleStatus: validateEvidenceCapsule(evidenceCapsule),
    evidenceCapsule,
    status: validateEvidenceCapsule(evidenceCapsule).status,
    safeSummaryOnly: true,
  };
  writeJsonReport(report, 'CODEX_EVIDENCE_CAPSULE_REPORT');
  exitFor(report);
}
