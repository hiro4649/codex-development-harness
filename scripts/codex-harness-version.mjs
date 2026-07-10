#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.2

export const currentVersion = '1.3.2';
export const previousVersion = '1.3.1';
export const previousSelfTestStatusKey = 'v131SelfTestStatus';
export const compatibilitySelfTestStatusKeys = ['v127SelfTestStatus', 'v128SelfTestStatus', 'v129SelfTestStatus', 'v130SelfTestStatus'];
export const activeHarnessVersion = '1.3.2';
export const activeSelfTestStatusKey = 'v132SelfTestStatus';
export const activeSelfTestSuite = 'v132';
export const candidateHarnessVersion = '1.3.2';
export const candidateSelfTestStatusKey = 'v132SelfTestStatus';
export const candidateSelfTestSuite = 'v132';
export const candidateActivationState = 'local_source_candidate';
export const sourceActivation = 'forbidden_until_v131_main_and_exact_head_remote_pass';
export const versionAuthority = Object.freeze({
  v132: 'local_source_candidate',
  v131: 'immediate_rollback',
  v130: 'secondary_rollback',
  v129: 'emergency_legacy_rollback',
  v128: 'blocking_compatibility',
  v127: 'readable_compatibility',
});
export const legacyAdvisorySuites = ['v127', 'v126', 'v125', 'v124', 'v123', 'v122', 'v121', 'v120', 'v119', 'v118', 'v117', 'v116', 'v115', 'v114', 'v113'];
export const knownVersions = ['1.0.3', '1.0.4', '1.0.5', '1.0.6', '1.0.7', '1.0.8', '1.0.9', '1.1.0', '1.1.1', '1.1.2', '1.1.3', '1.1.4', '1.1.5', '1.1.6', '1.1.7', '1.1.8', '1.1.9', '1.2.0', '1.2.1', '1.2.2', '1.2.3', '1.2.4', '1.2.5', '1.2.6', '1.2.7', '1.2.8', '1.2.9', '1.3.0', '1.3.1', '1.3.2'];
export const versionLineagePolicy = {
  sourceOnlyRelease: true,
  targetRollout: 'not_started',
  representativeLivePrValidation: 'not_started',
  representativeRealPrReplay: 'required',
  decisionLedger: 'required',
  evidenceConvergence: 'required',
  tokenEconomy: 'required',
  operationalClosure: 'required',
  tokenHardCap: 'required',
  contextCapsule: 'required',
  failureClosure: 'required',
  conversationSurfaceMinimization: 'required',
  evidenceFidelity: 'required',
  minimalSurface: 'required',
  fastGates: 'required',
  typedDecisions: 'required',
  compatibilityProof: 'required',
  observedStateBridgeSafeLoopRuntime: 'required',
  contextSlimSkillValidationRouting: 'required',
  receiptCarriedContinuation: 'required',
  decisionEvidenceCompression: 'required',
  validationDagEvidenceReuse: 'required',
  ownerInterruptTokenBudget: 'required',
  blockerClosureProductValuePressure: 'required',
  deterministicDecisionProjection: 'active_required',
  orthogonalReasonModel: 'active_required',
  tokenMinimalReadCompatibilityRouter: 'active_required',
  resumableLoopPermissionProjection: 'active_required',
  sourceActivation: 'forbidden_until_v131_main_and_exact_head_remote_pass',
  operationalConvergence: 'active_rollback',
  evidenceConvergedLeanCore: 'local_source_candidate',
  shadowTargetCanary: 'not_started_for_v132_local_candidate',
  activationReady: false,
  runtimeReadinessClaimed: false,
  productionReadinessClaimed: false,
  safeSummaryOnly: true,
  immediateRollback: '1.3.1',
  secondaryRollback: '1.3.0',
  emergencyLegacyRollback: '1.2.9',
  blockingCompatibility: '1.2.8',
  readableCompatibility: '1.2.7',
  performanceTrack: 'non_authoritative',
  superiorityClaimState: 'not_proven',
};

export function buildHarnessVersionRegistry() {
  return {
    currentVersion,
    previousVersion,
    previousSelfTestStatusKey,
    activeHarnessVersion,
    activeSelfTestStatusKey,
    activeSelfTestSuite,
    candidateHarnessVersion,
    candidateSelfTestStatusKey,
    candidateSelfTestSuite,
    candidateActivationState,
    sourceActivation,
    versionAuthority,
    legacyAdvisorySuites,
    knownVersions,
    versionLineagePolicy,
    safeSummaryOnly: true,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(buildHarnessVersionRegistry(), null, 2));
}
