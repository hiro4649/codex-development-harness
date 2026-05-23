#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.2
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEvidencePackReport } from './codex-evidence-pack-validate.mjs';
import { buildHumanConfirmationObjectReport } from './codex-human-confirmation-validate.mjs';
import { buildSafeOutputScanReport } from './codex-safe-output-scan.mjs';
import { buildCiReplayReport } from './codex-ci-replay.mjs';
import { buildPrBodyLintReport } from './codex-pr-body-lint.mjs';
import { buildProductionReadinessReport } from './codex-production-readiness-gate.mjs';

export const HARNESS_VERSION = '0.7.2';
export const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;

const expectedHead = '1111111111111111111111111111111111111111';
const staleHead = '2222222222222222222222222222222222222222';

function assertCase(name, condition, failures) {
  if (!condition) failures.push(name);
}

function writeJson(dir, name, value) {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
  return file;
}

function validPack(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    harnessVersion: HARNESS_VERSION,
    repository: 'owner/repo',
    prNumber: 1,
    headSha: expectedHead,
    baseSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    changeType: 'harness',
    riskLevel: 'R3',
    scope: {
      changedFiles: ['scripts/codex-local-quality-gate.mjs'],
      allowedPaths: ['scripts/codex-*'],
      forbiddenPaths: ['src/'],
    },
    commands: [
      { name: 'node scripts/codex-v072-self-test.mjs', result: 'pass', exitCode: 0, source: 'local', date: '2026-05-23' },
    ],
    remoteRuns: [
      { source: 'GitHub Actions', result: 'pass', date: '2026-05-23', headShaStatus: 'matched' },
    ],
    residualRisks: ['downstream propagation separate'],
    productionClaims: 'none',
    rollbackOrStopCondition: 'stop on gate failure',
    humanConfirmation: validConfirmation(),
    safeOutput: { status: 'pass' },
    ...overrides,
  };
}

function validConfirmation(overrides = {}) {
  return {
    target: 'pull_request',
    repository: 'owner/repo',
    prNumber: 1,
    headSha: expectedHead,
    riskLevel: 'R3',
    confirmedByRole: 'project-owner',
    confirmedAt: '2026-05-23T00:00:00Z',
    reviewedItems: ['quality evidence', 'residual risks'],
    residualRisks: ['downstream propagation separate'],
    qualityGateNotWeakened: true,
    riskLevelNotLowered: true,
    nonOverridableFailuresAcknowledged: true,
    ...overrides,
  };
}

function validBody() {
  return [
    '## Codex Method Compliance',
    'Goal: Apply v0.7.2 structured evidence controls.',
    'Context: Source harness update only.',
    'Files or scope: harness-managed files.',
    'Constraints: no external project repos.',
    'Done when: quality gate passes.',
    'Plan-first status: done - plan reviewed before coding.',
    'Testing and review: command=node scripts/codex-v072-self-test.mjs; result=pass; exit code=0; date=2026-05-23; source=local.',
    'Residual risks: downstream propagation separate.',
    'Human confirmation needed: yes - R3 harness behavior.',
    'Risk level: R3',
    `Head SHA: ${expectedHead}`,
    'Production Go/No-Go: no production claim.',
    'Evidence Integrity: command, result, date, source, and head SHA recorded.',
    'Hermes Invariants: safe summary only and boundaries preserved.',
    'Remote/Local Evidence: remote quality gate source=GitHub Actions result=pass date=2026-05-23.',
    'Rollback or Merge-After Verify: stop condition documented.',
    'Stale Evidence Check: current head SHA recorded.',
    'Manual Confirmation Limits: non-overridable failures cannot be manually overridden.',
    'Human Confirmation Evidence:',
    'confirmedByRole: project-owner',
    'reviewedItems:',
    '- quality evidence',
    `head SHA: ${expectedHead}`,
    'residualRisksAccepted: yes',
    'qualityGateNotWeakened: yes',
    'riskLevelNotLowered: yes',
  ].join('\n');
}

function buildReport() {
  const failures = [];
  const cases = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v072-'));

  const validPackFile = writeJson(tmp, 'valid-pack.json', validPack());
  const invalidPackFile = writeJson(tmp, 'invalid-pack.json', validPack({ headSha: undefined }));
  const validConfirmationFile = writeJson(tmp, 'manual-confirmation.json', validConfirmation());
  const staleConfirmationFile = writeJson(tmp, 'manual-confirmation-stale.json', validConfirmation({ headSha: staleHead }));
  const bodyFile = path.join(tmp, 'PR_BODY.md');
  fs.writeFileSync(bodyFile, validBody());
  const eventFile = writeJson(tmp, 'event.json', { pull_request: { body: validBody() } });

  const packPass = buildEvidencePackReport({ CODEX_EVIDENCE_PACK_PATH: validPackFile, CODEX_PR_HEAD_SHA: expectedHead });
  cases.push({ name: 'valid evidence pack', status: packPass.evidencePackStatus.status });
  assertCase('valid evidence pack passes', packPass.evidencePackStatus.status === 'pass', failures);

  const packInvalid = buildEvidencePackReport({ CODEX_EVIDENCE_PACK_PATH: invalidPackFile, CODEX_PR_HEAD_SHA: expectedHead });
  cases.push({ name: 'invalid evidence pack missing headSha', status: packInvalid.evidencePackStatus.status });
  assertCase('invalid evidence pack missing headSha fails', packInvalid.evidencePackStatus.status === 'fail', failures);

  const confirmationPass = buildHumanConfirmationObjectReport({ CODEX_MANUAL_CONFIRMATION_PATH: validConfirmationFile, CODEX_PR_HEAD_SHA: expectedHead });
  cases.push({ name: 'manual confirmation valid object', status: confirmationPass.humanConfirmationObjectStatus.status });
  assertCase('manual confirmation valid object passes', confirmationPass.humanConfirmationObjectStatus.status === 'pass', failures);

  const confirmationStale = buildHumanConfirmationObjectReport({ CODEX_MANUAL_CONFIRMATION_PATH: staleConfirmationFile, CODEX_PR_HEAD_SHA: expectedHead });
  cases.push({ name: 'manual confirmation stale head', status: confirmationStale.humanConfirmationObjectStatus.status });
  assertCase('manual confirmation stale head fails', confirmationStale.humanConfirmationObjectStatus.status === 'fail', failures);

  const githubPath = buildPrBodyLintReport({ GITHUB_EVENT_PATH: eventFile, CODEX_EVENT_NAME: 'pull_request', CODEX_PR_HEAD_SHA: expectedHead }, ['node', 'codex-pr-body-lint.mjs', '--json']);
  cases.push({ name: 'PR body current GitHub API path', status: githubPath.prBodyLintStatus.status });
  assertCase('PR body current GitHub API path passes', githubPath.prBodyLintStatus.status === 'pass', failures);

  const replay = buildCiReplayReport(['node', 'codex-ci-replay.mjs', '--repo', 'owner/repo', '--pr', '1', '--head', expectedHead, '--body', bodyFile, '--json'], { CODEX_PR_HEAD_SHA: expectedHead });
  cases.push({ name: 'remote/local parity replay fixture', status: replay.ciReplayStatus.status });
  assertCase('remote/local parity replay fixture passes', replay.ciReplayStatus.status === 'pass', failures);

  const safePolicy = buildSafeOutputScanReport({ policyText: 'Do not output raw payload, secret value, endpoint value, private path, production data, or personal data.' });
  cases.push({ name: 'safe policy vocabulary allowed fixture', status: safePolicy.safeOutputScanStatus.status });
  assertCase('safe policy vocabulary does not fail', safePolicy.safeOutputScanStatus.status === 'pass', failures);

  const falsePositive = buildSafeOutputScanReport({ reasonCodes: ['unsafe_value_detected'], safeMessage: 'Safe label only.' });
  cases.push({ name: 'unsafe scanner false positive fixture', status: falsePositive.safeOutputScanStatus.status });
  assertCase('safe labels do not fail unsafe scanner', falsePositive.safeOutputScanStatus.status === 'pass', failures);

  const truePositive = buildSafeOutputScanReport({ endpointValue: 'redacted-fixture' });
  cases.push({ name: 'forbidden value leak fixture', status: truePositive.safeOutputScanStatus.status });
  assertCase('forbidden field name leak fails', truePositive.safeOutputScanStatus.status === 'fail', failures);

  const r3Missing = buildHumanConfirmationObjectReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_HEAD_SHA: expectedHead,
    CODEX_PR_BODY: validBody().replace(/Human Confirmation Evidence:[\s\S]*$/m, ''),
  });
  cases.push({ name: 'R3 required but missing confirmation', status: r3Missing.humanConfirmationObjectStatus.status });
  assertCase('R3 required but missing confirmation requires manual confirmation', r3Missing.humanConfirmationObjectStatus.status === 'manual_confirmation_required', failures);

  const r3Complete = buildHumanConfirmationObjectReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_HEAD_SHA: expectedHead,
    CODEX_PR_BODY: validBody(),
  });
  cases.push({ name: 'R3 completed confirmation', status: r3Complete.humanConfirmationObjectStatus.status });
  assertCase('R3 completed confirmation passes', r3Complete.humanConfirmationObjectStatus.status === 'pass', failures);

  const prodClaim = buildProductionReadinessReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_HEAD_SHA: expectedHead,
    CODEX_PR_BODY: 'Production ready.\nRisk level: R3',
  });
  cases.push({ name: 'production claim without evidence', status: prodClaim.productionReadinessStatus.status });
  assertCase('production claim without evidence fails', prodClaim.productionReadinessStatus.status === 'fail', failures);

  const nonPr = buildPrBodyLintReport({ CODEX_EVENT_NAME: 'workflow_dispatch' }, ['node', 'codex-pr-body-lint.mjs', '--json']);
  cases.push({ name: 'non-PR local not_applicable', status: nonPr.prBodyLintStatus.status });
  assertCase('non-PR local is not_applicable', nonPr.prBodyLintStatus.status === 'not_applicable', failures);

  const raw = JSON.stringify({ cases });
  if (raw.includes(expectedHead) || raw.includes(staleHead) || /https?:\/\//i.test(raw)) {
    failures.push('self-test output leaked unsafe fixture value');
  }

  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    v072SelfTestStatus: {
      status: failures.length ? 'fail' : 'pass',
      cases,
      failures,
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
    productionReadyClaim: 'NO',
    status: failures.length ? 'fail' : 'pass',
    safeSummary: failures.length
      ? 'v0.7.2 self-test failed; see safe labels only.'
      : 'v0.7.2 self-test passed.',
  };
}

function printReport(report) {
  const jsonMode = process.env.CODEX_V072_SELF_TEST_REPORT === 'json' ||
    process.env.CODEX_QUALITY_REPORT === 'json' ||
    process.argv.includes('--json');
  if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    console.log(`v072SelfTestStatus: ${report.v072SelfTestStatus.status}`);
    console.log(report.safeSummary);
  }
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMain()) {
  try {
    const report = buildReport();
    printReport(report);
    process.exit(report.status === 'fail' ? 1 : 0);
  } catch {
    const report = {
      marker,
      harnessVersion: HARNESS_VERSION,
      v072SelfTestStatus: {
        status: 'fail',
        failures: ['unexpected_error'],
        safeSummaryOnly: true,
      },
      valuesPrinted: false,
      productionReadyClaim: 'NO',
      status: 'fail',
      safeSummary: 'v0.7.2 self-test failed with an internal error.',
    };
    printReport(report);
    process.exit(1);
  }
}
