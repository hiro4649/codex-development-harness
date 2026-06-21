#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.2.8

import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const V128_STANDING_AUTONOMY_POLICY_PATH = 'docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json';

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function digestValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

export function digestV128StandingAutonomyPolicy(value) {
  return digestValue(value);
}

function digestFile(filePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function loadPolicy(policyPath = V128_STANDING_AUTONOMY_POLICY_PATH) {
  return JSON.parse(fs.readFileSync(policyPath, 'utf8'));
}

function hasForbiddenScope(input = {}) {
  return input.productCodeChanged === true
    || input.packageFilesChanged === true
    || input.workflowChanged === true
    || input.sourceActivationRequested === true
    || input.targetRolloutRequested === true
    || input.deployRequested === true
    || input.walletRpcRequested === true;
}

const TRUSTED_POLICY_SOURCES = new Set([
  'protected_default_branch_policy',
  'owner_signed_policy_bundle',
  'protected_repository_variable',
]);

const AUTOMATION_DISPOSITIONS = new Set([
  'auto_merge',
  'auto_repair',
  'auto_wait',
  'auto_process_base_pr',
  'auto_rebase',
  'auto_revalidate',
  'auto_reject',
  'auto_quarantine',
  'auto_ready',
]);

const TRUST_MISMATCH_REASON_CODES = new Set([
  'standing_policy_trusted_evaluator_mismatch',
  'standing_policy_trusted_verifier_bundle_mismatch',
  'standing_policy_trusted_provider_adapter_mismatch',
  'standing_policy_trusted_policy_mismatch',
  'standing_policy_trusted_scope_classifier_mismatch',
  'standing_policy_trusted_merge_executor_mismatch',
  'standing_policy_trusted_canonicalizer_mismatch',
  'standing_policy_trusted_final_decision_authority_mismatch',
  'standing_policy_repository_key_mismatch',
]);

const TRUST_MISSING_REASON_CODES = new Set([
  'standing_policy_trusted_policy_digest_missing',
  'standing_policy_trusted_evaluator_digest_missing',
  'standing_policy_trusted_verifier_bundle_digest_missing',
  'standing_policy_trusted_provider_adapter_digest_missing',
  'standing_policy_trusted_scope_classifier_digest_missing',
  'standing_policy_trusted_merge_executor_digest_missing',
  'standing_policy_trusted_canonicalizer_digest_missing',
  'standing_policy_trusted_final_decision_authority_digest_missing',
  'standing_policy_trust_source_invalid',
  'standing_policy_authority_epoch_missing',
  'standing_policy_trusted_authority_epoch_missing',
  'standing_policy_authority_epoch_mismatch',
  'standing_policy_revocation_nonce_missing',
  'standing_policy_trusted_revocation_nonce_missing',
  'standing_policy_revocation_nonce_mismatch',
  'standing_policy_repository_id_missing',
  'standing_policy_executor_unavailable',
]);

const REQUIRED_EVIDENCE = [
  'same_head_required_checks',
  'final_decision_pass',
  'v127_preservation_pass',
  'deterministic_verifier_pass',
  'scope_digest_match',
  'zero_unresolved_findings',
];

const SELF_AUTHORIZING_POLICY_FILES = new Set([
  'CODEX_SOURCE_HARNESS_MANIFEST.json',
  'docs/process/CODEX_V128_STANDING_AUTONOMY_POLICY.json',
  'docs/process/CODEX_HARNESS_MANIFEST.json',
  'docs/process/CODEX_ACTIVE_POLICY_INDEX.json',
  'docs/process/CODEX_V128_PRESERVATION_MATRIX.json',
  'docs/process/CODEX_V128_REASON_REGISTRY.json',
  'docs/process/CODEX_V128_STATE_MATRIX.json',
  'docs/process/CODEX_V128_CONTRACT_SCHEMA.json',
  'docs/process/CODEX_V128_SPEC.md',
  'scripts/codex-v128-standing-autonomy-policy.mjs',
  'scripts/codex-v128-trust-closure.mjs',
  'scripts/codex-v128-self-test.mjs',
  'scripts/codex-v128-validation-execution-plan.mjs',
  'scripts/codex-v128-integrity-lib.mjs',
  'scripts/codex-v128-projection-reader.mjs',
  'scripts/codex-v128-projection-reader-adapter.mjs',
  'scripts/codex-v128-managed-context-emitter.mjs',
  'scripts/codex-v128-managed-context-adapter.mjs',
  'scripts/codex-v128-state-matrix.mjs',
  'scripts/codex-v128-state-matrix-adapter.mjs',
  'scripts/codex-v128-aggregate-finalizer.mjs',
  'scripts/codex-v128-aggregate-finalizer-adapter.mjs',
  'scripts/codex-v128-invocation-ledger.mjs',
  'scripts/codex-local-quality-gate.mjs',
  'scripts/codex-workflow-quality-runner.mjs',
  'scripts/codex-final-decision-kernel.mjs',
  'scripts/codex-evidence-capsule.mjs',
  'scripts/codex-artifact-consistency-contract.mjs',
]);

function changedFiles(input = {}) {
  const files = input.changedFiles
    || input.report?.sourceHarnessValidationStatus?.changedFiles
    || [];
  return Array.isArray(files) ? files.map((item) => String(item).replace(/\\/g, '/')) : [];
}

function hasSelfAuthorizingChange(input = {}) {
  if (input.policySelfModification === true) return true;
  return changedFiles(input).some((file) => SELF_AUTHORIZING_POLICY_FILES.has(file));
}

function requiredEvidencePresent(policy = {}) {
  const values = new Set(Array.isArray(policy.requiredEvidence) ? policy.requiredEvidence : []);
  return REQUIRED_EVIDENCE.every((item) => values.has(item));
}

function automationDispositionFor(input = {}, blockingReasons = [], automatedMergeExecutionAllowed = false) {
  if (automatedMergeExecutionAllowed) return 'auto_merge';
  const prTopology = input.prTopology || {};
  if (hasForbiddenScope(input)) return 'auto_reject';
  if (input.policySelfModification === true
    || blockingReasons.includes('standing_policy_self_modification_forbidden')) return 'auto_quarantine';
  if (blockingReasons.some((reason) => TRUST_MISMATCH_REASON_CODES.has(reason))) return 'auto_quarantine';
  if (prTopology.stackedDependencyState && prTopology.stackedDependencyState !== 'not_stacked') return 'auto_process_base_pr';
  if (prTopology.prLifecycleState === 'draft') return input.technicalChecksReady === true ? 'auto_ready' : 'auto_wait';
  if (blockingReasons.includes('standing_policy_scope_forbidden')) return 'auto_reject';
  if (blockingReasons.some((reason) => TRUST_MISSING_REASON_CODES.has(reason))) return 'auto_wait';
  if (blockingReasons.includes('standing_policy_expected_head_cas_not_observed')
    || blockingReasons.includes('standing_policy_same_head_required_checks_required')) return 'auto_revalidate';
  if (blockingReasons.includes('standing_policy_final_decision_pass_required')
    || blockingReasons.includes('standing_policy_zero_unresolved_findings_required')) return 'auto_repair';
  return 'auto_wait';
}

export function evaluateV128StandingAutonomyPolicy(input = {}) {
  let policy = input.policy || null;
  const reasonCodes = [];
  try {
    policy ||= loadPolicy(input.policyPath);
  } catch {
    policy = null;
    reasonCodes.push('standing_policy_missing');
  }
  const policyDigest = policy ? digestValue(policy) : null;
  let evaluatorDigest = input.evaluatorDigest || null;
  try {
    evaluatorDigest ||= digestFile(fileURLToPath(import.meta.url));
  } catch {
    evaluatorDigest = null;
  }
  const trustedPolicyDigest = input.trustedPolicyDigest || process.env.CODEX_V128_TRUSTED_POLICY_DIGEST || null;
  const trustedEvaluatorDigest = input.trustedEvaluatorDigest || process.env.CODEX_V128_TRUSTED_EVALUATOR_DIGEST || null;
  const trustedVerifierBundleDigest = input.trustedVerifierBundleDigest || process.env.CODEX_V128_TRUSTED_VERIFIER_BUNDLE_DIGEST || null;
  const trustedProviderAdapterDigest = input.trustedProviderAdapterDigest || process.env.CODEX_V128_TRUSTED_PROVIDER_ADAPTER_DIGEST || null;
  const trustedScopeClassifierDigest = input.trustedScopeClassifierDigest || process.env.CODEX_V128_TRUSTED_SCOPE_CLASSIFIER_DIGEST || null;
  const trustedMergeExecutorDigest = input.trustedMergeExecutorDigest || process.env.CODEX_V128_TRUSTED_MERGE_EXECUTOR_DIGEST || null;
  const trustedCanonicalizerDigest = input.trustedCanonicalizerDigest || process.env.CODEX_V128_TRUSTED_CANONICALIZER_DIGEST || null;
  const trustedFinalDecisionAuthorityDigest = input.trustedFinalDecisionAuthorityDigest || process.env.CODEX_V128_TRUSTED_FINAL_DECISION_AUTHORITY_DIGEST || null;
  const trustedPolicySource = input.trustedPolicySource || process.env.CODEX_V128_TRUSTED_POLICY_SOURCE || null;
  const verifierBundleDigest = input.verifierBundleDigest || input.trustClosure?.trustDigests?.verifierBundleDigest || null;
  const providerAdapterDigest = input.providerAdapterDigest || input.trustClosure?.trustDigests?.providerAdapterDigest || null;
  const scopeClassifierDigest = input.scopeClassifierDigest || input.scopeEvidence?.classificationPolicyDigest || null;
  const mergeExecutorDigest = input.mergeExecutorDigest || input.automationExecutor?.executorDigest || null;
  const canonicalizerDigest = input.canonicalizerDigest || input.trustClosure?.trustDigests?.canonicalizerDigest || null;
  const finalDecisionAuthorityDigest = input.finalDecisionAuthorityDigest || input.trustClosure?.trustDigests?.finalDecisionAuthorityDigest || null;
  const authorityEpoch = input.authorityEpoch || process.env.CODEX_V128_AUTHORITY_EPOCH || null;
  const revocationNonce = input.revocationNonce || process.env.CODEX_V128_REVOCATION_NONCE || null;
  const repositoryId = input.repositoryId || process.env.CODEX_V128_REPOSITORY_ID || process.env.GITHUB_REPOSITORY_ID || null;
  const trustedAuthorityEpoch = input.trustedAuthorityEpoch || process.env.CODEX_V128_TRUSTED_AUTHORITY_EPOCH || null;
  const trustedRevocationNonce = input.trustedRevocationNonce || process.env.CODEX_V128_TRUSTED_REVOCATION_NONCE || null;
  const repositoryIdDigest = repositoryId ? digestValue({ repositoryId }) : null;
  const authorityEpochDigest = authorityEpoch ? digestValue({ authorityEpoch }) : null;
  const revocationNonceDigest = revocationNonce ? digestValue({ revocationNonce }) : null;
  const automationExecutor = input.automationExecutor || {};
  const automationExecutorAvailable = input.automationExecutorAvailable === true || automationExecutor.available === true;
  const automationActionStarted = input.automationActionStarted === true || automationExecutor.actionStarted === true;
  const automationActionCompleted = input.automationActionCompleted === true || automationExecutor.actionCompleted === true;
  const automationResultDigest = input.automationResultDigest || automationExecutor.resultDigest || null;
  const prTopology = input.prTopology || {};
  const report = input.report || {};
  const finalDecision = input.finalDecision || report.finalDecision || {};
  const policyValid = Boolean(policy)
    && policy.policyKind === 'standing_autonomy_policy_receipt'
    && policy.schemaVersion === '1.2.8'
    && policy.authoritySource === 'owner_defined_repository_policy'
    && policy.mergeExecution?.allowed === true
    && policy.aiAuthorityCreated === false;

  if (!policyValid) reasonCodes.push('standing_policy_invalid');
  if (!trustedPolicyDigest) reasonCodes.push('standing_policy_trusted_policy_digest_missing');
  else if (trustedPolicyDigest !== policyDigest) reasonCodes.push('standing_policy_trusted_policy_mismatch');
  if (!trustedEvaluatorDigest) reasonCodes.push('standing_policy_trusted_evaluator_digest_missing');
  else if (trustedEvaluatorDigest !== evaluatorDigest) reasonCodes.push('standing_policy_trusted_evaluator_mismatch');
  if (policy?.trustRoot?.trustedVerifierBundleDigestRequired === true) {
    if (!trustedVerifierBundleDigest) reasonCodes.push('standing_policy_trusted_verifier_bundle_digest_missing');
    else if (trustedVerifierBundleDigest !== verifierBundleDigest) reasonCodes.push('standing_policy_trusted_verifier_bundle_mismatch');
  }
  if (policy?.trustRoot?.trustedProviderAdapterDigestRequired === true) {
    if (!trustedProviderAdapterDigest) reasonCodes.push('standing_policy_trusted_provider_adapter_digest_missing');
    else if (trustedProviderAdapterDigest !== providerAdapterDigest) reasonCodes.push('standing_policy_trusted_provider_adapter_mismatch');
  }
  if (policy?.trustRoot?.trustedScopeClassifierDigestRequired === true) {
    if (!trustedScopeClassifierDigest) reasonCodes.push('standing_policy_trusted_scope_classifier_digest_missing');
    else if (trustedScopeClassifierDigest !== scopeClassifierDigest) reasonCodes.push('standing_policy_trusted_scope_classifier_mismatch');
  }
  if (policy?.trustRoot?.trustedMergeExecutorDigestRequired === true) {
    if (!trustedMergeExecutorDigest) reasonCodes.push('standing_policy_trusted_merge_executor_digest_missing');
    else if (trustedMergeExecutorDigest !== mergeExecutorDigest) reasonCodes.push('standing_policy_trusted_merge_executor_mismatch');
  }
  if (policy?.trustRoot?.trustedCanonicalizerDigestRequired === true) {
    if (!trustedCanonicalizerDigest) reasonCodes.push('standing_policy_trusted_canonicalizer_digest_missing');
    else if (trustedCanonicalizerDigest !== canonicalizerDigest) reasonCodes.push('standing_policy_trusted_canonicalizer_mismatch');
  }
  if (policy?.trustRoot?.trustedFinalDecisionAuthorityDigestRequired === true) {
    if (!trustedFinalDecisionAuthorityDigest) reasonCodes.push('standing_policy_trusted_final_decision_authority_digest_missing');
    else if (trustedFinalDecisionAuthorityDigest !== finalDecisionAuthorityDigest) reasonCodes.push('standing_policy_trusted_final_decision_authority_mismatch');
  }
  if (policy?.trustRoot?.authorityEpochRequired === true) {
    if (!authorityEpoch) reasonCodes.push('standing_policy_authority_epoch_missing');
    if (!trustedAuthorityEpoch) reasonCodes.push('standing_policy_trusted_authority_epoch_missing');
    else if (authorityEpoch !== trustedAuthorityEpoch) reasonCodes.push('standing_policy_authority_epoch_mismatch');
  }
  if (policy?.trustRoot?.revocationNonceRequired === true) {
    if (!revocationNonce) reasonCodes.push('standing_policy_revocation_nonce_missing');
    if (!trustedRevocationNonce) reasonCodes.push('standing_policy_trusted_revocation_nonce_missing');
    else if (revocationNonce !== trustedRevocationNonce) reasonCodes.push('standing_policy_revocation_nonce_mismatch');
  }
  if (!TRUSTED_POLICY_SOURCES.has(trustedPolicySource)) reasonCodes.push('standing_policy_trust_source_invalid');
  if (policy?.repositoryKey && !input.repositoryKey) reasonCodes.push('standing_policy_repository_key_missing');
  if (policy?.repositoryKey && input.repositoryKey && policy.repositoryKey !== input.repositoryKey) reasonCodes.push('standing_policy_repository_key_mismatch');
  if (policy?.trustRoot?.repositoryIdRequired === true && !repositoryId) reasonCodes.push('standing_policy_repository_id_missing');
  if (!requiredEvidencePresent(policy || {})) reasonCodes.push('standing_policy_required_evidence_incomplete');
  if (policy?.forbiddenAuthorizations?.includes('source_activation') !== true) reasonCodes.push('standing_policy_activation_forbidden_boundary_missing');
  if (policy?.forbiddenAuthorizations?.includes('target_rollout') !== true) reasonCodes.push('standing_policy_target_rollout_boundary_missing');
  if (policy?.forbiddenAuthorizations?.includes('github_approval_review') !== true) reasonCodes.push('standing_policy_approval_review_boundary_missing');
  if (policy?.forbiddenAuthorizations?.includes('self_approval') !== true) reasonCodes.push('standing_policy_self_approval_boundary_missing');
  if (hasSelfAuthorizingChange(input)) reasonCodes.push('standing_policy_self_modification_forbidden');

  const technicalChecksReady = input.technicalChecksReady === true || report.technicalChecksReady === true;
  const deterministicVerifierPass = input.deterministicVerifierPass === true
    || (report.routineDecisionProjectionStatus?.status === 'pass'
      && report.validationExecutionPlanReuseInternalStatus?.status !== 'fail');
  const zeroUnresolvedFindings = input.zeroUnresolvedFindings === true
    || Number(input.blockingCount ?? report.reasonSummaryStatus?.summary?.blockingReasons?.length ?? 0) === 0;
  const harnessOnlyScope = input.harnessOnlyScope === true || (
    report.productCodeChanged !== true
    && report.packageOrLockfileChanged !== true
    && report.packageFilesChanged !== true
  );
  const finalDecisionPass = finalDecision.terminalAction === 'merge_current_pr'
    && finalDecision.decision === 'allowed'
    && finalDecision.mergeAllowed === true
    && finalDecision.exitCode === 0
    && finalDecision.safeNextAction !== 'repair_harness_only';

  if (prTopology.baseRefKind !== 'default_branch') reasonCodes.push('standing_policy_default_base_required');
  if (prTopology.prLifecycleState !== 'open') reasonCodes.push('standing_policy_open_pr_required');
  if (prTopology.stackedDependencyState && prTopology.stackedDependencyState !== 'not_stacked') reasonCodes.push('standing_policy_stacked_pr_forbidden');
  if (!technicalChecksReady) reasonCodes.push('standing_policy_technical_checks_required');
  if (input.sameHeadRequiredChecksPass !== true) reasonCodes.push('standing_policy_same_head_required_checks_required');
  if (!finalDecisionPass) reasonCodes.push('standing_policy_final_decision_pass_required');
  if (!deterministicVerifierPass) reasonCodes.push('standing_policy_deterministic_verifier_required');
  if (input.v127PreservationPass !== true && report.v127SelfTestStatus?.status !== 'pass') reasonCodes.push('standing_policy_v127_preservation_required');
  if (input.scopeDigestMatch !== true) reasonCodes.push('standing_policy_scope_digest_match_required');
  if (!zeroUnresolvedFindings) reasonCodes.push('standing_policy_zero_unresolved_findings_required');
  if (!harnessOnlyScope || hasForbiddenScope(input)) reasonCodes.push('standing_policy_scope_forbidden');
  if (policy?.mergeExecution?.expectedHeadCasRequired !== true) reasonCodes.push('standing_policy_expected_head_cas_required');
  if (input.expectedHeadCasReady !== true) reasonCodes.push('standing_policy_expected_head_cas_not_observed');
  if (!automationExecutorAvailable) reasonCodes.push('standing_policy_executor_unavailable');
  if (policy?.mergeExecution?.baseMustBeDefaultBranch !== true) reasonCodes.push('standing_policy_default_branch_contract_missing');
  if (policy?.mergeExecution?.stackedPrForbidden !== true) reasonCodes.push('standing_policy_stacked_contract_missing');
  if (policy?.mergeExecution?.draftForbidden !== true) reasonCodes.push('standing_policy_draft_contract_missing');

  const blockingReasons = [...new Set(reasonCodes)];
  const automatedMergeExecutionAllowed = policyValid && blockingReasons.length === 0 && automationExecutorAvailable;
  const policyAuthorizationState = automatedMergeExecutionAllowed ? 'authorized' : 'not_eligible';
  const automationDisposition = automationDispositionFor(input, blockingReasons, automatedMergeExecutionAllowed);
  return {
    schemaVersion: '1.2.8',
    policyKind: 'standing_autonomy_policy_receipt',
    policyId: policy?.policyId || 'missing',
    policyDigest,
    evaluatorDigest,
    verifierBundleDigest,
    providerAdapterDigest,
    trustedPolicySource,
    scopeClassifierDigest,
    mergeExecutorDigest,
    canonicalizerDigest,
    finalDecisionAuthorityDigest,
    authorityEpochPresent: Boolean(authorityEpoch),
    revocationNoncePresent: Boolean(revocationNonce),
    authorityEpochDigest,
    revocationNonceDigest,
    authorizationContextDigest: digestValue({
      policyDigest,
      evaluatorDigest,
      verifierBundleDigest,
      providerAdapterDigest,
      scopeClassifierDigest,
      mergeExecutorDigest,
      canonicalizerDigest,
      finalDecisionAuthorityDigest,
      repositoryKey: input.repositoryKey || null,
      repositoryIdDigest,
      authorityEpochDigest,
      revocationNonceDigest,
    }),
    repositoryIdDigest,
    policyAuthorizationState,
    automationDisposition,
    automationExecutorAvailable,
    automationActionStarted,
    automationActionCompleted,
    automationResultDigest,
    humanPerPrDecisionRequired: false,
    automatedMergeExecutionAllowed,
    deterministicVerifierRequired: true,
    aiAuthorityCreated: false,
    ownerAuthorityCreated: false,
    sourceActivationAuthorized: false,
    targetRolloutAuthorized: false,
    reasonCodes: blockingReasons,
    safeSummaryOnly: true,
  };
}

export function validateV128StandingAutonomyPolicyEvaluation(evaluation = {}) {
  const reasons = [];
  if (evaluation.schemaVersion !== '1.2.8') reasons.push('standing_policy_eval_schema_invalid');
  if (evaluation.policyKind !== 'standing_autonomy_policy_receipt') reasons.push('standing_policy_eval_kind_invalid');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(evaluation.policyDigest || ''))) reasons.push('standing_policy_digest_invalid');
  if (evaluation.verifierBundleDigest && !/^sha256:[a-f0-9]{64}$/.test(String(evaluation.verifierBundleDigest))) reasons.push('standing_policy_verifier_bundle_digest_invalid');
  if (evaluation.providerAdapterDigest && !/^sha256:[a-f0-9]{64}$/.test(String(evaluation.providerAdapterDigest))) reasons.push('standing_policy_provider_adapter_digest_invalid');
  if (evaluation.scopeClassifierDigest && !/^sha256:[a-f0-9]{64}$/.test(String(evaluation.scopeClassifierDigest))) reasons.push('standing_policy_scope_classifier_digest_invalid');
  if (evaluation.mergeExecutorDigest && !/^sha256:[a-f0-9]{64}$/.test(String(evaluation.mergeExecutorDigest))) reasons.push('standing_policy_merge_executor_digest_invalid');
  if (evaluation.canonicalizerDigest && !/^sha256:[a-f0-9]{64}$/.test(String(evaluation.canonicalizerDigest))) reasons.push('standing_policy_canonicalizer_digest_invalid');
  if (evaluation.finalDecisionAuthorityDigest && !/^sha256:[a-f0-9]{64}$/.test(String(evaluation.finalDecisionAuthorityDigest))) reasons.push('standing_policy_final_decision_authority_digest_invalid');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(evaluation.authorizationContextDigest || ''))) reasons.push('standing_policy_authorization_context_digest_invalid');
  if (evaluation.aiAuthorityCreated !== false) reasons.push('standing_policy_ai_authority_forbidden');
  if (evaluation.ownerAuthorityCreated !== false) reasons.push('standing_policy_owner_authority_forbidden');
  if (evaluation.sourceActivationAuthorized === true) reasons.push('standing_policy_source_activation_forbidden');
  if (evaluation.targetRolloutAuthorized === true) reasons.push('standing_policy_target_rollout_forbidden');
  if (!['authorized', 'not_eligible'].includes(evaluation.policyAuthorizationState)) reasons.push('standing_policy_authorization_state_invalid');
  if (!AUTOMATION_DISPOSITIONS.has(evaluation.automationDisposition)) reasons.push('standing_policy_automation_disposition_invalid');
  if (evaluation.automatedMergeExecutionAllowed === true && evaluation.automationExecutorAvailable !== true) reasons.push('standing_policy_auto_merge_requires_executor');
  if (evaluation.automationResultDigest && !/^sha256:[a-f0-9]{64}$/.test(String(evaluation.automationResultDigest))) reasons.push('standing_policy_automation_result_digest_invalid');
  if (evaluation.automatedMergeExecutionAllowed === true && evaluation.policyAuthorizationState !== 'authorized') reasons.push('standing_policy_auto_merge_requires_authorized_state');
  if (evaluation.automatedMergeExecutionAllowed === true && evaluation.automationDisposition !== 'auto_merge') reasons.push('standing_policy_auto_merge_requires_auto_merge_disposition');
  if (evaluation.automatedMergeExecutionAllowed !== true && evaluation.policyAuthorizationState === 'authorized') reasons.push('standing_policy_authorized_state_requires_auto_merge');
  if (evaluation.automatedMergeExecutionAllowed === true && evaluation.humanPerPrDecisionRequired === true) reasons.push('standing_policy_auto_merge_cannot_require_per_pr_human');
  if (evaluation.automatedMergeExecutionAllowed === true && (evaluation.reasonCodes || []).length > 0) reasons.push('standing_policy_auto_merge_requires_no_blockers');
  return reasons.length ? { status: 'fail', reasonCodes: reasons, safeSummaryOnly: true } : {
    status: 'pass',
    policyAuthorizationState: evaluation.policyAuthorizationState,
    automationDisposition: evaluation.automationDisposition,
    automatedMergeExecutionAllowed: evaluation.automatedMergeExecutionAllowed === true,
    humanPerPrDecisionRequired: evaluation.humanPerPrDecisionRequired === true,
    automationExecutorAvailable: evaluation.automationExecutorAvailable === true,
    automationActionStarted: evaluation.automationActionStarted === true,
    automationActionCompleted: evaluation.automationActionCompleted === true,
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && process.argv[1].endsWith('codex-v128-standing-autonomy-policy.mjs')) {
  const evaluation = evaluateV128StandingAutonomyPolicy();
  const validation = validateV128StandingAutonomyPolicyEvaluation(evaluation);
  process.stdout.write(`${canonicalJson({ evaluation, validation })}\n`);
  process.exit(validation.status === 'pass' ? 0 : 1);
}
