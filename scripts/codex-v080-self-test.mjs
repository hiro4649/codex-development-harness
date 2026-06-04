#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildProductionReadinessReport } from './codex-production-readiness-gate.mjs';
import { HARNESS_VERSION, marker, writeJsonReport } from './codex-v080-lib.mjs';
import {
  cleanAgentsContext,
  curatorReport,
  mojibakeAgentsContext,
  offlineEvolutionProposal,
  safeTraceEvent,
  sourceManifest,
} from './codex-v080-fixtures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(here);

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

  write(path.join(tmp, 'AGENTS.md'), mojibakeAgentsContext());
  let result = runScript('scripts/codex-agents-context-gate.mjs', { cwd: tmp });
  assertCase('AGENTS mojibake fails', result.parsed?.agentsContextStatus?.status === 'fail', failures, cases, result.parsed?.agentsContextStatus?.status);

  write(path.join(tmp, 'AGENTS.md'), cleanAgentsContext());
  result = runScript('scripts/codex-agents-context-gate.mjs', { cwd: tmp });
  assertCase('AGENTS clean context passes', result.parsed?.agentsContextStatus?.status === 'pass', failures, cases, result.parsed?.agentsContextStatus?.status);

  write(path.join(tmp, 'CODEX_SOURCE_HARNESS_MANIFEST.json'), JSON.stringify(sourceManifest('optional')));
  for (const file of ['scripts/codex-local-quality-gate.mjs', '.github/workflows/quality-gate.yml', '.github/workflows/weekly-health-check.yml']) {
    write(path.join(tmp, file), '// core file');
  }
  result = runScript('scripts/codex-generic-harness-core-gate.mjs', { cwd: tmp, env: { CODEX_HARNESS_MODE: 'core', CODEX_PROFILE_COMPAT_MODE: 'on' } });
  assertCase('Generic core fails when profiles are required in core mode', result.parsed?.genericHarnessCoreStatus?.status === 'fail', failures, cases, result.parsed?.genericHarnessCoreStatus?.status);
  result = runScript('scripts/codex-generic-harness-core-gate.mjs', { cwd: tmp, env: { CODEX_HARNESS_MODE: 'core', CODEX_PROFILE_COMPAT_MODE: 'optional' } });
  assertCase('Generic core passes when profiles are optional', result.parsed?.genericHarnessCoreStatus?.status === 'pass', failures, cases, result.parsed?.genericHarnessCoreStatus?.status);

  result = runScript('scripts/codex-golden-set-gate.mjs');
  assertCase('Golden Set positive and negative fixtures pass', result.parsed?.goldenSetStatus?.status === 'pass', failures, cases, result.parsed?.goldenSetStatus?.status);

  const goNoGoHeading = buildProductionReadinessReport({
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_HEAD_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    CODEX_PR_BODY: [
      'Production Go/No-Go:',
      'No production readiness claim.',
      'Risk level: R1',
      'Human confirmation needed: not required with reason - cleanup only.',
      'Residual risks: none beyond cleanup review.',
    ].join('\n'),
  });
  assertCase('Production Go/No-Go heading alone is not a go claim', goNoGoHeading.productionReadinessStatus.status === 'pass', failures, cases, goNoGoHeading.productionReadinessStatus.status);

  result = runScript('scripts/codex-safe-trace-schema-gate.mjs', { cwd: tmp });
  assertCase('Safe trace absent returns not_applicable', result.parsed?.safeTraceSchemaStatus?.status === 'not_applicable', failures, cases, result.parsed?.safeTraceSchemaStatus?.status);
  const traceDir = path.join(tmp, '.codex', 'experience', 'traces');
  write(path.join(traceDir, 'valid.jsonl'), `${JSON.stringify(safeTraceEvent())}\n`);
  result = runScript('scripts/codex-safe-trace-schema-gate.mjs', { cwd: tmp });
  assertCase('Safe trace valid fixture passes', result.parsed?.safeTraceSchemaStatus?.status === 'pass', failures, cases, result.parsed?.safeTraceSchemaStatus?.status);
  write(path.join(traceDir, 'valid.jsonl'), `${JSON.stringify(safeTraceEvent({ rawValuesStored: true }))}\n`);
  result = runScript('scripts/codex-safe-trace-schema-gate.mjs', { cwd: tmp });
  assertCase('Safe trace unsafe fixture fails', result.parsed?.safeTraceSchemaStatus?.status === 'fail', failures, cases, result.parsed?.safeTraceSchemaStatus?.status);
  fs.rmSync(path.join(tmp, '.codex'), { recursive: true, force: true });

  result = runScript('scripts/codex-curator-report-gate.mjs', { cwd: tmp });
  assertCase('Curator report absent returns not_applicable', result.parsed?.curatorReportStatus?.status === 'not_applicable', failures, cases, result.parsed?.curatorReportStatus?.status);
  write(path.join(tmp, '.codex', 'curator-report.json'), JSON.stringify(curatorReport({ autoApply: true })));
  result = runScript('scripts/codex-curator-report-gate.mjs', { cwd: tmp });
  assertCase('Curator report with autoApply true fails', result.parsed?.curatorReportStatus?.status === 'fail', failures, cases, result.parsed?.curatorReportStatus?.status);
  fs.rmSync(path.join(tmp, '.codex'), { recursive: true, force: true });

  result = runScript('scripts/codex-offline-evolution-proposal-gate.mjs', { cwd: tmp });
  assertCase('Offline proposal absent returns not_applicable', result.parsed?.offlineEvolutionProposalStatus?.status === 'not_applicable', failures, cases, result.parsed?.offlineEvolutionProposalStatus?.status);
  write(path.join(tmp, '.codex', 'offline-evolution-proposal.json'), JSON.stringify(offlineEvolutionProposal({ autoCommit: true })));
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
    safeSummary: failures.length ? 'v0.8.1 self-test failed; see safe labels only.' : 'v0.8.1 self-test passed.',
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
      safeSummary: 'v0.8.1 self-test failed with an internal error.',
    };
    writeJsonReport(report, 'CODEX_V080_SELF_TEST_REPORT');
    process.exit(1);
  }
}
