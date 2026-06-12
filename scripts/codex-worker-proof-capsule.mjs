#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.9

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { pass, fail } from './codex-outcome-contract.mjs';

const VALID_PROOF_REASONS = new Set(['docs_only', 'harness_metadata', 'test_only', 'runtime_affecting', 'external_provider', 'deploy_sensitive', 'restricted_asset_sensitive']);
const VALID_LIVE_STATUSES = new Set(['pass', 'fail', 'not_required_with_reason', 'blocked_owner_scope', 'waived_explicitly']);
const VALID_SPECIALIST_REVIEW_STATUSES = new Set(['pass', 'fail', 'not_required_with_reason', 'needs_review', 'blocked_owner_scope']);
const CONCRETE_FINDING_CLASSES = new Set(['concrete_machine_blocker', 'spec_violation', 'scope_violation', 'test_failure']);

function list(values = [], limit = 50) {
  return Array.isArray(values) ? values.slice(0, limit).map(String) : [];
}

export function buildWorkerProofCapsule(input = {}) {
  const changedFiles = list(input.changedFiles, 50);
  const findings = list(input.specialistFindings || input.findings, 8);
  const acceptedFindings = list(input.acceptedFindings, 8);
  return {
    workerProofVersion: '1',
    workerId: input.workerId || 'single_worker',
    repo: input.repo || 'hiro4649/codex-development-harness',
    headSha: input.headSha || null,
    changedFiles,
    changedFilesListedCount: changedFiles.length,
    changedFilesTruncated: Array.isArray(input.changedFiles) && input.changedFiles.length > changedFiles.length,
    proofRequirement: {
      liveProofRequired: input.liveProofRequired === true,
      reason: input.proofReason || 'harness_metadata',
      waiverAllowed: input.waiverAllowed === true,
      waiverExplicit: input.waiverExplicit === true,
    },
    testEvidence: {
      focusedTests: input.focusedTests || 'needs_run',
      fullTests: input.fullTests || 'not_required_with_reason',
      ci: input.ci || 'needs_run',
    },
    liveProof: {
      status: input.liveProofStatus || 'not_required_with_reason',
      proofType: input.proofType || 'none',
      proofObserved: 'safe_summary_only',
      rawLogsRead: false,
    },
    reviewChain: {
      selfReviewStatus: input.selfReviewStatus || 'not_required_with_reason',
      specComplianceReviewStatus: input.specComplianceReviewStatus || 'not_required_with_reason',
      codeQualityReviewStatus: input.codeQualityReviewStatus || 'not_required_with_reason',
      finalReviewStatus: input.finalReviewStatus || 'not_required_with_reason',
      sameWorkerSelfReviewCanPass: false,
      fixIterations: Number(input.fixIterations || 0),
      sameFailureRepeated: input.sameFailureRepeated === true,
    },
    specialistReview: {
      status: input.specialistReviewStatus || 'not_required_with_reason',
      reviewerRole: input.reviewerRole || 'specialist_review_agent',
      findings,
      acceptedFindings,
      rejectedFindings: list(input.rejectedFindings, 8),
      findingClasses: list(input.findingClasses, 8),
      repairIterations: Number(input.repairIterations || 0),
      repairIterationId: input.repairIterationId || null,
      sameFailureRepeated: input.sameFailureRepeated === true,
      primaryClassHistory: list(input.primaryClassHistory, 2),
      reviewHeadSha: input.reviewHeadSha || input.headSha || null,
      lastRepairHeadSha: input.lastRepairHeadSha || null,
      focusedValidationCommand: input.focusedValidationCommand || 'not_required_with_reason',
      forbiddenScopeDetected: input.forbiddenScopeDetected === true,
      testsWorsened: input.testsWorsened === true,
      usesOnlySafeArtifacts: input.usesOnlySafeArtifacts !== false,
      rawLogsRead: false,
    },
    missingProofReason: input.missingProofReason || 'not_required_with_reason',
    waiverStatus: input.waiverExplicit === true ? 'waived_explicitly' : 'not_required_with_reason',
    safeNextAction: input.safeNextAction || 'run_required_validation_or_owner_decision',
    rawLogsRead: false,
    eightSessionUsed: false,
    safeSummaryOnly: true,
  };
}

export function validateWorkerProofCapsule(capsule = {}) {
  const reasons = [];
  const proofRequirement = capsule.proofRequirement || {};
  const liveProof = capsule.liveProof || {};
  const reviewChain = capsule.reviewChain || {};
  const specialistReview = capsule.specialistReview || {};
  if (!VALID_PROOF_REASONS.has(proofRequirement.reason)) reasons.push('proof_requirement_reason_invalid');
  if (!VALID_LIVE_STATUSES.has(liveProof.status)) reasons.push('live_proof_status_invalid');
  if (specialistReview.status && !VALID_SPECIALIST_REVIEW_STATUSES.has(specialistReview.status)) reasons.push('specialist_review_status_invalid');
  if (proofRequirement.reason === 'runtime_affecting' && proofRequirement.liveProofRequired !== true) reasons.push('runtime_affecting_change_requires_live_proof');
  if (['docs_only', 'harness_metadata'].includes(proofRequirement.reason) && proofRequirement.liveProofRequired === true) reasons.push('docs_or_harness_metadata_live_proof_not_required');
  if (proofRequirement.reason === 'external_provider' && !['blocked_owner_scope', 'waived_explicitly', 'pass'].includes(liveProof.status)) reasons.push('external_provider_live_proof_requires_owner_scope_or_waiver');
  if (['deploy_sensitive', 'restricted_asset_sensitive'].includes(proofRequirement.reason) && liveProof.status === 'pass') reasons.push('wallet_rpc_deploy_live_proof_attempt_blocked_without_owner_scope');
  if (reviewChain.sameWorkerSelfReviewCanPass !== false) reasons.push('self_review_cannot_pass_review_chain_alone');
  if (reviewChain.finalReviewStatus === 'pass' && (reviewChain.specComplianceReviewStatus !== 'pass' || reviewChain.codeQualityReviewStatus !== 'pass')) reasons.push('spec_and_quality_review_required_for_implementation');
  if (specialistReview.usesOnlySafeArtifacts !== true) reasons.push('specialist_review_requires_safe_artifacts_only');
  if (specialistReview.rawLogsRead === true) reasons.push('raw_logs_forbidden_in_specialist_review');
  if (specialistReview.status === 'pass' && capsule.headSha && specialistReview.reviewHeadSha && specialistReview.reviewHeadSha !== capsule.headSha) reasons.push('specialist_review_head_must_match_current_head');
  if (Number(specialistReview.repairIterations || 0) > 2) reasons.push('auto_repair_iteration_limit_exceeded');
  if (specialistReview.sameFailureRepeated === true && Number(specialistReview.repairIterations || 0) >= 2) reasons.push('auto_repair_stops_after_same_primary_class_twice');
  if ((specialistReview.acceptedFindings || []).length && !(specialistReview.findingClasses || []).some((item) => CONCRETE_FINDING_CLASSES.has(item))) reasons.push('review_findings_must_be_concrete_for_auto_repair');
  if (Number(specialistReview.repairIterations || 0) > 0 && !specialistReview.repairIterationId) reasons.push('auto_repair_requires_repair_iteration_id');
  if (Number(specialistReview.repairIterations || 0) > 0 && !specialistReview.lastRepairHeadSha) reasons.push('auto_repair_requires_last_repair_head');
  if (Number(specialistReview.repairIterations || 0) > 0 && !specialistReview.focusedValidationCommand) reasons.push('auto_repair_requires_focused_validation_path');
  if (specialistReview.forbiddenScopeDetected === true) reasons.push('auto_repair_blocks_on_package_lockfile_runtime_secret_deploy_scope');
  if (specialistReview.testsWorsened === true) reasons.push('auto_repair_stops_when_tests_worsen');
  if (capsule.rawLogsRead === true) reasons.push('raw_logs_forbidden_in_worker_proof');
  return reasons.length ? fail(reasons) : pass({ changedFilesListedCount: capsule.changedFilesListedCount || 0 });
}

export function buildWorkerProofReport(input = {}) {
  const capsule = buildWorkerProofCapsule(input);
  const workerProofStatus = validateWorkerProofCapsule(capsule);
  const reviewChain = capsule.reviewChain || {};
  const specialistReview = capsule.specialistReview || {};
  const reviewOk = reviewChain.finalReviewStatus === 'pass'
    ? (reviewChain.specComplianceReviewStatus === 'pass' && reviewChain.codeQualityReviewStatus === 'pass')
    : reviewChain.finalReviewStatus === 'not_required_with_reason';
  return {
    workerProofCapsule: capsule,
    workerProofStatus,
    reviewChainStatus: reviewOk ? pass({ finalReviewStatus: reviewChain.finalReviewStatus }) : fail('review_chain_incomplete'),
    specialistReviewStatus: specialistReview.status === 'fail' ? fail('specialist_review_failed') : pass({ status: specialistReview.status }),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildWorkerProofReport();
  if (process.env.CODEX_WORKER_PROOF_CAPSULE_PATH) {
    fs.writeFileSync(process.env.CODEX_WORKER_PROOF_CAPSULE_PATH, JSON.stringify(report.workerProofCapsule, null, 2));
  }
  const status = report.workerProofStatus.status === 'pass' && report.reviewChainStatus.status === 'pass' ? 'pass' : 'fail';
  writeJsonReport({ ...report, status, safeSummaryOnly: true }, 'CODEX_WORKER_PROOF_REPORT');
  exitFor({ status });
}
