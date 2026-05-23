#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.8.0

export const GOLDEN_HEAD = '1111111111111111111111111111111111111111';
export const GOLDEN_BASE = '2222222222222222222222222222222222222222';

export function buildStructuredEvidencePrBody(options = {}) {
  const currentHead = options.headSha || GOLDEN_HEAD;
  const evidenceHead = options.omitEvidenceHead ? undefined : (options.evidenceHeadSha || currentHead);
  const manualHead = options.manualHeadSha || currentHead;
  const confirmation = options.omitHumanConfirmation ? null : {
    target: 'pull_request',
    repository: 'owner/repo',
    prNumber: 1,
    headSha: manualHead,
    riskLevel: 'R3',
    confirmedByRole: options.omitManualRole ? undefined : 'project-owner',
    confirmedAt: '2026-05-23T00:00:00Z',
    reviewedItems: ['v0.8.0 core gate'],
    residualRisks: ['downstream propagation separate'],
    qualityGateNotWeakened: true,
    riskLevelNotLowered: true,
    nonOverridableFailuresAcknowledged: true,
  };
  const evidence = {
    codexEvidencePack: {
      schemaVersion: '0.8.0',
      harnessVersion: '0.8.0',
      repository: 'owner/repo',
      prNumber: 1,
      headSha: evidenceHead,
      baseSha: GOLDEN_BASE,
      changeType: 'source-harness',
      riskLevel: 'R3',
      scope: {
        changedFiles: ['AGENTS.md'],
        allowedPaths: ['AGENTS.md'],
        forbiddenPaths: ['profiles/'],
      },
      commands: [
        {
          name: 'node scripts/codex-v080-self-test.mjs',
          result: 'pass',
          exitCode: 0,
          source: 'local',
          date: '2026-05-23',
        },
      ],
      remoteRuns: [
        {
          provider: 'github-actions',
          workflow: 'quality-gate',
          conclusion: 'pass',
          headSha: evidenceHead || currentHead,
          source: 'GitHub Actions',
          date: '2026-05-23',
        },
      ],
      residualRisks: ['downstream propagation separate'],
      productionClaims: {
        claimsRuntimeReady: false,
        claimsDeploymentReady: false,
        claimsMergeReady: false,
      },
      rollbackOrStopCondition: 'Stop if gate fails.',
      humanConfirmation: confirmation,
      safeOutput: { status: 'pass', unsafeFindings: [] },
    },
  };
  const manual = { codexManualConfirmation: confirmation };
  return [
    '## Goal',
    'v0.8.0 source harness test.',
    '## Risk level',
    'R3',
    options.profileRequired ? 'profile_required_fixture' : 'profile optional fixture',
    `Head SHA: ${currentHead}`,
    'Best of N Evidence: candidate count 2; selected candidate generic core; reason selected safer; reason rejected alternatives too broad.',
    'BEGIN_CODEX_EVIDENCE_PACK_JSON',
    JSON.stringify(evidence),
    'END_CODEX_EVIDENCE_PACK_JSON',
    'BEGIN_CODEX_MANUAL_CONFIRMATION_JSON',
    JSON.stringify(manual),
    'END_CODEX_MANUAL_CONFIRMATION_JSON',
  ].join('\n');
}

export function cleanAgentsContext() {
  return [
    'source harness boundary',
    'plan-first',
    'safe output',
    'merge-ready claim',
    'manual confirmation',
    'profile/core separation',
    '',
  ].join('\n');
}

export function mojibakeAgentsContext() {
  return `${cleanAgentsContext()}驍ｵ・ｺ\n`;
}

export function sourceManifest(profileCompatibility = 'optional') {
  return {
    marker: 'CODEX_QUALITY_HARNESS_FILE v0.8.0',
    harnessVersion: '0.8.0',
    sourceHarnessVersion: '0.8.0',
    profileTemplateVersion: '0.7.0',
    compatibleProfileTemplateVersions: ['0.7.0'],
    genericCore: {
      mode: 'core',
      profileCompatibility,
      profileTemplateRequiredForCore: false,
    },
    managedFiles: [
      'CODEX_SOURCE_HARNESS_MANIFEST.json',
      'scripts/codex-local-quality-gate.mjs',
      '.github/workflows/quality-gate.yml',
      '.github/workflows/weekly-health-check.yml',
    ],
    policyFiles: [],
    scriptNames: [],
  };
}

export function safeTraceEvent(overrides = {}) {
  return {
    schemaVersion: '0.8.0',
    eventId: 'evt1',
    timestamp: '2026-05-23T00:00:00Z',
    harnessVersion: '0.8.0',
    eventType: 'gate',
    riskLevel: 'R3',
    commandClass: 'node',
    targetArea: 'scripts',
    result: 'pass',
    exitCode: 0,
    durationMs: 1,
    failureReasonCode: '',
    safeSummary: 'pass',
    unsafeContentRemoved: true,
    rawValuesStored: false,
    ...overrides,
  };
}

export function curatorReport(overrides = {}) {
  return {
    autoApply: false,
    autoCommit: false,
    autoPush: false,
    actions: [{ action: 'keep', safeSummary: 'No action.' }],
    ...overrides,
  };
}

export function offlineEvolutionProposal(overrides = {}) {
  return {
    targetFile: 'AGENTS.md',
    sourceSignals: ['golden_set'],
    candidateAction: 'patch_candidate',
    expectedImprovement: 'safer context',
    constraints: ['safe summary only'],
    goldenSetStatus: 'pass',
    humanApprovalRequired: true,
    autoApply: false,
    autoCommit: false,
    autoPush: false,
    ...overrides,
  };
}
