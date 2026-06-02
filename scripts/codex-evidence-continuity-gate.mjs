#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import { fileURLToPath } from 'node:url';
import { isPrContext, normalizePath, prBodyText, scanObjectForUnsafe, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

const paths = [
  'remote_product_baseline',
  'product_verification',
  'npm_diagnostic',
  'evidence_pack',
  'human_confirmation',
  'complexity_oracle',
  'self_test_case_export',
  'score_decomposition',
];

function envJson(env, name) {
  if (!env[name]) return null;
  try {
    return JSON.parse(env[name]);
  } catch {
    return null;
  }
}

function splitChangedFiles(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(normalizePath).filter(Boolean);
  } catch {
    // Fall through.
  }
  return text.split(/[\n,]+/).map((item) => normalizePath(item.trim())).filter(Boolean);
}

function statusOf(value, nested) {
  return value?.status || value?.[nested]?.status || 'missing';
}

function productRelevant(env) {
  const files = splitChangedFiles(env.CODEX_CHANGED_FILES);
  const classification = envJson(env, 'CODEX_CHANGE_CLASSIFICATION_JSON') || {};
  const status = classification.changeClassificationStatus || classification;
  return Boolean(
    status.productRelevantChanged ||
    status.productSourceChanged ||
    status.packageOrLockfileChanged ||
    files.some((file) => /^(src|apps|contracts)\//.test(file) || /^(package\.json|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(file))
  );
}

function evidencePackHasHumanConfirmation(env) {
  const pack = envJson(env, 'CODEX_EVIDENCE_PACK_JSON') || envJson(env, 'CODEX_EVIDENCE_PACK_REPORT');
  if (pack?.codexEvidencePack?.humanConfirmation || pack?.evidencePack?.humanConfirmation || pack?.normalizedEvidencePack?.humanConfirmation) return true;
  const body = prBodyText(env);
  if (!body.includes('BEGIN_CODEX_EVIDENCE_PACK_JSON')) return false;
  return /"humanConfirmation"\s*:/.test(body);
}

export function buildEvidenceContinuityReport(env = process.env) {
  const lostPaths = [];
  const reasonCodes = [];
  const baseline = envJson(env, 'CODEX_REMOTE_PRODUCT_BASELINE_JSON') || {};
  const productVerification = envJson(env, 'CODEX_PRODUCT_VERIFICATION_JSON') || {};
  const npmDiagnostic = envJson(env, 'CODEX_REMOTE_NPM_DIAGNOSTIC_JSON') || {};
  const complexity = envJson(env, 'CODEX_COMPLEXITY_GOVERNANCE_JSON') || {};
  const selfTestExport = envJson(env, 'CODEX_SELF_TEST_CASE_EXPORT_JSON') || {};
  const score = envJson(env, 'CODEX_SCORE_DECOMPOSITION_JSON') || {};
  if (productRelevant(env)) {
    if (statusOf(baseline, 'remoteProductBaselineStatus') === 'missing') {
      lostPaths.push('remote_product_baseline');
      reasonCodes.push('remote_product_evidence_path_lost');
    }
    if (statusOf(productVerification, 'productVerificationStatus') === 'missing') {
      lostPaths.push('product_verification');
      reasonCodes.push('product_verification_path_lost');
    }
  }
  if (statusOf(npmDiagnostic, 'remoteNpmDiagnosticStatus') === 'fail' && statusOf(productVerification, 'productVerificationStatus') === 'missing') {
    lostPaths.push('npm_diagnostic');
    reasonCodes.push('product_verification_path_lost');
  }
  if (isPrContext(env) && prBodyText(env).includes('BEGIN_CODEX_EVIDENCE_PACK_JSON') && !evidencePackHasHumanConfirmation(env)) {
    lostPaths.push('human_confirmation');
    reasonCodes.push('evidence_pack_human_confirmation_path_lost');
  }
  if (statusOf(complexity, 'complexityGovernanceStatus') === 'missing' && env.CODEX_COMPLEXITY_GOVERNANCE_EXPECTED === '1') {
    lostPaths.push('complexity_oracle');
    reasonCodes.push('complexity_status_path_lost');
  }
  if (statusOf(selfTestExport, 'selfTestCaseExportStatus') === 'fail') {
    lostPaths.push('self_test_case_export');
    reasonCodes.push('self_test_case_export_failed');
  }
  if (statusOf(score, 'scoreDecompositionStatus') === 'fail') {
    lostPaths.push('score_decomposition');
    reasonCodes.push('score_decomposition_failed');
  }
  const payload = {
    pathsChecked: paths,
    lostPaths: [...new Set(lostPaths)],
    reasonCodes: [...new Set(reasonCodes)],
  };
  const unsafePayload = JSON.parse(JSON.stringify(payload).replace(/npm_/g, 'npmLabel_'));
  const status = payload.reasonCodes.length || scanObjectForUnsafe(unsafePayload).length ? 'fail' : 'pass';
  return simpleStatus('evidenceContinuityStatus', status, payload);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildEvidenceContinuityReport();
    writeJsonReport(report, 'CODEX_EVIDENCE_CONTINUITY_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('evidenceContinuityStatus', 'fail', { reasonCodes: ['evidence_continuity_failed'] });
    writeJsonReport(report, 'CODEX_EVIDENCE_CONTINUITY_REPORT');
    process.exit(1);
  }
}
