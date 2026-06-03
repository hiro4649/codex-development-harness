#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.5
import { fileURLToPath } from 'node:url';
import {
  HARNESS_VERSION,
  marker,
  isPrContext,
  prBodyText,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';
import { classifyChange, changedFiles } from './codex-change-classification-gate.mjs';

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function classificationFromEnv(env = process.env) {
  const parsed = parseJson(env.CODEX_CHANGE_CLASSIFICATION_JSON);
  if (parsed?.changeClassificationStatus) return parsed.changeClassificationStatus;
  if (parsed?.classification) return parsed;
  const classified = classifyChange(changedFiles(env), env);
  return {
    status: classified.status,
    classification: classified.classification,
    productRelevantChanged: classified.productRelevantChanged,
    runtimeReadinessClaimed: classified.runtimeReadinessClaimed,
    packageOrLockfileChanged: classified.packageOrLockfileChanged,
    reasonCodes: classified.reasonCodes,
  };
}

function riskyProductClaim(body) {
  return String(body || '').split(/\r?\n/).some((line) =>
    /\b(product readiness|security release|release readiness|security claim|production release)\b/i.test(line) &&
    !/\b(no|not applicable|none)\b/i.test(line));
}

export function buildFastPathReport(env = process.env) {
  const classificationStatus = classificationFromEnv(env);
  const classification = classificationStatus.classification || {};
  const mode = env.CODEX_HARNESS_MODE === 'target' ? 'target' : 'source';
  const reasonCodes = [];
  const status = classificationStatus.status || 'missing';
  const productRelevantChanged = Boolean(classificationStatus.productRelevantChanged || classification.productRelevantChanged ||
    classification.productSourceChanged || classification.testsChanged || classification.specsChanged ||
    classification.runtimeAssetsChanged || classification.configChanged || classification.authorityChanged);
  const packageOrLockfileChanged = Boolean(classificationStatus.packageOrLockfileChanged || classification.packageChanged || classification.lockfileChanged);
  const runtimeReadinessClaimed = Boolean(classificationStatus.runtimeReadinessClaimed || classification.runtimeReadinessClaimed);
  const performanceClaimed = Boolean(classification.performanceClaimed || classificationStatus.performanceClaimed);
  const unknownRisk = Boolean(classification.unknownRisk);
  const claimRisk = riskyProductClaim(prBodyText(env));

  if (!['pass', 'not_applicable'].includes(status)) reasonCodes.push('fast_path_precondition_failed');
  if (unknownRisk) reasonCodes.push('fast_path_precondition_failed');
  if (productRelevantChanged) reasonCodes.push('fast_path_not_allowed_for_product_change');
  if (packageOrLockfileChanged) reasonCodes.push('fast_path_not_allowed_for_product_change');
  if (runtimeReadinessClaimed || performanceClaimed || claimRisk) reasonCodes.push('fast_path_precondition_failed');

  let pathMode = 'full_product_path';
  let allowed = false;
  let finalStatus = 'pass';
  if (reasonCodes.includes('fast_path_precondition_failed') && !reasonCodes.includes('fast_path_not_allowed_for_product_change')) {
    finalStatus = isPrContext(env) && unknownRisk ? 'fail' : 'pass';
  }
  if (!reasonCodes.length) {
    allowed = true;
    if (classification.harnessOnly) pathMode = mode === 'target' ? 'target_harness_fast_path' : 'source_harness_fast_path';
    else if (classification.docsOnly) pathMode = 'docs_only_fast_path';
    else pathMode = mode === 'target' ? 'target_harness_fast_path' : 'source_harness_fast_path';
  }
  if (!allowed && !productRelevantChanged && !packageOrLockfileChanged) pathMode = 'full_product_path';

  const decision = allowed
    ? 'allowed'
    : unknownRisk ? 'denied_unknown_risk' : 'denied_full_verification_required';
  return simpleStatus('fastPathStatus', finalStatus, {
    pathMode,
    fastPathAllowed: allowed,
    decision,
    oneLineReason: allowed ? 'fast_path_conditions_met' : 'full_verification_required',
    mergeInterpretation: allowed ? 'fast_path_allowed' : 'full_verification_required',
    mode,
    reasonCodes: [...new Set(reasonCodes)],
    requiredStatusesPreserved: true,
    safeSummaryOnly: true,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildFastPathReport();
    writeJsonReport(report, 'CODEX_FAST_PATH_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('fastPathStatus', 'fail', { reasonCodes: ['fast_path_precondition_failed'] });
    writeJsonReport(report, 'CODEX_FAST_PATH_REPORT');
    process.exit(1);
  }
}
