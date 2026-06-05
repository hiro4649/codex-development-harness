#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import { fileURLToPath } from 'node:url';
import {
  HARNESS_VERSION,
  readJson,
  scanObjectForUnsafe,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';

const SAFE_CATEGORIES = new Set([
  'test_assertion_failure',
  'lint_failure',
  'typecheck_failure',
  'module_resolution_failure',
  'missing_dependency',
  'script_missing',
  'node_version_mismatch',
  'timeout',
  'process_signal',
  'env_config_missing',
  'snapshot_mismatch',
  'package_manager_error',
  'baseline_failure',
  'unknown_npm_failure',
]);

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inputFromEnv(env = process.env) {
  if (env.CODEX_NPM_TEST_SAFE_SUMMARY_JSON) {
    try {
      return JSON.parse(env.CODEX_NPM_TEST_SAFE_SUMMARY_JSON);
    } catch {
      return { __invalid: true };
    }
  }
  if (env.CODEX_NPM_TEST_SAFE_SUMMARY_PATH) {
    const parsed = readJson(env.CODEX_NPM_TEST_SAFE_SUMMARY_PATH);
    if (!parsed.ok) return parsed.reasonCode === 'file_missing' ? null : { __invalid: true };
    return parsed.value;
  }
  if (env.CODEX_NPM_EXIT_CODE || env.CODEX_NPM_SAFE_FAILURE_CATEGORY) {
    return {
      npmExitCode: env.CODEX_NPM_EXIT_CODE,
      safeFailureCategory: env.CODEX_NPM_SAFE_FAILURE_CATEGORY || 'unknown_npm_failure',
      nodeMajor: env.CODEX_NODE_MAJOR,
      platform: env.CODEX_PLATFORM_LABEL,
      packageManager: env.CODEX_PACKAGE_MANAGER,
      commandClass: env.CODEX_NPM_COMMAND_CLASS,
    };
  }
  return null;
}

function hasUnsafeKeys(value) {
  if (!value || typeof value !== 'object') return false;
  const unsafe = /raw(?:Log|Logs|Stdout|Stderr|Output|Payload|Diff)|stackTrace|secret|token|endpoint|privatePath|productionData|personalData/i;
  const safeAbsence = /^(rawLogUploaded|rawLogsIncluded|rawStdoutIncluded|rawStderrIncluded|rawOutputIncluded|rawPayloadIncluded|rawValuesStored)$/i;
  const visit = (node) => node && typeof node === 'object' &&
    Object.entries(node).some(([key, nested]) => {
      if (safeAbsence.test(key) && nested === false) return false;
      return unsafe.test(key) || visit(nested);
    });
  return visit(value);
}

export function normalizeRemoteNpmDiagnostic(input = {}) {
  const category = SAFE_CATEGORIES.has(String(input.safeFailureCategory || input.safe_failure_category || ''))
    ? String(input.safeFailureCategory || input.safe_failure_category)
    : 'unknown_npm_failure';
  const diagnostic = {
    schemaVersion: '0.8.3',
    harnessVersion: HARNESS_VERSION,
    npmExitCode: numberOrNull(input.npmExitCode ?? input.npm_exit_code),
    nodeMajor: numberOrNull(input.nodeMajor ?? input.node_version_major),
    platform: String(input.platform || input.platform_label || 'unknown').slice(0, 60),
    os: String(input.os || 'unknown').slice(0, 60),
    packageManager: String(input.packageManager || input.package_manager || 'unknown').slice(0, 60),
    commandClass: String(input.commandClass || input.command_class || 'npm_test').slice(0, 80),
    safeFailureCategory: category,
    safeMarkerCount: numberOrNull(input.safeMarkerCount ?? input.safe_marker_count),
    testCountDetected: numberOrNull(input.testCountDetected ?? input.safe_test_count),
    durationMs: numberOrNull(input.durationMs),
    knownBaselineMatched: Boolean(input.knownBaselineMatched),
    rawLogUploaded: false,
    rawValuesStored: false,
    safeSummaryOnly: true,
  };
  const unsafe = scanObjectForUnsafe(diagnostic).length || scanObjectForUnsafe(input).length || hasUnsafeKeys(input);
  return { diagnostic, unsafe };
}

export function buildRemoteNpmDiagnosticReport(env = process.env) {
  const input = inputFromEnv(env);
  if (!input) {
    return simpleStatus('remoteNpmDiagnosticStatus', 'not_applicable', {
      reasonCodes: ['remote_npm_diagnostic_missing'],
    });
  }
  if (input.__invalid) {
    return simpleStatus('remoteNpmDiagnosticStatus', 'fail', { reasonCodes: ['remote_npm_diagnostic_invalid'] });
  }
  const { diagnostic, unsafe } = normalizeRemoteNpmDiagnostic(input);
  if (unsafe) return simpleStatus('remoteNpmDiagnosticStatus', 'fail', { reasonCodes: ['remote_npm_diagnostic_unsafe'] });
  const unknown = diagnostic.safeFailureCategory === 'unknown_npm_failure';
  return simpleStatus('remoteNpmDiagnosticStatus', unknown ? 'manual_confirmation_required' : 'pass', {
    diagnostic,
    reasonCodes: unknown ? ['remote_npm_diagnostic_unknown'] : [],
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildRemoteNpmDiagnosticReport();
    writeJsonReport(report, 'CODEX_REMOTE_NPM_DIAGNOSTIC_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('remoteNpmDiagnosticStatus', 'fail', { reasonCodes: ['remote_npm_diagnostic_invalid'] });
    writeJsonReport(report, 'CODEX_REMOTE_NPM_DIAGNOSTIC_REPORT');
    process.exit(1);
  }
}
