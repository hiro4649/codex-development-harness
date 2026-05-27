#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.3
import { fileURLToPath } from 'node:url';
import { isPrContext, normalizePath, prBodyText, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function parseInput(env = process.env) {
  if (env.CODEX_TARGET_SCRIPT_CLASSIFICATION_JSON) {
    try { return JSON.parse(env.CODEX_TARGET_SCRIPT_CLASSIFICATION_JSON); }
    catch { return { invalidInput: true }; }
  }
  return {};
}

export function classifyTargetScript(file, manifest = {}) {
  const normalized = normalizePath(file);
  const map = manifest.targetScriptClassifications || {};
  if (map[normalized]) return map[normalized];
  if (/^scripts\/codex-/.test(normalized)) return 'harness_managed';
  if (normalized === 'scripts/run-tests.js') return manifest.runTestsClassification || 'product_relevant';
  if (normalized === 'scripts/dev-server.js') return manifest.devServerClassification || 'dev_server_entrypoint';
  if (/^scripts\//.test(normalized)) return 'manual_required';
  return 'unknown';
}

export function buildTargetScriptClassificationFixtureReport(input = parseInput()) {
  const reasonCodes = [];
  if (input.invalidInput) reasonCodes.push('target_script_classification_lost');
  if (classifyTargetScript('scripts/codex-local-quality-gate.mjs', input.manifest) !== 'harness_managed') reasonCodes.push('target_script_classification_lost');
  if (input.scriptsRunTestsClassifiedAsHarness || classifyTargetScript('scripts/run-tests.js', input.manifest) === 'harness_managed') reasonCodes.push('scripts_run_tests_misclassified');
  if (input.devServerClassificationLost || classifyTargetScript('scripts/dev-server.js', input.manifest) !== 'dev_server_entrypoint') reasonCodes.push('target_script_classification_lost');
  if (input.unknownScriptPasses || classifyTargetScript('scripts/custom-tool.js', input.manifest) !== 'manual_required') reasonCodes.push('target_script_classification_lost');
  if (input.registryOverwritten) reasonCodes.push('target_script_classification_lost');
  return simpleStatus('targetScriptClassificationFixtureStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes: [...new Set(reasonCodes)], safeSummaryOnly: true });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildTargetScriptClassificationFixtureReport();
  writeJsonReport(report, 'CODEX_TARGET_SCRIPT_CLASSIFICATION_REPORT');
  exitFor(report);
}

