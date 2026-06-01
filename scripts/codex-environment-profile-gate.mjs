#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function has(cmd, args = ['--version'], env = process.env) {
  const result = spawnSync(cmd, args, { stdio: 'ignore', shell: process.platform === 'win32', env: { ...process.env, ...env } });
  return result.status === 0;
}

function safeGhAuthLabel(env = process.env) {
  if (!has('gh', ['--version'], env)) return 'unavailable';
  const result = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', env: { ...process.env, ...env } });
  return result.status === 0 ? 'available' : 'unavailable';
}

export function buildEnvironmentProfileReport(env = process.env) {
  const npmRequired = env.CODEX_REQUIRE_NPM === '1' || fs.existsSync('package.json');
  const networkRequired = env.CODEX_NETWORK_REQUIRED === '1';
  const githubRequired = env.CODEX_GITHUB_OPERATION_REQUIRED === '1';
  const profile = {
    nodeVersion: process.versions.node,
    npmAvailable: has('npm', ['--version'], env),
    gitAvailable: has('git', ['--version'], env),
    ghAvailable: has('gh', ['--version'], env),
    ghAuthStatus: safeGhAuthLabel(env),
    workflowDispatchAvailability: has('gh', ['--version'], env) ? 'available_if_authenticated' : 'unavailable',
    packageInstallPolicy: fs.existsSync('package.json') ? 'package_present' : 'no_package_json',
    networkRequired,
    internetUnavailableReason: networkRequired && env.CODEX_INTERNET_AVAILABLE === '0' ? 'internet_unavailable' : '',
    platform: process.platform,
    lineEndingRisk: process.platform === 'win32' ? 'windows_line_endings_possible' : 'low',
    pathSeparatorRisk: process.platform === 'win32' ? 'windows_separator_possible' : 'low',
    safeSummaryOnly: true,
  };
  const failures = [];
  const warnings = [];
  if (!profile.nodeVersion) failures.push('environment_profile_failed');
  if (!profile.gitAvailable) failures.push('environment_profile_failed');
  if (npmRequired && !profile.npmAvailable) failures.push('environment_profile_failed');
  if (githubRequired && (!profile.ghAvailable || profile.ghAuthStatus !== 'available')) failures.push('gh_auth_required_but_unavailable');
  if (networkRequired && env.CODEX_INTERNET_AVAILABLE === '0' && !env.CODEX_OFFLINE_FALLBACK) failures.push('environment_profile_failed');
  if (!profile.ghAvailable && !githubRequired) warnings.push('gh_unavailable_not_required');
  if (env.CODEX_NPM_COMMAND_INVENTED === '1') failures.push('environment_profile_failed');
  return simpleStatus('environmentProfileStatus', failures.length ? 'fail' : 'pass', {
    reasonCodes: [...new Set(failures)],
    warnings,
    profile,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildEnvironmentProfileReport();
  writeJsonReport(report, 'CODEX_ENVIRONMENT_PROFILE_REPORT');
  exitFor(report);
}
