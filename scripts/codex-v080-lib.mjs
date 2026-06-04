#!/usr/bin/env node

// CODEX_QUALITY_HARNESS_FILE v1.0.6

import fs from 'node:fs';

import path from 'node:path';



export const HARNESS_VERSION = '1.0.5';

export const marker = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;



export function readText(file) {

  try {

    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');

  } catch {

    return null;

  }

}



export function readJson(file) {

  const text = readText(file);

  if (text === null) return { ok: false, reasonCode: 'file_missing' };

  try {

    return { ok: true, value: JSON.parse(text) };

  } catch {

    return { ok: false, reasonCode: 'json_invalid' };

  }

}



export function writeJsonReport(report, envName) {

  const jsonMode = process.argv.includes('--json') ||

    process.env.CODEX_QUALITY_REPORT === 'json' ||

    (envName && process.env[envName] === 'json');

  if (jsonMode) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  else {

    const key = Object.keys(report).find((name) => name.endsWith('Status'));

    console.log(`${key || 'status'}: ${key ? report[key].status : report.status}`);

    if (report.safeSummary) console.log(report.safeSummary);

  }

}



export function exitFor(report) {

  process.exit(report.status === 'fail' ? 1 : 0);

}



export function isPrContext(env = process.env) {

  return env.CODEX_EVENT_NAME === 'pull_request' ||

    Boolean(env.CODEX_PR_NUMBER) ||

    Boolean(env.GITHUB_REF && env.GITHUB_REF.includes('/pull/'));

}



export function prBodyText(env = process.env) {

  if (env.CODEX_PR_BODY) return env.CODEX_PR_BODY;

  if (env.CODEX_PR_BODY_PATH) return readText(env.CODEX_PR_BODY_PATH) || '';

  if (env.GITHUB_EVENT_PATH) {

    const parsed = readJson(env.GITHUB_EVENT_PATH);

    if (parsed.ok) return parsed.value?.pull_request?.body || '';

  }

  return '';

}



export function normalizePath(value) {

  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');

}



export function listFiles(dir) {

  const out = [];

  if (!fs.existsSync(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) out.push(...listFiles(full));

    else out.push(normalizePath(full));

  }

  return out;

}



export function concreteUnsafeFindings(value, pathLabel = 'value') {

  const text = String(value || '');

  if (!text) return [];

  const rules = [

    ['unsafe_value_detected', /\b(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/[^\s<>"'`]+/i],

    ['unsafe_value_detected', /\b(?:gh[pousr]_|sk-|AKIA|glpat-|npm_|xox[baprs]-)[A-Za-z0-9_-]{8,}\b/],

    ['unsafe_value_detected', /-----BEGIN [^-]+PRIVATE KEY-----/i],

    ['unsafe_value_detected', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],

    ['unsafe_value_detected', /\b[A-Za-z]:\\Users\\[^"'`\s]+|\/home\/[^"'`\s]+/i],

  ];

  return rules.filter(([, pattern]) => pattern.test(text)).map(([reasonCode]) => ({ reasonCode, path: pathLabel }));

}



export function scanObjectForUnsafe(value, pathLabel = 'report') {

  const findings = [];

  const visit = (node, label) => {

    if (node === null || node === undefined) return;

    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {

      findings.push(...concreteUnsafeFindings(node, label));

      return;

    }

    if (Array.isArray(node)) {

      node.forEach((item, index) => visit(item, `${label}[${index}]`));

      return;

    }

    if (typeof node === 'object') {

      for (const [key, nested] of Object.entries(node)) visit(nested, `${label}.${key}`);

    }

  };

  visit(value, pathLabel);

  return findings;

}



export function mojibakeFindings(text) {

  const value = String(text || '');

  const patterns = [

    /\u9b2f|\u9b2e|\u9a5b|\u90e2|\u9aeb|\u7e5d|\u8b41/,

    /(?:\u30fb\uff7d|\u7e3a|\u83a8|\u7e67|\u8373)[^\n]{0,24}(?:\u30fb\uff7d|\u7e3a|\u83a8|\u7e67|\u8373)/,

    /\uFFFD/,

  ];

  return patterns.some((pattern) => pattern.test(value)) ? ['agents_context_mojibake'] : [];

}



export function simpleStatus(field, status, extras = {}) {

  return {

    marker,

    harnessVersion: HARNESS_VERSION,

    [field]: {

      status,

      safeSummaryOnly: true,

      ...extras,

    },

    valuesPrinted: false,

    status,

  };

}



export function parseArgs(argv = process.argv) {

  const args = {};

  for (let i = 2; i < argv.length; i += 1) {

    const item = argv[i];

    if (item === '--json') args.json = true;

    else if (item.startsWith('--')) args[item.slice(2)] = argv[++i] || '';

  }

  return args;

}
