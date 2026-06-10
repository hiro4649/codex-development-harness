#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.7

import { fileURLToPath } from 'node:url';
import { writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { pass, fail, buildDefaultOutcomeContract, validateOutcomeContract } from './codex-outcome-contract.mjs';
import {
  buildArtifactConsistencyReport,
  validateDeltaOnlyFinalizer,
} from './codex-artifact-consistency-contract.mjs';
import { validateSafeFailureReader } from './codex-read-safe-failure.mjs';
import { buildTokenHardBudgetStatus, validateHardSafetyClaims } from './codex-decision-capsule.mjs';

export const HARNESS_VERSION = '1.1.7';
export const OPERATOR_STATUS_KEYS = [
  'decisionCapsuleAuthorityStatus',
  'outcomeContractStatus',
  'verifierCapsuleStatus',
  'artifactConsistencyStatus',
  'deltaOnlyFinalizerStatus',
  'safeFailureReaderStatus',
];

export function buildDecisionCapsuleV117(input = {}) {
  const sameHead = input.sameHeadRequiredChecks || {};
  const mergeAllowed = input.mergeAllowed === true
    && sameHead.sameHead === true
    && sameHead.allPass === true
    && (input.ownerMergeInstruction === true || input.ownerMergeScope === true);
  return {
    harnessVersion: HARNESS_VERSION,
    head: input.head || input.headSha || sameHead.headSha || 'unknown',
    decision: input.decision || (mergeAllowed ? 'allowed' : 'blocked'),
    primaryClass: input.primaryClass || 'owner_decision_required',
    primaryBlocker: input.primaryBlocker || input.primaryClass || 'owner_decision_required',
    mergeAllowed,
    repairType: input.repairType || 'external_confirmation_required',
    safeNextAction: input.safeNextAction || (mergeAllowed ? 'owner_authorized_merge_after_same_head_checks' : 'owner_decision_or_state_delta'),
    sameHeadRequiredChecks: {
      sameHead: sameHead.sameHead !== false,
      allPass: sameHead.allPass === true,
      headSha: sameHead.headSha || input.head || input.headSha || 'unknown',
    },
    detailsRef: input.detailsRef || 'codex-decision-capsule.safe.json',
    rawLogsRead: false,
    eightSessionUsed: false,
    safeSummaryOnly: true,
  };
}

export function validateDecisionCapsuleAuthority(input = {}) {
  const capsule = input.harnessVersion ? input : buildDecisionCapsuleV117(input);
  const required = ['harnessVersion', 'head', 'decision', 'primaryClass', 'primaryBlocker', 'mergeAllowed', 'repairType', 'safeNextAction', 'detailsRef'];
  const reasonCodes = [];
  for (const field of required) if (capsule[field] === undefined || capsule[field] === '') reasonCodes.push('decision_capsule_required_field_missing');
  if (capsule.harnessVersion !== HARNESS_VERSION) reasonCodes.push('decision_capsule_version_mismatch');
  if (capsule.decision === 'allowed' && capsule.mergeAllowed !== true) reasonCodes.push('allowed_with_merge_false');
  if (capsule.mergeAllowed === true && capsule.decision !== 'allowed') reasonCodes.push('merge_allowed_requires_allowed_decision');
  if (capsule.sameHeadRequiredChecks?.sameHead === false) reasonCodes.push('same_head_required_checks_failed');
  if (capsule.rawLogsRead !== false) reasonCodes.push('raw_logs_read');
  if (capsule.eightSessionUsed !== false) reasonCodes.push('eight_session_used');
  if (input.prBodyMachineEvidence === true) reasonCodes.push('pr_body_not_machine_evidence');
  if (input.legacyShadowAttemptsHide === true) reasonCodes.push('true_blocker_not_shadowable');
  return reasonCodes.length ? fail(reasonCodes, { decisionCapsule: capsule }) : pass({ decisionCapsule: capsule });
}

export function buildDefaultVerifierCapsule(input = {}) {
  const checkedCriteriaCount = Number(input.checkedCriteriaCount ?? 9);
  const failedCriteria = Array.isArray(input.failedCriteria) ? input.failedCriteria : [];
  return {
    verifierCapsuleVersion: '1',
    verifierMode: input.verifierMode || 'independent_context_required_for_merge_consideration',
    sameAgentSelfCritiqueAllowed: input.sameAgentSelfCritiqueAllowed ?? true,
    sameAgentSelfCritiqueCanPass: input.sameAgentSelfCritiqueCanPass ?? false,
    verifierIndependenceEvidence: {
      sameProcess: input.sameProcess ?? true,
      samePromptContext: input.samePromptContext ?? (input.actorIsolation === false),
      usesOnlyDecisionCapsuleAndArtifacts: input.usesOnlyDecisionCapsuleAndArtifacts ?? true,
      usesImplementationNarrative: input.usesImplementationNarrative ?? false,
      ...(input.verifierIndependenceEvidence || {}),
    },
    rubricId: input.rubricId || 'HARNESS_SOURCE_BODY_V117',
    implementationHead: input.implementationHead || input.head || 'unknown',
    checkedCriteriaCount,
    passedCriteriaCount: Number(input.passedCriteriaCount ?? (checkedCriteriaCount - failedCriteria.length)),
    failedCriteria,
    rawLogsRead: input.rawLogsRead === true,
    eightSessionUsed: input.eightSessionUsed === true,
    verifierDecision: input.verifierDecision || (failedCriteria.length ? 'blocked' : 'pass'),
    mergeAllowedByVerifier: false,
    ownerMergeInstructionRequired: true,
  };
}

export function validateVerifierCapsule(input = {}, context = {}) {
  const capsule = input.verifierCapsuleVersion ? input : buildDefaultVerifierCapsule(input);
  const evidence = capsule.verifierIndependenceEvidence || {};
  const reasonCodes = [];
  if (capsule.verifierCapsuleVersion !== '1') reasonCodes.push('verifier_version_mismatch');
  if (capsule.verifierMode !== 'independent_context_required_for_merge_consideration') reasonCodes.push('verifier_independent_context_required');
  if (capsule.sameAgentSelfCritiqueCanPass !== false) reasonCodes.push('same_agent_self_critique_cannot_pass');
  if (evidence.samePromptContext !== false) reasonCodes.push('verifier_same_prompt_context_forbidden');
  if (evidence.usesOnlyDecisionCapsuleAndArtifacts !== true) reasonCodes.push('verifier_must_use_only_capsule_and_artifacts');
  if (evidence.usesImplementationNarrative !== false) reasonCodes.push('verifier_implementation_narrative_forbidden');
  if (capsule.rawLogsRead !== false) reasonCodes.push('raw_logs_read');
  if (capsule.eightSessionUsed !== false) reasonCodes.push('eight_session_used');
  if (capsule.mergeAllowedByVerifier !== false) reasonCodes.push('verifier_cannot_grant_merge');
  if (capsule.ownerMergeInstructionRequired !== true) reasonCodes.push('verifier_owner_merge_instruction_required');
  if (context.sameHeadRequiredChecks?.allPass === false && capsule.mergeAllowedByVerifier === true) reasonCodes.push('verifier_cannot_override_same_head_fail');
  if (context.ownerMergeInstruction === false && capsule.mergeAllowedByVerifier === true) reasonCodes.push('verifier_cannot_override_owner_merge_missing');
  return reasonCodes.length ? fail(reasonCodes, { verifierCapsule: capsule }) : pass({ verifierCapsule: capsule });
}

export function validateBoundaryProfileFixture(input = {}) {
  const hasPolicyIds = Array.isArray(input.policyIds) && input.policyIds.length > 0;
  if (!input.boundaryProfile && !hasPolicyIds) return fail('unknown_boundary_profile');
  if (!hasPolicyIds && (!Array.isArray(input.forbiddenScopeIds) || !input.forbiddenScopeIds.length)) return fail('boundary_profile_forbidden_scope_ids_required');
  if (Number(input.repeatedForbiddenTextCount || 0) > 0) return fail('boundary_profile_repeated_forbidden_text');
  if (input.summaryOnly === true) return fail('summary_only_boundary_profile');
  return pass({ machineOnly: true });
}

export function validateScopeGrantFixture(input = {}) {
  if (Array.isArray(input.grantedScopes) && input.grantedScopes.includes('target_rollout')) {
    return fail('scope_grant_matrix_overgrant', { grantedScopes: input.grantedScopes });
  }
  if (input.requestedScope && Array.isArray(input.grantedScopes) && input.grantedScopes.includes(input.requestedScope)) {
    return pass({ fixtureOnly: true });
  }
  const doesNotGrant = new Set(input.doesNotGrant || []);
  const requiredDenials = ['merge_readiness', 'runtime_readiness', 'production_readiness'];
  const missing = requiredDenials.filter((item) => !doesNotGrant.has(item));
  return missing.length ? fail('scope_grant_matrix_overgrant', { missing }) : pass({ fixtureOnly: true });
}

export function validateLegacyCompressionFixture(input = {}) {
  if (input.trueBlocker === true && input.shadowAttemptsHide === true) return fail('true_blocker_not_shadowed');
  return pass({ legacyCompatibility: 'count-only', fixtureOnly: true });
}

export function buildV117Report(input = {}) {
  const head = input.head || input.headSha || 'unknown';
  const decisionCapsule = buildDecisionCapsuleV117({ head, ...input });
  const decisionCapsuleAuthorityStatus = validateDecisionCapsuleAuthority({
    ...decisionCapsule,
    prBodyMachineEvidence: input.prBodyMachineEvidence,
    legacyShadowAttemptsHide: input.legacyShadowAttemptsHide,
  });
  const outcomeContractStatus = validateOutcomeContract(input.outcomeContract || buildDefaultOutcomeContract());
  const verifierCapsuleStatus = validateVerifierCapsule(input.verifierCapsule || buildDefaultVerifierCapsule({ head }), {
    sameHeadRequiredChecks: input.sameHeadRequiredChecks || { allPass: true },
    ownerMergeInstruction: input.ownerMergeInstruction ?? true,
  });
  const artifactReport = buildArtifactConsistencyReport({ head, artifacts: input.artifacts });
  const artifactConsistencyStatus = artifactReport.artifactConsistencyStatus;
  const deltaOnlyFinalizerStatus = validateDeltaOnlyFinalizer({
    head,
    primaryClass: decisionCapsule.primaryClass,
    mergeAllowed: decisionCapsule.mergeAllowed,
    rawLogsRead: false,
    productCodeChanged: false,
    packageLockfileChanged: false,
    workflowChanged: input.workflowChanged === true,
    runtimeReadinessClaimed: false,
    productionReadinessClaimed: false,
    safeNextAction: decisionCapsule.safeNextAction,
    passStatusListPrinted: false,
    legacyStatusListPrinted: false,
    fullJsonStdout: false,
  });
  const safetyStatus = validateHardSafetyClaims(input.safetyClaims || {});
  const safeFailureReaderBase = validateSafeFailureReader({ rawLogFallbackAttempted: input.rawLogFallbackAttempted === true });
  const safeFailureReaderStatus = safetyStatus.status === 'fail'
    ? fail(safetyStatus.reasonCodes, { source: 'hard_safety_claims' })
    : safeFailureReaderBase;
  const tokenBudgetStatus = buildTokenHardBudgetStatus(input.tokenBudget || { operatorVisibleStatuses: OPERATOR_STATUS_KEYS.length, safeArtifactReads: 2 });
  const validationFastPathStatus = input.fastPathEligible === true ? pass({ fixtureOnly: true }) : pass({ fixtureOnly: true, fastPathEligible: false });
  const verifiedMemoryRulesStatus = input.memoryConsulted === true ? pass({ fixtureOnly: true, memoryConsulted: true }) : pass({ fixtureOnly: true, memoryConsulted: false });
  const repairExperimentLedgerStatus = pass({ fixtureOnly: true, repairExperimentCount: Number(input.repairExperimentCount || 0) });
  const statuses = {
    decisionCapsuleAuthorityStatus,
    outcomeContractStatus,
    verifierCapsuleStatus,
    artifactConsistencyStatus,
    deltaOnlyFinalizerStatus,
    safeFailureReaderStatus,
  };
  const failed = [...Object.values(statuses), tokenBudgetStatus].some((value) => value.status === 'fail');
  return {
    v117SelfTestStatus: pass({ version: HARNESS_VERSION }),
    ...statuses,
    tokenBudgetStatus,
    validationFastPathStatus,
    verifiedMemoryRulesStatus,
    repairExperimentLedgerStatus,
    decisionCapsule,
    outcomeContract: outcomeContractStatus.outcomeContract,
    verifierCapsule: verifierCapsuleStatus.verifierCapsule,
    artifactConsistency: artifactReport,
    operatorVisibleStatuses: OPERATOR_STATUS_KEYS,
    operatorVisibleStatusCount: OPERATOR_STATUS_KEYS.length,
    p1p2OperatorVisibleExpansion: false,
    rawLogsRead: false,
    eightSessionUsed: false,
    walletRpcDeployAccess: false,
    status: failed ? 'fail' : 'pass',
    safeSummaryOnly: true,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildV117Report();
  writeJsonReport(report, 'CODEX_VERIFIER_CAPSULE_REPORT');
  if (!process.env.CODEX_VERIFIER_CAPSULE_REPORT && process.env.CODEX_QUALITY_REPORT !== 'json') {
    console.log(`verifierCapsuleStatus: ${report.verifierCapsuleStatus.status}`);
  }
  exitFor(report);
}
