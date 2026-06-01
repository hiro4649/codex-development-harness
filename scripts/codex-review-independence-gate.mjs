#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { fileURLToPath } from 'node:url';
import { prBodyText, simpleStatus, writeJsonReport, exitFor, normalizePath } from './codex-v080-lib.mjs';

const PRODUCT_PATH = /^(src|apps|contracts|runtime|profiles\/|package\.json|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)(\/|$)/;

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function changedFiles(env = process.env) {
  const parsed = parseJson(env.CODEX_CHANGED_FILES, []);
  return Array.isArray(parsed) ? parsed.map(normalizePath) : [];
}

export function buildReviewIndependenceReport(env = process.env) {
  const body = env.CODEX_REVIEW_BODY || prBodyText(env);
  const data = parseJson(env.CODEX_REVIEW_INDEPENDENCE_JSON, {});
  const files = data.changedFiles || changedFiles(env);
  const productChanged = files.some((file) => PRODUCT_PATH.test(file));
  const writer = data.writerEvidence || /writer evidence:\s*(present|yes)|writer summary/i.test(body);
  const reviewer = data.reviewEvidence || /reviewer checklist:\s*(present|yes)|independent checklist/i.test(body);
  const checklist = data.reviewChecklist || /review checklist|independent checklist|negative case check|scope boundary check/i.test(body);
  const productNo = data.productCodeChanged === false || /product code changed:\s*no/i.test(body) || !productChanged;
  const runtimeNo = data.runtimeReadinessClaimed === false || /runtime readiness claimed:\s*no/i.test(body) || !/runtime readiness claimed:\s*yes/i.test(body);
  const failures = [];
  const manuals = [];

  if ((env.CODEX_EVENT_NAME === 'pull_request' || env.CODEX_PR_NUMBER || body) && !writer) failures.push('writer_only_review_detected');
  if ((env.CODEX_EVENT_NAME === 'pull_request' || env.CODEX_PR_NUMBER || body) && !reviewer) failures.push('review_independence_missing');
  if ((env.CODEX_EVENT_NAME === 'pull_request' || env.CODEX_PR_NUMBER || body) && !checklist) failures.push('review_independence_missing');
  if (productNo && productChanged) failures.push('review_independence_product_scope_mismatch');
  if (!runtimeNo && !data.runtimeOraclePresent) failures.push('runtime_readiness_not_proven');
  if (data.sameSummaryOnly) manuals.push('writer_only_review_detected');
  if (data.reviewedItemsAbstract) manuals.push('review_independence_missing');

  const status = failures.length ? 'fail' : manuals.length ? 'manual_confirmation_required' : 'pass';
  return simpleStatus('reviewIndependenceStatus', status, {
    writerEvidencePresent: Boolean(writer),
    reviewEvidencePresent: Boolean(reviewer),
    reviewChecklistPresent: Boolean(checklist),
    productCodeChanged: productChanged,
    runtimeReadinessClaimed: !runtimeNo,
    reasonCodes: [...new Set([...failures, ...manuals])],
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildReviewIndependenceReport();
  writeJsonReport(report, 'CODEX_REVIEW_INDEPENDENCE_REPORT');
  exitFor(report);
}
