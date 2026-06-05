#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.7
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  HARNESS_VERSION,
  marker,
  isPrContext,
  prBodyText,
  readJson,
  scanObjectForUnsafe,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';
import { classifyChange, changedFiles } from './codex-change-classification-gate.mjs';
import { buildPrProfileReport } from './codex-pr-profile-gate.mjs';

const taskModes = new Set([
  'bugfix',
  'feature',
  'refactor',
  'investigation',
  'review',
  'release_gate',
  'harness_change',
  'docs_only',
  'unknown',
]);

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function bodyLineValue(body, label) {
  const pattern = new RegExp(`^\\s*${label}\\s*:\\s*(.+?)\\s*$`, 'im');
  return String(body || '').match(pattern)?.[1]?.trim() || '';
}

function normalizeTaskMode(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  return taskModes.has(normalized) ? normalized : normalized ? 'unknown' : null;
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

function productVerificationFromEnv(env = process.env) {
  const parsed = parseJson(env.CODEX_PRODUCT_VERIFICATION_JSON);
  if (parsed?.productVerificationStatus) return parsed.productVerificationStatus;
  if (parsed?.status) return parsed;
  return { status: 'not_applicable', reasonCodes: ['product_evidence_not_provided'], safeSummaryOnly: true };
}

function fastPathFromEnv(env = process.env) {
  const parsed = parseJson(env.CODEX_FAST_PATH_JSON);
  if (parsed?.fastPathStatus) return parsed.fastPathStatus;
  if (parsed?.status) return parsed;
  return { status: 'not_applicable', fastPathAllowed: false, reasonCodes: [], safeSummaryOnly: true };
}

function codeChanged(classificationStatus = {}) {
  const c = classificationStatus.classification || {};
  return Boolean(
    classificationStatus.productRelevantChanged ||
    c.productSourceChanged ||
    c.testsChanged ||
    c.specsChanged ||
    c.runtimeAssetsChanged ||
    c.configChanged ||
    c.authorityChanged,
  );
}

function inferTaskMode(classificationStatus = {}, body = '') {
  const c = classificationStatus.classification || {};
  if (/\bbug\s*fix|regression|flaky|broken|unexpected behavior|root cause\b/i.test(body)) return 'bugfix';
  if (c.harnessOnly) return 'harness_change';
  if (c.docsOnly) return 'docs_only';
  if (classificationStatus.productRelevantChanged) return 'unknown';
  return 'unknown';
}

function buildTaskDisciplineStatus(env, classificationStatus) {
  if (!isPrContext(env)) {
    return { status: 'not_applicable', taskMode: null, declaredTaskMode: null, inferredTaskMode: null, reasonCodes: ['no_pr_context'], safeSummaryOnly: true };
  }
  const body = prBodyText(env);
  const declared = normalizeTaskMode(bodyLineValue(body, 'Task mode'));
  const inferred = inferTaskMode(classificationStatus, body);
  const mode = declared || inferred;
  const c = classificationStatus.classification || {};
  const reasonCodes = [];
  let status = 'pass';
  if (!declared) {
    reasonCodes.push('task_mode_missing');
    if (classificationStatus.productRelevantChanged) status = 'manual_confirmation_required';
    else if (c.docsOnly || c.harnessOnly) status = 'warning';
  }
  return {
    status,
    taskMode: mode,
    declaredTaskMode: declared,
    inferredTaskMode: inferred,
    allowedTaskModes: [...taskModes],
    reasonCodes,
    safeSummaryOnly: true,
  };
}

function bugfixEvidenceFromBody(body, env = process.env) {
  const fromEnv = parseJson(env.CODEX_BUGFIX_EVIDENCE_JSON);
  if (fromEnv?.codexBugFixEvidence) return fromEnv.codexBugFixEvidence;
  if (fromEnv?.schemaVersion) return fromEnv;
  const block = String(body || '').match(/BEGIN_CODEX_BUGFIX_EVIDENCE_JSON\s*([\s\S]*?)\s*END_CODEX_BUGFIX_EVIDENCE_JSON/i);
  if (block) {
    const parsed = parseJson(block[1]);
    if (parsed?.codexBugFixEvidence) return parsed.codexBugFixEvidence;
    if (parsed?.schemaVersion) return parsed;
  }
  const reproduced = bodyLineValue(body, 'Reproduced');
  const rootCause = bodyLineValue(body, 'Root cause');
  const verification = bodyLineValue(body, 'Verification');
  if (!reproduced && !rootCause && !verification) return null;
  return {
    schemaVersion: '0.8.5',
    reproductionStatus: /^yes|reproduced$/i.test(reproduced) ? 'reproduced' : reproduced,
    rootCause: {
      status: /^unknown$/i.test(rootCause) ? 'unknown' : rootCause ? 'identified' : '',
      safeSummary: rootCause ? 'provided' : '',
    },
    verification: {
      status: /^pass|passed|yes$/i.test(verification) ? 'pass' : verification,
      reasonIfNotRun: /reason/i.test(verification) ? 'provided' : '',
    },
  };
}

function nestedStatus(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.status || '';
}

function buildBugfixEvidenceStatus(env, taskStatus, classificationStatus) {
  const mode = taskStatus.taskMode;
  if (mode !== 'bugfix') {
    return { status: 'not_applicable', reasonCodes: ['task_mode_not_bugfix'], safeSummaryOnly: true };
  }
  if (!codeChanged(classificationStatus)) {
    return { status: 'pass', reasonCodes: [], safeSummaryOnly: true };
  }
  const evidence = bugfixEvidenceFromBody(prBodyText(env), env);
  const reasonCodes = [];
  const warningCodes = [];
  if (!evidence?.reproductionStatus) reasonCodes.push('bugfix_reproduction_missing');
  if (!nestedStatus(evidence?.rootCause)) reasonCodes.push('bugfix_root_cause_missing');
  if (nestedStatus(evidence?.rootCause) === 'unknown') reasonCodes.push('bugfix_root_cause_missing');
  if (!nestedStatus(evidence?.verification)) reasonCodes.push('bugfix_verification_missing');
  if (nestedStatus(evidence?.verification) === 'not_run_with_reason' && !evidence?.verification?.reasonIfNotRun) reasonCodes.push('bugfix_verification_missing');
  if (evidence?.fixScope?.unrelatedChangesIncluded === true) reasonCodes.push('bugfix_unrelated_changes');
  if (evidence?.reproductionStatus === 'baseline_fail' && !evidence?.baselineCandidateDistinctionPresent && !evidence?.rootCause?.baselineVsCandidate) {
    reasonCodes.push('candidate_regression');
  }
  if (evidence?.reproductionStatus === 'not_reproducible_with_reason') warningCodes.push('bugfix_reproduction_not_reproducible');
  if (nestedStatus(evidence?.rootCause) === 'hypothesis') warningCodes.push('bugfix_root_cause_hypothesis');
  if (nestedStatus(evidence?.verification) === 'partial') warningCodes.push('bugfix_verification_partial');
  if (evidence?.regressionTest?.present === false && evidence?.regressionTest?.reasonIfNo) warningCodes.push('bugfix_regression_test_absent_with_reason');
  const status = reasonCodes.length ? 'fail' : warningCodes.length ? 'warning' : 'pass';
  return {
    status,
    reproductionStatus: evidence?.reproductionStatus || null,
    rootCauseStatus: nestedStatus(evidence?.rootCause) || null,
    verificationStatus: nestedStatus(evidence?.verification) || null,
    reasonCodes: [...new Set([...reasonCodes, ...warningCodes])],
    safeSummaryOnly: true,
  };
}

function buildPrProfileAssistStatus(env) {
  const profile = buildPrProfileReport(env).prProfileStatus;
  const needsHint = ['fail', 'warning'].includes(profile.status);
  return {
    status: needsHint ? 'warning' : profile.status,
    declaredProfile: profile.declaredProfile || null,
    inferredProfile: profile.inferredProfile || profile.profile || null,
    profileConflict: (profile.reasonCodes || []).includes('pr_profile_conflict'),
    allowedProfiles: [
      'docs_only_r1_r2',
      'harness_only_r2',
      'harness_workflow_r3',
      'product_minor_r2',
      'product_r3',
      'security_r3',
      'release_r3',
      'readiness_claim_r3',
    ],
    requiredMethodSections: profile.missingSections || [],
    missingSections: profile.missingSections || [],
    suggestedPatchSummary: needsHint ? 'Add the missing profile sections listed in safe summary form.' : '',
    reasonCodes: needsHint ? ['pr_profile_repair_hint_available', ...(profile.reasonCodes || [])] : [],
    safeSummaryOnly: true,
  };
}

function buildProductEvidenceExplainStatus(productVerificationStatus = {}) {
  const codes = new Set(productVerificationStatus.reasonCodes || []);
  const explanation = {
    npmNotRun: codes.has('npm_skip_not_allowed_for_product_change') || Boolean(productVerificationStatus.skipReason),
    evidenceMissing: codes.has('product_verification_required') || codes.has('product_verification_evidence_missing'),
    evidenceFailed: Boolean(productVerificationStatus.failingEvidence?.length),
    baselineFailed: codes.has('baseline_failure') || codes.has('remote_product_baseline_failing'),
    candidateRegression: codes.has('candidate_regression'),
    skipNotAllowed: codes.has('npm_skip_not_allowed_for_product_change'),
    remoteBaselineMissing: codes.has('remote_product_baseline_missing'),
    remoteEvidenceStale: codes.has('remote_product_baseline_stale') || codes.has('stale_evidence'),
  };
  let nextBestFix = 'no_product_evidence_action_required';
  if (explanation.skipNotAllowed) nextBestFix = 'run_repository_verification_or_remove_skip';
  else if (explanation.evidenceMissing) nextBestFix = 'add_safe_product_verification_evidence';
  else if (explanation.baselineFailed) nextBestFix = 'separate_baseline_failure_from_candidate';
  else if (explanation.candidateRegression) nextBestFix = 'fix_candidate_regression';
  return {
    status: 'pass',
    productVerificationStatus: productVerificationStatus.status || 'missing',
    explanation,
    nextBestFix,
    reasonCodes: productVerificationStatus.status === 'fail' ? ['product_evidence_explained'] : [],
    safeSummaryOnly: true,
  };
}

function configFromEnvOrFile(env, jsonEnv, filePath) {
  const parsed = parseJson(env[jsonEnv]);
  if (parsed) return { source: 'env', config: parsed, present: true };
  const file = env[`${jsonEnv}_PATH`] || filePath;
  if (!fs.existsSync(file)) return { source: 'absent', config: null, present: false };
  const read = readJson(file);
  return read.ok ? { source: 'file', config: read.value, present: true } : { source: 'invalid', config: null, present: true };
}

function isSourceHarnessMode(env = process.env) {
  return env.CODEX_HARNESS_SOURCE_REPO === '1' || env.CODEX_HARNESS_MODE === 'core';
}

function validateImportSmokeConfig(config) {
  if (!config || typeof config !== 'object') return false;
  if (scanObjectForUnsafe(config).length) return false;
  if (config.maxRuntimeMs !== undefined && (typeof config.maxRuntimeMs !== 'number' || config.maxRuntimeMs < 1 || config.maxRuntimeMs > 10000)) return false;
  if (!Array.isArray(config.criticalImports)) return false;
  return config.criticalImports.every((item) =>
    item && typeof item === 'object' &&
    typeof item.name === 'string' &&
    typeof item.specifier === 'string' &&
    typeof item.safeToImport === 'boolean' &&
    (item.expectedExports === undefined || Array.isArray(item.expectedExports)));
}

async function importWithTimeout(specifier, maxRuntimeMs) {
  return Promise.race([
    import(specifier),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), maxRuntimeMs)),
  ]);
}

async function buildImportSmokeMicroStatus(env, classificationStatus) {
  if (isSourceHarnessMode(env)) {
    return { status: 'not_applicable', reasonCodes: ['source_harness_mode'], safeSummaryOnly: true };
  }
  const loaded = configFromEnvOrFile(env, 'CODEX_IMPORT_SMOKE_CONFIG_JSON', 'docs/process/CODEX_IMPORT_SMOKE_CONFIG.json');
  if (!loaded.present) return { status: 'not_applicable', reasonCodes: ['import_smoke_config_absent'], safeSummaryOnly: true };
  const relevant = Boolean(classificationStatus.productRelevantChanged || classificationStatus.runtimeReadinessClaimed);
  if (loaded.source === 'invalid' || !validateImportSmokeConfig(loaded.config)) {
    return { status: relevant || isPrContext(env) ? 'fail' : 'warning', reasonCodes: ['import_smoke_config_invalid'], safeSummaryOnly: true };
  }
  const targets = loaded.config.criticalImports.filter((item) => item.safeToImport);
  if (!targets.length) return { status: 'not_applicable', reasonCodes: ['import_smoke_no_safe_targets'], safeSummaryOnly: true };
  const failed = [];
  const maxRuntimeMs = Math.min(loaded.config.maxRuntimeMs || 1000, 5000);
  for (const item of targets) {
    try {
      const mod = await importWithTimeout(item.specifier, maxRuntimeMs);
      const missing = (item.expectedExports || []).filter((name) => !(name in mod));
      if (missing.length) failed.push('missing_expected_export');
    } catch {
      failed.push('import_smoke_failed');
    }
  }
  const status = failed.length ? (relevant ? 'fail' : 'warning') : 'pass';
  return {
    status,
    checkedCount: targets.length,
    reasonCodes: [...new Set(failed.length ? ['import_smoke_failed'] : [])],
    rawOutputStored: false,
    safeSummaryOnly: true,
  };
}

function validateRuntimeRiskRegister(config) {
  if (!config || typeof config !== 'object') return false;
  if (scanObjectForUnsafe(config).length) return false;
  if (!Array.isArray(config.risks)) return false;
  return config.risks.every((risk) =>
    risk && typeof risk === 'object' &&
    typeof risk.id === 'string' &&
    typeof risk.severity === 'string' &&
    typeof risk.status === 'string' &&
    typeof risk.releaseBlocking === 'boolean' &&
    Array.isArray(risk.evidenceRequired) &&
    Array.isArray(risk.affectedAreas));
}

function buildRuntimeRiskRegisterStatus(env, classificationStatus) {
  if (isSourceHarnessMode(env)) {
    return { status: 'not_applicable', reasonCodes: ['source_harness_mode'], safeSummaryOnly: true };
  }
  const loaded = configFromEnvOrFile(env, 'CODEX_RUNTIME_RISK_REGISTER_JSON', 'docs/process/CODEX_RUNTIME_RISK_REGISTER.json');
  if (!loaded.present) return { status: 'not_applicable', reasonCodes: ['runtime_risk_register_absent'], safeSummaryOnly: true };
  if (loaded.source === 'invalid' || !validateRuntimeRiskRegister(loaded.config)) {
    return { status: 'fail', reasonCodes: ['runtime_risk_register_invalid'], safeSummaryOnly: true };
  }
  const body = prBodyText(env);
  const runtimeClaim = Boolean(classificationStatus.runtimeReadinessClaimed || /runtime readiness claimed\s*:\s*yes/i.test(body));
  const releaseClaim = /\b(release|production|staging)\s+ready\b/i.test(body);
  const openP1 = loaded.config.risks.filter((risk) => risk.severity === 'P1' && risk.status === 'open');
  const closedWithoutEvidence = loaded.config.risks.filter((risk) =>
    risk.severity === 'P1' &&
    risk.status === 'closed' &&
    risk.evidenceRequired?.length &&
    env.CODEX_RUNTIME_RISK_REGISTER_CHANGED === '1' &&
    risk.evidencePresent !== true);
  const reasonCodes = [];
  if ((runtimeClaim || releaseClaim) && openP1.some((risk) => risk.releaseBlocking)) reasonCodes.push('runtime_release_blocked_by_open_risk');
  if (closedWithoutEvidence.length) reasonCodes.push('runtime_risk_closed_without_evidence');
  if (classificationStatus.productRelevantChanged && openP1.length && !/risk impact summary\s*:/i.test(body)) {
    reasonCodes.push('runtime_risk_impact_summary_missing');
  }
  const status = reasonCodes.includes('runtime_release_blocked_by_open_risk') || reasonCodes.includes('runtime_risk_closed_without_evidence')
    ? 'fail'
    : reasonCodes.length ? 'manual_confirmation_required'
    : openP1.length ? 'warning' : 'pass';
  return {
    status,
    openP1Count: openP1.length,
    releaseBlockingOpenP1Count: openP1.filter((risk) => risk.releaseBlocking).length,
    reasonCodes,
    safeSummaryOnly: true,
  };
}

function buildCheckoutEvidencePriorityStatus(env = process.env) {
  const localHead = env.CODEX_CHECKOUT_HEAD_SHA || env.GITHUB_SHA || '';
  const remoteHead = env.CODEX_REMOTE_HEAD_SHA || env.CODEX_PR_HEAD_SHA || '';
  const localStatus = env.CODEX_CHECKOUT_EVIDENCE_STATUS || '';
  const remoteStatus = env.CODEX_REMOTE_EVIDENCE_STATUS || '';
  const localCheckoutEvidencePresent = Boolean(localHead || localStatus);
  const remoteEvidencePresent = Boolean(remoteHead || remoteStatus);
  const discrepancyDetected = Boolean(localHead && remoteHead && localHead === remoteHead && localStatus && remoteStatus && localStatus !== remoteStatus);
  return {
    status: discrepancyDetected ? 'warning' : localCheckoutEvidencePresent || remoteEvidencePresent ? 'pass' : 'not_applicable',
    localCheckoutEvidencePresent,
    remoteEvidencePresent,
    discrepancyDetected,
    priorityRule: 'current_checkout_over_connector_when_same_head',
    reasonCodes: discrepancyDetected ? ['checkout_remote_discrepancy_detected'] : [],
    safeSummaryOnly: true,
  };
}

function buildFastPathExplainabilityStatus(fastPathStatus = {}) {
  const unknown = (fastPathStatus.reasonCodes || []).includes('fast_path_precondition_failed') &&
    fastPathStatus.pathMode === 'full_product_path';
  const allowed = Boolean(fastPathStatus.fastPathAllowed);
  const decision = allowed ? 'allowed' : unknown ? 'denied_unknown_risk' : 'denied_full_verification_required';
  return {
    status: 'pass',
    decision,
    oneLineReason: allowed ? 'fast_path_conditions_met' : 'full_verification_required',
    mergeInterpretation: allowed ? 'fast_path_allowed' : 'full_verification_required',
    reasonCodes: allowed ? [] : ['fast_path_full_verification_required'],
    safeSummaryOnly: true,
  };
}

function buildOneScreenDashboardStatus(parts) {
  const blocking = [
    ['bugfix', parts.bugfixEvidenceStatus],
    ['import_smoke', parts.importSmokeMicroStatus],
    ['runtime_risk', parts.runtimeRiskRegisterStatus],
  ].find(([, value]) => value?.status === 'fail');
  const manual = [
    ['task_mode', parts.taskDisciplineStatus],
    ['runtime_risk', parts.runtimeRiskRegisterStatus],
  ].find(([, value]) => value?.status === 'manual_confirmation_required' || value?.status === 'warning');
  return {
    status: 'pass',
    mode: isSourceHarnessMode(parts.env) ? 'source' : 'target',
    mergeReady: !blocking && !manual,
    targetMergeReady: !blocking && !manual,
    topBlockingReason: blocking?.[0] || '',
    topNextAction: blocking ? 'fix_blocking_v085_evidence' : manual ? 'add_manual_confirmation_or_safe_summary' : 'ready_for_review',
    fastPathDecision: parts.fastPathExplainabilityStatus.decision,
    productEvidenceSummary: parts.productEvidenceExplainStatus.nextBestFix,
    runtimeRiskSummary: parts.runtimeRiskRegisterStatus.status,
    importSmokeSummary: parts.importSmokeMicroStatus.status,
    prProfileHintSummary: parts.prProfileAssistStatus.status,
    safeSummaryOnly: true,
  };
}

export async function buildV085StabilityReport(env = process.env) {
  const classificationStatus = classificationFromEnv(env);
  const productVerificationStatus = productVerificationFromEnv(env);
  const fastPathStatus = fastPathFromEnv(env);
  const taskDisciplineStatus = buildTaskDisciplineStatus(env, classificationStatus);
  const bugfixEvidenceStatus = buildBugfixEvidenceStatus(env, taskDisciplineStatus, classificationStatus);
  const prProfileAssistStatus = buildPrProfileAssistStatus(env);
  const productEvidenceExplainStatus = buildProductEvidenceExplainStatus(productVerificationStatus);
  const importSmokeMicroStatus = await buildImportSmokeMicroStatus(env, classificationStatus);
  const runtimeRiskRegisterStatus = buildRuntimeRiskRegisterStatus(env, classificationStatus);
  const checkoutEvidencePriorityStatus = buildCheckoutEvidencePriorityStatus(env);
  const fastPathExplainabilityStatus = buildFastPathExplainabilityStatus(fastPathStatus);
  const oneScreenDashboardStatus = buildOneScreenDashboardStatus({
    env,
    taskDisciplineStatus,
    bugfixEvidenceStatus,
    prProfileAssistStatus,
    productEvidenceExplainStatus,
    importSmokeMicroStatus,
    runtimeRiskRegisterStatus,
    checkoutEvidencePriorityStatus,
    fastPathExplainabilityStatus,
  });
  const nested = [
    taskDisciplineStatus,
    bugfixEvidenceStatus,
    prProfileAssistStatus,
    productEvidenceExplainStatus,
    importSmokeMicroStatus,
    runtimeRiskRegisterStatus,
    checkoutEvidencePriorityStatus,
    fastPathExplainabilityStatus,
    oneScreenDashboardStatus,
  ];
  const unsafe = scanObjectForUnsafe(nested).length > 0;
  const failures = nested.filter((item) => item.status === 'fail');
  const manual = nested.filter((item) => item.status === 'manual_confirmation_required' || item.status === 'warning');
  const status = unsafe || failures.length ? 'fail' : manual.length ? 'manual_confirmation_required' : 'pass';
  return simpleStatus('v085StabilityStatus', status, {
    taskDisciplineStatus,
    bugfixEvidenceStatus,
    prProfileAssistStatus,
    productEvidenceExplainStatus,
    importSmokeMicroStatus,
    runtimeRiskRegisterStatus,
    checkoutEvidencePriorityStatus,
    fastPathExplainabilityStatus,
    oneScreenDashboardStatus,
    reasonCodes: [
      ...new Set(nested.flatMap((item) => item.reasonCodes || [])),
      ...(unsafe ? ['unsafe_value_detected'] : []),
    ],
    safeSummaryOnly: true,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = await buildV085StabilityReport();
    writeJsonReport(report, 'CODEX_V085_STABILITY_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('v085StabilityStatus', 'fail', { reasonCodes: ['unexpected_error'] });
    writeJsonReport(report, 'CODEX_V085_STABILITY_REPORT');
    process.exit(1);
  }
}
