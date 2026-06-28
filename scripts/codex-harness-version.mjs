#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.3.1

export const currentVersion = '1.3.1';
export const previousVersion = '1.3.0';
export const previousSelfTestStatusKey = 'v130SelfTestStatus';
export const compatibilitySelfTestStatusKeys = ['v127SelfTestStatus', 'v128SelfTestStatus', 'v129SelfTestStatus'];
export const activeHarnessVersion = '1.3.1';
export const activeSelfTestStatusKey = 'v131SelfTestStatus';
export const activeSelfTestSuite = 'v131';
export const candidateHarnessVersion = '1.3.1';
export const candidateSelfTestStatusKey = 'v131SelfTestStatus';
export const candidateSelfTestSuite = 'v131';
export const candidateActivationState = 'active';
export const legacyAdvisorySuites = ['v127', 'v126', 'v125', 'v124', 'v123', 'v122', 'v121', 'v120', 'v119', 'v118', 'v117', 'v116', 'v115', 'v114', 'v113'];
export const knownVersions = ['1.0.3', '1.0.4', '1.0.5', '1.0.6', '1.0.7', '1.0.8', '1.0.9', '1.1.0', '1.1.1', '1.1.2', '1.1.3', '1.1.4', '1.1.5', '1.1.6', '1.1.7', '1.1.8', '1.1.9', '1.2.0', '1.2.1', '1.2.2', '1.2.3', '1.2.4', '1.2.5', '1.2.6', '1.2.7', '1.2.8', '1.2.9', '1.3.0', '1.3.1'];
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
  sourceActivation: 'active',
  operationalConvergence: 'active',
  shadowTargetCanary: 'not_required_for_v131_core_activation',
  activationReady: true,
  runtimeReadinessClaimed: false,
  productionReadinessClaimed: false,
  safeSummaryOnly: true,
  immediateRollback: '1.3.0',
  secondaryRollback: '1.2.9',
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
    legacyAdvisorySuites,
    knownVersions,
    versionLineagePolicy,
    safeSummaryOnly: true,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(buildHarnessVersionRegistry(), null, 2));
}
