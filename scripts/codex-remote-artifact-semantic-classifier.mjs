#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.9

import { buildStatus } from './codex-status-taxonomy.mjs';

export const REMOTE_ARTIFACT_FAILURE_CLASSES = [
  'body_metadata_parser_failure',
  'stale_pr_audit_failure',
  'remote_npm_cwd_failure',
  'remote_npm_artifact_shape_failure',
  'remote_npm_execution_missing',
  'manual_gate_missing',
  'same_head_mismatch',
  'required_check_failure',
  'safe_artifact_missing',
  'external_runner_metadata_limited',
  'formal_evidence_precedence_conflict',
  'unknown_safe_metadata_limited',
];

export const TRIAGE_CLASSES = [
  'body_governance_failure',
  'profile_inference_failure',
  'remote_evidence_missing',
  'remote_evidence_normalization_failure',
  'legacy_fixture_drift',
  'child_timeout',
  'json_report_contract_failure',
  'actual_product_failure',
  'harness_wiring_failure',
  'external_runner_failure',
  'manual_gate_absent',
  'review_evidence_absent',
  'terminal_no_action',
];

export function classifyRemoteArtifactFailure(input = {}) {
  let failureClass = input.failureClass;
  if (!REMOTE_ARTIFACT_FAILURE_CLASSES.includes(failureClass)) {
    if (input.safeArtifactMissing) failureClass = 'safe_artifact_missing';
    else if (input.sameHeadMismatch) failureClass = 'same_head_mismatch';
    else if (input.remoteNpmCwdFailure) failureClass = 'remote_npm_cwd_failure';
    else if (input.manualGateMissing) failureClass = 'manual_gate_missing';
    else if (input.externalRunnerMetadataLimited) failureClass = 'external_runner_metadata_limited';
    else failureClass = 'unknown_safe_metadata_limited';
  }
  return {
    status: failureClass === 'unknown_safe_metadata_limited' ? 'blocked' : 'classified',
    failureClass,
    safeReasonCode: failureClass,
    rawLogsNeeded: false,
    nextSafeAction: failureClass === 'safe_artifact_missing' ? 'terminal_block_until_safe_artifact_or_state_delta' : 'emit_safe_repair_plan',
    safeSummaryOnly: true,
  };
}

export function triageFailure(input = {}) {
  let primaryClass = input.primaryClass;
  if (!TRIAGE_CLASSES.includes(primaryClass)) {
    if (input.rawLogsNeeded) primaryClass = 'terminal_no_action';
    else if (input.reviewEvidenceAbsent) primaryClass = 'review_evidence_absent';
    else if (input.manualGateAbsent) primaryClass = 'manual_gate_absent';
    else if (input.externalRunnerFailure) primaryClass = 'external_runner_failure';
    else if (input.productCodeFailure) primaryClass = 'actual_product_failure';
    else if (input.harnessWiringFailure) primaryClass = 'harness_wiring_failure';
    else primaryClass = 'terminal_no_action';
  }
  return { status: 'classified', primaryClass, rawLogsNeeded: false, safeSummaryOnly: true };
}

export function buildRemoteArtifactClassifierStatuses(input = {}) {
  const remote = classifyRemoteArtifactFailure(input);
  const triage = triageFailure(input);
  return {
    ...buildStatus('remoteArtifactSemanticClassifierStatus', 'pass', { reasonCodes: [remote.safeReasonCode], safeSummary: { failureClass: remote.failureClass } }),
    ...buildStatus('failureTriageEngineStatus', 'pass', { reasonCodes: [triage.primaryClass], safeSummary: { primaryClass: triage.primaryClass } }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(classifyRemoteArtifactFailure({ safeArtifactMissing: true }), null, 2));
}
