#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.2.1
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

const failures = [];
function fail(kind, file) { failures.push(`${kind}: ${file}`); }
function checkName(file) {
  if (allowedExample(file)) return;
  if (/(^|\/)\.env($|\.(local|production|staging|development)$)/.test(file)) fail('forbidden_env_file', file);
  if (/(^|\/)(id_rsa|id_ed25519|.*\.pem|.*\.p12|.*\.pfx)$/i.test(file)) fail('forbidden_key_file', file);
  if (/\.(dump|sqlite|sqlite3)$/i.test(file)) fail('forbidden_database_artifact', file);
}
function scanContent(file) {
  if (allowedExample(file) || skipFile(file)) return;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return;
  const buf = fs.readFileSync(file);
  if (binaryLike(buf)) return;
  const text = buf.toString('utf8');
  const checks = [
    ['private_key_block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['github_token', /gh[pousr]_[A-Za-z0-9_]{20,}/],
    ['openai_key_like', /sk-[A-Za-z0-9_-]{20,}/],
    ['aws_access_key', /AKIA[0-9A-Z]{16}/],
    ['jwt_like', /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/],
    ['secret_assignment_like', /(PRIVATE_KEY|JWT_SECRET|DATABASE_URL|DB_URL|API_KEY|ACCESS_TOKEN|SECRET_KEY)\s*=\s*\S{16,}/i],
  ];
  for (const [kind, pattern] of checks) if (pattern.test(text)) fail(kind, file);
}

const files = new Set([
  ...splitNull(git(['ls-files', '-z'])),
  ...splitNull(git(['ls-files', '--others', '--exclude-standard', '-z'])),
]);
for (const raw of files) {
  const file = toPosix(raw);
  if (!file) continue;
  checkName(file);
  scanContent(file);
}

if (failures.length) {
  console.log('Secret safety scan failed. Redacted findings:');
  [...new Set(failures)].sort().forEach((item) => console.log(`- ${item}`));
  process.exit(1);
}
console.log('Secret safety scan passed.');
