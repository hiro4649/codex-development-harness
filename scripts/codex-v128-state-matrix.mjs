#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.2.8

import fs from 'node:fs';
import process from 'node:process';

function keyOf(cell) {
  return `${cell.decisionPhase}|${cell.providerClosureState}|${cell.mergeAuthorityState}`;
}

function expandProduct(enums = {}) {
  const phases = enums.decisionPhase || [];
  const providerStates = enums.providerClosureState || [];
  const mergeStates = enums.mergeAuthorityState || [];
  const cells = [];
  for (const decisionPhase of phases) {
    for (const providerClosureState of providerStates) {
      for (const mergeAuthorityState of mergeStates) {
        cells.push({ decisionPhase, providerClosureState, mergeAuthorityState });
      }
    }
  }
  return cells;
}

function normalizeValidTransitions(matrix = {}) {
  return (matrix.validTransitions || matrix.states || []).map((row) => ({
    decisionPhase: row.decisionPhase,
    providerClosureState: row.providerClosureState,
    mergeAuthorityState: row.mergeAuthorityState,
    transition: row.transition,
  }));
}

export function evaluateV128StateMatrix(matrix = {}) {
  const cells = expandProduct(matrix.enums || {});
  const transitions = normalizeValidTransitions(matrix);
  const transitionByKey = new Map();
  const duplicateTransitionKeys = [];
  for (const row of transitions) {
    const key = keyOf(row);
    if (transitionByKey.has(key)) duplicateTransitionKeys.push(key);
    transitionByKey.set(key, row.transition);
  }
  const evaluated = cells.map((cell) => {
    const key = keyOf(cell);
    const transition = transitionByKey.get(key);
    return transition
      ? { ...cell, effect: 'transition', transition }
      : { ...cell, effect: 'hard_invalid', reason: 'phase_state_combination_invalid' };
  });
  const transitionCells = evaluated.filter((cell) => cell.effect === 'transition');
  const hardInvalidCells = evaluated.filter((cell) => cell.effect === 'hard_invalid');
  const expectedTotal = (matrix.expectedCellCount === undefined)
    ? cells.length
    : Number(matrix.expectedCellCount);
  const reasons = [];
  if (matrix.finiteEnumProductRequired !== true) reasons.push('finite_enum_product_required');
  if (matrix.routineRuntimeUsesCompiledTable !== true) reasons.push('compiled_table_required');
  if (matrix.implicitFallbackForbidden !== true) reasons.push('implicit_fallback_must_be_forbidden');
  if (matrix.firstMatchRuleForbidden !== true) reasons.push('first_match_rule_must_be_forbidden');
  if (matrix.fullEnumProductExecuted !== true) reasons.push('full_enum_product_not_executed');
  if (matrix.coverage !== 'full_shadow_candidate') reasons.push('state_matrix_coverage_not_full_shadow_candidate');
  if (cells.length === 0) reasons.push('state_matrix_empty_enum_product');
  if (cells.length !== expectedTotal) reasons.push('state_matrix_cell_count_mismatch');
  if (duplicateTransitionKeys.length) reasons.push('state_matrix_duplicate_transition_key');
  if (transitionCells.length !== transitions.length) reasons.push('state_matrix_transition_count_mismatch');
  if ((matrix.expectedTransitionCount !== undefined) && transitionCells.length !== Number(matrix.expectedTransitionCount)) reasons.push('state_matrix_expected_transition_count_mismatch');
  if ((matrix.expectedHardInvalidCount !== undefined) && hardInvalidCells.length !== Number(matrix.expectedHardInvalidCount)) reasons.push('state_matrix_expected_invalid_count_mismatch');
  const evaluatedKeys = new Set(evaluated.map(keyOf));
  if (evaluatedKeys.size !== cells.length) reasons.push('state_matrix_unresolved_or_duplicate_cells');
  return {
    status: reasons.length ? 'fail' : 'pass',
    reasonCodes: reasons,
    coverage: matrix.coverage || 'unknown',
    fullEnumProductExecuted: matrix.fullEnumProductExecuted === true,
    totalCells: cells.length,
    transitionCells: transitionCells.length,
    hardInvalidCells: hardInvalidCells.length,
    unresolvedCells: Math.max(0, cells.length - evaluated.length),
    duplicateTransitionKeys,
    safeSummaryOnly: true,
  };
}

export function readAndEvaluateV128StateMatrix(file = 'docs/process/CODEX_V128_STATE_MATRIX.json') {
  return evaluateV128StateMatrix(JSON.parse(fs.readFileSync(file, 'utf8')));
}

if (process.argv[1] && process.argv[1].endsWith('codex-v128-state-matrix.mjs')) {
  const result = readAndEvaluateV128StateMatrix(process.argv[2]);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.status === 'pass' ? 0 : 1);
}
