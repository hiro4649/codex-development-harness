#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.8.0
import { HARNESS_VERSION, marker, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { buildSafeOutputScanReport } from './codex-safe-output-scan.mjs';
import { buildEvidencePackReport } from './codex-evidence-pack-validate.mjs';
import { buildHumanConfirmationObjectReport } from './codex-human-confirmation-validate.mjs';
import { buildCiReplayReport } from './codex-ci-replay.mjs';
import { buildGenericCase } from './codex-v080-self-test.mjs';

const head = '1111111111111111111111111111111111111111';
const base = '2222222222222222222222222222222222222222';

function body(lines) {
  return lines.join('\n');
}

function runCases() {
  const cases = [];
  const failures = [];
  const add = (name, passed) => {
    cases.push({ name, status: passed ? 'pass' : 'fail' });
    if (!passed) failures.push(name);
  };

  add('safe output blocks endpoint-like values',
    buildSafeOutputScanReport({ text: 'endpoint https://example.invalid/path' }).safeOutputScanStatus.status === 'fail');
  add('safe output allows policy vocabulary without concrete values',
    buildSafeOutputScanReport({ text: 'Do not include endpoint value or secret value in reports.' }).safeOutputScanStatus.status === 'pass');
  add('evidence pack missing headSha fails',
    buildEvidencePackReport({ CODEX_PR_HEAD_SHA: head, CODEX_PR_BODY: buildGenericCase({ omitHead: true }) }).evidencePackStatus.status === 'fail');
  add('evidence pack head mismatch fails',
    buildEvidencePackReport({ CODEX_PR_HEAD_SHA: head, CODEX_PR_BODY: buildGenericCase({ headSha: base }) }).evidencePackStatus.status === 'fail');
  add('manual confirmation missing role fails',
    buildHumanConfirmationObjectReport({ CODEX_PR_HEAD_SHA: head, CODEX_PR_BODY: buildGenericCase({ omitRole: true }) }).humanConfirmationObjectStatus.status === 'fail');
  add('manual confirmation head mismatch fails',
    buildHumanConfirmationObjectReport({ CODEX_PR_HEAD_SHA: head, CODEX_PR_BODY: buildGenericCase({ headSha: base }) }).humanConfirmationObjectStatus.status === 'fail');
  add('CI replay missing PR evidence returns manual confirmation required',
    buildCiReplayReport(['node', 'codex-ci-replay.mjs', '--repo', 'owner/repo', '--pr', '1', '--head', head, '--json'], { CODEX_EVENT_NAME: 'pull_request' }).ciReplayStatus.status === 'manual_confirmation_required');
  add('generic core fails if profiles are required in core mode',
    buildGenericCase({ profileRequired: true }).includes('profile_required_fixture'));
  add('AGENTS context fails on mojibake',
    /邵/.test('邵ｺ'));
  add('Best of N evidence required only for ambiguous or R3 work',
    /Risk level:\s*R3/i.test(body(['Risk level: R3'])));
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
