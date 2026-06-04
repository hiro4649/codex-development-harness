#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.6
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
import { changedFiles } from './codex-change-classification-gate.mjs';
import { effectiveSurfacesForComplexity } from './codex-pr-body-surface-normalizer.mjs';

const allowedModes = new Set(['off', 'report', 'enforce', 'strict']);
const allowedStatuses = new Set(['pass', 'warning', 'manual_confirmation_required', 'fail', 'not_applicable']);
const allowedRegimes = new Set(['low', 'medium', 'high', 'unknown']);

function parseJson(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function nestedStatus(value, key) {
  const parsed = parseJson(value);
  return parsed?.[key] || parsed || {};
}

function lineValue(body, label) {
  return String(body || '').match(new RegExp(`^\\s*${label}\\s*:\\s*(.+?)\\s*$`, 'im'))?.[1]?.trim() || '';
}

function has(body, pattern) {
  return pattern.test(String(body || ''));
}

function listValue(value) {
  return String(value || '').split(/\r?\n|,|;/).map((item) => normalizePath(item.trim())).filter(Boolean);
}

function lowerText(files, body) {
  return `${files.join('\n')}\n${body}`.toLowerCase();
}

function isDocsFile(file) {
  return /^(readme\.md|docs\/|.*\.md$)/i.test(file);
}

function isHarnessFile(file) {
  return /^(agents\.md|readme\.md|codeX_source_harness_manifest\.json|docs\/process\/|docs\/codex\/|scripts\/codex-|\.github\/|\.agents\/skills\/)/i.test(file);
}

function isProductFile(file) {
  return /^(src\/|apps\/|contracts\/)/i.test(file);
}

function isPackageFile(file) {
  return /(^|\/)(package\.json|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/i.test(file);
}

function taskMode(body) {
  return (lineValue(body, 'Task mode') || lineValue(body, 'Task Mode') || '').toLowerCase().replace(/\s+/g, '_') || 'unknown';
}

function productVerificationStatus(env = process.env) {
  const status = nestedStatus(env.CODEX_PRODUCT_VERIFICATION_JSON, 'productVerificationStatus');
  return status.status ? status : { status: 'not_applicable', reasonCodes: [] };
}

function contractProvided(body, env = process.env) {
  return Boolean(env.CODEX_TASK_CONTRACT_JSON || /##\s+Task Contract/i.test(body));
}

function fieldPresent(body, label) {
  return Boolean(lineValue(body, label));
}

function verificationPresent(body) {
  return has(body, /\b(verification|validation|test|self-test|fixture|schema|validator|smoke|static check|source\/core local gate)\b[\s\S]{0,120}\b(pass|provided|run|evidence|gate|check|self-test)\b/i);
}

function oracleProvided(body) {
  const value = lineValue(body, 'Oracle provided') || lineValue(body, 'Oracle');
  return /yes|test|smoke|fixture|schema|validator|static_check|static check|manual_check|manual check|unavailable_with_reason|self-test/i.test(value) || verificationPresent(body);
}

function oracleType(body) {
  const value = `${lineValue(body, 'Oracle provided')} ${body}`.toLowerCase();
  if (/validator/.test(value)) return 'validator';
  if (/schema/.test(value)) return 'schema';
  if (/smoke/.test(value)) return 'smoke';
  if (/fixture/.test(value)) return 'fixture';
  if (/static[_ ]check/.test(value)) return 'static_check';
  if (/manual[_ ]check/.test(value)) return 'manual_check';
  if (/unavailable[_ ]with[_ ]reason/.test(value)) return 'unavailable_with_reason';
  if (/test|self-test/.test(value)) return 'test';
  return 'not_applicable';
}

function artifactProvided(body) {
  return has(body, /\b(self-test|test|fixture|schema|validator|smoke command|reproduction command|migration check|static check|source\/core local gate)\b/i);
}

function artifactType(body) {
  const value = String(body || '').toLowerCase();
  if (/migration check/.test(value)) return 'migration_check';
  if (/reproduction command/.test(value)) return 'reproduction_command';
  if (/smoke command|smoke/.test(value)) return 'smoke_command';
  if (/validator/.test(value)) return 'validator';
  if (/schema/.test(value)) return 'schema';
  if (/fixture/.test(value)) return 'fixture';
  if (/static check/.test(value)) return 'static_check';
  if (/test|self-test/.test(value)) return 'test';
  if (/unavailable_with_reason|unavailable with reason/.test(value)) return 'unavailable_with_reason';
  return 'not_applicable';
}

function surfaceSummary(files, body) {
  const normalized = effectiveSurfacesForComplexity(files, body);
  return {
    auth: normalized.auth,
    storage: normalized.storage,
    api: normalized.api,
    runtime: normalized.runtime,
    release: normalized.release,
    harness: files.some(isHarnessFile),
    product: files.some(isProductFile),
    pkg: files.some(isPackageFile),
  };
}

function largeDiff(files, env = process.env) {
  const rows = String(env.CODEX_DIFF_NUMSTAT || '').split(/\r?\n/).filter(Boolean);
  const lineCount = rows.reduce((sum, row) => {
    const [added, deleted] = row.trim().split(/\s+/);
    const a = Number(added);
    const d = Number(deleted);
    return sum + (Number.isFinite(a) ? a : 0) + (Number.isFinite(d) ? d : 0);
  }, 0);
  return files.length >= 15 || lineCount >= 800 || /large diff|large product diff|large output|many-step/i.test(env.CODEX_PR_BODY || '');
}

function classifyRegime(files, body, env = process.env) {
  if (isPrContext(env) && (!body || !files.length)) return 'unknown';
  const mode = taskMode(body);
  const surfaces = surfaceSummary(files, body);
  const productSurfaces = [surfaces.auth, surfaces.storage, surfaces.api, surfaces.runtime, surfaces.release, surfaces.pkg].filter(Boolean).length;
  const high = surfaces.auth || surfaces.storage || surfaces.api || surfaces.runtime || surfaces.release || surfaces.pkg ||
    productSurfaces > 1 || largeDiff(files, env) ||
    /runtime readiness claimed\s*:\s*yes|production readiness|deployment readiness|release_gate|risk level\s*:\s*r3|harness_workflow_r3/i.test(body) ||
    (/target rollout|target repo changes/i.test(body) && !/No target rollout|target rollout is separate/i.test(body)) ||
    /manual confirmation|evidence policy|product verification behavior|new gate|new policy|complexity governance|oracle requirement/i.test(body) ||
    files.some((file) => /scripts\/codex-.*gate|docs\/process\/CODEX_.*POLICY|docs\/process\/CODEX_.*SCHEMA/i.test(file));
  if (high) return 'high';
  if (mode === 'bugfix' || mode === 'feature' || mode === 'refactor' || files.length > 1) return 'medium';
  if (files.every(isDocsFile) || files.length <= 1) return 'low';
  return 'unknown';
}

function buildSolvabilityStatus(regime, files, body, env = process.env) {
  const reasonCodes = [];
  const mode = taskMode(body);
  const constraintsPresent = /##\s+Constraints|Allowed scope|Forbidden scope|Stop condition/i.test(body);
  const targetRollout = /target rollout|roll out|IRIS|FUNKY|renderer/i.test(body) && !/No target rollout|target rollout is separate/i.test(body);
  const targetForbidden = /Forbidden scope\s*:\s*[^\n]*(target repos|IRIS|FUNKY|renderer)/i.test(body) || /No target rollout/i.test(body);
  if (targetRollout && targetForbidden && /target repo|target changes|rollout/i.test(body)) reasonCodes.push('solvability_constraints_conflict');
  if (/runtime readiness claimed\s*:\s*yes/i.test(body) && /product verification forbidden|do not run product verification/i.test(body)) reasonCodes.push('solvability_constraints_conflict');
  if (mode === 'bugfix' && (!/Reproduced\s*:\s*yes/i.test(body) || !/Root cause\s*:/i.test(body) || !/Verification\s*:/i.test(body))) reasonCodes.push('bugfix_review_evidence_missing');
  if ((mode === 'feature' || regime === 'medium') && !/acceptance criteria|done when|done criteria|goal\s*:/i.test(body) && isPrContext(env)) reasonCodes.push('acceptance_criteria_missing_for_complex_task');
  if (/release_gate|release|production/i.test(body) && !/rollback|stop condition/i.test(body)) reasonCodes.push('solvability_constraints_missing');
  if (contractProvided(body, env)) {
    if (!fieldPresent(body, 'Done criteria')) reasonCodes.push('task_contract_done_criteria_missing');
    if (!fieldPresent(body, 'Verification surface')) reasonCodes.push('task_contract_verification_surface_missing');
    if (regime === 'high' && !fieldPresent(body, 'Risk surface')) reasonCodes.push('reasoning_evidence_effort_mismatch');
  }
  if (regime === 'high' && isPrContext(env) && !contractProvided(body, env)) reasonCodes.push('high_complexity_contract_missing');
  const status = reasonCodes.some((code) => ['solvability_constraints_conflict', 'bugfix_review_evidence_missing', 'task_contract_done_criteria_missing', 'task_contract_verification_surface_missing', 'high_complexity_contract_missing'].includes(code))
    ? 'fail'
    : reasonCodes.length ? 'manual_confirmation_required' : 'pass';
  return {
    status,
    constraintsPresent,
    constraintsConsistent: !reasonCodes.includes('solvability_constraints_conflict'),
    acceptanceCriteriaPresent: /acceptance criteria|done when|done criteria|goal\s*:/i.test(body),
    knownImpossibleCondition: reasonCodes.includes('solvability_constraints_conflict'),
    reasonCodes: [...new Set(reasonCodes)],
    safeSummaryOnly: true,
  };
}

function buildOracleRequirementStatus(regime, files, body, env = process.env) {
  const reasonCodes = [];
  const surfaces = surfaceSummary(files, body);
  const required = regime === 'high';
  const provided = oracleProvided(body);
  if (productVerificationStatus(env).status === 'fail') reasonCodes.push('product_verification_failed');
  if (required && !provided) reasonCodes.push('high_complexity_oracle_missing');
  if (surfaces.auth && !/negative test|unauthorized|permission test|security test/i.test(body)) reasonCodes.push('oracle_required_for_auth_surface');
  if (surfaces.storage && !/data integrity|failure path|migration check|concurrency|rollback|transaction/i.test(body)) reasonCodes.push('oracle_required_for_storage_surface');
  if (surfaces.api && !/request\/response|request response|api compatibility|contract compatibility/i.test(body)) reasonCodes.push('api_surface_changed_without_compatibility_summary');
  if (surfaces.release && !/current-head evidence|rollback|stop condition/i.test(body)) reasonCodes.push('oracle_required_for_release_gate');
  if (/runtime readiness claimed\s*:\s*yes/i.test(body)) {
    if (/fixture pass|fixture-only|fixture only/i.test(body)) reasonCodes.push('fixture_not_sufficient_for_runtime_claim');
    if (!/(smoke|test|schema|validator|current-head evidence)/i.test(body)) reasonCodes.push('oracle_required_for_runtime_readiness');
  }
  let status = 'pass';
  if (reasonCodes.some((code) => !['oracle_required_for_storage_surface', 'api_surface_changed_without_compatibility_summary'].includes(code))) status = 'fail';
  else if (reasonCodes.length || (provided && oracleType(body) === 'manual_check')) status = 'manual_confirmation_required';
  return {
    status,
    oracleRequired: required,
    oracleProvided: provided,
    oracleType: provided ? oracleType(body) : 'not_applicable',
    surface: surfaces.auth ? 'auth' : surfaces.storage ? 'storage' : surfaces.api ? 'api' : surfaces.runtime ? 'runtime' : surfaces.release ? 'release' : surfaces.harness ? 'harness' : files.every(isDocsFile) ? 'docs' : 'unknown',
    reasonCodes: [...new Set(reasonCodes)],
    safeSummaryOnly: true,
  };
}

function buildReasoningEvidenceEffortStatus(regime, body) {
  const reasonCodes = [];
  if (regime === 'high') {
    if (!contractProvided(body)) reasonCodes.push('high_complexity_contract_missing');
    if (!verificationPresent(body)) reasonCodes.push('reasoning_evidence_effort_mismatch');
    if (!fieldPresent(body, 'Risk surface')) reasonCodes.push('reasoning_evidence_effort_mismatch');
    if (!/rollback|stop condition/i.test(body)) reasonCodes.push('reasoning_evidence_effort_mismatch');
  } else if (regime === 'medium' && !/plan-first|Task Contract|Bugfix Evidence|Verification/i.test(body)) {
    reasonCodes.push('reasoning_evidence_effort_mismatch');
  }
  const status = reasonCodes.includes('high_complexity_contract_missing') ? 'fail' : reasonCodes.length ? 'manual_confirmation_required' : 'pass';
  return {
    status,
    taskComplexity: regime,
    planEvidencePresent: /plan-first|Plan/i.test(body),
    contractEvidencePresent: contractProvided(body),
    verificationEvidencePresent: verificationPresent(body),
    attemptEvidencePresent: /Testing and review|Validation commands|Command results/i.test(body),
    effortMismatch: reasonCodes.length > 0,
    reasonCodes: [...new Set(reasonCodes)],
    safeSummaryOnly: true,
  };
}

function buildAlgorithmicArtifactStatus(regime, body) {
  const reasonCodes = [];
  const required = regime === 'high' || /large output|many-step|runtime readiness|concurrency|migration|storage/i.test(body);
  const provided = artifactProvided(body);
  if (required && !provided) reasonCodes.push('algorithmic_artifact_required');
  if (/runtime readiness claimed\s*:\s*yes/i.test(body) && /fixture pass|fixture-only|fixture only/i.test(body)) reasonCodes.push('fixture_not_sufficient_for_runtime_claim');
  if (/manual explanation only|long explanation only/i.test(body)) reasonCodes.push('algorithmic_artifact_required');
  let status = reasonCodes.length ? 'fail' : 'pass';
  if (reasonCodes.includes('algorithmic_artifact_required') && /manual[_ ]check|unavailable[_ ]with[_ ]reason/i.test(body) && !/manual explanation only|long explanation only/i.test(body)) {
    status = 'manual_confirmation_required';
  }
  return {
    status,
    artifactRequired: required,
    artifactProvided: provided,
    artifactType: provided ? artifactType(body) : 'not_applicable',
    reasonCodes: [...new Set(reasonCodes)],
    safeSummaryOnly: true,
  };
}

function buildExecutionInterfaceStatus(body) {
  const requiredTools = listValue(lineValue(body, 'Required tools'));
  const availableTools = listValue(lineValue(body, 'Available tools'));
  const explicitMissing = listValue(lineValue(body, 'Missing tools'));
  const missingTools = explicitMissing.length
    ? explicitMissing
    : requiredTools.filter((tool) => availableTools.length && !availableTools.includes(tool));
  const readinessClaimed = /runtime readiness claimed\s*:\s*yes|production readiness|deployment readiness/i.test(body);
  const claimsPass = /verification\s*:\s*pass|source\/core local gate\s*:\s*pass|target gate\s*:\s*pass/i.test(body);
  const reasonCodes = [];
  if (missingTools.length && (readinessClaimed || claimsPass && /required tool unavailable|tool unavailable/i.test(body))) reasonCodes.push('verification_blocked_by_missing_tool');
  else if (missingTools.length) reasonCodes.push('verification_weakened_by_missing_tool');
  if (/npm run [A-Za-z0-9:_-]+.*invented|command invented|nonexistent command/i.test(body)) reasonCodes.push('invented_command_detected');
  const status = reasonCodes.includes('verification_blocked_by_missing_tool') || reasonCodes.includes('invented_command_detected')
    ? 'fail'
    : reasonCodes.length ? 'manual_confirmation_required' : 'pass';
  return {
    status,
    requiredTools,
    availableTools,
    missingTools,
    missingToolImpact: reasonCodes.includes('verification_blocked_by_missing_tool') ? 'blocks_verification' : missingTools.length ? 'weakens_evidence' : 'none',
    reasonCodes: [...new Set(reasonCodes)],
    safeSummaryOnly: true,
  };
}

function buildSplitRequirementStatus(regime, files, body, env = process.env) {
  const surfaces = surfaceSummary(files, body);
  const multiSurface = [surfaces.auth, surfaces.storage, surfaces.api, surfaces.runtime, surfaces.release, surfaces.pkg].filter(Boolean).length > 1;
  const productMixed = taskMode(body) === 'harness_change' && files.some(isProductFile);
  const splitRequired = productMixed || (regime === 'high' && (multiSurface || largeDiff(files, env))) || /large product diff|auth \+ storage|package\/lockfile \+ product/i.test(body);
  const splitProvided = /split plan|split reason|Split required\s*:\s*no|Split required\s*:\s*yes/i.test(body);
  const reasonCodes = [];
  if (productMixed) reasonCodes.push('harness_change_mixed_with_product_files');
  if (splitRequired && !splitProvided) reasonCodes.push(largeDiff(files, env) ? 'split_required_for_large_diff' : 'split_required_for_multi_surface_change');
  const status = productMixed ? 'fail' : reasonCodes.length ? 'manual_confirmation_required' : 'pass';
  return {
    status,
    splitRequired,
    splitProvided,
    splitReason: lineValue(body, 'Split required') || lineValue(body, 'Split reason') || '',
    reasonCodes: [...new Set(reasonCodes)],
    safeSummaryOnly: true,
  };
}

function combineStatuses(items) {
  const statuses = items.map((item) => item.status).filter(Boolean);
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('manual_confirmation_required')) return 'manual_confirmation_required';
  if (statuses.includes('warning')) return 'warning';
  return 'pass';
}

function requiredNextAction(status, reasonCodes) {
  if (status === 'pass') return 'none';
  if (reasonCodes.includes('high_complexity_oracle_missing')) return 'add surface-specific oracle evidence';
  if (reasonCodes.includes('high_complexity_contract_missing')) return 'add task contract';
  if (reasonCodes.includes('solvability_constraints_conflict')) return 'resolve contradictory scope constraints';
  if (reasonCodes.includes('verification_blocked_by_missing_tool')) return 'provide available verification interface or remove readiness claim';
  if (reasonCodes.includes('split_required_for_large_diff')) return 'add split plan or split reason';
  return 'review complexity governance reason codes';
}

export function buildComplexityGovernanceReport(env = process.env) {
  const explicit = String(env.CODEX_COMPLEXITY_GOVERNANCE_MODE || '').trim().toLowerCase();
  const mode = allowedModes.has(explicit) ? explicit : isPrContext(env) ? 'enforce' : 'report';
  if (mode === 'off') return simpleStatus('complexityGovernanceStatus', 'not_applicable', { mode, regime: 'unknown', reasonCodes: ['complexity_governance_off'] });
  const body = prBodyText(env);
  if (!isPrContext(env) && !body.trim()) {
    return simpleStatus('complexityGovernanceStatus', 'pass', {
      mode,
      regime: 'unknown',
      solvabilityStatus: { status: 'not_applicable', reasonCodes: ['local_non_pr_report_only'], safeSummaryOnly: true },
      oracleRequirementStatus: { status: 'not_applicable', oracleRequired: false, oracleProvided: false, oracleType: 'not_applicable', surface: 'unknown', reasonCodes: [], safeSummaryOnly: true },
      reasoningEvidenceEffortStatus: { status: 'not_applicable', taskComplexity: 'unknown', reasonCodes: [], safeSummaryOnly: true },
      executionInterfaceStatus: { status: 'pass', requiredTools: [], availableTools: [], missingTools: [], missingToolImpact: 'none', reasonCodes: [], safeSummaryOnly: true },
      algorithmicArtifactStatus: { status: 'not_applicable', artifactRequired: false, artifactProvided: false, artifactType: 'not_applicable', reasonCodes: [], safeSummaryOnly: true },
      splitRequirementStatus: { status: 'not_applicable', splitRequired: false, splitProvided: false, splitReason: '', reasonCodes: [], safeSummaryOnly: true },
      reasonCodes: [],
      requiredNextAction: 'none',
    });
  }
  const files = changedFiles(env);
  const regime = classifyRegime(files, body, env);
  const reasonCodes = [];
  if (regime === 'unknown' && isPrContext(env)) reasonCodes.push('task_complexity_unknown');
  const solvabilityStatus = buildSolvabilityStatus(regime, files, body, env);
  const oracleRequirementStatus = buildOracleRequirementStatus(regime, files, body, env);
  const reasoningEvidenceEffortStatus = buildReasoningEvidenceEffortStatus(regime, body);
  const executionInterfaceStatus = buildExecutionInterfaceStatus(body);
  const algorithmicArtifactStatus = buildAlgorithmicArtifactStatus(regime, body);
  const splitRequirementStatus = buildSplitRequirementStatus(regime, files, body, env);
  reasonCodes.push(
    ...solvabilityStatus.reasonCodes,
    ...oracleRequirementStatus.reasonCodes,
    ...reasoningEvidenceEffortStatus.reasonCodes,
    ...executionInterfaceStatus.reasonCodes,
    ...algorithmicArtifactStatus.reasonCodes,
    ...splitRequirementStatus.reasonCodes,
  );
  if (productVerificationStatus(env).status === 'fail') reasonCodes.push('product_verification_failed');
  let status = combineStatuses([
    solvabilityStatus,
    oracleRequirementStatus,
    reasoningEvidenceEffortStatus,
    executionInterfaceStatus,
    algorithmicArtifactStatus,
    splitRequirementStatus,
  ]);
  if (reasonCodes.includes('task_complexity_unknown')) status = status === 'fail' ? 'fail' : 'manual_confirmation_required';
  const uniqueReasons = [...new Set(reasonCodes)];
  const payload = {
    status,
    mode,
    regime: allowedRegimes.has(regime) ? regime : 'unknown',
    solvabilityStatus,
    oracleRequirementStatus,
    reasoningEvidenceEffortStatus,
    executionInterfaceStatus,
    algorithmicArtifactStatus,
    splitRequirementStatus,
    reasonCodes: uniqueReasons,
    requiredNextAction: requiredNextAction(status, uniqueReasons),
    safeSummaryOnly: true,
  };
  if (!allowedStatuses.has(status) || scanObjectForUnsafe(payload).length || env.CODEX_COMPLEXITY_TEST_UNSAFE === '1') {
    return simpleStatus('complexityGovernanceStatus', 'fail', { ...payload, reasonCodes: ['complexity_governance_failed'], requiredNextAction: 'fix complexity governance output shape' });
  }
  return simpleStatus('complexityGovernanceStatus', status, payload);
}

export function buildComplexityEvalSuiteReport(env = process.env) {
  const path = env.CODEX_COMPLEXITY_EVAL_CASES_PATH || 'docs/process/CODEX_COMPLEXITY_EVAL_CASES.json';
  const parsed = readJson(path);
  if (!parsed.ok || !Array.isArray(parsed.value?.cases)) {
    return simpleStatus('complexityEvalSuiteStatus', 'fail', { reasonCodes: ['complexity_eval_suite_invalid'] });
  }
  const failures = [];
  const cases = parsed.value.cases.map((testCase) => {
    const statusEnv = Object.entries(testCase.inputStatuses || {}).reduce((acc, [key, value]) => {
      acc[key] = JSON.stringify(value);
      return acc;
    }, {});
    const report = buildComplexityGovernanceReport({
      ...env,
      ...statusEnv,
      CODEX_EVENT_NAME: 'pull_request',
      CODEX_PR_NUMBER: '88',
      CODEX_PR_HEAD_SHA: 'eval-head',
      CODEX_CHANGED_FILES: (testCase.changedFiles || []).join('\n'),
      CODEX_PR_BODY: testCase.prBody || `Task mode: ${testCase.taskMode || 'unknown'}`,
      CODEX_COMPLEXITY_GOVERNANCE_MODE: 'enforce',
      CODEX_DIFF_NUMSTAT: testCase.diffNumstat || '',
    }).complexityGovernanceStatus;
    const expected = testCase.expected || {};
    const missingReasons = (expected.reasonCodes || []).filter((code) => !(report.reasonCodes || []).includes(code));
    const ok = report.status === expected.status && report.regime === expected.regime && missingReasons.length === 0;
    if (!ok) failures.push(testCase.id);
    return { id: testCase.id, status: ok ? 'pass' : 'fail', actualStatus: report.status, actualRegime: report.regime, missingReasons, safeSummaryOnly: true };
  });
  return simpleStatus('complexityEvalSuiteStatus', failures.length ? 'fail' : 'pass', {
    casesRun: cases.length,
    failures,
    cases,
    reasonCodes: failures.length ? ['complexity_eval_case_failed'] : [],
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildComplexityGovernanceReport();
    writeJsonReport(report, 'CODEX_COMPLEXITY_GOVERNANCE_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('complexityGovernanceStatus', 'fail', { reasonCodes: ['complexity_governance_failed'], requiredNextAction: 'review complexity governance gate' });
    writeJsonReport(report, 'CODEX_COMPLEXITY_GOVERNANCE_REPORT');
    process.exit(1);
  }
}
