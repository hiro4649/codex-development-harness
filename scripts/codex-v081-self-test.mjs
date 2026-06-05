#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, writeJsonReport } from './codex-v080-lib.mjs';
import { buildChangeClassificationReport } from './codex-change-classification-gate.mjs';
import { buildProductVerificationReport } from './codex-product-verification-gate.mjs';
import { buildProductionReadinessReport } from './codex-production-readiness-gate.mjs';
import { buildEvidenceIntegrityReport } from './codex-evidence-integrity-gate.mjs';
import { buildPrBodyLintReport } from './codex-pr-body-lint.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(here);

function run(script, options = {}) {
  const result = spawnSync(process.execPath, [path.join(repo, script), '--json'], {
    cwd: options.cwd || repo,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    return { code: result.status, parsed: JSON.parse(result.stdout || '{}') };
  } catch {
    return { code: result.status, parsed: null };
  }
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function assertCase(name, ok, failures, cases, status = ok ? 'pass' : 'fail') {
  cases.push({ name, status });
  if (!ok) failures.push(name);
}

function cleanAgents(version = HARNESS_VERSION) {
  return `# AGENTS.md

<!-- CODEX_QUALITY_HARNESS_BEGIN -->
CODEX_QUALITY_HARNESS_FILE v${version}

## Source Harness Boundary
This target repo uses harness-managed checks only.

## Plan-First Rule
Use plan-first for risky or ambiguous work.

## Safe Output Rule
Use safe summary only. Do not output endpoint values.

## Merge-Ready Claim Rule
Do not claim merge-ready without current-head evidence.

## Manual Confirmation Limit
Manual confirmation cannot override non-overridable failures.

## Profile/Core Separation
Target mode does not require source profiles.
<!-- CODEX_QUALITY_HARNESS_END -->
`;
}

function copyHarnessScripts(tmp) {
  fs.cpSync(path.join(repo, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'docs', 'process'), { recursive: true });
  if (fs.existsSync(path.join(repo, 'docs', 'process'))) {
    fs.cpSync(path.join(repo, 'docs', 'process'), path.join(tmp, 'docs', 'process'), { recursive: true });
  }
}

function initTargetFixture(tmp) {
  copyHarnessScripts(tmp);
  write(path.join(tmp, 'AGENTS.md'), cleanAgents());
  write(path.join(tmp, 'docs', 'process', 'CODEX_HARNESS_MANIFEST.json'), JSON.stringify({
    harnessVersion: HARNESS_VERSION,
    sourceHarnessVersion: HARNESS_VERSION,
    targetRepoMode: true,
    profileCompatibility: 'off',
    managedFiles: ['AGENTS.md', 'docs/process/', 'scripts/codex-'],
    policyFiles: [],
    scriptNames: ['codex-local-quality-gate.mjs', 'codex-secret-safety-scan.mjs', 'codex-v080-self-test.mjs'],
    safeSummaryOnly: true,
  }, null, 2));
  spawnSync('git', ['init'], { cwd: tmp, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.email', 'codex@example.invalid'], { cwd: tmp, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.name', 'Codex'], { cwd: tmp, stdio: 'ignore' });
  spawnSync('git', ['add', '.'], { cwd: tmp, stdio: 'ignore' });
  spawnSync('git', ['commit', '-m', 'fixture'], { cwd: tmp, stdio: 'ignore' });
}

function buildReport() {
  const failures = [];
  const cases = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-v081-'));

  write(path.join(tmp, 'AGENTS.md'), `${cleanAgents()}\n鬯�E�驪�E�鬩搾�E��E�\n`);
  let result = run('scripts/codex-agents-context-gate.mjs', { cwd: tmp });
  assertCase('AGENTS entire-file mojibake fails', result.parsed?.agentsContextStatus?.status === 'fail', failures, cases, result.parsed?.agentsContextStatus?.status);

  write(path.join(tmp, 'AGENTS.md'), cleanAgents());
  result = run('scripts/codex-agents-context-gate.mjs', { cwd: tmp });
  assertCase('AGENTS clean target file passes', result.parsed?.agentsContextStatus?.status === 'pass', failures, cases, result.parsed?.agentsContextStatus?.status);

  write(path.join(tmp, 'AGENTS.md'), `${cleanAgents()}${cleanAgents()}`);
  result = run('scripts/codex-agents-context-gate.mjs', { cwd: tmp });
  assertCase('Two harness blocks fail', result.parsed?.agentsContextStatus?.status === 'fail', failures, cases, result.parsed?.agentsContextStatus?.status);

  write(path.join(tmp, 'AGENTS.md'), 'Readable project rules only.');
  result = run('scripts/codex-agents-context-gate.mjs', { cwd: tmp, env: { CODEX_HARNESS_MODE: 'target' } });
  assertCase('Missing harness block fails in target mode', result.parsed?.agentsContextStatus?.status === 'fail', failures, cases, result.parsed?.agentsContextStatus?.status);

  result = run('scripts/codex-safe-output-scan.mjs', { env: { CODEX_SAFE_OUTPUT_SCAN_REPORT: 'json' } });
  assertCase('Safe policy vocabulary passes', result.parsed?.safeOutputScanStatus?.status === 'pass', failures, cases, result.parsed?.safeOutputScanStatus?.status);

  const harnessOnly = buildProductVerificationReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_BODY: 'NPM/Product Checks Skip Reason: harness-only.',
    CODEX_SKIP_NPM: '1',
    CODEX_CHANGED_FILES: 'scripts/codex-local-quality-gate.mjs',
  });
  assertCase('Harness-only change with CODEX_SKIP_NPM=1 passes product verification', harnessOnly.productVerificationStatus.status === 'pass', failures, cases, harnessOnly.productVerificationStatus.status);

  const productSkip = buildProductVerificationReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_BODY: 'Product verification commands: not run.',
    CODEX_SKIP_NPM: '1',
    CODEX_CHANGED_FILES: 'src/app.js',
  });
  const classified = buildChangeClassificationReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_BODY: 'Runtime readiness claimed: no.',
  });
  assertCase('Change classification emits status', Boolean(classified.changeClassificationStatus.status), failures, cases, classified.changeClassificationStatus.status);
  assertCase('Product src change with CODEX_SKIP_NPM=1 fails product verification', productSkip.productVerificationStatus.status === 'fail', failures, cases, productSkip.productVerificationStatus.status);

  const runtimeSkip = buildProductVerificationReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_BODY: 'Runtime readiness claimed: yes.',
    CODEX_SKIP_NPM: '1',
    CODEX_CHANGED_FILES: 'docs/process/CODEX_HARNESS_MANIFEST.json',
  });
  assertCase('Runtime readiness claim with CODEX_SKIP_NPM=1 fails product verification', runtimeSkip.productVerificationStatus.status !== 'pass', failures, cases, runtimeSkip.productVerificationStatus.status);

  const tmpTarget = path.join(tmp, 'target');
  initTargetFixture(tmpTarget);
  result = run('scripts/codex-local-quality-gate.mjs', {
    cwd: tmpTarget,
    env: {
      CODEX_HARNESS_MODE: 'target',
      CODEX_HARNESS_SOURCE_REPO: '0',
      CODEX_PROFILE_COMPAT_MODE: 'off',
      CODEX_QUALITY_REPORT: 'json',
      CODEX_SKIP_NPM: '1',
      CODEX_SKIP_V081_SELF_TEST: '1',
      CODEX_SKIP_V082_SELF_TEST: '1',
      CODEX_SKIP_V083_SELF_TEST: '1',
      CODEX_SKIP_V084_SELF_TEST: '1',
      CODEX_SKIP_V085_SELF_TEST: '1',
      CODEX_SKIP_V086_SELF_TEST: '1',
      CODEX_SKIP_V087_SELF_TEST: '1',
      CODEX_SKIP_V088_SELF_TEST: '1',
      CODEX_SKIP_V089_SELF_TEST: '1',
      CODEX_SKIP_V090_SELF_TEST: '1',
      CODEX_SKIP_V092_SELF_TEST: '1',
      CODEX_SKIP_V093_SELF_TEST: '1',
      CODEX_SKIP_V094_SELF_TEST: '1',
      CODEX_SKIP_V095_SELF_TEST: '1',
      CODEX_SKIP_V096_SELF_TEST: '1',
      CODEX_SKIP_V097_SELF_TEST: '1',
      CODEX_SKIP_V098_SELF_TEST: '1',
      CODEX_SKIP_V099_SELF_TEST: '1',
      CODEX_SKIP_V100_SELF_TEST: '1',
      CODEX_SKIP_V101_SELF_TEST: '1',
      CODEX_NPM_SKIP_REASON: 'harness-only fixture',
    },
  });
  assertCase('Target mode local quality gate does not require source manifest', result.parsed?.sourceHarnessValidationStatus === undefined, failures, cases, result.parsed?.targetQualityScoreStatus?.status);
  assertCase('Target mode emits targetQualityScoreStatus with score', typeof result.parsed?.targetQualityScoreStatus?.score === 'number', failures, cases, result.parsed?.targetQualityScoreStatus?.status);
  assertCase('Target mode does not emit qualityScoreStatus not_available as the only score', result.parsed?.targetQualityScoreStatus?.status !== 'not_available', failures, cases, result.parsed?.targetQualityScoreStatus?.status);

  result = run('scripts/codex-performance-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'This is faster.' } });
  assertCase('Performance claim without evidence fails', result.parsed?.performanceEvidenceStatus?.status === 'fail', failures, cases, result.parsed?.performanceEvidenceStatus?.status);
  result = run('scripts/codex-performance-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'Performance Evidence:\nPerformance claim: faster.\nBaseline summary: old.\nNew measurement summary: new.' } });
  assertCase('Performance claim with baseline/new measurement summary passes', result.parsed?.performanceEvidenceStatus?.status === 'pass', failures, cases, result.parsed?.performanceEvidenceStatus?.status);

  result = run('scripts/codex-best-of-n-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'Risk level: R3' } });
  assertCase('Best of N required for R3 missing evidence fails', result.parsed?.bestOfNEvidenceStatus?.status === 'fail', failures, cases, result.parsed?.bestOfNEvidenceStatus?.status);
  result = run('scripts/codex-best-of-n-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'Risk level: R3\n\nBest of N Evidence:\nCandidate count: 2\nSelected candidate: smallest safe change\nReason selected: narrowest safe option\nRejected alternatives: broader rewrite' } });
  assertCase('Best of N evidence present passes', result.parsed?.bestOfNEvidenceStatus?.status === 'pass', failures, cases, result.parsed?.bestOfNEvidenceStatus?.status);

  const structuredHead = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const structuredEvidenceBody = `## Goal
Validate structured evidence source handling.

## Context
Fixture PR body.

Risk level: R3.

## Files or scope
scripts/codex-*

## Constraints
Safe summary only.

## Done when
Structured evidence is accepted.

## Plan-first status
Done - plan reviewed before coding.

## Testing and review
Command: node scripts/codex-v081-self-test.mjs
Result: pass
Source: local
Date: 2026-05-23
Code review status: self-reviewed

## Residual risks
Fixture only.

## Human confirmation needed
not required with reason - fixture does not represent a real PR.

## Production Go/No-Go
Runtime readiness claimed: no.

## Evidence Integrity
Structured evidence pack is present.

## Hermes Invariants
Safe summary only. Human judgment is visible. Rollback or stop condition is present.

## Remote/Local Evidence
Source: local.

## Rollback or Merge-After Verify
Stop condition: do not merge if gate fails.

## Stale Evidence Check
head SHA: ${structuredHead}

## Manual Confirmation Limits
Manual confirmation cannot override non-overridable failures.

BEGIN_CODEX_EVIDENCE_PACK_JSON
{
  "codexEvidencePack": {
    "schemaVersion": "0.8.1",
    "harnessVersion": "0.8.2",
    "repository": "example/repo",
    "prNumber": 1,
    "headSha": "${structuredHead}",
    "baseSha": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "changeType": "source-harness",
    "riskLevel": "R3",
    "scope": {
      "changedFiles": ["scripts/codex-example.mjs"],
      "allowedPaths": ["scripts/codex-"],
      "forbiddenPaths": ["src/"]
    },
    "commands": [
      { "name": "node scripts/codex-v081-self-test.mjs", "result": "pass", "exitCode": 0, "source": "local", "date": "2026-05-23" }
    ],
    "remoteRuns": [],
    "residualRisks": ["fixture only"],
    "productionClaims": { "claimsRuntimeReady": false, "claimsDeploymentReady": false, "claimsMergeReady": false },
    "rollbackOrStopCondition": "Do not merge if gate fails.",
    "humanConfirmation": {},
    "safeOutput": { "status": "pass", "unsafeFindings": [] }
  }
}
END_CODEX_EVIDENCE_PACK_JSON`;
  const structuredEnv = {
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_HEAD_SHA: structuredHead,
    CODEX_PR_BODY: structuredEvidenceBody,
  };
  const productionStructured = buildProductionReadinessReport(structuredEnv);
  assertCase('Production readiness accepts PR body structured evidence pack source', productionStructured.productionReadinessStatus.status === 'pass', failures, cases, productionStructured.productionReadinessStatus.status);
  const integrityStructured = buildEvidenceIntegrityReport(structuredEnv);
  assertCase('Evidence integrity accepts PR body structured evidence pack source', integrityStructured.evidenceIntegrityStatus.status === 'pass', failures, cases, integrityStructured.evidenceIntegrityStatus.status);
  const lintStructured = buildPrBodyLintReport(structuredEnv, ['node', 'codex-pr-body-lint.mjs']);
  assertCase('PR body lint accepts PR body structured evidence pack source', lintStructured.prBodyLintStatus.status === 'pass', failures, cases, lintStructured.prBodyLintStatus.status);

  const docsOnly = buildProductVerificationReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_BODY: 'Skip reason: docs-only.',
    CODEX_SKIP_NPM: '1',
    CODEX_CHANGED_FILES: 'README.md',
  });
  assertCase('Docs-only change with explicit skip reason passes or not_applicable', ['pass', 'not_applicable'].includes(docsOnly.productVerificationStatus.status), failures, cases, docsOnly.productVerificationStatus.status);

  const packageChange = buildProductVerificationReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_BODY: 'Package changed.',
    CODEX_CHANGED_FILES: 'package.json',
  });
  assertCase('Package change requires package verification', packageChange.productVerificationStatus.status === 'fail', failures, cases, packageChange.productVerificationStatus.status);

  const unknown = buildChangeClassificationReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_CHANGED_FILES: 'mystery.file',
  });
  assertCase('Unknown file classification fails or warns in PR context', ['fail', 'warning'].includes(unknown.changeClassificationStatus.status), failures, cases, unknown.changeClassificationStatus.status);

  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    v081SelfTestStatus: { status: failures.length ? 'fail' : 'pass', cases, failures, safeSummaryOnly: true },
    valuesPrinted: false,
    status: failures.length ? 'fail' : 'pass',
    safeSummary: failures.length ? 'v0.8.1 self-test failed; see safe labels.' : 'v0.8.1 self-test passed.',
  };
}

try {
  const report = buildReport();
  writeJsonReport(report, 'CODEX_V081_SELF_TEST_REPORT');
  process.exit(report.status === 'fail' ? 1 : 0);
} catch {
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    v081SelfTestStatus: { status: 'fail', failures: ['unexpected_error'], safeSummaryOnly: true },
    valuesPrinted: false,
    status: 'fail',
  };
  writeJsonReport(report, 'CODEX_V081_SELF_TEST_REPORT');
  process.exit(1);
}
