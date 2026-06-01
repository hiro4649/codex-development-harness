#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { HARNESS_VERSION } from './codex-v080-lib.mjs';

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
    reviewedItems: [`v${HARNESS_VERSION} core gate`],
    residualRisks: ['downstream propagation separate'],
    qualityGateNotWeakened: true,
    riskLevelNotLowered: true,
    nonOverridableFailuresAcknowledged: true,
  };
  const evidence = {
    codexEvidencePack: {
      schemaVersion: HARNESS_VERSION,
      harnessVersion: HARNESS_VERSION,
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
    `v${HARNESS_VERSION} source harness test.`,
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
    '<!-- CODEX_QUALITY_HARNESS_BEGIN -->',
    'CODEX_QUALITY_HARNESS_FILE v1.0.3',
    '',
    '## Source Harness Boundary',
    'This repository uses harness-managed checks only.',
    '',
    '## Plan-First Rule',
    'Use plan-first for risky or ambiguous work.',
    '',
    '## Safe Output Rule',
    'Use safe summary only. Do not output endpoint values.',
    '',
    '## Merge-Ready Claim Rule',
    'Do not claim merge-ready without current-head evidence.',
    '',
    '## Manual Confirmation Limit',
    'Manual confirmation cannot override non-overridable failures.',
    '',
    '## Profile/Core Separation',
    'Core mode does not require source profiles.',
    '',
    '<!-- CODEX_QUALITY_HARNESS_END -->',
    '',
  ].join('\n');
}

export function mojibakeAgentsContext() {
  return `${cleanAgentsContext()}\u9b2f\u9b2e\u9a5b\u90e2\n`;
}

export function sourceManifest(profileCompatibility = 'optional') {
  return {
    marker: `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`,
    harnessVersion: HARNESS_VERSION,
    sourceHarnessVersion: HARNESS_VERSION,
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
    schemaVersion: HARNESS_VERSION,
    eventId: 'evt1',
    timestamp: '2026-05-23T00:00:00Z',
    harnessVersion: HARNESS_VERSION,
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
