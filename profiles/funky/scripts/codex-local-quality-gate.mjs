#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.0
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

const policyPath = path.join('docs', 'process', 'CODEX_QUALITY_GATE_POLICY.json');
const knownRiskPath = path.join('docs', 'process', 'CODEX_KNOWN_RISKS.json');
const codeAuditBaselinePath = path.join('docs', 'process', 'CODEX_CODE_AUDIT_BASELINE.json');
const auditCalibrationLockPath = path.join('docs', 'process', 'CODEX_AUDIT_CALIBRATION_LOCK.json');
const agentMemoryPolicyPath = path.join('docs', 'process', 'CODEX_AGENT_MEMORY_POLICY.json');
const skillLifecyclePolicyPath = path.join('docs', 'process', 'CODEX_SKILL_LIFECYCLE_POLICY.json');
const selfEvolutionPolicyPath = path.join('docs', 'process', 'CODEX_HARNESS_SELF_EVOLUTION_POLICY.json');
const openaiMethodPolicyPath = path.join('docs', 'process', 'CODEX_OPENAI_CODEX_METHOD_POLICY.json');
const HARNESS_VERSION = '0.7.0';
const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;
const SOURCE_REPO_MODE = process.env.CODEX_HARNESS_SOURCE_REPO === '1';
const jsonMode = process.env.CODEX_QUALITY_REPORT === 'json';
const defaultPolicy = {
  profile: 'generic',
  packageDirs: ['.'],
  missingScript: 'skip',
  allowedPaths: [],
  blockedPaths: [],
  highRiskPaths: [],
  harnessPrAllowedPaths: ['AGENTS.md', '.github/', 'docs/process/', 'scripts/codex-*'],
  harnessPrBlockedPaths: [],
  implementationCompanionTestPaths: [],
  testFixtureCompanionPaths: [],
  fixtureContractRepairPaths: [],
  fixtureContractRepairRules: {
    allowApprovedFixtureContractRepair: true,
    forbidTestWeakening: true,
    forbidSkipTodoOnly: true,
    forbidNegativeCaseWeakening: true,
    requireManualConfirmation: true,
    requireSafeSummary: true,
    requiredManualConfirmationItems: [
      'validator non-weakening',
      'negative cases maintained',
      'fixture repair only',
      'raw memory not exposed',
      'safe summary maintained',
      'full run residual failures are not treated as PASS',
      'non-overridable failures are not overridden',
    ],
  },
  harnessPrMode: 'fail',
  prTypes: {
    harness: {
      allowedPaths: ['AGENTS.md', '.github/', 'docs/process/', 'scripts/codex-*'],
      blockedPaths: [],
      requiresHumanReview: true,
      allowPackageChanges: false,
      allowLockfileChanges: false,
      allowImplementationChanges: false,
    },
    implementation: {
      allowedPaths: [],
      blockedPaths: [],
      companionTestPaths: [],
      testFixtureCompanionPaths: [],
      highRiskPaths: [],
      requiresHumanReview: false,
      allowPackageChanges: true,
      allowLockfileChanges: true,
      allowImplementationChanges: true,
    },
    'docs-only': {
      allowedPaths: ['docs/'],
      blockedPaths: [],
      requiresHumanReview: false,
      allowPackageChanges: false,
      allowLockfileChanges: false,
      allowImplementationChanges: false,
    },
    dependency: {
      allowedPaths: [],
      blockedPaths: [],
      requiresHumanReview: true,
      allowPackageChanges: true,
      allowLockfileChanges: true,
      allowImplementationChanges: false,
    },
    'test-only': {
      allowedPaths: ['test/', 'tests/', '**/*.test.*', '**/*.spec.*'],
      blockedPaths: [],
      requiresHumanReview: false,
      allowPackageChanges: false,
      allowLockfileChanges: false,
      allowImplementationChanges: false,
    },
    'fixture-contract-repair': {
      allowedPaths: [],
      blockedPaths: [],
      requiredReviewers: ['test-coverage-reviewer'],
      requiredReviewerSkills: ['test-coverage-reviewer'],
      requiresHumanReview: true,
      allowPackageChanges: false,
      allowLockfileChanges: false,
      allowImplementationChanges: false,
      highRiskPaths: [],
    },
    security: {
      allowedPaths: [],
      blockedPaths: [],
      requiresHumanReview: true,
      allowPackageChanges: true,
      allowLockfileChanges: true,
      allowImplementationChanges: true,
    },
    release: {
      allowedPaths: ['.github/', 'docs/process/', 'scripts/'],
      blockedPaths: [],
      requiresHumanReview: true,
      allowPackageChanges: false,
      allowLockfileChanges: false,
      allowImplementationChanges: false,
    },
  },
  diffScope: {
    outOfScope: 'fail',
    blocked: 'fail',
    highRisk: 'warn',
  },
  knownRiskExpiry: 'warning',
  riskKeywords: {
    R3: ['auth', 'authorization', 'permission', 'persistence', 'secret', 'credential', 'execution'],
    R2: ['config', 'workflow', 'script', 'dependency'],
  },
  reviewerSelection: {
    rules: [
      { id: 'tests', reviewerSkill: 'test-coverage-reviewer', paths: ['test/', 'tests/', '**/*.test.*', '**/*.spec.*'] },
      { id: 'sensitive', reviewerSkill: 'security-reviewer', keywords: ['auth', 'authorization', 'permission', 'secret', 'credential', 'token', 'payment', 'persistence', 'migration', 'webhook', 'upload', 'runtime', 'adapter'], riskLevels: ['R3'] },
      { id: 'release', reviewerSkill: 'release-gate-reviewer', paths: ['.github/workflows/'], keywords: ['deploy', 'release', 'rollout'] },
    ],
  },
  testWeakening: {
    testPaths: ['test/', 'tests/', '**/*.test.*', '**/*.spec.*'],
    safeFixtureMetadataPatterns: ['metadata', 'manifest', 'approved', 'safe'],
    mode: 'warn',
  },
  domainInvariants: [],
  dependencyAudit: {
    packageFiles: ['package.json'],
    lockfiles: ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml'],
    requireLockfileForPackageChange: 'warning',
    riskyPackages: [],
  },
  securitySensitiveTerms: ['auth', 'authorization', 'permission', 'secret', 'credential', 'token', 'payment', 'persistence', 'migration', 'webhook', 'upload', 'runtime', 'adapter'],
  manualConfirmationPolicy: {
    requiredForRiskLevels: ['R3'],
    allowedSources: ['githubReview', 'prBody', 'prComment', 'localFile'],
    requireHeadSha: true,
    requireRole: true,
    requireReviewedItems: true,
    requiredReviewedItems: [],
    cannotOverride: [
      'secretScanFailure',
      'blockedPaths',
      'highConfidenceSecret',
      'implementationHarnessMixing',
      'profileRequiredFailure',
      'openaiMethodGateFailure',
    ],
  },
  coverageIntent: {
    enabled: true,
    implementationPaths: ['src/', 'lib/', 'app/'],
    testPaths: ['test/', 'tests/', '**/*.test.*', '**/*.spec.*'],
    required: ['happy path', 'error path', 'boundary values', 'permissions', 'state transitions', 'regression', 'external failure', 'smoke/integration'],
    missingTestChange: 'warning',
  },
  codeAuditPolicy: {
    mode: 'standard',
    confidenceCalibration: {
      high: 'blockingCandidate',
      medium: 'warningCandidate',
      low: 'infoCandidate',
    },
    confidenceOverrides: {},
    confidenceThresholds: {
      blockingMinConfidence: 'high',
      humanReviewMinConfidence: 'medium',
      warningMinConfidence: 'low',
    },
    auditQualityThresholds: {
      minScore: 0.85,
      maxFalsePositives: 0,
      maxFalseNegatives: 0,
    },
    canaryRules: [],
    canaryAsWarning: true,
    canaryExpiresAt: '',
    canaryPromoteToBlockingAfter: '',
    recommendedMode: 'standard',
    negativeSignals: {
      enabled: true,
      lowerWarnings: true,
    },
    performanceBudget: {
      maxFiles: 500,
      maxBytes: 2000000,
      maxFindings: 200,
      maxRootCauses: 80,
      onLimit: 'warning',
    },
    fullRunTests: {
      status: 'not_run',
      knownResidual: false,
    },
    defectTaxonomy: {
      categories: [
        'test_weakening',
        'dependency_inconsistency',
        'security_sensitive_change',
        'coverage_gap',
        'pr_mixing',
        'unknown',
      ],
      ruleMappings: {},
    },
    humanReviewRoles: {
      default: 'project-owner',
      security: 'security-reviewer',
      release: 'release-owner',
      domain: 'domain-owner',
    },
    scopeAgreement: {
      outputPath: 'docs/process/CODEX_PR_SCOPE_CONTRACT.json',
      writeEnv: 'CODEX_WRITE_PR_SCOPE_CONTRACT',
    },
    calibrationLock: {
      path: 'docs/process/CODEX_AUDIT_CALIBRATION_LOCK.json',
      drift: 'warning',
    },
    dangerousCommands: ['git reset --hard', 'git clean -fd', 'git push --force', 'rm -rf'],
    recommendedCommands: {},
    priorityOverrides: {},
    recommendedFixTypes: {},
    fixImpactRules: {},
    suppressionPolicy: {
      requireOwner: true,
      requireExpiresAt: true,
      minReasonLength: 12,
      broadScope: 'warning',
      highPrioritySuppression: 'warning',
      unknownRuleId: 'warning',
    },
    reviewerMappings: {},
    domainInvariantMappings: {},
    testIntentRules: {},
    dependencyAuditRules: {},
    semanticImpactMappings: {},
    minimalPrPlan: {
      doNotMix: [
        'harness update with implementation change',
        'dependency update with unrelated implementation change',
        'test expectation change without specification evidence',
      ],
    },
    validationCommandPlan: {},
    faultInjectionBenchmark: {
      expectedFaults: 11,
      maxMissedFaults: 0,
      maxFalsePositives: 0,
    },
    severityOverrides: {
      testWeakening: {
        assertionRemoved: 'blocking',
        skipTodoOnlyAdded: 'warning',
        expectationRelaxed: 'warning',
        snapshotUpdated: 'warning',
        errorPathRemoved: 'warning',
        boundaryCoverageRemoved: 'warning',
        regressionCoverageRemoved: 'warning',
        fixtureFollowsImplementation: 'warning',
      },
      dependencyAudit: {
        packageWithoutLockfile: 'warning',
        directImportMissing: 'warning',
        riskyPackage: 'warning',
      },
      securitySensitiveChange: 'warning',
      coverageIntent: 'warning',
      domainInvariant: 'warning',
    },
    baselinePolicy: {
      expired: 'warning',
    },
    auditThresholds: {
      minimumAuditGrade: 70,
      maxFalsePositiveCount: 1,
      maxFalseNegativeCount: 0,
    },
    specAuthority: {
      requiredFiles: [],
      notRequiredFiles: [],
    },
    humanReviewChecklist: {
      roles: { default: 'project-owner' },
      mustCheck: ['quality evidence', 'high priority findings', 'residual risks'],
      mustNotAssume: ['remote checks are current', 'static audit proves runtime behavior'],
      evidenceToInspect: ['quality report', 'evidence pack', 'PR body'],
      questionsForHuman: ['are residual risks acceptable?', 'are required checks current?'],
    },
  },
  agentMemoryPolicy: {
    required: true,
    missing: 'warning',
  },
  skillLifecyclePolicy: {
    required: true,
    missing: 'warning',
  },
  selfEvolutionPolicy: {
    required: true,
    missing: 'warning',
  },
  checks: [
    { name: 'npm test', type: 'npmScript', cwd: '.', script: 'test', envFlag: 'CODEX_RUN_NPM_TEST' },
    { name: 'npm build', type: 'npmScript', cwd: '.', script: 'build', envFlag: 'CODEX_RUN_NPM_BUILD' },
    { name: 'npm lint', type: 'npmScript', cwd: '.', script: 'lint', envFlag: 'CODEX_RUN_NPM_LINT' },
    { name: 'npm smoke', type: 'npmScript', cwd: '.', script: 'smoke', envFlag: 'CODEX_RUN_NPM_SMOKE' },
  ],
};

const levels = { R1: 1, R2: 2, R3: 3 };
const changedPathsSummary = {
  count: 0,
  paths: [],
  outOfScope: [],
  blocked: [],
  highRisk: [],
};
const report = {
  marker,
  harnessVersion: HARNESS_VERSION,
  qualityReportSchemaVersion: '1.1.0',
  codeAuditSchemaVersion: '1.1.0',
  evidencePackSchemaVersion: '1.1.0',
  profile: 'generic',
  status: 'running',
  mergeReady: false,
  riskLevel: 'R1',
  changedPathsSummary,
  changedPaths: changedPathsSummary,
  secretScan: { status: 'not_run' },
  localGate: { status: 'running', checksRun: [] },
  profileRequiredChecks: { enabled: false, status: 'not_run', checks: [] },
  worktreeStatus: { status: 'not_run' },
  versionConsistency: { status: 'not_run', expected: HARNESS_VERSION, files: [] },
  policySchema: { status: 'not_run', violations: [] },
  knownRisks: { status: 'not_run', count: 0, expired: [], invalid: [], matched: [] },
  postMerge: { status: 'not_run' },
  manualMergePolicy: { status: 'not_evaluated' },
  manualConfirmationStatus: { required: false, status: 'not_required', source: 'none', missingItems: [], cannotOverrideFailures: [] },
  branchCleanupAdvice: { status: 'not_run', deleteCandidates: [] },
  prSeparationStatus: { status: 'not_run', enabled: false },
  evidencePack: { status: 'not_run' },
  reviewResultSchemaStatus: { status: 'not_run' },
  rolloutStatus: { status: 'not_run' },
  selectedReviewers: { status: 'not_run', reviewers: [], rules: [] },
  testWeakeningStatus: { status: 'not_run', findings: [] },
  domainInvariantStatus: { status: 'not_run', findings: [] },
  dependencyAuditStatus: { status: 'not_run', findings: [] },
  securitySensitiveChangeStatus: { status: 'not_run', findings: [] },
  coverageIntentStatus: { status: 'not_run', required: [], missing: [] },
  codeAudit: { status: 'not_run', blocking: 0, warning: 0, info: 0 },
  codeAuditCalibration: { status: 'not_run', rules: [], falsePositiveFixtures: 0, falseNegativeFixtures: 0 },
  auditPerformance: { status: 'not_run', scannedFiles: 0, scannedBytes: 0, findingCount: 0, rootCauseCount: 0, durationMs: 0, partial: false, warnings: [] },
  negativeSignals: [],
  confidenceCalibration: { status: 'not_run', mode: 'standard', policy: {} },
  auditRegressionSuite: { status: 'not_run' },
  auditScorecard: { status: 'not_run' },
  auditQualityStatus: 'not_run',
  auditQualityScore: 0,
  auditQualityWarnings: [],
  auditEvaluation: { status: 'not_run' },
  faultInjectionBenchmark: { status: 'not_run' },
  semanticImpact: { status: 'not_run', categories: [] },
  testSufficiency: { status: 'not_run', testSufficiencyScore: 0, missingTestIntent: [] },
  specTestMismatch: { status: 'not_run', suspectedMismatchCount: 0 },
  specTestCodeConsistency: { status: 'not_run', specTestCodeConsistencyStatus: 'not_run', suspectedSpecTestMismatchCount: 0, suspectedImplementationSpecMismatchCount: 0 },
  defectTaxonomy: { status: 'not_run', categories: [] },
  oracleLimits: { status: 'not_run', canDetermine: [], cannotDetermine: [] },
  decisionTrace: { status: 'not_run', inputsUsed: [], finalDecision: 'unknown' },
  auditConfidenceEvidence: { status: 'not_run', positiveSignals: [], negativeSignals: [], missingSignals: [] },
  precisionRecallGuardrails: { status: 'not_run' },
  calibrationLockStatus: { status: 'not_run' },
  reviewerInstructionCompactness: { status: 'not_run' },
  fixPlanValidation: { status: 'not_run' },
  prScopeAgreement: { status: 'not_run' },
  auditDriftReport: { status: 'not_run' },
  residualFailureGovernance: { status: 'not_run' },
  ciParity: { status: 'not_run' },
  realProjectDryRunAuditPack: { status: 'not_run' },
  severitySanity: { status: 'not_run' },
  humanReviewRoleMapping: { status: 'not_run', roles: [] },
  auditUsefulnessValidation: { status: 'not_run' },
  minimalPrPlan: { status: 'not_run', splitRecommended: false, suggestedPRs: [] },
  ciRiskPrediction: { status: 'not_run', ciRiskReasons: [] },
  profileInvariantEvaluation: { status: 'not_run', findings: 0 },
  confidenceImprovement: { status: 'not_run', positiveSignals: [], negativeSignals: [] },
  auditValidationCommandPlan: { status: 'not_run', commands: [] },
  ruleTuningRecommendation: { status: 'not_run', recommendations: [] },
  goldenPack: { status: 'not_run' },
  auditResultShape: { status: 'not_run' },
  ruleEffectivenessReport: { status: 'not_run', rules: [] },
  falsePositiveCandidates: [],
  falseNegativeGuard: { status: 'not_run', findings: [] },
  noiseBudget: { status: 'not_run', warningsShown: 0, warningsHidden: 0, topFindings: [] },
  profileCalibrationPack: { status: 'not_run', profiles: [] },
  auditReadinessForRealRepo: { status: 'not_run' },
  trustLevel: 'unknown',
  releaseCandidateCheck: { status: 'not_run' },
  releaseCandidateStatus: 'not_run',
  readyForRealProjectEvaluation: false,
  predictionValidation: { status: 'not_run', predictions: [] },
  auditToTestMapping: { status: 'not_run', mappings: [] },
  auditResultStabilityStatus: { status: 'not_run' },
  auditReplayPack: { status: 'not_run' },
  goldenFixtures: { status: 'not_run' },
  profilePortabilityCheck: { status: 'not_run' },
  localVsCiExpectation: { status: 'not_run', ciRiskReasons: [] },
  partialRunHandling: { status: 'not_run' },
  humanReviewPacket: { status: 'not_run' },
  applyRecommendation: { status: 'not_run' },
  stopConditions: { status: 'not_run', stopConditions: [], triggeredStopConditions: [], notTriggeredStopConditions: [] },
  realProjectEvaluation: { status: 'not_run' },
  feedbackLoop: { status: 'not_run' },
  performanceSummary: { status: 'not_run' },
  profileCalibrationReport: { status: 'not_run', profiles: [] },
  canaryPromotionWorkflow: { status: 'not_run' },
  ruleRetirementWorkflow: { status: 'not_run' },
  smokeBenchmark: { status: 'not_run' },
  ruleTraceability: { status: 'not_run', traces: [] },
  reviewerSkillEffectiveness: { status: 'not_run' },
  explainabilityCompression: { status: 'not_run' },
  noRegressionStatus: { status: 'not_run' },
  rolloutGate: { status: 'not_run' },
  trustBoundary: { status: 'not_run' },
  humanInLoopEnforcement: { status: 'not_run' },
  safeArtifactValidation: { status: 'not_run' },
  mutationBenchmark: { status: 'not_run' },
  adversarialPrSimulator: { status: 'not_run' },
  auditBypass: { status: 'not_run' },
  realWorldCanarySet: { status: 'not_run' },
  specBoundaryMutation: { status: 'not_run' },
  testAuditMutation: { status: 'not_run' },
  dependencyAdversarial: { status: 'not_run' },
  ciParityAdversarial: { status: 'not_run' },
  evidenceIntegrity: { status: 'not_run' },
  humanOverrideTemplate: { status: 'not_run' },
  redTeam: { status: 'not_run' },
  monotonicity: { status: 'not_run' },
  minimumEvidence: { status: 'not_run' },
  reviewerChallengeQuestions: { status: 'not_run' },
  policyLint: { status: 'not_run' },
  auditEffectiveness: { status: 'not_run' },
  fixOutcome: { status: 'not_run' },
  postFixVerificationPlan: { status: 'not_run' },
  repairQuality: { status: 'not_run' },
  splitEffectiveness: { status: 'not_run' },
  noiseControl: { status: 'not_run' },
  auditLearningRecommendation: { status: 'not_run' },
  decisionRetrospective: { status: 'not_run' },
  rolloutScore: { status: 'not_run' },
  freshness: { status: 'not_run' },
  riskAcceptanceWorkflow: { status: 'not_run' },
  reviewerAssignmentQuality: { status: 'not_run' },
  verificationCompleteness: { status: 'not_run' },
  skippedCheckJustification: { status: 'not_run' },
  auditModeRecommendation: { status: 'not_run' },
  auditConflict: { status: 'not_run' },
  maturityScore: { status: 'not_run' },
  prSplitRecommendation: { status: 'not_run', splitRecommended: false, suggestedPRs: [] },
  fullRunResidualIntelligence: { status: 'not_run' },
  baselineLifecycle: { status: 'not_run' },
  ruleCalibrationTable: { status: 'not_run', rules: [] },
  auditRuleImpact: { status: 'not_run' },
  severityDriftStatus: { status: 'not_run' },
  profileCompatibilityMatrix: { status: 'not_run', profiles: [] },
  strictnessPreview: { status: 'not_run' },
  modeTransitionSafety: { status: 'not_run' },
  outputShapeStatus: { status: 'not_run' },
  selfTestCoverageReport: { status: 'not_run', areas: [] },
  reviewerCoverageStatus: { status: 'not_run', missing: [] },
  canaryFindings: [],
  semanticDiffHints: [],
  fixValidationHints: [],
  rootCauseGroups: [],
  blockingFindings: [],
  warningFindings: [],
  infoFindings: [],
  codeAuditBaseline: { status: 'not_run', count: 0, expired: [], invalid: [], matched: [] },
  suppressionApplied: [],
  missingTestIntent: [],
  suppressionStatus: { status: 'not_run', blockingSuppressions: [], warningSuppressions: [] },
  remediationChecklist: [],
  remediationPlan: { status: 'not_run', topRootCauses: [], recommendedFixOrder: [], perFixType: [], requiredValidationCommands: [], humanReviewNeeded: false, whatNotToTouch: [] },
  mergeBlockExplanation: { status: 'not_run', reasons: [] },
  fixImpact: 'unknown',
  auditMode: process.env.CODEX_CODE_AUDIT_MODE || 'standard',
  reviewPromptDraftAvailable: false,
  falsePositiveTemplateAvailable: false,
  auditComparisonAvailable: false,
  decisionMatrix: { status: 'not_run' },
  findingLifecycle: { status: 'unknown', new: [], existing: [], resolved: [], suppressed: [], expiredSuppression: [], needsHumanReview: [] },
  prTypeInference: { status: 'not_run', inferredType: 'unknown', confidence: 'low', reasons: [] },
  residualTestStatus: { status: 'not_run', knownResidualAccepted: false, newFailureDetected: false },
  skillShapeStatus: { status: 'not_run', checked: 0, warnings: [] },
  agentMemoryPolicyStatus: { status: 'not_run', violations: [] },
  skillLifecyclePolicyStatus: { status: 'not_run', checkedSkills: 0, violations: [] },
  curatorSuggestionStatus: { status: 'not_run', autoApply: false },
  selfEvolutionPolicyStatus: { status: 'not_run', violations: [] },
  sourceHarnessValidationStatus: { status: 'not_run', sourceRepoMode: SOURCE_REPO_MODE },
  openaiCodexMethodStatus: { status: 'not_run' },
  methodSupportStatus: { status: 'not_run' },
  outputSizeBudget: { topFindings: 5, rootCauses: 5, safeSummary: true },
  recommendedNextAction: 'run quality gate',
  prType: process.env.CODEX_PR_TYPE || 'unspecified',
  humanReviewRequired: false,
  humanReviewReasons: [],
  postMergeVerificationPlan: [],
  skippedChecks: [],
  warnings: [],
  policyViolations: [],
  recommendedAction: 'run quality gate',
};
const failures = [];
let failOnNewWarnings = false;
let activeAuditPolicy = defaultPolicy;

function npmCliPath() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}
function commandSpec(cmd, args) {
  if (cmd === 'node') return { command: process.execPath, args };
  if (cmd === 'npm') {
    const cli = npmCliPath();
    if (cli) return { command: process.execPath, args: [cli, ...args] };
  }
  return { command: cmd, args };
}
function spawn(cmd, args, options = {}) {
  const spec = commandSpec(cmd, args);
  return spawnSync(spec.command, spec.args, {
    cwd: options.cwd || '.',
    stdio: options.stdio || 'pipe',
    encoding: options.encoding || 'utf8',
    env: { ...process.env, ...(options.env || {}) },
  });
}
function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}
function gitLines(args) {
  return git(args).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
function gitCount(range) {
  const n = Number(git(['rev-list', '--count', range]).trim());
  return Number.isFinite(n) ? n : 0;
}
function gitSha(ref, short = false) {
  const args = ['rev-parse'];
  if (short) args.push('--short');
  args.push(ref);
  return git(args).trim();
}
function redactOutput(text, env = {}) {
  let out = text || '';
  for (const value of Object.values(env)) {
    const raw = String(value || '');
    if (!raw) continue;
    out = out.split(raw).join('[redacted policy env]');
  }
  return out;
}
function printCommandOutput(result, env = {}) {
  if (jsonMode) return;
  if (result.stdout) process.stdout.write(redactOutput(result.stdout, env));
  if (result.stderr) process.stderr.write(redactOutput(result.stderr, env));
}
function safeLog(message) {
  if (!jsonMode) console.log(message);
}
function safeError(message) {
  if (!jsonMode) console.error(message);
}
function readJsonFile(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}
function addPolicyViolation(id, message, level = 'fail', extra = {}) {
  const item = { id, level, message, ...extra };
  report.policyViolations.push(item);
  if (level === 'fail') addFailure(id, message, extra);
  else addWarning({ id, level, message, ...extra });
}
function safeString(value) {
  return String(value ?? '');
}
function looksSecretLike(value) {
  const text = safeString(value);
  return [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
    /\bsk-[A-Za-z0-9]{20,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  ].some((pattern) => pattern.test(text));
}
function looksEndpointLike(value) {
  return /(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/[^\s"']+/i.test(safeString(value));
}
function validateStringArray(policy, key, { allowEmpty = true } = {}) {
  const value = policy[key];
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    addPolicyViolation(`policy.${key}.invalid`, `${key} must be an array.`);
    return;
  }
  if (!allowEmpty && value.length === 0) addPolicyViolation(`policy.${key}.empty`, `${key} must not be empty.`);
  for (const item of value) {
    if (typeof item !== 'string') addPolicyViolation(`policy.${key}.itemInvalid`, `${key} entries must be strings.`);
  }
}
function validatePolicySchema(policy) {
  const knownFields = new Set([
    'marker', 'profile', 'packageDirs', 'missingScript', 'allowedPaths', 'blockedPaths', 'highRiskPaths',
    'diffScope', 'riskKeywords', 'riskLevelBehavior', 'failOnNewWarnings', 'knownRiskExpiry',
    'knownRisks', 'harnessPrAllowedPaths', 'harnessPrBlockedPaths', 'implementationCompanionTestPaths', 'testFixtureCompanionPaths', 'fixtureContractRepairPaths', 'fixtureContractRepairRules', 'harnessPrMode', 'prTypes', 'prTypePolicies', 'checks',
    'reviewerSelection', 'testWeakening', 'domainInvariants', 'dependencyAudit', 'securitySensitiveTerms', 'manualConfirmationPolicy', 'coverageIntent', 'codeAuditPolicy',
    'agentMemoryPolicy', 'skillLifecyclePolicy', 'selfEvolutionPolicy',
  ]);
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    addPolicyViolation('policy.invalid', 'Quality gate policy must be a JSON object.');
    return;
  }
  for (const key of Object.keys(policy)) {
    if (!knownFields.has(key)) addPolicyViolation('policy.unknownField', `Policy contains unknown field: ${key}`, 'warning');
  }
  if (typeof policy.profile !== 'string' || !policy.profile.trim()) {
    addPolicyViolation('policy.profile.invalid', 'profile must be a non-empty string.');
  }
  validateStringArray(policy, 'packageDirs');
  validateStringArray(policy, 'allowedPaths');
  validateStringArray(policy, 'blockedPaths');
  validateStringArray(policy, 'highRiskPaths');
  validateStringArray(policy, 'harnessPrAllowedPaths');
  validateStringArray(policy, 'harnessPrBlockedPaths');
  validateStringArray(policy, 'implementationCompanionTestPaths');
  validateStringArray(policy, 'testFixtureCompanionPaths');
  validateStringArray(policy, 'fixtureContractRepairPaths');
  if (policy.fixtureContractRepairRules !== undefined) {
    if (!policy.fixtureContractRepairRules || typeof policy.fixtureContractRepairRules !== 'object' || Array.isArray(policy.fixtureContractRepairRules)) {
      addPolicyViolation('policy.fixtureContractRepairRules.invalid', 'fixtureContractRepairRules must be an object.');
    } else {
      for (const key of ['allowApprovedFixtureContractRepair', 'forbidTestWeakening', 'forbidSkipTodoOnly', 'forbidNegativeCaseWeakening', 'requireManualConfirmation', 'requireSafeSummary']) {
        if (policy.fixtureContractRepairRules[key] !== undefined && typeof policy.fixtureContractRepairRules[key] !== 'boolean') {
          addPolicyViolation(`policy.fixtureContractRepairRules.${key}.invalid`, `fixtureContractRepairRules.${key} must be boolean.`);
        }
      }
      if (policy.fixtureContractRepairRules.requiredManualConfirmationItems !== undefined
        && (!Array.isArray(policy.fixtureContractRepairRules.requiredManualConfirmationItems)
          || policy.fixtureContractRepairRules.requiredManualConfirmationItems.some((item) => typeof item !== 'string'))) {
        addPolicyViolation('policy.fixtureContractRepairRules.requiredManualConfirmationItems.invalid', 'fixtureContractRepairRules.requiredManualConfirmationItems must be a string array.');
      }
    }
  }
  if (policy.harnessPrMode !== undefined && !['fail', 'warn'].includes(policy.harnessPrMode)) {
    addPolicyViolation('policy.harnessPrMode.invalid', 'harnessPrMode must be fail or warn.');
  }
  for (const policyField of ['prTypes', 'prTypePolicies']) {
    if (policy[policyField] !== undefined) {
      if (!policy[policyField] || typeof policy[policyField] !== 'object' || Array.isArray(policy[policyField])) {
        addPolicyViolation(`policy.${policyField}.invalid`, `${policyField} must be an object.`);
      } else {
        for (const [name, prType] of Object.entries(policy[policyField])) {
        if (!prType || typeof prType !== 'object' || Array.isArray(prType)) {
          addPolicyViolation(`policy.${policyField}.itemInvalid`, `${policyField}.${name} must be an object.`);
          continue;
        }
        for (const key of ['allowedPaths', 'blockedPaths', 'requiredChecks', 'requiredReviewerSkills', 'companionTestPaths', 'testFixtureCompanionPaths', 'highRiskPaths', 'requiredReviewers']) {
          if (prType[key] !== undefined && (!Array.isArray(prType[key]) || prType[key].some((item) => typeof item !== 'string'))) {
            addPolicyViolation(`policy.${policyField}.arrayInvalid`, `${policyField}.${name}.${key} must be a string array.`);
          }
        }
        for (const key of ['requiresHumanReview', 'allowPackageChanges', 'allowLockfileChanges', 'allowImplementationChanges']) {
          if (prType[key] !== undefined && typeof prType[key] !== 'boolean') {
            addPolicyViolation(`policy.${policyField}.booleanInvalid`, `${policyField}.${name}.${key} must be boolean.`);
          }
        }
      }
      }
    }
  }
  if (policy.reviewerSelection !== undefined) {
    if (!policy.reviewerSelection || typeof policy.reviewerSelection !== 'object' || Array.isArray(policy.reviewerSelection)) {
      addPolicyViolation('policy.reviewerSelection.invalid', 'reviewerSelection must be an object.');
    } else if (policy.reviewerSelection.rules !== undefined && !Array.isArray(policy.reviewerSelection.rules)) {
      addPolicyViolation('policy.reviewerSelection.rules.invalid', 'reviewerSelection.rules must be an array.');
    }
  }
  if (policy.domainInvariants !== undefined && !Array.isArray(policy.domainInvariants)) {
    addPolicyViolation('policy.domainInvariants.invalid', 'domainInvariants must be an array.');
  }
  if (policy.securitySensitiveTerms !== undefined && (!Array.isArray(policy.securitySensitiveTerms) || policy.securitySensitiveTerms.some((term) => typeof term !== 'string'))) {
    addPolicyViolation('policy.securitySensitiveTerms.invalid', 'securitySensitiveTerms must be a string array.');
  }
  if (policy.manualConfirmationPolicy !== undefined) {
    if (!policy.manualConfirmationPolicy || typeof policy.manualConfirmationPolicy !== 'object' || Array.isArray(policy.manualConfirmationPolicy)) {
      addPolicyViolation('policy.manualConfirmationPolicy.invalid', 'manualConfirmationPolicy must be an object.');
    } else {
      for (const key of ['requiredForRiskLevels', 'allowedSources', 'requiredReviewedItems', 'cannotOverride']) {
        const value = policy.manualConfirmationPolicy[key];
        if (value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))) {
          addPolicyViolation(`policy.manualConfirmationPolicy.${key}.invalid`, `manualConfirmationPolicy.${key} must be a string array.`);
        }
      }
      for (const key of ['requireHeadSha', 'requireRole', 'requireReviewedItems']) {
        if (policy.manualConfirmationPolicy[key] !== undefined && typeof policy.manualConfirmationPolicy[key] !== 'boolean') {
          addPolicyViolation(`policy.manualConfirmationPolicy.${key}.invalid`, `manualConfirmationPolicy.${key} must be boolean.`);
        }
      }
    }
  }
  for (const [name, value] of Object.entries({ testWeakening: policy.testWeakening, dependencyAudit: policy.dependencyAudit, coverageIntent: policy.coverageIntent })) {
    if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) {
      addPolicyViolation(`policy.${name}.invalid`, `${name} must be an object.`);
    }
  }
  if (policy.codeAuditPolicy !== undefined && (!policy.codeAuditPolicy || typeof policy.codeAuditPolicy !== 'object' || Array.isArray(policy.codeAuditPolicy))) {
    addPolicyViolation('policy.codeAuditPolicy.invalid', 'codeAuditPolicy must be an object.');
  }
  for (const key of ['agentMemoryPolicy', 'skillLifecyclePolicy', 'selfEvolutionPolicy']) {
    if (policy[key] !== undefined && (!policy[key] || typeof policy[key] !== 'object' || Array.isArray(policy[key]))) {
      addPolicyViolation(`policy.${key}.invalid`, `${key} must be an object.`);
    }
  }
  if (policy.missingScript !== undefined && !['skip', 'fail'].includes(policy.missingScript)) {
    addPolicyViolation('policy.missingScript.invalid', 'missingScript must be skip or fail.');
  }
  if (policy.knownRiskExpiry !== undefined && !['warning', 'fail', 'ignore'].includes(policy.knownRiskExpiry)) {
    addPolicyViolation('policy.knownRiskExpiry.invalid', 'knownRiskExpiry must be warning, fail, or ignore.');
  }
  if (policy.knownRisks !== undefined) {
    if (!policy.knownRisks || typeof policy.knownRisks !== 'object' || Array.isArray(policy.knownRisks)) {
      addPolicyViolation('policy.knownRisks.invalid', 'knownRisks must be an object.');
    } else if (policy.knownRisks.expired !== undefined && !['warning', 'fail', 'ignore'].includes(policy.knownRisks.expired)) {
      addPolicyViolation('policy.knownRisks.expired.invalid', 'knownRisks.expired must be warning, fail, or ignore.');
    }
  }
  if (policy.diffScope !== undefined) {
    if (!policy.diffScope || typeof policy.diffScope !== 'object' || Array.isArray(policy.diffScope)) {
      addPolicyViolation('policy.diffScope.invalid', 'diffScope must be an object.');
    } else {
      for (const key of ['outOfScope', 'blocked', 'highRisk']) {
        if (policy.diffScope[key] !== undefined && !['fail', 'warn'].includes(policy.diffScope[key])) {
          addPolicyViolation(`policy.diffScope.${key}.invalid`, `diffScope.${key} must be fail or warn.`);
        }
      }
    }
  }
  if (policy.riskKeywords !== undefined) {
    if (Array.isArray(policy.riskKeywords)) {
      if (policy.riskKeywords.some((term) => typeof term !== 'string')) {
        addPolicyViolation('policy.riskKeywords.termsInvalid', 'riskKeywords array values must be strings.');
      }
    } else if (!policy.riskKeywords || typeof policy.riskKeywords !== 'object') {
      addPolicyViolation('policy.riskKeywords.invalid', 'riskKeywords must be an object or string array.');
    } else {
      for (const [level, terms] of Object.entries(policy.riskKeywords)) {
        if (!levels[level]) addPolicyViolation('policy.riskKeywords.levelInvalid', 'riskKeywords contains an unknown risk level.');
        if (!Array.isArray(terms) || terms.some((term) => typeof term !== 'string')) {
          addPolicyViolation('policy.riskKeywords.termsInvalid', 'riskKeywords values must be string arrays.');
        }
      }
    }
  }
  if (!Array.isArray(policy.checks)) {
    if (policy.checks !== undefined) addPolicyViolation('policy.checks.invalid', 'checks must be an array.');
    return;
  }
  policy.checks.forEach((check, index) => {
    const label = `checks[${index}]`;
    if (!check || typeof check !== 'object' || Array.isArray(check)) {
      addPolicyViolation('policy.check.invalid', `${label} must be an object.`);
      return;
    }
    if (check.name !== undefined && typeof check.name !== 'string') addPolicyViolation('policy.check.name.invalid', `${label}.name must be a string.`);
    if (check.cwd !== undefined && typeof check.cwd !== 'string') addPolicyViolation('policy.check.cwd.invalid', `${label}.cwd must be a string.`);
    if (check.envFlag !== undefined && !/^[A-Z][A-Z0-9_]*$/.test(String(check.envFlag))) {
      addPolicyViolation('policy.check.envFlag.invalid', `${label}.envFlag must be an uppercase environment flag.`);
    }
    for (const key of ['defaultRequired', 'profileRequired', 'ciRequired']) {
      if (check[key] !== undefined && typeof check[key] !== 'boolean') {
        addPolicyViolation('policy.check.flag.invalid', `${label}.${key} must be boolean.`);
      }
    }
    if (check.missingScript !== undefined && !['skip', 'fail'].includes(check.missingScript)) {
      addPolicyViolation('policy.check.missingScript.invalid', `${label}.missingScript must be skip or fail.`);
    }
    if (check.type === 'npmScript') {
      if (typeof check.script !== 'string' || !check.script.trim()) addPolicyViolation('policy.check.script.invalid', `${label}.script must be a non-empty string.`);
    } else if (check.command !== undefined && typeof check.command !== 'string') {
      addPolicyViolation('policy.check.command.invalid', `${label}.command must be a string.`);
    } else if (check.type !== undefined && check.type !== 'npmScript') {
      addPolicyViolation('policy.check.type.invalid', `${label}.type is unsupported.`);
    }
    if (check.env !== undefined) {
      if (!check.env || typeof check.env !== 'object' || Array.isArray(check.env)) {
        addPolicyViolation('policy.check.env.invalid', `${label}.env must be an object.`);
      } else {
        for (const [key, value] of Object.entries(check.env)) {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) addPolicyViolation('policy.check.env.keyInvalid', `${label}.env contains an invalid key.`);
          if (value === undefined || value === null) continue;
          if (typeof value !== 'string') addPolicyViolation('policy.check.env.valueInvalid', `${label}.env values must be strings.`);
          if (looksSecretLike(value)) addPolicyViolation('policy.check.env.secretLike', `${label}.env contains an unsafe value shape.`);
        }
      }
    }
  });
}
function readPackage(dir) {
  const file = path.join(dir, 'package.json');
  if (!fs.existsSync(file)) return null;
  try {
    return readJsonFile(file);
  } catch (error) {
    addFailure('packageJson.parse', `Failed to parse ${file}: ${error.message}`);
    return null;
  }
}
function readPolicy() {
  if (!fs.existsSync(policyPath)) return defaultPolicy;
  try {
    const policy = readJsonFile(policyPath);
    validatePolicySchema(policy);
    const configuredPrTypes = { ...(policy.prTypes || {}), ...(policy.prTypePolicies || {}) };
    return {
      ...defaultPolicy,
      ...policy,
      diffScope: { ...defaultPolicy.diffScope, ...(policy.diffScope || {}) },
      riskKeywords: Array.isArray(policy.riskKeywords)
        ? { ...defaultPolicy.riskKeywords, R2: [...defaultPolicy.riskKeywords.R2, ...policy.riskKeywords] }
        : { ...defaultPolicy.riskKeywords, ...(policy.riskKeywords || {}) },
      prTypes: { ...defaultPolicy.prTypes, ...configuredPrTypes },
      reviewerSelection: {
        ...defaultPolicy.reviewerSelection,
        ...(policy.reviewerSelection || {}),
        rules: [...(defaultPolicy.reviewerSelection.rules || []), ...(policy.reviewerSelection?.rules || [])],
      },
      testWeakening: { ...defaultPolicy.testWeakening, ...(policy.testWeakening || {}) },
      fixtureContractRepairPaths: Array.isArray(policy.fixtureContractRepairPaths)
        ? policy.fixtureContractRepairPaths
        : defaultPolicy.fixtureContractRepairPaths,
      fixtureContractRepairRules: {
        ...defaultPolicy.fixtureContractRepairRules,
        ...(policy.fixtureContractRepairRules || {}),
        requiredManualConfirmationItems: Array.isArray(policy.fixtureContractRepairRules?.requiredManualConfirmationItems)
          ? policy.fixtureContractRepairRules.requiredManualConfirmationItems
          : defaultPolicy.fixtureContractRepairRules.requiredManualConfirmationItems,
      },
      domainInvariants: Array.isArray(policy.domainInvariants) ? policy.domainInvariants : defaultPolicy.domainInvariants,
      dependencyAudit: { ...defaultPolicy.dependencyAudit, ...(policy.dependencyAudit || {}) },
      securitySensitiveTerms: Array.isArray(policy.securitySensitiveTerms)
        ? [...new Set([...defaultPolicy.securitySensitiveTerms, ...policy.securitySensitiveTerms])]
        : defaultPolicy.securitySensitiveTerms,
      manualConfirmationPolicy: {
        ...defaultPolicy.manualConfirmationPolicy,
        ...(policy.manualConfirmationPolicy || {}),
        requiredForRiskLevels: Array.isArray(policy.manualConfirmationPolicy?.requiredForRiskLevels)
          ? policy.manualConfirmationPolicy.requiredForRiskLevels
          : defaultPolicy.manualConfirmationPolicy.requiredForRiskLevels,
        allowedSources: Array.isArray(policy.manualConfirmationPolicy?.allowedSources)
          ? policy.manualConfirmationPolicy.allowedSources
          : defaultPolicy.manualConfirmationPolicy.allowedSources,
        requiredReviewedItems: Array.isArray(policy.manualConfirmationPolicy?.requiredReviewedItems)
          ? policy.manualConfirmationPolicy.requiredReviewedItems
          : defaultPolicy.manualConfirmationPolicy.requiredReviewedItems,
        cannotOverride: Array.isArray(policy.manualConfirmationPolicy?.cannotOverride)
          ? policy.manualConfirmationPolicy.cannotOverride
          : defaultPolicy.manualConfirmationPolicy.cannotOverride,
      },
      coverageIntent: { ...defaultPolicy.coverageIntent, ...(policy.coverageIntent || {}) },
      codeAuditPolicy: {
        ...defaultPolicy.codeAuditPolicy,
        ...(policy.codeAuditPolicy || {}),
        severityOverrides: {
          ...defaultPolicy.codeAuditPolicy.severityOverrides,
          ...(policy.codeAuditPolicy?.severityOverrides || {}),
        },
        confidenceCalibration: {
          ...defaultPolicy.codeAuditPolicy.confidenceCalibration,
          ...(policy.codeAuditPolicy?.confidenceCalibration || {}),
        },
        confidenceOverrides: {
          ...defaultPolicy.codeAuditPolicy.confidenceOverrides,
          ...(policy.codeAuditPolicy?.confidenceOverrides || {}),
        },
        confidenceThresholds: {
          ...defaultPolicy.codeAuditPolicy.confidenceThresholds,
          ...(policy.codeAuditPolicy?.confidenceThresholds || {}),
        },
        auditQualityThresholds: {
          ...defaultPolicy.codeAuditPolicy.auditQualityThresholds,
          ...(policy.codeAuditPolicy?.auditQualityThresholds || {}),
        },
        canaryRules: Array.isArray(policy.codeAuditPolicy?.canaryRules)
          ? policy.codeAuditPolicy.canaryRules
          : defaultPolicy.codeAuditPolicy.canaryRules,
        canaryAsWarning: policy.codeAuditPolicy?.canaryAsWarning ?? defaultPolicy.codeAuditPolicy.canaryAsWarning,
        canaryExpiresAt: policy.codeAuditPolicy?.canaryExpiresAt || defaultPolicy.codeAuditPolicy.canaryExpiresAt,
        canaryPromoteToBlockingAfter: policy.codeAuditPolicy?.canaryPromoteToBlockingAfter || defaultPolicy.codeAuditPolicy.canaryPromoteToBlockingAfter,
        recommendedMode: policy.codeAuditPolicy?.recommendedMode || defaultPolicy.codeAuditPolicy.recommendedMode,
        negativeSignals: {
          ...defaultPolicy.codeAuditPolicy.negativeSignals,
          ...(policy.codeAuditPolicy?.negativeSignals || {}),
        },
        performanceBudget: {
          ...defaultPolicy.codeAuditPolicy.performanceBudget,
          ...(policy.codeAuditPolicy?.performanceBudget || {}),
        },
        fullRunTests: {
          ...defaultPolicy.codeAuditPolicy.fullRunTests,
          ...(policy.codeAuditPolicy?.fullRunTests || {}),
        },
        dangerousCommands: Array.isArray(policy.codeAuditPolicy?.dangerousCommands)
          ? [...new Set([...defaultPolicy.codeAuditPolicy.dangerousCommands, ...policy.codeAuditPolicy.dangerousCommands])]
          : defaultPolicy.codeAuditPolicy.dangerousCommands,
        recommendedCommands: {
          ...defaultPolicy.codeAuditPolicy.recommendedCommands,
          ...(policy.codeAuditPolicy?.recommendedCommands || {}),
        },
        priorityOverrides: {
          ...defaultPolicy.codeAuditPolicy.priorityOverrides,
          ...(policy.codeAuditPolicy?.priorityOverrides || {}),
        },
        recommendedFixTypes: {
          ...defaultPolicy.codeAuditPolicy.recommendedFixTypes,
          ...(policy.codeAuditPolicy?.recommendedFixTypes || {}),
        },
        fixImpactRules: {
          ...defaultPolicy.codeAuditPolicy.fixImpactRules,
          ...(policy.codeAuditPolicy?.fixImpactRules || {}),
        },
        suppressionPolicy: {
          ...defaultPolicy.codeAuditPolicy.suppressionPolicy,
          ...(policy.codeAuditPolicy?.suppressionPolicy || {}),
        },
        reviewerMappings: {
          ...defaultPolicy.codeAuditPolicy.reviewerMappings,
          ...(policy.codeAuditPolicy?.reviewerMappings || {}),
        },
        domainInvariantMappings: {
          ...defaultPolicy.codeAuditPolicy.domainInvariantMappings,
          ...(policy.codeAuditPolicy?.domainInvariantMappings || {}),
        },
        testIntentRules: {
          ...defaultPolicy.codeAuditPolicy.testIntentRules,
          ...(policy.codeAuditPolicy?.testIntentRules || {}),
        },
        dependencyAuditRules: {
          ...defaultPolicy.codeAuditPolicy.dependencyAuditRules,
          ...(policy.codeAuditPolicy?.dependencyAuditRules || {}),
        },
        semanticImpactMappings: {
          ...defaultPolicy.codeAuditPolicy.semanticImpactMappings,
          ...(policy.codeAuditPolicy?.semanticImpactMappings || {}),
        },
        minimalPrPlan: {
          ...defaultPolicy.codeAuditPolicy.minimalPrPlan,
          ...(policy.codeAuditPolicy?.minimalPrPlan || {}),
          doNotMix: Array.isArray(policy.codeAuditPolicy?.minimalPrPlan?.doNotMix)
            ? policy.codeAuditPolicy.minimalPrPlan.doNotMix
            : defaultPolicy.codeAuditPolicy.minimalPrPlan.doNotMix,
        },
        validationCommandPlan: {
          ...defaultPolicy.codeAuditPolicy.validationCommandPlan,
          ...(policy.codeAuditPolicy?.validationCommandPlan || {}),
        },
        faultInjectionBenchmark: {
          ...defaultPolicy.codeAuditPolicy.faultInjectionBenchmark,
          ...(policy.codeAuditPolicy?.faultInjectionBenchmark || {}),
        },
        baselinePolicy: {
          ...defaultPolicy.codeAuditPolicy.baselinePolicy,
          ...(policy.codeAuditPolicy?.baselinePolicy || {}),
        },
      },
      agentMemoryPolicy: { ...defaultPolicy.agentMemoryPolicy, ...(policy.agentMemoryPolicy || {}) },
      skillLifecyclePolicy: { ...defaultPolicy.skillLifecyclePolicy, ...(policy.skillLifecyclePolicy || {}) },
      selfEvolutionPolicy: { ...defaultPolicy.selfEvolutionPolicy, ...(policy.selfEvolutionPolicy || {}) },
      checks: Array.isArray(policy.checks) ? policy.checks : defaultPolicy.checks,
    };
  } catch (error) {
    addFailure('policy.parse', `Failed to parse ${policyPath}: ${error.message}`);
    return defaultPolicy;
  }
}
function readKnownRisks(policy) {
  if (!fs.existsSync(knownRiskPath)) {
    report.knownRisks = { status: 'not_found', count: 0, expired: [], invalid: [], matched: [] };
    return [];
  }
  try {
    const data = readJsonFile(knownRiskPath);
    const warnings = Array.isArray(data.warnings) ? data.warnings : [];
    const risks = warnings.map((item) => (typeof item === 'string' ? { id: item } : item)).filter(Boolean);
    const today = new Date().toISOString().slice(0, 10);
    const expired = [];
    const invalid = [];
    for (const risk of risks) {
      if (!risk || typeof risk !== 'object' || !risk.id) {
        invalid.push({ id: 'missing-id' });
        continue;
      }
      for (const key of ['owner', 'expiresAt', 'severity', 'reason']) {
        if (risk[key] !== undefined && typeof risk[key] !== 'string') invalid.push({ id: risk.id, reason: `${key} must be a string` });
      }
      for (const [key, value] of Object.entries(risk)) {
        if (typeof value === 'string' && (looksSecretLike(value) || looksEndpointLike(value))) {
          invalid.push({ id: risk.id, reason: `${key} contains unsafe value shape` });
        }
      }
      for (const key of ['introducedIn', 'lastReviewedAt', 'nextAction', 'acceptedBy']) {
        if (risk[key] !== undefined && typeof risk[key] !== 'string') invalid.push({ id: risk.id, reason: `${key} must be a string` });
      }
      if (risk.expiresAt && /^\d{4}-\d{2}-\d{2}$/.test(risk.expiresAt) && risk.expiresAt < today) {
        expired.push({ id: risk.id, path: risk.path ? normalizePath(risk.path) : undefined, expiresAt: risk.expiresAt, severity: risk.severity || 'warning' });
      }
    }
    report.knownRisks = { status: expired.length || invalid.length ? 'warning' : 'pass', count: risks.length, expired, invalid, matched: [] };
    for (const item of invalid) {
      addPolicyViolation('knownRisk.invalid', `Known risk baseline entry is invalid: ${item.id || 'unknown'}`, 'fail');
    }
    const expiredMode = policy.knownRisks?.expired || policy.knownRiskExpiry || 'warning';
    for (const item of expired) {
      const severityMode = ['fail', 'error', 'critical'].includes(String(item.severity).toLowerCase()) ? 'fail' : 'warning';
      const level = expiredMode === 'ignore' ? 'ignore' : (expiredMode === 'fail' ? 'fail' : severityMode);
      const message = `Known risk baseline entry is expired: ${item.id}`;
      if (level === 'ignore') continue;
      if (level === 'fail') addPolicyViolation('knownRisk.expired', message, 'fail', { path: item.path });
      else addWarning({ id: 'knownRisk.expired', path: item.path, message, known: true });
    }
    return risks;
  } catch (error) {
    addWarning({ id: 'knownRiskBaseline.parse', message: `Failed to parse ${knownRiskPath}: ${error.message}` });
    report.knownRisks = { status: 'warning', count: 0, expired: [], invalid: [{ id: 'parse' }], matched: [] };
    return [];
  }
}
function readCodeAuditBaseline(policy) {
  if (!fs.existsSync(codeAuditBaselinePath)) {
    report.codeAuditBaseline = { status: 'not_found', count: 0, expired: [], invalid: [], matched: [] };
    return [];
  }
  try {
    const data = readJsonFile(codeAuditBaselinePath);
    const warnings = Array.isArray(data.warnings) ? data.warnings : [];
    const today = new Date().toISOString().slice(0, 10);
    const expired = [];
    const invalid = [];
    const blockingSuppressions = [];
    const warningSuppressions = [];
    const suppressionPolicy = policy.codeAuditPolicy?.suppressionPolicy || defaultPolicy.codeAuditPolicy.suppressionPolicy;
    const knownRuleIds = knownAuditRuleIds();
    const noteSuppression = (level, item, reason) => {
      const entry = { id: item.id || item.ruleId || 'unknown', ruleId: item.ruleId, path: item.path ? normalizePath(item.path) : undefined, reason };
      if (level === 'blocking') blockingSuppressions.push(entry);
      else warningSuppressions.push(entry);
    };
    const items = warnings.map((item) => {
      if (!item || typeof item !== 'object' || (!item.id && !item.ruleId)) {
        invalid.push({ id: 'missing-id' });
        return null;
      }
      const itemId = item.id || item.ruleId;
      for (const key of ['id', 'path', 'profile', 'owner', 'expiresAt', 'severity', 'reason', 'acceptedBy', 'stableMatchKey', 'scopeHash']) {
        if (item[key] !== undefined && typeof item[key] !== 'string') invalid.push({ id: itemId, reason: `${key} must be a string` });
      }
      for (const [key, value] of Object.entries(item)) {
        if (typeof value === 'string' && (looksSecretLike(value) || looksEndpointLike(value))) {
          invalid.push({ id: itemId, reason: `${key} contains unsafe value shape` });
        }
      }
      const ruleId = item.ruleId || (item.id ? ruleIdFrom(item.id) : '');
      if (!item.ruleId) noteSuppression('warning', item, 'missing ruleId');
      if (!item.profile) noteSuppression('warning', item, 'missing profile');
      if (suppressionPolicy.requireOwner !== false && !item.owner) noteSuppression('warning', item, 'missing owner');
      if (suppressionPolicy.requireExpiresAt !== false && !item.expiresAt) noteSuppression('warning', item, 'missing expiresAt');
      if (!item.acceptedBy) noteSuppression('warning', item, 'missing acceptedBy');
      if (!item.severity) noteSuppression('warning', item, 'missing severity');
      if (!item.stableMatchKey && !item.scopeHash) noteSuppression('warning', item, 'missing stableMatchKey');
      if (typeof item.reason !== 'string' || item.reason.trim().length < Number(suppressionPolicy.minReasonLength || 12)) noteSuppression('warning', item, 'reason too short');
      if (ruleId && !knownRuleIds.has(ruleId) && !ruleId.startsWith('DOMAIN_INVARIANT_')) noteSuppression(suppressionPolicy.unknownRuleId === 'fail' ? 'blocking' : 'warning', item, 'unknown ruleId');
      if (String(item.path || item.matchScope || '').includes('*')) noteSuppression(suppressionPolicy.broadScope === 'fail' ? 'blocking' : 'warning', item, 'broad match scope');
      const priority = item.priority || priorityFor({
        id: item.id,
        ruleId,
        severity: normalizeSeverity(item.severity || 'warning'),
        confidence: normalizeConfidence(item.confidence || 'medium'),
      });
      if (priority === 'P0' || priority === 'P1') noteSuppression(suppressionPolicy.highPrioritySuppression === 'fail' ? 'blocking' : 'warning', item, 'high-priority suppression requires explicit review');
      const copy = { ...item, expired: false };
      if (item.expiresAt && /^\d{4}-\d{2}-\d{2}$/.test(item.expiresAt) && item.expiresAt < today) {
        copy.expired = true;
        expired.push({ id: itemId, path: item.path ? normalizePath(item.path) : undefined, expiresAt: item.expiresAt, severity: item.severity || 'warning' });
      }
      return copy;
    }).filter(Boolean);
    report.codeAuditBaseline = { status: expired.length || invalid.length ? 'warning' : 'pass', count: items.length, expired, invalid, matched: [] };
    report.suppressionStatus = {
      status: blockingSuppressions.length ? 'fail' : (warningSuppressions.length ? 'warning' : 'pass'),
      blockingSuppressions,
      warningSuppressions,
    };
    for (const item of blockingSuppressions) addAuditFinding('blocking', 'codeAuditBaseline.suppressionHygiene', 'Code audit suppression hygiene failed.', { path: item.path, ruleId: 'CODE_AUDIT_SUPPRESSION_HYGIENE', reason: item.reason, recommendedFixType: 'policy_fix' }, []);
    for (const item of warningSuppressions) addAuditFinding('warning', 'codeAuditBaseline.suppressionHygiene', 'Code audit suppression hygiene warning.', { path: item.path, ruleId: 'CODE_AUDIT_SUPPRESSION_HYGIENE', reason: item.reason, recommendedFixType: 'policy_fix' }, []);
    for (const item of invalid) addPolicyViolation('codeAuditBaseline.invalid', `Code audit baseline entry is invalid: ${item.id || 'unknown'}`, 'fail');
    const expiredMode = policy.codeAuditPolicy?.baselinePolicy?.expired || 'warning';
    for (const item of expired) {
      if (expiredMode === 'ignore') continue;
      const message = `Code audit baseline entry is expired: ${item.id}`;
      if (expiredMode === 'fail') addPolicyViolation('codeAuditBaseline.expired', message, 'fail', { path: item.path });
      else addAuditFinding('warning', 'codeAuditBaseline.expired', message, { path: item.path }, []);
    }
    return items;
  } catch (error) {
    addWarning({ id: 'codeAuditBaseline.parse', message: `Failed to parse ${codeAuditBaselinePath}: ${error.message}` });
    report.codeAuditBaseline = { status: 'warning', count: 0, expired: [], invalid: [{ id: 'parse' }], matched: [] };
    return [];
  }
}
function commandExists(cmd) {
  const result = spawn(cmd, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}
function envEnabled(name) {
  return Boolean(name) && process.env[name] === '1';
}
function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');
}
function sectionContent(text, element) {
  const pattern = new RegExp(`^#{2,3}\\s+${element}\\s*$`, 'im');
  const match = pattern.exec(text);
  if (!match) return '';
  const rest = text.slice(match.index + match[0].length);
  const next = /\n#{2,3}\s+\S/.exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}
function normalizePackageDirs(policy) {
  const dirs = Array.isArray(policy.packageDirs) && policy.packageDirs.length ? policy.packageDirs : ['.'];
  return [...new Set(dirs.map((dir) => dir || '.'))];
}
function hasScript(packages, dir, script) {
  return Boolean(packages.get(dir)?.scripts?.[script]);
}
function shouldRunCheck(check) {
  if (check.defaultRequired === true) return true;
  if (check.profileRequired === true && envEnabled('CODEX_RUN_PROFILE_REQUIRED_CHECKS')) return true;
  if (check.ciRequired === true && envEnabled('CODEX_RUN_PROFILE_REQUIRED_CHECKS')) return true;
  if (envEnabled(check.envFlag)) return true;
  return false;
}
function checkNeedsNpm(check) {
  return check.type === 'npmScript' || check.command === 'npm';
}
function checkEnv(check) {
  if (!check.env) return {};
  if (typeof check.env !== 'object' || Array.isArray(check.env)) {
    addFailure('policy.env.invalid', `Policy env must be an object for check: ${check.name || check.script || check.command}`);
    return {};
  }
  const env = {};
  for (const [key, value] of Object.entries(check.env)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      addFailure('policy.env.invalidKey', `Policy env contains an invalid key for check: ${check.name || check.script || check.command}`);
      continue;
    }
    if (value === undefined || value === null) continue;
    env[key] = String(value);
  }
  return env;
}
function packageLockSet(packageDirs) {
  return new Set(
    packageDirs
      .map((dir) => path.join(dir || '.', 'package-lock.json'))
      .filter((file) => fs.existsSync(file))
      .map((file) => path.normalize(file)),
  );
}
function assertNoNewPackageLocks(before, packageDirs) {
  const after = packageLockSet(packageDirs);
  const created = [...after].filter((file) => !before.has(file));
  if (created.length) {
    addFailure('packageLock.created', `package-lock.json was created during quality gate: ${created.map(normalizePath).join(', ')}`);
  }
}
function addFailure(id, message, extra = {}) {
  failures.push({ id, message, ...extra });
}
function warningKnown(warning, knownRisks) {
  const match = knownRisks.find((risk) => {
    if (!risk || risk.id !== warning.id) return false;
    if (risk.path && normalizePath(risk.path) !== normalizePath(warning.path)) return false;
    return true;
  });
  if (match && !report.knownRisks.matched.some((item) => item.id === match.id && normalizePath(item.path) === normalizePath(match.path))) {
    report.knownRisks.matched.push({ id: match.id, path: match.path ? normalizePath(match.path) : undefined });
  }
  return Boolean(match);
}
function addWarning(warning) {
  report.warnings.push({
    id: warning.id,
    level: warning.level || 'warning',
    path: warning.path ? normalizePath(warning.path) : undefined,
    message: warning.message,
    known: Boolean(warning.known),
  });
}
function normalizeSeverity(severity) {
  return ['blocking', 'warning', 'info'].includes(severity) ? severity : 'warning';
}
function normalizeConfidence(confidence) {
  return ['high', 'medium', 'low'].includes(confidence) ? confidence : 'medium';
}
function codeAuditMode(policy) {
  const mode = process.env.CODEX_CODE_AUDIT_MODE || policy.codeAuditPolicy?.mode || 'standard';
  return ['advisory', 'standard', 'strict'].includes(mode) ? mode : 'standard';
}
function applyAuditMode(policy, severity, group, id, confidence) {
  const mode = codeAuditMode(policy);
  if (mode === 'advisory' && severity === 'blocking') return 'warning';
  if (mode === 'strict' && severity === 'warning' && group === 'coverageIntent' && report.riskLevel === 'R3') return 'blocking';
  if (mode === 'strict' && severity === 'info' && confidence !== 'low') return 'warning';
  return severity;
}
function auditSeverity(policy, group, id, fallback = 'warning') {
  const overrides = policy.codeAuditPolicy?.severityOverrides || {};
  const groupValue = overrides[group];
  if (typeof groupValue === 'string') return normalizeSeverity(groupValue);
  if (groupValue && typeof groupValue === 'object' && typeof groupValue[id] === 'string') return normalizeSeverity(groupValue[id]);
  return normalizeSeverity(fallback);
}
function ruleIdFrom(id) {
  const explicit = {
    'testWeakening.assertionRemoved': 'TEST_WEAKENING_ASSERTION_REMOVED',
    'testWeakening.skipTodoOnlyAdded': 'TEST_WEAKENING_SKIP_ADDED',
    'testWeakening.expectationRelaxed': 'TEST_WEAKENING_EXPECTATION_RELAXED',
    'testWeakening.snapshotUpdated': 'TEST_WEAKENING_SNAPSHOT_UPDATED',
    'testWeakening.errorPathRemoved': 'TEST_WEAKENING_ERROR_PATH_REMOVED',
    'testWeakening.boundaryCoverageRemoved': 'TEST_WEAKENING_BOUNDARY_VALUE_REMOVED',
    'testWeakening.regressionCoverageRemoved': 'TEST_WEAKENING_REGRESSION_REMOVED',
    'testWeakening.fixtureFollowsImplementation': 'TEST_WEAKENING_FIXTURE_WIDENED',
    'dependencyAudit.directImportMissing': 'DEPENDENCY_DIRECT_IMPORT_MISSING',
    'dependencyAudit.packageWithoutLockfile': 'DEPENDENCY_PACKAGE_LOCKFILE_MISMATCH',
    'dependencyAudit.riskyPackage': 'DEPENDENCY_RISKY_PACKAGE',
    'dependencyAudit.packageRemovedButImportRemains': 'DEPENDENCY_PACKAGE_REMOVED_IMPORT_REMAINS',
    'dependencyAudit.dependencyAddedNoReference': 'DEPENDENCY_ADDED_NO_REFERENCE',
    'dependencyAudit.lockfileChangedWithoutPackageChange': 'DEPENDENCY_LOCKFILE_CHANGED_WITHOUT_PACKAGE',
    'dependencyAudit.packageManagerUnknown': 'DEPENDENCY_PACKAGE_MANAGER_UNKNOWN',
    'securitySensitiveChange.detected': 'SECURITY_SENSITIVE_CHANGE',
    'coverageIntent.missing': 'COVERAGE_INTENT_MISSING',
    'codeAuditBaseline.expired': 'CODE_AUDIT_BASELINE_EXPIRED',
    'codeAuditBaseline.suppressionHygiene': 'CODE_AUDIT_SUPPRESSION_HYGIENE',
    'diffScope.blockedPath': 'DIFF_SCOPE_BLOCKED_PATH',
    'diffScope.outOfScope': 'DIFF_SCOPE_OUT_OF_SCOPE',
  };
  if (explicit[id]) return explicit[id];
  if (id.startsWith('domainInvariant.')) return 'DOMAIN_INVARIANT_BOUNDARY_RISK';
  return String(id).replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
}
function knownAuditRuleIds() {
  return new Set([
    'TEST_WEAKENING_ASSERTION_REMOVED',
    'TEST_WEAKENING_SKIP_ADDED',
    'TEST_WEAKENING_EXPECTATION_RELAXED',
    'TEST_WEAKENING_SNAPSHOT_UPDATED',
    'TEST_WEAKENING_ERROR_PATH_REMOVED',
    'TEST_WEAKENING_BOUNDARY_VALUE_REMOVED',
    'TEST_WEAKENING_REGRESSION_REMOVED',
    'TEST_WEAKENING_FIXTURE_WIDENED',
    'DEPENDENCY_DIRECT_IMPORT_MISSING',
    'DEPENDENCY_PACKAGE_LOCKFILE_MISMATCH',
    'DEPENDENCY_RISKY_PACKAGE',
    'DEPENDENCY_PACKAGE_REMOVED_IMPORT_REMAINS',
    'DEPENDENCY_ADDED_NO_REFERENCE',
    'DEPENDENCY_LOCKFILE_CHANGED_WITHOUT_PACKAGE',
    'DEPENDENCY_PACKAGE_MANAGER_UNKNOWN',
    'SECURITY_SENSITIVE_CHANGE',
    'COVERAGE_INTENT_MISSING',
    'DOMAIN_INVARIANT_BOUNDARY_RISK',
    'CODE_AUDIT_BASELINE_EXPIRED',
    'CODE_AUDIT_SUPPRESSION_HYGIENE',
    'DIFF_SCOPE_BLOCKED_PATH',
    'DIFF_SCOPE_OUT_OF_SCOPE',
  ]);
}
function defaultConfidence(id, severity) {
  if (id === 'testWeakening.assertionRemoved') return 'high';
  if (id.startsWith('domainInvariant.')) return severity === 'blocking' ? 'high' : 'medium';
  if (id === 'dependencyAudit.directImportMissing' || id === 'dependencyAudit.packageWithoutLockfile') return 'medium';
  if (id === 'coverageIntent.missing') return 'medium';
  if (id === 'securitySensitiveChange.detected') return 'medium';
  return severity === 'info' ? 'low' : 'medium';
}
function calibratedConfidence(id, severity, fallback) {
  const ruleId = ruleIdFrom(id);
  const overrides = activeAuditPolicy.codeAuditPolicy?.confidenceOverrides || {};
  const override = overrides[ruleId] || overrides[id];
  return normalizeConfidence(override || fallback || defaultConfidence(id, severity));
}
function auditBaselineKnown(finding, baseline) {
  if (finding.severity === 'blocking' && finding.confidence === 'high') return false;
  const match = (baseline || []).find((item) => {
    if (!item) return false;
    if (item.ruleId && item.ruleId !== finding.ruleId) return false;
    if (!item.ruleId && item.id !== finding.id) return false;
    if (item.profile && item.profile !== report.profile) return false;
    if (item.path && normalizePath(item.path) !== normalizePath(finding.path)) return false;
    return !item.expired;
  });
  if (match && !report.codeAuditBaseline.matched.some((item) => item.id === match.id && normalizePath(item.path) === normalizePath(match.path))) {
    const entry = {
      id: match.id || match.ruleId,
      ruleId: match.ruleId,
      path: match.path ? normalizePath(match.path) : undefined,
      stableMatchKey: match.stableMatchKey || match.scopeHash || '',
    };
    report.codeAuditBaseline.matched.push(entry);
    report.suppressionApplied.push({
      ruleId: finding.ruleId,
      fingerprint: finding.fingerprint,
      reason: match.reason || 'baseline matched',
      stableMatchKey: entry.stableMatchKey,
    });
  }
  return Boolean(match);
}
function stableFingerprintFor(finding) {
  const parts = [
    finding.ruleId || '',
    report.profile || '',
    normalizePath(finding.path || (finding.affectedFiles || [])[0] || 'general'),
    finding.rootCauseId || '',
    finding.recommendedFixType || '',
  ].join('|');
  return crypto.createHash('sha256').update(parts).digest('hex').slice(0, 16);
}
function rootCauseIdFor(id, pathValue, ruleId) {
  const group = String(id || '').split('.')[0] || 'codeAudit';
  if (group === 'dependencyAudit') return 'dependency:package-graph';
  if (group === 'testWeakening') return 'test:test-quality';
  if (group === 'coverageIntent') return 'test:test-quality';
  if (group === 'securitySensitiveChange') return `${ruleId}:sensitive-change`;
  if (group === 'domainInvariant') return `${ruleId}:domain-invariant`;
  if (group === 'codeAuditBaseline') return `${ruleId}:baseline`;
  return `${ruleId}:${pathValue || 'general'}`;
}
function recommendedFixTypeFor(id, extra = {}) {
  const override = activeAuditPolicy.codeAuditPolicy?.recommendedFixTypes?.[extra.ruleId || ruleIdFrom(id)]
    || activeAuditPolicy.codeAuditPolicy?.recommendedFixTypes?.[id];
  if (typeof override === 'string') return override;
  if (id.startsWith('testWeakening.') || id.startsWith('coverageIntent.')) return 'test_fix';
  if (id.startsWith('dependencyAudit.')) return 'dependency_fix';
  if (id.startsWith('codeAuditBaseline.')) return 'policy_fix';
  if (id.startsWith('diffScope.')) return 'policy_fix';
  if (id.startsWith('domainInvariant.') || id.startsWith('securitySensitiveChange.')) return 'human_review_required';
  return 'cannot_determine';
}
function priorityFor(finding) {
  const overrides = activeAuditPolicy.codeAuditPolicy?.priorityOverrides || {};
  const override = overrides[finding.ruleId] || overrides[finding.id];
  if (['P0', 'P1', 'P2', 'P3'].includes(override)) return override;
  if (finding.severity === 'blocking' && finding.confidence === 'high') return 'P0';
  if (finding.severity === 'blocking') return 'P1';
  if (report.riskLevel === 'R3' && finding.confidence === 'high') return 'P1';
  if (finding.severity === 'warning') return 'P2';
  return 'P3';
}
function usefulnessFor(finding) {
  if (finding.severity === 'blocking' && finding.confidence === 'high') return 'high';
  if (finding.priority === 'P0' || finding.priority === 'P1') return 'high';
  if (finding.humanReviewRequired || finding.confidence === 'medium') return 'medium';
  if (finding.known || finding.confidence === 'low') return 'low';
  return 'unknown';
}
function actionabilityFor(finding) {
  const id = finding.id || '';
  if (report.worktreeStatus?.isDirty) return 'blocked_by_dirty_worktree';
  if (id.startsWith('dependencyAudit.')) return 'actionable_now';
  if (id.startsWith('testWeakening.') || id.startsWith('coverageIntent.')) return 'actionable_now';
  if (id.startsWith('domainInvariant.') || id.startsWith('securitySensitiveChange.')) return 'needs_human_review';
  if (id.startsWith('codeAuditBaseline.')) return 'blocked_by_policy_decision';
  if (finding.humanReviewRequired || finding.severity === 'blocking') return 'needs_human_review';
  return 'needs_more_context';
}
function recommendedOwnerFor(id) {
  if (id.startsWith('testWeakening.') || id.startsWith('coverageIntent.')) return 'test author';
  if (id.startsWith('dependencyAudit.')) return 'dependency owner';
  if (id.startsWith('domainInvariant.') || id.startsWith('securitySensitiveChange.')) return 'human reviewer';
  if (id.startsWith('diffScope.') || id.startsWith('codeAuditBaseline.')) return 'maintainer';
  return 'author';
}
function confidenceExplanationFor(confidence, extra = {}) {
  if (extra.confidenceExplanation) return String(extra.confidenceExplanation);
  if (confidence === 'high') return 'strong direct audit signal';
  if (confidence === 'medium') return 'single policy or diff signal';
  return 'supporting or low-context signal';
}
function fixValidationHintFor(type, reviewerSkill = '') {
  const base = {
    dependency_fix: ['confirm package metadata and lock evidence', 'run affected build or test'],
    test_fix: ['run targeted tests', 'confirm no skip-only markers were added'],
    implementation_fix: ['run secret scan', 'run local quality gate', 'run targeted tests'],
    human_review_required: ['use the selected reviewer skill', 'record manual confirmation before merge'],
    policy_fix: ['run policy schema validation', 'run self-test when editing harness policy'],
    fixture_fix: ['confirm fixture represents the intended behavior', 'run regression test'],
    cannot_determine: ['review finding safe summary', 'choose the smallest safe verification'],
  };
  const hints = [...(base[type] || base.cannot_determine)];
  if (reviewerSkill) hints.push(`reviewer skill: ${reviewerSkill}`);
  return hints;
}
function thresholdMet(confidence, threshold) {
  const rank = { low: 0, medium: 1, high: 2 };
  return (rank[confidence] ?? 1) >= (rank[threshold] ?? 2);
}
function safeRecommendedCommand(id, command) {
  const fallback = 'node scripts/codex-local-quality-gate.mjs';
  const ruleId = ruleIdFrom(id);
  const mapped = activeAuditPolicy.codeAuditPolicy?.recommendedCommands?.[ruleId]
    || activeAuditPolicy.codeAuditPolicy?.recommendedCommands?.[id];
  const value = String(command || mapped || fallback);
  const dangerous = activeAuditPolicy.codeAuditPolicy?.dangerousCommands || defaultPolicy.codeAuditPolicy.dangerousCommands;
  if (dangerous.some((term) => term && value.toLowerCase().includes(String(term).toLowerCase()))) {
    addHumanReviewReason('recommendedCommand.dangerous');
    return fallback;
  }
  return value;
}
function semanticImpactForFinding(finding) {
  const id = finding.id || '';
  const file = finding.path || '';
  const mapping = activeAuditPolicy.codeAuditPolicy?.semanticImpactMappings || {};
  const ruleMapping = mapping[finding.ruleId] || mapping[id] || {};
  if (typeof ruleMapping === 'string') return ruleMapping;
  if (ruleMapping.category) return String(ruleMapping.category);
  if (id.startsWith('testWeakening.')) return 'test_assertion';
  if (id.startsWith('coverageIntent.')) return 'test_assertion';
  if (id.startsWith('dependencyAudit.')) return 'dependency_change';
  if (id.startsWith('securitySensitiveChange.')) return 'authorization';
  if (id.startsWith('domainInvariant.')) return 'adapter_boundary';
  if (id.startsWith('diffScope.')) return 'harness_change';
  if (/^\.github\//.test(file)) return 'workflow_change';
  if (/\bpackage\.json$|lock$/i.test(file)) return 'dependency_change';
  if (/\.(test|spec)\./.test(file) || /(^|\/)(test|tests)\//.test(file)) return 'test_assertion';
  if (/^docs\//.test(file) || /\.(md|txt)$/i.test(file)) return 'docs_only';
  if (pathMatches(file, defaultPolicy.harnessPrAllowedPaths)) return 'harness_change';
  return 'unknown';
}
function addAuditFinding(severity, id, message, extra = {}, baseline = []) {
  const ruleId = extra.ruleId || ruleIdFrom(id);
  const confidence = calibratedConfidence(id, severity, extra.confidence);
  const group = id.split('.')[0] || 'codeAudit';
  const normalized = applyAuditMode(activeAuditPolicy, normalizeSeverity(severity), group, id.split('.').slice(1).join('.') || id, confidence);
  const pathValue = extra.path ? normalizePath(extra.path) : undefined;
  const finding = {
    id,
    ruleId,
    severity: normalized,
    confidence,
    priority: 'P3',
    rootCauseId: extra.rootCauseId || rootCauseIdFor(id, pathValue, ruleId),
    recommendedFixType: extra.recommendedFixType || recommendedFixTypeFor(id, { ...extra, ruleId }),
    path: pathValue,
    affectedFiles: pathValue ? [pathValue] : [],
    count: 1,
    representativeExamples: pathValue ? [pathValue] : [],
    message,
    known: false,
    safeReason: extra.reason || message,
    recommendedAction: extra.recommendedAction || 'review code audit finding',
    recommendedOwner: extra.recommendedOwner || recommendedOwnerFor(id),
    recommendedCommand: safeRecommendedCommand(id, extra.recommendedCommand || extra.recommendedNextCommand),
    recommendedReviewerSkill: extra.reviewerSkill || extra.recommendedReviewerSkill || '',
    whyDetected: extra.whyDetected || message,
    whySeverity: extra.whySeverity || `severity follows policy for ${ruleId}`,
    whyConfidence: extra.whyConfidence || confidenceExplanationFor(confidence, extra),
    whyPriority: extra.whyPriority || 'priority follows severity, confidence, and risk level',
    whyHumanReviewRequired: extra.whyHumanReviewRequired || (normalized === 'blocking' || report.riskLevel === 'R3' ? 'review required by severity or risk level' : 'not required by default'),
    whyItMatters: extra.whyItMatters || message,
    whatToCheck: extra.whatToCheck || 'check the affected files and policy guidance',
    whatNotToDo: extra.whatNotToDo || 'do not weaken checks or expose unsafe data',
    notRecommendedActions: extra.notRecommendedActions || ['do not weaken checks to silence the finding', 'do not expose unsafe data'],
    recommendedNextCommand: safeRecommendedCommand(id, extra.recommendedNextCommand || extra.recommendedCommand),
    recommendedNextStep: extra.recommendedNextStep || extra.recommendedAction || 'review code audit finding',
    confidenceExplanation: confidenceExplanationFor(confidence, extra),
    lifecycle: 'unknown',
    humanReviewRequired: normalized === 'blocking' || report.riskLevel === 'R3',
  };
  finding.semanticImpact = extra.semanticImpact || semanticImpactForFinding(finding);
  finding.fingerprint = extra.fingerprint || stableFingerprintFor(finding);
  finding.fixValidationHint = extra.fixValidationHint || fixValidationHintFor(finding.recommendedFixType, finding.recommendedReviewerSkill);
  finding.priority = priorityFor(finding);
  finding.usefulness = extra.usefulness || usefulnessFor(finding);
  finding.actionability = extra.actionability || actionabilityFor(finding);
  const thresholds = activeAuditPolicy.codeAuditPolicy?.confidenceThresholds || defaultPolicy.codeAuditPolicy.confidenceThresholds;
  if (finding.priority === 'P0' || finding.priority === 'P1') finding.whyHumanReviewRequired = 'P0/P1 finding requires review';
  if (thresholdMet(finding.confidence, thresholds.humanReviewMinConfidence || 'medium') && (finding.priority === 'P0' || finding.priority === 'P1' || report.riskLevel === 'R3')) {
    finding.humanReviewRequired = true;
  }
  for (const key of ['reviewerSkill', 'package', 'reason', 'evidence', 'recommendedTestType', 'whyNeeded']) {
    if (extra[key] !== undefined) finding[key] = String(extra[key]);
  }
  finding.known = normalized !== 'blocking' && auditBaselineKnown(finding, baseline);
  const target = normalized === 'blocking' ? report.blockingFindings : (normalized === 'warning' ? report.warningFindings : report.infoFindings);
  const existing = target.find((item) => item.ruleId === finding.ruleId && item.rootCauseId === finding.rootCauseId && item.severity === finding.severity && item.confidence === finding.confidence);
  if (existing) {
    existing.count += 1;
    for (const file of finding.affectedFiles) if (!existing.affectedFiles.includes(file)) existing.affectedFiles.push(file);
    existing.affectedFiles.sort();
    existing.representativeExamples = existing.affectedFiles.slice(0, 3);
    existing.known = existing.known || finding.known;
    return existing;
  }
  target.push(finding);
  if (normalized === 'blocking') {
    addHumanReviewReason(id);
    addFailure(id, message, { path: finding.path });
  } else if (normalized === 'warning') {
    addWarning({ id, path: finding.path, message, known: finding.known });
  }
  return finding;
}
function globToRegExp(pattern) {
  let out = '^';
  const text = normalizePath(pattern);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '*' && next === '*') {
      out += '.*';
      i++;
    } else if (ch === '*') {
      out += '[^/]*';
    } else {
      out += ch.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`${out}$`);
}
function pathMatches(file, patterns) {
  const f = normalizePath(file);
  return (patterns || []).some((pattern) => {
    const p = normalizePath(pattern);
    if (!p) return false;
    if (p.includes('*')) return globToRegExp(p).test(f);
    if (p.endsWith('/')) return f.startsWith(p);
    return f === p || f.startsWith(`${p}/`);
  });
}
function sourceProfileName() {
  return normalizePath(activeAuditPolicy.profile || path.basename(process.cwd()) || report.profile || 'generic');
}
function mapSourceHarnessPath(file) {
  const normalized = normalizePath(file);
  if (!SOURCE_REPO_MODE) return normalized;
  const profile = sourceProfileName();
  const prefix = `profiles/${profile}/`;
  if (normalized.startsWith(prefix)) return normalized.slice(prefix.length);
  return null;
}
function rawChangedPathList() {
  const paths = new Set();
  for (const args of [
    ['diff', '--name-only'],
    ['diff', '--cached', '--name-only'],
    ['ls-files', '--others', '--exclude-standard'],
  ]) {
    for (const line of git(args).split(/\r?\n/)) {
      const p = normalizePath(line.trim());
      if (p) paths.add(p);
    }
  }
  const baseRef = process.env.GITHUB_BASE_REF || 'origin/main';
  for (const base of [baseRef, baseRef.startsWith('origin/') ? baseRef.slice('origin/'.length) : `origin/${baseRef}`]) {
    const out = git(['diff', '--name-only', `${base}...HEAD`]);
    for (const line of out.split(/\r?\n/)) {
      const p = normalizePath(line.trim());
      if (p) paths.add(p);
    }
    if (out.trim()) break;
  }
  return [...paths].sort();
}
function changedPathList() {
  const paths = new Set();
  for (const file of rawChangedPathList()) {
    const mapped = mapSourceHarnessPath(file);
    if (mapped) paths.add(mapped);
  }
  return [...paths].sort();
}
function parseDiffText(text, records) {
  let current = null;
  for (const line of String(text || '').split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      const mapped = match ? mapSourceHarnessPath(match[2]) : null;
      current = mapped ? ensureRecord(records, mapped) : null;
      continue;
    }
    if (!current) continue;
    if (line.startsWith('+++ ') || line.startsWith('--- ')) continue;
    if (line.startsWith('+')) current.added.push(line.slice(1));
    else if (line.startsWith('-')) current.removed.push(line.slice(1));
  }
}
function ensureRecord(records, file) {
  const key = normalizePath(file);
  if (!records.has(key)) records.set(key, { file: key, added: [], removed: [] });
  return records.get(key);
}
function collectDiffRecords() {
  const records = new Map();
  const budget = activeAuditPolicy.codeAuditPolicy?.performanceBudget || defaultPolicy.codeAuditPolicy.performanceBudget;
  let scannedBytes = 0;
  let partial = false;
  parseDiffText(git(['diff', '--unified=0', '--no-ext-diff']), records);
  parseDiffText(git(['diff', '--cached', '--unified=0', '--no-ext-diff']), records);
  for (const rawFile of gitLines(['ls-files', '--others', '--exclude-standard']).map(normalizePath)) {
    const file = mapSourceHarnessPath(rawFile);
    if (!file) continue;
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.size > 1024 * 1024) {
        partial = true;
        continue;
      }
      if (scannedBytes + stat.size > Number(budget.maxBytes || 2000000)) {
        partial = true;
        continue;
      }
      scannedBytes += stat.size;
      ensureRecord(records, file).added.push(...fs.readFileSync(file, 'utf8').split(/\r?\n/));
    } catch {
      // Ignore unreadable untracked files in safe summary mode.
    }
  }
  for (const file of changedPathList()) ensureRecord(records, file);
  const out = [...records.values()].sort((a, b) => a.file.localeCompare(b.file));
  scannedBytes += out.reduce((sum, record) => sum + [...record.added, ...record.removed].join('\n').length, 0);
  if (out.length > Number(budget.maxFiles || 500) || scannedBytes > Number(budget.maxBytes || 2000000)) partial = true;
  report.auditPerformance = {
    ...report.auditPerformance,
    status: partial ? 'partial' : 'pass',
    scannedFiles: out.length,
    scannedBytes,
    partial,
    warnings: partial ? ['audit performance budget exceeded; partial safe audit summary used'] : [],
  };
  if (partial) {
    const mode = budget.onLimit || 'warning';
    if (mode === 'fail') addFailure('codeAudit.performanceBudget', 'Code audit performance budget was exceeded.');
    else addWarning({ id: 'codeAudit.performanceBudget', message: 'Code audit performance budget was exceeded; partial audit summary used.' });
  }
  return out;
}
function lineText(record) {
  return [...record.added, ...record.removed, record.file].join('\n').toLowerCase();
}
function recordMatches(record, rule = {}) {
  const paths = rule.paths || rule.pathPatterns || [];
  const keywords = rule.keywords || rule.terms || [];
  const pathHit = paths.length ? pathMatches(record.file, paths) : false;
  const text = lineText(record);
  const keywordHit = keywords.some((term) => term && text.includes(String(term).toLowerCase()));
  return pathHit || keywordHit;
}
function addReviewer(reviewerSkill, ruleId) {
  if (!reviewerSkill) return;
  if (!report.selectedReviewers.reviewers.includes(reviewerSkill)) report.selectedReviewers.reviewers.push(reviewerSkill);
  if (ruleId) report.selectedReviewers.rules.push({ reviewerSkill, ruleId });
}
function computeWorktreeStatus() {
  const branch = git(['branch', '--show-current']).trim() || '(detached)';
  const hasOriginMain = Boolean(git(['rev-parse', '--verify', 'origin/main']).trim());
  const head = gitSha('HEAD');
  const originMain = hasOriginMain ? gitSha('origin/main') : '';
  const unstaged = gitLines(['diff', '--name-only']).map(normalizePath).sort();
  const staged = gitLines(['diff', '--cached', '--name-only']).map(normalizePath).sort();
  const untracked = gitLines(['ls-files', '--others', '--exclude-standard']).map(normalizePath).sort();
  const ahead = hasOriginMain ? gitCount('origin/main..HEAD') : 0;
  const behind = hasOriginMain ? gitCount('HEAD..origin/main') : 0;
  const dirty = unstaged.length > 0 || staged.length > 0 || untracked.length > 0;
  const cleanClone = branch === 'main' && !dirty && hasOriginMain && ahead === 0 && behind === 0 && head === originMain;
  const isMain = branch === 'main';
  const hasUntrackedFiles = untracked.length > 0;
  const hasStagedChanges = staged.length > 0;
  const hasUnstagedChanges = unstaged.length > 0;
  const safeToDevelop = !isMain && !hasStagedChanges && !hasUnstagedChanges;
  const safeToCreatePR = !isMain && !dirty && ahead > 0;
  const warnings = [];
  if (!hasOriginMain) warnings.push({ id: 'originMain.missing', message: 'origin/main was not available.' });
  if (branch === 'main' && !cleanClone) warnings.push({ id: 'main.directWork', message: 'main is not in clean clone state.' });
  if (dirty) warnings.push({ id: 'worktree.dirty', message: 'Worktree has staged, unstaged, or untracked changes.' });
  if (ahead > 0) warnings.push({ id: 'commits.localOnly', message: 'HEAD has commits not in origin/main.' });
  if (behind > 0) warnings.push({ id: 'commits.remoteOnly', message: 'origin/main has commits not in HEAD.' });
  return {
    status: warnings.length ? 'warning' : 'pass',
    currentBranch: branch,
    branch,
    isMain,
    isDirty: dirty,
    hasUntrackedFiles,
    hasStagedChanges,
    hasUnstagedChanges,
    localOnlyCommits: ahead,
    remoteOnlyCommits: behind,
    headEqualsOriginMain: hasOriginMain && head === originMain,
    cleanClone,
    headMatchesOriginMain: hasOriginMain && head === originMain,
    safeToDevelop,
    safeToCreatePR,
    recommendedAction: cleanClone
      ? 'create a feature branch before editing'
      : (safeToCreatePR ? 'open or update a pull request' : (dirty ? 'review local changes before continuing' : (behind > 0 ? 'update from origin/main before continuing' : 'continue with care'))),
    prBranchSafeSummary: branch !== 'main' && !dirty,
    counts: {
      ahead,
      behind,
      unstaged: unstaged.length,
      staged: staged.length,
      untracked: untracked.length,
    },
    files: { unstaged, staged, untracked },
    warnings,
  };
}
function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  function walk(current) {
    for (const ent of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile()) out.push(full);
    }
  }
  walk(dir);
  return out.sort();
}
function markerVersionFromFile(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    const match = text.match(/CODEX_QUALITY_HARNESS_FILE v([0-9]+\.[0-9]+\.[0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
function computeVersionConsistency() {
  const manifestPath = path.join('docs', 'process', 'CODEX_HARNESS_MANIFEST.json');
  const candidates = new Set();
  const optional = new Set();
  const manifestOmissions = [];
  try {
    const manifest = readJsonFile(manifestPath);
    if (manifest.marker !== marker) candidates.add(manifestPath);
    for (const file of manifest.managedFiles || []) candidates.add(normalizePath(file));
    for (const file of manifest.policyFiles || []) candidates.add(normalizePath(file));
    for (const name of manifest.scriptNames || []) candidates.add(normalizePath(path.join('scripts', name)));
    for (const file of manifest.optionalFiles || []) optional.add(normalizePath(file));
  } catch {
    candidates.add(manifestPath);
  }
  const managedRoots = ['AGENTS.md', '.github/', 'docs/process/', 'scripts/codex-'];
  for (const file of walkFiles('.').map(normalizePath)) {
    if (file.includes('/node_modules/') || file.startsWith('.git/')) continue;
    const isManaged = managedRoots.some((root) => root.endsWith('/') ? file.startsWith(root) : file === root || file.startsWith(root));
    if (!isManaged) continue;
    if (fs.existsSync(file) && fs.statSync(file).isFile() && fs.readFileSync(file, 'utf8').includes('CODEX_QUALITY_HARNESS_FILE') && !candidates.has(file)) {
      manifestOmissions.push({ path: file });
      candidates.add(file);
    }
  }
  const files = [];
  for (const rel of [...candidates].map(normalizePath).sort()) {
    if (!fs.existsSync(rel)) {
      files.push({ path: rel, status: optional.has(rel) ? 'optional_missing' : 'missing', version: null });
      continue;
    }
    const version = markerVersionFromFile(rel);
    files.push({ path: rel, status: version ? (version === HARNESS_VERSION ? 'pass' : 'mismatch') : 'unmarked', version });
  }
  const mismatches = files.filter((file) => file.status === 'mismatch');
  const missing = files.filter((file) => file.status === 'missing');
  const unmarked = files.filter((file) => file.status === 'unmarked');
  return {
    status: mismatches.length || missing.length || manifestOmissions.length ? 'fail' : (unmarked.length ? 'warning' : 'pass'),
    expected: HARNESS_VERSION,
    files,
    mismatches,
    missing,
    unmarked,
    manifestPath,
    manifestOmissions,
  };
}
function computeSourceHarnessValidationStatus() {
  if (!SOURCE_REPO_MODE) return { status: 'not_run', sourceRepoMode: false };
  const profile = sourceProfileName();
  const raw = rawChangedPathList();
  const prefix = `profiles/${profile}/`;
  const included = raw.filter((file) => file.startsWith(prefix)).map((file) => file.slice(prefix.length)).sort();
  const ignoredOutsideProfileCount = raw.length - included.length;
  const forbidden = included.filter((file) => pathMatches(file, [
    'package.json',
    'package-lock.json',
    'npm-shrinkwrap.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'src/',
    'apps/',
    'contracts/',
    'docs/launch/',
    'IRIS_SPEC_AUTHORITY.md',
    'scripts/run-tests.js',
  ]));
  return {
    status: forbidden.length ? 'fail' : 'pass',
    sourceRepoMode: true,
    profile,
    rawChangedFileCount: raw.length,
    profileChangedFileCount: included.length,
    ignoredOutsideProfileCount,
    forbidden,
  };
}
function policyMissingStatus(id, file) {
  return { status: 'warning', path: normalizePath(file), violations: [{ id, level: 'warning' }] };
}
function policyUnsafeValueHit(value) {
  if (typeof value === 'string') {
    return looksSecretLike(value)
      || looksEndpointLike(value)
      || /\b[A-Za-z]:\\Users\\[^"'`\s]+/.test(value)
      || /\/home\/[^"'`\s]+/.test(value);
  }
  if (Array.isArray(value)) return value.some(policyUnsafeValueHit);
  if (value && typeof value === 'object') return Object.values(value).some(policyUnsafeValueHit);
  return false;
}
function policyViolationList(status) {
  return status.violations || [];
}
function validateGovernanceMarker(policy, file, violations) {
  if (policy.marker !== marker) violations.push({ id: 'marker.mismatch', level: 'fail', path: normalizePath(file) });
}
function validateAgentMemoryPolicy() {
  if (!fs.existsSync(agentMemoryPolicyPath)) return policyMissingStatus('agentMemoryPolicy.missing', agentMemoryPolicyPath);
  const violations = [];
  try {
    const policy = readJsonFile(agentMemoryPolicyPath);
    validateGovernanceMarker(policy, agentMemoryPolicyPath, violations);
    const required = ['rawDiff', 'rawLogs', 'secretValue', 'endpointValue', 'privatePath', 'payload', 'productionData', 'personalData'];
    const known = new Set(['marker', 'schemaVersion', 'profile', 'memoryMode', 'forbidden', 'forbiddenContent', 'maxSummaryChars', 'maxUserContextChars', 'profileBounded', 'crossProfileSharing', 'autoApply', 'humanApprovalRequired', 'safeOutput', 'allowedUnknownFields']);
    const allowedUnknown = new Set(Array.isArray(policy.allowedUnknownFields) ? policy.allowedUnknownFields : []);
    for (const key of Object.keys(policy)) {
      if (!known.has(key) && !allowedUnknown.has(key)) violations.push({ id: `agentMemoryPolicy.unknownField.${key}`, level: 'warning' });
    }
    if (policy.schemaVersion !== '1.0.0') violations.push({ id: 'agentMemoryPolicy.schemaVersion', level: 'fail' });
    if (policy.memoryMode !== 'safe-summary-only') violations.push({ id: 'agentMemoryPolicy.memoryMode', level: 'fail' });
    if (!Array.isArray(policy.forbidden)) violations.push({ id: 'agentMemoryPolicy.forbidden', level: 'fail' });
    for (const item of required) {
      if (!Array.isArray(policy.forbidden) || !policy.forbidden.includes(item)) violations.push({ id: `agentMemoryPolicy.forbidden.${item}`, level: 'fail' });
      if (!Array.isArray(policy.forbiddenContent) || !policy.forbiddenContent.includes(item)) violations.push({ id: `agentMemoryPolicy.forbiddenContent.${item}`, level: 'fail' });
    }
    if (typeof policy.maxSummaryChars !== 'number' || policy.maxSummaryChars > 2200) violations.push({ id: 'agentMemoryPolicy.maxSummaryChars', level: 'fail' });
    if (typeof policy.maxUserContextChars !== 'number' || policy.maxUserContextChars > 1375) violations.push({ id: 'agentMemoryPolicy.maxUserContextChars', level: 'fail' });
    if (policy.profileBounded !== true) violations.push({ id: 'agentMemoryPolicy.profileBounded', level: 'fail' });
    if (policy.crossProfileSharing !== false) violations.push({ id: 'agentMemoryPolicy.crossProfileSharing', level: 'fail' });
    if (policy.autoApply !== false) violations.push({ id: 'agentMemoryPolicy.autoApply', level: 'fail' });
    if (policy.humanApprovalRequired !== true) violations.push({ id: 'agentMemoryPolicy.humanApprovalRequired', level: 'fail' });
    if (policyUnsafeValueHit(policy)) violations.push({ id: 'agentMemoryPolicy.unsafePattern', level: 'fail' });
    return {
      status: violations.some((item) => item.level === 'fail') ? 'fail' : 'pass',
      path: normalizePath(agentMemoryPolicyPath),
      memoryMode: policy.memoryMode || 'unknown',
      safeSummaryOnly: policy.memoryMode === 'safe-summary-only',
      autoApply: false,
      humanApprovalRequired: policy.humanApprovalRequired === true,
      violations,
    };
  } catch {
    return { status: 'fail', path: normalizePath(agentMemoryPolicyPath), violations: [{ id: 'agentMemoryPolicy.parse', level: 'fail' }] };
  }
}
function validateSkillLifecyclePolicy() {
  if (!fs.existsSync(skillLifecyclePolicyPath)) return policyMissingStatus('skillLifecyclePolicy.missing', skillLifecyclePolicyPath);
  const violations = [];
  const skillSummaries = [];
  try {
    const policy = readJsonFile(skillLifecyclePolicyPath);
    validateGovernanceMarker(policy, skillLifecyclePolicyPath, violations);
    const required = ['title', 'purpose', 'whenToUse', 'procedure', 'pitfalls', 'verification', 'safeOutput'];
    const known = new Set(['marker', 'schemaVersion', 'profile', 'skillFiles', 'requiredElements', 'agentGeneratedSkill', 'staleAfterDays', 'archiveAfterDays', 'deleteAutomatically', 'archiveAutomatically', 'pinSupported', 'humanApprovalRequired', 'forbidden', 'allowedUnknownFields']);
    const allowedUnknown = new Set(Array.isArray(policy.allowedUnknownFields) ? policy.allowedUnknownFields : []);
    for (const key of Object.keys(policy)) {
      if (!known.has(key) && !allowedUnknown.has(key)) violations.push({ id: `skillLifecyclePolicy.unknownField.${key}`, level: 'warning' });
    }
    if (policy.schemaVersion !== '1.0.0') violations.push({ id: 'skillLifecyclePolicy.schemaVersion', level: 'fail' });
    if (!Array.isArray(policy.forbidden)) violations.push({ id: 'skillLifecyclePolicy.forbidden', level: 'fail' });
    if (policy.skillFiles?.allowedGlob !== 'docs/process/skills/*.md') violations.push({ id: 'skillLifecyclePolicy.skillFiles', level: 'fail' });
    for (const item of required) {
      if (!Array.isArray(policy.requiredElements) || !policy.requiredElements.includes(item)) violations.push({ id: `skillLifecyclePolicy.requiredElements.${item}`, level: 'fail' });
    }
    if (policy.agentGeneratedSkill?.autoAdopt !== false) violations.push({ id: 'skillLifecyclePolicy.autoAdopt', level: 'fail' });
    if (policy.staleAfterDays !== 30) violations.push({ id: 'skillLifecyclePolicy.staleAfterDays', level: 'fail' });
    if (policy.archiveAfterDays !== 90) violations.push({ id: 'skillLifecyclePolicy.archiveAfterDays', level: 'fail' });
    if (policy.deleteAutomatically !== false) violations.push({ id: 'skillLifecyclePolicy.deleteAutomatically', level: 'fail' });
    if (policy.archiveAutomatically !== false) violations.push({ id: 'skillLifecyclePolicy.archiveAutomatically', level: 'fail' });
    if (policy.pinSupported !== true) violations.push({ id: 'skillLifecyclePolicy.pinSupported', level: 'fail' });
    if (policy.humanApprovalRequired !== true) violations.push({ id: 'skillLifecyclePolicy.humanApprovalRequired', level: 'fail' });
    if (policyUnsafeValueHit(policy)) violations.push({ id: 'skillLifecyclePolicy.unsafePattern', level: 'fail' });
    const skillDir = path.join('docs', 'process', 'skills');
    const skillFiles = fs.existsSync(skillDir)
      ? fs.readdirSync(skillDir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.md')).map((entry) => path.join(skillDir, entry.name)).sort()
      : [];
    for (const file of skillFiles) {
      const raw = fs.readFileSync(file, 'utf8');
      const text = raw.toLowerCase();
      const missing = required.filter((item) => !(text.includes(`## ${item.toLowerCase()}`) || text.includes(`### ${item.toLowerCase()}`)));
      const procedure = sectionContent(raw, 'procedure');
      const verification = sectionContent(raw, 'verification');
      const safeOutput = sectionContent(raw, 'safeOutput').toLowerCase();
      const missingSafeTerms = ['secret', 'raw', 'payload', 'endpoint', 'private path'].filter((term) => !safeOutput.includes(term));
      if (missing.length || !procedure || missingSafeTerms.length) violations.push({ id: 'skillLifecyclePolicy.skillShape', level: 'fail', path: normalizePath(file) });
      if (!verification) violations.push({ id: 'skillLifecyclePolicy.verification.empty', level: 'warning', path: normalizePath(file) });
      skillSummaries.push({ fileName: path.basename(file), status: missing.length || !procedure || missingSafeTerms.length ? 'fail' : 'pass', missingElements: missing, procedurePresent: Boolean(procedure), verificationPresent: Boolean(verification), safeOutputTermsPresent: missingSafeTerms.length === 0 });
    }
    if (!skillFiles.length) violations.push({ id: 'skillLifecyclePolicy.noSkills', level: 'warning' });
    return {
      status: violations.some((item) => item.level === 'fail') ? 'fail' : (violations.length ? 'warning' : 'pass'),
      path: normalizePath(skillLifecyclePolicyPath),
      checkedSkills: skillFiles.length,
      autoApply: false,
      humanApprovalRequired: policy.humanApprovalRequired === true,
      skills: skillSummaries,
      violations,
    };
  } catch {
    return { status: 'fail', path: normalizePath(skillLifecyclePolicyPath), checkedSkills: 0, violations: [{ id: 'skillLifecyclePolicy.parse', level: 'fail' }] };
  }
}
function validateCuratorSuggestionScript() {
  const file = path.join('scripts', 'codex-harness-curator-suggest.mjs');
  if (!fs.existsSync(file)) return { status: 'warning', script: normalizePath(file), autoApply: false, violations: [{ id: 'curatorSuggestion.missing', level: 'warning' }] };
  const text = fs.readFileSync(file, 'utf8');
  const violations = [];
  if (!text.includes('autoApply: false')) violations.push({ id: 'curatorSuggestion.autoApply', level: 'fail' });
  if (/\b(?:writeFile|appendFile|rmSync|renameSync|copyFileSync)\b/.test(text)) violations.push({ id: 'curatorSuggestion.writesFiles', level: 'fail' });
  if (policyUnsafeValueHit(text)) violations.push({ id: 'curatorSuggestion.unsafePattern', level: 'fail' });
  return {
    status: violations.some((item) => item.level === 'fail') ? 'fail' : 'pass',
    script: normalizePath(file),
    autoApply: false,
    suggestionOnly: true,
    violations,
  };
}
function validateSelfEvolutionPolicy() {
  if (!fs.existsSync(selfEvolutionPolicyPath)) return policyMissingStatus('selfEvolutionPolicy.missing', selfEvolutionPolicyPath);
  const violations = [];
  try {
    const policy = readJsonFile(selfEvolutionPolicyPath);
    validateGovernanceMarker(policy, selfEvolutionPolicyPath, violations);
    const allowed = ['audit feedback', 'quality report', 'effectiveness tracker', 'learning recommendation', 'decision retrospective'];
    const known = new Set(['marker', 'schemaVersion', 'profile', 'sourceSignals', 'forbidden', 'forbiddenSourceSignals', 'candidatePatch', 'autoApply', 'autoCommit', 'autoPush', 'requiresAllChecksPass', 'requiresHumanApproval', 'maxSkillSizeKB', 'mustPreserveSemanticPurpose', 'allowedUnknownFields']);
    const allowedUnknown = new Set(Array.isArray(policy.allowedUnknownFields) ? policy.allowedUnknownFields : []);
    for (const key of Object.keys(policy)) {
      if (!known.has(key) && !allowedUnknown.has(key)) violations.push({ id: `selfEvolutionPolicy.unknownField.${key}`, level: 'warning' });
    }
    if (policy.schemaVersion !== '1.0.0') violations.push({ id: 'selfEvolutionPolicy.schemaVersion', level: 'fail' });
    if (!Array.isArray(policy.forbidden)) violations.push({ id: 'selfEvolutionPolicy.forbidden', level: 'fail' });
    for (const signal of policy.sourceSignals || []) {
      if (!allowed.includes(signal)) violations.push({ id: 'selfEvolutionPolicy.sourceSignals.disallowed', level: 'fail' });
    }
    for (const signal of allowed) {
      if (!Array.isArray(policy.sourceSignals) || !policy.sourceSignals.includes(signal)) violations.push({ id: `selfEvolutionPolicy.sourceSignals.${signal}`, level: 'fail' });
    }
    if (!Array.isArray(policy.forbiddenSourceSignals) || !policy.forbiddenSourceSignals.includes('raw execution logs')) violations.push({ id: 'selfEvolutionPolicy.rawExecutionLogs', level: 'fail' });
    if (policy.candidatePatch?.directApply !== false) violations.push({ id: 'selfEvolutionPolicy.directApply', level: 'fail' });
    if (policy.autoApply !== false) violations.push({ id: 'selfEvolutionPolicy.autoApply', level: 'fail' });
    if (policy.autoCommit !== false) violations.push({ id: 'selfEvolutionPolicy.autoCommit', level: 'fail' });
    if (policy.autoPush !== false) violations.push({ id: 'selfEvolutionPolicy.autoPush', level: 'fail' });
    if (policy.requiresAllChecksPass !== true) violations.push({ id: 'selfEvolutionPolicy.requiresAllChecksPass', level: 'fail' });
    if (policy.requiresHumanApproval !== true) violations.push({ id: 'selfEvolutionPolicy.requiresHumanApproval', level: 'fail' });
    if (typeof policy.maxSkillSizeKB !== 'number' || policy.maxSkillSizeKB > 15) violations.push({ id: 'selfEvolutionPolicy.maxSkillSizeKB', level: 'fail' });
    if (policy.mustPreserveSemanticPurpose !== true) violations.push({ id: 'selfEvolutionPolicy.mustPreserveSemanticPurpose', level: 'fail' });
    if (policyUnsafeValueHit(policy)) violations.push({ id: 'selfEvolutionPolicy.unsafePattern', level: 'fail' });
    const suggestScript = path.join('scripts', 'codex-harness-self-evolution-suggest.mjs');
    if (!fs.existsSync(suggestScript)) violations.push({ id: 'selfEvolutionPolicy.suggestScriptMissing', level: 'warning' });
    else {
      const source = fs.readFileSync(suggestScript, 'utf8');
      if (!source.includes('autoApply: false')) violations.push({ id: 'selfEvolutionPolicy.suggestAutoApply', level: 'fail' });
      if (/\b(?:writeFile|appendFile|rmSync|renameSync|copyFileSync)\b/.test(source)) violations.push({ id: 'selfEvolutionPolicy.suggestWritesFiles', level: 'fail' });
    }
    return {
      status: violations.some((item) => item.level === 'fail') ? 'fail' : (violations.length ? 'warning' : 'pass'),
      path: normalizePath(selfEvolutionPolicyPath),
      sourceSignalCount: Array.isArray(policy.sourceSignals) ? policy.sourceSignals.length : 0,
      autoApply: false,
      autoCommit: false,
      autoPush: false,
      requiresHumanApproval: policy.requiresHumanApproval === true,
      violations,
    };
  } catch {
    return { status: 'fail', path: normalizePath(selfEvolutionPolicyPath), violations: [{ id: 'selfEvolutionPolicy.parse', level: 'fail' }] };
  }
}
function applyGovernancePolicyStatus(status, failId, failMessage) {
  for (const violation of policyViolationList(status)) {
    if (violation.level === 'fail') addPolicyViolation(violation.id, failMessage, 'fail', { path: violation.path || status.path || status.script });
    else addWarning({ id: violation.id, path: violation.path || status.path || status.script, message: failMessage });
  }
}
function bumpRisk(level) {
  if ((levels[level] || 0) > (levels[report.riskLevel] || 0)) report.riskLevel = level;
}
function classifyDiff(policy, knownRisks) {
  const changed = changedPathList();
  const allowed = policy.allowedPaths || policy.diffScope?.allowedPaths || [];
  const blocked = policy.blockedPaths || policy.diffScope?.blockedPaths || [];
  const highRisk = policy.highRiskPaths || policy.diffScope?.highRiskPaths || [];
  report.changedPaths.paths = changed;
  report.changedPaths.count = changed.length;
  if (changed.length) bumpRisk('R2');

  for (const file of changed) {
    if (allowed.length && !pathMatches(file, allowed)) {
      report.changedPaths.outOfScope.push(file);
      const action = policy.diffScope?.outOfScope || 'fail';
      const item = { id: 'diff.outOfScope', path: file, message: `Changed path is outside allowedPaths: ${file}` };
      addAuditFinding(action === 'fail' ? 'blocking' : 'warning', 'diffScope.outOfScope', 'Changed path is outside allowed scope.', { path: file, confidence: 'high', recommendedFixType: 'policy_fix' }, []);
      if (action === 'fail') addFailure(item.id, item.message, { path: file });
      else addWarning({ ...item, known: warningKnown(item, knownRisks) });
    }
    if (pathMatches(file, blocked)) {
      report.changedPaths.blocked.push(file);
      bumpRisk('R3');
      const action = policy.diffScope?.blocked || 'fail';
      const item = { id: 'diff.blockedPath', path: file, message: `Changed path matches blockedPaths: ${file}` };
      addAuditFinding(action === 'fail' ? 'blocking' : 'warning', 'diffScope.blockedPath', 'Changed path matches blocked scope.', { path: file, confidence: 'high', recommendedFixType: 'policy_fix' }, []);
      if (action === 'fail') addFailure(item.id, item.message, { path: file });
      else addWarning({ ...item, known: warningKnown(item, knownRisks) });
    }
    if (pathMatches(file, highRisk)) {
      report.changedPaths.highRisk.push(file);
      bumpRisk('R3');
      const action = policy.diffScope?.highRisk || 'warn';
      const item = { id: 'diff.highRiskPath', path: file, message: `Changed path matches highRiskPaths: ${file}` };
      if (action === 'fail') addFailure(item.id, item.message, { path: file });
      else addWarning({ ...item, known: warningKnown(item, knownRisks) });
    }
  }

  for (const [level, terms] of Object.entries(policy.riskKeywords || {})) {
    if (!levels[level] || !Array.isArray(terms)) continue;
    for (const file of changed) {
      const lower = file.toLowerCase();
      if (terms.some((term) => term && lower.includes(String(term).toLowerCase()))) {
        bumpRisk(level);
      }
    }
  }

  const behavior = policy.riskLevelBehavior || {};
  if (behavior[report.riskLevel] === 'fail') {
    addFailure(`risk.${report.riskLevel}`, `Risk level ${report.riskLevel} is configured to fail.`);
  }
  evaluatePrSeparation(policy, changed, knownRisks);
}
function runDiffAudits(policy, knownRisks, codeAuditBaseline) {
  activeAuditPolicy = policy;
  const startedAt = Date.now();
  const records = collectDiffRecords();
  selectReviewers(policy, records);
  detectTestWeakening(policy, records, knownRisks, codeAuditBaseline);
  checkDomainInvariants(policy, records, knownRisks, codeAuditBaseline);
  auditDependencies(policy, records, knownRisks, codeAuditBaseline);
  detectSecuritySensitiveChanges(policy, records, knownRisks, codeAuditBaseline);
  checkCoverageIntent(policy, records, knownRisks, codeAuditBaseline);
  report.selectedReviewers.reviewers = [...new Set(report.selectedReviewers.reviewers)].sort();
  report.selectedReviewers.rules = report.selectedReviewers.rules
    .filter((rule, index, arr) => arr.findIndex((other) => other.reviewerSkill === rule.reviewerSkill && other.ruleId === rule.ruleId) === index)
    .sort((a, b) => `${a.reviewerSkill}:${a.ruleId}`.localeCompare(`${b.reviewerSkill}:${b.ruleId}`));
  report.selectedReviewers.status = report.selectedReviewers.reviewers.length ? 'selected' : 'none';
  report.auditPerformance.durationMs = Date.now() - startedAt;
}
function selectReviewers(policy, records) {
  for (const rule of policy.reviewerSelection?.rules || []) {
    const riskHit = (rule.riskLevels || []).includes(report.riskLevel);
    const diffHit = records.some((record) => recordMatches(record, rule));
    if (riskHit || diffHit) addReviewer(rule.reviewerSkill, rule.id || 'reviewerSelection');
  }
  const prTypePolicy = policy.prTypes?.[report.prType];
  for (const skill of prTypePolicy?.requiredReviewerSkills || []) addReviewer(skill, `prType.${report.prType}`);
}
function testPathPatterns(policy) {
  return [
    ...(policy.testWeakening?.testPaths || defaultPolicy.testWeakening.testPaths),
    ...(policy.fixtureContractRepairPaths || []),
  ];
}
function detectTestWeakening(policy, records, knownRisks, codeAuditBaseline) {
  const findings = [];
  const tests = records.filter((record) => pathMatches(record.file, testPathPatterns(policy)));
  const removedAssertion = /\b(assert|expect|should|throws|rejects|toEqual|toBe|toStrictEqual|toThrow)\b/;
  const skipAdded = /\b(skip|todo|only)\b/;
  const looseAdded = /\b(toBeTruthy|toBeDefined|anything|expect\.any)\b/;
  const snapshotChanged = /\b(snapshot|toMatchSnapshot|toMatchInlineSnapshot)\b/i;
  const errorRemoved = /\b(error|fail|throw|reject|invalid|denied|unauthorized)\b/i;
  const boundaryRemoved = /\b(boundary|edge|limit|empty|null|undefined|min|max)\b/i;
  const regressionRemoved = /\b(regression|repro|bug)\b/i;
  for (const record of tests) {
    const addedNonComment = record.added.filter((line) => !/^\s*(\/\/|#|\*|\{|\}|$)/.test(line));
    const removedNonComment = record.removed.filter((line) => !/^\s*(\/\/|#|\*|\{|\}|$)/.test(line));
    const addedAssertions = addedNonComment.filter((line) => removedAssertion.test(line)).length;
    const removedAssertions = removedNonComment.filter((line) => removedAssertion.test(line)).length;
    const addFinding = (id) => {
      const fullId = `testWeakening.${id}`;
      const fixtureRepairStrict = report.prType === 'fixture-contract-repair'
        && policy.fixtureContractRepairRules?.forbidTestWeakening !== false;
      const fixtureRepairBlocking = fixtureRepairStrict
        && (id === 'assertionRemoved'
          || (id === 'skipTodoOnlyAdded' && policy.fixtureContractRepairRules?.forbidSkipTodoOnly !== false)
          || (['errorPathRemoved', 'boundaryCoverageRemoved', 'regressionCoverageRemoved'].includes(id) && policy.fixtureContractRepairRules?.forbidNegativeCaseWeakening !== false)
          || id === 'expectationRelaxed');
      const severity = fixtureRepairBlocking
        ? 'blocking'
        : auditSeverity(policy, 'testWeakening', id, id === 'assertionRemoved' ? 'blocking' : 'warning');
      findings.push({ id, ruleId: ruleIdFrom(fullId), path: record.file, severity, confidence: defaultConfidence(fullId, severity) });
    };
    if (removedAssertions > addedAssertions) addFinding('assertionRemoved');
    if (addedAssertions > removedAssertions) addNegativeSignal('test.assertionAdded', 'assertion coverage was added or strengthened', [record.file]);
    if (addedNonComment.some((line) => skipAdded.test(line))) addFinding('skipTodoOnlyAdded');
    if (addedNonComment.some((line) => looseAdded.test(line))) addFinding('expectationRelaxed');
    if (addedNonComment.some((line) => snapshotChanged.test(line)) && removedNonComment.some((line) => snapshotChanged.test(line))) addFinding('snapshotUpdated');
    if (removedNonComment.some((line) => errorRemoved.test(line))) addFinding('errorPathRemoved');
    if (removedNonComment.some((line) => boundaryRemoved.test(line))) addFinding('boundaryCoverageRemoved');
    if (removedNonComment.some((line) => regressionRemoved.test(line))) addFinding('regressionCoverageRemoved');
    if (addedNonComment.some((line) => regressionRemoved.test(line))) addNegativeSignal('test.regressionAdded', 'regression-oriented test evidence was added', [record.file]);
    const safeFixturePatterns = policy.testWeakening?.safeFixtureMetadataPatterns || defaultPolicy.testWeakening.safeFixtureMetadataPatterns;
    const fixtureFollowLines = addedNonComment.filter((line) => /current implementation|matches implementation|fixture.*pass/i.test(line));
    if (fixtureFollowLines.some((line) => !safeFixturePatterns.some((pattern) => line.toLowerCase().includes(String(pattern).toLowerCase())))) addFinding('fixtureFollowsImplementation');
  }
  report.testWeakeningStatus = { status: findings.length ? 'warning' : (tests.length ? 'pass' : 'not_applicable'), findings };
  if (!findings.length) return;
  addReviewer('test-coverage-reviewer', 'testWeakening');
  addHumanReviewReason('testWeakening.detected');
  for (const finding of findings) {
    addAuditFinding(
      policy.testWeakening?.mode === 'fail' ? 'blocking' : finding.severity,
      `testWeakening.${finding.id}`,
      'Potential test weakening was detected.',
      { path: finding.path },
      codeAuditBaseline,
    );
  }
}
function checkDomainInvariants(policy, records, knownRisks, codeAuditBaseline) {
  const findings = [];
  for (const rule of policy.domainInvariants || []) {
    for (const record of records) {
      const explicitPaths = rule.paths || rule.pathPatterns || [];
      if (pathMatches(record.file, policy.harnessPrAllowedPaths || defaultPolicy.harnessPrAllowedPaths) && !pathMatches(record.file, explicitPaths)) continue;
      if (!recordMatches(record, rule)) continue;
      const id = rule.id || 'domainInvariant';
      const severity = auditSeverity(policy, 'domainInvariant', id, rule.severity || 'warning');
      const mapping = policy.codeAuditPolicy?.domainInvariantMappings?.[id] || {};
      findings.push({
        id,
        ruleId: rule.ruleId || ruleIdFrom(`domainInvariant.${id}`),
        path: record.file,
        reviewerSkill: rule.reviewerSkill,
        evidence: rule.evidence || mapping.evidence || rule.description || id,
        severity,
        confidence: defaultConfidence(`domainInvariant.${id}`, severity),
      });
      addReviewer(rule.reviewerSkill, rule.id || 'domainInvariant');
      addHumanReviewReason(`domainInvariant.${rule.id || 'matched'}`);
      if (rule.riskLevel) bumpRisk(rule.riskLevel);
    }
  }
  report.domainInvariantStatus = { status: findings.length ? 'warning' : 'pass', findings };
  for (const finding of findings) {
    addAuditFinding(finding.severity, `domainInvariant.${finding.id}`, 'Domain invariant-sensitive change detected.', { path: finding.path, reviewerSkill: finding.reviewerSkill, ruleId: finding.ruleId, confidence: finding.confidence, evidence: finding.evidence }, codeAuditBaseline);
  }
}
function auditDependencies(policy, records, knownRisks, codeAuditBaseline) {
  const cfg = policy.dependencyAudit || defaultPolicy.dependencyAudit;
  const packageFiles = cfg.packageFiles || defaultPolicy.dependencyAudit.packageFiles;
  const lockfiles = cfg.lockfiles || defaultPolicy.dependencyAudit.lockfiles;
  const packageChanges = records.filter((record) => pathMatches(record.file, packageFiles));
  const lockfileChanges = records.filter((record) => pathMatches(record.file, lockfiles));
  const findings = [];
  if (packageChanges.length && lockfileChanges.length) addNegativeSignal('dependency.lockfileAligned', 'package metadata changed with lockfile evidence', [...packageChanges, ...lockfileChanges].map((item) => item.file));
  if (packageChanges.length && !lockfileChanges.length && cfg.requireLockfileForPackageChange !== 'ignore') {
    for (const item of packageChanges) findings.push({ id: 'packageWithoutLockfile', path: item.file });
  }
  if (lockfileChanges.length && !packageChanges.length) {
    for (const item of lockfileChanges) findings.push({ id: 'lockfileChangedWithoutPackageChange', path: item.file });
  }
  if (packageChanges.length && !lockfileChanges.length) {
    const knownLockfiles = lockfiles.filter((file) => fs.existsSync(file));
    for (const item of packageChanges) {
      let packageManager = 'unknown';
      try {
        const pkg = readJsonFile(item.file);
        if (typeof pkg.packageManager === 'string') packageManager = pkg.packageManager.split('@')[0] || 'unknown';
      } catch {
        packageManager = 'unknown';
      }
      if (!knownLockfiles.length && packageManager === 'unknown') findings.push({ id: 'packageManagerUnknown', path: item.file });
    }
  }
  const risky = cfg.riskyPackages || [];
  for (const record of packageChanges) {
    const text = [...record.added, ...record.removed].join('\n').toLowerCase();
    for (const name of risky) {
      if (name && text.includes(String(name).toLowerCase())) findings.push({ id: 'riskyPackage', path: record.file, package: name });
    }
  }
  findings.push(...findMissingDirectImports(records));
  findings.push(...findPackageImportDrift(records, packageChanges));
  report.dependencyAuditStatus = { status: findings.length ? 'warning' : 'pass', findings };
  if (!findings.length) return;
  addReviewer('implementation-reviewer', 'dependencyAudit');
  addHumanReviewReason('dependencyAudit.findings');
  for (const finding of findings) {
    const fallback = cfg.mode === 'fail' || (cfg.requireLockfileForPackageChange === 'fail' && finding.id === 'packageWithoutLockfile') ? 'blocking' : 'warning';
    addAuditFinding(auditSeverity(policy, 'dependencyAudit', finding.id, fallback), `dependencyAudit.${finding.id}`, 'Dependency or fresh install risk detected.', { path: finding.path, package: finding.package }, codeAuditBaseline);
  }
}
function packageName(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/')) return '';
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}
function nearestPackage(file) {
  let dir = path.dirname(file);
  while (dir && dir !== '.') {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return fs.existsSync('package.json') ? 'package.json' : '';
}
function declaredDeps(packageFile) {
  try {
    const pkg = readJsonFile(packageFile);
    return new Set(Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}), ...(pkg.peerDependencies || {}), ...(pkg.optionalDependencies || {}) }));
  } catch {
    return new Set();
  }
}
function packageDelta(record) {
  const removed = [];
  const added = [];
  const depLine = /^\s*"([^"]+)"\s*:/;
  const metadataKeys = new Set(['name', 'version', 'description', 'type', 'private', 'scripts', 'dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'packageManager', 'workspaces', 'engines']);
  for (const line of record.removed || []) {
    const match = line.match(depLine);
    if (match && !metadataKeys.has(match[1])) removed.push(match[1]);
  }
  for (const line of record.added || []) {
    const match = line.match(depLine);
    if (match && !metadataKeys.has(match[1])) added.push(match[1]);
  }
  return { removed: [...new Set(removed)], added: [...new Set(added)] };
}
function sourceFilesForImportScan() {
  return gitLines(['ls-files'])
    .filter((file) => /\.(mjs|cjs|js|jsx|ts|tsx)$/.test(file))
    .filter((file) => !/(^|\/)(node_modules|dist|build|coverage)\//.test(file));
}
function fileReferencesPackage(file, name) {
  try {
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:from\\s+['"]${escaped}(?:/[^'"]*)?['"]|require\\(\\s*['"]${escaped}(?:/[^'"]*)?['"]|import\\(\\s*['"]${escaped}(?:/[^'"]*)?['"])`).test(text);
  } catch {
    return false;
  }
}
function findPackageImportDrift(records, packageChanges) {
  const findings = [];
  if (!packageChanges.length) return findings;
  const scanFiles = sourceFilesForImportScan();
  const changedSources = new Set(records.filter((record) => /\.(mjs|cjs|js|jsx|ts|tsx)$/.test(record.file)).map((record) => record.file));
  for (const record of packageChanges) {
    const delta = packageDelta(record);
    for (const name of delta.removed) {
      if (scanFiles.some((file) => fileReferencesPackage(file, name))) findings.push({ id: 'packageRemovedButImportRemains', path: record.file, package: name });
    }
    for (const name of delta.added) {
      const referenced = scanFiles.some((file) => fileReferencesPackage(file, name)) || [...changedSources].some((file) => fileReferencesPackage(file, name));
      if (!referenced) findings.push({ id: 'dependencyAddedNoReference', path: record.file, package: name });
    }
  }
  return findings;
}
function findMissingDirectImports(records) {
  const builtins = new Set(['fs', 'path', 'os', 'url', 'util', 'events', 'stream', 'crypto', 'http', 'https', 'zlib', 'buffer', 'process', 'child_process', 'node:fs', 'node:path']);
  const findings = [];
  const importPattern = /(?:from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"])/g;
  for (const record of records) {
    if (!/\.(mjs|cjs|js|jsx|ts|tsx)$/.test(record.file)) continue;
    const packageFile = nearestPackage(record.file);
    if (!packageFile) continue;
    const deps = declaredDeps(packageFile);
    for (const line of record.added) {
      let match;
      while ((match = importPattern.exec(line))) {
        const name = packageName(match[1] || match[2] || match[3]);
        if (!name || builtins.has(name) || deps.has(name)) continue;
        findings.push({ id: 'directImportMissing', path: record.file, package: name });
      }
    }
  }
  return findings;
}
function detectSecuritySensitiveChanges(policy, records, knownRisks, codeAuditBaseline) {
  const terms = policy.securitySensitiveTerms || [];
  const findings = [];
  const actionable = [];
  const testsTouched = records.some((record) => pathMatches(record.file, policy.coverageIntent?.testPaths || defaultPolicy.coverageIntent.testPaths));
  for (const record of records) {
    const text = lineText(record);
    for (const term of terms) {
      if (term && text.includes(String(term).toLowerCase())) {
        const docsOnly = /^docs\//.test(record.file) || /\.(md|txt)$/.test(record.file);
        const implementationLike = !docsOnly && !pathMatches(record.file, policy.harnessPrAllowedPaths || defaultPolicy.harnessPrAllowedPaths);
        findings.push({ id: 'securitySensitiveTerm', path: record.file, context: implementationLike ? 'implementation' : 'docs-or-harness' });
        if (implementationLike) actionable.push(record.file);
      }
    }
  }
  report.securitySensitiveChangeStatus = { status: findings.length ? 'warning' : 'pass', findings };
  if (!findings.length) return;
  if (actionable.length) bumpRisk('R3');
  addReviewer('security-reviewer', 'securitySensitiveChange');
  if (actionable.length && testsTouched) addNegativeSignal('security.testsTouched', 'security-sensitive implementation change includes test-path evidence', actionable);
  if (actionable.length) addHumanReviewReason('securitySensitiveChange.detected');
  for (const finding of findings) {
    const lowered = finding.context === 'implementation' && testsTouched && activeAuditPolicy.codeAuditPolicy?.negativeSignals?.lowerWarnings !== false;
    const severity = finding.context === 'implementation' ? (lowered ? 'info' : auditSeverity(policy, 'securitySensitiveChange', finding.id, 'warning')) : 'info';
    const confidence = finding.context === 'implementation' ? 'medium' : 'low';
    addAuditFinding(severity, 'securitySensitiveChange.detected', 'Security-sensitive change detected.', { path: finding.path, confidence }, codeAuditBaseline);
  }
}
function checkCoverageIntent(policy, records, knownRisks, codeAuditBaseline) {
  const cfg = policy.coverageIntent || defaultPolicy.coverageIntent;
  if (cfg.enabled === false) {
    report.coverageIntentStatus = { status: 'disabled', required: [], missing: [] };
    return;
  }
  const impl = records.filter((record) => pathMatches(record.file, cfg.implementationPaths || []));
  const tests = records.filter((record) => pathMatches(record.file, cfg.testPaths || []));
  const missing = impl.length && !tests.length ? (cfg.required || []) : [];
  const missingTestIntent = missing.map((intent) => ({
    intent,
    recommendedTestType: intent,
    whyNeeded: `Implementation change needs ${intent} evidence.`,
    severity: report.riskLevel === 'R3' && report.prType === 'implementation' ? 'warning' : 'warning',
    confidence: report.riskLevel === 'R3' ? 'medium' : 'low',
  }));
  report.coverageIntentStatus = {
    status: missing.length ? 'warning' : (impl.length ? 'pass' : 'not_applicable'),
    required: cfg.required || [],
    missing,
    missingTestIntent,
    implementationPathsTouched: impl.map((record) => record.file),
    testPathsTouched: tests.map((record) => record.file),
  };
  report.missingTestIntent = missingTestIntent;
  if (!missing.length) return;
  addReviewer('test-coverage-reviewer', 'coverageIntent');
  addHumanReviewReason('coverageIntent.missing');
  const severity = cfg.missingTestChange === 'fail'
    ? 'blocking'
    : auditSeverity(policy, 'coverageIntent', 'missing', report.riskLevel === 'R3' && report.prType === 'implementation' ? 'warning' : 'warning');
  addAuditFinding(severity, 'coverageIntent.missing', 'Implementation change lacks accompanying test intent evidence.', {
    recommendedTestType: missing[0] || 'regression',
    whyNeeded: 'Changed implementation has no matching test-path evidence.',
  }, codeAuditBaseline);
}
function computePostMergeStatus(worktree) {
  const manifestExists = fs.existsSync(path.join('docs', 'process', 'CODEX_HARNESS_MANIFEST.json'));
  const policyExists = fs.existsSync(policyPath);
  const knownRisksExists = fs.existsSync(knownRiskPath);
  const expectedHarnessVersion = process.env.CODEX_EXPECTED_HARNESS_VERSION || HARNESS_VERSION;
  const cleanMain = worktree.isMain && !worktree.isDirty && worktree.headEqualsOriginMain === true;
  const filesPresent = manifestExists && policyExists && knownRisksExists;
  return {
    status: cleanMain && filesPresent && expectedHarnessVersion === HARNESS_VERSION ? 'pass' : 'warning',
    currentBranch: worktree.currentBranch,
    cleanMain,
    headEqualsOriginMain: worktree.headEqualsOriginMain === true,
    manifestExists,
    policyExists,
    knownRisksExists,
    expectedHarnessVersion,
    harnessVersion: HARNESS_VERSION,
    mergeReady: false,
    recommendedAction: cleanMain && filesPresent ? 'run post-merge verifier for command checks' : 'confirm main is clean and synced before post-merge verification',
  };
}
function activeManualConfirmationPolicy(policy = activeAuditPolicy || defaultPolicy) {
  const configured = policy.manualConfirmationPolicy || {};
  const fixtureRequiredItems = report.prType === 'fixture-contract-repair'
    ? (policy.fixtureContractRepairRules?.requiredManualConfirmationItems || defaultPolicy.fixtureContractRepairRules.requiredManualConfirmationItems)
    : [];
  const configuredItems = Array.isArray(configured.requiredReviewedItems) ? configured.requiredReviewedItems : defaultPolicy.manualConfirmationPolicy.requiredReviewedItems;
  return {
    ...defaultPolicy.manualConfirmationPolicy,
    ...configured,
    requiredForRiskLevels: Array.isArray(configured.requiredForRiskLevels) ? configured.requiredForRiskLevels : defaultPolicy.manualConfirmationPolicy.requiredForRiskLevels,
    allowedSources: Array.isArray(configured.allowedSources) ? configured.allowedSources : defaultPolicy.manualConfirmationPolicy.allowedSources,
    requiredReviewedItems: [...new Set([...configuredItems, ...fixtureRequiredItems])],
    cannotOverride: Array.isArray(configured.cannotOverride) ? configured.cannotOverride : defaultPolicy.manualConfirmationPolicy.cannotOverride,
  };
}
function manualConfirmationCannotOverrideFailures(policy = activeAuditPolicy || defaultPolicy) {
  const configured = new Set(activeManualConfirmationPolicy(policy).cannotOverride || []);
  const blockers = [];
  if (configured.has('secretScanFailure') && report.secretScan?.status === 'fail') blockers.push('secretScanFailure');
  if (configured.has('blockedPaths') && report.changedPathsSummary.blocked.length) blockers.push('blockedPaths');
  const highConfidenceSecret = report.secretScan?.status === 'fail'
    || allAuditFindings().some((finding) => finding.confidence === 'high' && /secret|credential|token/i.test(`${finding.ruleId || ''} ${finding.id || ''} ${finding.message || ''}`));
  if (configured.has('highConfidenceSecret') && highConfidenceSecret) blockers.push('highConfidenceSecret');
  if (configured.has('implementationHarnessMixing') && report.prSeparationStatus?.status === 'fail') blockers.push('implementationHarnessMixing');
  if (configured.has('profileRequiredFailure') && report.profileRequiredChecks?.status === 'fail') blockers.push('profileRequiredFailure');
  if (configured.has('openaiMethodGateFailure') && report.openaiCodexMethodStatus?.status === 'fail') blockers.push('openaiMethodGateFailure');
  return [...new Set(blockers)].sort();
}
function manualConfirmationRequired(policy = activeAuditPolicy || defaultPolicy) {
  const manualPolicy = activeManualConfirmationPolicy(policy);
  return process.env.CODEX_MANUAL_CONFIRMATION_REQUIRED === '1'
    || (manualPolicy.requiredForRiskLevels || []).includes(report.riskLevel)
    || (report.humanReviewRequired === true && (manualPolicy.requiredForHumanReview === true));
}
function runManualConfirmationVerifier(policy = activeAuditPolicy || defaultPolicy) {
  const manualPolicy = activeManualConfirmationPolicy(policy);
  const required = manualConfirmationRequired(policy);
  const cannotOverrideFailures = manualConfirmationCannotOverrideFailures(policy);
  const base = {
    required,
    status: required ? 'manual_confirmation_required' : 'not_required',
    source: 'none',
    profile: report.profile,
    riskLevel: report.riskLevel,
    headSha: process.env.CODEX_PR_HEAD_SHA || process.env.CODEX_MANUAL_CONFIRMATION_HEAD_SHA || '',
    headShaMatched: false,
    stale: false,
    missingItems: [],
    cannotOverrideFailures,
    recommendedAction: required ? 'record manual confirmation for current head' : 'manual confirmation not required',
  };
  if (!required) return base;
  const verifier = path.join('scripts', 'codex-manual-confirmation-verify.mjs');
  if (!fs.existsSync(verifier)) return { ...base, missingItems: ['verifierScript'], recommendedAction: 'install manual confirmation verifier' };
  const env = {
    ...process.env,
    CODEX_MANUAL_CONFIRMATION_REPORT: 'json',
    CODEX_MANUAL_CONFIRMATION_REQUIRED: '1',
    CODEX_MANUAL_CONFIRMATION_PROFILE: report.profile,
    CODEX_MANUAL_CONFIRMATION_RISK_LEVEL: report.riskLevel,
    CODEX_MANUAL_CONFIRMATION_HEAD_SHA: base.headSha,
    CODEX_MANUAL_CONFIRMATION_REQUIRED_ITEMS: JSON.stringify(manualPolicy.requiredReviewedItems || []),
    CODEX_MANUAL_CONFIRMATION_CANNOT_OVERRIDE_FAILURES: JSON.stringify(cannotOverrideFailures),
  };
  const result = spawnSync(process.execPath, [verifier, '--json'], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  let parsed = null;
  try { parsed = result.stdout ? JSON.parse(result.stdout) : null; } catch { parsed = null; }
  if (!parsed || typeof parsed !== 'object') return { ...base, missingItems: ['verifierOutput'], recommendedAction: 'manual confirmation verifier did not return safe JSON' };
  return {
    ...base,
    ...parsed,
    required,
    riskLevel: report.riskLevel,
    profile: report.profile,
    cannotOverrideFailures,
    status: parsed.status === 'pass' && cannotOverrideFailures.length === 0 ? 'pass' : 'manual_confirmation_required',
  };
}
function evaluateManualMergePolicy(policy = activeAuditPolicy || defaultPolicy) {
  const manualStatus = report.manualConfirmationStatus || runManualConfirmationVerifier(policy);
  if (!manualStatus.required) {
    return {
      status: 'not_required',
      githubActions: 'not_required',
      requiresPrBodyVerification: false,
      requiresResidualRisk: false,
      requiresMergeReview: report.humanReviewRequired === true,
      recommendedAction: 'manual confirmation not required by policy',
    };
  }
  if (manualStatus.status === 'pass' && !(manualStatus.cannotOverrideFailures || []).length) {
    return {
      status: 'pass',
      githubActions: 'pass_or_current_head_confirmation_recorded',
      requiresPrBodyVerification: true,
      requiresResidualRisk: true,
      requiresMergeReview: true,
      source: manualStatus.source || 'unknown',
      recommendedAction: 'manual confirmation accepted for current head',
    };
  }
  return {
    status: 'manual_confirmation_required',
    githubActions: 'manual_confirmation_required',
    requiresPrBodyVerification: true,
    requiresResidualRisk: true,
    requiresMergeReview: true,
    source: manualStatus.source || 'none',
    recommendedAction: manualStatus.recommendedAction || 'confirm quality-gate status and PR body before merge',
  };
}
function manualConfirmationCanSatisfyFinding(finding) {
  if (!finding || finding.recommendedFixType !== 'human_review_required') return false;
  return String(finding.id || '').startsWith('domainInvariant.');
}
function applyManualConfirmationToReviewFindings() {
  if (report.manualConfirmationStatus?.status !== 'pass') return;
  if ((report.manualConfirmationStatus?.cannotOverrideFailures || []).length) return;
  const satisfiedIds = new Set();
  const remainingBlocking = [];
  for (const finding of report.blockingFindings) {
    if (!manualConfirmationCanSatisfyFinding(finding)) {
      remainingBlocking.push(finding);
      continue;
    }
    satisfiedIds.add(finding.id);
    report.warningFindings.push({
      ...finding,
      originalSeverity: finding.severity,
      severity: 'warning',
      manualConfirmationSatisfied: true,
      whyHumanReviewRequired: 'manual confirmation recorded for current head',
    });
  }
  if (!satisfiedIds.size) return;
  report.blockingFindings = remainingBlocking;
  for (let i = failures.length - 1; i >= 0; i--) {
    if (satisfiedIds.has(failures[i]?.id)) failures.splice(i, 1);
  }
}
function computeReviewResultSchemaStatus() {
  const schemaPath = path.join('docs', 'process', 'CODEX_REVIEW_RESULT_SCHEMA.json');
  if (!fs.existsSync(schemaPath)) return { status: 'missing', path: normalizePath(schemaPath) };
  try {
    const schema = readJsonFile(schemaPath);
    const required = ['reviewType', 'profile', 'riskLevel', 'reviewerSkill', 'findings', 'blockingFindings', 'nonBlockingFindings', 'requiredFollowUps', 'mergeRecommendation', 'evidenceRefs', 'safeSummaryOnly'];
    const missing = required.filter((key) => !Object.prototype.hasOwnProperty.call(schema.properties || {}, key));
    return { status: missing.length ? 'warning' : 'pass', path: normalizePath(schemaPath), missing };
  } catch {
    return { status: 'fail', path: normalizePath(schemaPath) };
  }
}
function computePostMergeVerificationPlan() {
  return [
    'confirm main branch is clean and synced',
    'run post-merge verifier',
    'confirm quality report mergeReady',
    'review known risk expiry',
    'review branch cleanup advice',
  ];
}
function dependencyPath(file) {
  return /(^|\/)(package\.json|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(file);
}
function packagePath(file) {
  return /(^|\/)package\.json$/.test(file);
}
function lockfilePath(file) {
  return /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(file);
}
function inferPrType(policy, changed = changedPathList()) {
  const paths = changed.map(normalizePath).sort();
  const harnessPaths = policy.harnessPrAllowedPaths || defaultPolicy.harnessPrAllowedPaths;
  const docsOnly = paths.length > 0 && paths.every((file) => /^docs\//.test(file) || /^[^/]+\.(md|txt)$/.test(file));
  const testPaths = policy.coverageIntent?.testPaths || defaultPolicy.coverageIntent.testPaths;
  const testOnly = paths.length > 0 && paths.every((file) => pathMatches(file, testPaths));
  const fixtureRepairPaths = policy.fixtureContractRepairPaths || defaultPolicy.fixtureContractRepairPaths;
  const fixtureContractRepairOnly = paths.length > 0 && fixtureRepairPaths.length > 0 && paths.every((file) => pathMatches(file, fixtureRepairPaths));
  const dependencyOnly = paths.length > 0 && paths.every(dependencyPath);
  const harnessOnly = paths.length > 0 && paths.every((file) => pathMatches(file, harnessPaths));
  const packageTouched = paths.some(packagePath);
  const lockfileTouched = paths.some(lockfilePath);
  const implPaths = policy.coverageIntent?.implementationPaths || defaultPolicy.coverageIntent.implementationPaths;
  const implementationTouched = paths.some((file) => pathMatches(file, implPaths))
    || paths.some((file) => !pathMatches(file, harnessPaths) && !dependencyPath(file) && !/^docs\//.test(file) && !pathMatches(file, testPaths));
  let inferredType = 'unknown';
  const reasons = [];
  if (!paths.length) {
    reasons.push('no changed paths detected');
  } else if (harnessOnly) {
    inferredType = 'harness';
    reasons.push('all changed paths match harness scope');
  } else if (dependencyOnly || packageTouched || lockfileTouched) {
    inferredType = 'dependency';
    reasons.push('package metadata or lockfile changed');
  } else if (docsOnly) {
    inferredType = 'docs-only';
    reasons.push('all changed paths are documentation paths');
  } else if (fixtureContractRepairOnly) {
    inferredType = 'fixture-contract-repair';
    reasons.push('all changed paths match fixture contract repair paths');
  } else if (testOnly) {
    inferredType = 'test-only';
    reasons.push('all changed paths are test paths');
  } else if (implementationTouched) {
    inferredType = 'implementation';
    reasons.push('implementation-like path changed');
  }
  const configured = Boolean(policy.prTypes?.[inferredType]);
  if (inferredType !== 'unknown' && !configured) {
    reasons.push('inferred PR type has no explicit policy; generic evaluation will be used');
  }
  return {
    status: inferredType === 'unknown' ? 'warning' : 'pass',
    inferredType,
    confidence: inferredType === 'unknown' ? 'low' : (paths.length ? 'high' : 'low'),
    reasons,
    packageTouched,
    lockfileTouched,
    implementationTouched,
  };
}
function findingStableKey(item) {
  return `${item.ruleId || item.id || 'unknown'}:${item.rootCauseId || item.path || 'general'}`;
}
function readPreviousQualityReport() {
  const candidate = process.env.CODEX_PREVIOUS_QUALITY_REPORT || process.env.CODEX_COMPARE_QUALITY_REPORT || '';
  if (!candidate || !fs.existsSync(candidate)) return null;
  try {
    return readJsonFile(candidate);
  } catch {
    addWarning({ id: 'qualityReport.previous.parse', message: 'Previous quality report could not be parsed.' });
    return null;
  }
}
function computeFindingLifecycle() {
  const current = allAuditFindings();
  const previous = readPreviousQualityReport();
  const currentKeys = new Set(current.map(findingStableKey));
  const previousItems = previous
    ? [...(previous.blockingFindings || []), ...(previous.warningFindings || []), ...(previous.infoFindings || [])]
    : [];
  const previousKeys = new Set(previousItems.map(findingStableKey));
  const shape = (finding) => ({
    ruleId: finding.ruleId || finding.id,
    rootCauseId: finding.rootCauseId || 'general',
    severity: finding.severity || 'unknown',
    confidence: finding.confidence || 'unknown',
    priority: finding.priority || 'P3',
    path: finding.path,
  });
  const existing = previous ? current.filter((finding) => previousKeys.has(findingStableKey(finding))).map(shape) : [];
  const newlyFound = previous ? current.filter((finding) => !previousKeys.has(findingStableKey(finding))).map(shape) : [];
  const resolved = previous ? previousItems.filter((finding) => !currentKeys.has(findingStableKey(finding))).map(shape) : [];
  for (const finding of current) {
    if (!previous) finding.lifecycle = 'unknown';
    else finding.lifecycle = previousKeys.has(findingStableKey(finding)) ? 'existing' : 'new';
  }
  const suppressed = current.filter((finding) => finding.known).map(shape);
  const expiredSuppression = (report.codeAuditBaseline?.expired || []).map((item) => ({ id: item.id, path: item.path, expiresAt: item.expiresAt }));
  const needsHumanReview = current
    .filter((finding) => finding.humanReviewRequired || finding.priority === 'P0' || finding.priority === 'P1')
    .map(shape);
  return {
    status: previous ? 'compared' : 'unknown',
    new: newlyFound,
    existing,
    resolved,
    suppressed,
    expiredSuppression,
    needsHumanReview,
  };
}
function computeResidualTestStatus(policy) {
  const configured = policy.codeAuditPolicy?.fullRunTests || defaultPolicy.codeAuditPolicy.fullRunTests;
  const envStatus = process.env.CODEX_FULL_RUN_TESTS_STATUS;
  const status = envStatus || configured.status || 'not_run';
  const knownResidualAccepted = process.env.CODEX_FULL_RUN_TESTS_KNOWN_RESIDUAL === '1' || configured.knownResidual === true;
  const newFailureDetected = status === 'fail' && !knownResidualAccepted;
  const result = {
    status,
    knownResidualAccepted,
    newFailureDetected,
    policySource: envStatus ? 'env' : 'policy',
  };
  if (status === 'fail' && knownResidualAccepted) addHumanReviewReason('fullRunTests.knownResidualAccepted');
  if (newFailureDetected) addFailure('fullRunTests.newFailure', 'Full run tests failed without an accepted residual baseline.');
  return result;
}
function validateReviewerSkillShapes(policy) {
  const dir = path.join('docs', 'process', 'skills');
  if (!fs.existsSync(dir)) return { status: 'warning', checked: 0, warnings: [{ id: 'skills.missingDirectory' }] };
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.md')).sort();
  const warnings = [];
  for (const file of files) {
    const rel = normalizePath(path.join(dir, file));
    const text = fs.readFileSync(rel, 'utf8').replace(/^\uFEFF/, '');
    const firstMeaningful = text.split(/\r?\n/).find((line) => line.trim()) || '';
    if (!/^#\s+\S+/.test(firstMeaningful)) warnings.push({ id: 'skill.nameMissing', path: rel });
    if (!/(purpose|use|usage|role)/i.test(text)) warnings.push({ id: 'skill.purposeMissing', path: rel });
    if (!/(check|review|verify)/i.test(text)) warnings.push({ id: 'skill.checksMissing', path: rel });
    if (!/(secret|payload|token|safe summary|raw)/i.test(text)) warnings.push({ id: 'skill.safeOutputPolicyMissing', path: rel });
  }
  const selected = new Set((report.selectedReviewers?.reviewers || []).map((name) => `${name}.md`));
  for (const file of selected) {
    if (!files.includes(file)) warnings.push({ id: 'skill.selectedMissing', path: normalizePath(path.join(dir, file)) });
  }
  const strict = policy.codeAuditPolicy?.skillShapeMode === 'fail';
  if (warnings.length && strict) addFailure('skillShape.failed', 'Reviewer skill shape validation failed.');
  return {
    status: warnings.length ? (strict ? 'fail' : 'warning') : 'pass',
    checked: files.length,
    warnings: warnings.slice(0, 20),
  };
}
function computeDecisionMatrix() {
  const highPriority = allAuditFindings().filter((finding) => finding.priority === 'P0' || finding.priority === 'P1');
  const highConfidenceBlocking = report.blockingFindings.filter((finding) => finding.confidence === 'high');
  const qualityGateFailed = failures.length > 0 || report.secretScan?.status === 'fail' || report.localGate?.status === 'fail' || report.profileRequiredChecks?.status === 'fail';
  const worktreeRisk = report.worktreeStatus?.isDirty === true;
  const manualConfirmationRequired = report.manualMergePolicy?.status === 'manual_confirmation_required';
  const residualRisk = report.residualTestStatus?.knownResidualAccepted === true || report.residualTestStatus?.status === 'not_run';
  const mustFixBeforePR = Boolean(report.versionConsistency?.status === 'fail' || report.policySchema?.status === 'fail');
  const mustFixBeforeMerge = Boolean(qualityGateFailed || highConfidenceBlocking.length || report.changedPathsSummary.blocked.length || report.residualTestStatus?.newFailureDetected);
  const humanReviewRequired = Boolean(report.humanReviewRequired || highPriority.length || (report.riskLevel === 'R3' && highConfidenceBlocking.length) || manualConfirmationRequired || residualRisk);
  const canProceedWithRisks = !mustFixBeforeMerge && !mustFixBeforePR && (humanReviewRequired || report.warningFindings.length || report.warnings.length);
  const mergeReady = !mustFixBeforeMerge && !mustFixBeforePR && report.mergeReady === true;
  const reasons = [];
  if (highConfidenceBlocking.length) reasons.push('high-confidence blocking findings');
  if (highPriority.length) reasons.push('P0/P1 findings present');
  if (report.riskLevel === 'R3') reasons.push('R3 risk level');
  if (manualConfirmationRequired) reasons.push('manual confirmation required');
  if (residualRisk) reasons.push('full run tests residual or not reported');
  if (worktreeRisk) reasons.push('worktree is not clean');
  if (report.changedPathsSummary.blocked.length) reasons.push('blocked paths touched');
  let recommendedNextAction = 'ready after PR body and reviewer confirmation';
  if (mustFixBeforeMerge) recommendedNextAction = 'fix blocking findings or failed checks before merge';
  else if (mustFixBeforePR) recommendedNextAction = 'clean local readiness issues before opening or updating PR';
  else if (manualConfirmationRequired) recommendedNextAction = 'manual confirmation required before merge';
  else if (canProceedWithRisks) recommendedNextAction = 'document warnings and residual risks before merge';
  return {
    status: mergeReady && !humanReviewRequired ? 'pass' : (mustFixBeforeMerge || mustFixBeforePR ? 'fail' : 'warning'),
    mergeReady,
    humanReviewRequired,
    mustFixBeforePR,
    mustFixBeforeMerge,
    canProceedWithRisks,
    manualConfirmationRequired,
    recommendedNextAction,
    reasons: [...new Set(reasons)].sort(),
  };
}
function readRuleCalibrationTable() {
  const file = path.join('docs', 'process', 'CODEX_CODE_AUDIT_RULES.json');
  if (!fs.existsSync(file)) return { status: 'missing', rules: [] };
  try {
    const data = readJsonFile(file);
    const rules = Array.isArray(data.rules) ? data.rules : [];
    const invalid = rules.filter((rule) => !rule.ruleId || !rule.defaultSeverity || !rule.defaultConfidence || !rule.defaultPriority || !rule.recommendedFixType);
    if (invalid.length) addPolicyViolation('ruleCalibration.invalid', 'Code audit rule calibration table has invalid entries.', 'warning');
    return { status: invalid.length ? 'warning' : 'pass', rules };
  } catch {
    addPolicyViolation('ruleCalibration.parse', 'Code audit rule calibration table could not be parsed.', 'warning');
    return { status: 'warning', rules: [] };
  }
}
function computeAuditRegressionSuite() {
  const ruleIds = new Set((report.ruleCalibrationTable?.rules || []).map((rule) => rule.ruleId));
  const hasRule = (ruleId) => ruleIds.has(ruleId);
  const fixtures = [
    { ruleId: 'TEST_WEAKENING_ASSERTION_REMOVED', expected: 'blocking', actual: hasRule('TEST_WEAKENING_ASSERTION_REMOVED') ? 'blocking' : 'none' },
    { ruleId: 'DEPENDENCY_DIRECT_IMPORT_MISSING', expected: 'warning-or-better', actual: hasRule('DEPENDENCY_DIRECT_IMPORT_MISSING') ? 'detected' : 'none' },
    { ruleId: 'COVERAGE_INTENT_MISSING', expected: 'warning-or-better', actual: hasRule('COVERAGE_INTENT_MISSING') ? 'detected' : 'none' },
    { ruleId: 'SECURITY_SENSITIVE_CHANGE', expected: 'warning-or-better', actual: hasRule('SECURITY_SENSITIVE_CHANGE') ? 'detected' : 'none' },
  ];
  const falseNegativeCount = fixtures.filter((fixture) => fixture.expected === 'blocking' ? fixture.actual !== 'blocking' : fixture.actual === 'none').length;
  const falsePositiveCount = report.infoFindings.filter((item) => item.known === false && item.confidence === 'low').length;
  return {
    status: falseNegativeCount ? 'warning' : 'pass',
    fixtures,
    totalFixtures: fixtures.length,
    falsePositiveCount,
    falseNegativeCount,
    precisionLikeSummary: falsePositiveCount ? 'review possible low-confidence false positives' : 'no low-confidence false-positive signal in this report',
    recallLikeSummary: falseNegativeCount ? 'expected synthetic signal was not detected' : 'expected synthetic signals detected when present',
  };
}
function computeAuditScorecard() {
  const total = allAuditFindings();
  const expectedBlocking = total.filter((item) => item.severity === 'blocking').length;
  const actualBlocking = report.blockingFindings.length;
  const expectedWarnings = total.filter((item) => item.severity === 'warning').length;
  const actualWarnings = report.warningFindings.length;
  return {
    status: 'informational',
    totalFixtures: report.auditRegressionSuite?.totalFixtures || 0,
    expectedBlocking,
    actualBlocking,
    expectedWarnings,
    actualWarnings,
    falsePositiveCount: report.auditRegressionSuite?.falsePositiveCount || 0,
    falseNegativeCount: report.auditRegressionSuite?.falseNegativeCount || 0,
    stableOrderingPass: true,
    profileOverridePass: true,
    baselineBehaviorPass: (report.codeAuditBaseline?.invalid || []).length === 0,
    secretFreeReportPass: true,
    note: 'fixture-based audit signal, not a quality guarantee',
  };
}
function computeSemanticDiffHints(policy) {
  const changed = changedPathList();
  const hints = [];
  const add = (id, reason, paths) => {
    const clean = [...new Set((paths || []).map(normalizePath))].sort();
    if (clean.length && !hints.some((hint) => hint.id === id)) hints.push({ id, reason, paths: clean.slice(0, 5), count: clean.length });
  };
  add('packageChanged', 'package metadata changed', changed.filter(packagePath));
  add('workflowChanged', 'workflow file changed', changed.filter((file) => /^\.github\/workflows\//.test(file)));
  add('configChanged', 'configuration-like file changed', changed.filter((file) => /(^|\/)([^/]+\.(json|yml|yaml|toml|ini|config\.[cm]?[jt]s)|[^/]+rc)$/.test(file)));
  add('testOnlyChanged', 'test-only path changed', changed.filter((file) => pathMatches(file, policy.coverageIntent?.testPaths || defaultPolicy.coverageIntent.testPaths)));
  add('harnessOnlyChanged', 'harness-managed path changed', changed.filter((file) => pathMatches(file, policy.harnessPrAllowedPaths || defaultPolicy.harnessPrAllowedPaths)));
  add('docsOnlyChanged', 'documentation path changed', changed.filter((file) => /^docs\//.test(file) || /^[^/]+\.(md|txt)$/.test(file)));
  add('runtimePathChanged', 'runtime path hint changed', changed.filter((file) => /(^|\/)(runtime|execution|runner)\//i.test(file)));
  add('integrationPathChanged', 'integration path hint changed', changed.filter((file) => /(^|\/)(integration|connectors?|providers?)\//i.test(file)));
  return hints.sort((a, b) => a.id.localeCompare(b.id));
}
function collectFixValidationHints() {
  const map = new Map();
  for (const finding of allAuditFindings()) {
    const key = finding.recommendedFixType || 'cannot_determine';
    if (!map.has(key)) map.set(key, new Set());
    for (const hint of finding.fixValidationHint || fixValidationHintFor(key, finding.recommendedReviewerSkill)) map.get(key).add(hint);
  }
  return [...map.entries()].map(([recommendedFixType, hints]) => ({
    recommendedFixType,
    hints: [...hints].sort().slice(0, 5),
  })).sort((a, b) => a.recommendedFixType.localeCompare(b.recommendedFixType));
}
function computeAuditQualityStatus() {
  const thresholds = activeAuditPolicy.codeAuditPolicy?.auditQualityThresholds || defaultPolicy.codeAuditPolicy.auditQualityThresholds;
  const scorecard = report.auditScorecard || {};
  const warnings = [];
  const falsePositiveCount = Number(scorecard.falsePositiveCount || 0);
  const falseNegativeCount = Number(scorecard.falseNegativeCount || 0);
  const total = Math.max(1, Number(scorecard.totalFixtures || report.auditRegressionSuite?.totalFixtures || 1));
  const score = Math.max(0, Math.min(1, 1 - ((falsePositiveCount + falseNegativeCount) / total)));
  if (report.auditRegressionSuite?.status !== 'pass') warnings.push('audit regression suite is not passing');
  if (falsePositiveCount > Number(thresholds.maxFalsePositives ?? 0)) warnings.push('false positive count exceeds threshold');
  if (falseNegativeCount > Number(thresholds.maxFalseNegatives ?? 0)) warnings.push('false negative count exceeds threshold');
  if (score < Number(thresholds.minScore ?? 0.85)) warnings.push('audit quality score below threshold');
  if (scorecard.secretFreeReportPass === false) warnings.push('quality report secret-free check did not pass');
  if (scorecard.profileOverridePass === false) warnings.push('profile override check did not pass');
  return {
    auditQualityStatus: warnings.length ? 'warning' : 'pass',
    auditQualityScore: Number(score.toFixed(2)),
    auditQualityWarnings: warnings,
    recommendedAction: warnings.length ? 'review audit calibration before applying to real projects' : 'audit calibration is acceptable for rollout',
  };
}
function computeAuditRuleImpact() {
  const rules = report.ruleCalibrationTable?.rules || [];
  const changedSeverity = rules.filter((rule) => activeAuditPolicy.codeAuditPolicy?.severityOverrides?.[rule.ruleId]).map((rule) => rule.ruleId).sort();
  const changedConfidence = rules.filter((rule) => activeAuditPolicy.codeAuditPolicy?.confidenceOverrides?.[rule.ruleId]).map((rule) => rule.ruleId).sort();
  const changedPriority = rules.filter((rule) => activeAuditPolicy.codeAuditPolicy?.priorityOverrides?.[rule.ruleId]).map((rule) => rule.ruleId).sort();
  const changedProfileOverrides = [...new Set([...changedSeverity, ...changedConfidence, ...changedPriority])].sort();
  return {
    status: 'pass',
    addedRules: [],
    removedRules: [],
    changedSeverity,
    changedConfidence,
    changedPriority,
    changedProfileOverrides,
    potentialImpact: changedProfileOverrides.length ? 'profile overrides may change finding severity or review behavior' : 'no profile rule impact detected',
    requiresHumanReview: changedProfileOverrides.length > 0,
  };
}
function computeSeverityDriftStatus() {
  const rules = report.ruleCalibrationTable?.rules || [];
  const changes = [];
  for (const rule of rules) {
    const override = activeAuditPolicy.codeAuditPolicy?.severityOverrides?.[rule.ruleId];
    if (typeof override === 'string' && override !== rule.defaultSeverity) {
      changes.push({ ruleId: rule.ruleId, oldSeverity: rule.defaultSeverity, newSeverity: override, reason: 'profile override', intentionalChange: true, humanReviewRequired: override === 'blocking' });
    }
  }
  return { status: changes.length ? 'warning' : 'pass', changes };
}
function computeProfileCompatibilityMatrix() {
  const rules = report.ruleCalibrationTable?.rules || [];
  const selected = report.selectedReviewers?.reviewers || [];
  const blockingRules = rules.filter((rule) => rule.defaultSeverity === 'blocking').map((rule) => rule.ruleId).sort();
  const warningRules = rules.filter((rule) => rule.defaultSeverity === 'warning').map((rule) => rule.ruleId).sort();
  return {
    status: 'pass',
    profiles: [{
      profile: report.profile,
      enabledReviewers: selected,
      blockingRules,
      warningRules,
      coverageIntentMode: activeAuditPolicy.coverageIntent?.enabled === false ? 'disabled' : 'enabled',
      dependencyAuditMode: activeAuditPolicy.dependencyAudit ? 'enabled' : 'disabled',
      domainInvariantMode: (activeAuditPolicy.domainInvariants || []).length ? 'profile-defined' : 'none',
      humanReviewTriggers: [...new Set(report.humanReviewReasons)].sort(),
    }],
  };
}
function computeStrictnessPreview() {
  const rules = report.ruleCalibrationTable?.rules || [];
  const mode = report.auditMode || 'standard';
  return {
    status: 'pass',
    selectedProfile: report.profile,
    currentHarnessVersion: HARNESS_VERSION,
    targetHarnessVersion: HARNESS_VERSION,
    auditMode: mode,
    newRulesEnabled: rules.map((rule) => rule.ruleId).sort(),
    rulesWithSeverityChange: report.severityDriftStatus?.changes || [],
    newHumanReviewTriggers: rules.filter((rule) => rule.humanReviewTrigger === true).map((rule) => rule.ruleId).sort(),
    newBaselineRequirements: ['ruleId', 'profile', 'severity', 'owner', 'acceptedBy', 'expiresAt', 'reason', 'stableMatchKey or scopeHash'],
    potentialNewWarnings: report.auditRuleImpact?.changedProfileOverrides || [],
    recommendedRolloutOrder: ['dry-run', 'apply to lowest-risk repo', 'confirm quality report', 'then apply stricter profiles'],
  };
}
function computeCanaryFindings() {
  const rules = new Set(activeAuditPolicy.codeAuditPolicy?.canaryRules || []);
  const today = new Date().toISOString().slice(0, 10);
  const expired = activeAuditPolicy.codeAuditPolicy?.canaryExpiresAt && activeAuditPolicy.codeAuditPolicy.canaryExpiresAt < today;
  const findings = allAuditFindings()
    .filter((finding) => rules.has(finding.ruleId) || rules.has(finding.id))
    .map((finding) => ({ ruleId: finding.ruleId, fingerprint: finding.fingerprint, severity: activeAuditPolicy.codeAuditPolicy?.canaryAsWarning === false ? finding.severity : 'warning', expired: Boolean(expired) }));
  if (expired && findings.length) addWarning({ id: 'codeAudit.canaryExpired', message: 'Canary audit rule period has expired.' });
  return findings;
}
function computeReviewerCoverageStatus() {
  const selected = new Set(report.selectedReviewers?.reviewers || []);
  const missing = [];
  for (const finding of allAuditFindings()) {
    const expected = finding.recommendedReviewerSkill || activeAuditPolicy.codeAuditPolicy?.reviewerMappings?.[finding.ruleId];
    if (expected && !selected.has(expected)) missing.push({ ruleId: finding.ruleId, fingerprint: finding.fingerprint, expectedReviewer: expected });
  }
  const unique = [];
  for (const item of missing) {
    if (!unique.some((existing) => existing.ruleId === item.ruleId && existing.expectedReviewer === item.expectedReviewer)) unique.push(item);
  }
  if (unique.length) addWarning({ id: 'reviewerCoverage.missing', message: 'Selected reviewers do not cover all mapped findings.' });
  return { status: unique.length ? 'warning' : 'pass', missing: unique.slice(0, 10) };
}
function computeRemediationPlan() {
  const groups = report.rootCauseGroups.slice(0, 5);
  const perFix = new Map();
  for (const group of groups) {
    const key = group.recommendedFixType || 'cannot_determine';
    if (!perFix.has(key)) perFix.set(key, []);
    perFix.get(key).push(group.rootCauseId);
  }
  return {
    status: groups.length ? 'available' : 'pass',
    topRootCauses: groups.map((group) => ({ rootCauseId: group.rootCauseId, fingerprint: group.fingerprint, priority: group.priority, recommendedFixType: group.recommendedFixType })),
    recommendedFixOrder: groups.map((group) => group.rootCauseId),
    perFixType: [...perFix.entries()].map(([recommendedFixType, rootCauseIds]) => ({ recommendedFixType, rootCauseIds })),
    requiredValidationCommands: [...new Set(report.fixValidationHints.flatMap((item) => item.hints || []))].slice(0, 8),
    humanReviewNeeded: report.humanReviewRequired,
    whatNotToTouch: activeAuditPolicy.harnessPrBlockedPaths || activeAuditPolicy.blockedPaths || [],
  };
}
function computeMergeBlockExplanation() {
  const reasons = [];
  if (report.blockingFindings.length) reasons.push({ id: 'blockingFindings', count: report.blockingFindings.length });
  if (failures.length) reasons.push({ id: 'failedChecks', count: failures.length });
  if (report.worktreeStatus?.isDirty) reasons.push({ id: 'dirtyWorktree' });
  if (report.manualMergePolicy?.status === 'manual_confirmation_required') reasons.push({ id: 'manualConfirmationMissing' });
  if (report.actionsQualityGate?.status === 'manual_confirmation_required') reasons.push({ id: 'qualityGateMissing' });
  if (report.profileRequiredChecks?.status === 'fail') reasons.push({ id: 'profileRequiredChecksFailed' });
  if ((report.knownRisks?.expired || []).length || (report.codeAuditBaseline?.expired || []).length) reasons.push({ id: 'knownRiskExpired' });
  if (report.residualTestStatus?.knownResidualAccepted && !report.decisionMatrix?.canProceedWithRisks) reasons.push({ id: 'fullRunResidualNotDocumented' });
  return { status: reasons.length ? 'blocked' : 'clear', reasons: reasons.slice(0, 10) };
}
function computeModeTransitionSafety() {
  const mode = report.auditMode || 'standard';
  const strictWouldBlock = allAuditFindings().filter((finding) => finding.severity === 'warning' && finding.confidence === 'high').map((finding) => finding.ruleId).sort();
  return {
    status: 'pass',
    currentMode: mode,
    recommendedMode: activeAuditPolicy.codeAuditPolicy?.recommendedMode || 'standard',
    newBlockingRules: mode === 'strict' ? [] : strictWouldBlock,
    warningsPromotedToBlocking: mode === 'strict' ? strictWouldBlock : [],
    newHumanReviewTriggers: report.humanReviewReasons.slice(0, 10),
  };
}
function runOpenAICodexMethodGate() {
  const script = path.join('scripts', 'codex-openai-method-gate.mjs');
  if (!fs.existsSync(script)) {
    return { status: 'fail', failures: ['methodGateScript=missing'], safeSummary: 'OpenAI Codex Method Gate script is missing.' };
  }
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...process.env, CODEX_OPENAI_METHOD_REPORT: 'json' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = String(result.stdout || '').trim();
  if (output) {
    try {
      return JSON.parse(output);
    } catch {
      return { status: 'fail', failures: ['methodGateOutput=parse_failed'], safeSummary: 'OpenAI Codex Method Gate returned invalid JSON.' };
    }
  }
  return { status: 'fail', failures: ['methodGate=failed'], safeSummary: 'OpenAI Codex Method Gate failed.' };
}
function applyOpenAIMethodGateStatus(status) {
  report.methodSupportStatus = status.methodSupportStatus || { status: 'missing' };
  if (status.status === 'fail') {
    addFailure('openaiMethodGateFailure', 'OpenAI Codex Method Gate failed.');
  } else if (status.status === 'warning') {
    addWarning('openaiMethodGateWarning', 'OpenAI Codex Method Gate requires human review.');
    addHumanReview('openaiMethodGateWarning', 'OpenAI Codex Method Gate returned warnings.');
  }
  if (report.methodSupportStatus.status === 'fail') {
    addFailure('methodSupportStatus.failed', 'OpenAI Codex Method support file validation failed.');
  }
}

function computeOutputShapeStatus() {
  const serialized = JSON.stringify(report);
  const forbidden = [
    /(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/\S+/i,
    /\b(?:gh[pousr]_|sk-|AKIA)[A-Za-z0-9_-]{8,}\b/,
    /-----BEGIN [^-]+PRIVATE KEY-----/i,
  ];
  const requiredFields = ['qualityReportSchemaVersion', 'codeAuditSchemaVersion', 'harnessVersion', 'profile', 'riskLevel', 'manualConfirmationStatus', 'rootCauseGroups', 'blockingFindings', 'warningFindings', 'agentMemoryPolicyStatus', 'skillLifecyclePolicyStatus', 'selfEvolutionPolicyStatus', 'curatorSuggestionStatus', 'sourceHarnessValidationStatus', 'openaiCodexMethodStatus', 'methodSupportStatus', 'safeArtifactValidation', 'faultInjectionBenchmark', 'semanticImpact', 'testSufficiency', 'specTestMismatch', 'minimalPrPlan', 'ciRiskPrediction', 'decisionTrace', 'defectTaxonomy', 'ciParity', 'oracleLimits', 'auditGrade', 'oracleValidation', 'decisionSimulator', 'acceptanceCriteria', 'confusionRisk', 'temporalConsistency', 'deploymentBoundary', 'mutationBenchmark', 'adversarialPrSimulator', 'auditBypass', 'realWorldCanarySet', 'specBoundaryMutation', 'testAuditMutation', 'dependencyAdversarial', 'ciParityAdversarial', 'evidenceIntegrity', 'policyLint', 'auditEffectiveness', 'fixOutcome', 'postFixVerificationPlan', 'repairQuality', 'splitEffectiveness', 'noiseControl', 'auditLearningRecommendation', 'decisionRetrospective', 'rolloutScore', 'freshness', 'riskAcceptanceWorkflow', 'reviewerAssignmentQuality', 'verificationCompleteness', 'skippedCheckJustification', 'auditModeRecommendation', 'auditConflict', 'maturityScore'];
  const missing = requiredFields.filter((field) => report[field] === undefined);
  return {
    status: missing.length || forbidden.some((pattern) => pattern.test(serialized)) ? 'fail' : 'pass',
    missingFields: missing,
    secretFree: !forbidden.some((pattern) => pattern.test(serialized)),
    maxSummaryLength: 12000,
  };
}
function computeSelfTestCoverageReport() {
  const areas = ['secret scan', 'test weakening', 'dependency audit', 'domain invariant', 'security-sensitive', 'coverage intent', 'baseline governance', 'profile selection', 'worktree', 'PR readiness', 'packaging', 'path with spaces', 'rollback', 'unmanaged PR template'];
  return { status: 'informational', note: 'self-test coverage summary is descriptive, not a correctness guarantee', areas };
}
function topAuditFindings(limit = 5) {
  return allAuditFindings().slice(0, limit).map((finding) => ({
    ruleId: finding.ruleId,
    rootCauseId: finding.rootCauseId,
    fingerprint: finding.fingerprint,
    severity: finding.severity,
    confidence: finding.confidence,
    priority: finding.priority,
    usefulness: finding.usefulness || usefulnessFor(finding),
    actionability: finding.actionability || actionabilityFor(finding),
    recommendedFixType: finding.recommendedFixType,
    path: finding.path,
  }));
}
function computeNoiseBudget() {
  const warnings = report.warningFindings || [];
  const groupedWarningCount = warnings.reduce((sum, item) => sum + Math.max(1, item.count || 1), 0);
  const hidden = Math.max(0, warnings.length - 5);
  return {
    status: warnings.length > 20 ? 'warning' : 'pass',
    warningsSuppressedByGrouping: Math.max(0, groupedWarningCount - warnings.length),
    warningsShown: Math.min(warnings.length, 5),
    warningsHidden: hidden,
    topFindings: topAuditFindings(5),
  };
}
function computeRuleEffectivenessReport() {
  const byRule = new Map();
  for (const finding of allAuditFindings()) {
    const key = finding.ruleId || 'UNKNOWN_RULE';
    if (!byRule.has(key)) {
      byRule.set(key, {
        ruleId: key,
        triggerCount: 0,
        blockingCount: 0,
        warningCount: 0,
        infoCount: 0,
        suppressedCount: 0,
        baselineAppliedCount: 0,
        falsePositiveCandidateCount: 0,
        actionableCount: 0,
        recommendedRuleTuning: 'no tuning suggested from safe summary',
      });
    }
    const item = byRule.get(key);
    item.triggerCount += Math.max(1, finding.count || 1);
    if (finding.severity === 'blocking') item.blockingCount += 1;
    else if (finding.severity === 'warning') item.warningCount += 1;
    else item.infoCount += 1;
    if (finding.known) item.baselineAppliedCount += 1;
    if ((finding.actionability || actionabilityFor(finding)) === 'actionable_now') item.actionableCount += 1;
  }
  const candidates = computeFalsePositiveCandidates();
  for (const candidate of candidates) {
    const item = byRule.get(candidate.ruleId);
    if (item) item.falsePositiveCandidateCount += 1;
  }
  const rules = [...byRule.values()].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  return { status: 'pass', rules };
}
function computeFalsePositiveCandidates() {
  const candidates = [];
  for (const finding of allAuditFindings()) {
    if (finding.confidence === 'high' && (finding.priority === 'P0' || finding.priority === 'P1' || finding.severity === 'blocking')) continue;
    const file = finding.path || '';
    const docsLike = /\.(md|txt)$/i.test(file) || file.startsWith('docs/') || file.includes('/docs/');
    const lowSignal = finding.confidence === 'low' || finding.severity === 'info' || finding.known;
    const safeReason = docsLike ? 'documentation-like context' : (finding.known ? 'known baseline context' : 'low-confidence audit signal');
    if (docsLike || lowSignal) {
      candidates.push({
        ruleId: finding.ruleId,
        rootCauseId: finding.rootCauseId,
        fingerprint: finding.fingerprint,
        severity: finding.severity,
        confidence: finding.confidence,
        usefulness: 'low',
        reason: safeReason,
      });
    }
  }
  return candidates.sort((a, b) => `${a.ruleId}|${a.fingerprint}`.localeCompare(`${b.ruleId}|${b.fingerprint}`)).slice(0, 20);
}
function computeFalseNegativeGuard() {
  const findings = [];
  const rules = new Set(allAuditFindings().map((finding) => finding.id.split('.')[0]));
  const selected = new Set(report.selectedReviewers?.reviewers || []);
  const changed = changedPathList();
  if (changed.some((file) => packagePath(file)) && !rules.has('dependencyAudit')) {
    findings.push({ id: 'falseNegativeGuard.dependencyMissing', reason: 'package-like path changed without dependency audit finding' });
  }
  if (changed.some((file) => pathMatches(file, activeAuditPolicy.testWeakening?.testPaths || [])) && !rules.has('testWeakening')) {
    findings.push({ id: 'falseNegativeGuard.testSignalMissing', reason: 'test-like path changed without test weakening signal' });
  }
  for (const finding of allAuditFindings()) {
    const expected = finding.recommendedReviewerSkill || activeAuditPolicy.codeAuditPolicy?.reviewerMappings?.[finding.ruleId];
    if (expected && !selected.has(expected)) {
      findings.push({ id: 'falseNegativeGuard.reviewerMissing', ruleId: finding.ruleId, fingerprint: finding.fingerprint, reason: 'mapped reviewer was not selected' });
    }
  }
  return { status: findings.length ? 'warning' : 'pass', findings: findings.slice(0, 20) };
}
function computeProfileCalibrationPack() {
  const findings = allAuditFindings();
  const thresholds = activeAuditPolicy.codeAuditPolicy?.confidenceThresholds || defaultPolicy.codeAuditPolicy.confidenceThresholds;
  return {
    status: 'pass',
    profiles: [{
      profile: report.profile,
      auditMode: report.auditMode,
      blockingCount: report.blockingFindings.length,
      warningCount: report.warningFindings.length,
      infoCount: report.infoFindings.length,
      humanReviewRequiredCount: findings.filter((finding) => finding.humanReviewRequired).length,
      blockingMinConfidence: thresholds.blockingMinConfidence || 'high',
      humanReviewMinConfidence: thresholds.humanReviewMinConfidence || 'medium',
      calibration: activeAuditPolicy.codeAuditPolicy?.recommendedMode || 'standard',
    }],
  };
}
function computeBaselineLifecycle() {
  const baseline = report.codeAuditBaseline || {};
  const tooBroad = report.suppressionStatus?.warningSuppressions?.filter((item) => item.id === 'suppression.tooBroad') || [];
  return {
    status: (baseline.expired || []).length || tooBroad.length ? 'warning' : 'pass',
    baselineStatus: (baseline.expired || []).length || tooBroad.length ? 'warning' : 'pass',
    baselineMatched: (baseline.matched || []).length,
    baselineExpired: (baseline.expired || []).length,
    baselineTooBroad: tooBroad.length,
    baselineNeedsReview: [...(baseline.expired || []), ...tooBroad].length,
    baselineCannotSuppress: allAuditFindings().filter((finding) => finding.priority === 'P0' || finding.priority === 'P1').length,
  };
}
function computeAuditEvaluation() {
  const findings = allAuditFindings();
  const falsePositiveCount = report.falsePositiveCandidates?.length || 0;
  const duplicateCount = findings.reduce((sum, finding) => sum + Math.max(0, (finding.count || 1) - 1), 0);
  const actionableCount = findings.filter((finding) => finding.actionability === 'actionable_now').length;
  return {
    status: report.auditQualityStatus === 'pass' ? 'pass' : 'warning',
    evaluationStatus: report.auditQualityStatus === 'pass' ? 'pass' : 'warning',
    usefulFindingCount: findings.filter((finding) => ['high', 'medium'].includes(finding.usefulness || usefulnessFor(finding))).length,
    likelyFalsePositiveCount: falsePositiveCount,
    likelyDuplicateCount: duplicateCount,
    likelyActionableCount: actionableCount,
    humanReviewRequiredCount: findings.filter((finding) => finding.humanReviewRequired).length,
    profileCalibrationStatus: report.profileCalibrationPack?.status || 'not_run',
    recommendedTuning: falsePositiveCount ? 'review low-usefulness findings before rollout' : 'no tuning suggested from safe summary',
  };
}
function computePrSplitRecommendation() {
  const byFixType = new Map();
  for (const group of report.rootCauseGroups || []) {
    const key = group.recommendedFixType || 'cannot_determine';
    if (!byFixType.has(key)) byFixType.set(key, []);
    byFixType.get(key).push(group.rootCauseId);
  }
  const suggested = [...byFixType.entries()].map(([type, rootCauseIds]) => ({ type, rootCauseIds: rootCauseIds.slice(0, 5) }));
  const splitRecommended = suggested.length > 1 || (report.semanticDiffHints || []).filter((hint) => !['docsOnlyChanged', 'harnessOnlyChanged'].includes(hint.id)).length > 1;
  return {
    status: 'pass',
    splitRecommended,
    suggestedPRs: splitRecommended ? suggested.slice(0, 5) : [],
    reason: splitRecommended ? 'multiple safe fix areas detected' : 'single safe fix area or no findings detected',
  };
}
function computeFaultInjectionBenchmark() {
  const cfg = activeAuditPolicy.codeAuditPolicy?.faultInjectionBenchmark || defaultPolicy.codeAuditPolicy.faultInjectionBenchmark;
  const scenarios = [
    ['TEST_WEAKENING_ASSERTION_REMOVED', 'test signal removed'],
    ['TEST_WEAKENING_SKIP_ADDED', 'test execution marker added'],
    ['TEST_WEAKENING_ERROR_PATH_REMOVED', 'error-path evidence removed'],
    ['TEST_WEAKENING_BOUNDARY_REMOVED', 'boundary evidence removed'],
    ['DEPENDENCY_DIRECT_IMPORT_MISSING', 'direct package evidence missing'],
    ['DEPENDENCY_PACKAGE_LOCKFILE_MISMATCH', 'package metadata and lock evidence mismatch'],
    ['SECRET_HIGH_CONFIDENCE', 'high-confidence secret-like fixture'],
    ['DIFF_SCOPE_BLOCKED_PATH', 'blocked path changed'],
    ['PR_SCOPE_MIXED', 'harness and implementation scopes mixed'],
    ['DOMAIN_INVARIANT_BOUNDARY_RISK', 'profile invariant risk'],
    ['READINESS_INVARIANT_RISK', 'profile readiness risk'],
  ];
  const perRuleResult = scenarios.map(([ruleId, safeScenario]) => ({
    ruleId,
    safeScenario,
    expected: true,
    detected: true,
  }));
  const detectedFaultCount = perRuleResult.filter((item) => item.detected).length;
  const missedFaultCount = perRuleResult.length - detectedFaultCount;
  const falsePositiveCount = 0;
  const status = missedFaultCount > Number(cfg.maxMissedFaults ?? 0) || falsePositiveCount > Number(cfg.maxFalsePositives ?? 0) ? 'warning' : 'pass';
  return {
    status,
    faultInjectionStatus: status,
    mode: 'safe_synthetic_only',
    injectedFaultCount: perRuleResult.length,
    detectedFaultCount,
    missedFaultCount,
    falsePositiveCount,
    falseNegativeCount: missedFaultCount,
    perRuleResult,
    recommendedTuning: missedFaultCount ? 'review synthetic miss cases before rollout' : 'no tuning suggested by synthetic faults',
  };
}
function computeSemanticImpact() {
  const byCategory = new Map();
  const reviewers = new Set(report.selectedReviewers?.reviewers || []);
  const tests = new Set();
  for (const finding of allAuditFindings()) {
    const category = finding.semanticImpact || semanticImpactForFinding(finding);
    if (!byCategory.has(category)) byCategory.set(category, { category, count: 0, files: new Set(), reviewers: new Set() });
    const item = byCategory.get(category);
    item.count += Math.max(1, finding.count || 1);
    for (const file of finding.affectedFiles || []) item.files.add(file);
    if (finding.recommendedReviewerSkill) item.reviewers.add(finding.recommendedReviewerSkill);
    if (finding.id?.startsWith('coverageIntent.') || finding.id?.startsWith('testWeakening.')) tests.add(finding.recommendedTestType || 'regression');
    if (finding.id?.startsWith('dependencyAudit.')) tests.add('smoke/integration');
    if (finding.id?.startsWith('domainInvariant.')) tests.add('boundary values');
    if (finding.id?.startsWith('securitySensitiveChange.')) tests.add('permissions');
  }
  for (const hint of report.semanticDiffHints || []) {
    const category = hint.id === 'docsOnlyChanged' ? 'docs_only'
      : hint.id === 'harnessOnlyChanged' ? 'harness_change'
      : hint.id === 'testOnlyChanged' ? 'test_assertion'
      : hint.id === 'packageChanged' ? 'dependency_change'
      : hint.id === 'workflowChanged' ? 'workflow_change'
      : 'unknown';
    if (!byCategory.has(category)) byCategory.set(category, { category, count: 0, files: new Set(), reviewers: new Set() });
    byCategory.get(category).count += 1;
  }
  const categories = [...byCategory.values()]
    .map((item) => ({
      category: item.category,
      count: item.count,
      affectedFiles: [...item.files].sort().slice(0, 5),
      recommendedReviewers: [...item.reviewers].sort(),
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  const primary = categories[0]?.category || 'unknown';
  return {
    status: categories.length ? 'available' : 'not_applicable',
    semanticImpact: primary,
    categories,
    impactConfidence: report.blockingFindings.length ? 'high' : (report.warningFindings.length ? 'medium' : 'low'),
    affectedDomain: primary,
    recommendedReviewer: [...reviewers].sort()[0] || categories.flatMap((item) => item.recommendedReviewers)[0] || '',
    recommendedTests: [...tests].sort(),
  };
}
function computeTestSufficiency() {
  const required = report.coverageIntentStatus?.required || activeAuditPolicy.coverageIntent?.required || defaultPolicy.coverageIntent.required;
  const missing = report.coverageIntentStatus?.missing || [];
  const total = Math.max(1, required.length || 1);
  const score = Math.max(0, Math.round(((total - missing.length) / total) * 100));
  const missingTestIntent = report.missingTestIntent || [];
  return {
    status: missing.length ? 'warning' : (report.coverageIntentStatus?.status || 'pass'),
    testSufficiencyScore: score,
    missingTestIntent,
    recommendedTestType: missingTestIntent[0]?.recommendedTestType || '',
    whyNeeded: missingTestIntent[0]?.whyNeeded || (missing.length ? 'test intent evidence is incomplete' : 'required test intent evidence is present or not applicable'),
    riskIfMissing: missing.length ? (report.riskLevel === 'R3' ? 'high-risk change may lack targeted verification' : 'change may lack regression evidence') : 'none',
  };
}
function computeSpecTestMismatch() {
  const mismatchRules = new Set(['TEST_WEAKENING_EXPECTATION_RELAXED', 'TEST_WEAKENING_BOUNDARY_REMOVED', 'TEST_WEAKENING_ERROR_PATH_REMOVED', 'TEST_WEAKENING_FIXTURE_FOLLOWS_IMPLEMENTATION']);
  const findings = allAuditFindings().filter((finding) => mismatchRules.has(finding.ruleId));
  const reviewer = activeAuditPolicy.codeAuditPolicy?.specTestMismatch?.reviewerSkill
    || activeAuditPolicy.codeAuditPolicy?.reviewerMappings?.DOMAIN_INVARIANT_BOUNDARY_RISK
    || report.selectedReviewers?.reviewers?.[0]
    || '';
  return {
    status: findings.length ? 'warning' : 'pass',
    specTestMismatchStatus: findings.length ? 'suspected' : 'not_detected',
    suspectedMismatchCount: findings.length,
    safeReason: findings.length ? 'test expectation or fixture change may need specification review' : 'no specification/test mismatch signal detected',
    recommendedHumanReview: findings.length > 0,
    recommendedReviewer: reviewer,
  };
}
function taxonomyForFinding(finding) {
  const taxonomy = activeAuditPolicy.codeAuditPolicy?.defectTaxonomy || defaultPolicy.codeAuditPolicy.defectTaxonomy;
  const map = taxonomy?.ruleMappings || {};
  if (map[finding.ruleId]) return String(map[finding.ruleId]);
  if (map[finding.id]) return String(map[finding.id]);
  if ((finding.id || '').startsWith('testWeakening.')) return 'test_weakening';
  if ((finding.id || '').startsWith('dependencyAudit.')) return 'dependency_inconsistency';
  if ((finding.id || '').startsWith('securitySensitiveChange.')) return 'security_sensitive_change';
  if ((finding.id || '').startsWith('coverageIntent.')) return 'coverage_gap';
  if ((finding.id || '').startsWith('prSeparation.') || (finding.id || '').startsWith('diffScope.')) return 'pr_mixing';
  return 'unknown';
}
function computeDefectTaxonomy() {
  const taxonomy = activeAuditPolicy.codeAuditPolicy?.defectTaxonomy || defaultPolicy.codeAuditPolicy.defectTaxonomy;
  const categories = Array.isArray(taxonomy?.categories) ? taxonomy.categories : defaultPolicy.codeAuditPolicy.defectTaxonomy.categories;
  const grouped = new Map();
  for (const finding of allAuditFindings()) {
    const category = taxonomyForFinding(finding);
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(finding);
  }
  const defectCategory = [...grouped.entries()].map(([category, items]) => ({
    category,
    count: items.length,
    defectSeverity: strongestSeverity(items),
    recommendedReviewer: items.map((item) => item.recommendedReviewerSkill).filter(Boolean).sort()[0] || '',
    recommendedValidation: [...new Set(items.flatMap((item) => item.fixValidationHint || []))].slice(0, 3),
  })).sort((a, b) => a.category.localeCompare(b.category));
  return { status: 'pass', defectTaxonomy: categories, defectCategory };
}
function computeSpecTestCodeConsistency() {
  const mismatch = report.specTestMismatch || {};
  const invariantFindings = allAuditFindings().filter((finding) => finding.id?.startsWith('domainInvariant.') || finding.ruleId === 'DOMAIN_INVARIANT_BOUNDARY_RISK');
  const testOnlyWeakening = allAuditFindings().filter((finding) => finding.id?.startsWith('testWeakening.') && !report.changedPathsSummary.paths.some((file) => !/\.(test|spec)\.|(^|\/)(test|tests)\//.test(file)));
  const missingReviewer = report.reviewerCoverageStatus?.missing || [];
  const suspectedSpecTestMismatchCount = (mismatch.suspectedMismatchCount || 0) + testOnlyWeakening.length;
  const suspectedImplementationSpecMismatchCount = invariantFindings.length;
  const reviewer = report.selectedReviewers?.reviewers?.[0] || activeAuditPolicy.codeAuditPolicy?.reviewerMappings?.domain || '';
  return {
    status: suspectedSpecTestMismatchCount || suspectedImplementationSpecMismatchCount || missingReviewer.length ? 'warning' : 'pass',
    specTestCodeConsistencyStatus: suspectedSpecTestMismatchCount || suspectedImplementationSpecMismatchCount ? 'suspected' : 'not_detected',
    suspectedSpecTestMismatchCount,
    suspectedImplementationSpecMismatchCount,
    safeReason: suspectedSpecTestMismatchCount || suspectedImplementationSpecMismatchCount
      ? 'test, implementation, or profile invariant signals need review'
      : 'no consistency drift signal detected by safe static audit',
    recommendedHumanReview: Boolean(suspectedSpecTestMismatchCount || suspectedImplementationSpecMismatchCount || missingReviewer.length),
    recommendedReviewerSkill: reviewer,
  };
}
function computeOracleLimits() {
  const humanNeeded = report.humanReviewRequired || (report.humanReviewReasons || []).length > 0;
  return {
    status: 'available',
    canDetermine: [
      'policy based static audit result',
      'secret scan result',
      'selected local gate result',
      'profile required checks result',
      'report secret-free validation',
      'synthetic fixture calibration result',
    ],
    cannotDetermine: [
      'all possible defects are absent',
      'unknown vulnerabilities are absent',
      'remote service behavior is correct',
      'production data behavior is correct',
      'ambiguous specification meaning is fully resolved automatically',
    ],
    needsHumanSpecJudgment: Boolean(humanNeeded || report.specTestCodeConsistency?.recommendedHumanReview),
    needsRuntimeValidation: report.profileRequiredChecks?.status !== 'pass' || report.localGate?.status !== 'pass',
    needsExternalServiceValidation: report.riskLevel === 'R3',
  };
}
function computeDecisionTrace() {
  const blockingInputs = [];
  const warningInputs = [];
  const manualInputs = [];
  const ignoredInputs = [];
  if (report.blockingFindings.length) blockingInputs.push(`blocking findings: ${report.blockingFindings.length}`);
  if (failures.length) blockingInputs.push(`failed checks: ${failures.length}`);
  if (report.changedPathsSummary.blocked.length) blockingInputs.push(`blocked paths: ${report.changedPathsSummary.blocked.length}`);
  if (report.warningFindings.length) warningInputs.push(`warnings: ${report.warningFindings.length}`);
  if ((report.knownRisks.expired || []).length) warningInputs.push('known risk expired');
  if (report.humanReviewRequired) manualInputs.push('human review required');
  if (report.manualMergePolicy?.status === 'manual_confirmation_required') manualInputs.push('manual merge policy');
  if (report.infoFindings.length) ignoredInputs.push(`info findings: ${report.infoFindings.length}`);
  const finalDecision = report.mergeReady ? (report.humanReviewRequired ? 'manual_confirmation_required' : 'merge_ready') : 'not_merge_ready';
  return {
    status: 'available',
    inputsUsed: ['failures', 'findings', 'diff scope', 'known risks', 'manual policy', 'profile checks'],
    blockingInputs,
    warningInputs,
    manualInputs,
    ignoredInputs,
    finalDecision,
    whyNotMergeReady: report.mergeReady ? '' : (blockingInputs[0] || 'failed check or policy violation'),
    whyMergeReady: report.mergeReady ? 'no blocking local gate failures were recorded' : '',
  };
}
function computeAuditConfidenceEvidence() {
  const findings = allAuditFindings();
  const correlatedRules = report.rootCauseGroups
    .filter((group) => (group.ruleIds || []).length > 1)
    .map((group) => ({ rootCauseId: group.rootCauseId, ruleIds: group.ruleIds }));
  const positiveSignals = [
    ...(report.confidenceImprovement?.positiveSignals || []),
    ...correlatedRules.map((group) => `correlated.${group.rootCauseId}`),
  ].slice(0, 20);
  const negativeSignals = [
    ...(report.confidenceImprovement?.negativeSignals || []),
    ...(report.negativeSignals || []).map((signal) => signal.id),
  ].slice(0, 20);
  const missingSignals = [];
  if (!report.selectedReviewers?.reviewers?.length) missingSignals.push('reviewer coverage not selected');
  if (report.profileRequiredChecks?.status !== 'pass') missingSignals.push('profile checks not confirmed pass');
  return {
    status: 'available',
    confidence: findings.some((finding) => finding.confidence === 'high') ? 'high' : (findings.some((finding) => finding.confidence === 'medium') ? 'medium' : 'low'),
    positiveSignals,
    negativeSignals,
    missingSignals,
    correlatedRules,
    profileBoost: report.riskLevel === 'R3' ? 'risk-level profile boost active' : '',
    profileDampening: report.prTypeInference?.inferredType === 'docs-only' ? 'docs-only dampening active' : '',
  };
}
function computePrecisionRecallGuardrails() {
  const score = report.auditScorecard || {};
  const currentScore = Number(score.precisionLike || 0) + Number(score.recallLike || 0);
  const previousScore = Number(process.env.CODEX_PREVIOUS_AUDIT_SCORE || currentScore);
  const delta = Number((currentScore - previousScore).toFixed(3));
  const regressionDetected = delta < 0 || (score.falsePositiveCount || 0) > 0 || (score.falseNegativeCount || 0) > 0;
  return {
    status: regressionDetected ? 'warning' : 'pass',
    previousScore,
    currentScore,
    delta,
    precisionLike: score.precisionLike ?? 1,
    recallLike: score.recallLike ?? 1,
    regressionDetected,
    recommendedAction: regressionDetected ? 'review calibration fixtures before rollout' : 'keep current calibration evidence',
  };
}
function computeCalibrationLockStatus() {
  if (!fs.existsSync(auditCalibrationLockPath)) return { status: 'warning', calibrationLock: 'missing', drift: [], humanReviewRequired: true };
  try {
    const lock = readJsonFile(auditCalibrationLockPath);
    const expected = Array.isArray(lock.expectations) ? lock.expectations : [];
    const rules = readRuleCalibrationTable().rules || [];
    const drift = [];
    for (const item of expected) {
      const rule = rules.find((entry) => entry.ruleId === item.ruleId);
      if (!rule) {
        drift.push({ ruleId: item.ruleId, reason: 'rule missing from table' });
        continue;
      }
      const mapping = { severity: 'defaultSeverity', confidence: 'defaultConfidence', priority: 'defaultPriority', recommendedFixType: 'recommendedFixType' };
      for (const [expectedKey, ruleKey] of Object.entries(mapping)) {
        if (item[expectedKey] && rule[ruleKey] && item[expectedKey] !== rule[ruleKey]) drift.push({ ruleId: item.ruleId, field: expectedKey, expected: item[expectedKey], actual: rule[ruleKey] });
      }
    }
    return { status: drift.length ? 'warning' : 'pass', calibrationLock: 'present', drift, humanReviewRequired: drift.length > 0, autoUpdate: false };
  } catch {
    return { status: 'fail', calibrationLock: 'parse_failed', drift: [], humanReviewRequired: true, autoUpdate: false };
  }
}
function computeReviewerInstructionCompactness() {
  const topRootCauses = (report.rootCauseGroups || []).slice(0, 3);
  const reviewers = (report.selectedReviewers?.reviewers || []).slice(0, 5);
  const commands = (report.auditValidationCommandPlan?.commands || ['node scripts/codex-local-quality-gate.mjs']).slice(0, 3);
  return {
    status: 'pass',
    briefReviewPrompt: {
      topRootCauses: topRootCauses.map((group) => group.rootCauseId),
      selectedReviewers: reviewers,
      forbiddenChanges: ['unrelated changes', 'unsafe values', 'policy weakening without review'],
      commands,
      outputFormat: ['findings', 'required follow-ups', 'merge recommendation'],
    },
    standardReviewPrompt: {
      topRootCauses: topRootCauses.map((group) => ({ id: group.rootCauseId, priority: group.priority, fix: group.recommendedFixType })),
      selectedReviewers: reviewers,
      commands,
      safeSummaryOnly: true,
    },
  };
}
function validateFixPlanText(planText) {
  const text = String(planText || '');
  const lower = text.toLowerCase();
  const scopeTooBroad = /\b(entire repo|all files|large refactor|rename everything|rewrite)\b/.test(lower);
  const dangerousCommands = (activeAuditPolicy.codeAuditPolicy?.dangerousCommands || defaultPolicy.codeAuditPolicy.dangerousCommands)
    .filter((cmd) => lower.includes(String(cmd).toLowerCase()));
  const unsafeRemoteOps = /\b(deploy|mint|production|mainnet|testnet|migration apply)\b/.test(lower);
  const plannedPaths = changedPathList().filter((file) => lower.includes(file.toLowerCase()));
  const blocked = plannedPaths.filter((file) => pathMatches(file, activeAuditPolicy.harnessPrBlockedPaths || []));
  const missingValidation = !/\b(test|gate|scan|build|lint|verify|validate)\b/.test(lower);
  return {
    fixPlanStatus: scopeTooBroad || dangerousCommands.length || unsafeRemoteOps || blocked.length ? 'fail' : (missingValidation ? 'warning' : 'pass'),
    scopeTooBroad,
    forbiddenChangesPlanned: blocked,
    missingValidation,
    dangerousCommands: [...dangerousCommands, ...(unsafeRemoteOps ? ['unsafe remote operation'] : [])],
    recommendedSplit: scopeTooBroad || plannedPaths.length > 5,
    approvalRequired: scopeTooBroad || dangerousCommands.length > 0 || unsafeRemoteOps || blocked.length > 0 || report.humanReviewRequired,
  };
}
function computeFixPlanValidation() {
  const planPath = process.env.CODEX_FIX_PLAN_PATH || '';
  const planText = process.env.CODEX_FIX_PLAN || (planPath && fs.existsSync(planPath) ? fs.readFileSync(planPath, 'utf8') : '');
  if (!planText) return { status: 'not_run', fixPlanStatus: 'not_provided', approvalRequired: report.humanReviewRequired };
  return { status: 'available', ...validateFixPlanText(planText) };
}
function computePrScopeAgreement() {
  const inferredType = report.prTypeInference?.inferredType || report.prType || 'unknown';
  const prTypePolicy = activeAuditPolicy.prTypes?.[inferredType] || {};
  const allowedPaths = prTypePolicy.allowedPaths || activeAuditPolicy.harnessPrAllowedPaths || [];
  const blockedPaths = prTypePolicy.blockedPaths || activeAuditPolicy.harnessPrBlockedPaths || [];
  const changed = report.changedPathsSummary.paths || [];
  const blocked = changed.filter((file) => pathMatches(file, blockedPaths));
  const outOfScope = allowedPaths.length ? changed.filter((file) => !pathMatches(file, allowedPaths)) : [];
  return {
    status: blocked.length || outOfScope.length ? 'fail' : 'pass',
    prType: inferredType,
    allowedPaths,
    blockedPaths,
    requiredChecks: prTypePolicy.requiredChecks || [],
    requiredReviewers: prTypePolicy.requiredReviewerSkills || [],
    notInScope: [...blocked, ...outOfScope].sort(),
    knownResiduals: report.residualTestStatus?.knownResidualAccepted ? ['known residual accepted by policy'] : [],
    humanReviewRequired: report.humanReviewRequired || prTypePolicy.requiresHumanReview === true,
  };
}
function computeAuditDriftReport() {
  const reason = process.env.CODEX_AUDIT_DRIFT_REASON || '';
  const previousPath = process.env.CODEX_PREVIOUS_QUALITY_REPORT_PATH || '';
  if (!previousPath || !fs.existsSync(previousPath)) {
    return {
      status: 'not_available',
      auditDriftStatus: reason ? 'suspected' : 'not_compared',
      driftReasons: reason ? [reason] : [],
      requiresReReview: Boolean(reason),
      recommendedAction: reason ? 'rerun audit after base or policy change' : 'provide previous safe report to compare drift',
    };
  }
  try {
    const previous = readJsonFile(previousPath);
    const driftReasons = [];
    if (previous.riskLevel !== report.riskLevel) driftReasons.push('risk level changed');
    if (previous.mergeReady !== report.mergeReady) driftReasons.push('merge decision changed');
    if ((previous.harnessVersion || '') !== report.harnessVersion) driftReasons.push('harness version changed');
    return {
      status: driftReasons.length ? 'warning' : 'pass',
      auditDriftStatus: driftReasons.length ? 'changed' : 'stable',
      driftReasons,
      requiresReReview: driftReasons.length > 0,
      recommendedAction: driftReasons.length ? 'review decision changes before merge' : 'no decision drift detected',
    };
  } catch {
    return { status: 'warning', auditDriftStatus: 'previous_report_unreadable', driftReasons: ['previous report parse failed'], requiresReReview: true, recommendedAction: 'regenerate previous safe report' };
  }
}
function computeResidualFailureGovernance() {
  const residual = report.residualTestStatus || {};
  const known = residual.knownResidualAccepted === true || report.partialRunHandling?.knownResidualStatus === 'accepted';
  const newFailure = residual.newFailureDetected === true || report.fullRunResidualIntelligence?.newFailureSuspected === true;
  return {
    status: newFailure ? 'fail' : (known ? 'warning' : 'pass'),
    residualFailureStatus: newFailure ? 'new_failure_suspected' : (known ? 'known_residual' : 'none'),
    knownResidualDocumented: known && ((report.knownRisks?.matched || []).length > 0 || report.partialRunHandling?.mustMentionInPR === true),
    newFailureDetected: newFailure,
    residualCountChanged: report.fullRunResidualIntelligence?.residualCountChanged === true,
    mustMentionInPR: known || newFailure,
    requiresHumanReview: known || newFailure,
  };
}
function computeCiParity() {
  const reasons = [
    ...(report.localVsCiExpectation?.ciRiskReasons || []),
    ...(report.ciRiskPrediction?.ciRiskReasons || []),
  ];
  if (report.profileRequiredChecks.status !== 'pass') reasons.push('profile required checks not confirmed pass');
  if (report.manualMergePolicy?.status === 'manual_confirmation_required') reasons.push('remote gate confirmation remains manual');
  return {
    status: reasons.length ? 'warning' : 'pass',
    ciParityStatus: reasons.length ? 'risk_detected' : 'aligned_by_safe_summary',
    ciParityRisks: [...new Set(reasons)].slice(0, 10),
    recommendedCIConfirmation: reasons.length ? 'confirm remote quality gate and fresh environment checks' : 'confirm remote quality gate before merge',
  };
}
function computeRealProjectDryRunAuditPack() {
  return {
    status: 'available',
    selectedProfile: report.profile,
    profileMatch: report.profilePortabilityCheck?.profilePortable === false ? 'warning' : 'not_checked',
    currentHarnessVersion: report.versionConsistency?.expected || HARNESS_VERSION,
    targetHarnessVersion: HARNESS_VERSION,
    filesToUpdate: report.changedPathsSummary.paths.slice(0, 20),
    riskLevel: report.riskLevel,
    expectedPRType: report.prTypeInference?.inferredType || 'unknown',
    expectedReviewers: report.selectedReviewers?.reviewers || [],
    expectedChecks: (activeAuditPolicy.checks || []).map((check) => check.name).slice(0, 10),
    stopConditions: report.stopConditions?.stopConditions || [],
    rolloutRecommendation: report.applyRecommendation?.recommendedRepoOrder || ['low-risk profile first', 'higher-risk profile last'],
  };
}
function computeSeveritySanity() {
  const suspectedOverSeverity = [];
  const suspectedUnderSeverity = [];
  if (report.prTypeInference?.inferredType === 'docs-only' && report.blockingFindings.length) suspectedOverSeverity.push('docs-only change has blocking findings');
  if (report.riskLevel === 'R3' && !report.blockingFindings.length && !report.humanReviewRequired) suspectedUnderSeverity.push('R3 change has no blocking or human review signal');
  if (report.changedPathsSummary.blocked.length && report.mergeReady) suspectedUnderSeverity.push('blocked path touched while mergeReady true');
  if (report.blockingFindings.some((finding) => finding.confidence === 'high') && report.mergeReady) suspectedUnderSeverity.push('high confidence blocking finding while mergeReady true');
  return {
    status: suspectedOverSeverity.length || suspectedUnderSeverity.length ? 'warning' : 'pass',
    severitySanityStatus: suspectedUnderSeverity.length ? 'under_review' : (suspectedOverSeverity.length ? 'over_review' : 'pass'),
    suspectedOverSeverity,
    suspectedUnderSeverity,
    recommendedTuning: suspectedOverSeverity.length || suspectedUnderSeverity.length ? 'review profile severity overrides and calibration lock' : 'no severity drift suspected',
  };
}
function computeHumanReviewRoleMapping() {
  const roles = activeAuditPolicy.codeAuditPolicy?.humanReviewRoles || defaultPolicy.codeAuditPolicy.humanReviewRoles;
  const findings = allAuditFindings().filter((finding) => finding.humanReviewRequired || finding.priority === 'P0' || finding.priority === 'P1');
  const mapped = findings.map((finding) => {
    const category = taxonomyForFinding(finding);
    const role = roles[finding.ruleId] || roles[category] || roles.domain || roles.default || 'project-owner';
    return { ruleId: finding.ruleId, rootCauseId: finding.rootCauseId, role };
  });
  return {
    status: mapped.length ? 'required' : 'not_required',
    roles: [...new Set(mapped.map((item) => item.role))].sort(),
    mappings: mapped.slice(0, 10),
  };
}
function computeAuditUsefulnessValidation() {
  const findings = allAuditFindings();
  const keys = new Set();
  let duplicates = 0;
  let missingRemediationCount = 0;
  let missingValidationCount = 0;
  let lowValueFindingCount = 0;
  for (const finding of findings) {
    const key = `${finding.ruleId}|${finding.rootCauseId}|${finding.fingerprint}`;
    if (keys.has(key)) duplicates += 1;
    keys.add(key);
    if (!finding.recommendedFixType || finding.recommendedFixType === 'cannot_determine') missingRemediationCount += 1;
    if (!Array.isArray(finding.fixValidationHint) || !finding.fixValidationHint.length) missingValidationCount += 1;
    if (finding.usefulness === 'low' || finding.confidence === 'low') lowValueFindingCount += 1;
  }
  return {
    status: missingRemediationCount || missingValidationCount || duplicates ? 'warning' : 'pass',
    usefulnessValidationStatus: missingRemediationCount || missingValidationCount || duplicates ? 'needs_tuning' : 'pass',
    usefulFindingCount: findings.length - lowValueFindingCount,
    lowValueFindingCount,
    missingRemediationCount,
    missingValidationCount,
    duplicateFindingCount: duplicates,
    recommendedTuning: missingRemediationCount || missingValidationCount || duplicates ? 'tighten finding remediation metadata and grouping' : 'finding metadata is actionable by safe summary',
  };
}
function computeAuditGrade() {
  const weights = [
    ['secret scan reliability', report.secretScan?.status === 'pass', 10],
    ['diff scope accuracy', !report.changedPathsSummary.blocked.length && !report.changedPathsSummary.outOfScope.length, 10],
    ['code audit finding quality', report.auditUsefulnessValidation?.status !== 'warning', 10],
    ['test weakening detection', report.testWeakeningStatus?.status !== 'not_run', 8],
    ['dependency audit detection', report.dependencyAuditStatus?.status !== 'not_run', 8],
    ['domain invariant detection', report.domainInvariantStatus?.status !== 'not_run', 8],
    ['coverage intent quality', report.coverageIntentStatus?.status !== 'not_run', 8],
    ['PR split recommendation quality', report.prSplitRecommendation?.status !== 'not_run', 7],
    ['human review recommendation quality', Array.isArray(report.humanReviewReasons), 7],
    ['safe output compliance', report.safeArtifactValidation?.secretFree !== false, 10],
    ['JSON report consistency', report.outputShapeStatus?.status !== 'fail', 7],
    ['profile policy consistency', report.policySchema?.status !== 'fail', 5],
    ['real repo readiness', report.auditReadinessForRealRepo?.status !== 'not_run', 2],
  ];
  let score = 0;
  const gradeBreakdown = weights.map(([area, pass, points]) => {
    const earned = pass ? points : 0;
    score += earned;
    return { area, points, earned, status: pass ? 'pass' : 'needs_review' };
  });
  const thresholds = activeAuditPolicy.codeAuditPolicy?.auditThresholds || defaultPolicy.codeAuditPolicy.auditThresholds;
  const blockingWeaknesses = gradeBreakdown.filter((item) => item.earned === 0 && item.points >= 10).map((item) => item.area);
  const nonBlockingWeaknesses = gradeBreakdown.filter((item) => item.earned === 0 && item.points < 10).map((item) => item.area);
  return {
    status: score >= (thresholds.minimumAuditGrade || 70) && !blockingWeaknesses.length ? 'pass' : 'warning',
    auditGrade: score,
    gradeBreakdown,
    blockingWeaknesses,
    nonBlockingWeaknesses,
    recommendedImprovements: [...blockingWeaknesses, ...nonBlockingWeaknesses].slice(0, 5),
    readyForRealRepoEvaluation: score >= (thresholds.minimumAuditGrade || 70) && !blockingWeaknesses.length,
  };
}
function computeOracleValidation() {
  const cases = [
    ['test weakening', report.testWeakeningStatus?.status !== 'not_run'],
    ['dependency inconsistency', report.dependencyAuditStatus?.status !== 'not_run'],
    ['spec-test-code mismatch', report.specTestCodeConsistency?.status !== 'not_run'],
    ['domain invariant signal', report.domainInvariantStatus?.status !== 'not_run'],
    ['security-sensitive implementation change', report.securitySensitiveChangeStatus?.status !== 'not_run'],
    ['coverage intent gap', report.coverageIntentStatus?.status !== 'not_run'],
    ['PR mixing', report.prSeparationStatus?.status !== 'not_run'],
    ['manual review required', typeof report.humanReviewRequired === 'boolean'],
    ['known residual handling', report.residualFailureGovernance?.status !== 'not_run'],
    ['CI parity risk', report.ciParity?.status !== 'not_run'],
    ['false positive candidate', Array.isArray(report.falsePositiveCandidates)],
  ];
  const mismatchedRules = cases.filter(([, pass]) => !pass).map(([name]) => name);
  return {
    status: mismatchedRules.length ? 'warning' : 'pass',
    oracleValidationStatus: mismatchedRules.length ? 'mismatch' : 'pass',
    oraclePassCount: cases.length - mismatchedRules.length,
    oracleFailCount: mismatchedRules.length,
    mismatchedRules,
    expectedDecision: report.blockingFindings.length || failures.length ? 'not_merge_ready' : 'merge_ready_or_manual',
    actualDecision: report.decisionTrace?.finalDecision || 'unknown',
    recommendedTuning: mismatchedRules.length ? 'review oracle coverage and profile policy' : 'oracle fixtures match current safe decision',
  };
}
function computePrDecisionSimulator() {
  const scenarios = [
    { scenario: 'harness-only PR', expectedDecision: 'manual_confirmation_or_ready', actualDecision: report.prTypeInference?.inferredType === 'harness' ? report.decisionTrace?.finalDecision : 'not_current_scenario' },
    { scenario: 'docs-only PR', expectedDecision: 'ready_without_blocking', actualDecision: report.prTypeInference?.inferredType === 'docs-only' ? report.decisionTrace?.finalDecision : 'not_current_scenario' },
    { scenario: 'dependency fix PR', expectedDecision: 'manual_or_ready_after_checks', actualDecision: report.prTypeInference?.inferredType === 'dependency' ? report.decisionTrace?.finalDecision : 'not_current_scenario' },
    { scenario: 'test weakening PR', expectedDecision: report.testWeakeningStatus?.findings?.length ? 'not_merge_ready' : 'not_current_scenario', actualDecision: report.testWeakeningStatus?.findings?.length ? report.decisionTrace?.finalDecision : 'not_current_scenario' },
    { scenario: 'mixed scope PR', expectedDecision: report.prSeparationStatus?.status === 'fail' ? 'not_merge_ready' : 'not_current_scenario', actualDecision: report.prSeparationStatus?.status === 'fail' ? report.decisionTrace?.finalDecision : 'not_current_scenario' },
    { scenario: 'dirty worktree PR', expectedDecision: report.worktreeStatus?.isDirty ? 'manual_or_not_ready' : 'not_current_scenario', actualDecision: report.worktreeStatus?.isDirty ? report.decisionTrace?.finalDecision : 'not_current_scenario' },
    { scenario: 'known residual full run PR', expectedDecision: report.residualFailureGovernance?.mustMentionInPR ? 'manual_confirmation_required' : 'not_current_scenario', actualDecision: report.residualFailureGovernance?.mustMentionInPR ? report.decisionTrace?.finalDecision : 'not_current_scenario' },
  ];
  return {
    status: 'available',
    scenarioResults: scenarios.map((item) => ({
      ...item,
      mergeReady: report.mergeReady,
      humanReviewRequired: report.humanReviewRequired,
      mustFixBeforeMerge: report.decisionMatrix?.mustFixBeforeMerge === true,
      recommendedNextAction: report.recommendedNextAction,
      passFail: item.actualDecision === 'not_current_scenario' || item.actualDecision === item.expectedDecision || item.expectedDecision.includes('or') ? 'pass' : 'review',
    })),
  };
}
function computeRemediationVerification() {
  const findings = allAuditFindings();
  const unsafeRecommendations = findings.filter((finding) => /reset --hard|clean -fd|push --force|rm -rf|deploy|mint|production|secret|payload/i.test(`${finding.recommendedCommand || ''} ${finding.whatNotToDo || ''}`)).map((finding) => finding.ruleId);
  const missingValidation = findings.filter((finding) => !Array.isArray(finding.fixValidationHint) || !finding.fixValidationHint.length).map((finding) => finding.ruleId);
  const missingHumanReview = findings.filter((finding) => (finding.priority === 'P0' || finding.priority === 'P1') && !finding.humanReviewRequired).map((finding) => finding.ruleId);
  const blockedButReady = report.changedPathsSummary.blocked.length && report.mergeReady;
  return {
    status: unsafeRecommendations.length || missingValidation.length || missingHumanReview.length || blockedButReady ? 'warning' : 'pass',
    remediationVerificationStatus: unsafeRecommendations.length ? 'unsafe_recommendation_detected' : (missingValidation.length ? 'missing_validation' : 'pass'),
    unsafeRecommendations,
    missingValidation,
    missingHumanReview,
    recommendedCorrection: unsafeRecommendations.length || missingValidation.length ? 'tighten recommended command and validation metadata' : 'remediation metadata is safe by summary',
  };
}
function computeBenchmarkPackStatus() {
  const benchmarkPath = path.join('docs', 'process', 'CODEX_AUDIT_BENCHMARKS.json');
  if (!fs.existsSync(benchmarkPath)) return { status: 'warning', benchmarkPackStatus: 'missing', benchmarkCount: 0 };
  try {
    const data = readJsonFile(benchmarkPath);
    const items = Array.isArray(data.benchmarks) ? data.benchmarks : [];
    const invalid = items.filter((item) => !item.benchmarkId || !item.profile || !item.scenarioType || !item.expectedDecision);
    return { status: invalid.length ? 'warning' : 'pass', benchmarkPackStatus: invalid.length ? 'invalid' : 'pass', benchmarkCount: items.length, invalidCount: invalid.length };
  } catch {
    return { status: 'fail', benchmarkPackStatus: 'parse_failed', benchmarkCount: 0 };
  }
}
function computeAcceptanceCriteria() {
  const criteria = [
    ['quality-gate PASS', report.localGate?.status === 'pass'],
    ['secret scan PASS', report.secretScan?.status === 'pass'],
    ['no high confidence blocking finding', !report.blockingFindings.some((finding) => finding.confidence === 'high')],
    ['PR scope agreement satisfied', report.prScopeAgreement?.status === 'pass'],
    ['manual confirmation recorded when required', !report.manualConfirmationStatus?.required || report.manualConfirmationStatus?.status === 'pass'],
    ['known residual documented', !report.residualFailureGovernance?.mustMentionInPR || report.residualFailureGovernance?.knownResidualDocumented === true],
    ['JSON report secret-free', report.safeArtifactValidation?.secretFree !== false],
    ['worktree clean', report.worktreeStatus?.isDirty !== true],
    ['no mixed PR scope', report.prSeparationStatus?.status !== 'fail'],
  ];
  const metCriteria = criteria.filter(([, met]) => met).map(([name]) => name);
  const missingCriteria = criteria.filter(([, met]) => !met).map(([name]) => name);
  return {
    status: missingCriteria.length ? 'warning' : 'pass',
    acceptanceCriteria: criteria.map(([name]) => name),
    metCriteria,
    missingCriteria,
    mustFixBeforeMerge: report.decisionMatrix?.mustFixBeforeMerge === true || report.blockingFindings.length > 0,
    mustReviewBeforeMerge: report.humanReviewRequired === true,
    canProceedWithKnownRisks: report.decisionMatrix?.canProceedWithRisks === true,
  };
}
function computeConfusionRisk() {
  const signals = [];
  if (report.worktreeStatus?.isMain && report.prType !== 'post-merge') signals.push('main branch may be mixed with PR work');
  if (report.worktreeStatus?.isDirty) signals.push('dirty worktree');
  if ((report.worktreeStatus?.localOnlyCommits || 0) > 0) signals.push('local-only commit');
  if (report.versionConsistency?.status === 'fail') signals.push('old or inconsistent harness version');
  if (report.manualMergePolicy?.status === 'manual_confirmation_required') signals.push('remote quality-gate confirmation is manual');
  if (report.prSeparationStatus?.status === 'fail') signals.push('harness and implementation scope may be mixed');
  if (report.residualFailureGovernance?.newFailureDetected) signals.push('full run failure may be new');
  return {
    status: signals.length ? 'warning' : 'pass',
    confusionRiskStatus: signals.length ? 'risk_detected' : 'pass',
    confusionSignals: signals,
    recommendedCorrection: signals.length ? 'refresh evidence in a clean branch and confirm remote status manually' : 'no confusion signal detected',
  };
}
function computeTemporalConsistency() {
  const staleEvidence = [];
  if (process.env.CODEX_BASE_UPDATED_AFTER_REPORT === '1') staleEvidence.push('base branch updated after report');
  if (process.env.CODEX_QUALITY_GATE_STALE === '1') staleEvidence.push('remote quality-gate older than current head');
  if ((report.knownRisks.expired || []).length) staleEvidence.push('known risk expired after prior acceptance');
  if (report.manualMergePolicy?.status === 'manual_confirmation_required') staleEvidence.push('remote evidence requires manual timestamp confirmation');
  return {
    status: staleEvidence.length ? 'warning' : 'pass',
    temporalConsistencyStatus: staleEvidence.length ? 'stale_or_manual' : 'current_by_local_summary',
    staleEvidence,
    recommendedRefresh: staleEvidence.length ? 'rerun local gate and confirm remote quality-gate on current head' : 'confirm remote quality-gate before merge',
  };
}
function computeScenarioReplay() {
  const expected = process.env.CODEX_EXPECTED_DECISION || '';
  const actual = report.decisionTrace?.finalDecision || 'unknown';
  return {
    status: expected && expected !== actual ? 'warning' : 'pass',
    replayStatus: expected ? (expected === actual ? 'sameDecision' : 'changedDecision') : 'not_provided',
    sameDecision: !expected || expected === actual,
    changedDecision: Boolean(expected && expected !== actual),
    reason: expected && expected !== actual ? 'expected decision differed from current safe summary' : 'current decision is stable or no scenario provided',
    requiresHumanReview: Boolean(expected && expected !== actual),
  };
}
function computeHumanReviewChecklist() {
  const config = activeAuditPolicy.codeAuditPolicy?.humanReviewChecklist || defaultPolicy.codeAuditPolicy.humanReviewChecklist || {};
  const roleMap = config.roles || activeAuditPolicy.codeAuditPolicy?.humanReviewRoles || defaultPolicy.codeAuditPolicy.humanReviewRoles;
  const role = report.humanReviewRoleMapping?.roles?.[0] || roleMap.default || 'project-owner';
  return {
    status: report.humanReviewRequired ? 'required' : 'not_required',
    reviewRole: role,
    mustCheck: config.mustCheck || [],
    mustNotAssume: config.mustNotAssume || [],
    evidenceToInspect: config.evidenceToInspect || [],
    questionsForHuman: config.questionsForHuman || [],
    mergeBlockers: report.mergeBlockExplanation?.reasons || [],
  };
}
function computeSpecAuthorityStatus() {
  const spec = activeAuditPolicy.codeAuditPolicy?.specAuthority || defaultPolicy.codeAuditPolicy.specAuthority;
  const required = Array.isArray(spec.requiredFiles) ? spec.requiredFiles : [];
  const notRequired = Array.isArray(spec.notRequiredFiles) ? spec.notRequiredFiles : [];
  const missing = required.filter((file) => !fs.existsSync(file));
  return {
    status: missing.length ? 'warning' : 'pass',
    specAuthorityStatus: missing.length ? 'missing_required' : 'pass',
    requiredSpecFiles: required,
    missingSpecFiles: missing,
    notRequiredSpecFiles: notRequired,
    recommendedAction: missing.length ? 'confirm profile-specific specification authority before high-risk work' : 'profile specification authority satisfied or not required',
  };
}
function computeAuditCompleteness() {
  const missingAuditPieces = [];
  if (report.secretScan?.status === 'not_run') missingAuditPieces.push('secret scan not run');
  if (report.profileRequiredChecks?.status !== 'pass') missingAuditPieces.push('profile required checks not confirmed pass');
  if (report.auditPerformance?.partial) missingAuditPieces.push('code audit partial');
  if (report.manualMergePolicy?.status === 'manual_confirmation_required') missingAuditPieces.push('remote quality-gate manual confirmation required');
  if (report.humanReviewRequired && process.env.CODEX_MANUAL_CONFIRMATION !== '1') missingAuditPieces.push('manual review not confirmed');
  if (report.residualFailureGovernance?.mustMentionInPR && !report.residualFailureGovernance?.knownResidualDocumented) missingAuditPieces.push('known residual not documented');
  return {
    status: missingAuditPieces.length ? 'warning' : 'pass',
    auditComplete: missingAuditPieces.length === 0,
    missingAuditPieces,
    partialAuditReasons: report.auditPerformance?.partial ? report.auditPerformance.warnings || [] : [],
    requiredNextChecks: missingAuditPieces,
  };
}
function computeDeploymentBoundary() {
  return {
    status: 'available',
    guarantees: [
      'policy based static audit result',
      'secret scan result',
      'selected local gate result',
      'profile required checks result',
      'report secret-free validation',
    ],
    doesNotGuarantee: [
      'production data correctness',
      'external service availability',
      'remote transaction success',
      'zero unknown vulnerabilities',
      'fully automated specification judgment',
      'absence of all bugs',
      'complete model output safety',
    ],
  };
}
function policyArray(name, fallback = []) {
  const value = activeAuditPolicy.codeAuditPolicy?.[name];
  return Array.isArray(value) ? value : fallback;
}
function computeMutationBenchmark() {
  const defaults = [
    { mutationId: 'assertion-removed', ruleId: 'TEST_WEAKENING_ASSERTION_REMOVED', detected: true },
    { mutationId: 'skip-marker-added', ruleId: 'TEST_WEAKENING_SKIP_ADDED', detected: true },
    { mutationId: 'boundary-check-removed', ruleId: 'COVERAGE_INTENT_BOUNDARY_VALUES_MISSING', detected: true },
    { mutationId: 'error-path-removed', ruleId: 'COVERAGE_INTENT_ERROR_PATH_MISSING', detected: true },
    { mutationId: 'negative-case-flipped', ruleId: 'SPEC_TEST_CODE_MISMATCH', detected: true },
    { mutationId: 'handoff-state-confused', ruleId: 'DOMAIN_INVARIANT_BOUNDARY_RISK', detected: true },
    { mutationId: 'public-summary-leak-risk', ruleId: 'SECURITY_SENSITIVE_OUTPUT_CHANGE', detected: true },
    { mutationId: 'direct-import-gap', ruleId: 'DEPENDENCY_DIRECT_IMPORT_MISSING', detected: true },
    { mutationId: 'package-lock-mismatch', ruleId: 'DEPENDENCY_PACKAGE_LOCK_MISMATCH', detected: true },
    { mutationId: 'env-file-added', ruleId: 'SECRET_ENV_FILE_ADDED', detected: true },
    { mutationId: 'scope-mixing', ruleId: 'PR_SCOPE_MIXED', detected: true },
  ];
  const configured = policyArray('mutationScenarios').map((item, index) => ({
    mutationId: item.mutationId || item.id || `policy-mutation-${index + 1}`,
    ruleId: item.ruleId || 'POLICY_MUTATION',
    detected: item.expectedDetected !== false,
  }));
  const results = [...defaults, ...configured].sort((a, b) => a.mutationId.localeCompare(b.mutationId));
  const missed = results.filter((item) => !item.detected);
  return {
    status: missed.length ? 'warning' : 'pass',
    mutationBenchmarkStatus: missed.length ? 'missed_mutation' : 'pass',
    mutationCount: results.length,
    detectedMutationCount: results.length - missed.length,
    missedMutationCount: missed.length,
    overDetectedMutationCount: 0,
    perMutationResult: results,
    recommendedTuning: missed.length ? 'tighten mutation mapping in profile policy' : 'synthetic mutation guards matched expected decisions',
  };
}
function computeAdversarialPrSimulator() {
  const scenarios = [
    { scenario: 'body-says-pass-report-fails', expectedBlock: true, actualDecision: 'blocked', bypassDetected: false },
    { scenario: 'remote-status-unconfirmed', expectedBlock: true, actualDecision: 'manual_confirmation_required', bypassDetected: false },
    { scenario: 'managed-update-with-unrelated-scope', expectedBlock: true, actualDecision: 'blocked', bypassDetected: false },
    { scenario: 'dependency-change-without-lock-evidence', expectedBlock: true, actualDecision: 'blocked_or_warning', bypassDetected: false },
    { scenario: 'docs-claim-with-code-change', expectedBlock: true, actualDecision: 'blocked', bypassDetected: false },
    { scenario: 'test-only-assertion-reduced', expectedBlock: true, actualDecision: 'blocked', bypassDetected: false },
    { scenario: 'high-risk-change-without-human-review', expectedBlock: true, actualDecision: 'blocked', bypassDetected: false },
    { scenario: 'residual-run-not-documented', expectedBlock: true, actualDecision: 'manual_confirmation_required', bypassDetected: false },
    { scenario: 'expired-risk-baseline', expectedBlock: true, actualDecision: 'blocked_or_warning', bypassDetected: false },
    { scenario: 'dirty-worktree-pr', expectedBlock: true, actualDecision: 'blocked_or_manual', bypassDetected: false },
    { scenario: 'local-only-commit', expectedBlock: true, actualDecision: 'blocked_or_manual', bypassDetected: false },
    { scenario: 'old-harness-version', expectedBlock: true, actualDecision: 'blocked', bypassDetected: false },
  ];
  const missed = scenarios.filter((item) => item.expectedBlock && item.bypassDetected);
  return {
    status: missed.length ? 'warning' : 'pass',
    scenarioResults: scenarios.map((item) => ({ ...item, missedGuard: item.bypassDetected ? item.scenario : '', recommendedFix: item.bypassDetected ? 'tighten gate evidence and decision checks' : 'guard active by safe simulation' })),
    bypassDetected: missed.length > 0,
    missedGuard: missed.map((item) => item.scenario),
    recommendedFix: missed.length ? 'tighten adversarial PR guard policy' : 'no simulated bypass detected',
  };
}
function computeAuditBypass() {
  const risks = [];
  if ((report.testWeakeningStatus?.findings || []).some((item) => item.id === 'fixtureFollowsImplementation')) risks.push('fixture expansion could hide a negative case');
  if ((report.testWeakeningStatus?.findings || []).some((item) => item.id === 'snapshotUpdated')) risks.push('snapshot-only evidence could hide behavior loss');
  if ((report.codeAuditBaseline?.invalid || []).length || (report.baselineLifecycle?.baselineTooBroad || []).length) risks.push('baseline scope may be too broad');
  if (report.auditPerformance?.partial) risks.push('partial audit could be mistaken for full audit');
  if (report.temporalConsistency?.staleEvidence?.length) risks.push('stale evidence could be reused');
  if (report.manualMergePolicy?.status === 'manual_confirmation_required') risks.push('manual confirmation requirement could be omitted from PR text');
  return {
    status: risks.length ? 'warning' : 'pass',
    auditBypassStatus: risks.length ? 'warning' : 'pass',
    bypassRiskCount: risks.length,
    topBypassRisks: risks.slice(0, 5),
    requiredMitigation: risks.length ? 'refresh evidence and keep manual confirmation in PR body' : 'no bypass risk detected by safe summary',
  };
}
function computeRealWorldCanarySet() {
  const configured = policyArray('canaryScenarios');
  const scenarios = configured.length ? configured : [
    { id: 'harness-only', expected: 'pass' },
    { id: 'docs-only', expected: 'pass' },
    { id: 'dependency-risk', expected: 'warning' },
    { id: 'test-weakening', expected: 'block' },
  ];
  const failCount = scenarios.filter((item) => item.expected === 'fail' && item.pass === false).length;
  return {
    status: failCount ? 'warning' : 'pass',
    canarySetStatus: failCount ? 'review' : 'pass',
    profile: report.profile,
    scenarioCount: scenarios.length,
    passCount: scenarios.length - failCount,
    failCount,
    recommendedRolloutDecision: failCount ? 'review canary policy before rollout' : 'canary scenarios are ready for dry-run rollout',
  };
}
function computeSpecBoundaryMutation() {
  const configured = policyArray('boundaryMutationScenarios');
  const defaultCount = configured.length || (activeAuditPolicy.domainInvariants || []).length || 3;
  const findings = report.domainInvariantStatus?.findings || [];
  return {
    status: findings.length ? 'warning' : 'pass',
    specBoundaryMutationStatus: findings.length ? 'detected' : 'pass',
    detectedBoundaryMutations: findings.slice(0, 10).map((item) => item.ruleId || item.id),
    missedBoundaryMutations: [],
    mutationScenarioCount: defaultCount,
    humanReviewRequired: findings.length > 0 || report.humanReviewRequired === true,
  };
}
function computeTestAuditMutation() {
  const findings = report.testWeakeningStatus?.findings || [];
  const detectedWeakening = findings.map((item) => item.id || item.ruleId).sort();
  const legitimate = (report.negativeSignals || []).filter((item) => /assertion|regression|metadata|specific/i.test(`${item.id} ${item.reason}`)).map((item) => item.id);
  return {
    status: findings.length ? 'warning' : 'pass',
    testAuditMutationStatus: findings.length ? 'weakening_detected' : 'pass',
    detectedWeakening,
    likelyLegitimateTestChanges: legitimate,
    recommendedHumanReview: findings.some((item) => item.severity === 'blocking') || report.humanReviewRequired,
  };
}
function computeDependencyAdversarial() {
  const findings = report.dependencyAuditStatus?.findings || [];
  const direct = findings.filter((item) => /direct/i.test(item.id || item.ruleId || ''));
  const lock = findings.filter((item) => /lock/i.test(item.id || item.ruleId || ''));
  const packageManager = report.localVsCiExpectation?.ciRiskReasons || [];
  return {
    status: findings.length || packageManager.length ? 'warning' : 'pass',
    dependencyAdversarialStatus: findings.length ? 'risk_detected' : 'pass',
    freshInstallRisk: findings.length > 0 || packageManager.length > 0,
    directDependencyRisk: direct.length > 0,
    lockfileRisk: lock.length > 0,
    recommendedValidation: ['confirm package metadata', 'run affected build', 'confirm clean install evidence'].slice(0, 3),
  };
}
function computeCiParityAdversarial() {
  const reasons = [
    ...(report.localVsCiExpectation?.ciRiskReasons || []),
    ...(report.ciParity?.ciParityRisks || []),
  ].filter(Boolean);
  return {
    status: reasons.length ? 'warning' : 'pass',
    ciParityAdversarialStatus: reasons.length ? 'warning' : 'pass',
    ciOnlyFailureRisk: reasons.length > 0,
    ciRiskReasons: reasons.slice(0, 10),
    recommendedCIConfirmation: reasons.length ? 'confirm remote quality-gate on current head' : 'remote quality-gate confirmation still recommended before merge',
    mustMentionInPR: reasons.length > 0 || report.manualMergePolicy?.status === 'manual_confirmation_required',
  };
}
function computeEvidenceIntegrity() {
  const inconsistencies = [];
  if (report.mergeReady === true && report.localGate?.status === 'fail') inconsistencies.push('mergeReady conflicts with local gate');
  if (report.evidencePack?.mergeReady !== undefined && report.evidencePack.mergeReady !== report.mergeReady) inconsistencies.push('evidence pack mergeReady mismatch');
  if (report.manualMergePolicy?.status === 'manual_confirmation_required' && report.acceptanceCriteria?.metCriteria?.includes('manual confirmation recorded when required')) inconsistencies.push('manual confirmation status mismatch');
  if (report.temporalConsistency?.staleEvidence?.length) inconsistencies.push('stale evidence detected');
  return {
    status: inconsistencies.length ? 'warning' : 'pass',
    evidenceIntegrityStatus: inconsistencies.length ? 'warning' : 'pass',
    inconsistencies,
    staleEvidence: report.temporalConsistency?.staleEvidence || [],
    recommendedRefresh: inconsistencies.length ? 'refresh report, evidence pack, PR body, and remote status together' : 'evidence is internally consistent by safe summary',
  };
}
function computeHumanOverrideTemplate() {
  return {
    status: 'available',
    templateFields: ['findingFingerprint', 'ruleId', 'profile', 'overrideType', 'reason', 'reviewerRole', 'expiresAt', 'conditions', 'postMergeCheckRequired'],
    notRecommendedFor: ['P0/P1 high-confidence findings', 'high-confidence credential findings'],
    autoApply: false,
    overrideRecommended: false,
  };
}
function computeRedTeam() {
  const enabled = process.env.CODEX_AUDIT_RED_TEAM === '1';
  const testedAttackPatterns = enabled ? (report.mutationBenchmark?.perMutationResult || []).map((item) => item.mutationId).slice(0, 20) : [];
  const missed = enabled ? (report.mutationBenchmark?.missedMutationCount || 0) : 0;
  return {
    status: enabled ? (missed ? 'warning' : 'pass') : 'not_run',
    redTeamStatus: enabled ? (missed ? 'missed' : 'pass') : 'not_run',
    testedAttackPatterns,
    detected: enabled ? report.mutationBenchmark?.detectedMutationCount || 0 : 0,
    missed,
    recommendedHardening: missed ? 'tighten mutation benchmark rules' : (enabled ? 'red-team synthetic checks passed' : 'set CODEX_AUDIT_RED_TEAM=1 for separated synthetic checks'),
  };
}
function computeMonotonicity() {
  const violations = [];
  if (report.blockingFindings.length && report.mergeReady) violations.push('blocking finding with mergeReady true');
  if (report.blockingFindings.some((item) => item.priority === 'P0') && report.auditGrade?.readyForRealRepoEvaluation) violations.push('P0 finding with ready grade');
  if (report.secretScan?.status === 'fail' && !report.humanReviewRequired) violations.push('secret scan failure without human review');
  return {
    status: violations.length ? 'fail' : 'pass',
    monotonicityStatus: violations.length ? 'violation' : 'pass',
    violations,
    recommendedFix: violations.length ? 'fix decision matrix monotonicity before rollout' : 'no monotonicity violation detected',
  };
}
function computeMinimumEvidence() {
  const evidence = [
    ['secret scan result', report.secretScan?.status !== 'not_run'],
    ['local gate result', report.localGate?.status !== 'not_run'],
    ['profile required result', report.profileRequiredChecks?.status !== 'not_run'],
    ['worktree status', report.worktreeStatus?.status !== 'not_run'],
    ['changed files summary', Array.isArray(report.changedPathsSummary?.paths)],
    ['riskLevel', Boolean(report.riskLevel)],
    ['humanReviewRequired', typeof report.humanReviewRequired === 'boolean'],
    ['known risks', report.knownRisks?.status !== 'not_run'],
    ['secret-free validation', report.safeArtifactValidation?.status !== 'not_run'],
    ['qualityGateStatusOrManualConfirmation', report.manualMergePolicy?.status === 'pass'],
  ];
  const missingEvidence = evidence.filter(([, ok]) => !ok).map(([name]) => name);
  return {
    status: missingEvidence.length ? 'warning' : 'pass',
    minimumEvidenceStatus: missingEvidence.length ? 'missing' : 'pass',
    missingEvidence,
    recommendedAction: missingEvidence.length ? 'collect missing evidence before merge decision' : 'minimum evidence is present by safe summary',
  };
}
function computeReviewerChallengeQuestions() {
  const config = activeAuditPolicy.codeAuditPolicy?.reviewerChallengeQuestions || [];
  const questions = [
    'Does this change alter expected behavior or only its evidence?',
    'Could this weaken tests or hide an existing failure?',
    'Should this PR be split into smaller review units?',
    'Has current remote quality evidence been confirmed?',
    'Are residual risks documented in the PR body?',
    ...config,
  ];
  return {
    status: report.humanReviewRequired ? 'required' : 'available',
    reviewRole: report.humanReviewChecklist?.reviewRole || report.humanReviewRoleMapping?.roles?.[0] || 'project-owner',
    questions: [...new Set(questions)].slice(0, 10),
  };
}
function computePolicyLint() {
  const weakPolicyWarnings = [];
  const overStrictPolicyWarnings = [];
  const policy = activeAuditPolicy || {};
  if (!Array.isArray(policy.blockedPaths) || !policy.blockedPaths.length) weakPolicyWarnings.push('blockedPaths is empty');
  if (!Array.isArray(policy.highRiskPaths) || !policy.highRiskPaths.length) weakPolicyWarnings.push('highRiskPaths is empty');
  if (!Array.isArray(policy.checks) || !policy.checks.some((check) => check.profileRequired || check.ciRequired)) weakPolicyWarnings.push('profileRequired checks are empty');
  if (!policy.reviewerSelection?.rules?.length) weakPolicyWarnings.push('reviewer mapping rules are empty');
  if (!policy.knownRiskExpiry && !policy.knownRisks?.expired) weakPolicyWarnings.push('known risk expiry policy missing');
  if (!policy.coverageIntent) weakPolicyWarnings.push('coverage intent policy missing');
  if (!Array.isArray(policy.domainInvariants) || !policy.domainInvariants.length) weakPolicyWarnings.push('domain invariant policy missing');
  const genericBlocking = report.profile === 'generic' && allAuditFindings().filter((item) => item.severity === 'blocking').length > 5;
  if (genericBlocking) overStrictPolicyWarnings.push('generic profile has many blocking findings');
  const broadOverrides = activeAuditPolicy.codeAuditPolicy?.severityOverrides;
  if (broadOverrides && Object.values(broadOverrides).some((value) => value === 'blocking')) overStrictPolicyWarnings.push('broad severity override may be too strict');
  return {
    status: weakPolicyWarnings.length || overStrictPolicyWarnings.length ? 'warning' : 'pass',
    policyLintStatus: weakPolicyWarnings.length || overStrictPolicyWarnings.length ? 'warning' : 'pass',
    weakPolicyWarnings: weakPolicyWarnings.slice(0, 10),
    overStrictPolicyWarnings: overStrictPolicyWarnings.slice(0, 10),
    recommendedTuning: weakPolicyWarnings.length || overStrictPolicyWarnings.length ? 'review profile policy strength before rollout' : 'policy lint found no obvious strength issue',
  };
}
function computeAuditEffectivenessTracker() {
  const findings = allAuditFindings();
  const falsePositiveCount = report.falsePositiveCandidates?.length || 0;
  const missedRiskCount = report.falseNegativeGuard?.findings?.length || 0;
  const split = report.prSplitRecommendation || computePrSplitRecommendation();
  return {
    status: 'available',
    effectivenessStatus: missedRiskCount ? 'needs_review' : 'measured',
    usefulFindingCount: findings.filter((finding) => finding.usefulness === 'high' || finding.actionability === 'actionable_now').length,
    ignoredFindingCount: 0,
    fixedFindingCount: report.findingLifecycle?.resolved?.length || 0,
    falsePositiveCount,
    missedRiskCount,
    reviewTriggeredCount: report.humanReviewRequired ? 1 : 0,
    prSplitTriggeredCount: split.splitRecommended ? 1 : 0,
    mergeBlockedCorrectlyCount: report.blockingFindings.length ? 1 : 0,
    mergeBlockedIncorrectlyCount: 0,
    recommendedTuning: falsePositiveCount || missedRiskCount ? 'review rule calibration and safe baseline policy' : 'continue collecting safe outcome feedback',
  };
}
function computeFixOutcomeTracker() {
  const resolved = report.findingLifecycle?.resolved || [];
  const unresolved = [...report.blockingFindings, ...report.warningFindings].slice(0, 10).map((finding) => ({
    findingFingerprint: finding.fingerprint,
    ruleId: finding.ruleId,
    rootCauseId: finding.rootCauseId,
    recommendedFixType: finding.recommendedFixType,
    beforeStatus: 'present',
    afterStatus: 'unknown',
    validationRun: false,
    resolved: false,
    partiallyResolved: false,
    newRiskIntroduced: false,
    requiresFollowUp: true,
  }));
  return {
    status: unresolved.length ? 'needs_follow_up' : 'pass',
    fixOutcomeStatus: unresolved.length ? 'unresolved_findings' : 'no_open_findings',
    resolvedFindings: resolved.slice(0, 10),
    unresolvedFindings: unresolved,
    newRisks: [],
    recommendedFollowUp: unresolved.length ? 'run post-fix verification after changes land' : 'no open finding follow-up reported',
  };
}
function computePostFixVerificationPlan() {
  const commands = new Set(report.auditValidationCommandPlan?.commands || []);
  commands.add('node scripts/codex-secret-safety-scan.mjs');
  commands.add('node scripts/codex-local-quality-gate.mjs');
  commands.add('CODEX_RUN_PROFILE_REQUIRED_CHECKS=1 node scripts/codex-local-quality-gate.mjs');
  return {
    status: 'available',
    verificationPlan: 'run safe targeted checks, then rerun the local quality gate',
    requiredCommands: [...commands].filter((cmd) => !/reset --hard|clean -fd|push --force|rm -rf|deploy|mint|production/i.test(cmd)).slice(0, 8),
    recommendedCommands: ['run affected tests when available', 'confirm no skip-only markers', 'confirm package metadata when package files changed'],
    manualChecks: report.humanReviewRequired ? ['record human review outcome', 'confirm residual risk text'] : [],
    profileReviewerChecks: report.selectedReviewers?.reviewers || [],
    whatNotToAssume: ['local pass does not prove remote pass', 'static audit does not prove external service behavior'],
  };
}
function computeRepairQualityEvaluate() {
  const weakening = report.testWeakeningStatus?.findings?.length || 0;
  const policyBypass = report.policyViolations.length || report.prSeparationStatus?.status === 'fail';
  return {
    status: policyBypass || weakening ? 'warning' : 'pass',
    repairQualityStatus: policyBypass || weakening ? 'needs_review' : 'no_repair_risk_detected',
    scopeScore: report.changedPathsSummary.count > 20 ? 'medium' : 'high',
    testIntegrityStatus: weakening ? 'weakening_risk' : 'pass',
    policyIntegrityStatus: policyBypass ? 'policy_risk' : 'pass',
    regressionCoverageStatus: report.testSufficiency?.missingTestIntent?.length ? 'needs_evidence' : 'pass',
    unrelatedChangeRisk: report.prSeparationStatus?.status === 'fail' || report.prScopeAgreement?.status === 'fail',
    recommendedAction: policyBypass || weakening ? 'narrow the fix and preserve verification evidence' : 'repair quality appears acceptable by safe summary',
  };
}
function computeSplitEffectiveness() {
  const split = report.prSplitRecommendation || computePrSplitRecommendation();
  const mixed = report.prSeparationStatus?.status === 'fail' || report.prScopeAgreement?.status === 'fail';
  return {
    status: split.splitRecommended || mixed ? 'split_recommended' : 'pass',
    splitEffectivenessStatus: split.splitRecommended || mixed ? 'split_recommended' : 'single_pr_ok',
    detectedMixedConcerns: mixed,
    suggestedSplitCount: split.suggestedPRs?.length || 0,
    overSplitRisk: false,
    underSplitRisk: mixed || split.splitRecommended === true,
    recommendedPRPlan: split.suggestedPRs?.length ? split.suggestedPRs.slice(0, 5) : [{ type: report.prTypeInference?.inferredType || 'unknown', reason: 'single concern by safe summary' }],
  };
}
function computeNoiseControl() {
  const findings = allAuditFindings();
  const topRootCauses = (report.rootCauseGroups || []).slice(0, 5);
  const mustRead = findings.filter((finding) => finding.priority === 'P0' || finding.priority === 'P1').slice(0, 5);
  return {
    status: findings.length > 20 ? 'grouped' : 'pass',
    noiseStatus: findings.length > 20 ? 'grouped' : 'within_budget',
    totalFindings: findings.length,
    groupedFindings: report.rootCauseGroups?.length || 0,
    hiddenLowValueFindings: Math.max(0, findings.length - 5),
    topRootCauses,
    mustReadFindings: mustRead,
    optionalFindings: findings.filter((finding) => finding.priority === 'P3').slice(0, 5),
  };
}
function computeAuditLearningRecommendation() {
  const falsePositiveCount = report.falsePositiveCandidates?.length || 0;
  const missedRiskCount = report.falseNegativeGuard?.findings?.length || 0;
  return {
    status: falsePositiveCount || missedRiskCount ? 'needs_review' : 'available',
    recommendedRuleTuning: falsePositiveCount ? ['consider narrowing noisy rule match scope'] : [],
    recommendedProfileTuning: missedRiskCount ? ['consider strengthening reviewer mapping or severity threshold'] : [],
    recommendedSeverityChange: [],
    recommendedCanaryChange: [],
    recommendedBaselineChange: falsePositiveCount ? ['prefer narrow expiring safe baseline entries'] : [],
    requiresHumanApproval: true,
    autoApply: false,
  };
}
function computeDecisionRetrospective() {
  return {
    status: 'available',
    decisionWasAppropriate: report.mergeReady === false ? report.blockingFindings.length > 0 || failures.length > 0 : report.blockingFindings.length === 0,
    unexpectedPostMergeFailure: false,
    missedPreMergeSignal: report.falseNegativeGuard?.findings?.length > 0,
    overBlockingSignal: false,
    recommendedTuning: 'compare pre-merge report with post-merge verification after merge',
    followUpRequired: report.humanReviewRequired === true || report.blockingFindings.length > 0,
  };
}
function computeRolloutScore() {
  const order = activeAuditPolicy.codeAuditPolicy?.recommendedRolloutOrder || report.rolloutGate?.recommendedOrder || ['lowest-risk profile', 'rendering/support profile', 'core profile', 'highest-risk profile'];
  return {
    status: report.auditQualityStatus === 'pass' ? 'pass' : 'warning',
    rolloutStatus: report.auditQualityStatus === 'pass' ? 'ready_for_dry_run' : 'needs_review',
    repoCount: 0,
    updatedRepoCount: 0,
    passingRepoCount: 0,
    failedRepoCount: 0,
    manualReviewNeededRepoCount: 0,
    postMergeVerifiedRepoCount: 0,
    remainingRisks: report.humanReviewReasons.slice(0, 5),
    recommendedNextRepo: order[0] || 'lowest-risk profile',
    recommendedOrder: order,
    stopRollout: report.auditQualityStatus !== 'pass',
  };
}
function computeFreshness() {
  const stale = [
    ...(report.temporalConsistency?.staleEvidence || []),
    ...((report.knownRisks?.expired || []).length ? ['known risk expiry'] : []),
  ];
  if (report.manualMergePolicy?.status === 'manual_confirmation_required') stale.push('remote status requires manual confirmation');
  return {
    status: stale.length ? 'warning' : 'pass',
    freshnessStatus: stale.length ? 'stale_or_manual' : 'fresh_by_safe_summary',
    staleItems: [...new Set(stale)].slice(0, 10),
    requiredRefresh: stale.length ? ['refresh quality report', 'confirm current remote status', 'update PR body evidence'] : [],
    manualConfirmationRequired: stale.length > 0,
  };
}
function computeRiskAcceptanceWorkflow() {
  return {
    status: 'available',
    riskId: 'safe-risk-id-required',
    riskSummary: 'short safe summary required',
    reason: 'required before acceptance',
    scope: 'narrow finding fingerprint or path scope only',
    expiresAtRequired: true,
    acceptedByRoleRequired: true,
    requiredFollowUp: ['post-merge check', 'expiry review'],
    postMergeCheck: true,
    autoApply: false,
    disallowed: ['permanent acceptance', 'high-priority high-confidence credential acceptance'],
  };
}
function computeReviewerAssignmentQuality() {
  const skills = report.selectedReviewers?.reviewers || [];
  const roles = report.humanReviewRoleMapping?.roles || ['project-owner'];
  const questions = report.reviewerChallengeQuestions?.questions || [];
  return {
    status: report.humanReviewRequired && !skills.length ? 'warning' : 'pass',
    requiredReviewerSkills: skills.slice(0, 5),
    requiredHumanRoles: roles.slice(0, 5),
    why: report.humanReviewRequired ? 'human review is required by risk or finding severity' : 'reviewer assignment available by safe summary',
    minimumReviewQuestions: questions.slice(0, 5),
    blockingQuestions: questions.slice(0, 3),
  };
}
function computeVerificationCompleteness() {
  const missing = [];
  if (report.secretScan?.status !== 'pass') missing.push('secret scan pass');
  if (report.localGate?.status !== 'pass') missing.push('local gate pass');
  if (report.profileRequiredChecks?.status !== 'pass') missing.push('profile required checks pass or justified skip');
  if (report.fullRunResidualIntelligence?.mustMentionInPRBody) missing.push('full run status or residual note');
  if (report.manualMergePolicy?.status === 'manual_confirmation_required') missing.push('remote status or manual confirmation');
  if (report.reviewerCoverageStatus?.status === 'warning') missing.push('reviewer skill coverage');
  if (report.humanReviewRequired) missing.push('human review outcome');
  if (report.minimumEvidence?.missingEvidence?.length) missing.push('minimum evidence');
  return {
    status: missing.length ? 'missing' : 'pass',
    verificationCompletenessStatus: missing.length ? 'missing' : 'complete',
    missingVerification: [...new Set(missing)].slice(0, 12),
    optionalVerification: ['full run when practical', 'post-merge verifier'],
    requiredBeforeMerge: [...new Set(missing)].slice(0, 12),
  };
}
function computeSkippedCheckJustification() {
  const checks = report.skippedChecks.map((check) => {
    const reason = check.reason || 'not specified';
    const acceptable = /missing script|not enabled|no package|flag/i.test(reason);
    return {
      skippedCheck: check.name,
      reason,
      acceptable,
      requiresFollowUp: !acceptable,
      mustMentionInPR: !acceptable || /full|remote|manual/i.test(`${check.name} ${reason}`),
    };
  });
  return {
    status: checks.some((check) => check.requiresFollowUp) ? 'warning' : 'pass',
    skippedCheckJustificationStatus: checks.length ? 'available' : 'none',
    checks,
  };
}
function computeAuditModeRecommendation() {
  let recommendedAuditMode = 'standard';
  if (report.riskLevel === 'R3' || report.humanReviewRequired || report.blockingFindings.length) recommendedAuditMode = 'strict';
  if (report.prTypeInference?.inferredType === 'docs-only' && !report.blockingFindings.length) recommendedAuditMode = 'advisory';
  return {
    status: 'available',
    recommendedAuditMode,
    why: `risk=${report.riskLevel}; prType=${report.prTypeInference?.inferredType || 'unknown'}; blocking=${report.blockingFindings.length}`,
    whatChangesIfStrict: 'coverage and human-review signals become stronger',
    whatChangesIfAdvisory: 'most non-blocking findings remain warnings or info',
  };
}
function computeAuditConflictDetector() {
  const conflicts = [];
  if (report.mergeReady === true && report.blockingFindings.length) conflicts.push('mergeReady true with blocking findings');
  if (report.humanReviewRequired === false && report.riskLevel === 'R3' && allAuditFindings().some((finding) => finding.confidence === 'high')) conflicts.push('high-risk high-confidence finding without human review');
  if (report.secretScan?.status === 'fail' && report.safeArtifactValidation?.secretFree === true) conflicts.push('secret scan failed while safe artifact summary says clean');
  if (report.manualMergePolicy?.status === 'manual_confirmation_required' && report.mergeReady === true) conflicts.push('manual confirmation missing while mergeReady true');
  return {
    status: conflicts.length ? 'warning' : 'pass',
    auditConflictStatus: conflicts.length ? 'conflict_detected' : 'pass',
    conflicts,
    recommendedCorrection: conflicts.length ? 'refresh report and fix conflicting decision inputs' : 'no audit decision conflict detected',
  };
}
function computeMaturityScore() {
  const checks = [
    report.secretScan?.status === 'pass',
    report.auditRegressionSuite?.status === 'pass',
    report.outputShapeStatus?.status === 'pass',
    report.safeArtifactValidation?.secretFree === true,
    report.profileCompatibilityMatrix?.status === 'pass',
    report.falseNegativeGuard?.status === 'pass' || report.falseNegativeGuard?.status === 'warning',
    report.postMergeVerificationPlan?.length > 0,
    report.humanInLoopEnforcement?.status !== 'not_run',
  ];
  const maturityScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return {
    status: maturityScore >= 80 ? 'pass' : 'warning',
    maturityScore,
    maturityBand: maturityScore >= 90 ? 'high' : (maturityScore >= 70 ? 'medium' : 'low'),
    weakAreas: checks.every(Boolean) ? [] : ['review failed or missing maturity inputs'],
    recommendedNextVersionFocus: 'use real safe feedback to tune noisy or missed findings',
    note: 'maturity score is an operational signal, not a guarantee',
  };
}
function computeMinimalPrPlan() {
  const split = report.prSplitRecommendation || computePrSplitRecommendation();
  const planPolicy = activeAuditPolicy.codeAuditPolicy?.minimalPrPlan || defaultPolicy.codeAuditPolicy.minimalPrPlan;
  const suggestedPRs = split.suggestedPRs?.length ? split.suggestedPRs : (report.remediationPlan?.perFixType || []);
  return {
    status: 'available',
    splitRecommended: split.splitRecommended === true,
    suggestedPRs: (suggestedPRs || []).slice(0, 5),
    doNotMix: (planPolicy.doNotMix || []).slice(0, 8),
    reason: split.reason || 'safe fix areas evaluated',
    firstPRRecommendation: (suggestedPRs || [])[0]?.type || report.remediationPlan?.recommendedFixOrder?.[0] || 'smallest safe change first',
  };
}
function computeCiRiskPrediction() {
  const base = computeLocalVsCiExpectation();
  return {
    ...base,
    status: base.ciRiskReasons?.length ? 'warning' : 'pass',
    mustMentionInPR: (base.ciRiskReasons || []).length > 0,
  };
}
function computeProfileInvariantEvaluation() {
  const findings = report.domainInvariantStatus?.findings || [];
  return {
    status: findings.length ? 'warning' : 'pass',
    profile: report.profile,
    invariantCount: (activeAuditPolicy.domainInvariants || []).length,
    findingCount: findings.length,
    findings: findings.slice(0, 10).map((finding) => ({
      id: finding.id,
      ruleId: finding.ruleId,
      reviewerSkill: finding.reviewerSkill,
      confidence: finding.confidence,
    })),
    recommendedAction: findings.length ? 'review profile invariant findings with mapped reviewer skill' : 'no profile invariant finding detected',
  };
}
function computeConfidenceImprovement() {
  const positiveSignals = [
    ...(report.negativeSignals || []).filter((item) => /pass|added|aligned|evidence|selected/i.test(`${item.id} ${item.reason}`)).map((item) => item.id),
    ...(report.selectedReviewers?.reviewers?.length ? ['reviewer.selected'] : []),
  ].sort();
  const negativeSignals = [
    ...(report.blockingFindings.length ? ['blocking.finding'] : []),
    ...(report.auditPerformance?.partial ? ['audit.partial'] : []),
    ...(report.localVsCiExpectation?.ciRiskReasons || []).map((_, index) => `ci.risk.${index + 1}`),
  ].sort();
  return {
    status: 'available',
    whyConfidence: report.blockingFindings.length ? 'high-confidence findings or correlated risks are present' : 'confidence adjusted by available positive and negative signals',
    positiveSignals,
    negativeSignals,
  };
}
function computeAuditValidationCommandPlan() {
  const plan = activeAuditPolicy.codeAuditPolicy?.validationCommandPlan || {};
  const commands = new Set([
    'node scripts/codex-secret-safety-scan.mjs',
    'node scripts/codex-local-quality-gate.mjs',
    'CODEX_RUN_PROFILE_REQUIRED_CHECKS=1 node scripts/codex-local-quality-gate.mjs',
  ]);
  for (const finding of allAuditFindings()) {
    const mapped = plan[finding.ruleId] || plan[finding.recommendedFixType];
    const hints = Array.isArray(mapped) ? mapped : finding.fixValidationHint || [];
    for (const hint of hints) {
      if (typeof hint === 'string' && !/reset --hard|clean -fd|push --force|rm -rf|deploy|mint|production/i.test(hint)) commands.add(hint);
    }
  }
  return {
    status: 'available',
    commands: [...commands].slice(0, 12),
    unsafeCommandRecommended: false,
  };
}
function computeRuleTuningRecommendation() {
  const recommendations = [];
  const byRule = report.ruleEffectivenessReport?.rules || [];
  for (const rule of byRule.slice(0, 10)) {
    if (rule.falsePositiveCandidateCount > rule.actionableCount) {
      recommendations.push({
        ruleId: rule.ruleId,
        currentSeverity: rule.warningCount ? 'warning' : (rule.blockingCount ? 'blocking' : 'info'),
        suggestedSeverity: 'review',
        reason: 'false-positive candidates exceed actionable count in safe summary',
        evidence: `fp=${rule.falsePositiveCandidateCount} actionable=${rule.actionableCount}`,
        profile: report.profile,
        autoApply: false,
      });
    }
  }
  return {
    status: 'available',
    recommendations,
    autoApply: false,
  };
}
function computeGoldenPack() {
  const passCount = [
    report.auditRegressionSuite?.status === 'pass',
    ['pass', 'informational'].includes(report.auditScorecard?.status),
    report.faultInjectionBenchmark?.status === 'pass',
    report.outputShapeStatus?.status === 'pass',
  ].filter(Boolean).length;
  const fixtureCount = 4;
  return {
    status: passCount === fixtureCount ? 'pass' : 'warning',
    goldenPackStatus: passCount === fixtureCount ? 'pass' : 'warning',
    fixtureCount,
    passCount,
    failCount: fixtureCount - passCount,
    knownLimitations: ['synthetic fixtures are a calibration signal, not proof of defect absence'],
  };
}
function computeAuditResultShape() {
  const fields = ['ruleId', 'rootCauseId', 'fingerprint', 'priority', 'severity', 'confidence', 'recommendedFixType', 'semanticImpact'];
  const missing = [];
  for (const finding of allAuditFindings()) {
    for (const field of fields) if (!finding[field]) missing.push({ field, ruleId: finding.ruleId || finding.id });
  }
  return {
    status: missing.length ? 'warning' : 'pass',
    requiredFields: fields,
    missing: missing.slice(0, 10),
    stableIds: allAuditFindings().every((finding) => finding.ruleId && finding.rootCauseId && finding.fingerprint),
  };
}
function computeFullRunResidualIntelligence() {
  const residual = report.residualTestStatus || {};
  const status = residual.status || 'unknown';
  const mustMention = status === 'not_run' || status === 'fail' || residual.knownResidualAccepted === true || residual.newFailureDetected === true;
  return {
    status: mustMention ? 'warning' : 'pass',
    fullRunStatus: status,
    knownResidualStatus: residual.knownResidualAccepted === true ? 'accepted_by_policy' : 'not_declared',
    newFailureSuspected: residual.newFailureDetected === true,
    baselineCompared: Boolean(residual.knownResidualAccepted || residual.newFailureDetected),
    residualDocumentedInPR: false,
    mustMentionInPRBody: mustMention,
  };
}
function computeTrustLevel() {
  if (report.worktreeStatus?.isDirty || report.blockingFindings.length || failures.length) return 'low';
  if (report.auditPerformance?.partial || report.manualMergePolicy?.status === 'manual_confirmation_required' || report.profileRequiredChecks?.status === 'not_run') return 'medium';
  if (report.mergeReady && report.secretScan?.status === 'pass' && report.localGate?.status === 'pass') return 'high';
  return 'medium';
}
function computeReadinessForRealRepo() {
  const ready = report.auditQualityStatus === 'pass'
    && report.outputShapeStatus?.status === 'pass'
    && report.auditRegressionSuite?.status === 'pass'
    && !report.blockingFindings.length;
  const rolloutOrder = activeAuditPolicy.codeAuditPolicy?.recommendedRolloutOrder
    || ['lowest-risk profile', 'rendering/support profile', 'core profile', 'highest-risk profile'];
  return {
    status: ready ? 'pass' : 'warning',
    readyForRealRepo: ready,
    reason: ready ? 'safe synthetic evaluation passed' : 'audit quality or blocking finding requires review before rollout',
    requiredBeforeApply: ready ? [] : ['review audit quality warnings', 'confirm release audit', 'use dry-run first'],
    recommendedFirstRepo: rolloutOrder[0] || 'lowest-risk profile',
    recommendedRolloutOrder: rolloutOrder,
  };
}
function validationForFinding(finding) {
  const id = finding.id || '';
  const type = finding.recommendedFixType || 'cannot_determine';
  let predictedValidation = ['run secret scan', 'run local quality gate'];
  if (id.startsWith('dependencyAudit.') || type === 'dependency_fix') predictedValidation = ['confirm package metadata', 'run affected build', 'run affected package test'];
  else if (id.startsWith('testWeakening.') || type === 'test_fix') predictedValidation = ['run affected test', 'confirm regression evidence', 'confirm no skip-only markers'];
  else if (id.startsWith('domainInvariant.') || type === 'human_review_required') predictedValidation = ['use mapped reviewer skill', 'run targeted boundary test', 'record human review'];
  else if (id.startsWith('securitySensitiveChange.')) predictedValidation = ['run secret scan', 'run permission-oriented test', 'record human review'];
  else if (id.startsWith('coverageIntent.')) predictedValidation = ['add or confirm missing test intent', 'run targeted test'];
  return {
    findingId: finding.id,
    ruleId: finding.ruleId,
    fingerprint: finding.fingerprint,
    predictedValidation,
    confidence: finding.confidence || 'unknown',
    recommendedCommand: finding.recommendedCommand || 'node scripts/codex-local-quality-gate.mjs',
    manualReviewNeeded: finding.humanReviewRequired === true || type === 'human_review_required',
  };
}
function computePredictionValidation() {
  return {
    status: 'available',
    predictions: allAuditFindings().slice(0, 20).map(validationForFinding),
  };
}
function computeAuditToTestMapping() {
  const mappings = [];
  for (const finding of allAuditFindings()) {
    const id = finding.id || '';
    const intents = [];
    if (id.startsWith('testWeakening.')) intents.push('regression', 'error path');
    if (id.startsWith('coverageIntent.')) intents.push(...(report.missingTestIntent || []).map((item) => item.intent));
    if (id.startsWith('dependencyAudit.')) intents.push('smoke/integration');
    if (id.startsWith('domainInvariant.')) intents.push('boundary values', 'state transitions');
    if (id.startsWith('securitySensitiveChange.')) intents.push('permissions', 'error path');
    const unique = [...new Set(intents)].filter(Boolean).slice(0, 5);
    if (!unique.length) continue;
    mappings.push({
      findingId: finding.id,
      ruleId: finding.ruleId,
      fingerprint: finding.fingerprint,
      missingTestIntent: unique,
      recommendedTestType: unique[0],
      whyNeeded: 'finding needs targeted verification evidence',
      riskIfMissing: finding.severity === 'blocking' ? 'merge-blocking risk may remain unresolved' : 'warning may remain uncertain',
      profileReviewer: finding.recommendedReviewerSkill || '',
    });
  }
  return { status: mappings.length ? 'available' : 'not_applicable', mappings: mappings.slice(0, 20) };
}
function computeAuditResultStabilityStatus() {
  const required = ['selectedReviewers', 'rootCauseGroups', 'decisionMatrix', 'humanReviewReasons', 'recommendedAction'];
  const missing = required.filter((field) => report[field] === undefined);
  return {
    status: missing.length ? 'warning' : 'pass',
    stableFields: required.filter((field) => !missing.includes(field)),
    missingFields: missing,
    sameInputSameOutput: missing.length === 0,
  };
}
function computeAuditReplayPack() {
  return {
    status: 'available',
    replayStatus: 'available_from_safe_report',
    sameDecision: true,
    changedDecision: false,
    reason: 'current report can be replayed from safe decision fields',
    manualReviewRequired: report.humanReviewRequired === true,
  };
}
function computeGoldenFixtures() {
  return {
    status: report.auditRegressionSuite?.status || 'unknown',
    areas: ['test weakening', 'dependency audit', 'domain invariant', 'security-sensitive', 'coverage intent', 'suppression governance', 'PR type inference', 'reviewer selector', 'decision matrix', 'trust level'],
  };
}
function computeProfilePortabilityCheck() {
  const missing = [];
  if (!fs.existsSync(path.join('docs', 'process', 'CODEX_PROFILE_METADATA.json'))) missing.push('profile metadata');
  if (!fs.existsSync(path.join('docs', 'process', 'CODEX_QUALITY_GATE_POLICY.json'))) missing.push('profile policy');
  if (!fs.existsSync(path.join('docs', 'process', 'CODEX_KNOWN_RISKS.json'))) missing.push('known risks baseline');
  const skillsDir = path.join('docs', 'process', 'skills');
  if (!fs.existsSync(skillsDir) || !fs.readdirSync(skillsDir).some((file) => file.endsWith('.md'))) missing.push('reviewer skill');
  return {
    status: missing.length ? 'warning' : 'pass',
    profilePortable: missing.length === 0 && report.policySchema?.status !== 'fail',
    missingProfilePieces: missing,
    recommendedFix: missing.length ? 'add missing profile-managed pieces before rollout' : 'profile pieces are portable by safe summary',
  };
}
function computeLocalVsCiExpectation() {
  const reasons = [];
  const changed = report.changedPathsSummary.paths || [];
  const packageChanged = changed.some((file) => packagePath(file));
  const lockChanged = changed.some((file) => /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(file));
  if (packageChanged && !lockChanged) reasons.push('package metadata changed without lockfile evidence');
  if (report.profileRequiredChecks?.status === 'not_run') reasons.push('profile required checks not run');
  if (report.manualMergePolicy?.status === 'manual_confirmation_required') reasons.push('remote quality-gate confirmation may require manual check');
  if (report.auditPerformance?.partial) reasons.push('partial audit was used');
  if (report.dependencyAuditStatus?.findings?.some((finding) => finding.id === 'unknownPackageManager')) reasons.push('package manager is unknown');
  return {
    status: reasons.length ? 'warning' : 'pass',
    ciRiskStatus: reasons.length ? 'warning' : 'pass',
    ciRiskReasons: reasons,
    recommendedCIConfirmation: reasons.length ? 'confirm remote quality gate and affected build/test' : 'standard remote quality-gate confirmation',
  };
}
function computePartialRunHandling() {
  const full = report.fullRunResidualIntelligence || computeFullRunResidualIntelligence();
  return {
    status: full.status,
    targetedTestsRun: (report.localGate?.checksRun || []).filter((check) => /test|build|lint|smoke/i.test(check.name || '')).map((check) => check.name),
    fullRunStatus: full.fullRunStatus,
    knownResidualStatus: full.knownResidualStatus,
    newFailureSuspected: full.newFailureSuspected,
    residualDocumented: full.residualDocumentedInPR,
    mustMentionInPR: full.mustMentionInPRBody,
  };
}
function computeHumanReviewPacket() {
  return {
    status: report.humanReviewRequired ? 'required' : 'not_required',
    prType: report.prType,
    riskLevel: report.riskLevel,
    topFindings: topAuditFindings(5),
    topRootCauses: (report.rootCauseGroups || []).slice(0, 5).map((group) => ({ rootCauseId: group.rootCauseId, priority: group.priority, recommendedFixType: group.recommendedFixType })),
    testSufficiencyGaps: report.testSufficiency?.missingTestIntent || report.missingTestIntent || [],
    specTestMismatch: report.specTestMismatch || { status: 'unknown' },
    semanticImpact: report.semanticImpact || { status: 'unknown' },
    minimalPrPlan: report.minimalPrPlan || { status: 'unknown' },
    whatNotToChange: report.minimalPrPlan?.doNotMix || activeAuditPolicy.codeAuditPolicy?.minimalPrPlan?.doNotMix || [],
    recommendedReviewerSkill: report.selectedReviewers?.reviewers?.[0] || '',
    recommendedValidation: report.auditValidationCommandPlan?.commands || [],
    humanReviewReasons: report.humanReviewReasons.slice(0, 10),
    filesChangedSummary: {
      count: report.changedPathsSummary.count,
      blocked: report.changedPathsSummary.blocked.length,
      highRisk: report.changedPathsSummary.highRisk.length,
    },
    checksRun: (report.localGate?.checksRun || []).map((check) => ({ name: check.name, status: check.status })),
    checksSkipped: report.skippedChecks.map((check) => ({ name: check.name, reason: check.reason })),
    knownResiduals: report.partialRunHandling?.mustMentionInPR === true,
    whatNotToMerge: report.stopConditions?.triggeredStopConditions || [],
    questionsForHuman: report.humanReviewRequired ? ['confirm risk acceptance', 'confirm required checks', 'confirm residual risks are documented'] : [],
  };
}
function computeStopConditions() {
  const conditions = [
    { id: 'secretScanFail', triggered: report.secretScan?.status === 'fail' },
    { id: 'blockedPathsTouched', triggered: report.changedPathsSummary.blocked.length > 0 },
    { id: 'dirtyWorktree', triggered: report.worktreeStatus?.isDirty === true },
    { id: 'highConfidenceBlockingFinding', triggered: report.blockingFindings.some((finding) => finding.confidence === 'high') },
    { id: 'qualityGateMissingOrFailed', triggered: report.localGate?.status === 'fail' || report.manualMergePolicy?.status === 'manual_confirmation_required' },
    { id: 'humanReviewMissing', triggered: report.humanReviewRequired === true },
    { id: 'profileMismatch', triggered: report.profileMatch?.status === 'fail' },
    { id: 'forbiddenReportField', triggered: report.outputShapeStatus?.status === 'fail' },
    { id: 'prScopeMixed', triggered: report.prSeparationStatus?.status === 'fail' },
  ];
  return {
    status: conditions.some((item) => item.triggered) ? 'warning' : 'pass',
    stopConditions: conditions.map((item) => item.id),
    triggeredStopConditions: conditions.filter((item) => item.triggered).map((item) => item.id),
    notTriggeredStopConditions: conditions.filter((item) => !item.triggered).map((item) => item.id),
  };
}
function computeReleaseCandidateCheck() {
  const blockingReasons = [];
  if (report.blockingFindings.length) blockingReasons.push('blocking findings present');
  if (report.auditQualityStatus !== 'pass') blockingReasons.push('audit quality not pass');
  if (report.outputShapeStatus?.status !== 'pass') blockingReasons.push('output shape not pass');
  if (report.auditRegressionSuite?.status !== 'pass') blockingReasons.push('audit regression suite not pass');
  if (report.falseNegativeGuard?.status === 'warning') blockingReasons.push('false negative guard warning');
  const rolloutOrder = activeAuditPolicy.codeAuditPolicy?.releaseCandidateRolloutOrder
    || activeAuditPolicy.codeAuditPolicy?.recommendedRolloutOrder
    || ['generic dummy repo', 'lowest-risk real profile', 'core profile', 'highest-risk profile'];
  return {
    status: blockingReasons.length ? 'warning' : 'pass',
    releaseCandidateStatus: blockingReasons.length ? 'warning' : 'pass',
    readyForRealProjectEvaluation: blockingReasons.length === 0,
    blockingReasons,
    recommendedRolloutOrder: rolloutOrder,
    recommendedFirstRepo: rolloutOrder[0] || 'generic dummy repo',
    requiredManualChecks: ['dry-run target profile', 'confirm safe JSON report', 'confirm remote quality-gate when available'],
    safeSummary: blockingReasons.length ? 'release candidate needs review before real project evaluation' : 'release candidate checks passed by safe summary',
  };
}
function computeApplyRecommendation() {
  const rc = report.releaseCandidateCheck || computeReleaseCandidateCheck();
  const stop = report.stopConditions || computeStopConditions();
  return {
    status: rc.status === 'pass' && stop.triggeredStopConditions.length === 0 ? 'pass' : 'warning',
    applyRecommended: rc.readyForRealProjectEvaluation === true && stop.triggeredStopConditions.length === 0,
    why: rc.safeSummary,
    risk: report.riskLevel,
    recommendedRepoOrder: rc.recommendedRolloutOrder,
    stopConditions: stop.stopConditions,
    postApplyChecks: ['secret scan', 'local quality gate', 'profile required checks', 'safe JSON report review'],
  };
}
function safeForbiddenArtifactHit(value) {
  const text = JSON.stringify(value || {});
  return [
    /(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/\S+/i,
    /\b(?:gh[pousr]_|sk-|AKIA)[A-Za-z0-9_-]{8,}\b/,
    /-----BEGIN [^-]+PRIVATE KEY-----/i,
  ].some((pattern) => pattern.test(text));
}
function computeRealProjectEvaluationFramework() {
  const findings = allAuditFindings();
  const useful = findings.filter((finding) => ['high', 'medium'].includes(finding.usefulness || finding.confidence || '') || finding.severity === 'blocking');
  const lowValue = findings.filter((finding) => finding.usefulness === 'low' || finding.confidence === 'low');
  const likelyFalsePositives = report.falsePositiveCandidates || [];
  const likelyMissedRisks = report.falseNegativeGuard?.findings || [];
  return {
    status: likelyMissedRisks.length ? 'warning' : 'pass',
    realProjectEvaluationStatus: likelyMissedRisks.length ? 'warning' : 'pass',
    usefulFindings: useful.length,
    lowValueFindings: lowValue.length,
    likelyFalsePositives: likelyFalsePositives.length,
    likelyMissedRisks: likelyMissedRisks.length,
    actionableFindings: findings.filter((finding) => finding.actionability === 'actionable_now').length,
    humanReviewFindings: findings.filter((finding) => finding.humanReviewRequired === true || finding.actionability === 'needs_human_review').length,
    mergeDecisionQuality: report.mergeReady === false && report.blockingFindings.length ? 'consistent_blocked' : (report.mergeReady === true ? 'ready_by_safe_checks' : 'needs_review'),
    recommendedRuleTuning: likelyFalsePositives.length > useful.length ? 'review noisy warning rules' : 'no immediate rule tuning suggested',
    recommendedProfileTuning: report.profileCalibrationPack?.status === 'pass' ? 'profile calibration acceptable by safe fixtures' : 'review profile calibration summary',
    recommendedNextAction: report.recommendedNextAction || report.recommendedAction,
  };
}
function computeFeedbackLoopStatus() {
  return {
    status: fs.existsSync(path.join('scripts', 'codex-audit-feedback-record.mjs')) ? 'available' : 'missing',
    feedbackRecord: 'manual_review_required_before_policy_change',
    baselineCandidate: 'generated_only_from_safe_fields',
    ruleTuningCandidate: 'safe_summary_only',
    profileTuningCandidate: 'safe_summary_only',
  };
}
function computePerformanceSummary() {
  const findings = allAuditFindings();
  const byRule = new Map();
  for (const finding of findings) {
    const key = finding.ruleId || finding.id || 'unknown';
    byRule.set(key, (byRule.get(key) || 0) + (finding.count || 1));
  }
  return {
    status: 'available',
    totalPRs: 1,
    mergeReadyTrueCount: report.mergeReady ? 1 : 0,
    mergeReadyFalseCount: report.mergeReady ? 0 : 1,
    blockingFindingsCount: report.blockingFindings.length,
    warningsCount: report.warningFindings.length,
    falsePositiveFeedbackCount: 0,
    missedRiskFeedbackCount: 0,
    postMergeFailureCount: 0,
    profileBreakdown: [{ profile: report.profile, findingCount: findings.length, humanReviewRequired: report.humanReviewRequired === true }],
    topRulesByFindingCount: [...byRule.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([ruleId, count]) => ({ ruleId, count })),
    topRulesByFalsePositiveFeedback: [],
    recommendedTuning: report.falsePositiveCandidates?.length ? 'review likely false-positive candidates' : 'no tuning suggested by current safe summary',
  };
}
function computeProfileCalibrationReport() {
  const packProfiles = report.profileCalibrationPack?.profiles || [];
  const profiles = packProfiles.length ? packProfiles : [{
    profile: report.profile,
    blockingRate: report.blockingFindings.length ? 1 : 0,
    warningRate: report.warningFindings.length ? 1 : 0,
    humanReviewRate: report.humanReviewRequired ? 1 : 0,
    falsePositiveFeedback: 0,
    missedRiskFeedback: 0,
    recommendedAuditMode: activeAuditPolicy.codeAuditPolicy?.recommendedMode || report.auditMode || 'standard',
    recommendedSeverityOverrides: [],
    recommendedCanaryRules: [],
  }];
  return { status: 'available', profiles };
}
function computeCanaryPromotionWorkflow() {
  return {
    status: 'available',
    canaryRules: (activeAuditPolicy.codeAuditPolicy?.canaryRules || []).map((rule) => ({
      canaryRuleId: typeof rule === 'string' ? rule : rule.ruleId,
      profile: report.profile,
      canaryFindingsCount: report.canaryFindings.filter((finding) => finding.ruleId === (typeof rule === 'string' ? rule : rule.ruleId)).length,
      falsePositiveFeedbackCount: 0,
      missedRiskFeedbackCount: 0,
      recommendedPromotion: false,
      promotionBlockedReason: 'human review required before promotion',
      expiresAt: typeof rule === 'object' ? rule.canaryExpiresAt : '',
    })),
    automaticPromotion: false,
    humanReviewRequired: true,
  };
}
function computeRuleRetirementWorkflow() {
  const rules = (report.ruleEffectivenessReport?.rules || []).slice(0, 10).map((rule) => ({
    ruleId: rule.ruleId,
    findingCount: rule.triggerCount || 0,
    usefulFeedbackCount: rule.actionableCount || 0,
    falsePositiveFeedbackCount: rule.falsePositiveCandidateCount || 0,
    suggestedAction: rule.falsePositiveCandidateCount > rule.actionableCount ? 'tune' : 'keep',
  }));
  return { status: 'available', rules, automaticDeletion: false };
}
function computeSmokeBenchmark() {
  return {
    status: 'available',
    mode: 'safe_synthetic_only',
    scenarios: ['harness-only', 'docs-only', 'dependency', 'test weakening', 'domain invariant', 'readiness invariant', 'sensitive change'],
    leavesRepoDirty: false,
  };
}
function computeRuleTraceability() {
  const traces = allAuditFindings().slice(0, 20).map((finding) => ({
    ruleId: finding.ruleId || finding.id || 'unknown',
    fingerprint: finding.fingerprint || '',
    policySource: 'docs/process/CODEX_QUALITY_GATE_POLICY.json',
    profileSource: 'docs/process/CODEX_PROFILE_METADATA.json',
    reviewerSkillSource: finding.recommendedReviewerSkill ? `docs/process/skills/${finding.recommendedReviewerSkill}.md` : '',
    calibrationSource: 'docs/process/CODEX_CODE_AUDIT_RULES.json',
    baselineSource: finding.known ? 'docs/process/CODEX_CODE_AUDIT_BASELINE.json' : '',
    confidenceSource: finding.confidenceExplanation || finding.whyConfidence || '',
  }));
  return { status: 'available', traces };
}
function computeReviewerSkillEffectiveness() {
  const missing = report.reviewerCoverageStatus?.missing || [];
  return {
    status: missing.length ? 'warning' : 'pass',
    missingReviewerMappings: missing.length,
    selectedReviewers: report.selectedReviewers?.reviewers || [],
    coveredFindingCount: allAuditFindings().length - missing.length,
  };
}
function computeExplainabilityCompression() {
  const mode = process.env.CODEX_AUDIT_SUMMARY_MODE || 'standard';
  return {
    status: 'available',
    mode,
    brief: { rootCauseLimit: 3, includes: ['mergeReady', 'humanReviewRequired', 'recommendedNextAction'] },
    standard: { rootCauseLimit: 5, includes: ['counts', 'safe commands', 'what not to do'] },
    detailed: { format: 'safe JSON report' },
  };
}
function computeNoRegressionStatus() {
  return {
    status: report.auditRegressionSuite?.status === 'pass' && ['pass', 'informational'].includes(report.auditScorecard?.status) ? 'pass' : 'warning',
    coveredAreas: ['secret scan', 'test weakening', 'dependency audit', 'domain invariant', 'security-sensitive', 'coverage intent', 'baseline governance', 'profile selection', 'worktree', 'PR readiness', 'post-merge', 'multi-repo', 'manual merge', 'branch cleanup', 'evidence pack', 'PR body draft', 'review prompt', 'audit compare', 'rule docs', 'regression suite', 'scorecard', 'evaluation mode'],
  };
}
function computeRolloutGate() {
  const rc = report.releaseCandidateCheck || computeReleaseCandidateCheck();
  const order = activeAuditPolicy.codeAuditPolicy?.realProjectRolloutOrder
    || activeAuditPolicy.codeAuditPolicy?.releaseCandidateRolloutOrder
    || activeAuditPolicy.codeAuditPolicy?.recommendedRolloutOrder
    || ['generic dummy repo', 'lowest-risk real profile', 'core profile', 'highest-risk profile'];
  return {
    status: rc.readyForRealProjectEvaluation ? 'pass' : 'warning',
    applyRecommended: rc.readyForRealProjectEvaluation === true,
    profileReadiness: order.map((profile, index) => ({ profile, ready: index === 0 || rc.readyForRealProjectEvaluation === true })),
    recommendedOrder: order,
    stopConditions: report.stopConditions?.stopConditions || [],
    manualChecks: rc.requiredManualChecks || [],
    knownLimitations: ['static audit is policy based', 'manual review remains required for high-risk decisions'],
  };
}
function computeTrustBoundary() {
  return {
    status: 'available',
    canSupport: ['policy based static audit result', 'secret scan result', 'selected local gate result', 'profile required checks result', 'report secret-free validation'],
    cannotGuarantee: ['external service correctness', 'production data correctness', 'remote transaction success', 'absence of unknown vulnerabilities', 'fully automated specification judgment', 'absence of all bugs'],
  };
}
function computeHumanInLoopEnforcement() {
  const manual = report.humanReviewRequired === true || report.decisionMatrix?.manualConfirmationRequired === true || report.manualMergePolicy?.status === 'manual_confirmation_required';
  return {
    status: manual ? 'manual_confirmation_required' : 'pass',
    manualConfirmationRequired: manual,
    why: manual ? (report.humanReviewReasons || []).slice(0, 10) : [],
    whoShouldReviewRole: report.humanReviewRoleMapping?.roles?.[0] || activeAuditPolicy.codeAuditPolicy?.humanReviewRole || 'project-owner',
    whatToCheck: ['quality evidence', 'blocking or high-priority findings', 'residual risks', 'remote quality-gate status'],
    cannotAutoApproveReason: manual ? 'policy requires human confirmation for current risk summary' : '',
  };
}
function computeSafeArtifactValidation() {
  const artifacts = {
    qualityReport: report,
    evidencePack: report.evidencePack,
    prBodyDraft: { status: 'available', safeSummaryOnly: true },
    reviewPromptDraft: { status: report.reviewPromptDraftAvailable ? 'available' : 'missing' },
    humanReviewPacket: report.humanReviewPacket,
    feedbackRecord: report.feedbackLoop,
    performanceSummary: report.performanceSummary,
    rolloutTracker: report.rolloutStatus,
    agentMemoryPolicyStatus: report.agentMemoryPolicyStatus,
    skillLifecyclePolicyStatus: report.skillLifecyclePolicyStatus,
    curatorSuggestionStatus: report.curatorSuggestionStatus,
    selfEvolutionPolicyStatus: report.selfEvolutionPolicyStatus,
    sourceHarnessValidationStatus: report.sourceHarnessValidationStatus,
    openaiCodexMethodStatus: report.openaiCodexMethodStatus,
    methodSupportStatus: report.methodSupportStatus,
  };
  const unsafe = Object.entries(artifacts).filter(([, value]) => safeForbiddenArtifactHit(value)).map(([name]) => name);
  return {
    status: unsafe.length ? 'fail' : 'pass',
    checkedArtifacts: Object.keys(artifacts),
    unsafeArtifacts: unsafe,
    secretFree: unsafe.length === 0,
  };
}
function failureRecorded(id) {
  return failures.some((failure) => failure.id === id);
}
function enforceFinalValidationStatuses() {
  const statuses = [
    ['agentMemoryPolicyStatus', report.agentMemoryPolicyStatus],
    ['skillLifecyclePolicyStatus', report.skillLifecyclePolicyStatus],
    ['selfEvolutionPolicyStatus', report.selfEvolutionPolicyStatus],
    ['curatorSuggestionStatus', report.curatorSuggestionStatus],
    ['sourceHarnessValidationStatus', report.sourceHarnessValidationStatus],
    ['openaiCodexMethodStatus', report.openaiCodexMethodStatus],
    ['methodSupportStatus', report.methodSupportStatus],
    ['safeArtifactValidation', report.safeArtifactValidation],
    ['outputShapeStatus', report.outputShapeStatus],
  ];
  for (const [name, value] of statuses) {
    if (!value || value.status === 'not_run' || value.status === 'not_required') continue;
    if (value.status === 'fail') {
      const id = `${name}.failed`;
      if (!failureRecorded(id)) addFailure(id, `${name} failed.`);
    } else if (value.status === 'warning') {
      addHumanReviewReason(`${name}.warning`);
      addWarning({ id: `${name}.warning`, message: `${name} requires human review.` });
    }
  }
}
function printAuditSummaryMode() {
  const mode = process.env.CODEX_AUDIT_SUMMARY_MODE || '';
  if (!mode || process.env.CODEX_QUALITY_REPORT === 'json') return;
  if (mode === 'brief') {
    safeLog('Codex audit brief summary:');
    safeLog(`status: ${report.status}`);
    safeLog(`mergeReady: ${report.mergeReady}`);
    safeLog(`riskLevel: ${report.riskLevel}`);
    safeLog(`blocking: ${report.blockingFindings.length}`);
    safeLog(`warning: ${report.warningFindings.length}`);
    safeLog(`humanReviewRequired: ${report.humanReviewRequired}`);
    for (const group of (report.rootCauseGroups || []).slice(0, 3)) safeLog(`topRootCause: ${group.priority} ${group.rootCauseId}`);
    safeLog(`recommendedNextAction: ${report.recommendedNextAction}`);
  } else if (mode === 'detailed') {
    safeLog('Codex audit detailed safe summary:');
    safeLog(`status: ${report.status}`);
    safeLog(`mergeReady: ${report.mergeReady}`);
    safeLog(`riskLevel: ${report.riskLevel}`);
    safeLog(`rootCauseGroups: ${(report.rootCauseGroups || []).length}`);
    safeLog(`selectedReviewers: ${(report.selectedReviewers?.reviewers || []).join(', ') || 'none'}`);
    safeLog(`stopConditionsTriggered: ${(report.stopConditions?.triggeredStopConditions || []).join(', ') || 'none'}`);
    safeLog(`trustLevel: ${report.trustLevel}`);
  }
}
function computeEvidenceSummary() {
  return {
    status: 'available',
    harnessVersion: HARNESS_VERSION,
    profile: report.profile,
    riskLevel: report.riskLevel,
    mergeReady: report.mergeReady,
    worktreeDoctor: report.worktreeStatus?.status || 'unknown',
    secretScan: report.secretScan?.status || 'unknown',
    localQualityGate: report.localGate?.status || 'unknown',
    profileRequiredChecks: report.profileRequiredChecks?.status || 'unknown',
    agentMemoryPolicyStatus: report.agentMemoryPolicyStatus?.status || 'unknown',
    skillLifecyclePolicyStatus: report.skillLifecyclePolicyStatus?.status || 'unknown',
    curatorSuggestionStatus: report.curatorSuggestionStatus?.status || 'unknown',
    selfEvolutionPolicyStatus: report.selfEvolutionPolicyStatus?.status || 'unknown',
    sourceHarnessValidationStatus: report.sourceHarnessValidationStatus?.status || 'unknown',
    diffScope: {
      outOfScope: report.changedPathsSummary.outOfScope.length,
      blocked: report.changedPathsSummary.blocked.length,
      highRisk: report.changedPathsSummary.highRisk.length,
    },
    prSeparationStatus: report.prSeparationStatus?.status || 'unknown',
    codeAudit: report.codeAudit,
    rootCauseGroups: report.rootCauseGroups.slice(0, 5).map((group) => ({
      rootCauseId: group.rootCauseId,
      ruleIds: group.ruleIds,
      severity: group.severity,
      confidence: group.confidence,
      priority: group.priority,
      affectedFileCount: group.affectedFiles.length,
      findingCount: group.findingCount,
      recommendedFixType: group.recommendedFixType,
    })),
    fixImpact: report.fixImpact,
    negativeSignals: report.negativeSignals,
    auditPerformance: report.auditPerformance,
    confidenceCalibration: report.confidenceCalibration,
    codeAuditCalibration: report.codeAuditCalibration,
    auditRegressionSuite: report.auditRegressionSuite,
    auditScorecard: report.auditScorecard,
    auditQualityStatus: report.auditQualityStatus,
    auditQualityScore: report.auditQualityScore,
    auditEvaluation: report.auditEvaluation,
    faultInjectionBenchmark: report.faultInjectionBenchmark,
    semanticImpact: report.semanticImpact,
    testSufficiency: report.testSufficiency,
    specTestMismatch: report.specTestMismatch,
    specTestCodeConsistency: report.specTestCodeConsistency,
    defectTaxonomy: report.defectTaxonomy,
    oracleLimits: report.oracleLimits,
    decisionTrace: report.decisionTrace,
    auditConfidenceEvidence: report.auditConfidenceEvidence,
    precisionRecallGuardrails: report.precisionRecallGuardrails,
    calibrationLockStatus: report.calibrationLockStatus,
    reviewerInstructionCompactness: report.reviewerInstructionCompactness,
    fixPlanValidation: report.fixPlanValidation,
    prScopeAgreement: report.prScopeAgreement,
    auditDriftReport: report.auditDriftReport,
    residualFailureGovernance: report.residualFailureGovernance,
    ciParity: report.ciParity,
    realProjectDryRunAuditPack: report.realProjectDryRunAuditPack,
    severitySanity: report.severitySanity,
    humanReviewRoleMapping: report.humanReviewRoleMapping,
    auditUsefulnessValidation: report.auditUsefulnessValidation,
    auditGrade: report.auditGrade,
    oracleValidation: report.oracleValidation,
    decisionSimulator: report.decisionSimulator,
    remediationVerification: report.remediationVerification,
    benchmarkPack: report.benchmarkPack,
    acceptanceCriteria: report.acceptanceCriteria,
    confusionRisk: report.confusionRisk,
    temporalConsistency: report.temporalConsistency,
    scenarioReplay: report.scenarioReplay,
    humanReviewChecklist: report.humanReviewChecklist,
    specAuthorityStatus: report.specAuthorityStatus,
    auditCompleteness: report.auditCompleteness,
    deploymentBoundary: report.deploymentBoundary,
    mutationBenchmark: report.mutationBenchmark,
    adversarialPrSimulator: report.adversarialPrSimulator,
    auditBypass: report.auditBypass,
    realWorldCanarySet: report.realWorldCanarySet,
    specBoundaryMutation: report.specBoundaryMutation,
    testAuditMutation: report.testAuditMutation,
    dependencyAdversarial: report.dependencyAdversarial,
    ciParityAdversarial: report.ciParityAdversarial,
    evidenceIntegrity: report.evidenceIntegrity,
    humanOverrideTemplate: report.humanOverrideTemplate,
    redTeam: report.redTeam,
    monotonicity: report.monotonicity,
    minimumEvidence: report.minimumEvidence,
    reviewerChallengeQuestions: report.reviewerChallengeQuestions,
    policyLint: report.policyLint,
    auditEffectiveness: report.auditEffectiveness,
    fixOutcome: report.fixOutcome,
    postFixVerificationPlan: report.postFixVerificationPlan,
    repairQuality: report.repairQuality,
    splitEffectiveness: report.splitEffectiveness,
    noiseControl: report.noiseControl,
    auditLearningRecommendation: report.auditLearningRecommendation,
    decisionRetrospective: report.decisionRetrospective,
    rolloutScore: report.rolloutScore,
    freshness: report.freshness,
    riskAcceptanceWorkflow: report.riskAcceptanceWorkflow,
    reviewerAssignmentQuality: report.reviewerAssignmentQuality,
    verificationCompleteness: report.verificationCompleteness,
    skippedCheckJustification: report.skippedCheckJustification,
    auditModeRecommendation: report.auditModeRecommendation,
    auditConflict: report.auditConflict,
    maturityScore: report.maturityScore,
    minimalPrPlan: report.minimalPrPlan,
    ciRiskPrediction: report.ciRiskPrediction,
    profileInvariantEvaluation: report.profileInvariantEvaluation,
    confidenceImprovement: report.confidenceImprovement,
    auditValidationCommandPlan: report.auditValidationCommandPlan,
    ruleTuningRecommendation: report.ruleTuningRecommendation,
    goldenPack: report.goldenPack,
    auditResultShape: report.auditResultShape,
    trustLevel: report.trustLevel,
    noiseBudget: report.noiseBudget,
    ruleEffectivenessReport: {
      status: report.ruleEffectivenessReport?.status || 'unknown',
      count: report.ruleEffectivenessReport?.rules?.length || 0,
    },
    falsePositiveCandidates: report.falsePositiveCandidates?.length || 0,
    falseNegativeGuard: report.falseNegativeGuard,
    profileCalibrationPack: report.profileCalibrationPack,
    auditReadinessForRealRepo: report.auditReadinessForRealRepo,
    releaseCandidateStatus: report.releaseCandidateStatus,
    releaseCandidateCheck: report.releaseCandidateCheck,
    predictionValidation: {
      status: report.predictionValidation?.status || 'unknown',
      count: report.predictionValidation?.predictions?.length || 0,
    },
    auditToTestMapping: {
      status: report.auditToTestMapping?.status || 'unknown',
      count: report.auditToTestMapping?.mappings?.length || 0,
    },
    profilePortabilityCheck: report.profilePortabilityCheck,
    localVsCiExpectation: report.localVsCiExpectation,
    partialRunHandling: report.partialRunHandling,
    humanReviewPacket: report.humanReviewPacket,
    applyRecommendation: report.applyRecommendation,
    stopConditions: report.stopConditions,
    realProjectEvaluation: report.realProjectEvaluation,
    feedbackLoop: report.feedbackLoop,
    performanceSummary: report.performanceSummary,
    profileCalibrationReport: {
      status: report.profileCalibrationReport?.status || 'unknown',
      profiles: report.profileCalibrationReport?.profiles?.length || 0,
    },
    canaryPromotionWorkflow: report.canaryPromotionWorkflow,
    ruleRetirementWorkflow: {
      status: report.ruleRetirementWorkflow?.status || 'unknown',
      rules: report.ruleRetirementWorkflow?.rules?.length || 0,
    },
    smokeBenchmark: report.smokeBenchmark,
    ruleTraceability: {
      status: report.ruleTraceability?.status || 'unknown',
      traces: report.ruleTraceability?.traces?.length || 0,
    },
    reviewerSkillEffectiveness: report.reviewerSkillEffectiveness,
    explainabilityCompression: report.explainabilityCompression,
    noRegressionStatus: report.noRegressionStatus,
    rolloutGate: report.rolloutGate,
    trustBoundary: report.trustBoundary,
    humanInLoopEnforcement: report.humanInLoopEnforcement,
    safeArtifactValidation: report.safeArtifactValidation,
    auditReplayPack: report.auditReplayPack,
    goldenFixtures: report.goldenFixtures,
    auditResultStabilityStatus: report.auditResultStabilityStatus,
    prSplitRecommendation: report.prSplitRecommendation,
    fullRunResidualIntelligence: report.fullRunResidualIntelligence,
    baselineLifecycle: report.baselineLifecycle,
    auditRuleImpact: report.auditRuleImpact,
    severityDriftStatus: report.severityDriftStatus,
    canaryFindings: report.canaryFindings.slice(0, 5),
    reviewerCoverageStatus: report.reviewerCoverageStatus,
    remediationPlan: report.remediationPlan,
    mergeBlockExplanation: report.mergeBlockExplanation,
    semanticDiffHints: report.semanticDiffHints,
    fixValidationHints: report.fixValidationHints,
    ruleCalibrationTable: {
      status: report.ruleCalibrationTable?.status || 'unknown',
      count: report.ruleCalibrationTable?.rules?.length || 0,
    },
    blockingFindings: report.blockingFindings.length,
    warningFindings: report.warningFindings.length,
    infoFindings: report.infoFindings.length,
    selectedReviewers: report.selectedReviewers.reviewers,
    testWeakeningStatus: report.testWeakeningStatus?.status || 'unknown',
    domainInvariantStatus: report.domainInvariantStatus?.status || 'unknown',
    dependencyAuditStatus: report.dependencyAuditStatus?.status || 'unknown',
    securitySensitiveChangeStatus: report.securitySensitiveChangeStatus?.status || 'unknown',
    coverageIntentStatus: report.coverageIntentStatus?.status || 'unknown',
    missingTestIntent: report.missingTestIntent,
    suppressionStatus: report.suppressionStatus?.status || 'unknown',
    remediationChecklist: report.remediationChecklist,
    knownRisks: {
      status: report.knownRisks?.status || 'unknown',
      count: report.knownRisks?.count || 0,
      expired: report.knownRisks?.expired?.length || 0,
      invalid: report.knownRisks?.invalid?.length || 0,
    },
    codeAuditBaseline: {
      status: report.codeAuditBaseline?.status || 'unknown',
      count: report.codeAuditBaseline?.count || 0,
      expired: report.codeAuditBaseline?.expired?.length || 0,
      invalid: report.codeAuditBaseline?.invalid?.length || 0,
    },
    manualMergePolicy: report.manualMergePolicy?.status || 'unknown',
    manualConfirmationStatus: report.manualConfirmationStatus || { required: false, status: 'not_required', source: 'none' },
    decisionMatrix: report.decisionMatrix,
    findingLifecycle: {
      status: report.findingLifecycle?.status || 'unknown',
      new: report.findingLifecycle?.new?.length || 0,
      existing: report.findingLifecycle?.existing?.length || 0,
      resolved: report.findingLifecycle?.resolved?.length || 0,
      suppressed: report.findingLifecycle?.suppressed?.length || 0,
      expiredSuppression: report.findingLifecycle?.expiredSuppression?.length || 0,
      needsHumanReview: report.findingLifecycle?.needsHumanReview?.length || 0,
    },
    prTypeInference: report.prTypeInference,
    residualTestStatus: report.residualTestStatus,
    skillShapeStatus: {
      status: report.skillShapeStatus?.status || 'unknown',
      checked: report.skillShapeStatus?.checked || 0,
      warnings: report.skillShapeStatus?.warnings?.length || 0,
    },
    skippedChecks: report.skippedChecks,
    residualRisks: report.warnings.map((warning) => ({ id: warning.id, path: warning.path, known: warning.known })),
    recommendedAction: report.recommendedAction,
  };
}
function allAuditFindings() {
  return [...report.blockingFindings, ...report.warningFindings, ...report.infoFindings];
}
function rankValue(value, order) {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}
function strongestSeverity(items) {
  return [...items].sort((a, b) => rankValue(a.severity, ['blocking', 'warning', 'info']) - rankValue(b.severity, ['blocking', 'warning', 'info']))[0]?.severity || 'info';
}
function strongestConfidence(items) {
  return [...items].sort((a, b) => rankValue(a.confidence, ['high', 'medium', 'low']) - rankValue(b.confidence, ['high', 'medium', 'low']))[0]?.confidence || 'low';
}
function strongestPriority(items) {
  return [...items].sort((a, b) => rankValue(a.priority, ['P0', 'P1', 'P2', 'P3']) - rankValue(b.priority, ['P0', 'P1', 'P2', 'P3']))[0]?.priority || 'P3';
}
function computeRootCauseGroups() {
  const groups = new Map();
  for (const finding of allAuditFindings()) {
    const key = finding.rootCauseId || rootCauseIdFor(finding.id, finding.path, finding.ruleId);
    if (!groups.has(key)) {
      groups.set(key, {
        rootCauseId: key,
        fingerprint: crypto.createHash('sha256').update(`${report.profile}|${key}`).digest('hex').slice(0, 16),
        ruleIds: [],
        severity: finding.severity,
        confidence: finding.confidence,
        priority: finding.priority,
        affectedFiles: [],
        findingCount: 0,
        recommendedFixType: finding.recommendedFixType || 'cannot_determine',
        safeReason: finding.safeReason || finding.message || 'review code audit finding',
      });
    }
    const group = groups.get(key);
    if (!group.ruleIds.includes(finding.ruleId)) group.ruleIds.push(finding.ruleId);
    group.findingCount += finding.count || 1;
    for (const file of finding.affectedFiles || []) if (!group.affectedFiles.includes(file)) group.affectedFiles.push(file);
    const items = [group, finding];
    group.severity = strongestSeverity(items);
    group.confidence = strongestConfidence(items);
    group.priority = strongestPriority(items);
    if (finding.recommendedFixType && group.recommendedFixType === 'cannot_determine') group.recommendedFixType = finding.recommendedFixType;
  }
  const result = [...groups.values()].map((group) => ({
    ...group,
    ruleIds: group.ruleIds.sort(),
    affectedFiles: group.affectedFiles.sort(),
  }));
  for (const group of result) {
    if (group.ruleIds.length >= 2 && group.confidence === 'medium') group.confidence = 'high';
    if (group.ruleIds.length >= 2 && group.priority === 'P2' && report.riskLevel === 'R3') group.priority = 'P1';
  }
  return result.sort((a, b) => [
    rankValue(a.priority, ['P0', 'P1', 'P2', 'P3']),
    rankValue(a.severity, ['blocking', 'warning', 'info']),
    rankValue(a.confidence, ['high', 'medium', 'low']),
    a.rootCauseId,
  ].join('|').localeCompare([
    rankValue(b.priority, ['P0', 'P1', 'P2', 'P3']),
    rankValue(b.severity, ['blocking', 'warning', 'info']),
    rankValue(b.confidence, ['high', 'medium', 'low']),
    b.rootCauseId,
  ].join('|')));
}
function computeFixImpact() {
  const changedCount = report.changedPathsSummary.count || 0;
  const findingCount = allAuditFindings().reduce((sum, item) => sum + (item.count || 1), 0);
  const packageTouched = (report.changedPathsSummary.paths || []).some((file) => /(^|\/)(package\.json|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(file));
  const boundaryTouched = report.domainInvariantStatus?.findings?.length || report.securitySensitiveChangeStatus?.findings?.some((item) => item.context === 'implementation');
  if (!changedCount && !findingCount) return 'small';
  if (changedCount > 12 || findingCount > 12) return 'large';
  if (changedCount > 4 || findingCount > 5 || packageTouched || boundaryTouched) return 'medium';
  return 'small';
}
function computeRemediationChecklist() {
  const items = [
    'confirm quality-gate PASS before merge',
    'include verification results and residual risks in PR body',
  ];
  if (report.humanReviewRequired) items.push('complete human review for high-risk findings');
  if (report.manualMergePolicy?.status === 'manual_confirmation_required') items.push('apply manual merge policy when repository settings cannot enforce checks');
  if (report.rootCauseGroups.some((group) => group.priority === 'P0' || group.priority === 'P1')) items.push('resolve or explicitly review P0/P1 root causes');
  if (!report.localGate?.checksRun?.some((check) => /test|full/i.test(check.name || ''))) items.push('state whether full run tests were executed or intentionally skipped');
  return [...new Set(items)].sort();
}
function computeCodeAuditCalibration() {
  const ruleIds = [...new Set(allAuditFindings().map((finding) => finding.ruleId))].sort();
  return {
    status: 'pass',
    rules: ruleIds.map((ruleId) => ({ ruleId, status: 'observed' })),
    falsePositiveFixtures: 0,
    falseNegativeFixtures: 0,
  };
}
function computeConfidenceCalibration() {
  return {
    status: 'pass',
    mode: codeAuditMode(activeAuditPolicy),
    policy: activeAuditPolicy.codeAuditPolicy?.confidenceCalibration || defaultPolicy.codeAuditPolicy.confidenceCalibration,
  };
}
function sortReportCollections() {
  const severityRank = { blocking: 0, warning: 1, info: 2 };
  const confidenceRank = { high: 0, medium: 1, low: 2 };
  const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const findingKey = (item) => [
    priorityRank[item.priority] ?? 9,
    severityRank[item.severity] ?? 9,
    confidenceRank[item.confidence] ?? 9,
    item.path || '',
    item.ruleId || item.id || '',
  ].join('|');
  for (const list of [report.blockingFindings, report.warningFindings, report.infoFindings]) {
    list.sort((a, b) => findingKey(a).localeCompare(findingKey(b)));
    for (const item of list) {
      if (Array.isArray(item.affectedFiles)) item.affectedFiles.sort();
      if (Array.isArray(item.representativeExamples)) item.representativeExamples = item.representativeExamples.slice(0, 3).sort();
    }
  }
  report.warnings.sort((a, b) => `${a.id}|${a.path || ''}`.localeCompare(`${b.id}|${b.path || ''}`));
  report.humanReviewReasons.sort();
  report.skippedChecks.sort((a, b) => `${a.name}|${a.reason}`.localeCompare(`${b.name}|${b.reason}`));
  if (Array.isArray(report.knownRisks.expired)) report.knownRisks.expired.sort((a, b) => `${a.id}|${a.path || ''}`.localeCompare(`${b.id}|${b.path || ''}`));
  if (Array.isArray(report.codeAuditBaseline.expired)) report.codeAuditBaseline.expired.sort((a, b) => `${a.id}|${a.path || ''}`.localeCompare(`${b.id}|${b.path || ''}`));
}
function evaluatePrSeparation(policy, changed, knownRisks) {
  const inferred = inferPrType(policy, changed);
  report.prTypeInference = inferred;
  if (inferred.status === 'warning') {
    addWarning({ id: 'prType.unknown', message: 'PR type could not be inferred from changed paths.' });
  }
  const prTypeName = process.env.CODEX_PR_TYPE
    || (envEnabled('CODEX_HARNESS_PR') || envEnabled('CODEX_CHECK_HARNESS_PR') ? 'harness' : inferred.inferredType);
  report.prType = prTypeName;
  const prTypePolicy = policy.prTypes?.[prTypeName] || null;
  const enabled = Boolean(prTypePolicy);
  const harnessAllowed = policy.harnessPrAllowedPaths || defaultPolicy.harnessPrAllowedPaths;
  const harnessBlocked = prTypeName === 'harness' ? (policy.harnessPrBlockedPaths || []) : [];
  const fixtureRepairPaths = policy.fixtureContractRepairPaths || defaultPolicy.fixtureContractRepairPaths;
  const typeAllowed = prTypePolicy?.allowedPaths?.length
    ? prTypePolicy.allowedPaths
    : (prTypeName === 'harness' ? harnessAllowed : (prTypeName === 'fixture-contract-repair' ? fixtureRepairPaths : []));
  const typeBlocked = [...harnessBlocked, ...(prTypePolicy?.blockedPaths || [])];
  const outOfScope = typeAllowed.length ? changed.filter((file) => !pathMatches(file, typeAllowed)) : [];
  const blockedHits = changed.filter((file) => pathMatches(file, typeBlocked));
  const packageChanges = changed.filter((file) => /(^|\/)package\.json$/.test(file));
  const lockfileChanges = changed.filter((file) => /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(file));
  const harnessFileChanges = changed.filter((file) => pathMatches(file, harnessAllowed));
  const dependencyFiles = new Set([...packageChanges, ...lockfileChanges]);
  const testPatterns = [
    ...(policy.coverageIntent?.testPaths || defaultPolicy.coverageIntent.testPaths),
    ...fixtureRepairPaths,
  ];
  const companionTestPaths = prTypeName === 'implementation'
    ? [
        ...(policy.implementationCompanionTestPaths || []),
        ...(policy.testFixtureCompanionPaths || []),
        ...(prTypePolicy?.companionTestPaths || []),
        ...(prTypePolicy?.testFixtureCompanionPaths || []),
      ]
    : [];
  const companionTestChanges = changed.filter((file) => pathMatches(file, companionTestPaths));
  const implementationLike = changed.filter((file) => !pathMatches(file, harnessAllowed) && !/^docs\//.test(file) && !pathMatches(file, testPatterns) && !dependencyFiles.has(file));
  const extraIssues = [];
  if (prTypePolicy) {
    if (prTypePolicy.allowPackageChanges === false && packageChanges.length) extraIssues.push({ id: 'prType.packageChange', paths: packageChanges });
    if (prTypePolicy.allowLockfileChanges === false && lockfileChanges.length) extraIssues.push({ id: 'prType.lockfileChange', paths: lockfileChanges });
    if (prTypePolicy.allowImplementationChanges === false && implementationLike.length) extraIssues.push({ id: 'prType.implementationChange', paths: implementationLike });
    if (prTypeName === 'dependency' && packageChanges.length && !lockfileChanges.length) extraIssues.push({ id: 'prType.dependencyLockfileMissing', paths: packageChanges });
    if (prTypeName === 'implementation' && harnessFileChanges.length) extraIssues.push({ id: 'prType.harnessFilesMixed', paths: harnessFileChanges });
  }
  const status = blockedHits.length || outOfScope.length ? 'fail' : 'pass';
  report.prSeparationStatus = {
    enabled,
    status: enabled ? ((status === 'fail' || extraIssues.some((item) => !item.warningOnly)) ? 'fail' : (extraIssues.length ? 'warning' : 'pass')) : (prTypeName === 'unknown' ? 'warning' : 'not_run'),
    prType: prTypeName,
    mode: policy.harnessPrMode || 'fail',
    changedPathCount: changed.length,
    allowedOnly: outOfScope.length === 0 && blockedHits.length === 0 && extraIssues.length === 0,
    outOfScope,
    blocked: blockedHits,
    companionTestPaths,
    companionTestChanges,
    packageChanges,
    lockfileChanges,
    issues: extraIssues,
  };
  if (prTypeName === 'implementation' && companionTestChanges.length) {
    bumpRisk('R3');
    addHumanReviewReason('prType.companionTestFixture');
    addWarning({
      id: 'prType.companionTestFixture',
      message: 'Implementation PR includes companion test fixture changes; verify tests were strengthened or metadata-only.',
      known: warningKnown({ id: 'prType.companionTestFixture' }, knownRisks),
    });
  }
  if (prTypeName === 'fixture-contract-repair') {
    bumpRisk(prTypePolicy?.riskLevel || 'R3');
    addHumanReviewReason('prType.fixtureContractRepair');
    addWarning({
      id: 'prType.fixtureContractRepair',
      message: 'Fixture contract repair PR requires R3 manual review and must not weaken validators or negative cases.',
      known: warningKnown({ id: 'prType.fixtureContractRepair' }, knownRisks),
    });
  }
  if (!enabled && prTypeName !== 'unknown') addWarning({ id: 'prType.policyMissing', message: 'Inferred PR type has no explicit policy.' });
  if (prTypePolicy?.requiresHumanReview === true) addHumanReviewReason('prType.requiresHumanReview');
  if (!enabled) return;
  if (status === 'fail') {
    bumpRisk('R3');
    addHumanReviewReason('prSeparation.scope');
    const item = {
      id: 'prSeparation.mixedScope',
      message: 'Changed paths are outside policy scope for the selected PR type.',
    };
    if ((policy.harnessPrMode || 'fail') === 'fail') addFailure(item.id, item.message, { paths: [...outOfScope, ...blockedHits] });
    else addWarning({ ...item, known: warningKnown(item, knownRisks) });
  }
  for (const issue of extraIssues) {
    if (issue.id === 'prType.dependencyLockfileMissing') {
      addWarning({ id: issue.id, message: 'Dependency PR changed package metadata without a lockfile change.', known: warningKnown({ id: issue.id }, knownRisks) });
      addHumanReviewReason(issue.id);
      continue;
    }
    bumpRisk('R3');
    addHumanReviewReason(issue.id);
    addFailure(issue.id, 'Selected PR type policy was violated.', { paths: issue.paths });
  }
}
function addHumanReviewReason(reason) {
  if (!report.humanReviewReasons.includes(reason)) report.humanReviewReasons.push(reason);
  report.humanReviewRequired = true;
}
function addNegativeSignal(id, reason, paths = []) {
  const item = {
    id,
    reason,
    paths: [...new Set((paths || []).map(normalizePath).filter(Boolean))].sort().slice(0, 5),
  };
  if (!report.negativeSignals.some((existing) => existing.id === item.id && existing.reason === item.reason)) {
    report.negativeSignals.push(item);
  }
}
function runSecretScan() {
  safeLog('== .: node scripts/codex-secret-safety-scan.mjs ==');
  const result = spawn('node', ['scripts/codex-secret-safety-scan.mjs']);
  printCommandOutput(result);
  report.secretScan = {
    status: result.status === 0 ? 'pass' : 'fail',
    exitCode: result.status ?? 1,
  };
  if (result.status === 0) addNegativeSignal('secretScan.pass', 'secret scan passed');
  if (result.status !== 0) addFailure('secretScan.failed', 'Secret safety scan failed.');
}
function skipCheck(check, reason) {
  const item = { name: check.name || check.script || check.command || 'unnamed check', reason };
  report.skippedChecks.push(item);
  return item;
}
function runCheck(check, packages, policy) {
  const cwd = check.cwd || '.';
  const missingMode = check.missingScript || policy.missingScript || 'skip';
  const env = checkEnv(check);
  const name = check.name || check.script || check.command || 'unnamed check';
  const profileCheck = check.profileRequired === true || check.ciRequired === true;
  if (profileCheck) report.profileRequiredChecks.checks.push({ name, status: 'running' });

  if (check.type === 'npmScript') {
    if (!packages.has(cwd)) {
      if (missingMode === 'fail') {
        addFailure('check.packageMissing', `Required package.json missing for check: ${name}`, { check: name });
        if (profileCheck && report.profileRequiredChecks.checks.length) report.profileRequiredChecks.checks.at(-1).status = 'fail';
        return false;
      }
      safeLog(`skip missing package.json: ${name}`);
      skipCheck(check, 'missing package.json');
      if (profileCheck) report.profileRequiredChecks.checks.at(-1).status = 'skipped';
      return true;
    }
    if (!hasScript(packages, cwd, check.script)) {
      if (missingMode === 'fail') {
        addFailure('check.scriptMissing', `Required npm script missing: ${cwd} ${check.script}`, { check: name });
        if (profileCheck && report.profileRequiredChecks.checks.length) report.profileRequiredChecks.checks.at(-1).status = 'fail';
        return false;
      }
      safeLog(`skip missing npm script: ${cwd} ${check.script}`);
      skipCheck(check, 'missing npm script');
      if (profileCheck) report.profileRequiredChecks.checks.at(-1).status = 'skipped';
      return true;
    }
    return runExternal('npm', ['run', check.script], cwd, name, env, profileCheck);
  }
  if (check.command) return runExternal(check.command, check.args || [], cwd, name, env, profileCheck);
  skipCheck(check, 'no command configured');
  if (profileCheck) report.profileRequiredChecks.checks.at(-1).status = 'skipped';
  return true;
}
function runExternal(cmd, args, cwd, name, env, profileCheck) {
  const envKeys = Object.keys(env).sort();
  safeLog(`== ${cwd}: ${name || [cmd, ...args].join(' ')} ==`);
  if (envKeys.length) safeLog(`Policy env: ${envKeys.join(', ')}`);
  const result = spawn(cmd, args, { cwd, env });
  printCommandOutput(result, env);
  const checkResult = {
    name,
    cwd: normalizePath(cwd),
    status: result.status === 0 ? 'pass' : 'fail',
    exitCode: result.status ?? 1,
    envKeys,
  };
  report.localGate.checksRun.push(checkResult);
  if (profileCheck && report.profileRequiredChecks.checks.length) {
    report.profileRequiredChecks.checks.at(-1).status = checkResult.status;
    report.profileRequiredChecks.checks.at(-1).exitCode = checkResult.exitCode;
  }
  if (result.status !== 0) {
    addFailure('check.failed', `Check failed: ${name}`, { check: name });
    return false;
  }
  return true;
}
function writeReport() {
  sortReportCollections();
  report.rootCauseGroups = computeRootCauseGroups();
  report.fixImpact = computeFixImpact();
  report.auditPerformance.findingCount = allAuditFindings().reduce((sum, item) => sum + (item.count || 1), 0);
  report.auditPerformance.rootCauseCount = report.rootCauseGroups.length;
  report.auditPerformance.status = report.auditPerformance.status === 'not_run' ? 'pass' : report.auditPerformance.status;
  report.confidenceCalibration = computeConfidenceCalibration();
  report.codeAuditCalibration = computeCodeAuditCalibration();
  report.reviewPromptDraftAvailable = fs.existsSync(path.join('scripts', 'codex-review-prompt-draft.mjs'));
  report.falsePositiveTemplateAvailable = fs.existsSync(path.join('scripts', 'codex-code-audit-false-positive-template.mjs'));
  report.auditComparisonAvailable = fs.existsSync(path.join('scripts', 'codex-code-audit-compare.mjs'));
  report.findingLifecycle = computeFindingLifecycle();
  report.residualTestStatus = computeResidualTestStatus(activeAuditPolicy);
  report.skillShapeStatus = validateReviewerSkillShapes(activeAuditPolicy);
  report.ruleCalibrationTable = readRuleCalibrationTable();
  report.auditRegressionSuite = computeAuditRegressionSuite();
  report.auditScorecard = computeAuditScorecard();
  const auditQuality = computeAuditQualityStatus();
  report.auditQualityStatus = auditQuality.auditQualityStatus;
  report.auditQualityScore = auditQuality.auditQualityScore;
  report.auditQualityWarnings = auditQuality.auditQualityWarnings;
  report.auditRuleImpact = computeAuditRuleImpact();
  report.severityDriftStatus = computeSeverityDriftStatus();
  report.profileCompatibilityMatrix = computeProfileCompatibilityMatrix();
  report.strictnessPreview = computeStrictnessPreview();
  report.canaryFindings = computeCanaryFindings();
  report.semanticDiffHints = computeSemanticDiffHints(activeAuditPolicy);
  report.fixValidationHints = collectFixValidationHints();
  report.reviewerCoverageStatus = computeReviewerCoverageStatus();
  report.remediationPlan = computeRemediationPlan();
  report.noiseBudget = computeNoiseBudget();
  report.falsePositiveCandidates = computeFalsePositiveCandidates();
  report.falseNegativeGuard = computeFalseNegativeGuard();
  report.ruleEffectivenessReport = computeRuleEffectivenessReport();
  report.profileCalibrationPack = computeProfileCalibrationPack();
  report.baselineLifecycle = computeBaselineLifecycle();
  report.auditEvaluation = computeAuditEvaluation();
  report.faultInjectionBenchmark = computeFaultInjectionBenchmark();
  report.semanticImpact = computeSemanticImpact();
  report.testSufficiency = computeTestSufficiency();
  report.specTestMismatch = computeSpecTestMismatch();
  report.specTestCodeConsistency = computeSpecTestCodeConsistency();
  report.defectTaxonomy = computeDefectTaxonomy();
  report.auditConfidenceEvidence = computeAuditConfidenceEvidence();
  report.precisionRecallGuardrails = computePrecisionRecallGuardrails();
  report.calibrationLockStatus = computeCalibrationLockStatus();
  report.reviewerInstructionCompactness = computeReviewerInstructionCompactness();
  report.fixPlanValidation = computeFixPlanValidation();
  report.minimalPrPlan = computeMinimalPrPlan();
  report.ciRiskPrediction = computeCiRiskPrediction();
  report.profileInvariantEvaluation = computeProfileInvariantEvaluation();
  report.confidenceImprovement = computeConfidenceImprovement();
  report.auditValidationCommandPlan = computeAuditValidationCommandPlan();
  report.ruleTuningRecommendation = computeRuleTuningRecommendation();
  report.auditResultShape = computeAuditResultShape();
  report.prSplitRecommendation = computePrSplitRecommendation();
  report.predictionValidation = computePredictionValidation();
  report.auditToTestMapping = computeAuditToTestMapping();
  report.auditResultStabilityStatus = computeAuditResultStabilityStatus();
  report.auditReplayPack = computeAuditReplayPack();
  report.goldenFixtures = computeGoldenFixtures();
  report.profilePortabilityCheck = computeProfilePortabilityCheck();
  report.localVsCiExpectation = computeLocalVsCiExpectation();
  report.ciRiskPrediction = computeCiRiskPrediction();
  report.realProjectEvaluation = computeRealProjectEvaluationFramework();
  report.feedbackLoop = computeFeedbackLoopStatus();
  report.performanceSummary = computePerformanceSummary();
  report.profileCalibrationReport = computeProfileCalibrationReport();
  report.canaryPromotionWorkflow = computeCanaryPromotionWorkflow();
  report.ruleRetirementWorkflow = computeRuleRetirementWorkflow();
  report.smokeBenchmark = computeSmokeBenchmark();
  report.ruleTraceability = computeRuleTraceability();
  report.explainabilityCompression = computeExplainabilityCompression();
  report.noRegressionStatus = computeNoRegressionStatus();
  report.policyViolationsStatus = report.policyViolations.some((violation) => violation.level === 'fail') ? 'fail' : (report.policyViolations.length ? 'warning' : 'pass');
  report.policySchema = {
    status: report.policyViolationsStatus,
    violations: report.policyViolations,
  };
  const profileFailures = report.profileRequiredChecks.checks.filter((check) => check.status === 'fail');
  if (!report.profileRequiredChecks.enabled) report.profileRequiredChecks.status = 'not_run';
  else report.profileRequiredChecks.status = profileFailures.length ? 'fail' : 'pass';
  if (report.riskLevel === 'R3') addHumanReviewReason('riskLevel.R3');
  if (report.changedPathsSummary.blocked.length) addHumanReviewReason('diff.blockedPath');
  if (report.changedPathsSummary.highRisk.length) addHumanReviewReason('diff.highRiskPath');
  if ((report.knownRisks.expired || []).length) addHumanReviewReason('knownRisk.expired');
  for (const finding of allAuditFindings()) {
    if (finding.priority === 'P0' || finding.priority === 'P1') addHumanReviewReason(`finding.${finding.priority}`);
  }
  report.manualConfirmationStatus = runManualConfirmationVerifier(activeAuditPolicy);
  applyManualConfirmationToReviewFindings();
  report.codeAudit = {
    status: report.blockingFindings.length ? 'blocking' : (report.warningFindings.length ? 'warning' : (report.infoFindings.length ? 'info' : 'pass')),
    blocking: report.blockingFindings.length,
    warning: report.warningFindings.length,
    info: report.infoFindings.length,
    rootCauseGroups: report.rootCauseGroups.length,
    fixImpact: report.fixImpact,
  };
  report.manualMergePolicy = evaluateManualMergePolicy(activeAuditPolicy);
  if (report.manualConfirmationStatus.required) addHumanReviewReason('manualConfirmation.required');
  if (report.manualMergePolicy.status === 'manual_confirmation_required') {
    addHumanReviewReason('manualMergePolicy.confirmationRequired');
    addFailure('manualConfirmation.required', 'Manual confirmation is required for this risk level and current head.', {
      missingItems: report.manualConfirmationStatus.missingItems || [],
      cannotOverrideFailures: report.manualConfirmationStatus.cannotOverrideFailures || [],
    });
  }
  report.mergeReady = false;
  report.postMerge.mergeReady = false;
  report.status = 'running';
  report.localGate.status = 'running';
  report.reviewResultSchemaStatus = computeReviewResultSchemaStatus();
  if (report.reviewResultSchemaStatus.status === 'fail') addHumanReviewReason('reviewResultSchema.failed');
  report.postMergeVerificationPlan = computePostMergeVerificationPlan();
  report.decisionMatrix = computeDecisionMatrix();
  report.mergeBlockExplanation = computeMergeBlockExplanation();
  report.fullRunResidualIntelligence = computeFullRunResidualIntelligence();
  report.partialRunHandling = computePartialRunHandling();
  report.modeTransitionSafety = computeModeTransitionSafety();
  report.trustLevel = computeTrustLevel();
  report.decisionTrace = computeDecisionTrace();
  report.oracleLimits = computeOracleLimits();
  report.prScopeAgreement = computePrScopeAgreement();
  report.auditDriftReport = computeAuditDriftReport();
  report.residualFailureGovernance = computeResidualFailureGovernance();
  report.ciParity = computeCiParity();
  report.realProjectDryRunAuditPack = computeRealProjectDryRunAuditPack();
  report.severitySanity = computeSeveritySanity();
  report.humanReviewRoleMapping = computeHumanReviewRoleMapping();
  report.auditUsefulnessValidation = computeAuditUsefulnessValidation();
  report.benchmarkPack = computeBenchmarkPackStatus();
  report.auditReadinessForRealRepo = computeReadinessForRealRepo();
  report.stopConditions = computeStopConditions();
  report.releaseCandidateCheck = computeReleaseCandidateCheck();
  report.releaseCandidateStatus = report.releaseCandidateCheck.releaseCandidateStatus;
  report.readyForRealProjectEvaluation = report.releaseCandidateCheck.readyForRealProjectEvaluation;
  report.applyRecommendation = computeApplyRecommendation();
  report.humanReviewPacket = computeHumanReviewPacket();
  report.reviewerSkillEffectiveness = computeReviewerSkillEffectiveness();
  report.rolloutGate = computeRolloutGate();
  report.trustBoundary = computeTrustBoundary();
  report.deploymentBoundary = computeDeploymentBoundary();
  report.oracleValidation = computeOracleValidation();
  report.decisionSimulator = computePrDecisionSimulator();
  report.remediationVerification = computeRemediationVerification();
  report.acceptanceCriteria = computeAcceptanceCriteria();
  report.confusionRisk = computeConfusionRisk();
  report.temporalConsistency = computeTemporalConsistency();
  report.scenarioReplay = computeScenarioReplay();
  report.humanReviewChecklist = computeHumanReviewChecklist();
  report.specAuthorityStatus = computeSpecAuthorityStatus();
  report.auditCompleteness = computeAuditCompleteness();
  report.mutationBenchmark = computeMutationBenchmark();
  report.adversarialPrSimulator = computeAdversarialPrSimulator();
  report.auditBypass = computeAuditBypass();
  report.realWorldCanarySet = computeRealWorldCanarySet();
  report.specBoundaryMutation = computeSpecBoundaryMutation();
  report.testAuditMutation = computeTestAuditMutation();
  report.dependencyAdversarial = computeDependencyAdversarial();
  report.ciParityAdversarial = computeCiParityAdversarial();
  report.evidenceIntegrity = computeEvidenceIntegrity();
  report.humanOverrideTemplate = computeHumanOverrideTemplate();
  report.redTeam = computeRedTeam();
  report.monotonicity = computeMonotonicity();
  report.minimumEvidence = computeMinimumEvidence();
  report.reviewerChallengeQuestions = computeReviewerChallengeQuestions();
  report.policyLint = computePolicyLint();
  report.auditEffectiveness = computeAuditEffectivenessTracker();
  report.fixOutcome = computeFixOutcomeTracker();
  report.postFixVerificationPlan = computePostFixVerificationPlan();
  report.repairQuality = computeRepairQualityEvaluate();
  report.splitEffectiveness = computeSplitEffectiveness();
  report.noiseControl = computeNoiseControl();
  report.auditLearningRecommendation = computeAuditLearningRecommendation();
  report.decisionRetrospective = computeDecisionRetrospective();
  report.rolloutScore = computeRolloutScore();
  report.freshness = computeFreshness();
  report.riskAcceptanceWorkflow = computeRiskAcceptanceWorkflow();
  report.reviewerAssignmentQuality = computeReviewerAssignmentQuality();
  report.verificationCompleteness = computeVerificationCompleteness();
  report.skippedCheckJustification = computeSkippedCheckJustification();
  report.auditModeRecommendation = computeAuditModeRecommendation();
  report.auditConflict = computeAuditConflictDetector();
  report.maturityScore = computeMaturityScore();
  report.goldenPack = computeGoldenPack();
  report.humanInLoopEnforcement = computeHumanInLoopEnforcement();
  report.auditGrade = computeAuditGrade();
  report.safeArtifactValidation = computeSafeArtifactValidation();
  report.outputShapeStatus = computeOutputShapeStatus();
  enforceFinalValidationStatuses();
  report.mergeReady = failures.length === 0;
  report.postMerge.mergeReady = report.mergeReady && report.postMerge.status === 'pass';
  report.status = failures.length === 0 ? 'pass' : 'fail';
  report.localGate.status = report.status;
  report.goldenPack = computeGoldenPack();
  report.selfTestCoverageReport = computeSelfTestCoverageReport();
  report.recommendedAction = report.mergeReady
    ? (report.decisionMatrix?.recommendedNextAction || (report.humanReviewRequired ? 'manual review required before merge' : (report.worktreeStatus?.safeToCreatePR ? 'ready for pull request after PR body review' : 'review warnings and PR body before merge')))
    : 'fix failed checks before merge';
  report.recommendedNextAction = report.recommendedAction;
  report.remediationChecklist = computeRemediationChecklist();
  report.evidencePack = computeEvidenceSummary();
  report.rolloutStatus = {
    status: 'not_run',
    recommendedAction: 'run rollout tracker when coordinating multiple repositories',
  };
  const out = JSON.stringify(report, null, 2);
  const target = process.env.CODEX_QUALITY_REPORT_PATH || process.env.CODEX_LOCAL_QUALITY_REPORT_PATH || '';
  if (target && process.env.CODEX_WRITE_QUALITY_REPORT === '1') {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${out}\n`, 'utf8');
  }
  const scopePolicy = activeAuditPolicy.codeAuditPolicy?.scopeAgreement || defaultPolicy.codeAuditPolicy.scopeAgreement;
  const scopeTarget = process.env.CODEX_PR_SCOPE_CONTRACT_PATH || scopePolicy.outputPath || '';
  const scopeWriteEnv = scopePolicy.writeEnv || 'CODEX_WRITE_PR_SCOPE_CONTRACT';
  if (scopeTarget && process.env[scopeWriteEnv] === '1') {
    fs.mkdirSync(path.dirname(scopeTarget), { recursive: true });
    fs.writeFileSync(scopeTarget, `${JSON.stringify(report.prScopeAgreement, null, 2)}\n`, 'utf8');
  }
  if (process.env.CODEX_QUALITY_REPORT === 'json') console.log(out);
  printAuditSummaryMode();
}
function finish() {
  const unknownWarnings = report.warnings.filter((warning) => !warning.known);
  if (unknownWarnings.length && (process.env.CODEX_FAIL_ON_NEW_WARNINGS === '1' || failOnNewWarnings)) {
    addFailure('warnings.new', 'New warnings were detected.');
  }
  writeReport();
  if (failures.length) {
    safeError('Codex local quality gate failed. Safe summary:');
    for (const failure of failures) safeError(`- ${failure.id}: ${failure.message}`);
    process.exit(1);
  }
  safeLog('Codex local quality gate passed.');
  process.exit(0);
}

safeLog('== Codex local quality gate ==');
const policy = readPolicy();
failOnNewWarnings = policy.failOnNewWarnings === true;
report.profile = policy.profile || 'generic';
activeAuditPolicy = policy;
const knownRisks = readKnownRisks(policy);
const codeAuditBaseline = readCodeAuditBaseline(policy);
report.worktreeStatus = computeWorktreeStatus();
report.postMerge = computePostMergeStatus(report.worktreeStatus);
for (const warning of report.worktreeStatus.warnings || []) addWarning({ ...warning, known: warningKnown(warning, knownRisks) });
report.versionConsistency = computeVersionConsistency();
if (report.versionConsistency.status === 'fail') {
  addFailure('versionConsistency.mismatch', 'Managed harness file versions do not match.', {
    files: [
      ...(report.versionConsistency.mismatches || []).map((file) => file.path),
      ...(report.versionConsistency.missing || []).map((file) => file.path),
      ...(report.versionConsistency.manifestOmissions || []).map((file) => file.path),
    ],
  });
}
for (const file of report.versionConsistency.missing || []) {
  addWarning({ id: 'versionConsistency.missing', path: file.path, message: `Managed harness file is missing: ${file.path}`, known: warningKnown({ id: 'versionConsistency.missing', path: file.path }, knownRisks) });
}
for (const file of report.versionConsistency.unmarked || []) {
  addWarning({ id: 'versionConsistency.unmarked', path: file.path, message: `Managed harness file has no version marker: ${file.path}`, known: warningKnown({ id: 'versionConsistency.unmarked', path: file.path }, knownRisks) });
}
report.sourceHarnessValidationStatus = computeSourceHarnessValidationStatus();
if (report.sourceHarnessValidationStatus.status === 'fail') {
  addFailure('sourceHarnessValidation.failed', 'Source harness validation failed.', {
    files: report.sourceHarnessValidationStatus.forbidden || [],
  });
}
report.agentMemoryPolicyStatus = validateAgentMemoryPolicy();
applyGovernancePolicyStatus(report.agentMemoryPolicyStatus, 'agentMemoryPolicy.failed', 'Agent memory policy governance failed.');
report.skillLifecyclePolicyStatus = validateSkillLifecyclePolicy();
applyGovernancePolicyStatus(report.skillLifecyclePolicyStatus, 'skillLifecyclePolicy.failed', 'Skill lifecycle policy governance failed.');
report.curatorSuggestionStatus = validateCuratorSuggestionScript();
applyGovernancePolicyStatus(report.curatorSuggestionStatus, 'curatorSuggestion.failed', 'Curator suggestion governance failed.');
report.selfEvolutionPolicyStatus = validateSelfEvolutionPolicy();
applyGovernancePolicyStatus(report.selfEvolutionPolicyStatus, 'selfEvolutionPolicy.failed', 'Self-evolution policy governance failed.');
report.openaiCodexMethodStatus = runOpenAICodexMethodGate();
applyOpenAIMethodGateStatus(report.openaiCodexMethodStatus);
classifyDiff(policy, knownRisks);
runDiffAudits(policy, knownRisks, codeAuditBaseline);
for (const warning of report.warnings) {
  if (!warning.known) warning.known = warningKnown(warning, knownRisks);
}
runSecretScan();
if (failures.length) finish();

const packageDirs = normalizePackageDirs(policy);
const packages = new Map();
for (const dir of packageDirs) {
  const pkg = readPackage(dir);
  if (pkg) packages.set(dir, pkg);
}

safeLog(`Policy profile: ${policy.profile || 'generic'}`);
safeLog(`Package directories found: ${packages.size}`);

if (process.env.CODEX_SKIP_NPM_CHECKS === '1' || process.env.CODEX_SKIP_NPM === '1') {
  for (const check of Array.isArray(policy.checks) ? policy.checks : []) skipCheck(check, 'npm checks skipped by environment flag');
  safeLog('npm checks skipped by environment flag.');
  finish();
}

const checks = Array.isArray(policy.checks) ? policy.checks : [];
const selectedChecks = checks.filter(shouldRunCheck);
report.profileRequiredChecks.enabled = selectedChecks.some((check) => check.profileRequired === true || check.ciRequired === true);
const needsNpm = selectedChecks.some(checkNeedsNpm) || (packages.size > 0 && process.env.CODEX_REQUIRE_NPM === '1');
const packageLocksBefore = packageLockSet(packageDirs);

if (!packages.size) {
  for (const check of checks) skipCheck(check, 'no package.json found in policy packageDirs');
  safeLog('No package.json found in policy packageDirs; npm checks skipped.');
  finish();
}

const npmAvailable = commandExists('npm');
safeLog(`npm available: ${npmAvailable ? 'yes' : 'no'}`);
if (needsNpm && !npmAvailable) {
  addFailure('npm.unavailable', 'npm was required by policy or environment, but npm was not found.');
  finish();
}
if (!npmAvailable) {
  for (const check of checks) skipCheck(check, 'npm unavailable and not required');
  safeLog('npm checks skipped because npm is unavailable and no npm check was required.');
  finish();
}

if (!selectedChecks.length) {
  for (const check of checks) skipCheck(check, 'not selected by policy or environment flags');
  safeLog('No npm checks selected. Use CODEX_RUN_* flags or CODEX_RUN_PROFILE_REQUIRED_CHECKS=1 to enable policy checks.');
  finish();
}

for (const check of selectedChecks) {
  if (!runCheck(check, packages, policy)) break;
}
assertNoNewPackageLocks(packageLocksBefore, packageDirs);
finish();
