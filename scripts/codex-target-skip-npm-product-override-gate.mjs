#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.3
import { fileURLToPath } from 'node:url';
import { normalizePath, prBodyText, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function parseInput(env = process.env) {
  if (env.CODEX_TARGET_SKIP_NPM_PRODUCT_OVERRIDE_JSON) {
    try { return JSON.parse(env.CODEX_TARGET_SKIP_NPM_PRODUCT_OVERRIDE_JSON); }
    catch { return { invalidInput: true }; }
  }
  return {
    productRelevantChanged: env.CODEX_PRODUCT_RELEVANT_CHANGED === '1',
    skipNpm: env.CODEX_SKIP_NPM === '1',
    harnessOnly: env.CODEX_HARNESS_ONLY_ROLLOUT === '1',
    explicitReason: env.CODEX_SKIP_NPM_REASON || '',
  };
}

export function buildTargetSkipNpmProductOverrideReport(input = parseInput()) {
  const reasonCodes = [];
  if (input.invalidInput) reasonCodes.push('target_skip_npm_product_override');
  if (input.productRelevantChanged && input.skipNpm && input.allowed) reasonCodes.push('target_skip_npm_product_override');
  if (input.productRelevantChanged && input.skipNpm && !input.remoteNpmBaselinePresent) reasonCodes.push('target_skip_npm_product_override');
  if (input.workflowForcesSkipNpm && input.productOverrideMissing) reasonCodes.push('target_skip_npm_product_override');
  if (input.productVerificationPassWhileUnavailable) reasonCodes.push('target_skip_npm_product_override');
  if (input.targetQualityScorePassWithSkipOnlyProductEvidence) reasonCodes.push('target_skip_npm_product_override');
  const harnessOnlySkipAllowed = input.harnessOnly && input.skipNpm && Boolean(input.explicitReason || input.reason);
  return simpleStatus('targetSkipNpmProductOverrideStatus', reasonCodes.length ? 'fail' : 'pass', { reasonCodes: [...new Set(reasonCodes)], harnessOnlySkipAllowed, safeSummaryOnly: true });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildTargetSkipNpmProductOverrideReport();
  writeJsonReport(report, 'CODEX_TARGET_SKIP_NPM_PRODUCT_OVERRIDE_REPORT');
  exitFor(report);
}

