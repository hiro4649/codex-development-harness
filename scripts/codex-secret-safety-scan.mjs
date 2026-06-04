#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function git(args) {
  try { return execFileSync('git', args, { encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return Buffer.from(''); }
}
function splitNull(buf) { return buf.toString('utf8').split('\0').filter(Boolean); }
function toPosix(p) { return p.split(path.sep).join('/'); }
function allowedExample(file) { return /(^|\/)\.env\.(example|sample)$/.test(file) || /\.(env\.example|env\.sample)$/.test(file); }
function skipFile(file) { return /(^|\/)(node_modules|dist|build|\.next)(\/|$)/.test(file) || /(^|\/)\.git(\/|$)/.test(file); }
function binaryLike(buf) { return buf.includes(0); }

const trackedFiles = new Set(splitNull(git(['ls-files', '-z'])).map(toPosix));
const untrackedFiles = new Set(splitNull(git(['ls-files', '--others', '--exclude-standard', '-z'])).map(toPosix));
const changedFiles = new Set([
  ...splitNull(git(['diff', '--name-only', '-z'])),
  ...splitNull(git(['diff', '--cached', '--name-only', '-z'])),
].map(toPosix));

const failures = new Set();
function fail(kind, file) { failures.add(`${kind}: ${file}`); }
function fileState(file) {
  if (untrackedFiles.has(file)) return 'untracked';
  if (changedFiles.has(file)) return 'changed';
  return 'tracked';
}
function checkName(file) {
  if (allowedExample(file)) return;
  if (/(^|\/)\.env($|\.(local|production|staging|development)$)/.test(file)) fail('forbidden_env_file', file);
  if (/(^|\/)(id_rsa|id_ed25519|.*\.pem|.*\.p12|.*\.pfx)$/i.test(file)) fail('forbidden_key_file', file);
  if (/\.(dump|sqlite|sqlite3|db)$/i.test(file)) fail('forbidden_database_artifact', file);
}

const highConfidenceChecks = [
  ['private_key_block', /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/],
  ['github_token', /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ['openai_key_like', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['aws_access_key', /\bAKIA[0-9A-Z]{16}\b/],
  ['jwt_like', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['slack_token_like', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['npm_token_like', /\bnpm_[A-Za-z0-9]{20,}\b/],
  ['gitlab_token_like', /\bglpat-[A-Za-z0-9_-]{20,}\b/],
];
const assignmentPattern = /(?:^|[^\w])([A-Z0-9_]*(?:PRIVATE_KEY|JWT_SECRET|DATABASE_URL|DB_URL|API_KEY|ACCESS_TOKEN|SECRET_KEY|SLACK_TOKEN|NPM_TOKEN|GITLAB_TOKEN|TOKEN|PASSWORD|CREDENTIAL|CLIENT_SECRET)[A-Z0-9_]*)\s*=\s*([^\r\n]*)/ig;

function parseAssignmentValue(raw) {
  let value = raw.trim();
  if (!value || value.startsWith('#') || value.startsWith('//')) return '';
  const quote = value[0];
  if (quote === '"' || quote === "'" || quote === '`') {
    const end = value.indexOf(quote, 1);
    value = end >= 0 ? value.slice(1, end) : value.slice(1);
  } else {
    value = value.split(/[\s,;)\]}]+/, 1)[0];
  }
  return value.trim().replace(/^[({[]+/, '').replace(/[)}\].]+$/, '');
}
function isFixtureContext(file, line) {
  return /(^|\/)(test|tests|__tests__|fixtures?|mocks?)(\/|$)/i.test(file)
    || /run-tests\.js$/i.test(file)
    || /\b(test|fixture|mock|dummy|unsafe|danger|redacted|placeholder|example|sample)\b/i.test(line);
}
function isPlaceholderValue(value) {
  if (!value) return true;
  if (/^<[^>\r\n]+>$/.test(value)) return true;
  if (/^\$\{[^}\r\n]+\}$/.test(value)) return true;
  if (/^(?:your[_-]?)?[a-z0-9_-]*(?:example|sample|dummy|mock|fixture|fake|placeholder|redacted|todo|changeme|unsafe|danger|test)[a-z0-9_-]*$/i.test(value)) return true;
  if (/^(?:REDACTED|TODO|TBD|NONE|NULL|UNDEFINED|XXX+|YOUR_[A-Z0-9_]+)$/i.test(value)) return true;
  return false;
}
function charClasses(value) {
  return [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;
}
function uniqueChars(value) { return new Set(value).size; }
function looksCredentialLike(value, state) {
  if (isPlaceholderValue(value)) return false;
  const compact = value.replace(/^['"`]|['"`]$/g, '');
  const strict = state === 'untracked' || state === 'changed';
  const minLength = strict ? 16 : 32;
  if (compact.length < minLength) return false;
  if (/\s/.test(compact)) return false;
  if (/^[a-z]+(?:-[a-z]+)+$/i.test(compact) && !/\d/.test(compact)) return false;
  const hasLetterAndDigit = /[A-Za-z]/.test(compact) && /\d/.test(compact);
  const encodedLike = /^[A-Fa-f0-9]{32,}$/.test(compact) || /^[A-Za-z0-9+/=_-]{32,}$/.test(compact);
  if (hasLetterAndDigit && charClasses(compact) >= 2 && uniqueChars(compact) >= 8) return true;
  return encodedLike && uniqueChars(compact) >= 8;
}
function scanHighConfidence(file, text) {
  for (const [kind, pattern] of highConfidenceChecks) {
    if (pattern.test(text)) fail(kind, file);
  }
}
function scanAssignments(file, text, state) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    assignmentPattern.lastIndex = 0;
    let match;
    while ((match = assignmentPattern.exec(line))) {
      const value = parseAssignmentValue(match[2]);
      if (!value) continue;
      if (isPlaceholderValue(value)) continue;
      if (isFixtureContext(file, line) && !looksCredentialLike(value, state)) continue;
      if (looksCredentialLike(value, state)) fail('secret_assignment_like', file);
    }
  }
}
function scanContent(file) {
  if (skipFile(file)) return;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return;
  const buf = fs.readFileSync(file);
  if (binaryLike(buf)) return;
  const text = buf.toString('utf8');
  const state = fileState(file);
  scanHighConfidence(file, text);
  scanAssignments(file, text, state);
}
function contentFailureKinds(file, text, state = 'changed') {
  const kinds = new Set();
  for (const [kind, pattern] of highConfidenceChecks) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) kinds.add(kind);
  }
  for (const line of text.split(/\r?\n/)) {
    assignmentPattern.lastIndex = 0;
    let match;
    while ((match = assignmentPattern.exec(line))) {
      const value = parseAssignmentValue(match[2]);
      if (!value || isPlaceholderValue(value)) continue;
      if (isFixtureContext(file, line) && !looksCredentialLike(value, state)) continue;
      if (looksCredentialLike(value, state)) kinds.add('secret_assignment_like');
    }
  }
  return kinds;
}
function runSelfTest() {
  const tests = [
    {
      name: 'env-example-placeholders-pass',
      file: '.env.example',
      text: [
        ['OPENAI_API_KEY', 'changeme'].join('='),
        ['DATABASE_URL', '${DATABASE_URL}'].join('='),
        ['TOKEN', '<TOKEN>'].join('='),
      ].join('\n'),
      shouldFail: false,
    },
    {
      name: 'env-example-openai-key-fails',
      file: '.env.example',
      text: [['OPENAI_API_KEY', `sk-${'A'.repeat(48)}`].join('=')].join('\n'),
      shouldFail: true,
    },
    {
      name: 'env-example-credential-assignment-fails',
      file: '.env.sample',
      text: [['CLIENT_SECRET', 'Ab1_Zy9-Xk8Lm7Qp2Rs5Tu6Vw3Yz4NnB0'].join('=')].join('\n'),
      shouldFail: true,
    },
  ];
  const failed = [];
  for (const test of tests) {
    const kinds = contentFailureKinds(test.file, test.text, 'changed');
    const didFail = kinds.size > 0;
    if (didFail !== test.shouldFail) failed.push(test.name);
  }
  if (failed.length) {
    console.log('Secret safety scan self-test failed.');
    for (const name of failed) console.log(`- ${name}`);
    process.exit(1);
  }
  console.log('Secret safety scan self-test passed.');
  process.exit(0);
}

if (process.env.CODEX_SECRET_SCAN_SELF_TEST === '1') runSelfTest();

const files = new Set([...trackedFiles, ...untrackedFiles]);
for (const file of files) {
  if (!file) continue;
  checkName(file);
  scanContent(file);
}

if (failures.size) {
  console.log('Secret safety scan failed. Redacted findings:');
  [...failures].sort().forEach((item) => console.log(`- ${item}`));
  process.exit(1);
}
console.log('Secret safety scan passed.');
