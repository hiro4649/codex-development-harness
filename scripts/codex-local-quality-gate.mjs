#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.2.1
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

function npmCliPath() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}
function commandSpec(cmd, args) {
  if (cmd === 'node') return { command: process.execPath, args };
  if (cmd === 'npm') {
    const cli = npmCliPath();
    if (cli) return { command: process.execPath, args: [cli, ...args] };
  }
  return { command: cmd, args };
}
function spawn(cmd, args, options = {}) {
  const spec = commandSpec(cmd, args);
  return spawnSync(spec.command, spec.args, {
    cwd: options.cwd || '.',
    stdio: options.stdio || 'inherit',
    encoding: options.encoding || 'utf8',
    env: { ...process.env, ...(options.env || {}) },
  });
}
function run(cmd, args, cwd = '.') {
  console.log(`== ${cwd}: ${[cmd, ...args].join(' ')} ==`);
  const result = spawn(cmd, args, { cwd });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
function readJsonFile(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}
function readPackage(dir) {
  const file = path.join(dir, 'package.json');
  if (!fs.existsSync(file)) return null;
  try {
    return readJsonFile(file);
  } catch (error) {
    console.error(`Failed to parse ${file}: ${error.message}`);
    process.exit(1);
  }
}
function hasScript(dir, script) {
  const pkg = readPackage(dir);
  return Boolean(pkg?.scripts?.[script]);
}
function runScript(dir, script) {
  if (hasScript(dir, script)) run('npm', ['run', script], dir);
}
function runTest(dir, extra = []) {
  if (hasScript(dir, 'test')) run('npm', ['test', ...extra], dir);
}
function commandExists(cmd) {
  const result = spawn(cmd, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

console.log('== Codex local quality gate ==');
run('node', ['scripts/codex-secret-safety-scan.mjs']);

const npmDirs = ['.', 'apps/backend', 'apps/frontend', 'contracts'].filter((dir) => fs.existsSync(path.join(dir, 'package.json')));
if (!npmDirs.length) {
  console.log('No package.json found; npm checks skipped.');
  console.log('Codex local quality gate passed.');
  process.exit(0);
}

// Parse all candidate package.json files before deciding whether npm is available.
// This catches invalid JSON and handles UTF-8 BOM package.json files safely.
for (const dir of npmDirs) readPackage(dir);

if (process.env.CODEX_SKIP_NPM === '1') {
  console.log('CODEX_SKIP_NPM=1; npm checks skipped.');
  console.log('Codex local quality gate passed.');
  process.exit(0);
}

if (!commandExists('npm')) {
  const message = 'npm was not found; npm project checks skipped in this environment. Run this gate again where npm is available before merge.';
  if (process.env.CODEX_REQUIRE_NPM === '1') {
    console.error(message);
    process.exit(1);
  }
  console.log(message);
  console.log('Codex local quality gate passed with npm checks skipped.');
  process.exit(0);
}

if (fs.existsSync('package.json')) {
  runScript('.', 'dev:config:doctor');
  runScript('.', 'preflight');
  runTest('.');
  runScript('.', 'smoke');
  runScript('.', 'build');
}
if (fs.existsSync('apps/backend/package.json')) {
  runScript('apps/backend', 'prisma:validate');
  runScript('apps/backend', 'build');
  runTest('apps/backend', ['--', '--runInBand']);
}
if (fs.existsSync('apps/frontend/package.json')) {
  if (fs.existsSync('apps/frontend/env.validation.test.mjs')) run('node', ['env.validation.test.mjs'], 'apps/frontend');
  runScript('apps/frontend', 'build');
}
if (fs.existsSync('contracts/package.json')) {
  runScript('contracts', 'compile');
  runTest('contracts');
  runScript('contracts', 'compile:nft');
  runScript('contracts', 'test:nft');
}
console.log('Codex local quality gate passed.');
