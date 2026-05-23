#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.2
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildPrBodyLintReport } from './codex-pr-body-lint.mjs';
import { buildHumanConfirmationObjectReport } from './codex-human-confirmation-validate.mjs';

export const HARNESS_VERSION = '0.7.2';
export const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--json') args.json = true;
    else if (item === '--repo') args.repo = argv[++i];
    else if (item === '--pr') args.pr = argv[++i];
    else if (item === '--head') args.head = argv[++i];
    else if (item === '--base') args.base = argv[++i];
    else if (item === '--body') args.body = argv[++i];
  }
  return args;
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch {
    return null;
  }
}

function prBodySource(args, env) {
  if (args.body && readText(args.body) !== null) return { source: 'body_file_arg', path: args.body };
  if (env.CODEX_PR_BODY) return { source: 'CODEX_PR_BODY' };
  if (env.CODEX_PR_BODY_PATH && readText(env.CODEX_PR_BODY_PATH) !== null) return { source: 'CODEX_PR_BODY_PATH', path: env.CODEX_PR_BODY_PATH };
  if (env.GITHUB_EVENT_PATH && readText(env.GITHUB_EVENT_PATH) !== null) return { source: 'GITHUB_EVENT_PATH', path: env.GITHUB_EVENT_PATH };
  return { source: 'missing' };
}

function confirmationSource(env) {
  if (env.CODEX_MANUAL_CONFIRMATION_PATH) return 'manual_confirmation_file';
  if (env.CODEX_EVIDENCE_PACK_PATH) return 'evidence_pack';
  if (env.CODEX_PR_BODY || env.CODEX_PR_BODY_PATH || env.GITHUB_EVENT_PATH) return 'pr_body';
  return 'missing';
}

export function buildCiReplayReport(argv = process.argv, env = process.env) {
  const args = parseArgs(argv);
  const reasonCodes = [];
  if (!args.repo || !args.pr || !args.head) {
    return {
      marker,
      harnessVersion: HARNESS_VERSION,
      ciReplayStatus: {
        status: 'not_applicable',
        reasonCodes: ['ci_replay_arguments_missing'],
        safeSummaryOnly: true,
      },
      localRemoteParityStatus: {
        status: 'not_applicable',
        reasonCodes: ['ci_replay_not_requested'],
        safeSummaryOnly: true,
      },
      prBodySource: prBodySource(args, env).source,
      confirmationSource: confirmationSource(env),
      valuesPrinted: false,
      status: 'not_applicable',
    };
  }

  const replayEnv = {
    ...env,
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_NUMBER: String(args.pr),
    CODEX_PR_HEAD_SHA: String(args.head),
    CODEX_PR_BASE_SHA: String(args.base || env.CODEX_PR_BASE_SHA || ''),
    CODEX_REPOSITORY: String(args.repo),
    CODEX_GITHUB_API_AVAILABLE: env.CODEX_GITHUB_API_AVAILABLE || '1',
  };
  if (args.body) replayEnv.CODEX_PR_BODY_PATH = args.body;

  const bodySource = prBodySource(args, replayEnv);
  if (bodySource.source === 'missing') reasonCodes.push('missing_remote_evidence');

  const lint = buildPrBodyLintReport(replayEnv, ['node', 'codex-pr-body-lint.mjs', '--json', ...(args.body ? ['--body', args.body] : []), '--head', args.head]);
  const confirmation = buildHumanConfirmationObjectReport(replayEnv);

  const parityReasons = [];
  if (lint.status === 'fail') parityReasons.push('local_ci_parity_mismatch');
  if (confirmation.status === 'fail') parityReasons.push('manual_confirmation_invalid');
  if (confirmation.status === 'manual_confirmation_required') parityReasons.push('missing_human_confirmation');

  const status = reasonCodes.length || parityReasons.includes('local_ci_parity_mismatch') || parityReasons.includes('manual_confirmation_invalid')
    ? 'fail'
    : parityReasons.length ? 'manual_confirmation_required' : 'pass';

  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    ciReplayStatus: {
      status,
      reasonCodes: [...new Set([...reasonCodes, ...parityReasons])],
      safeSummaryOnly: true,
    },
    localRemoteParityStatus: {
      status: status === 'fail' ? 'fail' : status === 'manual_confirmation_required' ? 'manual_confirmation_required' : 'pass',
      reasonCodes: [...new Set(parityReasons)],
      safeSummaryOnly: true,
    },
    prBodySource: bodySource.source,
    confirmationSource: confirmationSource(replayEnv),
    valuesPrinted: false,
    status,
  };
}

function printReport(report) {
  const jsonMode = process.env.CODEX_CI_REPLAY_REPORT === 'json' ||
    process.env.CODEX_QUALITY_REPORT === 'json' ||
    process.argv.includes('--json');
  if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    console.log(`ciReplayStatus: ${report.ciReplayStatus.status}`);
    console.log(`localRemoteParityStatus: ${report.localRemoteParityStatus.status}`);
  }
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMain()) {
  try {
    const report = buildCiReplayReport();
    printReport(report);
    process.exit(report.status === 'fail' ? 1 : 0);
  } catch {
    const report = {
      marker,
      harnessVersion: HARNESS_VERSION,
      ciReplayStatus: {
        status: 'fail',
        reasonCodes: ['unexpected_error'],
        safeSummaryOnly: true,
      },
      localRemoteParityStatus: {
        status: 'fail',
        reasonCodes: ['unexpected_error'],
        safeSummaryOnly: true,
      },
      prBodySource: 'unknown',
      confirmationSource: 'unknown',
      valuesPrinted: false,
      status: 'fail',
    };
    printReport(report);
    process.exit(1);
  }
}
