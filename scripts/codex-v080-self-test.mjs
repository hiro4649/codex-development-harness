#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.8.0
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, writeJsonReport } from './codex-v080-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(here);
const head = '1111111111111111111111111111111111111111';
const base = '2222222222222222222222222222222222222222';

export function buildGenericCase(options = {}) {
  const currentHead = options.headSha || head;
  const evidence = {
    codexEvidencePack: {
      schemaVersion: '0.8.0',
      harnessVersion: '0.8.0',
      repository: 'owner/repo',
      prNumber: 1,
      headSha: options.omitHead ? undefined : currentHead,
      baseSha: base,
      changeType: 'source-harness',
      riskLevel: 'R3',
      scope: { changedFiles: ['AGENTS.md'], allowedPaths: ['AGENTS.md'], forbiddenPaths: ['profiles/'] },
      commands: [{ name: 'node scripts/codex-v080-self-test.mjs', result: 'pass', exitCode: 0, source: 'local', date: '2026-05-23' }],
      remoteRuns: [{ source: 'GitHub Actions', result: 'pass', date: '2026-05-23', headShaStatus: 'matched' }],
      residualRisks: ['downstream propagation separate'],
      productionClaims: { claimsRuntimeReady: false, claimsDeploymentReady: false, claimsMergeReady: false },
      rollbackOrStopCondition: 'Stop if gate fails.',
      humanConfirmation: {
        target: 'pull_request',
        repository: 'owner/repo',
        prNumber: 1,
        headSha: currentHead,
        riskLevel: 'R3',
        confirmedByRole: options.omitRole ? undefined : 'project-owner',
        confirmedAt: '2026-05-23T00:00:00Z',
        reviewedItems: ['v0.8.0 core gate'],
        residualRisks: ['downstream propagation separate'],
        qualityGateNotWeakened: true,
        riskLevelNotLowered: true,
        nonOverridableFailuresAcknowledged: true,
      },
      safeOutput: { status: 'pass' },
    },
  };
  const manual = { codexManualConfirmation: evidence.codexEvidencePack.humanConfirmation };
  return [
    '## Goal:',
    'v0.8.0 source harness test.',
    '## Risk level: R3',
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

function runScript(script, options = {}) {
  const result = spawnSync(process.execPath, [path.join(repo, script), '--json'], {
    cwd: options.cwd || repo,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch {
    parsed = null;
  }
  return { status: result.status, parsed };
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function assertCase(name, condition, failures, cases, status = condition ? 'pass' : 'fail') {
  cases.push({ name, status });
  if (!condition) failures.push(name);
}

function buildReport() {
  const failures = [];
  const cases = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v080-'));

  write(path.join(tmp, 'AGENTS.md'), 'source harness boundary\nplan-first\nsafe output\nmerge-ready claim\nmanual confirmation\nprofile/core separation\n邵ｺ');
  let result = runScript('scripts/codex-agents-context-gate.mjs', { cwd: tmp });
  assertCase('AGENTS mojibake fails', result.parsed?.agentsContextStatus?.status === 'fail', failures, cases, result.parsed?.agentsContextStatus?.status);

  write(path.join(tmp, 'AGENTS.md'), 'source harness boundary\nplan-first\nsafe output\nmerge-ready claim\nmanual confirmation\nprofile/core separation\n');
  result = runScript('scripts/codex-agents-context-gate.mjs', { cwd: tmp });
  assertCase('AGENTS clean context passes', result.parsed?.agentsContextStatus?.status === 'pass', failures, cases, result.parsed?.agentsContextStatus?.status);

  const manifest = { marker, harnessVersion: HARNESS_VERSION, sourceHarnessVersion: HARNESS_VERSION, profileTemplateVersion: '0.7.0', compatibleProfileTemplateVersions: ['0.7.0'], genericCore: { profileCompatibility: 'optional' } };
  write(path.join(tmp, 'CODEX_SOURCE_HARNESS_MANIFEST.json'), JSON.stringify(manifest));
  for (const file of ['scripts/codex-local-quality-gate.mjs', '.github/workflows/quality-gate.yml', '.github/workflows/weekly-health-check.yml']) {
    write(path.join(tmp, file), '// core file');
  }
  result = runScript('scripts/codex-generic-harness-core-gate.mjs', { cwd: tmp, env: { CODEX_HARNESS_MODE: 'core', CODEX_PROFILE_COMPAT_MODE: 'on' } });
  assertCase('Generic core fails when profiles are required in core mode', result.parsed?.genericHarnessCoreStatus?.status === 'fail', failures, cases, result.parsed?.genericHarnessCoreStatus?.status);
  result = runScript('scripts/codex-generic-harness-core-gate.mjs', { cwd: tmp, env: { CODEX_HARNESS_MODE: 'core', CODEX_PROFILE_COMPAT_MODE: 'optional' } });
  assertCase('Generic core passes when profiles are optional', result.parsed?.genericHarnessCoreStatus?.status === 'pass', failures, cases, result.parsed?.genericHarnessCoreStatus?.status);

  result = runScript('scripts/codex-golden-set-gate.mjs');
  assertCase('Golden Set positive and negative fixtures pass', result.parsed?.goldenSetStatus?.status === 'pass', failures, cases, result.parsed?.goldenSetStatus?.status);

  result = runScript('scripts/codex-safe-trace-schema-gate.mjs', { cwd: tmp });
  assertCase('Safe trace absent returns not_applicable', result.parsed?.safeTraceSchemaStatus?.status === 'not_applicable', failures, cases, result.parsed?.safeTraceSchemaStatus?.status);
  const traceDir = path.join(tmp, '.codex', 'experience', 'traces');
  const validTrace = { schemaVersion: '0.8.0', eventId: 'evt1', timestamp: '2026-05-23T00:00:00Z', harnessVersion: '0.8.0', eventType: 'gate', riskLevel: 'R3', commandClass: 'node', targetArea: 'scripts', result: 'pass', exitCode: 0, durationMs: 1, failureReasonCode: '', safeSummary: 'pass', unsafeContentRemoved: true, rawValuesStored: false };
  write(path.join(traceDir, 'valid.jsonl'), `${JSON.stringify(validTrace)}\n`);
  result = runScript('scripts/codex-safe-trace-schema-gate.mjs', { cwd: tmp });
  assertCase('Safe trace valid fixture passes', result.parsed?.safeTraceSchemaStatus?.status === 'pass', failures, cases, result.parsed?.safeTraceSchemaStatus?.status);
  write(path.join(traceDir, 'valid.jsonl'), `${JSON.stringify({ ...validTrace, rawValuesStored: true })}\n`);
  result = runScript('scripts/codex-safe-trace-schema-gate.mjs', { cwd: tmp });
  assertCase('Safe trace unsafe fixture fails', result.parsed?.safeTraceSchemaStatus?.status === 'fail', failures, cases, result.parsed?.safeTraceSchemaStatus?.status);
  fs.rmSync(path.join(tmp, '.codex'), { recursive: true, force: true });

  result = runScript('scripts/codex-curator-report-gate.mjs', { cwd: tmp });
  assertCase('Curator report absent returns not_applicable', result.parsed?.curatorReportStatus?.status === 'not_applicable', failures, cases, result.parsed?.curatorReportStatus?.status);
  write(path.join(tmp, '.codex', 'curator-report.json'), JSON.stringify({ autoApply: true, actions: [{ action: 'keep' }] }));
  result = runScript('scripts/codex-curator-report-gate.mjs', { cwd: tmp });
  assertCase('Curator report with autoApply true fails', result.parsed?.curatorReportStatus?.status === 'fail', failures, cases, result.parsed?.curatorReportStatus?.status);
  fs.rmSync(path.join(tmp, '.codex'), { recursive: true, force: true });

  result = runScript('scripts/codex-offline-evolution-proposal-gate.mjs', { cwd: tmp });
  assertCase('Offline proposal absent returns not_applicable', result.parsed?.offlineEvolutionProposalStatus?.status === 'not_applicable', failures, cases, result.parsed?.offlineEvolutionProposalStatus?.status);
  write(path.join(tmp, '.codex', 'offline-evolution-proposal.json'), JSON.stringify({ targetFile: 'AGENTS.md', sourceSignals: [], candidateAction: 'patch_candidate', expectedImprovement: 'safe', constraints: [], goldenSetStatus: 'pass', humanApprovalRequired: true, autoCommit: true }));
  result = runScript('scripts/codex-offline-evolution-proposal-gate.mjs', { cwd: tmp });
  assertCase('Offline proposal with autoCommit true fails', result.parsed?.offlineEvolutionProposalStatus?.status === 'fail', failures, cases, result.parsed?.offlineEvolutionProposalStatus?.status);

  result = runScript('scripts/codex-best-of-n-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'Risk level: R3' } });
  assertCase('Best of N required missing evidence fails for R3', result.parsed?.bestOfNEvidenceStatus?.status === 'fail', failures, cases, result.parsed?.bestOfNEvidenceStatus?.status);
  result = runScript('scripts/codex-best-of-n-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'Risk level: R1\ndocs-only change' } });
  assertCase('Best of N not required for docs-only change passes or not_applicable', ['pass', 'not_applicable'].includes(result.parsed?.bestOfNEvidenceStatus?.status), failures, cases, result.parsed?.bestOfNEvidenceStatus?.status);

  result = runScript('scripts/codex-performance-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'This is faster.' } });
  assertCase('Performance claim without evidence fails', result.parsed?.performanceEvidenceStatus?.status === 'fail', failures, cases, result.parsed?.performanceEvidenceStatus?.status);
  result = runScript('scripts/codex-performance-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'No performance claim.' } });
  assertCase('No performance claim returns not_applicable', result.parsed?.performanceEvidenceStatus?.status === 'not_applicable', failures, cases, result.parsed?.performanceEvidenceStatus?.status);

  result = runScript('scripts/codex-test-coverage-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'behavior change' } });
  assertCase('Test coverage evidence required for behavior change', result.parsed?.testCoverageEvidenceStatus?.status === 'fail', failures, cases, result.parsed?.testCoverageEvidenceStatus?.status);
  result = runScript('scripts/codex-test-coverage-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'docs-only change' } });
  assertCase('Docs-only change does not require test coverage evidence', result.parsed?.testCoverageEvidenceStatus?.status === 'not_applicable', failures, cases, result.parsed?.testCoverageEvidenceStatus?.status);

  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    v080SelfTestStatus: { status: failures.length ? 'fail' : 'pass', cases, failures, safeSummaryOnly: true },
    valuesPrinted: false,
    status: failures.length ? 'fail' : 'pass',
    safeSummary: failures.length ? 'v0.8.0 self-test failed; see safe labels only.' : 'v0.8.0 self-test passed.',
  };
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMain()) {
  try {
    const report = buildReport();
    writeJsonReport(report, 'CODEX_V080_SELF_TEST_REPORT');
    process.exit(report.status === 'fail' ? 1 : 0);
  } catch {
    const report = {
      marker,
      harnessVersion: HARNESS_VERSION,
      v080SelfTestStatus: { status: 'fail', failures: ['unexpected_error'], safeSummaryOnly: true },
      valuesPrinted: false,
      status: 'fail',
      safeSummary: 'v0.8.0 self-test failed with an internal error.',
    };
    writeJsonReport(report, 'CODEX_V080_SELF_TEST_REPORT');
    process.exit(1);
  }
}
