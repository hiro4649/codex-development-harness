#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import fs from 'node:fs';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { buildPrBodyLintReport } from './codex-pr-body-lint.mjs';
import { buildHumanConfirmationObjectReport } from './codex-human-confirmation-validate.mjs';

export const HARNESS_VERSION = '1.0.1';
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

function effectiveArgs(args, env) {
  return {
    ...args,
    repo: args.repo || env.CODEX_REPOSITORY || env.GITHUB_REPOSITORY || '',
    pr: args.pr || env.CODEX_PR_NUMBER || '',
    head: args.head || env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || '',
    base: args.base || env.CODEX_PR_BASE_SHA || '',
  };
}

function isPrContext(env, args) {
  return env.CODEX_EVENT_NAME === 'pull_request' ||
    Boolean(env.CODEX_PR_NUMBER) ||
    Boolean(env.GITHUB_REF && env.GITHUB_REF.includes('/pull/')) ||
    Boolean(args.repo && args.pr && args.head);
}

function githubToken(env) {
  return env.CODEX_GITHUB_TOKEN || env.GITHUB_TOKEN || '';
}

function requestJson(url, token) {
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'codex-development-harness',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${token}`,
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          resolve({ ok: false, statusCode: res.statusCode });
          return;
        }
        try {
          resolve({ ok: true, value: JSON.parse(data) });
        } catch {
          resolve({ ok: false, statusCode: res.statusCode, parseFailed: true });
        }
      });
    });
    req.on('error', () => resolve({ ok: false }));
    req.end();
  });
}

function githubUrl(repo, suffix) {
  return `https://api.github.com/repos/${repo}/${suffix}`;
}

function confirmationSourceFromRemote(prBody, comments, reviews) {
  const confirmationPattern = /\bconfirmedByRole\b|\bcodexManualConfirmation\b|\bBEGIN_CODEX_MANUAL_CONFIRMATION_JSON\b/i;
  if (confirmationPattern.test(prBody || '')) return 'github_api_pr_body';
  if ((comments || []).some((item) => confirmationPattern.test(item.body || ''))) return 'github_api_comment';
  if ((reviews || []).some((item) => confirmationPattern.test(item.body || ''))) return 'github_api_review';
  if ((reviews || []).some((item) => String(item.state || '').toUpperCase() === 'APPROVED')) return 'github_api_review_approval';
  return 'missing';
}

async function fetchGithubReplayInputs(args, env) {
  if (env.CODEX_GITHUB_REPLAY_FIXTURE_PATH) {
    const text = readText(env.CODEX_GITHUB_REPLAY_FIXTURE_PATH);
    if (text === null) return { ok: false, reasonCode: 'missing_remote_evidence' };
    try {
      const fixture = JSON.parse(text);
      return fixture?.ok === false ? fixture : { ok: true, ...fixture };
    } catch {
      return { ok: false, reasonCode: 'missing_remote_evidence' };
    }
  }
  const token = githubToken(env);
  if (!token) return { ok: false, reasonCode: 'github_api_unavailable' };
  const pr = await requestJson(githubUrl(args.repo, `pulls/${args.pr}`), token);
  const comments = await requestJson(githubUrl(args.repo, `issues/${args.pr}/comments?per_page=100`), token);
  const reviews = await requestJson(githubUrl(args.repo, `pulls/${args.pr}/reviews?per_page=100`), token);
  const files = await requestJson(githubUrl(args.repo, `pulls/${args.pr}/files?per_page=100`), token);
  if (!pr.ok || !comments.ok || !reviews.ok || !files.ok) return { ok: false, reasonCode: 'missing_remote_evidence' };
  return {
    ok: true,
    pr: pr.value,
    comments: Array.isArray(comments.value) ? comments.value : [],
    reviews: Array.isArray(reviews.value) ? reviews.value : [],
    files: Array.isArray(files.value) ? files.value : [],
  };
}

export async function defaultGithubReplayClient(args, env = process.env) {
  return fetchGithubReplayInputs(args, env);
}

export function buildGithubReplayContextFromData(argsInput, env = process.env, remote) {
  const args = effectiveArgs(argsInput, env);
  if (!remote?.ok) {
    const reasonCode = remote?.reasonCode || 'github_api_unavailable';
    return {
      status: 'manual_confirmation_required',
      reasonCodes: [reasonCode],
      env: {},
      prBodySource: reasonCode,
      confirmationSource: 'unknown',
      safeSummaryOnly: true,
    };
  }

  const remoteHead = remote.pr?.head?.sha || '';
  const remoteBase = remote.pr?.base?.sha || args.base || '';
  const reasonCodes = [];
  if (!remoteHead) reasonCodes.push('missing_head_sha');
  else if (String(remoteHead).toLowerCase() !== String(args.head).toLowerCase()) {
    reasonCodes.push('head_sha_mismatch', 'stale_evidence');
  }

  const prBody = remote.pr?.body || '';
  const commentsText = (remote.comments || []).map((item) => item.body || '').filter(Boolean).join('\n');
  const reviewsText = (remote.reviews || []).map((item) => item.body || '').filter(Boolean).join('\n');
  const changedFiles = (remote.files || []).map((item) => item.filename || '').filter(Boolean).join('\n');
  const replayEnv = {
    CODEX_EVENT_NAME: 'pull_request',
    CODEX_PR_NUMBER: String(args.pr),
    CODEX_PR_HEAD_SHA: String(args.head),
    CODEX_PR_BASE_SHA: String(remoteBase),
    CODEX_REPOSITORY: String(args.repo),
    CODEX_GITHUB_API_AVAILABLE: '1',
    CODEX_CHANGED_FILES: changedFiles,
    CODEX_PR_BODY: prBody,
    CODEX_PR_COMMENTS: commentsText,
    CODEX_PR_REVIEWS: reviewsText,
  };

  return {
    status: reasonCodes.length ? 'fail' : 'pass',
    reasonCodes,
    env: replayEnv,
    prBodySource: prBody ? 'github_api_pr_body' : 'missing',
    confirmationSource: confirmationSourceFromRemote(prBody, remote.comments || [], remote.reviews || []),
    safeSummaryOnly: true,
  };
}

function classifyReplay(args, replayEnv, bodySource, confirmationSourceLabel, lint, confirmation, extraReasons = []) {
  const reasonCodes = [...extraReasons];
  if (bodySource === 'missing') reasonCodes.push('missing_remote_evidence');

  const parityReasons = [];
  if (lint.status === 'fail') parityReasons.push('local_ci_parity_mismatch');
  if (confirmation.status === 'fail') parityReasons.push('manual_confirmation_invalid');
  if (confirmation.status === 'manual_confirmation_required') parityReasons.push('missing_human_confirmation');

  const status = reasonCodes.includes('head_sha_mismatch') ||
    reasonCodes.includes('stale_evidence') ||
    parityReasons.includes('local_ci_parity_mismatch') ||
    parityReasons.includes('manual_confirmation_invalid')
    ? 'fail'
    : reasonCodes.length || parityReasons.length ? 'manual_confirmation_required' : 'pass';

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
    prBodySource: bodySource,
    confirmationSource: confirmationSourceLabel || confirmationSource(replayEnv),
    valuesPrinted: false,
    status,
  };
}

export function buildCiReplayReport(argv = process.argv, env = process.env) {
  const args = effectiveArgs(parseArgs(argv), env);
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
  if (bodySource.source === 'missing') {
    const status = isPrContext(env, args) ? 'manual_confirmation_required' : 'not_applicable';
    return {
      marker,
      harnessVersion: HARNESS_VERSION,
      ciReplayStatus: {
        status,
        reasonCodes: [status === 'not_applicable' ? 'ci_replay_not_requested' : 'missing_remote_evidence'],
        safeSummaryOnly: true,
      },
      localRemoteParityStatus: {
        status,
        reasonCodes: [status === 'not_applicable' ? 'ci_replay_not_requested' : 'missing_remote_evidence'],
        safeSummaryOnly: true,
      },
      prBodySource: 'missing',
      confirmationSource: confirmationSource(replayEnv),
      valuesPrinted: false,
      status,
    };
  }

  const lint = buildPrBodyLintReport(replayEnv, ['node', 'codex-pr-body-lint.mjs', '--json', ...(args.body ? ['--body', args.body] : []), '--head', args.head]);
  const confirmation = buildHumanConfirmationObjectReport(replayEnv);
  return classifyReplay(args, replayEnv, bodySource.source, confirmationSource(replayEnv), lint, confirmation, reasonCodes);
}

export function buildCiReplayReportFromGithubData(argsInput, env = process.env, remote) {
  const args = effectiveArgs(argsInput, env);
  const context = buildGithubReplayContextFromData(args, env, remote);
  if (context.status === 'manual_confirmation_required') {
    return {
      marker,
      harnessVersion: HARNESS_VERSION,
      ciReplayStatus: {
        status: context.status,
        reasonCodes: context.reasonCodes,
        safeSummaryOnly: true,
      },
      localRemoteParityStatus: {
        status: context.status,
        reasonCodes: context.reasonCodes,
        safeSummaryOnly: true,
      },
      prBodySource: context.prBodySource,
      confirmationSource: context.confirmationSource,
      valuesPrinted: false,
      status: context.status,
    };
  }
  const replayEnv = {
    ...env,
    ...context.env,
  };
  const lint = buildPrBodyLintReport(replayEnv, ['node', 'codex-pr-body-lint.mjs', '--json', '--head', args.head]);
  const confirmation = buildHumanConfirmationObjectReport(replayEnv);
  return classifyReplay(
    args,
    replayEnv,
    context.prBodySource,
    context.confirmationSource,
    lint,
    confirmation,
    context.reasonCodes,
  );
}

export async function buildGithubReplayContextAsync(argsInput, env = process.env, githubClient = defaultGithubReplayClient) {
  const args = effectiveArgs(argsInput, env);
  if (!args.repo || !args.pr || !args.head) {
    return {
      status: 'not_applicable',
      reasonCodes: ['ci_replay_arguments_missing'],
      env: {},
      prBodySource: prBodySource(args, env).source,
      confirmationSource: confirmationSource(env),
      safeSummaryOnly: true,
    };
  }
  const token = githubToken(env);
  if (!token && !env.CODEX_GITHUB_REPLAY_FIXTURE_PATH) {
    return {
      status: isPrContext(env, args) ? 'manual_confirmation_required' : 'not_applicable',
      reasonCodes: [isPrContext(env, args) ? 'github_api_unavailable' : 'ci_replay_not_requested'],
      env: {},
      prBodySource: 'github_api_unavailable',
      confirmationSource: 'unknown',
      safeSummaryOnly: true,
    };
  }
  const remote = await githubClient(args, env);
  return buildGithubReplayContextFromData(args, env, remote);
}

export async function buildCiReplayReportAsync(argv = process.argv, env = process.env, githubClient = defaultGithubReplayClient) {
  const args = effectiveArgs(parseArgs(argv), env);
  if (!args.repo || !args.pr || !args.head) return buildCiReplayReport(argv, env);
  const token = githubToken(env);
  if (!token && !env.CODEX_GITHUB_REPLAY_FIXTURE_PATH) {
    const base = buildCiReplayReport(argv, env);
    if (!isPrContext(env, args)) return base;
    return {
      ...base,
      ciReplayStatus: {
        status: 'manual_confirmation_required',
        reasonCodes: ['github_api_unavailable'],
        safeSummaryOnly: true,
      },
      localRemoteParityStatus: {
        status: 'manual_confirmation_required',
        reasonCodes: ['github_api_unavailable'],
        safeSummaryOnly: true,
      },
      status: 'manual_confirmation_required',
    };
  }

  const remote = await githubClient(args, env);
  return buildCiReplayReportFromGithubData(args, env, remote);
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
    const report = await buildCiReplayReportAsync();
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
