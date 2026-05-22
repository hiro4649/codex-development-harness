#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.7.0
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const HARNESS_VERSION = '0.7.0';
const MARKER = `CODEX_QUALITY_HARNESS_FILE v${HARNESS_VERSION}`;
const SOURCE_MANIFEST = 'CODEX_SOURCE_HARNESS_MANIFEST.json';
const forbiddenSourcePaths = [
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'src/',
  'apps/',
  'contracts/',
  'docs/launch/',
  'IRIS_SPEC_AUTHORITY.md',
  'scripts/run-tests.js',
];

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
function git(args) {
  const result = spawn('git', args, { stdio: 'pipe' });
  return result.status === 0 ? String(result.stdout || '') : '';
}
function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}
function lines(text) {
  return String(text || '').split(/\r?\n/).map((line) => normalizePath(line.trim())).filter(Boolean);
}
function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean).map(normalizePath))].sort();
}
function globToRegExp(pattern) {
  let out = '^';
  const text = normalizePath(pattern);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '*' && next === '*') {
      out += '.*';
      i++;
    } else if (ch === '*') {
      out += '[^/]*';
    } else {
      out += ch.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`${out}$`);
}
function pathMatches(file, patterns) {
  const target = normalizePath(file);
  return (patterns || []).some((pattern) => {
    const normalized = normalizePath(pattern);
    if (!normalized) return false;
    if (normalized.includes('*')) return globToRegExp(normalized).test(target);
    if (normalized.endsWith('/')) return target.startsWith(normalized);
    return target === normalized || target.startsWith(`${normalized}/`);
  });
}
function safeJsonRead(file, failures, id) {
  try {
    return readJsonFile(file);
  } catch (error) {
    failures.push({ id, message: `${file} could not be parsed` });
    return null;
  }
}
function changedFilesSinceOriginMain() {
  return uniqueSorted([
    ...lines(git(['diff', '--name-only', 'origin/main...HEAD'])),
    ...lines(git(['diff', '--name-only'])),
    ...lines(git(['diff', '--cached', '--name-only'])),
    ...lines(git(['ls-files', '--others', '--exclude-standard'])),
  ]);
}
function allRepoFiles() {
  return uniqueSorted([
    ...lines(git(['ls-files'])),
    ...lines(git(['ls-files', '--others', '--exclude-standard'])),
  ]);
}
function markerVersion(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    const match = text.match(/CODEX_QUALITY_HARNESS_FILE v([0-9]+\.[0-9]+\.[0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
function safeForbiddenArtifactHit(value) {
  const text = JSON.stringify(value || {});
  return [
    /(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/\S+/i,
    /\b(?:gh[pousr]_|sk-|AKIA|glpat-|npm_|xox[baprs]-)[A-Za-z0-9_-]{8,}\b/,
    /-----BEGIN [^-]+PRIVATE KEY-----/i,
    /\b[A-Za-z]:\\Users\\[^"'`\s]+/i,
    /\/home\/[^"'`\s]+/i,
  ].some((pattern) => pattern.test(text));
}
function runJsonScript(script, cwd, failures, warnings) {
  const before = git(['status', '--porcelain=v1']);
  const result = spawn('node', [script], { cwd, stdio: 'pipe' });
  const after = git(['status', '--porcelain=v1']);
  if (before !== after) failures.push({ id: 'suggestion.sideEffect', message: `${normalizePath(path.join(cwd, script))} changed git status` });
  if (result.status !== 0) failures.push({ id: 'script.failed', message: `${normalizePath(path.join(cwd, script))} failed` });
  let parsed = {};
  try {
    parsed = JSON.parse(String(result.stdout || '{}'));
  } catch {
    failures.push({ id: 'script.output.invalidJson', message: `${normalizePath(path.join(cwd, script))} did not emit JSON` });
  }
  if (parsed.autoApply !== false) failures.push({ id: 'script.autoApply', message: `${script} must emit autoApply:false` });
  if (script.includes('self-evolution')) {
    if (parsed.autoCommit !== false) failures.push({ id: 'script.autoCommit', message: `${script} must emit autoCommit:false` });
    if (parsed.autoPush !== false) failures.push({ id: 'script.autoPush', message: `${script} must emit autoPush:false` });
  }
  const unsafeKeys = ['rawDiff', 'rawLogs', 'secretValue', 'endpointValue', 'privatePath', 'payload', 'productionData', 'personalData'];
  const out = JSON.stringify(parsed);
  if (unsafeKeys.some((key) => out.includes(key)) || safeForbiddenArtifactHit(parsed)) {
    failures.push({ id: 'script.output.unsafe', message: `${script} emitted unsafe output shape` });
  }
  if (parsed.status && parsed.status !== 'pass' && parsed.status !== 'suggestion_only') {
    warnings.push({ id: 'script.status', message: `${script} returned ${parsed.status}` });
  }
  return parsed;
}
function validateSourceHarness() {
  const failures = [];
  const warnings = [];
  const manifest = safeJsonRead(SOURCE_MANIFEST, failures, 'sourceManifest.parse') || {};
  const changed = changedFilesSinceOriginMain();
  const sourceManaged = uniqueSorted([
    ...(manifest.managedFiles || []),
    ...(manifest.policyFiles || []),
    ...(manifest.scriptNames || []).map((name) => `scripts/${name}`),
  ]);
  const optional = new Set((manifest.optionalFiles || []).map(normalizePath));
  const profiles = manifest.profiles || ['funky', 'iris', 'iris-live2d-renderer'];
  const allowedPatterns = [...sourceManaged];
  const manifestMissing = [];
  const markerMissing = [];
  const markerMismatches = [];
  const profileSummaries = [];

  if (manifest.marker !== MARKER) failures.push({ id: 'sourceManifest.marker', message: 'source manifest marker mismatch' });
  if (manifest.harnessVersion !== HARNESS_VERSION) failures.push({ id: 'sourceManifest.version', message: 'source manifest version mismatch' });

  for (const file of sourceManaged.filter((item) => !item.includes('*'))) {
    if (!fs.existsSync(file)) {
      const item = { path: file };
      if (optional.has(file)) warnings.push({ id: 'sourceManifest.optionalMissing', message: file });
      else manifestMissing.push(item);
      continue;
    }
    const version = markerVersion(file);
    if (!version) markerMissing.push({ path: file });
    else if (version !== HARNESS_VERSION) markerMismatches.push({ path: file, version });
  }

  for (const profile of profiles) {
    const prefix = `profiles/${profile}/`;
    const manifestPath = `${prefix}docs/process/CODEX_HARNESS_MANIFEST.json`;
    const profileManifest = safeJsonRead(manifestPath, failures, `profileManifest.${profile}.parse`);
    if (!profileManifest) continue;
    const managed = uniqueSorted([
      ...(profileManifest.managedFiles || []),
      ...(profileManifest.policyFiles || []),
      ...(profileManifest.scriptNames || []).map((name) => `scripts/${name}`),
    ]);
    const prefixed = managed.map((file) => `${prefix}${file}`);
    allowedPatterns.push(...prefixed);
    const missing = [];
    for (const file of prefixed) {
      if (!fs.existsSync(file)) missing.push(file);
      else {
        const version = markerVersion(file);
        if (!version) markerMissing.push({ path: file });
        else if (version !== HARNESS_VERSION) markerMismatches.push({ path: file, version });
      }
    }
    profileSummaries.push({
      profile,
      manifest: manifestPath,
      managedFiles: managed.length,
      missingManagedFiles: missing,
      changedFiles: changed.filter((file) => file.startsWith(prefix)).length,
    });
    for (const file of missing) manifestMissing.push({ path: file });
  }

  const forbiddenChanged = changed.filter((file) => pathMatches(file, forbiddenSourcePaths));
  const unknownChanged = changed.filter((file) => !pathMatches(file, allowedPatterns) && !optional.has(file));
  const markerScanMismatches = [];
  const markerScanMissing = [];
  let markerScanned = 0;
  for (const file of allRepoFiles()) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes('CODEX_QUALITY_HARNESS_FILE')) continue;
    markerScanned += 1;
    const version = markerVersion(file);
    if (!version) markerScanMissing.push(file);
    else if (version !== HARNESS_VERSION) markerScanMismatches.push({ path: file, version });
  }

  for (const item of [
    ...forbiddenChanged.map((file) => ({ id: 'source.forbiddenPath', message: file })),
    ...unknownChanged.map((file) => ({ id: 'source.manifestOmission', message: file })),
    ...manifestMissing.map((item) => ({ id: 'source.manifestMissing', message: item.path })),
    ...markerMissing.map((item) => ({ id: 'source.markerMissing', message: item.path })),
    ...markerMismatches.map((item) => ({ id: 'source.markerMismatch', message: `${item.path} ${item.version}` })),
    ...markerScanMissing.map((file) => ({ id: 'source.markerScanMissing', message: file })),
    ...markerScanMismatches.map((item) => ({ id: 'source.markerScanMismatch', message: `${item.path} ${item.version}` })),
  ]) failures.push(item);

  return {
    status: failures.length ? 'fail' : (warnings.length ? 'warning' : 'pass'),
    sourceRepoMode: true,
    changedFiles: changed,
    forbiddenChanged,
    unknownChanged,
    profiles: profileSummaries,
    markerScan: {
      status: markerScanMissing.length || markerScanMismatches.length ? 'fail' : 'pass',
      scanned: markerScanned,
      missing: markerScanMissing,
      mismatches: markerScanMismatches,
    },
    manifest: {
      path: SOURCE_MANIFEST,
      missing: manifestMissing,
      markerMissing,
      markerMismatches,
      optionalFiles: [...optional].sort(),
    },
    failures,
    warnings,
  };
}
function runProfileGovernanceScripts(report) {
  const profiles = report.sourceHarnessValidationStatus?.profiles?.map((item) => item.profile) || ['funky', 'iris', 'iris-live2d-renderer'];
  const failures = [];
  const warnings = [];
  const agent = [];
  const skill = [];
  const curator = [];
  const self = [];
  for (const profile of profiles) {
    const cwd = path.join('profiles', profile);
    agent.push({ profile, ...runJsonScript('scripts/codex-agent-memory-validate.mjs', cwd, failures, warnings) });
    skill.push({ profile, ...runJsonScript('scripts/codex-skill-lifecycle-validate.mjs', cwd, failures, warnings) });
    curator.push({ profile, ...runJsonScript('scripts/codex-harness-curator-suggest.mjs', cwd, failures, warnings) });
    self.push({ profile, ...runJsonScript('scripts/codex-harness-self-evolution-suggest.mjs', cwd, failures, warnings) });
  }
  report.agentMemoryPolicyStatus = { status: agent.some((item) => item.status === 'fail') ? 'fail' : (agent.every((item) => item.status === 'pass') ? 'pass' : 'warning'), profiles: agent };
  report.skillLifecyclePolicyStatus = { status: skill.some((item) => item.status === 'fail') ? 'fail' : (skill.every((item) => item.status === 'pass') ? 'pass' : 'warning'), profiles: skill };
  const suggestionOk = (item) => ['pass', 'suggestion_only'].includes(item.status)
    && item.autoApply === false
    && item.autoCommit === false
    && item.autoPush === false
    && item.changedFiles?.length === 0;
  report.curatorSuggestionStatus = { status: curator.every(suggestionOk) ? 'pass' : 'fail', autoApply: false, autoCommit: false, autoPush: false, profiles: curator };
  report.selfEvolutionPolicyStatus = { status: self.every(suggestionOk) ? 'pass' : 'fail', autoApply: false, autoCommit: false, autoPush: false, profiles: self };
  return { failures, warnings };
}
function computeSafeArtifactValidation(report) {
  const unsafe = safeForbiddenArtifactHit(report);
  return {
    status: unsafe ? 'fail' : 'pass',
    safeSummaryOnly: true,
    secretFree: !unsafe,
  };
}
function runOpenAICodexMethodGate() {
  const script = path.join('scripts', 'codex-openai-method-gate.mjs');
  if (!fs.existsSync(script)) {
    return { status: 'fail', failures: ['methodGateScript=missing'], safeSummary: 'OpenAI Codex Method Gate script is missing.' };
  }
  const result = spawn('node', [script], {
    env: { ...process.env, CODEX_OPENAI_METHOD_REPORT: 'json' },
    stdio: 'pipe',
  });
  const output = `${result.stdout || ''}`.trim();
  if (output) {
    try {
      return JSON.parse(output);
    } catch {
      return { status: 'fail', failures: ['methodGateOutput=parse_failed'], safeSummary: 'OpenAI Codex Method Gate returned invalid JSON.' };
    }
  }
  return { status: 'fail', failures: ['methodGate=failed'], safeSummary: 'OpenAI Codex Method Gate failed.' };
}
function computeOutputShapeStatus(report) {
  const required = [
    'sourceHarnessValidationStatus',
    'agentMemoryPolicyStatus',
    'skillLifecyclePolicyStatus',
    'curatorSuggestionStatus',
    'selfEvolutionPolicyStatus',
    'safeArtifactValidation',
    'openaiCodexMethodStatus',
    'methodSupportStatus',
  ];
  const missing = required.filter((key) => report[key] === undefined);
  return {
    status: missing.length || safeForbiddenArtifactHit(report) ? 'fail' : 'pass',
    missingFields: missing,
    safeSummaryOnly: true,
  };
}
function runSourceHarnessGate() {
  const jsonReport = process.env.CODEX_QUALITY_REPORT === 'json';
  const failures = [];
  const warnings = [];
  if (!jsonReport) console.log('== Codex source harness quality gate ==');
  const secretSelfTest = spawn('node', ['scripts/codex-secret-safety-scan.mjs'], { env: { CODEX_SECRET_SCAN_SELF_TEST: '1' }, stdio: 'pipe' });
  if (secretSelfTest.status !== 0) failures.push({ id: 'secretScan.selfTest', message: 'secret scan self-test failed' });
  const secretScan = spawn('node', ['scripts/codex-secret-safety-scan.mjs'], { stdio: 'pipe' });
  if (secretScan.status !== 0) failures.push({ id: 'secretScan.failed', message: 'secret safety scan failed' });

  const report = {
    marker: MARKER,
    harnessVersion: HARNESS_VERSION,
    status: 'running',
    mergeReady: false,
    sourceHarnessValidationStatus: validateSourceHarness(),
    secretScan: { status: secretScan.status === 0 ? 'pass' : 'fail' },
    warnings,
    failures,
    humanReviewRequired: false,
    openaiCodexMethodStatus: { status: 'not_run' },
    methodSupportStatus: { status: 'not_run' },
  };
  if (report.sourceHarnessValidationStatus.status === 'fail') failures.push(...report.sourceHarnessValidationStatus.failures);
  if (report.sourceHarnessValidationStatus.status === 'warning') warnings.push(...report.sourceHarnessValidationStatus.warnings);
  const governance = runProfileGovernanceScripts(report);
  failures.push(...governance.failures);
  warnings.push(...governance.warnings);
  report.openaiCodexMethodStatus = runOpenAICodexMethodGate();
  report.methodSupportStatus = report.openaiCodexMethodStatus.methodSupportStatus || { status: 'missing' };

  for (const [key, value] of Object.entries({
    agentMemoryPolicyStatus: report.agentMemoryPolicyStatus,
    skillLifecyclePolicyStatus: report.skillLifecyclePolicyStatus,
    curatorSuggestionStatus: report.curatorSuggestionStatus,
    selfEvolutionPolicyStatus: report.selfEvolutionPolicyStatus,
    openaiCodexMethodStatus: report.openaiCodexMethodStatus,
    methodSupportStatus: report.methodSupportStatus,
  })) {
    if (value?.status === 'fail') failures.push({ id: `${key}.failed`, message: `${key} failed` });
    else if (value?.status === 'warning') warnings.push({ id: `${key}.warning`, message: `${key} requires human review` });
  }
  report.humanReviewRequired = warnings.length > 0;
  report.safeArtifactValidation = computeSafeArtifactValidation(report);
  if (report.safeArtifactValidation.status === 'fail') failures.push({ id: 'safeArtifactValidation.failed', message: 'safe artifact validation failed' });
  report.outputShapeStatus = computeOutputShapeStatus(report);
  if (report.outputShapeStatus.status === 'fail') failures.push({ id: 'outputShapeStatus.failed', message: 'output shape validation failed' });
  report.status = failures.length ? 'fail' : (warnings.length ? 'manual_confirmation_required' : 'pass');
  report.mergeReady = failures.length === 0 && warnings.length === 0;
  report.localGate = { status: report.status };

  if (jsonReport) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`status: ${report.status}`);
    console.log(`sourceHarnessValidationStatus: ${report.sourceHarnessValidationStatus.status}`);
    console.log(`agentMemoryPolicyStatus: ${report.agentMemoryPolicyStatus.status}`);
    console.log(`skillLifecyclePolicyStatus: ${report.skillLifecyclePolicyStatus.status}`);
    console.log(`curatorSuggestionStatus: ${report.curatorSuggestionStatus.status}`);
    console.log(`selfEvolutionPolicyStatus: ${report.selfEvolutionPolicyStatus.status}`);
    console.log(`openaiCodexMethodStatus: ${report.openaiCodexMethodStatus.status}`);
    console.log(`methodSupportStatus: ${report.methodSupportStatus.status}`);
    console.log(`safeArtifactValidation: ${report.safeArtifactValidation.status}`);
    console.log(`outputShapeStatus: ${report.outputShapeStatus.status}`);
  }
  if (failures.length) {
    console.error('Codex source harness quality gate failed. Safe summary:');
    for (const failure of failures.slice(0, 20)) console.error(`- ${failure.id}: ${failure.message}`);
    process.exit(1);
  }
  if (!jsonReport) console.log('Codex source harness quality gate passed.');
  process.exit(0);
}

if (process.env.CODEX_QUALITY_REPORT !== 'json') console.log('== Codex local quality gate ==');
if (process.env.CODEX_HARNESS_SOURCE_REPO === '1') runSourceHarnessGate();
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
