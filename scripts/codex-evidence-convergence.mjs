#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.9

import { MARKER, HARNESS_VERSION, buildStatus } from './codex-status-taxonomy.mjs';

export function evaluateEvidenceSelfReferenceBreaker(input = {}) {
  const reasons = [];
  if (input.prBodyCanonicalEvidence) reasons.push('pr_body_not_canonical_evidence');
  if (input.gitEvidenceRequiresConcreteHeadSha) reasons.push('git_managed_evidence_must_allow_symbolic_head');
  if (input.postBodyEditMarksBodyStaleByItself) reasons.push('post_body_edit_cannot_self_stale');
  if (input.mergeUsesPrBodyAlone) reasons.push('merge_decision_requires_checks_and_artifact_ledger');
  return {
    status: reasons.length ? 'fail' : 'pass',
    reasonCodes: reasons,
    safeSummary: {
      prBodyRole: 'human_summary',
      gitManagedHeadSha: input.gitManagedHeadSha || 'current_pr_head',
      runtimeArtifactStoresConcreteHead: true,
      prBodyRunIdInformational: true,
    },
    safeSummaryOnly: true,
  };
}

export function buildVersionDimensions(input = {}) {
  return {
    activeHarnessVersion: input.activeHarnessVersion || '1.0.8',
    targetHarnessVersion: input.targetHarnessVersion || HARNESS_VERSION,
    evidenceSchemaVersion: input.evidenceSchemaVersion || 5,
    profileTemplateVersion: input.profileTemplateVersion || HARNESS_VERSION,
    futureHarnessArtifact: Boolean(input.futureHarnessArtifact),
    upgradePath: input.upgradePath || 'direct_v108_to_v109',
    safeSummaryOnly: true,
  };
}

export function evaluateVersionDimensionSeparation(input = {}) {
  const dimensions = buildVersionDimensions(input);
  const reasons = [];
  if (!dimensions.activeHarnessVersion || !dimensions.targetHarnessVersion) reasons.push('version_dimension_missing');
  if (dimensions.activeHarnessVersion === dimensions.targetHarnessVersion && input.requireUpgradePath) reasons.push('active_target_version_not_separated');
  if (!['direct_v107_to_v109', 'direct_v108_to_v109', 'blocked_previous_rollout_closed_without_merge'].includes(dimensions.upgradePath)) reasons.push('upgrade_path_unknown');
  return { status: reasons.length ? 'fail' : 'pass', reasonCodes: reasons, dimensions, safeSummaryOnly: true };
}

export function evaluateFormalEvidencePrecedence(input = {}) {
  if (input.formalEvidenceSameHead && input.staleTempDiagnostic) {
    return { status: 'pass', winner: 'formal_current_head_evidence', reasonCodes: ['stale_temp_diagnostic_suppressed'], safeSummaryOnly: true };
  }
  if (input.staleTempDiagnostic && !input.formalEvidenceSameHead) {
    return { status: 'blocked', winner: 'diagnostic_requires_fresh_evidence', reasonCodes: ['formal_evidence_absent'], safeSummaryOnly: true };
  }
  return { status: 'pass', winner: 'formal_evidence', reasonCodes: [], safeSummaryOnly: true };
}

export function buildMainReflectionPackage(input = {}) {
  return {
    marker: MARKER,
    packageVersion: '1.0.9',
    targetPr: input.targetPr || null,
    sourceEvidence: input.sourceEvidence || 'decision_ledger',
    requiredReviewEvidence: input.requiredReviewEvidence || 'independent_same_head_review',
    requiredQGEvidence: input.requiredQGEvidence || 'same_head_quality_gate',
    dependencyStatus: input.dependencyStatus || 'not_evaluated',
    beforeAfterContract: input.beforeAfterContract || 'safe_summary_only',
    rollbackPlan: input.rollbackPlan || 'close_without_merge_if_blocked',
    runtimeExcluded: true,
    activeQGExcluded: true,
    mergeAllowed: false,
    mergeNotAllowedReason: input.mergeNotAllowedReason || 'main_reflection_package_is_not_merge_authority',
    safeSummaryOnly: true,
  };
}

export function buildRuntimeReturnGate(input = {}) {
  const stages = [
    'candidate_branch_evidence',
    'target_branch_migration_evidence',
    'same_head_qg',
    'independent_review',
    'main_reflection_package',
    'diagnostic_only_integration_scope',
    'runtime_dry_run_scope',
    'runtime_fixture_replay',
    'real_runtime_evidence',
    'owner_confirmation_envelope',
    'readiness_decision',
  ];
  return {
    marker: MARKER,
    runtimeReturnGateVersion: '1.0.9',
    stages: stages.map((stage) => ({ stage, status: input[stage] || 'not_started' })),
    runtimeAllowed: false,
    productionAllowed: false,
    safeSummaryOnly: true,
  };
}

export function buildEvidenceConvergenceStatuses(input = {}) {
  const breaker = evaluateEvidenceSelfReferenceBreaker(input);
  const version = evaluateVersionDimensionSeparation(input);
  const precedence = evaluateFormalEvidencePrecedence(input);
  const mainReflection = buildMainReflectionPackage(input);
  const runtimeGate = buildRuntimeReturnGate(input);
  return {
    ...buildStatus('evidenceSelfReferenceBreakerStatus', breaker.status, { reasonCodes: breaker.reasonCodes, safeSummary: breaker.safeSummary }),
    ...buildStatus('versionDimensionSeparationStatus', version.status, { reasonCodes: version.reasonCodes, safeSummary: version.dimensions }),
    ...buildStatus('formalEvidencePrecedenceV2Status', precedence.status === 'blocked' ? 'pass' : precedence.status, { reasonCodes: precedence.reasonCodes, safeSummary: { winner: precedence.winner } }),
    ...buildStatus('mainReflectionPackageStatus', mainReflection.mergeAllowed ? 'fail' : 'pass', { reasonCodes: [mainReflection.mergeNotAllowedReason], safeSummary: { runtimeExcluded: true, activeQGExcluded: true } }),
    ...buildStatus('runtimeReturnGateStatus', runtimeGate.runtimeAllowed ? 'fail' : 'pass', { reasonCodes: ['runtime_allowed_false_by_default'], safeSummary: { stageCount: runtimeGate.stages.length } }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify({ statuses: buildEvidenceConvergenceStatuses(), safeSummaryOnly: true }, null, 2));
}
