#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.8.3
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { buildHumanConfirmationStatus } from './codex-production-readiness-gate.mjs';
import { scanSafeOutput } from './codex-safe-output-scan.mjs';
import { buildGithubReplayContextAsync } from './codex-ci-replay.mjs';
import { buildCompactReasonSummary } from './codex-reason-summary.mjs';

const HARNESS_VERSION = '0.8.3';
const PROFILE_TEMPLATE_VERSION = '0.7.0';
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
function compatibleProfileVersions(manifest) {
  return uniqueSorted([
    manifest.profileTemplateVersion || PROFILE_TEMPLATE_VERSION,
    ...(manifest.compatibleProfileTemplateVersions || []),
  ]);
}
function expectedMarkerVersionForPath(file, profileVersions) {
  const normalized = normalizePath(file);
  return normalized.startsWith('profiles/') ? profileVersions : [HARNESS_VERSION];
}
function markerAllowedForPath(file, version, profileVersions) {
  return expectedMarkerVersionForPath(file, profileVersions).includes(version);
}
function safeForbiddenArtifactHit(value) {
  return scanSafeOutput(value).findings.length > 0;
}
function runGateScript(script, field, envName, baseEnv = process.env) {
  if (!fs.existsSync(script)) {
    return { status: 'fail', failures: [`${field}=script_missing`], safeSummaryOnly: true };
  }
  const result = spawn('node', [script], {
    env: { ...baseEnv, CODEX_QUALITY_REPORT: 'json', [envName]: 'json' },
    stdio: 'pipe',
  });
  const output = String(result.stdout || '').trim();
  if (!output) {
    return { status: 'fail', failures: [`${field}=empty_output`], safeSummaryOnly: true };
  }
  try {
    const parsed = JSON.parse(output);
    if (safeForbiddenArtifactHit(parsed)) {
      return { status: 'fail', failures: [`${field}=unsafe_output_shape`], safeSummaryOnly: true };
    }
    const status = parsed[field]?.status || parsed.status || (result.status === 0 ? 'pass' : 'fail');
    return { status, ...(parsed[field] || {}), script };
  } catch {
    return { status: 'fail', failures: [`${field}=invalid_json`], safeSummaryOnly: true };
  }
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
  if (safeForbiddenArtifactHit(parsed)) {
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
  const coreMode = process.env.CODEX_HARNESS_MODE === 'core';
  const profiles = coreMode ? [] : (manifest.profiles || ['funky', 'iris', 'iris-live2d-renderer']);
  const profileVersions = compatibleProfileVersions(manifest);
  const allowedPatterns = [...sourceManaged];
  const manifestMissing = [];
  const markerMissing = [];
  const markerMismatches = [];
  const profileSummaries = [];
  const profileVersionFailures = [];

  if (manifest.marker !== MARKER) failures.push({ id: 'sourceManifest.marker', message: 'source manifest marker mismatch' });
  if (manifest.harnessVersion !== HARNESS_VERSION) failures.push({ id: 'sourceManifest.version', message: 'source manifest version mismatch' });
  if (manifest.sourceHarnessVersion !== HARNESS_VERSION) failures.push({ id: 'sourceManifest.sourceVersion', message: 'source harness version mismatch' });
  if (!profileVersions.includes(PROFILE_TEMPLATE_VERSION)) failures.push({ id: 'sourceManifest.profileTemplateVersion', message: 'profile template compatibility missing' });
  if (coreMode && manifest.genericCore?.profileCompatibility !== 'optional') failures.push({ id: 'sourceManifest.genericCore', message: 'generic core profile compatibility must be optional' });

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
    if (!profileVersions.includes(profileManifest.harnessVersion)) {
      const item = { id: 'profileManifest.version', message: `${profile} profile template version incompatible` };
      profileVersionFailures.push(item);
      failures.push(item);
    }
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
        else if (!profileVersions.includes(version)) markerMismatches.push({ path: file, version });
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
    else if (!markerAllowedForPath(file, version, profileVersions)) markerScanMismatches.push({ path: file, version });
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
    profileTemplateCompatibilityStatus: {
      status: coreMode ? 'pass' : profileVersions.includes(PROFILE_TEMPLATE_VERSION) &&
        profileVersionFailures.length === 0 &&
        profileSummaries.every((item) => item.missingManagedFiles.length === 0) &&
        !markerMismatches.some((item) => normalizePath(item.path).startsWith('profiles/')) ? 'pass' : 'fail',
      sourceHarnessVersion: HARNESS_VERSION,
      profileTemplateVersion: manifest.profileTemplateVersion || PROFILE_TEMPLATE_VERSION,
      compatibleProfileTemplateVersions: profileVersions,
      mode: coreMode ? 'core_optional' : 'compatibility',
      failures: profileVersionFailures,
    },
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
  const coreMode = process.env.CODEX_HARNESS_MODE === 'core';
  const profileMode = process.env.CODEX_PROFILE_COMPAT_MODE || (coreMode ? 'optional' : 'on');
  if (coreMode && ['off', 'optional'].includes(profileMode)) {
    report.agentMemoryPolicyStatus = { status: 'not_applicable', reasonCodes: ['profile_compatibility_optional_in_core_mode'], profiles: [] };
    report.skillLifecyclePolicyStatus = { status: 'not_applicable', reasonCodes: ['profile_compatibility_optional_in_core_mode'], profiles: [] };
    report.curatorSuggestionStatus = { status: 'not_applicable', reasonCodes: ['profile_compatibility_optional_in_core_mode'], autoApply: false, autoCommit: false, autoPush: false, profiles: [] };
    report.selfEvolutionPolicyStatus = { status: 'not_applicable', reasonCodes: ['profile_compatibility_optional_in_core_mode'], autoApply: false, autoCommit: false, autoPush: false, profiles: [] };
    return { failures: [], warnings: [] };
  }
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
function runOpenAICodexMethodGate(baseEnv = process.env) {
  const script = path.join('scripts', 'codex-openai-method-gate.mjs');
  if (!fs.existsSync(script)) {
    return { status: 'fail', failures: ['methodGateScript=missing'], safeSummary: 'OpenAI Codex Method Gate script is missing.' };
  }
  const result = spawn('node', [script], {
    env: { ...baseEnv, CODEX_OPENAI_METHOD_REPORT: 'json' },
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
    'profileTemplateCompatibilityStatus',
    'genericHarnessCoreStatus',
    'agentsContextStatus',
    'environmentReadinessStatus',
    'goldenSetStatus',
    'changeClassificationStatus',
    'productVerificationStatus',
    'productVerificationEvidenceStatus',
    'testMetricsStatus',
    'remoteProductBaselineStatus',
    'remoteNpmDiagnosticStatus',
    'workflowPreflightStatus',
    'safeArtifactIndexStatus',
    'openPrHygieneStatus',
    'targetFinalSummaryStatus',
    'stalePrAuditStatus',
    'reasonSummaryStatus',
    'bestOfNEvidenceStatus',
    'taskQueueLiteStatus',
    'safeTraceSchemaStatus',
    'curatorReportStatus',
    'offlineEvolutionProposalStatus',
    'testCoverageEvidenceStatus',
    'performanceEvidenceStatus',
    'agentMemoryPolicyStatus',
    'skillLifecyclePolicyStatus',
    'curatorSuggestionStatus',
    'selfEvolutionPolicyStatus',
    'safeArtifactValidation',
    'openaiCodexMethodStatus',
    'methodSupportStatus',
    'productionReadinessStatus',
    'evidenceIntegrityStatus',
    'hermesInvariantStatus',
    'humanConfirmationStatus',
    'evidencePackStatus',
    'humanConfirmationObjectStatus',
    'safeOutputScanStatus',
    'ciReplayStatus',
    'prBodyLintStatus',
    'failureReasonCatalogStatus',
    'v071SelfTestStatus',
    'v072SelfTestStatus',
    'v080SelfTestStatus',
    'v081SelfTestStatus',
    'v082SelfTestStatus',
    'v083SelfTestStatus',
    'qualityScoreStatus',
  ];
  const missing = required.filter((key) => report[key] === undefined);
  return {
    status: missing.length || safeForbiddenArtifactHit(report) ? 'fail' : 'pass',
    missingFields: missing,
    safeSummaryOnly: true,
  };
}
function computeQualityScoreStatus(report) {
  const prContext = process.env.CODEX_EVENT_NAME === 'pull_request' ||
    Boolean(process.env.CODEX_PR_NUMBER) ||
    Boolean(process.env.GITHUB_REF && process.env.GITHUB_REF.includes('/pull/'));
  const allowedNotApplicable = new Set([
    'agentMemoryPolicyStatus',
    'skillLifecyclePolicyStatus',
    'curatorSuggestionStatus',
    'selfEvolutionPolicyStatus',
    'openaiCodexMethodStatus',
    'productionReadinessStatus',
    'evidenceIntegrityStatus',
    'hermesInvariantStatus',
    'changeClassificationStatus',
    'productVerificationStatus',
    'productVerificationEvidenceStatus',
    'testMetricsStatus',
    'remoteProductBaselineStatus',
    'remoteNpmDiagnosticStatus',
    'safeArtifactIndexStatus',
    'openPrHygieneStatus',
    'targetFinalSummaryStatus',
    'stalePrAuditStatus',
    'ciReplayStatus',
    'prBodyLintStatus',
    'evidencePackStatus',
    'bestOfNEvidenceStatus',
    'taskQueueLiteStatus',
    'safeTraceSchemaStatus',
    'curatorReportStatus',
    'offlineEvolutionProposalStatus',
    'testCoverageEvidenceStatus',
    'performanceEvidenceStatus',
    'workflowPreflightStatus',
  ]);
  const scored = [
    'sourceHarnessValidationStatus',
    'profileTemplateCompatibilityStatus',
    'genericHarnessCoreStatus',
    'agentsContextStatus',
    'environmentReadinessStatus',
    'goldenSetStatus',
    'changeClassificationStatus',
    'productVerificationStatus',
    'productVerificationEvidenceStatus',
    'testMetricsStatus',
    'remoteProductBaselineStatus',
    'remoteNpmDiagnosticStatus',
    'workflowPreflightStatus',
    'safeArtifactIndexStatus',
    'openPrHygieneStatus',
    'targetFinalSummaryStatus',
    'stalePrAuditStatus',
    'reasonSummaryStatus',
    'secretScan',
    'agentMemoryPolicyStatus',
    'skillLifecyclePolicyStatus',
    'curatorSuggestionStatus',
    'selfEvolutionPolicyStatus',
    'openaiCodexMethodStatus',
    'methodSupportStatus',
    'productionReadinessStatus',
    'evidenceIntegrityStatus',
    'hermesInvariantStatus',
    'humanConfirmationStatus',
    'evidencePackStatus',
    'humanConfirmationObjectStatus',
    'safeOutputScanStatus',
    'ciReplayStatus',
    'prBodyLintStatus',
    'failureReasonCatalogStatus',
    'v071SelfTestStatus',
    'v072SelfTestStatus',
    'v080SelfTestStatus',
    'v081SelfTestStatus',
    'v082SelfTestStatus',
    'v083SelfTestStatus',
    'bestOfNEvidenceStatus',
    'taskQueueLiteStatus',
    'safeTraceSchemaStatus',
    'curatorReportStatus',
    'offlineEvolutionProposalStatus',
    'testCoverageEvidenceStatus',
    'performanceEvidenceStatus',
    'safeArtifactValidation',
    'outputShapeStatus',
  ];
  const statuses = scored.map((key) => {
    const status = report[key]?.status || 'missing';
    let effectiveStatus = status;
    if (allowedNotApplicable.has(key) && status === 'not_applicable') effectiveStatus = 'pass';
    if (key === 'humanConfirmationStatus' && status === 'not_required') effectiveStatus = 'pass';
    if (key === 'humanConfirmationObjectStatus' && status === 'not_required') effectiveStatus = 'pass';
    return { key, status, effectiveStatus };
  });
  const fail = statuses.filter((item) => item.effectiveStatus === 'fail' || item.effectiveStatus === 'missing');
  const manual = statuses.filter((item) => item.effectiveStatus === 'manual_confirmation_required' || item.effectiveStatus === 'warning');
  const notApplicable = statuses.filter((item) => item.effectiveStatus === 'not_applicable' || item.effectiveStatus === 'not_run');
  const passCount = statuses.filter((item) => item.effectiveStatus === 'pass').length;
  let score = Math.floor((passCount / statuses.length) * 99);
  if (fail.length) score = Math.min(score, 70);
  else if (manual.length) score = Math.min(score, 89);
  else if (notApplicable.length) score = Math.min(score, 95);
  else score = 100;
  return {
    status: fail.length ? 'fail' : 'pass',
    score,
    maxScoreRequiresAllPass: true,
    labels: [
      ...(fail.length ? ['blocking_gate_not_pass'] : []),
      ...(manual.length ? ['manual_confirmation_remaining'] : []),
      ...(notApplicable.length ? ['not_applicable_or_not_run_remaining'] : []),
      ...(score === 100 ? ['all_required_gates_passed'] : []),
    ],
    gateStatuses: statuses,
    safeSummaryOnly: true,
  };
}
function computeTargetOutputShapeStatus(report) {
  const required = [
    'targetManifestStatus',
    'secretScan',
    'agentsContextStatus',
    'environmentReadinessStatus',
    'changeClassificationStatus',
    'productVerificationStatus',
    'productVerificationEvidenceStatus',
    'testMetricsStatus',
    'remoteProductBaselineStatus',
    'remoteNpmDiagnosticStatus',
    'workflowPreflightStatus',
    'safeArtifactIndexStatus',
    'openPrHygieneStatus',
    'targetFinalSummaryStatus',
    'stalePrAuditStatus',
    'reasonSummaryStatus',
    'safeOutputScanStatus',
    'goldenSetStatus',
    'bestOfNEvidenceStatus',
    'taskQueueLiteStatus',
    'safeTraceSchemaStatus',
    'curatorReportStatus',
    'offlineEvolutionProposalStatus',
    'testCoverageEvidenceStatus',
    'performanceEvidenceStatus',
    'v080SelfTestStatus',
    'v081SelfTestStatus',
    'v082SelfTestStatus',
    'v083SelfTestStatus',
    'safeArtifactValidation',
    'targetQualityScoreStatus',
  ];
  const missing = required.filter((key) => report[key] === undefined);
  return {
    status: missing.length || safeForbiddenArtifactHit(report) ? 'fail' : 'pass',
    missingFields: missing,
    safeSummaryOnly: true,
  };
}
function computeTargetQualityScoreStatus(report) {
  const scored = [
    'targetManifestStatus',
    'secretScan',
    'agentsContextStatus',
    'environmentReadinessStatus',
    'changeClassificationStatus',
    'productVerificationStatus',
    'productVerificationEvidenceStatus',
    'testMetricsStatus',
    'remoteProductBaselineStatus',
    'remoteNpmDiagnosticStatus',
    'safeArtifactIndexStatus',
    'openPrHygieneStatus',
    'targetFinalSummaryStatus',
    'stalePrAuditStatus',
    'reasonSummaryStatus',
    'safeOutputScanStatus',
    'goldenSetStatus',
    'bestOfNEvidenceStatus',
    'taskQueueLiteStatus',
    'safeTraceSchemaStatus',
    'curatorReportStatus',
    'offlineEvolutionProposalStatus',
    'testCoverageEvidenceStatus',
    'performanceEvidenceStatus',
    'v080SelfTestStatus',
    'v081SelfTestStatus',
    'v082SelfTestStatus',
    'v083SelfTestStatus',
    'safeArtifactValidation',
    'outputShapeStatus',
  ];
  const allowedNotApplicable = new Set([
    'changeClassificationStatus',
    'productVerificationStatus',
    'productVerificationEvidenceStatus',
    'testMetricsStatus',
    'remoteProductBaselineStatus',
    'remoteNpmDiagnosticStatus',
    'workflowPreflightStatus',
    'safeArtifactIndexStatus',
    'openPrHygieneStatus',
    'targetFinalSummaryStatus',
    'stalePrAuditStatus',
    'goldenSetStatus',
    'bestOfNEvidenceStatus',
    'taskQueueLiteStatus',
    'safeTraceSchemaStatus',
    'curatorReportStatus',
    'offlineEvolutionProposalStatus',
    'testCoverageEvidenceStatus',
    'performanceEvidenceStatus',
    'v081SelfTestStatus',
    'v083SelfTestStatus',
  ]);
  const statuses = scored.map((key) => {
    const status = report[key]?.status || 'missing';
    let effectiveStatus = status;
    if (allowedNotApplicable.has(key) && status === 'not_applicable') effectiveStatus = 'pass_optional';
    return { key, status, effectiveStatus };
  });
  const blocking = statuses.filter((item) => ['fail', 'missing', 'not_run'].includes(item.effectiveStatus));
  const manual = statuses.filter((item) => ['manual_confirmation_required', 'warning'].includes(item.effectiveStatus));
  const notApplicable = statuses.filter((item) => item.effectiveStatus === 'pass_optional');
  let score = 100;
  if (blocking.length) score = 70;
  else if (manual.length) score = 89;
  else if (notApplicable.length) score = 95;
  return {
    status: blocking.length ? 'fail' : 'pass',
    score,
    labels: [
      ...(blocking.length ? ['target_quality_score_blocking_failure'] : []),
      ...(manual.length ? ['manual_confirmation_remaining'] : []),
      ...(notApplicable.length ? ['optional_not_applicable_allowed'] : []),
      ...(score === 100 ? ['all_required_target_gates_passed'] : []),
    ],
    blockingStatuses: blocking,
    manualStatuses: manual,
    notApplicableStatuses: notApplicable,
    safeSummaryOnly: true,
  };
}
function computeFailureReasonCatalogStatus() {
  const file = path.join('docs', 'process', 'CODEX_FAILURE_REASON_CATALOG.json');
  const required = [
    'missing_head_sha',
    'head_sha_mismatch',
    'stale_evidence',
    'missing_remote_evidence',
    'missing_command_result',
    'weak_evidence_phrase',
    'unsafe_claim_wording',
    'missing_human_confirmation',
    'human_confirmation_incomplete',
    'non_overridable_failure_present',
    'unsafe_value_detected',
    'scope_mismatch',
    'forbidden_path_changed',
    'local_ci_parity_mismatch',
    'evidence_pack_missing',
    'evidence_pack_invalid',
    'manual_confirmation_invalid',
    'generic_core_project_coupling',
    'profile_required_in_core_mode',
    'agents_context_mojibake',
    'agents_context_unsafe_value',
    'environment_readiness_missing',
    'golden_set_missing',
    'golden_set_failed',
    'best_of_n_required',
    'best_of_n_invalid',
    'task_queue_unsafe',
    'safe_trace_schema_invalid',
    'safe_trace_unsafe_value',
    'curator_auto_apply_forbidden',
    'curator_report_invalid',
    'offline_evolution_auto_apply_forbidden',
    'offline_evolution_proposal_invalid',
    'test_coverage_evidence_missing',
    'performance_claim_without_evidence',
    'agents_context_entire_file_mojibake',
    'agents_context_duplicate_harness_block',
    'agents_context_missing_harness_block',
    'target_manifest_missing',
    'change_classification_unknown',
    'product_verification_required',
    'npm_skip_not_allowed_for_product_change',
    'runtime_claim_requires_product_checks',
    'package_change_requires_package_verification',
    'target_quality_score_unavailable',
    'target_quality_score_blocking_failure',
    'workflow_runner_failed',
    'workflow_runner_invalid_report',
    'classification_rules_missing',
    'classification_rules_invalid',
    'classification_unknown_in_pr_context',
    'product_verification_evidence_missing',
    'product_verification_evidence_invalid',
    'product_verification_evidence_unsafe',
    'test_metrics_missing',
    'test_metrics_invalid',
    'test_metrics_unsafe',
    'performance_metrics_required',
    'stale_pr_detected',
    'stale_confirmation_detected',
    'stale_harness_version_in_pr',
    'reason_summary_invalid',
    'remote_product_baseline_missing',
    'remote_product_baseline_stale',
    'remote_product_baseline_failing',
    'remote_product_baseline_invalid',
    'remote_npm_diagnostic_missing',
    'remote_npm_diagnostic_invalid',
    'remote_npm_diagnostic_unknown',
    'remote_npm_diagnostic_unsafe',
    'workflow_preflight_failed',
    'workflow_preflight_missing_required_file',
    'safe_artifact_index_invalid',
    'safe_artifact_missing',
    'open_pr_hygiene_stale_pr',
    'open_pr_hygiene_needs_owner_decision',
    'baseline_failure',
    'candidate_regression',
    'target_final_summary_invalid',
  ];
  if (!fs.existsSync(file)) return { status: 'fail', missingReasonCodes: required, safeSummaryOnly: true };
  try {
    const catalog = readJsonFile(file);
    const found = new Set((catalog.reasonCodes || []).map((item) => item.reasonCode));
    const missingReasonCodes = required.filter((code) => !found.has(code));
    const incomplete = (catalog.reasonCodes || []).filter((item) =>
      !item.reasonCode || !item.gate || !item.severity || !item.safeMessage || !item.nextBestFix ||
      typeof item.canManualConfirmationOverride !== 'boolean');
    return {
      status: missingReasonCodes.length || incomplete.length || safeForbiddenArtifactHit(catalog) ? 'fail' : 'pass',
      missingReasonCodes,
      incompleteCount: incomplete.length,
      safeSummaryOnly: true,
    };
  } catch {
    return { status: 'fail', missingReasonCodes: required, safeSummaryOnly: true };
  }
}
function applyStatusOutcome(key, value, failures, warnings) {
  if (value?.status === 'fail') failures.push({ id: `${key}.failed`, message: `${key} failed` });
  else if (value?.status === 'manual_confirmation_required' || value?.status === 'warning') {
    warnings.push({ id: `${key}.manual`, message: `${key} requires manual confirmation` });
  }
}
function isPullRequestContext(env = process.env) {
  return env.CODEX_EVENT_NAME === 'pull_request' ||
    Boolean(env.CODEX_PR_NUMBER) ||
    Boolean(env.GITHUB_REF && env.GITHUB_REF.includes('/pull/'));
}
async function resolveRemoteGateContext(env = process.env) {
  const args = {
    repo: env.CODEX_REPOSITORY || env.GITHUB_REPOSITORY || '',
    pr: env.CODEX_PR_NUMBER || '',
    head: env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || '',
    base: env.CODEX_PR_BASE_SHA || '',
  };
  if (!isPullRequestContext(env) || !args.repo || !args.pr || !args.head) {
    return {
      env: {},
      status: 'not_applicable',
      reasonCodes: ['ci_replay_not_requested'],
      prBodySource: 'not_applicable',
      confirmationSource: 'not_applicable',
      safeSummaryOnly: true,
    };
  }
  const context = await buildGithubReplayContextAsync(args, env);
  return {
    env: context.status === 'pass' ? context.env : {},
    status: context.status,
    reasonCodes: context.reasonCodes || [],
    prBodySource: context.prBodySource || 'missing',
    confirmationSource: context.confirmationSource || 'missing',
    safeSummaryOnly: true,
  };
}
async function runSourceHarnessGate() {
  const jsonReport = process.env.CODEX_QUALITY_REPORT === 'json';
  const failures = [];
  const warnings = [];
  if (!jsonReport) console.log('== Codex source harness quality gate ==');
  const remoteContext = await resolveRemoteGateContext(process.env);
  const gateEnv = { ...process.env, ...remoteContext.env };
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
    genericHarnessCoreStatus: { status: 'not_run' },
    agentsContextStatus: { status: 'not_run' },
    environmentReadinessStatus: { status: 'not_run' },
    goldenSetStatus: { status: 'not_run' },
    changeClassificationStatus: { status: 'not_run' },
    productVerificationStatus: { status: 'not_run' },
    productVerificationEvidenceStatus: { status: 'not_run' },
    testMetricsStatus: { status: 'not_run' },
    remoteProductBaselineStatus: { status: 'not_run' },
    remoteNpmDiagnosticStatus: { status: 'not_run' },
    workflowPreflightStatus: { status: 'not_run' },
    safeArtifactIndexStatus: { status: 'not_run' },
    openPrHygieneStatus: { status: 'not_run' },
    targetFinalSummaryStatus: { status: 'not_run' },
    stalePrAuditStatus: { status: 'not_run' },
    reasonSummaryStatus: { status: 'not_run' },
    bestOfNEvidenceStatus: { status: 'not_run' },
    taskQueueLiteStatus: { status: 'not_run' },
    safeTraceSchemaStatus: { status: 'not_run' },
    curatorReportStatus: { status: 'not_run' },
    offlineEvolutionProposalStatus: { status: 'not_run' },
    testCoverageEvidenceStatus: { status: 'not_run' },
    performanceEvidenceStatus: { status: 'not_run' },
    productionReadinessStatus: { status: 'not_run' },
    evidenceIntegrityStatus: { status: 'not_run' },
    hermesInvariantStatus: { status: 'not_run' },
    humanConfirmationStatus: { status: 'not_run' },
    evidencePackStatus: { status: 'not_run' },
    humanConfirmationObjectStatus: { status: 'not_run' },
    safeOutputScanStatus: { status: 'not_run' },
    ciReplayStatus: { status: 'not_run' },
    prBodyLintStatus: { status: 'not_run' },
    failureReasonCatalogStatus: { status: 'not_run' },
    remoteContextStatus: {
      status: remoteContext.status,
      reasonCodes: remoteContext.reasonCodes,
      prBodySource: remoteContext.prBodySource,
      confirmationSource: remoteContext.confirmationSource,
      safeSummaryOnly: true,
    },
    v071SelfTestStatus: { status: 'not_run' },
    v072SelfTestStatus: { status: 'not_run' },
    v080SelfTestStatus: { status: 'not_run' },
    v081SelfTestStatus: { status: 'not_run' },
    v082SelfTestStatus: { status: 'not_run' },
    v083SelfTestStatus: { status: 'not_run' },
    profileTemplateCompatibilityStatus: { status: 'not_run' },
    qualityScoreStatus: { status: 'not_run' },
  };
  report.profileTemplateCompatibilityStatus = report.sourceHarnessValidationStatus.profileTemplateCompatibilityStatus || { status: 'missing' };
  if (report.sourceHarnessValidationStatus.status === 'fail') failures.push(...report.sourceHarnessValidationStatus.failures);
  if (report.sourceHarnessValidationStatus.status === 'warning') warnings.push(...report.sourceHarnessValidationStatus.warnings);
  const governance = runProfileGovernanceScripts(report);
  failures.push(...governance.failures);
  warnings.push(...governance.warnings);
  report.openaiCodexMethodStatus = runOpenAICodexMethodGate(gateEnv);
  report.methodSupportStatus = report.openaiCodexMethodStatus.methodSupportStatus || { status: 'missing' };
  report.genericHarnessCoreStatus = runGateScript('scripts/codex-generic-harness-core-gate.mjs', 'genericHarnessCoreStatus', 'CODEX_GENERIC_CORE_REPORT', gateEnv);
  report.agentsContextStatus = runGateScript('scripts/codex-agents-context-gate.mjs', 'agentsContextStatus', 'CODEX_AGENTS_CONTEXT_REPORT', gateEnv);
  report.environmentReadinessStatus = runGateScript('scripts/codex-environment-readiness-gate.mjs', 'environmentReadinessStatus', 'CODEX_ENVIRONMENT_READINESS_REPORT', gateEnv);
  report.goldenSetStatus = runGateScript('scripts/codex-golden-set-gate.mjs', 'goldenSetStatus', 'CODEX_GOLDEN_SET_REPORT', gateEnv);
  report.changeClassificationStatus = runGateScript('scripts/codex-change-classification-gate.mjs', 'changeClassificationStatus', 'CODEX_CHANGE_CLASSIFICATION_REPORT', gateEnv);
  report.productVerificationStatus = runGateScript('scripts/codex-product-verification-gate.mjs', 'productVerificationStatus', 'CODEX_PRODUCT_VERIFICATION_REPORT', gateEnv);
  report.productVerificationEvidenceStatus = runGateScript('scripts/codex-product-verification-evidence-normalize.mjs', 'productVerificationEvidenceStatus', 'CODEX_PRODUCT_VERIFICATION_EVIDENCE_REPORT', gateEnv);
  report.testMetricsStatus = runGateScript('scripts/codex-test-metrics-collect.mjs', 'testMetricsStatus', 'CODEX_TEST_METRICS_REPORT', gateEnv);
  report.remoteProductBaselineStatus = runGateScript('scripts/codex-remote-product-baseline-gate.mjs', 'remoteProductBaselineStatus', 'CODEX_REMOTE_PRODUCT_BASELINE_REPORT', gateEnv);
  report.remoteNpmDiagnosticStatus = runGateScript('scripts/codex-remote-npm-diagnostic-classify.mjs', 'remoteNpmDiagnosticStatus', 'CODEX_REMOTE_NPM_DIAGNOSTIC_REPORT', gateEnv);
  report.workflowPreflightStatus = runGateScript('scripts/codex-workflow-preflight.mjs', 'workflowPreflightStatus', 'CODEX_WORKFLOW_PREFLIGHT_REPORT', gateEnv);
  report.safeArtifactIndexStatus = runGateScript('scripts/codex-safe-artifact-index.mjs', 'safeArtifactIndexStatus', 'CODEX_SAFE_ARTIFACT_INDEX_REPORT', gateEnv);
  report.openPrHygieneStatus = runGateScript('scripts/codex-open-pr-hygiene-report.mjs', 'openPrHygieneStatus', 'CODEX_OPEN_PR_HYGIENE_REPORT', gateEnv);
  report.targetFinalSummaryStatus = runGateScript('scripts/codex-target-final-summary.mjs', 'targetFinalSummaryStatus', 'CODEX_TARGET_FINAL_SUMMARY_REPORT', gateEnv);
  report.stalePrAuditStatus = runGateScript('scripts/codex-stale-pr-audit-gate.mjs', 'stalePrAuditStatus', 'CODEX_STALE_PR_AUDIT_REPORT', gateEnv);
  report.productionReadinessStatus = runGateScript('scripts/codex-production-readiness-gate.mjs', 'productionReadinessStatus', 'CODEX_PRODUCTION_READINESS_REPORT', gateEnv);
  report.evidenceIntegrityStatus = runGateScript('scripts/codex-evidence-integrity-gate.mjs', 'evidenceIntegrityStatus', 'CODEX_EVIDENCE_INTEGRITY_REPORT', gateEnv);
  report.hermesInvariantStatus = runGateScript('scripts/codex-hermes-invariant-gate.mjs', 'hermesInvariantStatus', 'CODEX_HERMES_INVARIANT_REPORT', gateEnv);
  report.humanConfirmationStatus = buildHumanConfirmationStatus(gateEnv).humanConfirmationStatus;
  report.evidencePackStatus = runGateScript('scripts/codex-evidence-pack-validate.mjs', 'evidencePackStatus', 'CODEX_EVIDENCE_PACK_REPORT', gateEnv);
  report.humanConfirmationObjectStatus = runGateScript('scripts/codex-human-confirmation-validate.mjs', 'humanConfirmationObjectStatus', 'CODEX_HUMAN_CONFIRMATION_REPORT', gateEnv);
  report.safeOutputScanStatus = runGateScript('scripts/codex-safe-output-scan.mjs', 'safeOutputScanStatus', 'CODEX_SAFE_OUTPUT_SCAN_REPORT', gateEnv);
  report.ciReplayStatus = runGateScript('scripts/codex-ci-replay.mjs', 'ciReplayStatus', 'CODEX_CI_REPLAY_REPORT', gateEnv);
  report.prBodyLintStatus = runGateScript('scripts/codex-pr-body-lint.mjs', 'prBodyLintStatus', 'CODEX_PR_BODY_LINT_REPORT', gateEnv);
  report.failureReasonCatalogStatus = computeFailureReasonCatalogStatus();
  report.v071SelfTestStatus = runGateScript('scripts/codex-v071-self-test.mjs', 'v071SelfTestStatus', 'CODEX_V071_SELF_TEST_REPORT', gateEnv);
  report.v072SelfTestStatus = runGateScript('scripts/codex-v072-self-test.mjs', 'v072SelfTestStatus', 'CODEX_V072_SELF_TEST_REPORT', gateEnv);
  report.bestOfNEvidenceStatus = runGateScript('scripts/codex-best-of-n-evidence-gate.mjs', 'bestOfNEvidenceStatus', 'CODEX_BEST_OF_N_EVIDENCE_REPORT', gateEnv);
  report.taskQueueLiteStatus = runGateScript('scripts/codex-task-queue-lite-gate.mjs', 'taskQueueLiteStatus', 'CODEX_TASK_QUEUE_LITE_REPORT', gateEnv);
  report.safeTraceSchemaStatus = runGateScript('scripts/codex-safe-trace-schema-gate.mjs', 'safeTraceSchemaStatus', 'CODEX_SAFE_TRACE_SCHEMA_REPORT', gateEnv);
  report.curatorReportStatus = runGateScript('scripts/codex-curator-report-gate.mjs', 'curatorReportStatus', 'CODEX_CURATOR_REPORT', gateEnv);
  report.offlineEvolutionProposalStatus = runGateScript('scripts/codex-offline-evolution-proposal-gate.mjs', 'offlineEvolutionProposalStatus', 'CODEX_OFFLINE_EVOLUTION_PROPOSAL_REPORT', gateEnv);
  report.testCoverageEvidenceStatus = runGateScript('scripts/codex-test-coverage-evidence-gate.mjs', 'testCoverageEvidenceStatus', 'CODEX_TEST_COVERAGE_EVIDENCE_REPORT', gateEnv);
  report.performanceEvidenceStatus = runGateScript('scripts/codex-performance-evidence-gate.mjs', 'performanceEvidenceStatus', 'CODEX_PERFORMANCE_EVIDENCE_REPORT', gateEnv);
  report.v080SelfTestStatus = runGateScript('scripts/codex-v080-self-test.mjs', 'v080SelfTestStatus', 'CODEX_V080_SELF_TEST_REPORT', gateEnv);
  report.v081SelfTestStatus = process.env.CODEX_SKIP_V081_SELF_TEST === '1'
    ? { status: 'not_applicable', reasonCodes: ['self_test_recursion_guard'], safeSummaryOnly: true }
    : runGateScript('scripts/codex-v081-self-test.mjs', 'v081SelfTestStatus', 'CODEX_V081_SELF_TEST_REPORT', gateEnv);
  report.v082SelfTestStatus = process.env.CODEX_SKIP_V082_SELF_TEST === '1'
    ? { status: 'not_applicable', reasonCodes: ['self_test_recursion_guard'], safeSummaryOnly: true }
    : runGateScript('scripts/codex-v082-self-test.mjs', 'v082SelfTestStatus', 'CODEX_V082_SELF_TEST_REPORT', gateEnv);
  report.v083SelfTestStatus = process.env.CODEX_SKIP_V083_SELF_TEST === '1'
    ? { status: 'not_applicable', reasonCodes: ['self_test_recursion_guard'], safeSummaryOnly: true }
    : runGateScript('scripts/codex-v083-self-test.mjs', 'v083SelfTestStatus', 'CODEX_V083_SELF_TEST_REPORT', gateEnv);
  const reasonSummary = buildCompactReasonSummary(report);
  report.reasonSummaryStatus = {
    status: reasonSummary.status,
    reasonCodes: reasonSummary.reasonCodes,
    summary: reasonSummary.summary,
    safeSummaryOnly: true,
  };

  for (const [key, value] of Object.entries({
    profileTemplateCompatibilityStatus: report.profileTemplateCompatibilityStatus,
    agentMemoryPolicyStatus: report.agentMemoryPolicyStatus,
    skillLifecyclePolicyStatus: report.skillLifecyclePolicyStatus,
    curatorSuggestionStatus: report.curatorSuggestionStatus,
    selfEvolutionPolicyStatus: report.selfEvolutionPolicyStatus,
    openaiCodexMethodStatus: report.openaiCodexMethodStatus,
    methodSupportStatus: report.methodSupportStatus,
    genericHarnessCoreStatus: report.genericHarnessCoreStatus,
    agentsContextStatus: report.agentsContextStatus,
    environmentReadinessStatus: report.environmentReadinessStatus,
    goldenSetStatus: report.goldenSetStatus,
    changeClassificationStatus: report.changeClassificationStatus,
    productVerificationStatus: report.productVerificationStatus,
    productVerificationEvidenceStatus: report.productVerificationEvidenceStatus,
    testMetricsStatus: report.testMetricsStatus,
    remoteProductBaselineStatus: report.remoteProductBaselineStatus,
    remoteNpmDiagnosticStatus: report.remoteNpmDiagnosticStatus,
    workflowPreflightStatus: report.workflowPreflightStatus,
    safeArtifactIndexStatus: report.safeArtifactIndexStatus,
    openPrHygieneStatus: report.openPrHygieneStatus,
    targetFinalSummaryStatus: report.targetFinalSummaryStatus,
    stalePrAuditStatus: report.stalePrAuditStatus,
    reasonSummaryStatus: report.reasonSummaryStatus,
    productionReadinessStatus: report.productionReadinessStatus,
    evidenceIntegrityStatus: report.evidenceIntegrityStatus,
    hermesInvariantStatus: report.hermesInvariantStatus,
    humanConfirmationStatus: report.humanConfirmationStatus,
    evidencePackStatus: report.evidencePackStatus,
    humanConfirmationObjectStatus: report.humanConfirmationObjectStatus,
    safeOutputScanStatus: report.safeOutputScanStatus,
    ciReplayStatus: report.ciReplayStatus,
    prBodyLintStatus: report.prBodyLintStatus,
    failureReasonCatalogStatus: report.failureReasonCatalogStatus,
    v071SelfTestStatus: report.v071SelfTestStatus,
    v072SelfTestStatus: report.v072SelfTestStatus,
    v080SelfTestStatus: report.v080SelfTestStatus,
    v081SelfTestStatus: report.v081SelfTestStatus,
    v082SelfTestStatus: report.v082SelfTestStatus,
    v083SelfTestStatus: report.v083SelfTestStatus,
    bestOfNEvidenceStatus: report.bestOfNEvidenceStatus,
    taskQueueLiteStatus: report.taskQueueLiteStatus,
    safeTraceSchemaStatus: report.safeTraceSchemaStatus,
    curatorReportStatus: report.curatorReportStatus,
    offlineEvolutionProposalStatus: report.offlineEvolutionProposalStatus,
    testCoverageEvidenceStatus: report.testCoverageEvidenceStatus,
    performanceEvidenceStatus: report.performanceEvidenceStatus,
  })) {
    applyStatusOutcome(key, value, failures, warnings);
  }
  report.humanReviewRequired = warnings.length > 0 || report.humanConfirmationStatus.status === 'manual_confirmation_required';
  report.safeArtifactValidation = computeSafeArtifactValidation(report);
  if (report.safeArtifactValidation.status === 'fail') failures.push({ id: 'safeArtifactValidation.failed', message: 'safe artifact validation failed' });
  report.qualityScoreStatus = computeQualityScoreStatus(report);
  report.outputShapeStatus = computeOutputShapeStatus(report);
  if (report.outputShapeStatus.status === 'fail') failures.push({ id: 'outputShapeStatus.failed', message: 'output shape validation failed' });
  report.qualityScoreStatus = computeQualityScoreStatus(report);
  if (report.qualityScoreStatus.status === 'fail') failures.push({ id: 'qualityScoreStatus.failed', message: 'quality score validation failed' });
  report.status = failures.length ? 'fail' : (warnings.length ? 'manual_confirmation_required' : 'pass');
  report.mergeReady = failures.length === 0 && warnings.length === 0 && ['pass', 'not_required'].includes(report.humanConfirmationStatus.status);
  report.localGate = { status: report.status };

  if (jsonReport) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`status: ${report.status}`);
    console.log(`sourceHarnessValidationStatus: ${report.sourceHarnessValidationStatus.status}`);
    console.log(`profileTemplateCompatibilityStatus: ${report.profileTemplateCompatibilityStatus.status}`);
    console.log(`agentMemoryPolicyStatus: ${report.agentMemoryPolicyStatus.status}`);
    console.log(`skillLifecyclePolicyStatus: ${report.skillLifecyclePolicyStatus.status}`);
    console.log(`curatorSuggestionStatus: ${report.curatorSuggestionStatus.status}`);
    console.log(`selfEvolutionPolicyStatus: ${report.selfEvolutionPolicyStatus.status}`);
    console.log(`openaiCodexMethodStatus: ${report.openaiCodexMethodStatus.status}`);
    console.log(`methodSupportStatus: ${report.methodSupportStatus.status}`);
    console.log(`genericHarnessCoreStatus: ${report.genericHarnessCoreStatus.status}`);
    console.log(`agentsContextStatus: ${report.agentsContextStatus.status}`);
    console.log(`environmentReadinessStatus: ${report.environmentReadinessStatus.status}`);
    console.log(`goldenSetStatus: ${report.goldenSetStatus.status}`);
    console.log(`changeClassificationStatus: ${report.changeClassificationStatus.status}`);
    console.log(`productVerificationStatus: ${report.productVerificationStatus.status}`);
    console.log(`productVerificationEvidenceStatus: ${report.productVerificationEvidenceStatus.status}`);
    console.log(`testMetricsStatus: ${report.testMetricsStatus.status}`);
    console.log(`remoteProductBaselineStatus: ${report.remoteProductBaselineStatus.status}`);
    console.log(`remoteNpmDiagnosticStatus: ${report.remoteNpmDiagnosticStatus.status}`);
    console.log(`workflowPreflightStatus: ${report.workflowPreflightStatus.status}`);
    console.log(`safeArtifactIndexStatus: ${report.safeArtifactIndexStatus.status}`);
    console.log(`openPrHygieneStatus: ${report.openPrHygieneStatus.status}`);
    console.log(`targetFinalSummaryStatus: ${report.targetFinalSummaryStatus.status}`);
    console.log(`stalePrAuditStatus: ${report.stalePrAuditStatus.status}`);
    console.log(`reasonSummaryStatus: ${report.reasonSummaryStatus.status}`);
    console.log(`productionReadinessStatus: ${report.productionReadinessStatus.status}`);
    console.log(`evidenceIntegrityStatus: ${report.evidenceIntegrityStatus.status}`);
    console.log(`hermesInvariantStatus: ${report.hermesInvariantStatus.status}`);
    console.log(`humanConfirmationStatus: ${report.humanConfirmationStatus.status}`);
    console.log(`evidencePackStatus: ${report.evidencePackStatus.status}`);
    console.log(`humanConfirmationObjectStatus: ${report.humanConfirmationObjectStatus.status}`);
    console.log(`safeOutputScanStatus: ${report.safeOutputScanStatus.status}`);
    console.log(`ciReplayStatus: ${report.ciReplayStatus.status}`);
    console.log(`prBodyLintStatus: ${report.prBodyLintStatus.status}`);
    console.log(`failureReasonCatalogStatus: ${report.failureReasonCatalogStatus.status}`);
    console.log(`v071SelfTestStatus: ${report.v071SelfTestStatus.status}`);
    console.log(`v072SelfTestStatus: ${report.v072SelfTestStatus.status}`);
    console.log(`v080SelfTestStatus: ${report.v080SelfTestStatus.status}`);
    console.log(`v081SelfTestStatus: ${report.v081SelfTestStatus.status}`);
    console.log(`v082SelfTestStatus: ${report.v082SelfTestStatus.status}`);
    console.log(`v083SelfTestStatus: ${report.v083SelfTestStatus.status}`);
    console.log(`bestOfNEvidenceStatus: ${report.bestOfNEvidenceStatus.status}`);
    console.log(`taskQueueLiteStatus: ${report.taskQueueLiteStatus.status}`);
    console.log(`safeTraceSchemaStatus: ${report.safeTraceSchemaStatus.status}`);
    console.log(`curatorReportStatus: ${report.curatorReportStatus.status}`);
    console.log(`offlineEvolutionProposalStatus: ${report.offlineEvolutionProposalStatus.status}`);
    console.log(`testCoverageEvidenceStatus: ${report.testCoverageEvidenceStatus.status}`);
    console.log(`performanceEvidenceStatus: ${report.performanceEvidenceStatus.status}`);
    console.log(`safeArtifactValidation: ${report.safeArtifactValidation.status}`);
    console.log(`outputShapeStatus: ${report.outputShapeStatus.status}`);
    console.log(`qualityScoreStatus: ${report.qualityScoreStatus.status}`);
    console.log(`qualityScore: ${report.qualityScoreStatus.score}`);
  }
  if (failures.length) {
    console.error('Codex source harness quality gate failed. Safe summary:');
    for (const failure of failures.slice(0, 20)) console.error(`- ${failure.id}: ${failure.message}`);
    process.exit(1);
  }
  if (!jsonReport) console.log('Codex source harness quality gate passed.');
  process.exit(0);
}

function targetManifestStatus() {
  const file = path.join('docs', 'process', 'CODEX_HARNESS_MANIFEST.json');
  if (!fs.existsSync(file)) {
    return { status: 'fail', reasonCodes: ['target_manifest_missing'], safeSummaryOnly: true };
  }
  try {
    const manifest = readJsonFile(file);
    const failures = [];
    if (!manifest.targetRepoMode) failures.push('target_manifest_missing');
    if (manifest.harnessVersion && manifest.harnessVersion !== HARNESS_VERSION) failures.push('target_manifest_version_mismatch');
    if (safeForbiddenArtifactHit(manifest)) failures.push('unsafe_value_detected');
    return {
      status: failures.length ? 'fail' : 'pass',
      reasonCodes: failures,
      targetRepoMode: manifest.targetRepoMode === true,
      safeSummaryOnly: true,
    };
  } catch {
    return { status: 'fail', reasonCodes: ['target_manifest_missing'], safeSummaryOnly: true };
  }
}

async function runTargetHarnessGate() {
  const jsonReport = process.env.CODEX_QUALITY_REPORT === 'json';
  const failures = [];
  const warnings = [];
  if (!jsonReport) console.log('== Codex target harness quality gate ==');

  const secretScan = spawn('node', ['scripts/codex-secret-safety-scan.mjs'], { stdio: 'pipe' });
  if (secretScan.status !== 0) failures.push({ id: 'secretScan.failed', message: 'secret safety scan failed' });

  const gateEnv = { ...process.env };
  const report = {
    marker: MARKER,
    harnessVersion: HARNESS_VERSION,
    status: 'running',
    mergeReady: false,
    targetMergeReady: false,
    targetManifestStatus: targetManifestStatus(),
    secretScan: { status: secretScan.status === 0 ? 'pass' : 'fail' },
    agentsContextStatus: { status: 'not_run' },
    environmentReadinessStatus: { status: 'not_run' },
    changeClassificationStatus: { status: 'not_run' },
    productVerificationStatus: { status: 'not_run' },
    productVerificationEvidenceStatus: { status: 'not_run' },
    testMetricsStatus: { status: 'not_run' },
    remoteProductBaselineStatus: { status: 'not_run' },
    remoteNpmDiagnosticStatus: { status: 'not_run' },
    workflowPreflightStatus: { status: 'not_run' },
    safeArtifactIndexStatus: { status: 'not_run' },
    openPrHygieneStatus: { status: 'not_run' },
    targetFinalSummaryStatus: { status: 'not_run' },
    stalePrAuditStatus: { status: 'not_run' },
    reasonSummaryStatus: { status: 'not_run' },
    safeOutputScanStatus: { status: 'not_run' },
    goldenSetStatus: { status: 'not_run' },
    bestOfNEvidenceStatus: { status: 'not_run' },
    taskQueueLiteStatus: { status: 'not_run' },
    safeTraceSchemaStatus: { status: 'not_run' },
    curatorReportStatus: { status: 'not_run' },
    offlineEvolutionProposalStatus: { status: 'not_run' },
    testCoverageEvidenceStatus: { status: 'not_run' },
    performanceEvidenceStatus: { status: 'not_run' },
    v080SelfTestStatus: { status: 'not_run' },
    v081SelfTestStatus: { status: 'not_run' },
    v082SelfTestStatus: { status: 'not_run' },
    v083SelfTestStatus: { status: 'not_run' },
    safeArtifactValidation: { status: 'not_run' },
    outputShapeStatus: { status: 'not_run' },
    targetQualityScoreStatus: { status: 'not_run' },
    failures,
    warnings,
    humanReviewRequired: false,
  };

  report.agentsContextStatus = runGateScript('scripts/codex-agents-context-gate.mjs', 'agentsContextStatus', 'CODEX_AGENTS_CONTEXT_REPORT', gateEnv);
  report.environmentReadinessStatus = runGateScript('scripts/codex-environment-readiness-gate.mjs', 'environmentReadinessStatus', 'CODEX_ENVIRONMENT_READINESS_REPORT', gateEnv);
  report.changeClassificationStatus = runGateScript('scripts/codex-change-classification-gate.mjs', 'changeClassificationStatus', 'CODEX_CHANGE_CLASSIFICATION_REPORT', gateEnv);
  report.productVerificationStatus = runGateScript('scripts/codex-product-verification-gate.mjs', 'productVerificationStatus', 'CODEX_PRODUCT_VERIFICATION_REPORT', gateEnv);
  report.productVerificationEvidenceStatus = runGateScript('scripts/codex-product-verification-evidence-normalize.mjs', 'productVerificationEvidenceStatus', 'CODEX_PRODUCT_VERIFICATION_EVIDENCE_REPORT', gateEnv);
  report.testMetricsStatus = runGateScript('scripts/codex-test-metrics-collect.mjs', 'testMetricsStatus', 'CODEX_TEST_METRICS_REPORT', gateEnv);
  report.remoteProductBaselineStatus = runGateScript('scripts/codex-remote-product-baseline-gate.mjs', 'remoteProductBaselineStatus', 'CODEX_REMOTE_PRODUCT_BASELINE_REPORT', gateEnv);
  report.remoteNpmDiagnosticStatus = runGateScript('scripts/codex-remote-npm-diagnostic-classify.mjs', 'remoteNpmDiagnosticStatus', 'CODEX_REMOTE_NPM_DIAGNOSTIC_REPORT', gateEnv);
  report.workflowPreflightStatus = runGateScript('scripts/codex-workflow-preflight.mjs', 'workflowPreflightStatus', 'CODEX_WORKFLOW_PREFLIGHT_REPORT', gateEnv);
  report.safeArtifactIndexStatus = runGateScript('scripts/codex-safe-artifact-index.mjs', 'safeArtifactIndexStatus', 'CODEX_SAFE_ARTIFACT_INDEX_REPORT', gateEnv);
  report.openPrHygieneStatus = runGateScript('scripts/codex-open-pr-hygiene-report.mjs', 'openPrHygieneStatus', 'CODEX_OPEN_PR_HYGIENE_REPORT', gateEnv);
  report.targetFinalSummaryStatus = runGateScript('scripts/codex-target-final-summary.mjs', 'targetFinalSummaryStatus', 'CODEX_TARGET_FINAL_SUMMARY_REPORT', gateEnv);
  report.stalePrAuditStatus = runGateScript('scripts/codex-stale-pr-audit-gate.mjs', 'stalePrAuditStatus', 'CODEX_STALE_PR_AUDIT_REPORT', gateEnv);
  report.safeOutputScanStatus = runGateScript('scripts/codex-safe-output-scan.mjs', 'safeOutputScanStatus', 'CODEX_SAFE_OUTPUT_SCAN_REPORT', gateEnv);
  report.goldenSetStatus = fs.existsSync(path.join('docs', 'process', 'golden', 'cases.json'))
    ? runGateScript('scripts/codex-golden-set-gate.mjs', 'goldenSetStatus', 'CODEX_GOLDEN_SET_REPORT', gateEnv)
    : { status: 'not_applicable', reasonCodes: ['golden_set_not_configured'], safeSummaryOnly: true };
  report.bestOfNEvidenceStatus = runGateScript('scripts/codex-best-of-n-evidence-gate.mjs', 'bestOfNEvidenceStatus', 'CODEX_BEST_OF_N_EVIDENCE_REPORT', gateEnv);
  report.taskQueueLiteStatus = runGateScript('scripts/codex-task-queue-lite-gate.mjs', 'taskQueueLiteStatus', 'CODEX_TASK_QUEUE_LITE_REPORT', gateEnv);
  report.safeTraceSchemaStatus = runGateScript('scripts/codex-safe-trace-schema-gate.mjs', 'safeTraceSchemaStatus', 'CODEX_SAFE_TRACE_SCHEMA_REPORT', gateEnv);
  report.curatorReportStatus = runGateScript('scripts/codex-curator-report-gate.mjs', 'curatorReportStatus', 'CODEX_CURATOR_REPORT', gateEnv);
  report.offlineEvolutionProposalStatus = runGateScript('scripts/codex-offline-evolution-proposal-gate.mjs', 'offlineEvolutionProposalStatus', 'CODEX_OFFLINE_EVOLUTION_PROPOSAL_REPORT', gateEnv);
  report.testCoverageEvidenceStatus = runGateScript('scripts/codex-test-coverage-evidence-gate.mjs', 'testCoverageEvidenceStatus', 'CODEX_TEST_COVERAGE_EVIDENCE_REPORT', gateEnv);
  report.performanceEvidenceStatus = runGateScript('scripts/codex-performance-evidence-gate.mjs', 'performanceEvidenceStatus', 'CODEX_PERFORMANCE_EVIDENCE_REPORT', gateEnv);
  report.v080SelfTestStatus = runGateScript('scripts/codex-v080-self-test.mjs', 'v080SelfTestStatus', 'CODEX_V080_SELF_TEST_REPORT', gateEnv);
  report.v081SelfTestStatus = process.env.CODEX_SKIP_V081_SELF_TEST === '1'
    ? { status: 'not_applicable', reasonCodes: ['self_test_recursion_guard'], safeSummaryOnly: true }
    : runGateScript('scripts/codex-v081-self-test.mjs', 'v081SelfTestStatus', 'CODEX_V081_SELF_TEST_REPORT', gateEnv);
  report.v082SelfTestStatus = process.env.CODEX_SKIP_V082_SELF_TEST === '1'
    ? { status: 'not_applicable', reasonCodes: ['self_test_recursion_guard'], safeSummaryOnly: true }
    : runGateScript('scripts/codex-v082-self-test.mjs', 'v082SelfTestStatus', 'CODEX_V082_SELF_TEST_REPORT', gateEnv);
  report.v083SelfTestStatus = process.env.CODEX_SKIP_V083_SELF_TEST === '1'
    ? { status: 'not_applicable', reasonCodes: ['self_test_recursion_guard'], safeSummaryOnly: true }
    : runGateScript('scripts/codex-v083-self-test.mjs', 'v083SelfTestStatus', 'CODEX_V083_SELF_TEST_REPORT', gateEnv);
  const reasonSummary = buildCompactReasonSummary(report);
  report.reasonSummaryStatus = {
    status: reasonSummary.status,
    reasonCodes: reasonSummary.reasonCodes,
    summary: reasonSummary.summary,
    safeSummaryOnly: true,
  };

  for (const [key, value] of Object.entries({
    targetManifestStatus: report.targetManifestStatus,
    secretScan: report.secretScan,
    agentsContextStatus: report.agentsContextStatus,
    environmentReadinessStatus: report.environmentReadinessStatus,
    changeClassificationStatus: report.changeClassificationStatus,
    productVerificationStatus: report.productVerificationStatus,
    productVerificationEvidenceStatus: report.productVerificationEvidenceStatus,
    testMetricsStatus: report.testMetricsStatus,
    remoteProductBaselineStatus: report.remoteProductBaselineStatus,
    remoteNpmDiagnosticStatus: report.remoteNpmDiagnosticStatus,
    workflowPreflightStatus: report.workflowPreflightStatus,
    safeArtifactIndexStatus: report.safeArtifactIndexStatus,
    openPrHygieneStatus: report.openPrHygieneStatus,
    targetFinalSummaryStatus: report.targetFinalSummaryStatus,
    stalePrAuditStatus: report.stalePrAuditStatus,
    reasonSummaryStatus: report.reasonSummaryStatus,
    safeOutputScanStatus: report.safeOutputScanStatus,
    goldenSetStatus: report.goldenSetStatus,
    bestOfNEvidenceStatus: report.bestOfNEvidenceStatus,
    taskQueueLiteStatus: report.taskQueueLiteStatus,
    safeTraceSchemaStatus: report.safeTraceSchemaStatus,
    curatorReportStatus: report.curatorReportStatus,
    offlineEvolutionProposalStatus: report.offlineEvolutionProposalStatus,
    testCoverageEvidenceStatus: report.testCoverageEvidenceStatus,
    performanceEvidenceStatus: report.performanceEvidenceStatus,
    v080SelfTestStatus: report.v080SelfTestStatus,
    v081SelfTestStatus: report.v081SelfTestStatus,
    v082SelfTestStatus: report.v082SelfTestStatus,
    v083SelfTestStatus: report.v083SelfTestStatus,
  })) {
    applyStatusOutcome(key, value, failures, warnings);
  }
  report.safeArtifactValidation = computeSafeArtifactValidation(report);
  if (report.safeArtifactValidation.status === 'fail') failures.push({ id: 'safeArtifactValidation.failed', message: 'safe artifact validation failed' });
  report.targetQualityScoreStatus = computeTargetQualityScoreStatus(report);
  report.outputShapeStatus = computeTargetOutputShapeStatus(report);
  if (report.outputShapeStatus.status === 'fail') failures.push({ id: 'outputShapeStatus.failed', message: 'output shape validation failed' });
  report.targetQualityScoreStatus = computeTargetQualityScoreStatus(report);
  if (report.targetQualityScoreStatus.status === 'fail') failures.push({ id: 'targetQualityScoreStatus.failed', message: 'target quality score validation failed' });
  report.status = failures.length ? 'fail' : (warnings.length ? 'manual_confirmation_required' : 'pass');
  report.mergeReady = failures.length === 0 && warnings.length === 0;
  report.targetMergeReady = report.mergeReady;
  report.humanReviewRequired = warnings.length > 0;

  if (jsonReport) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`status: ${report.status}`);
    console.log(`targetQualityScoreStatus: ${report.targetQualityScoreStatus.status}`);
    console.log(`targetQualityScore: ${report.targetQualityScoreStatus.score}`);
  }
  if (failures.length) process.exit(1);
  if (!jsonReport) console.log('Codex target harness quality gate passed.');
  process.exit(0);
}

if (process.env.CODEX_QUALITY_REPORT !== 'json') console.log('== Codex local quality gate ==');
if (process.env.CODEX_HARNESS_SOURCE_REPO === '1') await runSourceHarnessGate();
if (process.env.CODEX_HARNESS_MODE === 'target') await runTargetHarnessGate();
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
