#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.9

export const currentVersion = '1.2.9';
export const previousVersion = '1.2.8';
export const previousSelfTestStatusKey = 'v128SelfTestStatus';
export const compatibilitySelfTestStatusKeys = ['v127SelfTestStatus', 'v128SelfTestStatus'];
export const activeHarnessVersion = '1.2.9';
export const activeSelfTestStatusKey = 'v129SelfTestStatus';
export const activeSelfTestSuite = 'v129';
export const candidateHarnessVersion = '1.2.9';
export const candidateSelfTestStatusKey = 'v129SelfTestStatus';
export const candidateSelfTestSuite = 'v129';
export const candidateActivationState = 'active';
export const legacyAdvisorySuites = ['v127', 'v126', 'v125', 'v124', 'v123', 'v122', 'v121', 'v120', 'v119', 'v118', 'v117', 'v116', 'v115', 'v114', 'v113'];
export const knownVersions = ['1.0.3', '1.0.4', '1.0.5', '1.0.6', '1.0.7', '1.0.8', '1.0.9', '1.1.0', '1.1.1', '1.1.2', '1.1.3', '1.1.4', '1.1.5', '1.1.6', '1.1.7', '1.1.8', '1.1.9', '1.2.0', '1.2.1', '1.2.2', '1.2.3', '1.2.4', '1.2.5', '1.2.6', '1.2.7', '1.2.8', '1.2.9'];
export const versionLineagePolicy = {
  sourceOnlyRelease: true,
  targetRollout: 'completed',
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
  shadowTargetCanary: 'passed',
  activationReady: true,
  runtimeReadinessClaimed: false,
  productionReadinessClaimed: false,
  safeSummaryOnly: true,
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
