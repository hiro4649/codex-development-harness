#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.2

export const currentVersion = '1.1.2';
export const previousVersion = '1.1.1';
export const activeSelfTestStatusKey = 'v112SelfTestStatus';
export const activeSelfTestSuite = 'v112';
export const legacyAdvisorySuites = ['v111', 'v110', 'v109', 'v108', 'v107', 'v106', 'v105', 'v104', 'v103'];
export const knownVersions = ['1.0.3', '1.0.4', '1.0.5', '1.0.6', '1.0.7', '1.0.8', '1.0.9', '1.1.0', '1.1.1', '1.1.2'];
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
  runtimeReadinessClaimed: false,
  productionReadinessClaimed: false,
  safeSummaryOnly: true,
};

export function buildHarnessVersionRegistry() {
  return {
    currentVersion,
    previousVersion,
    activeSelfTestStatusKey,
    activeSelfTestSuite,
    legacyAdvisorySuites,
    knownVersions,
    versionLineagePolicy,
    safeSummaryOnly: true,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(buildHarnessVersionRegistry(), null, 2));
}
