#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v0.9.3
import { fileURLToPath } from 'node:url';
import { normalizePath, prBodyText, simpleStatus, writeJsonReport, exitFor } from './codex-v080-lib.mjs';

function parseInput(env = process.env) {
  if (env.CODEX_GOAL_CONDITION_JSON) {
    try { return JSON.parse(env.CODEX_GOAL_CONDITION_JSON); }
    catch { return { invalidInput: true }; }
  }
  return {
    goal: env.CODEX_GOAL || 'source harness validation',
    measurableEndState: env.CODEX_MEASURABLE_END_STATE || 'local quality gate pass',
    proofCommand: env.CODEX_PROOF_COMMAND || 'node scripts/codex-local-quality-gate.mjs',
    mustNotChange: env.CODEX_MUST_NOT_CHANGE || 'product files',
    stopCondition: env.CODEX_STOP_CONDITION || 'stop after requested scope',
    maxScope: env.CODEX_MAX_SCOPE || 'source harness managed files',
  };
}

function present(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(String(value || '').trim());
}

export function buildGoalConditionReport(input = parseInput(), env = process.env) {
  const reasonCodes = [];
  const warnings = [];
  const r3 = input.riskLevel === 'R3' || /R3/i.test(prBodyText(env));
  const required = ['goal', 'measurableEndState', 'proofCommand', 'mustNotChange', 'stopCondition', 'maxScope'];
  for (const key of required) if (!present(input[key])) reasonCodes.push('goal_condition_missing');
  if (r3 && !present(input.measurableEndState)) reasonCodes.push('goal_condition_missing');
  if (input.targetRollout && !present(input.mustNotChange)) reasonCodes.push('goal_condition_missing');
  if (input.scopeExpanded || input.nextTaskStartedBeforeGoalAchieved || input.goalExpandsBeyondRequestedScope) reasonCodes.push('goal_scope_expansion_detected');
  if (/manual only/i.test(String(input.proofCommand || ''))) warnings.push('goal_condition_manual_only_proof');
  if (present(input.goal) && String(input.goal).length < 8) warnings.push('goal_condition_vague');
  const status = reasonCodes.length ? 'fail' : (warnings.length ? 'warning' : 'pass');
  return simpleStatus('goalConditionStatus', status, { reasonCodes: [...new Set(reasonCodes)], warnings, safeSummaryOnly: true });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = buildGoalConditionReport();
  writeJsonReport(report, 'CODEX_GOAL_CONDITION_REPORT');
  exitFor(report);
}

