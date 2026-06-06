#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.9

export const currentVersion = '1.0.9';
export const previousVersion = '1.0.8';
export const activeSelfTestStatusKey = 'v109SelfTestStatus';
export const activeSelfTestSuite = 'v109';
export const legacyAdvisorySuites = ['v108', 'v107', 'v106', 'v105', 'v104', 'v103'];
export const knownVersions = ['1.0.3', '1.0.4', '1.0.5', '1.0.6', '1.0.7', '1.0.8', '1.0.9'];
export const versionLineagePolicy = {
  sourceOnlyRelease: true,
  targetRollout: 'not_started',
  representativeLivePrValidation: 'not_started',
  representativeRealPrReplay: 'required',
  decisionLedger: 'required',
  evidenceConvergence: 'required',
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
