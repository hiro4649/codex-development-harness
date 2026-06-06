#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.9

import { MARKER, HARNESS_VERSION, buildStatus } from './codex-status-taxonomy.mjs';

export const EVIDENCE_CLASSES = [
  'harness_rollout',
  'harness_repair',
  'product_pr',
  'docs_only',
  'body_only_governance',
  'runtime_candidate',
  'manual_gate_candidate',
  'terminal_blocked',
  'main_reflection_candidate',
  'inventory_reduction',
];

export const LANES = [
  'harness_only',
  'product_scope',
  'docs_only',
  'body_only',
  'review_governance',
  'runtime_blocked',
  'production_blocked',
  'manual_gate_blocked',
  'terminal_no_action',
];

export const REQUIRED_DECISION_LEDGER_FIELDS = [
  'decisionLedgerVersion',
  'repo',
  'prNumber',
  'currentHeadSha',
  'baseSha',
  'activeHarnessVersion',
  'targetHarnessVersion',
  'evidenceSchemaVersion',
  'profileTemplateVersion',
  'futureHarnessArtifact',
  'upgradePath',
  'evidenceClass',
  'lane',
  'qualityGateStatus',
  'sameHeadRequiredChecksStatus',
  'independentReviewStatus',
  'reviewEvidenceProtocolStatus',
  'runtimeAllowed',
  'productionAllowed',
  'mergeAllowed',
  'hardBlocker',
  'nonOverridableBlockers',
  'codexCanSatisfy',
  'ownerCanSatisfy',
  'oneSafeNextAction',
  'allowedFiles',
  'forbiddenFiles',
  'safeSummaryOnly',
];

export function buildDecisionLedger(input = {}) {
  const qualityGatePass = input.qualityGateStatus === 'pass';
  const sameHeadPass = input.sameHeadRequiredChecksStatus === 'pass';
  const independentReviewPass = input.independentReviewStatus === 'pass';
  const reviewProtocolPass = input.reviewEvidenceProtocolStatus === 'pass';
  const runtimeAllowed = Boolean(input.runtimeAllowed && input.explicitRuntimeLaneEvidence);
  const productionAllowed = Boolean(input.productionAllowed && input.explicitProductionGoPackage);
  const nonOverridableBlockers = [
    ...(input.nonOverridableBlockers || []),
    ...(input.rawLogsRequested ? ['raw_logs_forbidden'] : []),
    ...(input.productCodeChanged ? ['product_code_changed'] : []),
  ];
  const mergeAllowed = Boolean(
    qualityGatePass &&
    sameHeadPass &&
    independentReviewPass &&
    reviewProtocolPass &&
    nonOverridableBlockers.length === 0 &&
    !input.writerOnlyReview &&
    !input.botOnlyReview &&
    !input.staleReview,
  );
  const hardBlocker = input.hardBlocker ||
    (nonOverridableBlockers[0] || (!sameHeadPass ? 'required_check_closure_blocked' : (!independentReviewPass ? 'independent_review_absent' : null)));

  return {
    marker: MARKER,
    decisionLedgerVersion: '1.0.9',
    repo: input.repo || 'source-harness',
    prNumber: input.prNumber ?? null,
    currentHeadSha: input.currentHeadSha || 'current_pr_head',
    baseSha: input.baseSha || 'base_head',
    activeHarnessVersion: input.activeHarnessVersion || '1.0.8',
    targetHarnessVersion: input.targetHarnessVersion || HARNESS_VERSION,
    evidenceSchemaVersion: input.evidenceSchemaVersion || 5,
    profileTemplateVersion: input.profileTemplateVersion || HARNESS_VERSION,
    futureHarnessArtifact: Boolean(input.futureHarnessArtifact),
    upgradePath: input.upgradePath || 'direct_v108_to_v109',
    evidenceClass: EVIDENCE_CLASSES.includes(input.evidenceClass) ? input.evidenceClass : 'harness_rollout',
    lane: LANES.includes(input.lane) ? input.lane : 'harness_only',
    qualityGateStatus: input.qualityGateStatus || 'not_run',
    sameHeadRequiredChecksStatus: input.sameHeadRequiredChecksStatus || 'not_run',
    independentReviewStatus: reviewEvidenceStatus(input),
    reviewEvidenceProtocolStatus: input.reviewEvidenceProtocolStatus || 'not_run',
    runtimeAllowed,
    productionAllowed,
    mergeAllowed,
    hardBlocker,
    nonOverridableBlockers,
    codexCanSatisfy: Boolean(input.codexCanSatisfy && !nonOverridableBlockers.length),
    ownerCanSatisfy: Boolean(input.ownerCanSatisfy),
    oneSafeNextAction: input.oneSafeNextAction || (mergeAllowed ? 'verify_same_head_before_merge' : 'emit_decision_ledger_safe_summary'),
    allowedFiles: input.allowedFiles || ['scripts/codex-*', 'docs/process/**', 'AGENTS.md'],
    forbiddenFiles: input.forbiddenFiles || ['src/**', 'apps/**', 'contracts/**', 'package.json', 'package-lock.json', '.env*'],
    safeSummaryOnly: true,
  };
}

export function validateDecisionLedger(ledger = {}) {
  const missing = REQUIRED_DECISION_LEDGER_FIELDS.filter((field) => !(field in ledger));
  const reasonCodes = [];
  if (missing.length) reasonCodes.push('decision_ledger_required_field_missing');
  if (!EVIDENCE_CLASSES.includes(ledger.evidenceClass)) reasonCodes.push('decision_ledger_evidence_class_invalid');
  if (!LANES.includes(ledger.lane)) reasonCodes.push('decision_ledger_lane_invalid');
  if (ledger.qualityGateStatus === 'pass' && ledger.sameHeadRequiredChecksStatus !== 'pass' && ledger.mergeAllowed) {
    reasonCodes.push('quality_gate_pass_alone_cannot_merge');
  }
  if (ledger.runtimeAllowed && !ledger.explicitRuntimeLaneEvidence) {
    // Ledger intentionally omits raw runtime evidence; runtimeAllowed must already be false by builder.
  }
  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    missingFields: missing,
    safeSummaryOnly: true,
  };
}

export function buildGateLedger(decisionLedger = {}) {
  const mergeBlocked = !decisionLedger.mergeAllowed;
  const runtimeBlocked = !decisionLedger.runtimeAllowed;
  const productionBlocked = !decisionLedger.productionAllowed;
  return {
    marker: MARKER,
    gateLedgerVersion: '1.0.9',
    mergeCritical: group(mergeBlocked ? 'blocked' : 'pass', mergeBlocked, ['same_head_required_checks_required'], 'verify_same_head_required_checks'),
    productEvidence: group('pass', false, ['product_code_change_not_required'], 'continue_source_harness_validation'),
    reviewEvidence: group(decisionLedger.independentReviewStatus === 'pass' ? 'pass' : 'blocked', decisionLedger.independentReviewStatus !== 'pass', ['independent_review_required'], 'collect_independent_review_evidence'),
    runtimeBoundary: group(runtimeBlocked ? 'blocked' : 'pass', runtimeBlocked, ['runtime_allowed_false_by_default'], 'do_not_execute_runtime'),
    productionBoundary: group(productionBlocked ? 'blocked' : 'pass', productionBlocked, ['production_allowed_false_by_default'], 'do_not_claim_production_readiness'),
    manualGateBoundary: group(decisionLedger.lane === 'manual_gate_blocked' ? 'blocked' : 'not_applicable_for_lane', decisionLedger.lane === 'manual_gate_blocked', ['manual_gate_not_implemented'], 'emit_manual_gate_candidate_summary'),
    advisoryOrNotApplicable: group('pass', false, ['advisory_outputs_not_authority'], 'use_parent_thread_final_authority'),
    safeSummaryOnly: true,
  };
}

function group(status, blocking, reasonCodes, nextSafeAction) {
  return { status, blocking, reasonCodes, evidenceConsumed: [], safeSummary: { safeSummaryOnly: true }, nextSafeAction };
}

export function buildDecisionLedgerStatus(input = {}) {
  const ledger = buildDecisionLedger(input);
  const validation = validateDecisionLedger(ledger);
  return {
    ...buildStatus('decisionLedgerStatus', validation.status, { reasonCodes: validation.reasonCodes, safeSummary: { mergeAllowed: ledger.mergeAllowed } }),
    ...buildStatus('gateLedgerStatus', validation.status, { reasonCodes: validation.reasonCodes, safeSummary: { groups: Object.keys(buildGateLedger(ledger)).length - 2 } }),
  };
}

export function reviewEvidenceStatus(input = {}) {
  if (input.reviewRequestOnly) return 'request_only';
  if (input.writerOnlyReview) return 'writer_only_blocked';
  if (input.botOnlyReview) return 'bot_only_blocked';
  if (input.staleReview) return 'stale_review';
  return input.independentReviewStatus || 'not_run';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify({ ledger: buildDecisionLedger({ qualityGateStatus: 'pass', sameHeadRequiredChecksStatus: 'fail' }), statuses: buildDecisionLedgerStatus({ qualityGateStatus: 'pass', sameHeadRequiredChecksStatus: 'fail' }), safeSummaryOnly: true }, null, 2));
}
