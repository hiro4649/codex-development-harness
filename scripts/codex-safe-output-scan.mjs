#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { classifyUnsafeValue } from './codex-unsafe-value-action-matrix.mjs';

export const HARNESS_VERSION = '1.0.1';
export const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;

const forbiddenFieldNames = new Set([
  'rawDiff',
  'rawLogs',
  'secretValue',
  'endpointValue',
  'privatePath',
  'rawPayload',
  'payload',
  'productionData',
  'personalData',
]);

const safePolicyVocabulary = [
  'raw payload',
  'raw logs',
  'raw diff',
  'endpoint value',
  'secret value',
  'private path',
  'production data',
  'personal data',
];

const safeLabelAllowlist = new Set([
  'unsafe_value_detected',
  'npm_skip_not_allowed_for_product_change',
  'safe_policy_vocabulary',
  'forbidden_field_name_detected',
  'manual_confirmation_required',
  'evidence_pack_missing',
  'evidence_pack_invalid',
]);

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--json') args.json = true;
    else if (item === '--file') args.file = argv[++i];
    else if (item === '--text') args.text = argv[++i] || '';
  }
  return args;
}

function isLikelySafePolicyText(text) {
  const lower = String(text || '').toLowerCase();
  if (/\b(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/[^\s<>"'`]+/i.test(lower) ||
    /\b(?:gh[pousr]_|sk-|AKIA|glpat-|npm_|xox[baprs]-)[A-Za-z0-9_-]{8,}\b/.test(text) ||
    /\b[A-Za-z]:\\Users\\[^"'`\s]+|\/home\/[^"'`\s]+/i.test(text)) {
    return false;
  }
  return safePolicyVocabulary.some((term) => lower.includes(term)) &&
    /\b(forbidden|must not|do not|unsafe|safe summary|policy|category|label)\b/i.test(lower);
}

function valueFindings(value, pathLabel) {
  const text = String(value || '');
  if (!text) return [];
  if (safeLabelAllowlist.has(text.trim())) return [];
  if (String(pathLabel || '').includes('safePolicyVocabulary')) return [];
  if (isLikelySafePolicyText(text)) return [];
  const classified = classifyUnsafeValue(text, pathLabel);
  if (classified.reasonCode && classified.action === 'fail_required') {
    return [{
      reasonCode: classified.reasonCode,
      path: pathLabel,
      unsafeClass: classified.unsafeClass,
      action: classified.action,
    }];
  }
  if (classified.action === 'allow_if_safe_context' || classified.action === 'ignore_false_positive') return [];
  const findings = [];
  const rules = [
    ['unsafe_url_or_endpoint_value', /\b(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/[^\s<>"'`]+/i],
    ['unsafe_token_like_value', /\b(?:gh[pousr]_|sk-|AKIA|glpat-|npm_|xox[baprs]-)[A-Za-z0-9_-]{8,}\b/],
    ['unsafe_private_key_value', /-----BEGIN [^-]+PRIVATE KEY-----/i],
    ['unsafe_jwt_like_value', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
    ['unsafe_private_path_value', /\b[A-Za-z]:\\Users\\[^"'`\s]+|\/home\/[^"'`\s]+/i],
  ];
  for (const [reasonCode, pattern] of rules) {
    if (pattern.test(text)) findings.push({ reasonCode, path: pathLabel });
  }
  return findings;
}

export function scanSafeOutput(value, options = {}) {
  const findings = [];
  const visit = (node, pathLabel) => {
    if (node === null || node === undefined) return;
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      findings.push(...valueFindings(node, pathLabel));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${pathLabel}[${index}]`));
      return;
    }
    if (typeof node === 'object') {
      for (const [key, nested] of Object.entries(node)) {
        if (forbiddenFieldNames.has(key)) {
          findings.push({ reasonCode: 'forbidden_field_name_detected', path: pathLabel ? `${pathLabel}.${key}` : key });
        }
        visit(nested, pathLabel ? `${pathLabel}.${key}` : key);
      }
    }
  };
  visit(value, options.rootLabel || 'report');
  return {
    findings,
    safePolicyVocabularyAllowed: true,
    safeLabelAllowlist: [...safeLabelAllowlist],
    unsafeClasses: [...new Set(findings.map((item) => item.unsafeClass).filter(Boolean))],
  };
}

export function buildSafeOutputScanReport(input, env = process.env) {
  let parsed = input;
  let source = 'object';
  const failures = [];
  if (parsed === undefined) {
    const file = env.CODEX_SAFE_OUTPUT_SCAN_FILE || env.CODEX_QUALITY_REPORT_PATH || '';
    if (file) {
      source = 'file';
      const text = readText(file);
      if (text === null) failures.push('safe_output_scan_file_unreadable');
      else {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }
    } else {
      parsed = { safePolicyVocabulary };
      source = 'default_policy_fixture';
    }
  }
  const scan = scanSafeOutput(parsed);
  const reasonCodes = [...new Set([...failures, ...scan.findings.map((item) => item.reasonCode)])];
  const status = reasonCodes.length ? 'fail' : 'pass';
  return {
    marker,
    harnessVersion: HARNESS_VERSION,
    safeOutputScanStatus: {
      status,
      source,
      reasonCodes,
      findingsCount: scan.findings.length,
      unsafeClasses: scan.unsafeClasses,
      safePolicyVocabularyAllowed: scan.safePolicyVocabularyAllowed,
      safeSummaryOnly: true,
    },
    valuesPrinted: false,
    status,
    safeSummary: status === 'pass'
      ? 'Safe output scanner passed.'
      : 'Safe output scanner failed; see safe reason codes only.',
  };
}

function printReport(report) {
  const jsonMode = process.env.CODEX_SAFE_OUTPUT_SCAN_REPORT === 'json' ||
    process.env.CODEX_QUALITY_REPORT === 'json' ||
    process.argv.includes('--json');
  if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    console.log(`safeOutputScanStatus: ${report.safeOutputScanStatus.status}`);
    console.log(report.safeSummary);
  }
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMain()) {
  try {
    const args = parseArgs(process.argv);
    let input;
    if (args.file) {
      const text = readText(args.file);
      if (text !== null) {
        try {
          input = JSON.parse(text);
        } catch {
          input = text;
        }
      }
    } else if (args.text) {
      input = args.text;
    }
    const report = buildSafeOutputScanReport(input);
    printReport(report);
    process.exit(report.status === 'fail' ? 1 : 0);
  } catch {
    const report = {
      marker,
      harnessVersion: HARNESS_VERSION,
      safeOutputScanStatus: {
        status: 'fail',
        reasonCodes: ['unexpected_error'],
        safeSummaryOnly: true,
      },
      valuesPrinted: false,
      status: 'fail',
      safeSummary: 'Safe output scanner failed with an internal error.',
    };
    printReport(report);
    process.exit(1);
  }
}
