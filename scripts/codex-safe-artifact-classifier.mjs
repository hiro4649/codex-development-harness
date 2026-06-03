#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

const CLASSES = new Set([
  'body_only_repair',
  'code_repair_required',
  'new_pr_required',
  'rerun_same_head_allowed',
  'merge_blocked_stale_evidence',
  'merge_blocked_missing_r3_confirmation',
  'remote_context_bug',
  'actions_queue_or_runner_issue',
  'auth_or_token_unavailable',
  'billing_or_spending_limit',
  'workflow_dispatch_not_pr_substitute',
  'product_verification_required',
  'runtime_readiness_not_proven',
]);

function parseInput(env = process.env) {
  try {
    return env.CODEX_SAFE_ARTIFACT_CLASSIFIER_INPUT ? JSON.parse(env.CODEX_SAFE_ARTIFACT_CLASSIFIER_INPUT) : {};
  } catch {
    return { parseFailed: true };
  }
}

function classify(input = parseInput()) {
  if (input.parseFailed) return { classification: 'new_pr_required', reasonCodes: ['safe_artifact_classification_failed'] };
  if (input.runtimeReadinessClaimed && !input.oraclePresent) return { classification: 'runtime_readiness_not_proven', reasonCodes: ['runtime_readiness_not_proven'] };
  if (input.staleEvidence || input.headShaMismatch) return { classification: 'merge_blocked_stale_evidence', reasonCodes: ['pr_evidence_stale_head'] };
  if (input.missingR3Confirmation || input.missingHumanConfirmation) return { classification: 'merge_blocked_missing_r3_confirmation', reasonCodes: ['pr_evidence_missing_human_confirmation'] };
  if (input.workflowDispatchOnly) return { classification: 'workflow_dispatch_not_pr_substitute', reasonCodes: ['workflow_dispatch_not_pr_substitute'] };
  if (input.authUnavailable) return { classification: 'auth_or_token_unavailable', reasonCodes: ['gh_auth_required_but_unavailable'] };
  if (input.billingUnavailable) return { classification: 'billing_or_spending_limit', reasonCodes: ['billing_or_spending_limit'] };
  if (input.actionsQueued || input.jobs === 0) return { classification: 'actions_queue_or_runner_issue', reasonCodes: ['actions_queue_or_runner_issue'] };
  if (input.remoteContextBug) return { classification: 'remote_context_bug', reasonCodes: ['remote_context_bug'] };
  if (input.productRelevantFailure) return { classification: 'product_verification_required', reasonCodes: ['product_verification_required'] };
  if (input.codeRepairRequired) return { classification: 'code_repair_required', reasonCodes: ['safe_artifact_classification_failed'] };
  if (input.bodyOnlyRepair) return { classification: 'body_only_repair', reasonCodes: ['evidence_auto_repair_hint_available'] };
  return { classification: 'rerun_same_head_allowed', reasonCodes: [] };
}

export function buildSafeArtifactClassifierReport(input = parseInput()) {
  const base = classify(input);
  const blockingReasonCodes = [...new Set(base.reasonCodes || [])];
  const nonBlockingWarnings = [
    ...(input.actionsQueued || input.jobs === 0 ? ['queued_or_jobs_zero'] : []),
    ...(input.workflowDispatchPassWithoutPrCheck ? ['workflow_dispatch_not_pr_substitute'] : []),
    ...(input.artifactApiUnavailable ? ['artifact_api_unavailable'] : []),
  ];
  const safeNextAction = input.safeNextAction || ({
    body_only_repair: 'Repair PR body evidence for the same head only.',
    code_repair_required: 'Fix the source harness issue and rerun checks.',
    new_pr_required: 'Open a new PR for changed scope.',
    rerun_same_head_allowed: 'Rerun the same head and inspect safe summary artifacts.',
    merge_blocked_stale_evidence: 'Regenerate evidence for the current head.',
    merge_blocked_missing_r3_confirmation: 'Add current-head R3 confirmation.',
    remote_context_bug: 'Rerun after remote context is available.',
    actions_queue_or_runner_issue: 'Wait for runner availability or rerun the workflow.',
    auth_or_token_unavailable: 'Restore required GitHub auth or switch to local-only verification.',
    billing_or_spending_limit: 'Resolve external account limit before remote verification.',
    workflow_dispatch_not_pr_substitute: 'Run the PR check on the PR head.',
    product_verification_required: 'Run required product verification before merge.',
    runtime_readiness_not_proven: 'Remove runtime readiness claim or provide an oracle.',
  })[base.classification];

  const unsafe = input.artifactUnsafe || input.rawLogIncluded || input.containsSecrets || scanObjectForUnsafe(input).length > 0;
  const contradictions = [
    ...(input.productRelevantFailure && base.classification === 'body_only_repair' ? ['safe_artifact_classification_failed'] : []),
    ...(input.runtimeReadinessClaimed && !input.oraclePresent ? ['runtime_readiness_not_proven'] : []),
    ...(!safeNextAction ? ['safe_artifact_next_action_missing'] : []),
  ];
  const status = unsafe || contradictions.length || !CLASSES.has(base.classification) ? 'fail' : 'pass';
  return simpleStatus('safeArtifactClassifierStatus', status, {
    classification: base.classification,
    safeNextAction: safeNextAction || '',
    blockingReasonCodes,
    nonBlockingWarnings,
    reasonCodes: [...new Set([...(unsafe ? ['safe_artifact_classification_failed'] : []), ...contradictions])],
    safeSummaryOnly: true,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildSafeArtifactClassifierReport();
  if (process.argv.includes('--write-artifact')) fs.writeFileSync('codex-safe-artifact-classification.safe.json', JSON.stringify(report.safeArtifactClassifierStatus, null, 2));
  writeJsonReport(report, 'CODEX_SAFE_ARTIFACT_CLASSIFIER_REPORT');
  exitFor(report);
}
