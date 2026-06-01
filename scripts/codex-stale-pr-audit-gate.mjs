#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, isPrContext, prBodyText, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function headShaValues(body) {
  const values = [];
  const text = String(body || '');
  for (const match of text.matchAll(/"headSha"\s*:\s*"([a-f0-9]{40})"/gi)) values.push(match[1]);
  for (const match of text.matchAll(/\bhead SHA\s*:\s*([a-f0-9]{40})/gi)) values.push(match[1]);
  return [...new Set(values)];
}

function currentHarnessVersionMentions(body) {
  return /(?:current|source|harness)\s+v0\.(?:6|7|8\.0|8\.1)\b/i.test(body);
}

function touchesHarnessFiles(env) {
  return String(env.CODEX_CHANGED_FILES || '').split(/\r?\n|,/).some((file) =>
    /^(scripts\/codex-|docs\/process\/|AGENTS\.md|\.github\/workflows\/quality-gate\.yml|CODEX_SOURCE_HARNESS_MANIFEST\.json)/.test(file.trim()));
}

export function buildStalePrAuditReport(env = process.env) {
  if (!isPrContext(env)) {
    return simpleStatus('stalePrAuditStatus', 'not_applicable', { reasonCodes: ['no_pr_context'] });
  }
  const body = prBodyText(env);
  const currentHead = env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || '';
  const reasonCodes = [];
  const heads = headShaValues(body);
  if (currentHead && heads.some((head) => head !== currentHead)) reasonCodes.push('stale_confirmation_detected');
  if (currentHead && heads.length && !heads.includes(currentHead)) reasonCodes.push('stale_evidence');
  if (currentHarnessVersionMentions(body)) reasonCodes.push('stale_harness_version_in_pr');
  if (env.CODEX_PR_BASE_SHA && env.CODEX_BASELINE_BASE_SHA && env.CODEX_PR_BASE_SHA !== env.CODEX_BASELINE_BASE_SHA) {
    reasonCodes.push('stale_pr_detected');
  }
  if (env.CODEX_PR_CREATED_BEFORE_HARNESS_VERSION === '1' && touchesHarnessFiles(env)) reasonCodes.push('stale_pr_detected');
  return simpleStatus('stalePrAuditStatus', reasonCodes.length ? 'fail' : 'pass', {
    reasonCodes: [...new Set(reasonCodes)],
    evidenceHeadCount: heads.length,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildStalePrAuditReport();
    writeJsonReport(report, 'CODEX_STALE_PR_AUDIT_REPORT');
    exitFor(report);
  } catch {
    const report = {
      marker,
      harnessVersion: HARNESS_VERSION,
      stalePrAuditStatus: { status: 'fail', reasonCodes: ['stale_pr_detected'], safeSummaryOnly: true },
      valuesPrinted: false,
      status: 'fail',
    };
    writeJsonReport(report, 'CODEX_STALE_PR_AUDIT_REPORT');
    process.exit(1);
  }
}
