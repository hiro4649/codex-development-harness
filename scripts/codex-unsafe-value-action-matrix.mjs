#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { fileURLToPath } from 'node:url';
import { HARNESS_VERSION, marker, readJson, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

const TOKEN_RE = /\b(?:gh[pousr]_|sk-|AKIA|glpat-|npm_|xox[baprs]-)[A-Za-z0-9_-]{8,}\b/;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/;
const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/i;
const ENDPOINT_RE = /\b(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/[^\s<>"'`]+/i;
const PRIVATE_PATH_RE = /\b[A-Za-z]:\\Users\\[^"'`\s]+|\/home\/[^"'`\s]+/i;

function fieldClass(pathLabel = '') {
  const label = String(pathLabel || '').toLowerCase();
  if (/(reasoncode|reasoncodes|status|label|labels|category|recommendation|nextaction)/.test(label)) return 'reasonCode';
  if (/(raw|log|payload|diff|stdout|stderr)/.test(label)) return 'rawOutput';
  if (/(actualvalue|secret|token|endpoint|privatepath|urlvalue|dburl|cookie|jwt)/.test(label)) return 'actualValue';
  if (/(summary|safemessage|safesummary)/.test(label)) return 'safeSummary';
  return 'unknown';
}

function safeContextForUrl(pathLabel, url) {
  const label = String(pathLabel || '').toLowerCase();
  if (/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/pull\/\d+)?(?:\b|\/)?/i.test(url)) {
    return /(prurl|pullrequesturl|source|repository|htmlurl|url|reference)/.test(label);
  }
  if (/^https:\/\/(?:cdn\.openai\.com|docs\.github\.com|docs\.npmjs\.com|nodejs\.org)\//i.test(url)) {
    return /(doc|source|reference|policy|url)/.test(label);
  }
  return false;
}

export function classifyUnsafeValue(value, pathLabel = 'value') {
  const text = String(value ?? '');
  const cls = fieldClass(pathLabel);
  if (!text) return { unsafeClass: null, action: 'ignore_false_positive', reasonCode: null };
  if (cls === 'reasonCode' && /^[a-z0-9_:-]{1,120}$/i.test(text)) {
    return { unsafeClass: null, action: 'ignore_false_positive', reasonCode: null };
  }
  if (TOKEN_RE.test(text) || JWT_RE.test(text) || /-----BEGIN [^-]+PRIVATE KEY-----/i.test(text)) {
    return { unsafeClass: 'secret_like_value', action: 'fail_required', reasonCode: 'unsafe_value_action_required' };
  }
  if (PRIVATE_PATH_RE.test(text)) {
    return { unsafeClass: 'private_path_value', action: cls === 'safeSummary' ? 'manual_review_required' : 'fail_required', reasonCode: 'unsafe_value_action_required' };
  }
  const urlMatch = text.match(URL_RE);
  if (urlMatch) {
    if (safeContextForUrl(pathLabel, urlMatch[0])) {
      return { unsafeClass: 'public_github_url_value', action: 'allow_if_safe_context', reasonCode: null };
    }
    return { unsafeClass: ENDPOINT_RE.test(text) ? 'internal_endpoint_value' : 'unknown_unsafe_value', action: 'fail_required', reasonCode: 'unsafe_value_action_required' };
  }
  if (/(raw logs?|stack trace|request payload|response payload|production data|personal data)/i.test(text) && cls !== 'reasonCode') {
    return { unsafeClass: /personal/i.test(text) ? 'personal_data_value' : /production/i.test(text) ? 'production_data_value' : /payload/i.test(text) ? 'raw_payload_value' : 'raw_log_value', action: cls === 'safeSummary' ? 'manual_review_required' : 'fail_required', reasonCode: 'unsafe_value_action_required' };
  }
  return { unsafeClass: null, action: 'ignore_false_positive', reasonCode: null };
}

function scan(value, pathLabel = 'report', findings = []) {
  if (value === null || value === undefined) return findings;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const classified = classifyUnsafeValue(value, pathLabel);
    if (classified.reasonCode) findings.push({ path: pathLabel, ...classified });
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scan(item, `${pathLabel}[${index}]`, findings));
    return findings;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, nested]) => scan(nested, `${pathLabel}.${key}`, findings));
  }
  return findings;
}

export function buildUnsafeValueActionMatrixReport(input = null) {
  const value = input ?? { reasonCode: 'npm_skip_not_allowed_for_product_change', prUrl: 'https://github.com/example/repo/pull/1' };
  const findings = scan(value);
  const status = findings.some((item) => item.action === 'fail_required') ? 'fail' : 'pass';
  return simpleStatus('unsafeValueActionMatrixStatus', status, {
    reasonCodes: [...new Set(findings.map((item) => item.reasonCode).filter(Boolean))],
    findingCount: findings.length,
    unsafeClasses: [...new Set(findings.map((item) => item.unsafeClass).filter(Boolean))],
    safeSummaryOnly: true,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const fileIndex = process.argv.indexOf('--file');
    const input = fileIndex >= 0 ? readJson(process.argv[fileIndex + 1] || '').value : null;
    const report = buildUnsafeValueActionMatrixReport(input);
    writeJsonReport(report, 'CODEX_UNSAFE_VALUE_ACTION_MATRIX_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('unsafeValueActionMatrixStatus', 'fail', { reasonCodes: ['unsafe_value_class_unknown'] });
    writeJsonReport(report, 'CODEX_UNSAFE_VALUE_ACTION_MATRIX_REPORT');
    process.exit(1);
  }
}
