#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import fs from 'node:fs';
import {
  HARNESS_VERSION,
  buildProductionReadinessReport,
  buildHumanConfirmationStatus,
  forbiddenOutputKeys,
  marker,
} from './codex-production-readiness-gate.mjs';
import { buildEvidenceIntegrityReport } from './codex-evidence-integrity-gate.mjs';
import { buildHermesInvariantReport } from './codex-hermes-invariant-gate.mjs';

const expectedHead = '1111111111111111111111111111111111111111';
const otherHead = '2222222222222222222222222222222222222222';

function baseEnv(body, extra = {}) {
  return {
    CODEX_PR_BODY: body,
    CODEX_PR_NUMBER: '1',
    CODEX_PR_HEAD_SHA: expectedHead,
    CODEX_EVENT_NAME: 'pull_request',
    ...extra,
  };
}

function baseValidBody() {
  return [
    '## Codex Method Compliance',
    'Goal: Add v0.7.1 source harness gates without changing project repositories.',
    'Context: Source harness update only with root/profile version domains separated.',
    'Files or scope: root harness managed files only.',
    'Constraints: no external project repo changes and safe summary only.',
    'Done when: gates, self-tests, and quality report fields pass.',
    'Plan-first status: done - plan reviewed before coding.',
    'Environment setup: Node.js standard library only.',
    'Testing and review: self-reviewed against docs/process/code_review.md.',
    'Residual risks: actual downstream project rollout remains separate.',
    'Best of N used or skipped: skipped with reason - direct policy implementation.',
    'Code review status: self-reviewed against docs/process/code_review.md.',
    'Human confirmation needed: yes - R3 harness gate behavior.',
    'Risk level: R3',
    `Head SHA: ${expectedHead}`,
    'Commands Run: command=node scripts/codex-v071-self-test.mjs; result=pass; exit code=0; date=2026-05-23; source=local.',
    'Verification Results: command=git diff --check; result=pass; exit code=0; date=2026-05-23; source=local.',
    'Remote Quality-Gate Result: source=GitHub Actions; result=pass; date=2026-05-23; head SHA recorded.',
    'Preview / Smoke Confirmation: not applicable with reason - source harness policy update.',
    'Rollback or Merge-After Verify: stop condition and merge-after verify are documented.',
    'Known Risks: downstream profile propagation is separate.',
    'Safe summary only: yes.',
  ].join('\n');
}

function completedHumanConfirmationBlock() {
  return [
    '',
    'Manual confirmation:',
    'confirmedByRole: project-owner',
    `headSha: ${expectedHead}`,
    'reviewedItems:',
    '- quality evidence',
    '- residual risks',
    'residualRisksAccepted: true',
    'qualityGateNotWeakened: true',
    'riskLevelNotLowered: true',
  ].join('\n');
}

function validBody() {
  return `${baseValidBody()}${completedHumanConfirmationBlock()}`;
}

function localMergeReadyFromHumanConfirmation(status) {
  return ['pass', 'not_required'].includes(status);
}

function localQualityScoreFromHumanConfirmation(status) {
  return ['pass', 'not_required'].includes(status) ? 100 : 89;
}

function runAll(env) {
  return {
    production: buildProductionReadinessReport(env),
    evidence: buildEvidenceIntegrityReport(env),
    hermes: buildHermesInvariantReport(env),
  };
}

function statusOf(result, key) {
  return result[key][`${key === 'production' ? 'productionReadiness' : key === 'evidence' ? 'evidenceIntegrity' : 'hermesInvariant'}Status`].status;
}

function assert(name, condition, failures) {
  if (!condition) failures.push(name);
}

function outputIsSafe(value) {
  const raw = JSON.stringify(value);
  if (forbiddenOutputKeys.some((key) => raw.includes(key))) return false;
  if (raw.includes(expectedHead) || raw.includes(otherHead)) return false;
  return true;
}

function profileCompatibilityPass() {
  const raw = fs.readFileSync('CODEX_SOURCE_HARNESS_MANIFEST.json', 'utf8').replace(/^\uFEFF/, '');
  const manifest = JSON.parse(raw);
  const compatible = manifest.compatibleProfileTemplateVersions || [];
  return manifest.sourceHarnessVersion === HARNESS_VERSION &&
    manifest.harnessVersion === HARNESS_VERSION &&
    compatible.includes('0.7.0') &&
    manifest.profileTemplateVersion === '0.7.0';
}

function buildReport() {
  const failures = [];
  const cases = [];

  const empty = runAll({ CODEX_EVENT_NAME: 'workflow_dispatch' });
  cases.push({ name: 'empty-non-pr', statuses: [statusOf(empty, 'production'), statusOf(empty, 'evidence'), statusOf(empty, 'hermes')] });
  assert('empty non-PR production not_applicable', statusOf(empty, 'production') === 'not_applicable', failures);
  assert('empty non-PR evidence not_applicable', statusOf(empty, 'evidence') === 'not_applicable', failures);
  assert('empty non-PR hermes not_applicable', statusOf(empty, 'hermes') === 'not_applicable', failures);

  const missing = runAll({ CODEX_PR_NUMBER: '1', CODEX_EVENT_NAME: 'pull_request' });
  cases.push({ name: 'missing-pr-body', statuses: [statusOf(missing, 'production'), statusOf(missing, 'evidence'), statusOf(missing, 'hermes')] });
  assert('PR body missing fails production gate', statusOf(missing, 'production') === 'fail', failures);
  assert('PR body missing fails evidence gate', statusOf(missing, 'evidence') === 'fail', failures);
  assert('PR body missing fails hermes gate', statusOf(missing, 'hermes') === 'fail', failures);

  const prodClaim = runAll(baseEnv('Production ready.\nRisk level: R3'));
  cases.push({ name: 'production-ready-without-evidence', statuses: [statusOf(prodClaim, 'production'), statusOf(prodClaim, 'hermes')] });
  assert('production ready without evidence fails', statusOf(prodClaim, 'production') === 'fail', failures);

  const weak = runAll(baseEnv(`${validBody()}\nCommands Run: passed only`));
  cases.push({ name: 'weak-command-evidence', statuses: [statusOf(weak, 'evidence')] });
  assert('weak command evidence does not pass', statusOf(weak, 'evidence') !== 'pass', failures);

  const stale = runAll(baseEnv(validBody().replaceAll(expectedHead, otherHead)));
  cases.push({ name: 'stale-head-sha', statuses: [statusOf(stale, 'production'), statusOf(stale, 'evidence')] });
  assert('stale head fails production', statusOf(stale, 'production') === 'fail', failures);
  assert('stale head fails evidence', statusOf(stale, 'evidence') === 'fail', failures);

  const r3NoHuman = runAll(baseEnv(baseValidBody().replace('Human confirmation needed: yes - R3 harness gate behavior.', 'Review decision omitted.')));
  cases.push({ name: 'r3-without-human-review', statuses: [statusOf(r3NoHuman, 'production'), statusOf(r3NoHuman, 'hermes')] });
  assert('R3 without human review does not pass', statusOf(r3NoHuman, 'hermes') !== 'pass', failures);

  const override = runAll(baseEnv(`${validBody()}\nManual confirmation can override secretScanFailure.`));
  cases.push({ name: 'manual-override-non-overridable', statuses: [statusOf(override, 'production'), statusOf(override, 'hermes')] });
  assert('manual override of non-overridable fails', statusOf(override, 'production') === 'fail' || statusOf(override, 'hermes') === 'fail', failures);

  const incompleteHuman = buildHumanConfirmationStatus(baseEnv(baseValidBody())).humanConfirmationStatus;
  cases.push({ name: 'human-confirmation-required-incomplete', statuses: [incompleteHuman.status] });
  assert('human confirmation required but incomplete needs manual confirmation', incompleteHuman.status === 'manual_confirmation_required', failures);
  assert('incomplete human confirmation is not merge-ready', !localMergeReadyFromHumanConfirmation(incompleteHuman.status), failures);
  assert('incomplete human confirmation cannot score 100', localQualityScoreFromHumanConfirmation(incompleteHuman.status) !== 100, failures);

  const completedHuman = buildHumanConfirmationStatus(baseEnv(validBody())).humanConfirmationStatus;
  cases.push({ name: 'human-confirmation-completed', statuses: [completedHuman.status] });
  assert('completed human confirmation passes', completedHuman.status === 'pass', failures);
  assert('completed human confirmation can be merge-ready', localMergeReadyFromHumanConfirmation(completedHuman.status), failures);
  assert('completed human confirmation can score 100', localQualityScoreFromHumanConfirmation(completedHuman.status) === 100, failures);

  const bypassBody = [
    'Human confirmation needed: yes - R3 harness behavior.',
    'Plan-first status: not required with reason - small edit.',
    'Risk level: R3',
    'Residual risks: downstream propagation separate.',
    `Head SHA: ${expectedHead}`,
  ].join('\n');
  const bypassHuman = buildHumanConfirmationStatus(baseEnv(bypassBody)).humanConfirmationStatus;
  cases.push({ name: 'human-confirmation-required-not-bypassed-by-other-section-not-required', statuses: [bypassHuman.status] });
  assert('human confirmation required is not bypassed by other section not required', bypassHuman.status === 'manual_confirmation_required', failures);
  assert('bypassed human confirmation is not merge-ready', !localMergeReadyFromHumanConfirmation(bypassHuman.status), failures);
  assert('bypassed human confirmation cannot score 100', localQualityScoreFromHumanConfirmation(bypassHuman.status) !== 100, failures);

  const multilineHuman = buildHumanConfirmationStatus(baseEnv([
    'Human confirmation needed:',
    'yes - R3 harness behavior.',
    'Plan-first status: not required with reason - small edit.',
    'Risk level: R3',
    'Residual risks: downstream propagation separate.',
    `Head SHA: ${expectedHead}`,
  ].join('\n'))).humanConfirmationStatus;
  cases.push({ name: 'human-confirmation-multiline-required', statuses: [multilineHuman.status] });
  assert('multiline human confirmation required is detected', multilineHuman.status === 'manual_confirmation_required', failures);

  const explicitNotRequired = buildHumanConfirmationStatus(baseEnv([
    'Human confirmation needed: not required with reason - R1 docs-only update.',
    'Risk level: R1',
    'Residual risks: none beyond docs typo.',
  ].join('\n'))).humanConfirmationStatus;
  cases.push({ name: 'human-confirmation-explicit-not-required-with-reason', statuses: [explicitNotRequired.status] });
  assert('explicit human confirmation not required passes as not_required', explicitNotRequired.status === 'not_required', failures);

  const conflictingHuman = buildHumanConfirmationStatus(baseEnv([
    'Human confirmation needed: yes',
    'Human confirmation needed: not required with reason - conflicting text.',
  ].join('\n'))).humanConfirmationStatus;
  cases.push({ name: 'human-confirmation-conflicting-values', statuses: [conflictingHuman.status] });
  assert('conflicting human confirmation values are not not_required', conflictingHuman.status !== 'not_required', failures);

  const remotePendingConfirmed = runAll(baseEnv(`${validBody()}\nRemote Evidence: pending with reason - current workflow rerun is required.`));
  cases.push({ name: 'remote-evidence-gap-covered-by-human-confirmation', statuses: [statusOf(remotePendingConfirmed, 'production')] });
  assert('human confirmation covers remote evidence manual gap', statusOf(remotePendingConfirmed, 'production') === 'pass', failures);

  const selfAssertion = runAll(baseEnv('Risk level: R3\nResult: pass\nResidual risks: none'));
  cases.push({ name: 'hermes-self-assertion-only', statuses: [statusOf(selfAssertion, 'hermes')] });
  assert('Hermes self assertion only fails', statusOf(selfAssertion, 'hermes') === 'fail', failures);

  const valid = runAll(baseEnv(validBody()));
  cases.push({ name: 'valid-pr-evidence', statuses: [statusOf(valid, 'production'), statusOf(valid, 'evidence'), statusOf(valid, 'hermes')] });
  assert('valid production evidence passes', statusOf(valid, 'production') === 'pass', failures);
  assert('valid evidence integrity passes', statusOf(valid, 'evidence') === 'pass', failures);
  assert('valid Hermes evidence passes', statusOf(valid, 'hermes') === 'pass', failures);

  assert('profile template v0.7.0 compatibility passes', profileCompatibilityPass(), failures);
  assert('safe output contains no forbidden fields or synthetic SHA values', outputIsSafe({ cases, valid }), failures);

  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    v071SelfTestStatus: {
      status: failures.length ? 'fail' : 'pass',
      cases,
      failures,
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
    productionReadyClaim: 'NO',
    status: failures.length ? 'fail' : 'pass',
    safeSummary: failures.length
      ? 'v0.7.1 self-test failed; see safe labels only.'
      : 'v0.7.1 self-test passed.',
  };
}

function printReport(report) {
  const jsonMode = process.env.CODEX_V071_SELF_TEST_REPORT === 'json' ||
    process.env.CODEX_QUALITY_REPORT === 'json' ||
    process.argv.includes('--json');
  if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    console.log(`v071SelfTestStatus: ${report.v071SelfTestStatus.status}`);
    console.log(report.safeSummary);
  }
}

try {
  const report = buildReport();
  printReport(report);
  process.exit(report.status === 'fail' ? 1 : 0);
} catch {
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    v071SelfTestStatus: {
      status: 'fail',
      cases: [],
      failures: ['v071_self_test_unexpected_error'],
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
    productionReadyClaim: 'NO',
    status: 'fail',
    safeSummary: 'v0.7.1 self-test failed with an internal error.',
  };
  printReport(report);
  process.exit(1);
}
