#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.0.3
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
import { changedFiles } from './codex-change-classification-gate.mjs';

function lineValue(body, label) {
  const match = String(body || '').match(new RegExp(`^\\s*${label}\\s*:\\s*(.+?)\\s*$`, 'im'));
  return match?.[1]?.trim() || '';
}

function sectionHas(body, section, pattern) {
  const text = String(body || '');
  const start = text.search(new RegExp(`^##\\s+${section}\\s*$`, 'im'));
  if (start < 0) return false;
  const rest = text.slice(start);
  const next = rest.slice(1).search(/^##\s+/m);
  const sectionText = next >= 0 ? rest.slice(0, next + 1) : rest;
  return pattern.test(sectionText);
}

function parseJsonEnvOrFile(envName, file, env = process.env) {
  if (env[envName]) {
    try { return { ok: true, value: JSON.parse(env[envName]), source: 'env' }; } catch { return { ok: false, reasonCode: 'task_contract_invalid', source: 'env' }; }
  }
  if (fs.existsSync(file)) {
    const parsed = readJson(file);
    return { ...parsed, source: file };
  }
  return { ok: false, reasonCode: 'missing', source: 'not_provided' };
}

function riskyChange(files, body, env = process.env) {
  const text = `${files.join('\n')}\n${body}`;
  return isPrContext(env) && (
    /Risk level\s*:\s*R3|harness_workflow_r3|runtime readiness claimed\s*:\s*yes|release_gate/i.test(body) ||
    /scripts\/codex-|docs\/process\/CODEX_.*POLICY|docs\/process\/CODEX_.*SCHEMA|AGENTS\.md/i.test(text)
  );
}

function taskContractFromBody(body) {
  if (!/## Task Contract/i.test(body)) return null;
  return {
    taskMode: lineValue(body, 'Task Mode') || lineValue(body, 'Task mode'),
    goal: lineValue(body, 'Goal') || '',
    doneCriteria: lineValue(body, 'Done criteria') || '',
    verificationSurface: lineValue(body, 'Verification surface') || '',
    riskSurface: lineValue(body, 'Risk surface') || '',
    allowedScope: lineValue(body, 'Allowed scope') || '',
    forbiddenScope: lineValue(body, 'Forbidden scope') || '',
    stopCondition: lineValue(body, 'Stop condition') || '',
    safeSummaryOnly: true,
  };
}

function loadBearingFromBody(body) {
  if (!/## Load-bearing evidence/i.test(body)) return null;
  return {
    component: lineValue(body, 'Component'),
    failureModeCaught: lineValue(body, 'Failure mode caught'),
    notCoveredByExistingGates: lineValue(body, 'Not covered by existing gates'),
    negativeFixture: lineValue(body, 'Negative fixture'),
    positiveFixture: lineValue(body, 'Positive fixture'),
    runtimeCost: lineValue(body, 'Runtime cost'),
    defaultMode: lineValue(body, 'Default mode'),
    safeSummaryOnly: true,
  };
}

function validateContract(contract, required) {
  const reasons = [];
  if (required && !contract) reasons.push('task_contract_missing');
  if (contract) {
    if (!contract.doneCriteria) reasons.push('task_contract_done_criteria_missing');
    if (!contract.verificationSurface) reasons.push('task_contract_verification_surface_missing');
    if (!contract.forbiddenScope && required) reasons.push('task_contract_forbidden_scope_missing');
    if (!contract.taskMode) reasons.push('task_contract_invalid');
  }
  return reasons;
}

function validateHandoff(env = process.env) {
  const parsed = parseJsonEnvOrFile('CODEX_HANDOFF_JSON', '.codex/handoff.json', env);
  if (parsed.reasonCode === 'missing') return { status: 'not_applicable', reasonCodes: [], source: 'not_provided' };
  if (!parsed.ok) return { status: 'fail', reasonCodes: ['handoff_artifact_invalid'], source: parsed.source };
  const handoff = parsed.value.codexHandoff || parsed.value;
  const reasons = [];
  const expected = env.CODEX_PR_HEAD_SHA || env.GITHUB_SHA || '';
  if (expected && handoff.headSha && handoff.headSha !== expected) reasons.push('handoff_head_mismatch');
  if (handoff.rawLogsStored === true || handoff.rawDiffStored === true) reasons.push('handoff_raw_artifact_forbidden');
  if (scanObjectForUnsafe(handoff).length) reasons.push('handoff_artifact_invalid');
  return { status: reasons.length ? 'fail' : 'pass', reasonCodes: reasons, source: parsed.source };
}

function validateLoadBearing(loadBearing, required) {
  const reasons = [];
  if (required && !loadBearing) reasons.push('load_bearing_evidence_missing');
  if (loadBearing) {
    if (!loadBearing.negativeFixture || !loadBearing.positiveFixture) reasons.push('load_bearing_evidence_invalid');
    if (String(loadBearing.runtimeCost || '').toLowerCase() === 'high' && !/justif/i.test(JSON.stringify(loadBearing))) {
      reasons.push('load_bearing_component_cost_unjustified');
    }
    if (scanObjectForUnsafe(loadBearing).length) reasons.push('load_bearing_evidence_invalid');
  }
  return reasons;
}

export function buildContractGovernanceReport(env = process.env) {
  const mode = env.CODEX_CONTRACT_GOVERNANCE_MODE || (isPrContext(env) ? 'enforce' : 'report');
  const body = prBodyText(env);
  const files = changedFiles(env);
  const required = riskyChange(files, body, env);
  const contractFile = parseJsonEnvOrFile('CODEX_TASK_CONTRACT_JSON', '.codex/task-contract.json', env);
  const contract = contractFile.ok ? (contractFile.value.codexTaskContract || contractFile.value) : taskContractFromBody(body);
  const loadBearing = env.CODEX_LOAD_BEARING_EVIDENCE_JSON
    ? parseJsonEnvOrFile('CODEX_LOAD_BEARING_EVIDENCE_JSON', '.codex/load-bearing.json', env).value
    : loadBearingFromBody(body);
  const handoffStatus = validateHandoff(env);
  const reasonCodes = [
    ...validateContract(contract, required),
    ...handoffStatus.reasonCodes,
    ...validateLoadBearing(loadBearing, required && files.some((file) => /scripts\/codex-|CODEX_.*POLICY|CODEX_.*SCHEMA/.test(file))),
  ];
  if (/runtime readiness claimed\s*:\s*yes/i.test(body) && /\bstub\b|\bfixture pass\b|\bdisplay only\b/i.test(body)) reasonCodes.push('stub_feature_claim_detected');
  if (/feature complete\s*:\s*yes/i.test(body) && /display only/i.test(body)) reasonCodes.push('display_only_feature_claim_detected');
  let status = 'pass';
  if (reasonCodes.some((code) => !['load_bearing_component_cost_unjustified', 'display_only_feature_claim_detected'].includes(code))) status = 'fail';
  else if (reasonCodes.includes('load_bearing_component_cost_unjustified') || reasonCodes.includes('display_only_feature_claim_detected')) status = 'manual_confirmation_required';
  if (!required && !contract && !isPrContext(env)) status = 'pass';
  const payload = {
    status,
    contractRequired: required,
    contractProvided: Boolean(contract),
    contractSource: contract ? (contractFile.ok ? contractFile.source : 'pr_body') : 'not_provided',
    handoffStatus,
    loadBearingEvidenceStatus: loadBearing ? (validateLoadBearing(loadBearing, required).length ? 'fail' : 'pass') : (required ? 'missing' : 'not_applicable'),
    reasonCodes: [...new Set(reasonCodes)],
    safeSummaryOnly: true,
  };
  if (scanObjectForUnsafe(payload).length || env.CODEX_CONTRACT_TEST_UNSAFE === '1') {
    return simpleStatus('contractGovernanceStatus', 'fail', { ...payload, reasonCodes: ['contract_governance_failed'] });
  }
  return simpleStatus('contractGovernanceStatus', status, payload);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = buildContractGovernanceReport();
    writeJsonReport(report, 'CODEX_CONTRACT_GOVERNANCE_REPORT');
    exitFor(report);
  } catch {
    const report = simpleStatus('contractGovernanceStatus', 'fail', { reasonCodes: ['contract_governance_failed'] });
    writeJsonReport(report, 'CODEX_CONTRACT_GOVERNANCE_REPORT');
    process.exit(1);
  }
}
