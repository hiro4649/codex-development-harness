#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.4
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  HARNESS_VERSION,
  marker,
  isPrContext,
  normalizePath,
  prBodyText,
  readJson,
  scanObjectForUnsafe,
  simpleStatus,
  writeJsonReport,
  exitFor,
} from './codex-v080-lib.mjs';
import { classifyChange, changedFiles } from './codex-change-classification-gate.mjs';

const allowedModes = new Set(['off', 'report', 'enforce', 'strict']);
const allowedProfiles = new Set(['bugfix', 'feature', 'refactor', 'harness_change', 'docs_only', 'release_gate', 'unknown']);
const checklistKeys = ['correctness', 'regression', 'security', 'dataIntegrity', 'runtimeSafety', 'testEvidence', 'diffScope'];
const defaultRulesPath = 'docs/process/CODEX_REVIEW_SURFACE_RULES.json';
const localRulesPath = 'docs/process/CODEX_REVIEW_SURFACE_RULES.local.json';

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

function normalizeProfile(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  return allowedProfiles.has(normalized) ? normalized : normalized ? 'unknown' : '';
}

function safeArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length < 160);
}

function validateRules(value) {
  const keys = [
    'authPatterns',
    'storagePatterns',
    'apiPatterns',
    'runtimePatterns',
    'configPatterns',
    'testPatterns',
    'packagePatterns',
    'harnessPatterns',
    'docsPatterns',
  ];
  if (!value || typeof value !== 'object') return false;
  if (scanObjectForUnsafe(value).length) return false;
  return keys.every((key) => safeArray(value[key]));
}

function mergeRules(base, local) {
  const merged = { ...base };
  if (!local || typeof local !== 'object') return merged;
  for (const [key, value] of Object.entries(local)) {
    if (Array.isArray(value)) merged[key] = value;
    else if (value && typeof value === 'object' && key === 'largeDiff') merged[key] = { ...(merged[key] || {}), ...value };
  }
  return merged;
}

export function loadReviewSurfaceRules(env = process.env) {
  const explicitJson = parseJson(env.CODEX_REVIEW_SURFACE_RULES_JSON);
  if (explicitJson) {
    return validateRules(explicitJson)
      ? { ok: true, rules: explicitJson, reasonCodes: [], source: 'env' }
      : { ok: false, rules: null, reasonCodes: ['review_surface_rules_invalid'], source: 'env' };
  }
  const basePath = env.CODEX_REVIEW_SURFACE_RULES_PATH || defaultRulesPath;
  const base = readJson(basePath);
  if (!base.ok || !validateRules(base.value)) {
    return { ok: false, rules: null, reasonCodes: ['review_surface_rules_invalid'], source: basePath };
  }
  let rules = base.value;
  if (env.CODEX_ALLOW_REVIEW_SURFACE_LOCAL_OVERRIDE !== '0' && fs.existsSync(localRulesPath)) {
    const local = readJson(localRulesPath);
    const merged = local.ok ? mergeRules(rules, local.value) : null;
    if (!merged || !validateRules(merged)) {
      return { ok: false, rules, reasonCodes: ['review_surface_rules_invalid'], source: localRulesPath };
    }
    rules = merged;
  }
  return { ok: true, rules, reasonCodes: [], source: basePath };
}

function patternHit(file, patterns = []) {
  const value = normalizePath(file).toLowerCase();
  return patterns.some((pattern) => {
    const normalized = normalizePath(pattern).toLowerCase();
    if (!normalized) return false;
    if (normalized.endsWith('/')) return value.startsWith(normalized);
    if (normalized.includes('*')) {
      const re = new RegExp(`^${normalized.split('*').map((part) => part.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')).join('.*')}$`);
      return re.test(value);
    }
    return value === normalized || value.includes(normalized);
  });
}

function classificationFromEnv(env = process.env) {
  const parsed = parseJson(env.CODEX_CHANGE_CLASSIFICATION_JSON);
  const status = parsed?.changeClassificationStatus || parsed;
  if (status?.classification) return status;
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

function v085FromEnv(env = process.env) {
  const parsed = parseJson(env.CODEX_V085_STABILITY_JSON);
  if (parsed?.v085StabilityStatus) return parsed.v085StabilityStatus;
  if (parsed?.status) return parsed;
  return { status: 'not_applicable', reasonCodes: ['v085_status_not_provided'], safeSummaryOnly: true };
}

function modeFromEnv(env = process.env) {
  const explicit = String(env.CODEX_CODE_REVIEW_MONITOR_MODE || '').trim().toLowerCase();
  if (allowedModes.has(explicit)) return explicit;
  return isPrContext(env) ? 'enforce' : 'report';
}

function inferReviewProfile(body, classificationStatus, v085Status) {
  const declared = normalizeProfile(bodyLineValue(body, 'Task mode'));
  if (declared) return declared;
  const taskMode = normalizeProfile(v085Status.taskDisciplineStatus?.taskMode);
  if (taskMode) return taskMode;
  if (classificationStatus.runtimeReadinessClaimed || /(?:runtime|release|production)\s+readiness\s+claimed\s*:\s*yes/i.test(body)) return 'release_gate';
  const c = classificationStatus.classification || {};
  if (c.harnessOnly) return 'harness_change';
  if (c.docsOnly) return 'docs_only';
  if (/\bbug\s*fix|regression|root cause|flaky|broken\b/i.test(body)) return 'bugfix';
  if (/\brefactor\b/i.test(body)) return 'refactor';
  if (classificationStatus.productRelevantChanged) return 'feature';
  return 'unknown';
}

function buildChangedSurfaceSummary(files, rules, classificationStatus) {
  const c = classificationStatus.classification || {};
  const productCodeChanged = Boolean(classificationStatus.productRelevantChanged || c.productSourceChanged || c.runtimeAssetsChanged || c.configChanged || c.authorityChanged);
  return {
    productCodeChanged,
    testCodeChanged: Boolean(c.testsChanged || files.some((file) => patternHit(file, rules.testPatterns))),
    authSurfaceChanged: files.some((file) => patternHit(file, rules.authPatterns)),
    storageSurfaceChanged: files.some((file) => patternHit(file, rules.storagePatterns)),
    apiSurfaceChanged: files.some((file) => patternHit(file, rules.apiPatterns)),
    runtimeSurfaceChanged: Boolean(c.productSourceChanged || c.runtimeAssetsChanged || files.some((file) => patternHit(file, rules.runtimePatterns))),
    configSurfaceChanged: Boolean(c.configChanged || files.some((file) => patternHit(file, rules.configPatterns))),
    packageOrLockfileChanged: Boolean(classificationStatus.packageOrLockfileChanged || c.packageChanged || c.lockfileChanged || files.some((file) => patternHit(file, rules.packagePatterns))),
    harnessOnly: Boolean(c.harnessOnly),
    docsOnly: Boolean(c.docsOnly),
  };
}

function hasText(body, pattern) {
  return pattern.test(String(body || ''));
}

function verificationEvidencePresent(body, productVerificationStatus) {
  if (productVerificationStatus.status === 'pass') return true;
  return hasText(body, /\b(test|verification|checks?|validation)\b[\s\S]{0,80}\b(pass|passed|run|evidence|command)\b/i);
}

function testReasonPresent(body) {
  return hasText(body, /\b(no test|test files changed\s*:\s*no|regression test)\b[\s\S]{0,120}\b(reason|not applicable|harness-only|docs-only)\b/i);
}

function riskSummaryPresent(body) {
  return hasText(body, /\b(risk summary|runtime risk impact|residual risks|failure paths considered)\s*:/i);
}

function acceptancePresent(body) {
  return hasText(body, /\b(acceptance criteria|done when|goal)\s*:/i);
}

function behaviorInvariantPresent(body) {
  return hasText(body, /\b(behavior invariant|no behavior change|invariant)\s*:/i);
}

function rollbackPresent(body) {
  return hasText(body, /\b(rollback|stop condition|rollback or stop condition|merge-after verify)\s*:/i);
}

function humanConfirmationPresent(body) {
  return hasText(body, /BEGIN_CODEX_MANUAL_CONFIRMATION_JSON|confirmedByRole\s*:\s*project-owner|Human confirmation needed\s*:\s*(no|not required)/i);
}

function negativeTestEvidencePresent(body) {
  return hasText(body, /\b(negative test|permission test|auth test|security test|unauthorized)\b/i);
}

function storageIntegrityEvidencePresent(body) {
  return hasText(body, /\b(data integrity|migration|concurrency|transaction|rollback|schema compatibility)\b/i);
}

function apiCompatibilityEvidencePresent(body) {
  return hasText(body, /\b(api compatibility|request\/response|request response|contract compatibility|backward compatible)\b/i);
}

function runtimeSmokeEvidencePresent(body) {
  return hasText(body, /\b(smoke|import smoke|runtime check|startup check|verification evidence)\b/i);
}

function reviewScopePresent(body) {
  return hasText(body, /\b(review scope|files or scope|risk summary)\s*:/i);
}

function bugfixEvidenceStatus(v085Status) {
  return v085Status.bugfixEvidenceStatus || { status: 'not_applicable', reasonCodes: [] };
}

function parseNumstatLines(text) {
  return String(text || '').split(/\r?\n/).map((line) => {
    const [added, deleted, file] = line.trim().split(/\s+/);
    if (!file) return null;
    const add = Number(added);
    const del = Number(deleted);
    return { file: normalizePath(file), lines: (Number.isFinite(add) ? add : 0) + (Number.isFinite(del) ? del : 0) };
  }).filter(Boolean);
}

function gitNumstat() {
  const result = spawnSync('git', ['diff', '--numstat', 'origin/main...HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return result.status === 0 ? result.stdout : '';
}

function largeDiffSummary(files, rules, env = process.env) {
  const rows = parseNumstatLines(env.CODEX_DIFF_NUMSTAT || gitNumstat());
  if (!rows.length) return { status: 'not_applicable', changedFiles: files.length, changedLines: 0, large: false, veryLarge: false, multiSurface: false, safeSummaryOnly: true };
  const changedFiles = rows.length;
  const changedLines = rows.reduce((sum, row) => sum + row.lines, 0);
  const limits = rules.largeDiff || {};
  const large = changedFiles >= (limits.warningFiles || 8) || changedLines >= (limits.warningLines || 300);
  const veryLarge = changedFiles >= (limits.manualFiles || 15) || changedLines >= (limits.manualLines || 800);
  return { status: 'pass', changedFiles, changedLines, large, veryLarge, safeSummaryOnly: true };
}

function finding(severity, reasonCode, checklist, nextAction) {
  return { severity, reasonCode, checklist, nextAction, safeSummaryOnly: true };
}

function updateChecklist(checklist, key, status) {
  const order = { not_applicable: 0, pass: 1, warning: 2, manual_confirmation_required: 3, fail: 4 };
  if (order[status] > order[checklist[key]]) checklist[key] = status;
}

function addFinding(collections, item) {
  if (item.severity === 'P0') collections.blockingFindings.push(item);
  else if (item.severity === 'P1') collections.manualFindings.push(item);
  else collections.warnings.push(item);
}

export function buildCodeReviewMonitorReport(env = process.env) {
  const mode = modeFromEnv(env);
  if (mode === 'off') {
    return simpleStatus('codeReviewMonitorStatus', 'not_applicable', {
      mode,
      reviewProfile: 'unknown',
      reasonCodes: ['code_review_monitor_off'],
    });
  }
  const rulesLoaded = loadReviewSurfaceRules(env);
  const classificationStatus = classificationFromEnv(env);
  const productVerificationStatus = productVerificationFromEnv(env);
  const v085Status = v085FromEnv(env);
  const files = changedFiles(env);
  const body = prBodyText(env);
  const reviewProfile = inferReviewProfile(body, classificationStatus, v085Status);
  const rules = rulesLoaded.rules || {
    authPatterns: [],
    storagePatterns: [],
    apiPatterns: [],
    runtimePatterns: [],
    configPatterns: [],
    testPatterns: [],
    packagePatterns: [],
    harnessPatterns: [],
    docsPatterns: [],
    largeDiff: {},
  };
  const changedSurfaceSummary = buildChangedSurfaceSummary(files, rules, classificationStatus);
  const largeDiff = largeDiffSummary(files, rules, env);
  const riskSignals = [];
  const evidenceGaps = [];
  const collections = { blockingFindings: [], manualFindings: [], warnings: [] };
  const reviewChecklist = Object.fromEntries(checklistKeys.map((key) => [key, 'not_applicable']));
  const productVerificationFailed = productVerificationStatus.status === 'fail';
  const productVerificationPass = productVerificationStatus.status === 'pass';
  const v085Failed = v085Status.status === 'fail';
  const v085Manual = v085Status.status === 'manual_confirmation_required';
  const v085Warning = v085Status.status === 'warning';
  const runtimeClaimed = Boolean(classificationStatus.runtimeReadinessClaimed || /runtime readiness claimed\s*:\s*yes/i.test(body));
  const releaseClaimed = runtimeClaimed || /\b(production|release|deploy)\s+ready\b/i.test(body);
  const stubRuntimeClaim = runtimeClaimed && /\b(stub|fixture pass|mock only|mock-only|placeholder)\b/i.test(body);
  const displayOnlyCompleteClaim = /\b(feature complete|complete claim|done)\s*:\s*yes/i.test(body) && /\bdisplay only|display-only|visual only|ui only\b/i.test(body);
  const harnessMixedWithProduct = reviewProfile === 'harness_change' && changedSurfaceSummary.productCodeChanged && !changedSurfaceSummary.harnessOnly;

  if (!rulesLoaded.ok) {
    addFinding(collections, finding(isPrContext(env) ? 'P0' : 'P2', 'review_surface_rules_invalid', 'diffScope', 'fix_review_surface_rules'));
    updateChecklist(reviewChecklist, 'diffScope', isPrContext(env) ? 'fail' : 'warning');
  }

  if (changedSurfaceSummary.docsOnly) updateChecklist(reviewChecklist, 'diffScope', 'pass');
  if (changedSurfaceSummary.harnessOnly) updateChecklist(reviewChecklist, 'diffScope', 'pass');

  if (harnessMixedWithProduct) {
    addFinding(collections, finding('P0', 'harness_change_mixed_with_product_files', 'diffScope', 'split_product_changes'));
    updateChecklist(reviewChecklist, 'diffScope', 'fail');
  }

  if (productVerificationFailed) {
    addFinding(collections, finding('P0', 'code_review_monitor_failed', 'testEvidence', 'fix_product_verification_status'));
    updateChecklist(reviewChecklist, 'testEvidence', 'fail');
  }

  if (v085Failed) {
    addFinding(collections, finding('P0', 'code_review_monitor_failed', 'correctness', 'fix_v085_stability_status'));
    updateChecklist(reviewChecklist, 'correctness', 'fail');
  } else if (v085Manual) {
    addFinding(collections, finding('P1', 'code_review_monitor_failed', 'correctness', 'resolve_v085_manual_status'));
    updateChecklist(reviewChecklist, 'correctness', 'manual_confirmation_required');
  } else if (v085Warning) {
    addFinding(collections, finding('P2', 'code_review_monitor_failed', 'correctness', 'review_v085_warning'));
    updateChecklist(reviewChecklist, 'correctness', 'warning');
  }

  if (reviewProfile === 'bugfix') {
    const bug = bugfixEvidenceStatus(v085Status);
    const missingBugfix = bug.status === 'fail' ||
      ['bugfix_reproduction_missing', 'bugfix_root_cause_missing', 'bugfix_verification_missing'].some((code) => (bug.reasonCodes || []).includes(code));
    if (missingBugfix) {
      addFinding(collections, finding('P0', 'bugfix_review_evidence_missing', 'regression', 'add_bugfix_reproduction_root_cause_verification'));
      updateChecklist(reviewChecklist, 'regression', 'fail');
    }
    if ((bug.reasonCodes || []).includes('bugfix_unrelated_changes')) {
      addFinding(collections, finding('P0', 'bugfix_unrelated_changes', 'diffScope', 'remove_unrelated_bugfix_changes'));
      updateChecklist(reviewChecklist, 'diffScope', 'fail');
    }
    if (bug.status === 'warning') {
      addFinding(collections, finding('P2', 'product_change_without_test_or_reason', 'regression', 'consider_regression_test'));
      updateChecklist(reviewChecklist, 'regression', 'warning');
    }
  }

  if (reviewProfile === 'feature' && changedSurfaceSummary.productCodeChanged) {
    if (!acceptancePresent(body)) {
      addFinding(collections, finding('P2', 'feature_acceptance_criteria_missing', 'correctness', 'add_acceptance_criteria'));
      updateChecklist(reviewChecklist, 'correctness', 'warning');
    }
    if (!verificationEvidencePresent(body, productVerificationStatus)) {
      addFinding(collections, finding(mode === 'strict' || isPrContext(env) ? 'P0' : 'P1', 'product_change_without_review_surface', 'testEvidence', 'add_product_verification_evidence'));
      updateChecklist(reviewChecklist, 'testEvidence', mode === 'report' ? 'manual_confirmation_required' : 'fail');
    }
  }

  if (reviewProfile === 'refactor') {
    if (!behaviorInvariantPresent(body)) {
      addFinding(collections, finding('P1', 'refactor_behavior_invariant_missing', 'correctness', 'add_behavior_invariant'));
      updateChecklist(reviewChecklist, 'correctness', 'manual_confirmation_required');
    }
    if (!verificationEvidencePresent(body, productVerificationStatus)) {
      addFinding(collections, finding('P0', 'code_review_monitor_failed', 'testEvidence', 'add_refactor_verification'));
      updateChecklist(reviewChecklist, 'testEvidence', 'fail');
    }
    if (changedSurfaceSummary.packageOrLockfileChanged) {
      addFinding(collections, finding('P0', 'code_review_monitor_failed', 'diffScope', 'split_package_change_from_refactor'));
      updateChecklist(reviewChecklist, 'diffScope', 'fail');
    }
  }

  if (reviewProfile === 'release_gate' || releaseClaimed) {
    if (!verificationEvidencePresent(body, productVerificationStatus)) {
      addFinding(collections, finding('P0', 'code_review_monitor_failed', 'testEvidence', 'add_current_head_release_evidence'));
      updateChecklist(reviewChecklist, 'testEvidence', 'fail');
    }
    if (!rollbackPresent(body)) {
      addFinding(collections, finding('P0', 'code_review_monitor_failed', 'runtimeSafety', 'add_rollback_or_stop_condition'));
      updateChecklist(reviewChecklist, 'runtimeSafety', 'fail');
    }
    if (!humanConfirmationPresent(body)) {
      addFinding(collections, finding('P1', 'code_review_monitor_failed', 'runtimeSafety', 'add_current_head_owner_confirmation'));
      updateChecklist(reviewChecklist, 'runtimeSafety', 'manual_confirmation_required');
    }
  }

  if (stubRuntimeClaim) {
    addFinding(collections, finding('P0', 'stub_feature_claim_detected', 'runtimeSafety', 'replace_stub_claim_with_real_runtime_evidence'));
    updateChecklist(reviewChecklist, 'runtimeSafety', 'fail');
  }

  if (displayOnlyCompleteClaim) {
    addFinding(collections, finding('P1', 'display_only_feature_claim_detected', 'correctness', 'separate_display_from_completion_claim'));
    updateChecklist(reviewChecklist, 'correctness', 'manual_confirmation_required');
  }

  const runtimeRisk = v085Status.runtimeRiskRegisterStatus || {};
  if ((runtimeRisk.reasonCodes || []).includes('runtime_release_blocked_by_open_risk')) {
    addFinding(collections, finding('P0', 'runtime_release_blocked_by_open_risk', 'runtimeSafety', 'remove_readiness_claim_or_close_risk_with_evidence'));
    updateChecklist(reviewChecklist, 'runtimeSafety', 'fail');
  }

  if (changedSurfaceSummary.productCodeChanged && changedSurfaceSummary.authSurfaceChanged && !negativeTestEvidencePresent(body)) {
    addFinding(collections, finding('P1', 'auth_surface_changed_without_negative_test_evidence', 'security', 'add_negative_auth_test_evidence'));
    updateChecklist(reviewChecklist, 'security', 'manual_confirmation_required');
  }
  if (changedSurfaceSummary.productCodeChanged && changedSurfaceSummary.storageSurfaceChanged && !storageIntegrityEvidencePresent(body)) {
    addFinding(collections, finding('P1', 'storage_surface_changed_without_integrity_evidence', 'dataIntegrity', 'add_data_integrity_summary'));
    updateChecklist(reviewChecklist, 'dataIntegrity', 'manual_confirmation_required');
  }
  if (changedSurfaceSummary.productCodeChanged && changedSurfaceSummary.apiSurfaceChanged && !apiCompatibilityEvidencePresent(body)) {
    addFinding(collections, finding('P1', 'api_surface_changed_without_compatibility_summary', 'correctness', 'add_api_compatibility_summary'));
    updateChecklist(reviewChecklist, 'correctness', 'manual_confirmation_required');
  }
  if (changedSurfaceSummary.runtimeSurfaceChanged && changedSurfaceSummary.productCodeChanged && !runtimeSmokeEvidencePresent(body) && !productVerificationPass) {
    addFinding(collections, finding('P1', 'runtime_surface_changed_without_smoke_or_reason', 'runtimeSafety', 'add_runtime_smoke_or_reason'));
    updateChecklist(reviewChecklist, 'runtimeSafety', 'manual_confirmation_required');
  }

  if (changedSurfaceSummary.packageOrLockfileChanged && productVerificationStatus.status !== 'pass') {
    addFinding(collections, finding('P0', 'code_review_monitor_failed', 'testEvidence', 'add_package_verification'));
    updateChecklist(reviewChecklist, 'testEvidence', 'fail');
  }

  if (changedSurfaceSummary.productCodeChanged && !changedSurfaceSummary.testCodeChanged && !testReasonPresent(body)) {
    const severity = changedSurfaceSummary.authSurfaceChanged || changedSurfaceSummary.storageSurfaceChanged || changedSurfaceSummary.apiSurfaceChanged ? 'P1' : 'P2';
    addFinding(collections, finding(severity, 'product_change_without_test_or_reason', 'testEvidence', 'add_test_or_safe_reason'));
    updateChecklist(reviewChecklist, 'testEvidence', severity === 'P1' ? 'manual_confirmation_required' : 'warning');
  }

  if (largeDiff.large) {
    riskSignals.push('large_diff');
    if (changedSurfaceSummary.productCodeChanged && (!reviewScopePresent(body) || !verificationEvidencePresent(body, productVerificationStatus))) {
      addFinding(collections, finding(largeDiff.veryLarge || !verificationEvidencePresent(body, productVerificationStatus) ? 'P1' : 'P2', 'large_product_diff_requires_review_scope', 'diffScope', 'add_review_scope_and_verification'));
      updateChecklist(reviewChecklist, 'diffScope', 'manual_confirmation_required');
    }
  }

  if (changedSurfaceSummary.productCodeChanged && !riskSummaryPresent(body) &&
      (changedSurfaceSummary.authSurfaceChanged || changedSurfaceSummary.storageSurfaceChanged || changedSurfaceSummary.apiSurfaceChanged || changedSurfaceSummary.runtimeSurfaceChanged)) {
    evidenceGaps.push('risk_summary_missing');
  }

  for (const key of checklistKeys) {
    if (reviewChecklist[key] === 'not_applicable' && (changedSurfaceSummary.productCodeChanged || changedSurfaceSummary.harnessOnly || changedSurfaceSummary.docsOnly)) {
      reviewChecklist[key] = 'pass';
    }
  }

  const p0 = collections.blockingFindings;
  const p1 = collections.manualFindings;
  const p2 = collections.warnings;
  let status = 'pass';
  if (p0.length) status = 'fail';
  else if (p1.length) status = 'manual_confirmation_required';
  else if (p2.length) status = 'warning';
  if (mode === 'report' && status === 'fail' && !isPrContext(env)) status = 'warning';
  if (!files.length && !isPrContext(env)) status = 'not_applicable';

  const requiredNextActions = [...new Set([...p0, ...p1, ...p2].map((item) => item.nextAction).filter(Boolean))].slice(0, 8);
  const statusPayload = {
    status,
    mode,
    reviewProfile,
    changedSurfaceSummary,
    riskSignals: [...new Set(riskSignals)],
    evidenceGaps: [...new Set(evidenceGaps)],
    blockingFindings: p0.slice(0, 10),
    manualFindings: p1.slice(0, 10),
    warnings: p2.slice(0, 10),
    requiredNextActions,
    reviewChecklist,
    largeDiffSummary: largeDiff,
    reasonCodes: [...new Set([...p0, ...p1, ...p2].map((item) => item.reasonCode))],
    safeSummaryOnly: true,
  };
  const unsafe = scanObjectForUnsafe(statusPayload).length || env.CODEX_CODE_REVIEW_MONITOR_TEST_UNSAFE_SHAPE === '1';
  if (unsafe) {
    return simpleStatus('codeReviewMonitorStatus', 'fail', {
      mode,
      reviewProfile,
      changedSurfaceSummary,
      riskSignals: [],
      evidenceGaps: ['safe_summary_invalid'],
      blockingFindings: [finding('P0', 'review_monitor_safe_summary_invalid', 'correctness', 'fix_monitor_safe_summary')],
      manualFindings: [],
      warnings: [],
      requiredNextActions: ['fix_monitor_safe_summary'],
      reviewChecklist: { ...Object.fromEntries(checklistKeys.map((key) => [key, key === 'correctness' ? 'fail' : 'not_applicable'])) },
      reasonCodes: ['review_monitor_safe_summary_invalid'],
      safeSummaryOnly: true,
    });
  }
  return simpleStatus('codeReviewMonitorStatus', status, statusPayload);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildCodeReviewMonitorReport();
    writeJsonReport(report, 'CODEX_CODE_REVIEW_MONITOR_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('codeReviewMonitorStatus', 'fail', {
      mode: 'enforce',
      reviewProfile: 'unknown',
      reasonCodes: ['code_review_monitor_failed'],
    });
    writeJsonReport(report, 'CODEX_CODE_REVIEW_MONITOR_REPORT');
    process.exit(1);
  }
}
