#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
import { fileURLToPath } from 'node:url';
import { prBodyText, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';
import { classifyChange, changedFiles } from './codex-change-classification-gate.mjs';
import { normalizeProductVerificationEvidence } from './codex-product-verification-evidence-normalize.mjs';
import { buildRemoteProductBaselineReport } from './codex-remote-product-baseline-gate.mjs';

function hasSkipReason(body, env) {
  return Boolean(env.CODEX_NPM_SKIP_REASON) || /\bskip reason\s*:\s*\S+/i.test(body) ||
    /\bCODEX_SKIP_NPM\b[\s\S]{0,100}\b(reason|harness-only|docs-only|not applicable)\b/i.test(body);
}

function verificationEvidence(body) {
  const commands = [];
  if (/\bproduct verification commands?\s*:/i.test(body)) commands.push('product_verification_commands');
  if (/\btests? or checks? run\s*:/i.test(body)) commands.push('tests_or_checks_run');
  if (/\b(?:npm test|npm run test|npm run build|node scripts\/run-tests)\b/i.test(body)) commands.push('repo_command_named');
  return commands;
}

export function buildProductVerificationReport(env = process.env) {
  const body = prBodyText(env);
  const classified = classifyChange(changedFiles(env), env);
  const normalized = normalizeProductVerificationEvidence(env);
  const baseline = buildRemoteProductBaselineReport(env).remoteProductBaselineStatus;
  const c = classified.classification;
  const skipNpm = env.CODEX_SKIP_NPM === '1';
  const reasonCodes = [...classified.reasonCodes.filter((item) => item !== 'no_pr_context')];
  const requiredCommands = [];
  const providedEvidence = [
    ...verificationEvidence(body),
    ...((normalized.normalized?.commands || []).filter((item) => item.result === 'pass').map((item) => item.name || 'normalized_command')),
  ];
  const missingEvidence = [];
  const failingEvidence = [];
  let skipAllowed = false;
  let skipReason = '';

  if (classified.status === 'not_applicable') {
    return simpleStatus('productVerificationStatus', 'not_applicable', {
      skipAllowed: true,
      skipReason: 'no_pr_context',
      requiredCommands,
      providedEvidence,
      missingEvidence,
      reasonCodes: ['no_pr_context'],
      normalizedEvidence: normalized.normalized,
    });
  }

  if (c.harnessOnly && !c.runtimeReadinessClaimed) {
    skipAllowed = true;
    skipReason = 'harness_only_no_runtime_claim';
  } else if (c.docsOnly && !c.runtimeReadinessClaimed) {
    skipAllowed = !skipNpm || hasSkipReason(body, env);
    skipReason = skipAllowed ? 'docs_only_with_skip_reason' : 'docs_only_skip_reason_missing';
    if (!skipAllowed) reasonCodes.push('product_verification_required');
  }

  const productRelevant = classified.productRelevantChanged;
  if (productRelevant) {
    requiredCommands.push('repository_test_or_build_or_project_defined_check');
    if (skipNpm) reasonCodes.push('npm_skip_not_allowed_for_product_change');
    if (!providedEvidence.length) missingEvidence.push('product_verification_commands');
  }
  if (c.runtimeReadinessClaimed) {
    requiredCommands.push('runtime_or_smoke_verification');
    if (skipNpm) reasonCodes.push('runtime_claim_requires_product_checks');
    if (!providedEvidence.length) missingEvidence.push('runtime_verification_evidence');
  }
  if (c.packageChanged || c.lockfileChanged) {
    requiredCommands.push('package_verification');
    if (!providedEvidence.length) {
      reasonCodes.push('package_change_requires_package_verification');
      missingEvidence.push('package_verification_evidence');
    }
  }
  if (classified.status === 'fail') reasonCodes.push('unknown_change_classification');
  if (missingEvidence.length && productRelevant) reasonCodes.push('product_verification_required');
  if (normalized.status === 'fail') reasonCodes.push(...normalized.reasonCodes);
  for (const command of normalized.normalized?.commands || []) {
    if (command.result === 'fail') failingEvidence.push(command.name || 'product_verification_command');
  }
  if (productRelevant || c.runtimeReadinessClaimed || c.packageChanged || c.lockfileChanged || c.performanceClaimed) {
    if (baseline.status === 'fail' && (baseline.reasonCodes || []).includes('remote_product_baseline_missing')) {
      reasonCodes.push('remote_product_baseline_missing');
    } else if (baseline.status === 'fail') {
      reasonCodes.push(...(baseline.reasonCodes || ['remote_product_baseline_invalid']));
    } else if (baseline.status === 'manual_confirmation_required') {
      reasonCodes.push(...(baseline.reasonCodes || ['remote_product_baseline_failing']));
    }
  }
  if (failingEvidence.length) {
    reasonCodes.push(baseline.baselineResult === 'fail' ? 'baseline_failure' : 'candidate_regression');
  }

  const emergency = env.CODEX_EMERGENCY_MANUAL_REVIEW_REQUIRED === '1';
  let status = 'pass';
  if (reasonCodes.length) {
    const manualOnly = reasonCodes.every((code) => ['remote_product_baseline_missing', 'remote_product_baseline_failing', 'baseline_failure'].includes(code));
    status = emergency || manualOnly ? 'manual_confirmation_required' : 'fail';
  }

  return simpleStatus('productVerificationStatus', status, {
    skipAllowed,
    skipReason,
    requiredCommands: [...new Set(requiredCommands)],
    providedEvidence: [...new Set(providedEvidence)],
    missingEvidence: [...new Set(missingEvidence)],
    failingEvidence: [...new Set(failingEvidence)],
    baselineStatus: baseline.status,
    baselineResult: baseline.baselineResult || null,
    reasonCodes: [...new Set(reasonCodes)],
    normalizedEvidence: normalized.normalized,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildProductVerificationReport();
    writeJsonReport(report, 'CODEX_PRODUCT_VERIFICATION_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('productVerificationStatus', 'fail', { reasonCodes: ['unexpected_error'] });
    writeJsonReport(report, 'CODEX_PRODUCT_VERIFICATION_REPORT');
    process.exit(1);
  }
}
