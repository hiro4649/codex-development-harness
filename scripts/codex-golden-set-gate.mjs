#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, readJson, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildSafeOutputScanReport } from './codex-safe-output-scan.mjs';
import { buildEvidencePackReport } from './codex-evidence-pack-validate.mjs';
import { buildHumanConfirmationObjectReport } from './codex-human-confirmation-validate.mjs';
import { buildCiReplayReport } from './codex-ci-replay.mjs';
import {
  GOLDEN_BASE,
  GOLDEN_HEAD,
  buildStructuredEvidencePrBody,
  cleanAgentsContext,
  curatorReport,
  mojibakeAgentsContext,
  offlineEvolutionProposal,
  safeTraceEvent,
  sourceManifest,
} from './codex-v080-fixtures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(here);
const casesPath = path.join(repo, 'docs', 'process', 'golden', 'cases.json');

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function runScript(scriptName, { cwd = repo, env = {} } = {}) {
  const result = spawnSync(process.execPath, [path.join(repo, 'scripts', scriptName), '--json'], {
    cwd,
    env: { ...process.env, CODEX_QUALITY_REPORT: 'json', ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    return JSON.parse(result.stdout || '{}');
  } catch {
    return { status: 'fail', parseFailed: true };
  }
}

function makeCoreFixture(profileCompatibility = 'optional') {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-golden-core-'));
  write(path.join(tmp, 'CODEX_SOURCE_HARNESS_MANIFEST.json'), JSON.stringify(sourceManifest(profileCompatibility), null, 2));
  write(path.join(tmp, 'scripts', 'codex-local-quality-gate.mjs'), '// core fixture\n');
  write(path.join(tmp, '.github', 'workflows', 'quality-gate.yml'), 'env:\n  CODEX_HARNESS_MODE: core\n');
  write(path.join(tmp, '.github', 'workflows', 'weekly-health-check.yml'), 'env:\n  CODEX_HARNESS_MODE: core\n');
  return tmp;
}

function makeAgentsFixture(text) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-golden-agents-'));
  write(path.join(tmp, 'AGENTS.md'), text);
  return tmp;
}

function evaluateCase(caseId) {
  switch (caseId) {
    case 'safe-output-blocks-concrete-endpoint':
      return buildSafeOutputScanReport({ text: 'Reports must not include endpoint value https://example.invalid/token' }).safeOutputScanStatus.status === 'fail';
    case 'safe-output-allows-policy-vocabulary':
      return buildSafeOutputScanReport({ text: 'Reports must not include raw payload, secret value, endpoint value, private path, production data, or personal data.' }).safeOutputScanStatus.status === 'pass';
    case 'evidence-pack-missing-head':
      return buildEvidencePackReport({ CODEX_PR_HEAD_SHA: GOLDEN_HEAD, CODEX_PR_BODY: buildStructuredEvidencePrBody({ omitEvidenceHead: true }) }).evidencePackStatus.status === 'fail';
    case 'evidence-pack-head-mismatch':
      return buildEvidencePackReport({ CODEX_PR_HEAD_SHA: GOLDEN_HEAD, CODEX_PR_BODY: buildStructuredEvidencePrBody({ evidenceHeadSha: GOLDEN_BASE }) }).evidencePackStatus.status === 'fail';
    case 'manual-confirmation-missing-role':
      return buildHumanConfirmationObjectReport({ CODEX_PR_HEAD_SHA: GOLDEN_HEAD, CODEX_PR_BODY: buildStructuredEvidencePrBody({ omitManualRole: true }) }).humanConfirmationObjectStatus.status === 'fail';
    case 'manual-confirmation-head-mismatch':
      return buildHumanConfirmationObjectReport({ CODEX_PR_HEAD_SHA: GOLDEN_HEAD, CODEX_PR_BODY: buildStructuredEvidencePrBody({ manualHeadSha: GOLDEN_BASE }) }).humanConfirmationObjectStatus.status === 'fail';
    case 'ci-replay-missing-pr-evidence':
      return buildCiReplayReport(['node', 'codex-ci-replay.mjs', '--repo', 'owner/repo', '--pr', '1', '--head', GOLDEN_HEAD, '--json'], { CODEX_EVENT_NAME: 'pull_request' }).ciReplayStatus.status === 'manual_confirmation_required';
    case 'generic-core-profile-required-fails':
      return runScript('codex-generic-harness-core-gate.mjs', {
        cwd: makeCoreFixture('optional'),
        env: { CODEX_HARNESS_MODE: 'core', CODEX_PROFILE_COMPAT_MODE: 'on' },
      }).genericHarnessCoreStatus?.status === 'fail';
    case 'generic-core-profile-optional-passes':
      return runScript('codex-generic-harness-core-gate.mjs', {
        cwd: makeCoreFixture('optional'),
        env: { CODEX_HARNESS_MODE: 'core', CODEX_PROFILE_COMPAT_MODE: 'optional' },
      }).genericHarnessCoreStatus?.status === 'pass';
    case 'agents-mojibake-fails':
      return runScript('codex-agents-context-gate.mjs', { cwd: makeAgentsFixture(mojibakeAgentsContext()) }).agentsContextStatus?.status === 'fail';
    case 'agents-clean-context-passes':
      return runScript('codex-agents-context-gate.mjs', { cwd: makeAgentsFixture(cleanAgentsContext()) }).agentsContextStatus?.status === 'pass';
    case 'best-of-n-r3-missing-fails':
      return runScript('codex-best-of-n-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'Risk level: R3' } }).bestOfNEvidenceStatus?.status === 'fail';
    case 'best-of-n-r1-docs-not-required':
      return ['pass', 'not_applicable'].includes(runScript('codex-best-of-n-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'Risk level: R1\ndocs-only change' } }).bestOfNEvidenceStatus?.status);
    case 'safe-trace-absent-not-applicable': {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-golden-trace-'));
      return runScript('codex-safe-trace-schema-gate.mjs', { cwd: tmp }).safeTraceSchemaStatus?.status === 'not_applicable';
    }
    case 'safe-trace-valid-passes': {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-golden-trace-'));
      write(path.join(tmp, '.codex', 'experience', 'traces', 'valid.jsonl'), `${JSON.stringify(safeTraceEvent())}\n`);
      return runScript('codex-safe-trace-schema-gate.mjs', { cwd: tmp }).safeTraceSchemaStatus?.status === 'pass';
    }
    case 'safe-trace-raw-values-true-fails': {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-golden-trace-'));
      write(path.join(tmp, '.codex', 'experience', 'traces', 'unsafe.jsonl'), `${JSON.stringify(safeTraceEvent({ rawValuesStored: true }))}\n`);
      return runScript('codex-safe-trace-schema-gate.mjs', { cwd: tmp }).safeTraceSchemaStatus?.status === 'fail';
    }
    case 'curator-absent-not-applicable': {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-golden-curator-'));
      return runScript('codex-curator-report-gate.mjs', { cwd: tmp }).curatorReportStatus?.status === 'not_applicable';
    }
    case 'curator-auto-apply-fails': {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-golden-curator-'));
      write(path.join(tmp, '.codex', 'curator-report.json'), JSON.stringify(curatorReport({ autoApply: true })));
      return runScript('codex-curator-report-gate.mjs', { cwd: tmp }).curatorReportStatus?.status === 'fail';
    }
    case 'offline-evolution-absent-not-applicable': {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-golden-offline-'));
      return runScript('codex-offline-evolution-proposal-gate.mjs', { cwd: tmp }).offlineEvolutionProposalStatus?.status === 'not_applicable';
    }
    case 'offline-evolution-auto-commit-fails': {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-golden-offline-'));
      write(path.join(tmp, '.codex', 'offline-evolution-proposal.json'), JSON.stringify(offlineEvolutionProposal({ autoCommit: true })));
      return runScript('codex-offline-evolution-proposal-gate.mjs', { cwd: tmp }).offlineEvolutionProposalStatus?.status === 'fail';
    }
    case 'performance-claim-without-evidence-fails':
      return runScript('codex-performance-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'This change is faster.' } }).performanceEvidenceStatus?.status === 'fail';
    case 'performance-no-claim-not-applicable':
      return runScript('codex-performance-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'No performance claim.' } }).performanceEvidenceStatus?.status === 'not_applicable';
    case 'test-coverage-behavior-change-required':
      return runScript('codex-test-coverage-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'behavior change' } }).testCoverageEvidenceStatus?.status === 'fail';
    case 'test-coverage-docs-only-not-required':
      return runScript('codex-test-coverage-evidence-gate.mjs', { env: { CODEX_EVENT_NAME: 'pull_request', CODEX_PR_BODY: 'docs-only change' } }).testCoverageEvidenceStatus?.status === 'not_applicable';
    default:
      return false;
  }
}

function caseDefinitions() {
  const parsed = readJson(casesPath);
  if (!parsed.ok || !Array.isArray(parsed.value?.cases)) return null;
  return parsed.value.cases;
}

function runCases() {
  const definitions = caseDefinitions();
  if (!definitions) return { cases: [], failures: ['golden_set_missing'] };
  const cases = [];
  const failures = [];
  for (const item of definitions) {
    const passed = evaluateCase(item.caseId);
    const status = passed ? 'pass' : 'fail';
    cases.push({
      caseId: item.caseId,
      gate: item.gate,
      expectedStatus: item.expectedStatus,
      status,
    });
    if (!passed) failures.push(item.caseId);
  }
  return { cases, failures };
}

export function buildGoldenSetReport() {
  const result = runCases();
  const status = result.failures.length ? 'fail' : 'pass';
  return simpleStatus('goldenSetStatus', status, {
    reasonCodes: result.failures.length ? ['golden_set_failed'] : [],
    caseCount: result.cases.length,
    cases: result.cases,
  });
}

try {
  const report = buildGoldenSetReport();
  writeJsonReport(report, 'CODEX_GOLDEN_SET_REPORT');
  exitFor(report);
} catch {
  const report = {
    marker,
    harnessVersion: HARNESS_VERSION,
    goldenSetStatus: { status: 'fail', reasonCodes: ['unexpected_error'], safeSummaryOnly: true },
    valuesPrinted: false,
    status: 'fail',
  };
  writeJsonReport(report, 'CODEX_GOLDEN_SET_REPORT');
  process.exit(1);
}
