#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.6

import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { fail, pass } from './codex-decision-capsule.mjs';

export const EVIDENCE_PRECEDENCE = [
  'current_head_path_detail_artifact',
  'current_head_safe_artifact_index',
  'decision_capsule',
  'remote_evidence_state',
  'diagnostic_consolidated_safe_summary',
  'env_json_summary',
  'pr_body',
];

export const REMOTE_EVIDENCE_STATES = new Set([
  'not_required',
  'required_pending',
  'executed_artifact_missing',
  'executed_diagnostic_missing',
  'executed_failed',
  'executed_pass_normalized',
  'stale_head',
  'normalization_mismatch',
  'safe_summary_missing',
  'decision_capsule_missing',
  'artifact_index_missing',
  'artifact_upload_contract_failed',
  'summary_picker_incompatible',
  'remote_metadata_only_blocked',
  'safe_detail_unavailable_terminal',
]);

export function classifyRemoteEvidenceState(input = {}) {
  if (input.notRequired === true) return 'not_required';
  if (input.pending === true) return 'required_pending';
  if (input.staleHead === true) return 'stale_head';
  if (input.decisionCapsuleMissing === true) return 'decision_capsule_missing';
  if (input.artifactIndexMissing === true) return 'artifact_index_missing';
  if (input.safeSummaryMissing === true) return 'safe_summary_missing';
  if (input.artifactUploadContractFailed === true) return 'artifact_upload_contract_failed';
  if (input.summaryPickerIncompatible === true) return 'summary_picker_incompatible';
  if (input.normalizationMismatch === true) return 'normalization_mismatch';
  if (input.diagnosticMissing === true) return 'executed_diagnostic_missing';
  if (input.artifactMissing === true) return 'executed_artifact_missing';
  if (input.metadataOnly === true) return 'remote_metadata_only_blocked';
  if (input.failed === true && input.safeDetailUnavailable === true) return 'safe_detail_unavailable_terminal';
  if (input.failed === true) return 'executed_failed';
  if (input.pass === true && input.normalized === true) return 'executed_pass_normalized';
  return 'required_pending';
}

export function validateRemoteEvidenceState(input = {}) {
  const state = input.state || classifyRemoteEvidenceState(input);
  if (!REMOTE_EVIDENCE_STATES.has(state)) return fail('remote_evidence_state_unknown', { state });
  if (state === 'stale_head') return fail('stale_path_artifact', { state });
  if ([
    'executed_failed',
    'normalization_mismatch',
    'executed_artifact_missing',
    'executed_diagnostic_missing',
    'summary_picker_incompatible',
    'remote_metadata_only_blocked',
    'decision_capsule_missing',
    'artifact_index_missing',
    'safe_summary_missing',
    'artifact_upload_contract_failed',
    'safe_detail_unavailable_terminal',
  ].includes(state)) return fail(state, { state, manualBlocking: true });
  return pass({ state });
}

export function chooseEvidence(input = {}) {
  const candidates = EVIDENCE_PRECEDENCE.map((kind) => input[kind]).filter(Boolean);
  const current = candidates.find((item) => item.currentHead === true && item.status === 'pass');
  if (current) return pass({ selected: current.kind || current.source || 'current_head_path_detail_artifact' });
  const stale = candidates.find((item) => item.currentHead === false);
  if (stale) return fail('stale_path_artifact', { selected: stale.kind || stale.source || 'stale' });
  const loadBearingMissing = candidates.find((item) => item.loadBearing === true && item.status === 'missing');
  if (loadBearingMissing) return fail('missing_load_bearing_artifact', { selected: loadBearingMissing.kind || loadBearingMissing.source });
  const capsule = input.decision_capsule;
  if (capsule) return pass({ selected: 'decision_capsule' });
  if (input.pr_body?.machineEvidence === true) return fail('pr_body_not_machine_source');
  return fail('missing_load_bearing_artifact');
}

export function validateEvidencePrecedence(input = {}) {
  if (input.rawArtifactRead === true || input.rawLogsRead === true) return fail('raw_evidence_read');
  if (input.localEvidenceSatisfiesRemote === true) return fail('local_evidence_cannot_satisfy_remote');
  if (input.prBodySatisfiesRemote === true) return fail('pr_body_cannot_satisfy_remote_evidence');
  return chooseEvidence(input);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = {
    evidencePrecedenceKernelStatus: validateEvidencePrecedence({
      decision_capsule: { status: 'pass', currentHead: true, source: 'decision_capsule' },
    }),
    remoteEvidenceStateV2Status: validateRemoteEvidenceState({ notRequired: true }),
    safeSummaryOnly: true,
  };
  report.status = Object.values(report).some((item) => item?.status === 'fail') ? 'fail' : 'pass';
  writeJsonReport(report, 'CODEX_V116_EVIDENCE_PRECEDENCE_REPORT');
  exitFor(report);
}
